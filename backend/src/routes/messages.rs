use axum::{
    extract::{Path, Query, State},
    Json, Extension,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    dto::{MessageResponse, PaginationParams, SendMessageRequest},
    error::AppResult,
    services,
    state::SharedState,
};

pub async fn send_channel_message(
    Path(ch_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> AppResult<Json<MessageResponse>> {
    req.validate()
        .map_err(|e| crate::error::AppError::Validation(e.to_string()))?;

    let response = services::send_channel_message(&state.db, ch_id, user_id, req).await?;

    // Broadcast to all workspace members
    let member_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT DISTINCT wm.user_id
        FROM workspace_members wm
        INNER JOIN channels c ON c.workspace_id = wm.workspace_id
        WHERE c.id = $1
        "#,
    )
    .bind(ch_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let payload = serde_json::json!({
        "type": "chat.message",
        "payload": &response,
    });
    state.send_to_users(&member_ids, &payload);

    Ok(Json(response))
}

pub async fn list_channel_messages(
    Path(ch_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<MessageResponse>>> {
    let messages = services::get_channel_messages(&state.db, ch_id, params).await?;
    Ok(Json(messages))
}

pub async fn send_dm_message(
    Path(conv_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> AppResult<Json<MessageResponse>> {
    req.validate()
        .map_err(|e| crate::error::AppError::Validation(e.to_string()))?;

    let response = services::send_dm_message(&state.db, conv_id, user_id, req).await?;

    // Broadcast to all DM participants
    let participant_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM dm_participants WHERE conversation_id = $1",
    )
    .bind(conv_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let payload = serde_json::json!({
        "type": "chat.message",
        "payload": &response,
    });
    state.send_to_users(&participant_ids, &payload);

    Ok(Json(response))
}

pub async fn list_dm_messages(
    Path(conv_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<MessageResponse>>> {
    let messages = services::get_dm_messages(&state.db, conv_id, params).await?;
    Ok(Json(messages))
}

#[derive(serde::Deserialize)]
pub struct EditMessageReq {
    pub content: String,
}

pub async fn edit_message(
    Path(msg_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<EditMessageReq>,
) -> AppResult<Json<MessageResponse>> {
    use crate::error::AppError;
    use crate::models::Message;

    let msg = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(msg_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Message not found".to_string()))?;

    if msg.sender_id != user_id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Message>(
        "UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *",
    )
    .bind(&req.content)
    .bind(msg_id)
    .fetch_one(&state.db)
    .await?;

    let sender = sqlx::query_as::<_, crate::models::User>("SELECT * FROM users WHERE id = $1")
        .bind(updated.sender_id)
        .fetch_one(&state.db)
        .await?;

    let response = MessageResponse {
        id: updated.id,
        channel_id: updated.channel_id,
        conversation_id: updated.conversation_id,
        sender: crate::dto::UserResponse {
            id: sender.id,
            email: sender.email,
            display_name: sender.display_name,
            avatar_url: sender.avatar_url,
            status: sender.status,
            status_message: sender.status_message,
        },
        content: updated.content,
        reply_to: None,
        attachments: vec![],
        edited_at: updated.edited_at,
        created_at: updated.created_at,
    };

    // Broadcast update
    let recipients: Vec<Uuid> = if let Some(ch) = updated.channel_id {
        sqlx::query_scalar(
            r#"
            SELECT DISTINCT wm.user_id FROM workspace_members wm
            INNER JOIN channels c ON c.workspace_id = wm.workspace_id
            WHERE c.id = $1
            "#,
        ).bind(ch).fetch_all(&state.db).await.unwrap_or_default()
    } else if let Some(c) = updated.conversation_id {
        sqlx::query_scalar("SELECT user_id FROM dm_participants WHERE conversation_id = $1")
            .bind(c).fetch_all(&state.db).await.unwrap_or_default()
    } else { vec![] };

    let payload = serde_json::json!({ "type": "chat.message.updated", "payload": &response });
    state.send_to_users(&recipients, &payload);

    Ok(Json(response))
}

pub async fn delete_message(
    Path(msg_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    use crate::error::AppError;
    use crate::models::Message;

    let msg = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(msg_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Message not found".to_string()))?;

    if msg.sender_id != user_id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("UPDATE messages SET deleted_at = NOW() WHERE id = $1")
        .bind(msg_id)
        .execute(&state.db)
        .await?;

    let recipients: Vec<Uuid> = if let Some(ch) = msg.channel_id {
        sqlx::query_scalar(
            r#"
            SELECT DISTINCT wm.user_id FROM workspace_members wm
            INNER JOIN channels c ON c.workspace_id = wm.workspace_id
            WHERE c.id = $1
            "#,
        ).bind(ch).fetch_all(&state.db).await.unwrap_or_default()
    } else if let Some(c) = msg.conversation_id {
        sqlx::query_scalar("SELECT user_id FROM dm_participants WHERE conversation_id = $1")
            .bind(c).fetch_all(&state.db).await.unwrap_or_default()
    } else { vec![] };

    let payload = serde_json::json!({
        "type": "chat.message.deleted",
        "payload": { "message_id": msg_id, "channel_id": msg.channel_id, "conversation_id": msg.conversation_id }
    });
    state.send_to_users(&recipients, &payload);

    Ok(axum::http::StatusCode::NO_CONTENT)
}
