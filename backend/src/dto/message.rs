use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct SendMessageRequest {
    #[validate(length(min = 0, max = 4000))]
    pub content: String,
    pub reply_to: Option<Uuid>,
    pub attachments: Option<Vec<AttachmentInput>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AttachmentInput {
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMessageRequest {
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AttachmentResponse {
    pub id: Uuid,
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub channel_id: Option<Uuid>,
    pub conversation_id: Option<Uuid>,
    pub sender: super::user::UserResponse,
    pub content: String,
    pub reply_to: Option<ReplyToResponse>,
    pub attachments: Vec<AttachmentResponse>,
    pub edited_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ReplyToResponse {
    pub id: Uuid,
    pub sender_name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDmRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupDmRequest {
    pub user_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct DmConversationResponse {
    pub id: Uuid,
    pub is_group: bool,
    pub participants: Vec<DmParticipantResponse>,
    pub last_message: Option<MessageResponse>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct DmParticipantResponse {
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PaginationParams {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}
