use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    dto::{AddMemberRequest, CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceResponse},
    error::{AppError, AppResult},
    models::{Workspace, WorkspaceMember},
};

pub async fn create_workspace(
    db: &PgPool,
    user_id: Uuid,
    req: CreateWorkspaceRequest,
) -> AppResult<WorkspaceResponse> {
    let slug = req.name.to_lowercase().replace(' ', "-");

    let workspace = sqlx::query_as::<_, Workspace>(
        r#"
        INSERT INTO workspaces (name, slug, owner_id)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(&req.name)
    .bind(&slug)
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e {
            if db_err.constraint() == Some("workspaces_slug_key") {
                return AppError::BadRequest("Workspace slug already exists".to_string());
            }
        }
        AppError::Database(e)
    })?;

    sqlx::query(
        r#"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'owner')
        "#,
    )
    .bind(workspace.id)
    .bind(user_id)
    .execute(db)
    .await?;

    Ok(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        icon_url: workspace.icon_url,
        owner_id: workspace.owner_id,
        created_at: workspace.created_at,
    })
}

pub async fn get_user_workspaces(db: &PgPool, user_id: Uuid) -> AppResult<Vec<WorkspaceResponse>> {
    let workspaces = sqlx::query_as::<_, Workspace>(
        r#"
        SELECT w.* FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(workspaces
        .into_iter()
        .map(|w| WorkspaceResponse {
            id: w.id,
            name: w.name,
            slug: w.slug,
            icon_url: w.icon_url,
            owner_id: w.owner_id,
            created_at: w.created_at,
        })
        .collect())
}

pub async fn add_workspace_member(
    db: &PgPool,
    workspace_id: Uuid,
    req: AddMemberRequest,
) -> AppResult<()> {
    let role = req.role.unwrap_or_else(|| "member".to_string());

    sqlx::query(
        r#"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        "#,
    )
    .bind(workspace_id)
    .bind(req.user_id)
    .bind(&role)
    .execute(db)
    .await?;

    Ok(())
}
