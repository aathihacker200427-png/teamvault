use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    dto::{
        AttachmentInput, AttachmentResponse, DmConversationResponse, DmParticipantResponse,
        MessageResponse, PaginationParams, ReplyToResponse, SendMessageRequest, UserResponse,
    },
    error::{AppError, AppResult},
    models::{DmConversation, Message, User},
};

async fn save_attachments(db: &PgPool, message_id: Uuid, attachments: &[AttachmentInput]) -> AppResult<Vec<AttachmentResponse>> {
    let mut results = Vec::new();
    for att in attachments {
        let id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO message_attachments (message_id, filename, content_type, size_bytes, storage_path)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(message_id)
        .bind(&att.filename)
        .bind(&att.content_type)
        .bind(att.size)
        .bind(&att.url)
        .fetch_one(db)
        .await?;

        results.push(AttachmentResponse {
            id,
            url: att.url.clone(),
            filename: att.filename.clone(),
            content_type: att.content_type.clone(),
            size: att.size,
        });
    }
    Ok(results)
}

async fn fetch_attachments(db: &PgPool, message_id: Uuid) -> Vec<AttachmentResponse> {
    sqlx::query_as::<_, (Uuid, String, String, String, i64)>(
        "SELECT id, storage_path, filename, content_type, size_bytes FROM message_attachments WHERE message_id = $1"
    )
    .bind(message_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(id, url, filename, content_type, size)| AttachmentResponse { id, url, filename, content_type, size })
    .collect()
}

pub async fn send_channel_message(
    db: &PgPool,
    channel_id: Uuid,
    sender_id: Uuid,
    req: SendMessageRequest,
) -> AppResult<MessageResponse> {
    let message = sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (channel_id, sender_id, content, reply_to_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(channel_id)
    .bind(sender_id)
    .bind(&req.content)
    .bind(req.reply_to)
    .fetch_one(db)
    .await?;

    let attachments = if let Some(atts) = &req.attachments {
        save_attachments(db, message.id, atts).await?
    } else {
        vec![]
    };

    let sender = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(sender_id)
        .fetch_one(db)
        .await?;

    let reply_to = if let Some(reply_id) = message.reply_to_id {
        let reply_msg = sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
            .bind(reply_id).fetch_optional(db).await?;
        if let Some(msg) = reply_msg {
            let reply_sender = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(msg.sender_id).fetch_one(db).await?;
            Some(ReplyToResponse { id: msg.id, sender_name: reply_sender.display_name, content: msg.content })
        } else { None }
    } else { None };

    Ok(MessageResponse {
        id: message.id,
        channel_id: message.channel_id,
        conversation_id: message.conversation_id,
        sender: UserResponse {
            id: sender.id, email: sender.email, display_name: sender.display_name,
            avatar_url: sender.avatar_url, status: sender.status, status_message: sender.status_message,
        },
        content: message.content,
        reply_to,
        attachments,
        edited_at: message.edited_at,
        created_at: message.created_at,
    })
}

pub async fn get_channel_messages(
    db: &PgPool,
    channel_id: Uuid,
    params: PaginationParams,
) -> AppResult<Vec<MessageResponse>> {
    let limit = params.limit.unwrap_or(50).min(100);

    let messages = if let Some(cursor) = params.cursor {
        let cursor_time = chrono::DateTime::parse_from_rfc3339(&cursor)
            .map_err(|_| AppError::BadRequest("Invalid cursor".to_string()))?
            .with_timezone(&chrono::Utc);
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = $1 AND deleted_at IS NULL AND created_at < $2 ORDER BY created_at DESC LIMIT $3",
        ).bind(channel_id).bind(cursor_time).bind(limit).fetch_all(db).await?
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2",
        ).bind(channel_id).bind(limit).fetch_all(db).await?
    };

    let mut responses = Vec::new();
    for msg in messages {
        let sender = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(msg.sender_id).fetch_one(db).await?;
        let attachments = fetch_attachments(db, msg.id).await;
        responses.push(MessageResponse {
            id: msg.id, channel_id: msg.channel_id, conversation_id: msg.conversation_id,
            sender: UserResponse {
                id: sender.id, email: sender.email, display_name: sender.display_name,
                avatar_url: sender.avatar_url, status: sender.status, status_message: sender.status_message,
            },
            content: msg.content, reply_to: None, attachments,
            edited_at: msg.edited_at, created_at: msg.created_at,
        });
    }
    Ok(responses)
}

