use crate::config::Config;
use dashmap::DashMap;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use uuid::Uuid;

pub type SharedState = Arc<AppState>;

pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub ws_manager: Arc<WebSocketManager>,
    pub presence: Arc<PresenceManager>,
    pub call_registry: Arc<CallRegistry>,
}

pub struct WebSocketManager {
    pub connections: DashMap<Uuid, Vec<ConnectionHandle>>,
    pub system_tx: broadcast::Sender<SystemEvent>,
}

pub struct ConnectionHandle {
    pub conn_id: Uuid,
    pub sender: mpsc::UnboundedSender<WsOutbound>,
}

pub type WsOutbound = String;

#[derive(Debug, Clone)]
pub enum SystemEvent {
    UserConnected { user_id: Uuid },
    UserDisconnected { user_id: Uuid },
}

pub struct PresenceManager {
    pub states: DashMap<Uuid, PresenceState>,
}

#[derive(Debug, Clone)]
pub struct PresenceState {
    pub status: UserStatus,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub connection_count: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserStatus {
    Online,
    Away,
    DoNotDisturb,
    Offline,
}

pub struct CallRegistry {
    pub active_calls: DashMap<Uuid, CallState>,
}

pub struct CallState {
    pub session_id: Uuid,
    pub routing: RoutingMode,
    pub participants: RwLock<Vec<CallParticipant>>,
    pub sfu_room_id: Option<String>,
}

#[derive(Debug, Clone)]
pub enum RoutingMode {
    P2P,
    SFU,
}

#[derive(Debug, Clone)]
pub struct CallParticipant {
    pub user_id: Uuid,
    pub display_name: String,
    pub has_audio: bool,
    pub has_video: bool,
    pub has_screen: bool,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> Self {
        let (system_tx, _) = broadcast::channel(1000);

        Self {
            db,
            config,
            ws_manager: Arc::new(WebSocketManager {
                connections: DashMap::new(),
                system_tx,
            }),
            presence: Arc::new(PresenceManager {
                states: DashMap::new(),
            }),
            call_registry: Arc::new(CallRegistry {
                active_calls: DashMap::new(),
            }),
        }
    }

    /// Send a message to all connections of a specific user.
    pub fn send_to_user(&self, user_id: Uuid, payload: &serde_json::Value) {
        let msg = payload.to_string();
        if let Some(conns) = self.ws_manager.connections.get(&user_id) {
            for conn in conns.iter() {
                let _ = conn.sender.send(msg.clone());
            }
        }
    }

    /// Send to multiple users.
    pub fn send_to_users(&self, user_ids: &[Uuid], payload: &serde_json::Value) {
        for uid in user_ids {
            self.send_to_user(*uid, payload);
        }
    }
}
