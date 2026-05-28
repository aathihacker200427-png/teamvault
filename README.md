# TeamVault

Self-hosted team collaboration platform with chat, voice/video calls, screen sharing, and file attachments.

> **Developed by [Strucureo](https://strucureo.com)**

![Tech Stack](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum-orange) ![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue) ![Tech Stack](https://img.shields.io/badge/Database-PostgreSQL-blue) ![Tech Stack](https://img.shields.io/badge/Deploy-Docker-blue)

## Features

- **💬 Real-time chat** — channels and direct messages with WebSocket-powered live updates
- **📞 Voice & video calls** — peer-to-peer WebRTC with STUN
- **🖥️ Screen sharing** — share your screen during calls
- **📎 File attachments** — images, videos, audio, documents (up to 25 MB)
- **👥 Team workspaces** — organize teams with channels and members
- **🌓 Light & dark themes** — switch instantly in settings
- **🔔 Notifications** — desktop notifications, sound alerts, tab title badge
- **✓✓ Read receipts & typing indicators** — see who's typing in real-time
- **✏️ Edit & delete messages** — manage your conversations
- **📱 Mobile responsive** — works on desktop and mobile browsers
- **🔒 Self-hosted** — full control over your data

## Quick Start (One Command)

### Linux / macOS

```bash
./deploy.sh
```

### Windows

```cmd
deploy.bat
```

That's it. The script will:
1. Generate strong random secrets (JWT, DB password, etc.) into `.env`
2. Build all Docker images
3. Start all services
4. Wait for them to be healthy

Open **http://localhost:8080** in your browser.

## Prerequisites

- Docker 20+ with Compose plugin
- 2 GB RAM minimum (4 GB recommended)
- 5 GB disk space

## Manual Deployment

If you prefer to do it manually:

```bash
# 1. Copy the example env file
cp .env.example .env

# 2. Edit .env with your secrets (use strong random values for JWT_SECRET and POSTGRES_PASSWORD)
nano .env

# 3. Build and start
docker compose up -d --build
```

## Architecture

```
┌────────────────┐         ┌──────────────┐
│    Browser     │ ───────▶│    Nginx     │ Port 8080
└────────────────┘         │  (reverse    │
                           │   proxy)     │
                           └──┬────┬──────┘
                              │    │
              ┌───────────────┘    └─────────┐
              ▼                              ▼
       ┌─────────────┐               ┌─────────────┐
       │  Frontend   │               │   Backend   │
       │  (React)    │               │   (Rust)    │
       └─────────────┘               └──┬──────────┘
                                        │
                                        ▼
                                 ┌─────────────┐
                                 │  Postgres   │
                                 └─────────────┘
```

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| `nginx` | Nginx | 8080 | Reverse proxy, static files |
| `frontend` | React + Vite | (internal) | UI |
| `backend` | Rust + Axum | (internal) | API + WebSocket |
| `postgres` | PostgreSQL 16 | (internal) | Database |
| `sfu` | Go | 50000-50200 udp | WebRTC SFU (group calls) |
| `coturn` | coturn | 3478 | TURN/STUN server |

## Configuration

All config is in `.env`. Key variables:

```bash
# Database
POSTGRES_PASSWORD=<strong random password>

# Backend
JWT_SECRET=<at least 64 random chars>
JWT_EXPIRATION_HOURS=24
CORS_ORIGIN=http://localhost

# Production: change to your domain
# CORS_ORIGIN=https://chat.yourdomain.com
```

## Production Deployment

### With your own domain (HTTPS)

1. **Point your domain** to your server's IP (A record)
2. **Set CORS_ORIGIN** in `.env`:
   ```bash
   CORS_ORIGIN=https://chat.yourdomain.com
   ```
3. **Add TLS** by editing `nginx/conf.d/default.conf` to listen on 443 and reference your certs
4. Or put **Caddy / Cloudflare** in front of port 8080 for automatic HTTPS

### Deploy on Heroku (backend) + Vercel (frontend)

Split deployment: Rust backend on Heroku, React frontend on Vercel.

See **[DEPLOY-HEROKU-VERCEL.md](./DEPLOY-HEROKU-VERCEL.md)** for full instructions.

> ⚠️ Heroku has no persistent disk — file uploads will be lost on restart. Use Render for the backend if you need persistent uploads.

### Deploy on Render.com (no server required)

TeamVault includes a `render.yaml` Blueprint for one-click deployment to [Render](https://render.com).

**Steps:**

1. **Push this repo to GitHub/GitLab/Bitbucket**
2. In Render dashboard, click **New → Blueprint** and select your repo
3. Render reads `render.yaml` and creates:
   - **Postgres database** (managed, with daily backups on paid plans)
   - **Backend Web Service** (Rust + Axum, auto-deployed from Dockerfile)
   - **SFU Private Service** (Go, internal-only)
   - **Frontend Static Site** (React, free CDN-hosted, instant TLS)
4. Wait for the first build (~5-10 minutes for the Rust backend)
5. **Set the missing environment variables** in the Render dashboard:
   - On `teamvault-frontend`:
     - `VITE_API_URL` = `https://<backend-url>/api/v1`
     - `VITE_WS_URL` = `wss://<backend-url>/api/v1/ws`
   - On `teamvault-backend`:
     - `CORS_ORIGIN` = `https://<frontend-url>`
6. Trigger a **Manual Deploy → Clear cache & deploy** on the frontend (so the new env vars are baked into the build)

You'll get a publicly accessible URL like `https://teamvault-frontend-abcd.onrender.com` with auto-HTTPS, zero-downtime deploys, and auto-deploy on git push.

**Render plan recommendations:**
- **Free**: Backend sleeps after 15 min idle, Postgres free tier expires in 90 days. Good for testing only.
- **Starter ($7-19/mo per service)**: Always-on, no sleep. Recommended for production.
- **Standard / Pro**: For higher traffic & dedicated CPU.

**Render auto-handles:** TLS, custom domains, zero-downtime deploys, scaling, monitoring.

### Updating

```bash
git pull
./deploy.sh   # or deploy.bat on Windows
```

The deploy script reuses your existing `.env`, rebuilds images, and restarts services with zero data loss.

### Backups

```bash
# Backup database
docker compose exec postgres pg_dump -U teamvault teamvault > backup.sql

# Backup uploaded files
docker run --rm -v internal_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads.tar.gz -C /data .
```

### Restore

```bash
# Restore database
cat backup.sql | docker compose exec -T postgres psql -U teamvault teamvault

# Restore uploads
docker run --rm -v internal_uploads:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar xzf /backup/uploads.tar.gz"
```

## Common Commands

| Action | Command |
|--------|---------|
| Status | `docker compose ps` |
| Logs (all) | `docker compose logs -f` |
| Logs (backend) | `docker compose logs -f backend` |
| Stop | `docker compose down` |
| Stop and wipe data | `docker compose down -v` |
| Restart | `docker compose restart` |
| Rebuild | `docker compose up -d --build` |
| Health check | `curl http://localhost:8080/health` |

## Troubleshooting

**Port 8080 already in use?**
Edit `docker-compose.yml` and change `"8080:80"` to `"9000:80"` (or any free port).

**502 Bad Gateway after rebuild?**
```bash
docker compose restart nginx
```

**Backend won't start / DB connection error?**
```bash
docker compose logs backend
docker compose logs postgres
```

**Calls don't connect across networks?**
The included STUN servers work for most cases. For strict NAT/corporate networks, configure `coturn/turnserver.conf` with public IP.

## Tech Stack

- **Backend**: Rust + Axum + SQLx + Tokio
- **Frontend**: React 18 + TypeScript + Vite + TanStack Query + Zustand
- **Styling**: Tailwind CSS with CSS variables for theming
- **Database**: PostgreSQL 16
- **Real-time**: WebSocket
- **Calls**: WebRTC peer-to-peer, Pion SFU for group calls
- **Storage**: Docker volumes (uploaded files)
- **Container**: Docker + Docker Compose

## License

MIT

---

**TeamVault** is developed by **[Strucureo](https://strucureo.com)** — building tools that put you in control of your team's data.
