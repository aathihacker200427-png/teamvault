use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use crate::state::SharedState;

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<SharedState>,
) -> Response {
    let user_id = match validate_token(&query.token, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(_) => return Response::builder().status(401).body(Default::default()).unwrap(),
    };

    ws.on_upgrade(move |socket| handle_socket(socket, user_id, state))
}

fn validate_token(token: &str, secret: &str) -> Result<Uuid, ()> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
    use crate::middleware::Claims;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| ())?;

    Uuid::parse_str(&token_data.claims.sub).map_err(|_| ())
}

async fn handle_socket(socket: WebSocket, user_id: Uuid, state: SharedState) {
    let (mut sender, mut receiver) = socket.split();

    let conn_id = Uuid::new_v4();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    state.ws_manager.connections.entry(user_id).or_insert_with(Vec::new).push(
        crate::state::ConnectionHandle {
            conn_id,
            sender: tx.clone(),
        },
    );

    state.presence.states.insert(
        user_id,
        crate::state::PresenceState {
            status: crate::state::UserStatus::Online,
            last_seen: chrono::Utc::now(),
            connection_count: 1,
        },
    );

    // Update DB status to online
    let _ = sqlx::query("UPDATE users SET status = 'online', last_seen_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await;

    // Broadcast presence: online to all other connected users
    broadcast_presence(&state, user_id, "online").await;

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let state_for_recv = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Err(e) = handle_message(&text, user_id, &state_for_recv, &tx).await {
                    tracing::error!("Error handling message: {:?}", e);
                }
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // === Cleanup on disconnect ===

    // Remove from connections
    state.ws_manager.connections.remove(&user_id);

    // Update presence state
    state.presence.states.insert(
        user_id,
        crate::state::PresenceState {
            status: crate::state::UserStatus::Offline,
            last_seen: chrono::Utc::now(),
            connection_count: 0,
        },
    );

    // Update DB status to offline
    let _ = sqlx::query("UPDATE users SET status = 'offline', last_seen_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await;

    // Broadcast presence: offline to all other connected users
    broadcast_presence(&state, user_id, "offline").await;

    // Auto-leave any active calls
    let active_calls = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT cs.id FROM call_sessions cs
        INNER JOIN call_participants cp ON cp.call_session_id = cs.id
        WHERE cp.user_id = $1 AND cp.left_at IS NULL AND cs.status != 'ended'
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for call_id in active_calls {
        // Mark user as left
        let _ = sqlx::query(
            "UPDATE call_participants SET left_at = NOW() WHERE call_session_id = $1 AND user_id = $2",
        )
        .bind(call_id)
        .bind(user_id)
        .execute(&state.db)
        .await;

        // Check if call should end
        let remaining: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM call_participants WHERE call_session_id = $1 AND left_at IS NULL",
        )
        .bind(call_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        if remaining == 0 {
            let _ = sqlx::query(
                "UPDATE call_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1",
            )
            .bind(call_id)
            .execute(&state.db)
            .await;
        }

        // Broadcast call.left to other participants and original recipients
        let mut recipients: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
            "SELECT DISTINCT user_id FROM call_participants WHERE call_session_id = $1 AND user_id != $2",
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        if let Ok(Some((channel_id, conv_id))) = sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
            "SELECT channel_id, conversation_id FROM call_sessions WHERE id = $1",
        )
        .bind(call_id)
        .fetch_optional(&state.db)
        .await
        {
            if let Some(c) = conv_id {
                let dm: Vec<Uuid> = sqlx::query_scalar(
                    "SELECT user_id FROM dm_participants WHERE conversation_id = $1 AND user_id != $2",
                )
                .bind(c)
                .bind(user_id)
                .fetch_all(&state.db)
                .await
                .unwrap_or_default();
                recipients.extend(dm);
            }
            if let Some(ch) = channel_id {
                let members: Vec<Uuid> = sqlx::query_scalar(
                    r#"
                    SELECT DISTINCT wm.user_id FROM workspace_members wm
                    INNER JOIN channels c ON c.workspace_id = wm.workspace_id
                    WHERE c.id = $1 AND wm.user_id != $2
                    "#,
                )
                .bind(ch)
                .bind(user_id)
                .fetch_all(&state.db)
                .await
                .unwrap_or_default();
                recipients.extend(members);
            }
        }

        recipients.sort();
        recipients.dedup();

        let payload = serde_json::json!({
            "type": "call.left",
            "payload": { "call_id": call_id, "user_id": user_id }
        });
        state.send_to_users(&recipients, &payload);
    }
}

async fn broadcast_presence(state: &SharedState, user_id: Uuid, status: &str) {
    let payload = serde_json::json!({
        "type": "presence.changed",
        "payload": { "user_id": user_id.to_string(), "status": status }
    });
    let msg = payload.to_string();

    // Broadcast to all connected users (except self)
    for entry in state.ws_manager.connections.iter() {
        if *entry.key() == user_id { continue; }
        for conn in entry.value().iter() {
            let _ = conn.sender.send(msg.clone());
        }
    }
}

async fn handle_message(
    text: &str,
    user_id: Uuid,
    state: &SharedState,
    tx: &tokio::sync::mpsc::UnboundedSender<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let msg: serde_json::Value = serde_json::from_str(text)?;
    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match msg_type {
        "ping" => {
            let response = serde_json::json!({
                "type": "pong",
                "payload": { "server_time": chrono::Utc::now().timestamp() }
            });
            tx.send(response.to_string())?;
        }
        // WebRTC signaling - relay to target user
        "signal.offer" | "signal.answer" | "signal.ice_candidate" => {
            let payload = msg.get("payload").cloned().unwrap_or(serde_json::Value::Null);
            if let Some(target) = payload.get("target_user_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()) {
                let relay = serde_json::json!({
                    "type": msg_type,
                    "payload": {
                        "from_user_id": user_id.to_string(),
                        "call_id": payload.get("call_id"),
                        "data": payload.get("data"),
                    }
                });
                state.send_to_user(target, &relay);
            }
        }
        // Typing indicators - relay to channel/dm participants
        "typing.start" | "typing.stop" => {
            let payload = msg.get("payload").cloned().unwrap_or(serde_json::Value::Null);
            let target_id = payload.get("target_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok());
            let target_type = payload.get("target_type").and_then(|v| v.as_str()).unwrap_or("");

            if let Some(t_id) = target_id {
                let recipients: Vec<Uuid> = if target_type == "channel" {
                    sqlx::query_scalar(
                        r#"
                        SELECT DISTINCT wm.user_id FROM workspace_members wm
                        INNER JOIN channels c ON c.workspace_id = wm.workspace_id
                        WHERE c.id = $1 AND wm.user_id != $2
                        "#,
                    )
                    .bind(t_id)
                    .bind(user_id)
                    .fetch_all(&state.db)
                    .await
                    .unwrap_or_default()
                } else if target_type == "dm" {
                    sqlx::query_scalar(
                        "SELECT user_id FROM dm_participants WHERE conversation_id = $1 AND user_id != $2",
                    )
                    .bind(t_id)
                    .bind(user_id)
                    .fetch_all(&state.db)
                    .await
                    .unwrap_or_default()
                } else {
                    vec![]
                };

                let relay = serde_json::json!({
                    "type": msg_type,
                    "payload": {
                        "user_id": user_id.to_string(),
                        "target_id": t_id.to_string(),
                        "target_type": target_type,
                    }
                });
                state.send_to_users(&recipients, &relay);
            }
        }
        _ => {
            tracing::debug!("Unknown message type: {}", msg_type);
        }
    }

    Ok(())
}
