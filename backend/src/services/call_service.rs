use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    dto::{CallJoinResponse, CallResponse, CallParticipantResponse, InitiateCallRequest},
    error::{AppError, AppResult},
    models::{CallSession, User},
};

pub async fn initiate_call(
    db: &PgPool,
    user_id: Uuid,
    req: InitiateCallRequest,
) -> AppResult<CallResponse> {
    let routing_mode = req.routing_mode.unwrap_or_else(|| "p2p".to_string());

    let call = sqlx::query_as::<_, CallSession>(
        r#"
        INSERT INTO call_sessions (channel_id, conversation_id, initiated_by, call_type, routing_mode, status)
        VALUES (
            CASE WHEN $1 = 'channel' THEN $2 ELSE NULL END,
            CASE WHEN $1 = 'dm' THEN $2 ELSE NULL END,
            $3, $4, $5, 'ringing'
        )
        RETURNING *
        "#,
    )
    .bind(&req.target_type)
    .bind(req.target_id)
    .bind(user_id)
    .bind(&req.call_type)
    .bind(&routing_mode)
    .fetch_one(db)
    .await?;

    let is_video = call.call_type == "video";

    sqlx::query(
        r#"
        INSERT INTO call_participants (call_session_id, user_id, has_audio, has_video)
        VALUES ($1, $2, TRUE, $3)
        "#,
    )
    .bind(call.id)
    .bind(user_id)
    .bind(is_video)
    .execute(db)
    .await?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(db)
        .await?;

    Ok(CallResponse {
        id: call.id,
        channel_id: call.channel_id,
        conversation_id: call.conversation_id,
        initiated_by: call.initiated_by,
        call_type: call.call_type,
        routing_mode: call.routing_mode,
        status: call.status,
        participants: vec![CallParticipantResponse {
            user_id: user.id,
            display_name: user.display_name,
            has_audio: true,
            has_video: is_video,
            has_screen: false,
            joined_at: call.started_at,
        }],
        started_at: call.started_at,
    })
}

pub async fn join_call(
    db: &PgPool,
    call_id: Uuid,
    user_id: Uuid,
) -> AppResult<CallJoinResponse> {
    let call = sqlx::query_as::<_, CallSession>("SELECT * FROM call_sessions WHERE id = $1")
        .bind(call_id)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound("Call not found".to_string()))?;

    if call.status == "ended" {
        return Err(AppError::BadRequest("Call has ended".to_string()));
    }

    let is_video = call.call_type == "video";

    sqlx::query(
        r#"
        INSERT INTO call_participants (call_session_id, user_id, has_audio, has_video)
        VALUES ($1, $2, TRUE, $3)
        ON CONFLICT (call_session_id, user_id) DO UPDATE SET left_at = NULL
        "#,
    )
    .bind(call_id)
    .bind(user_id)
    .bind(is_video)
    .execute(db)
    .await?;

    sqlx::query("UPDATE call_sessions SET status = 'active' WHERE id = $1 AND status = 'ringing'")
        .bind(call_id)
        .execute(db)
        .await?;

    Ok(CallJoinResponse {
        call_id,
        sfu_url: if call.routing_mode == "sfu" {
            Some("ws://localhost/sfu".to_string())
        } else {
            None
        },
        sfu_token: None,
        room_id: call.sfu_room_id,
    })
}

pub async fn get_call_details(db: &PgPool, call_id: Uuid) -> AppResult<CallResponse> {
    let call = sqlx::query_as::<_, CallSession>("SELECT * FROM call_sessions WHERE id = $1")
        .bind(call_id)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound("Call not found".to_string()))?;

    let participant_rows = sqlx::query_as::<_, CallParticipantRow>(
        r#"
        SELECT cp.call_session_id, cp.user_id, cp.joined_at, cp.left_at,
               cp.has_audio, cp.has_video, cp.has_screen,
               u.display_name
        FROM call_participants cp
        INNER JOIN users u ON cp.user_id = u.id
        WHERE cp.call_session_id = $1 AND cp.left_at IS NULL
        "#,
    )
    .bind(call_id)
    .fetch_all(db)
    .await?;

    Ok(CallResponse {
        id: call.id,
        channel_id: call.channel_id,
        conversation_id: call.conversation_id,
        initiated_by: call.initiated_by,
        call_type: call.call_type,
        routing_mode: call.routing_mode,
        status: call.status,
        participants: participant_rows
            .into_iter()
            .map(|row| CallParticipantResponse {
                user_id: row.user_id,
                display_name: row.display_name,
                has_audio: row.has_audio,
                has_video: row.has_video,
                has_screen: row.has_screen,
                joined_at: row.joined_at,
            })
            .collect(),
        started_at: call.started_at,
    })
}

#[derive(sqlx::FromRow)]
struct CallParticipantRow {
    #[allow(dead_code)]
    call_session_id: Uuid,
    user_id: Uuid,
    joined_at: chrono::DateTime<chrono::Utc>,
    #[allow(dead_code)]
    left_at: Option<chrono::DateTime<chrono::Utc>>,
    has_audio: bool,
    has_video: bool,
    has_screen: bool,
    display_name: String,
}

pub async fn leave_call(db: &PgPool, call_id: Uuid, user_id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE call_participants SET left_at = NOW() WHERE call_session_id = $1 AND user_id = $2")
        .bind(call_id)
        .bind(user_id)
        .execute(db)
        .await?;

    let remaining = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM call_participants WHERE call_session_id = $1 AND left_at IS NULL",
    )
    .bind(call_id)
    .fetch_one(db)
    .await?;

    if remaining == 0 {
        sqlx::query("UPDATE call_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1")
            .bind(call_id)
            .execute(db)
            .await?;
    }

    Ok(())
}
