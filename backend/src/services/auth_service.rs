use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    config::Config,
    dto::{AuthResponse, LoginRequest, RegisterRequest, UserResponse},
    error::{AppError, AppResult},
    middleware::Claims,
    models::User,
    util::hash::{hash_password, verify_password},
};

pub async fn register(db: &PgPool, req: RegisterRequest) -> AppResult<AuthResponse> {
    let password_hash = hash_password(&req.password)
        .map_err(|e| AppError::Internal(e))?;

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.display_name)
    .fetch_one(db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e {
            if db_err.constraint() == Some("users_email_key") {
                return AppError::BadRequest("Email already registered".to_string());
            }
        }
        AppError::Database(e)
    })?;

    let (access_token, refresh_token) = generate_tokens(db, &user, &Config::from_env().unwrap()).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        token_type: "bearer".to_string(),
        expires_in: 3600 * 24,
        user: UserResponse {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            status: user.status,
            status_message: user.status_message,
        },
    })
}

pub async fn login(db: &PgPool, req: LoginRequest, config: &Config) -> AppResult<AuthResponse> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1",
    )
    .bind(&req.email)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::Auth("Invalid credentials".to_string()))?;

    let valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| AppError::Internal(e))?;

    if !valid {
        return Err(AppError::Auth("Invalid credentials".to_string()));
    }

    sqlx::query("UPDATE users SET status = 'online', last_seen_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(db)
        .await?;

    let (access_token, refresh_token) = generate_tokens(db, &user, config).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        token_type: "bearer".to_string(),
        expires_in: 3600 * 24,
        user: UserResponse {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            status: "online".to_string(),
            status_message: user.status_message,
        },
    })
}

async fn generate_tokens(db: &PgPool, user: &User, config: &Config) -> AppResult<(String, String)> {
    let now = Utc::now();
    let expiration = now + Duration::hours(config.jwt_expiration_hours as i64);

    let claims = Claims {
        sub: user.id.to_string(),
        exp: expiration.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let access_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate token: {}", e)))?;

    let refresh_token = Uuid::new_v4().to_string();
    let token_hash = crate::util::hash::hash_password(&refresh_token)
        .map_err(|e| AppError::Internal(e))?;

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(user.id)
    .bind(&token_hash)
    .bind(expiration)
    .execute(db)
    .await?;

    Ok((access_token, refresh_token))
}
