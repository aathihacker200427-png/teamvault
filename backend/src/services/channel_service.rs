use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    dto::{ChannelResponse, CreateChannelRequest, UpdateChannelRequest},
    error::{AppError, AppResult},
    models::Channel,
};

pub async fn create_channel(
    db: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    req: CreateChannelRequest,
) -> AppResult<ChannelResponse> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (workspace_id, name, topic, is_private, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(workspace_id)
    .bind(&req.name)
    .bind(&req.topic)
    .bind(req.is_private.unwrap_or(false))
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e {
            if db_err.constraint() == Some("channels_workspace_id_name_key") {
                return AppError::BadRequest("Channel name already exists in this workspace".to_string());
            }
        }
        AppError::Database(e)
    })?;

    sqlx::query(
        r#"
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1, $2, 'admin')
        "#,
    )
    .bind(channel.id)
    .bind(user_id)
    .execute(db)
    .await?;

    Ok(ChannelResponse {
        id: channel.id,
        workspace_id: channel.workspace_id,
        name: channel.name,
        topic: channel.topic,
        is_private: channel.is_private,
        created_at: channel.created_at,
    })
}

pub async fn get_workspace_channels(
    db: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> AppResult<Vec<ChannelResponse>> {
    let channels = sqlx::query_as::<_, Channel>(
        r#"
        SELECT c.* FROM channels c
        LEFT JOIN channel_members cm ON c.id = cm.channel_id
        WHERE c.workspace_id = $1
          AND (c.is_private = FALSE OR cm.user_id = $2)
        ORDER BY c.name
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(channels
        .into_iter()
        .map(|c| ChannelResponse {
            id: c.id,
            workspace_id: c.workspace_id,
            name: c.name,
            topic: c.topic,
            is_private: c.is_private,
            created_at: c.created_at,
        })
        .collect())
}
