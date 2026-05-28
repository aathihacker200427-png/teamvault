use axum::{
    extract::{Path, State},
    Json, Extension,
};
use uuid::Uuid;
use validator::Validate;
use serde::Serialize;

use crate::{
    dto::{AddMemberRequest, CreateWorkspaceRequest, WorkspaceResponse},
    error::{AppError, AppResult},
    services,
    state::SharedState,
};

pub async fn create(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> AppResult<Json<WorkspaceResponse>> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = services::create_workspace(&state.db, user_id, req).await?;
    Ok(Json(response))
}

pub async fn list(
    State(state): State<SharedState>,
    Extension(user_id): Extension<Uuid>,
) -> AppResult<Json<Vec<WorkspaceResponse>>> {
    let workspaces = services::get_user_workspaces(&state.db, user_id).await?;
    Ok(Json(workspaces))
}

pub async fn get(
    Path(_ws_id): Path<Uuid>,
    State(_state): State<SharedState>,
) -> AppResult<Json<WorkspaceResponse>> {
    Err(AppError::NotFound("Not implemented".to_string()))
}

pub async fn add_member(
    Path(ws_id): Path<Uuid>,
    State(state): State<SharedState>,
    Json(req): Json<AddMemberRequest>,
) -> AppResult<Json<()>> {
    services::add_workspace_member(&state.db, ws_id, req).await?;
    Ok(Json(()))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct WorkspaceMemberItem {
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub status: String,
    pub role: String,
}

pub async fn list_members(
    Path(ws_id): Path<Uuid>,
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<WorkspaceMemberItem>>> {
    let members = sqlx::query_as::<_, WorkspaceMemberItem>(
        r#"
        SELECT u.id as user_id, u.display_name, u.avatar_url, u.status, wm.role
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = $1
        ORDER BY wm.role, u.display_name
        "#,
    )
    .bind(ws_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::Database)?;

    Ok(Json(members))
}