pub async fn create_or_get_dm(
    db: &PgPool,
    user_id: Uuid,
    target_user_id: Uuid,
) -> AppResult<Uuid> {
    let existing = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT c.id FROM dm_conversations c
        INNER JOIN dm_participants p1 ON c.id = p1.conversation_id AND p1.user_id = $1
        INNER JOIN dm_participants p2 ON c.id = p2.conversation_id AND p2.user_id = $2
        WHERE c.is_group = FALSE
        LIMIT 1
        "#,
    ).bind(user_id).bind(target_user_id).fetch_optional(db).await?;

    if let Some(conv_id) = existing { return Ok(conv_id); }

    let conv_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO dm_conversations (is_group) VALUES (FALSE) RETURNING id",
    ).fetch_one(db).await?;

    sqlx::query("INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)")
        .bind(conv_id).bind(user_id).bind(target_user_id).execute(db).await?;

    Ok(conv_id)
}

pub async fn get_user_dm_conversations(
    db: &PgPool,
    user_id: Uuid,
) -> AppResult<Vec<DmConversationResponse>> {
    let conversations = sqlx::query_as::<_, DmConversation>(
        r#"
        SELECT c.* FROM dm_conversations c
        INNER JOIN dm_participants p ON c.id = p.conversation_id
        WHERE p.user_id = $1
        ORDER BY c.created_at DESC
        "#,
    ).bind(user_id).fetch_all(db).await?;

    let mut responses = Vec::new();
    for conv in conversations {
        let participants = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
            r#"
            SELECT u.id, u.display_name, u.avatar_url
            FROM users u
            INNER JOIN dm_participants p ON u.id = p.user_id
            WHERE p.conversation_id = $1
            "#,
        ).bind(conv.id).fetch_all(db).await?;

        responses.push(DmConversationResponse {
            id: conv.id, is_group: conv.is_group,
            participants: participants.into_iter().map(|(id, name, avatar)| DmParticipantResponse {
                user_id: id, display_name: name, avatar_url: avatar,
            }).collect(),
            last_message: None, created_at: conv.created_at,
        });
    }
    Ok(responses)
}

pub async fn send_dm_message(
    db: &PgPool,
    conversation_id: Uuid,
    sender_id: Uuid,
    req: SendMessageRequest,
) -> AppResult<MessageResponse> {
    let message = sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (conversation_id, sender_id, content, reply_to_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    ).bind(conversation_id).bind(sender_id).bind(&req.content).bind(req.reply_to)
    .fetch_one(db).await?;

    let attachments = if let Some(atts) = &req.attachments {
        save_attachments(db, message.id, atts).await?
    } else {
        vec![]
    };

    let sender = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(sender_id).fetch_one(db).await?;

    Ok(MessageResponse {
        id: message.id, channel_id: message.channel_id, conversation_id: message.conversation_id,
        sender: UserResponse {
            id: sender.id, email: sender.email, display_name: sender.display_name,
            avatar_url: sender.avatar_url, status: sender.status, status_message: sender.status_message,
        },
        content: message.content, reply_to: None, attachments,
        edited_at: message.edited_at, created_at: message.created_at,
    })
}

pub async fn get_dm_messages(
    db: &PgPool,
    conversation_id: Uuid,
    params: PaginationParams,
) -> AppResult<Vec<MessageResponse>> {
    let limit = params.limit.unwrap_or(50).min(100);

    let messages = if let Some(cursor) = params.cursor {
        let cursor_time = chrono::DateTime::parse_from_rfc3339(&cursor)
            .map_err(|_| AppError::BadRequest("Invalid cursor".to_string()))?
            .with_timezone(&chrono::Utc);
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL AND created_at < $2 ORDER BY created_at DESC LIMIT $3",
        ).bind(conversation_id).bind(cursor_time).bind(limit).fetch_all(db).await?
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2",
        ).bind(conversation_id).bind(limit).fetch_all(db).await?
    };

    let mut responses = Vec::new();
    for msg in messages {
        let sender = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(msg.sender_id).fetch_one(db).await?;
        let attachments = fetch_attachments(db, msg.id).await;
        responses.push(MessageResponse {
            id: msg.id, channel_id: msg.channel_id, conversation_id: msg.conversation_id,
            sender: UserResponse {
                id: sender.id, email: sender.email, display_name: sender.display_name,
                avatar_url: sender.avatar_url, status: sender.status, status_message: sender.status_message,
            },
            content: msg.content, reply_to: None, attachments,
            edited_at: msg.edited_at, created_at: msg.created_at,
        });
    }
    Ok(responses)
}
