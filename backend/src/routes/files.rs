use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{error::{AppError, AppResult}, state::SharedState};

const UPLOAD_DIR: &str = "/app/uploads";
const MAX_FILE_SIZE: usize = 25 * 1024 * 1024; // 25 MB

#[derive(Serialize)]
pub struct UploadedFile {
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

pub async fn upload(
    State(_state): State<SharedState>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<UploadedFile>>> {
    tokio::fs::create_dir_all(UPLOAD_DIR).await.ok();

    let mut results = Vec::new();
    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {}", e)))? {

        let original_name = field.file_name().unwrap_or("file").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();

        let bytes = field.bytes().await
            .map_err(|e| AppError::BadRequest(format!("Read error: {}", e)))?;

        if bytes.len() > MAX_FILE_SIZE {
            return Err(AppError::BadRequest(format!("File too large (max {} MB)", MAX_FILE_SIZE / 1024 / 1024)));
        }

        let ext = original_name.rsplit('.').next().unwrap_or("bin");
        let safe_ext: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).take(10).collect();
        let stored_name = if safe_ext.is_empty() {
            format!("{}", Uuid::new_v4())
        } else {
            format!("{}.{}", Uuid::new_v4(), safe_ext)
        };

        let path = format!("{}/{}", UPLOAD_DIR, stored_name);
        tokio::fs::write(&path, &bytes).await
            .map_err(|e| AppError::Internal(format!("Write error: {}", e)))?;

        results.push(UploadedFile {
            url: format!("/api/v1/files/{}", stored_name),
            filename: original_name,
            content_type,
            size: bytes.len() as u64,
        });
    }

    Ok(Json(results))
}

pub async fn serve_file(Path(name): Path<String>) -> Result<Response<Body>, StatusCode> {
    // Prevent path traversal
    if name.contains('/') || name.contains('\\') || name.starts_with('.') {
        return Err(StatusCode::BAD_REQUEST);
    }

    let path = format!("{}/{}", UPLOAD_DIR, name);
    let bytes = tokio::fs::read(&path).await.map_err(|_| StatusCode::NOT_FOUND)?;

    let ct = match name.rsplit('.').next().unwrap_or("").to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "pdf" => "application/pdf",
        "txt" => "text/plain; charset=utf-8",
        "json" => "application/json",
        _ => "application/octet-stream",
    };

    Response::builder()
        .header(header::CONTENT_TYPE, ct)
        .header(header::CACHE_CONTROL, "max-age=86400")
        .body(Body::from(bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
