use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    dto::{UpdateUserRequest, UserResponse, UserSearchResult},
    error::{AppError, AppResult},
    models::User,
};

pub async fn get_user_by_id(db: &PgPool, user_id: Uuid) -> AppResult<User> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))
}

pub async fn update_user(
    db: &PgPool,
    user_id: Uuid,
    req: UpdateUserRequest,
) -> AppResult<UserResponse> {
    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET
            display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            status_message = COALESCE($4, status_message),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&req.display_name)
    .bind(&req.avatar_url)
    .bind(&req.status_message)
    .fetch_one(db)
    .await?;

    Ok(UserResponse {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: user.status,
        status_message: user.status_message,
    })
}

pub async fn search_users(
    db: &PgPool,
    query: &str,
    limit: i64,
) -> AppResult<Vec<UserSearchResult>> {
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT * FROM users
        WHERE display_name ILIKE $1 OR email ILIKE $1
        LIMIT $2
        "#,
    )
    .bind(format!("%{}%", query))
    .bind(limit.min(20))
    .fetch_all(db)
    .await?;

    Ok(users
        .into_iter()
        .map(|u| UserSearchResult {
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            status: u.status,
        })
        .collect())
}
