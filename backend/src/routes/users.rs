use axum::{
    extract::{Path, Query, State},
    Json, Extension,
};
use uuid::Uuid;

use crate::{
    dto::{UpdateUserRequest, UserResponse, UserSearchResult},
    error::AppResult,
    services,
    state::SharedState,
};

pub async fn get_me(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<UserResponse>> {
    let user = services::get_user_by_id(&state.db, user_id).await?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: user.status,
        status_message: user.status_message,
    }))
}

pub async fn update_me(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> AppResult<Json<UserResponse>> {
    let response = services::update_user(&state.db, user_id, req).await?;
    Ok(Json(response))
}

pub async fn get_user(
    Path(user_id): Path<Uuid>,
    State(state): State<SharedState>,
) -> AppResult<Json<UserResponse>> {
    let user = services::get_user_by_id(&state.db, user_id).await?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: user.status,
        status_message: user.status_message,
    }))
}

#[derive(serde::Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn search_users(
    Query(query): Query<SearchQuery>,
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<UserSearchResult>>> {
    let results = services::search_users(&state.db, &query.q, query.limit.unwrap_or(10)).await?;
    Ok(Json(results))
}
