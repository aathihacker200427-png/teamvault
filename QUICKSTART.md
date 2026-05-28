# TeamVault Quick Start

## Prerequisites
- Docker Desktop
- Git

## Start Development Environment

```bash
# 1. Copy environment file
copy .env.example .env

# 2. Start all services
docker compose up --build

# Or use the dev script (Linux/Mac)
# ./scripts/dev.sh
```

## Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **WebSocket**: ws://localhost/api/v1/ws

## Create Test Users

```bash
# Register first user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","display_name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Development Commands

```bash
# View logs
docker compose logs -f backend

# Restart backend only
docker compose restart backend

# Stop all services
docker compose down

# Clean rebuild
docker compose down -v
docker compose up --build
```

## Database Access

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U teamvault

# Run migrations manually
docker compose exec backend sqlx migrate run
```

## Troubleshooting

**Backend won't start:**
```bash
docker compose logs backend
docker compose restart postgres
```

**Port conflicts:**
```bash
# Stop existing containers
docker compose down

# Check what's using ports
netstat -ano | findstr :3000
netstat -ano | findstr :80
```

**Frontend can't connect:**
- Check browser console for CORS errors
- Verify nginx is running: `docker compose ps`
- Check nginx logs: `docker compose logs nginx`
