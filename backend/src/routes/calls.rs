use axum::{
    extract::{Path, State},
    Json, Extension,
};
use uuid::Uuid;

use crate::{
    dto::{CallJoinResponse, CallResponse, InitiateCallRequest},
    error::AppResult,
    services,
    state::SharedState,
};

pub async fn initiate(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<InitiateCallRequest>,
) -> AppResult<Json<CallResponse>> {
    let target_type = req.target_type.clone();
    let target_id = req.target_id;
    let response = services::initiate_call(&state.db, user_id, req).await?;

    // Find recipients to notify
    let recipient_ids: Vec<Uuid> = if target_type == "dm" {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT user_id FROM dm_participants WHERE conversation_id = $1 AND user_id != $2",
        )
        .bind(target_id)
        .bind(user_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else if target_type == "channel" {
        sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT DISTINCT wm.user_id
            FROM workspace_members wm
            INNER JOIN channels c ON c.workspace_id = wm.workspace_id
            WHERE c.id = $1 AND wm.user_id != $2
            "#,
        )
        .bind(target_id)
        .bind(user_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let payload = serde_json::json!({
        "type": "call.incoming",
        "payload": &response,
    });
    state.send_to_users(&recipient_ids, &payload);

    Ok(Json(response))
}

pub async fn get_call(
    Path(call_id): Path<Uuid>,
    State(state): State<SharedState>,
) -> AppResult<Json<CallResponse>> {
    let response = services::get_call_details(&state.db, call_id).await?;
    Ok(Json(response))
}

pub async fn join(
    Path(call_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<CallJoinResponse>> {
    let response = services::join_call(&state.db, call_id, user_id).await?;

    // Notify other participants
    let participants: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM call_participants WHERE call_session_id = $1 AND user_id != $2",
    )
    .bind(call_id)
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let payload = serde_json::json!({ "type": "call.joined", "payload": { "call_id": call_id, "user_id": user_id } });
    state.send_to_users(&participants, &payload);

    Ok(Json(response))
}

pub async fn leave(
    Path(call_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<()>> {
    // Get call info before leaving so we know the target
    let call: Option<(Option<Uuid>, Option<Uuid>)> = sqlx::query_as(
        "SELECT channel_id, conversation_id FROM call_sessions WHERE id = $1",
    )
    .bind(call_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    services::leave_call(&state.db, call_id, user_id).await?;

    // Collect all users who should be notified: existing participants + original recipients
    let mut recipients: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT user_id FROM call_participants WHERE call_session_id = $1 AND user_id != $2",
    )
    .bind(call_id)
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    if let Some((channel_id, conv_id)) = call {
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

    let payload = serde_json::json!({ "type": "call.left", "payload": { "call_id": call_id, "user_id": user_id } });
    state.send_to_users(&recipients, &payload);

    Ok(Json(()))
}
