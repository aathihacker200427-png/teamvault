#!/bin/bash

set -e

echo "Starting TeamVault development environment..."

echo "Starting PostgreSQL..."
docker compose up -d postgres

echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "Starting backend..."
docker compose up -d backend

echo "Starting SFU..."
docker compose up -d sfu

echo "Starting coturn..."
docker compose up -d coturn

echo "Starting frontend..."
docker compose up -d frontend

echo "Starting nginx..."
docker compose up -d nginx

echo ""
echo "TeamVault is running!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:3000"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
