use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct PaginationCursor {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
}

impl PaginationCursor {
    pub fn encode(&self) -> String {
        use base64::{Engine as _, engine::general_purpose};
        general_purpose::STANDARD.encode(format!("{}|{}", self.id, self.created_at.to_rfc3339()))
    }

    pub fn decode(encoded: &str) -> Result<Self, String> {
        use base64::{Engine as _, engine::general_purpose};
        let decoded = general_purpose::STANDARD.decode(encoded).map_err(|_| "Invalid cursor")?;
        let s = String::from_utf8(decoded).map_err(|_| "Invalid cursor encoding")?;
        let parts: Vec<&str> = s.split('|').collect();

        if parts.len() != 2 {
            return Err("Invalid cursor format".to_string());
        }

        let id = Uuid::parse_str(parts[0]).map_err(|_| "Invalid UUID in cursor")?;
        let created_at = DateTime::parse_from_rfc3339(parts[1])
            .map_err(|_| "Invalid timestamp in cursor")?
            .with_timezone(&Utc);

        Ok(Self { id, created_at })
    }
}

pub fn paginate_query(cursor: Option<&str>, limit: i64) -> (Option<PaginationCursor>, i64) {
    let cursor = cursor.and_then(|c| PaginationCursor::decode(c).ok());
    let limit = limit.min(100).max(1);
    (cursor, limit)
}
