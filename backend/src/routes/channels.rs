use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json, Extension,
};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::{
    dto::{ChannelResponse, CreateChannelRequest},
    error::{AppError, AppResult},
    models::Channel,
    services,
    state::SharedState,
};

async fn workspace_member_ids(state: &SharedState, channel_id: Uuid) -> Vec<Uuid> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT DISTINCT wm.user_id FROM workspace_members wm
        INNER JOIN channels c ON c.workspace_id = wm.workspace_id
        WHERE c.id = $1
        "#,
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default()
}

async fn workspace_member_ids_by_ws(state: &SharedState, ws_id: Uuid) -> Vec<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM workspace_members WHERE workspace_id = $1")
        .bind(ws_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
}

pub async fn create(
    Path(ws_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<CreateChannelRequest>,
) -> AppResult<Json<ChannelResponse>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let response = services::create_channel(&state.db, ws_id, user_id, req).await?;

    let members = workspace_member_ids_by_ws(&state, ws_id).await;
    let payload = serde_json::json!({ "type": "channel.created", "payload": &response });
    state.send_to_users(&members, &payload);

    Ok(Json(response))
}

pub async fn list(
    Path(ws_id): Path<Uuid>,
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<Vec<ChannelResponse>>> {
    let channels = services::get_workspace_channels(&state.db, ws_id, user_id).await?;
    Ok(Json(channels))
}

pub async fn get(
    Path(ch_id): Path<Uuid>,
    State(state): State<SharedState>,
) -> AppResult<Json<ChannelResponse>> {
    let ch = sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
        .bind(ch_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("Channel not found".to_string()))?;

    Ok(Json(ChannelResponse {
        id: ch.id, workspace_id: ch.workspace_id, name: ch.name,
        topic: ch.topic, is_private: ch.is_private, created_at: ch.created_at,
    }))
}

#[derive(Deserialize)]
pub struct UpdateChannel {
    pub name: Option<String>,
    pub topic: Option<String>,
}

pub async fn update(
    Path(ch_id): Path<Uuid>,
    State(state): State<SharedState>,
    Json(req): Json<UpdateChannel>,
) -> AppResult<Json<ChannelResponse>> {
    let ch = sqlx::query_as::<_, Channel>(
        r#"
        UPDATE channels
        SET name = COALESCE($2, name), topic = COALESCE($3, topic), updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(ch_id).bind(req.name).bind(req.topic)
    .fetch_one(&state.db).await?;

    let response = ChannelResponse {
        id: ch.id, workspace_id: ch.workspace_id, name: ch.name,
        topic: ch.topic, is_private: ch.is_private, created_at: ch.created_at,
    };

    let members = workspace_member_ids(&state, ch_id).await;
    let payload = serde_json::json!({ "type": "channel.updated", "payload": &response });
    state.send_to_users(&members, &payload);

    Ok(Json(response))
}

pub async fn delete(
    Path(ch_id): Path<Uuid>,
    State(state): State<SharedState>,
) -> AppResult<StatusCode> {
    // Get channel info before deleting (for workspace_id)
    let ch = sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
        .bind(ch_id)
        .fetch_optional(&state.db)
        .await?;

    let members = workspace_member_ids(&state, ch_id).await;

    sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(ch_id)
        .execute(&state.db)
        .await?;

    if let Some(c) = ch {
        let payload = serde_json::json!({
            "type": "channel.deleted",
            "payload": { "id": ch_id, "workspace_id": c.workspace_id }
        });
        state.send_to_users(&members, &payload);
    }

    Ok(StatusCode::NO_CONTENT)
}
