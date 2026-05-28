use axum::{
    extract::State,
    Json, Extension,
};
use uuid::Uuid;

use crate::{
    dto::{CreateDmRequest, DmConversationResponse},
    error::AppResult,
    services,
    state::SharedState,
};

pub async fn create_or_get(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<CreateDmRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let conv_id = services::create_or_get_dm(&state.db, user_id, req.user_id).await?;

    Ok(Json(serde_json::json!({ "conversation_id": conv_id })))
}

pub async fn list(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<Vec<DmConversationResponse>>> {
    let conversations = services::get_user_dm_conversations(&state.db, user_id).await?;
    Ok(Json(conversations))
}
