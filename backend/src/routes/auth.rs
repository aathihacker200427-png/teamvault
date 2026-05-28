use axum::{extract::State, http::StatusCode, Json};
use validator::Validate;

use crate::{
    dto::{AuthResponse, LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse},
    error::{AppError, AppResult},
    services,
    state::SharedState,
};

pub async fn register(
    State(state): State<SharedState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = services::register(&state.db, req).await?;
    Ok(Json(response))
}

pub async fn login(
    State(state): State<SharedState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = services::login(&state.db, req, &state.config).await?;
    Ok(Json(response))
}

pub async fn refresh_token(
    State(state): State<SharedState>,
    Json(req): Json<RefreshTokenRequest>,
) -> AppResult<Json<TokenResponse>> {
    Err(AppError::BadRequest("Not implemented".to_string()))
}

pub async fn logout(
    State(state): State<SharedState>,
    Json(req): Json<RefreshTokenRequest>,
) -> Result<StatusCode, AppError> {
    Ok(StatusCode::OK)
}
