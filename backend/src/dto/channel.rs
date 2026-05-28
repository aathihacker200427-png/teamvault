use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateChannelRequest {
    #[validate(length(min = 2, max = 100))]
    pub name: String,
    #[validate(length(max = 500))]
    pub topic: Option<String>,
    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateChannelRequest {
    #[validate(length(min = 2, max = 100))]
    pub name: Option<String>,
    #[validate(length(max = 500))]
    pub topic: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChannelResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub topic: Option<String>,
    pub is_private: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
