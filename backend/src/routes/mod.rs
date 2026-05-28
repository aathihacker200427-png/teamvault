pub mod auth;
pub mod users;
pub mod workspaces;
pub mod channels;
pub mod messages;
pub mod direct_messages;
pub mod calls;
pub mod ws;
pub mod files;

use axum::{
    extract::State,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Router,
};

use crate::state::SharedState;

pub fn create_router(state: SharedState) -> Router {
    let auth_routes = Router::new()
        .route("/register", post(auth::register))
        .route("/login", post(auth::login))
        .route("/refresh", post(auth::refresh_token))
        .route("/logout", post(auth::logout));

    let users_routes = Router::new()
        .route("/me", get(users::get_me).patch(users::update_me))
        .route("/search", get(users::search_users))
        .route("/:user_id", get(users::get_user));

    let workspace_routes = Router::new()
        .route("/", post(workspaces::create).get(workspaces::list))
        .route("/:ws_id", get(workspaces::get))
        .route("/:ws_id/members", post(workspaces::add_member).get(workspaces::list_members))
        .route("/:ws_id/channels", post(channels::create).get(channels::list));

    let channel_routes = Router::new()
        .route("/channels/:ch_id", get(channels::get).patch(channels::update).delete(channels::delete))
        .route(
            "/channels/:ch_id/messages",
            get(messages::list_channel_messages).post(messages::send_channel_message),
        )
        .route(
            "/messages/:msg_id",
            axum::routing::patch(messages::edit_message).delete(messages::delete_message),
        );

    let dm_routes = Router::new()
        .route("/", post(direct_messages::create_or_get).get(direct_messages::list))
        .route(
            "/:conv_id/messages",
            get(messages::list_dm_messages).post(messages::send_dm_message),
        );

    let call_routes = Router::new()
        .route("/", post(calls::initiate))
        .route("/:call_id", get(calls::get_call))
        .route("/:call_id/join", post(calls::join))
        .route("/:call_id/leave", post(calls::leave));

    // Protected routes - require auth
    let protected = Router::new()
        .nest("/users", users_routes)
        .nest("/workspaces", workspace_routes)
        .merge(channel_routes)
        .nest("/dm", dm_routes)
        .nest("/calls", call_routes)
        .route("/upload", post(files::upload).layer(axum::extract::DefaultBodyLimit::max(30 * 1024 * 1024)))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::auth_middleware,
        ));

    // Public + protected under /api/v1
    let api_v1 = Router::new()
        .nest("/auth", auth_routes)
        .route("/ws", get(ws::ws_handler))
        .route("/files/:name", get(files::serve_file))
        .merge(protected);

    Router::new()
        .route("/health", get(health))
        .nest("/api/v1", api_v1)
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .layer(tower_http::compression::CompressionLayer::new())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state)
}

async fn health(State(state): State<SharedState>) -> axum::response::Response {
    let db_ok = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();
    let status = if db_ok { axum::http::StatusCode::OK } else { axum::http::StatusCode::SERVICE_UNAVAILABLE };
    let body = axum::Json(serde_json::json!({ "status": if db_ok { "healthy" } else { "unhealthy" }, "db": db_ok }));
    (status, body).into_response()
}
