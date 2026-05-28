use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct InitiateCallRequest {
    pub target_type: String,
    pub target_id: Uuid,
    pub call_type: String,
    pub routing_mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CallResponse {
    pub id: Uuid,
    pub channel_id: Option<Uuid>,
    pub conversation_id: Option<Uuid>,
    pub initiated_by: Uuid,
    pub call_type: String,
    pub routing_mode: String,
    pub status: String,
    pub participants: Vec<CallParticipantResponse>,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct CallParticipantResponse {
    pub user_id: Uuid,
    pub display_name: String,
    pub has_audio: bool,
    pub has_video: bool,
    pub has_screen: bool,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct CallJoinResponse {
    pub call_id: Uuid,
    pub sfu_url: Option<String>,
    pub sfu_token: Option<String>,
    pub room_id: Option<String>,
}
