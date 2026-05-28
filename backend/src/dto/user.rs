use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub status: String,
    pub status_message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub status_message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub status: String,
}
