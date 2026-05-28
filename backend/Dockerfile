FROM rust:latest AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./

# Cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY . .
RUN touch src/main.rs && cargo build --release

# Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

COPY --from=builder /app/target/release/server /usr/local/bin/server
COPY --from=builder /app/migrations ./migrations

# Render sets PORT env var, app reads it via config
EXPOSE 3000

CMD ["server"]
