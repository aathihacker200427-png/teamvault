use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use std::sync::OnceLock;

struct RateLimiter {
    requests: AtomicU64,
    window_start: Mutex<Instant>,
    max_requests: u64,
    window_duration: Duration,
}

impl RateLimiter {
    fn new(max_requests: u64, window_seconds: u64) -> Self {
        Self {
            requests: AtomicU64::new(0),
            window_start: Mutex::new(Instant::now()),
            max_requests,
            window_duration: Duration::from_secs(window_seconds),
        }
    }

    async fn check(&self) -> bool {
        let mut start = self.window_start.lock().await;
        let now = Instant::now();

        if now.duration_since(*start) > self.window_duration {
            *start = now;
            self.requests.store(0, Ordering::Relaxed);
        }

        let count = self.requests.fetch_add(1, Ordering::Relaxed);
        count < self.max_requests
    }
}

static GLOBAL_RATE_LIMITER: OnceLock<RateLimiter> = OnceLock::new();

fn get_rate_limiter() -> &'static RateLimiter {
    GLOBAL_RATE_LIMITER.get_or_init(|| RateLimiter::new(1000, 60))
}

pub async fn rate_limit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if !get_rate_limiter().check().await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}
