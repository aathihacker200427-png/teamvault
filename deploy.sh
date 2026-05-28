#!/bin/bash
# TeamVault Production Deploy Script
# Developed by Strucureo - https://strucureo.com

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  TeamVault - by Strucureo${NC}"
echo -e "${BLUE}  Production Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed. Install Docker first.${NC}"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose plugin not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is ready${NC}"

# Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}! .env not found, generating...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
    fi

    # Generate strong secrets
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+\n' | head -c 64)
    PG_PASS=$(openssl rand -base64 32 | tr -d '/+\n' | head -c 32)
    SFU_SECRET=$(openssl rand -base64 24 | tr -d '/+\n' | head -c 24)

    cat > .env <<EOF
# Database
POSTGRES_USER=teamvault
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=teamvault

# Backend
DATABASE_URL=postgresql://teamvault:${PG_PASS}@postgres:5432/teamvault
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION_HOURS=24
CORS_ORIGIN=http://localhost
RUST_LOG=info

# SFU
SFU_URL=http://sfu:8080
SFU_SECRET=${SFU_SECRET}

# Frontend
VITE_API_URL=/api/v1

# TURN Server
TURN_REALM=teamvault.local
TURN_USER=turnuser
TURN_PASSWORD=${SFU_SECRET}
EOF
    echo -e "${GREEN}✓ Generated .env with strong secrets${NC}"
else
    echo -e "${GREEN}✓ Using existing .env${NC}"
fi

# Build images
echo ""
echo -e "${BLUE}Building images...${NC}"
docker compose build

# Start services
echo ""
echo -e "${BLUE}Starting services...${NC}"
docker compose up -d --remove-orphans

# Wait for healthy
echo ""
echo -e "${BLUE}Waiting for services to be healthy...${NC}"
ATTEMPTS=0
MAX_ATTEMPTS=30
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ All services are running${NC}"
        break
    fi
    sleep 2
    ATTEMPTS=$((ATTEMPTS + 1))
    echo -n "."
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ Services failed to become healthy${NC}"
    docker compose logs --tail=30
    exit 1
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✓ TeamVault is running!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "  Open: ${BLUE}http://localhost:8080${NC}"
echo ""
echo -e "  Manage:"
echo -e "    Status: ${YELLOW}docker compose ps${NC}"
echo -e "    Logs:   ${YELLOW}docker compose logs -f${NC}"
echo -e "    Stop:   ${YELLOW}docker compose down${NC}"
echo -e "    Update: ${YELLOW}./deploy.sh${NC}"
echo ""
echo -e "  ${BLUE}TeamVault by Strucureo - https://strucureo.com${NC}"
echo ""
