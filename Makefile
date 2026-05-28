.PHONY: up down build logs clean ps prod restart db-shell migrate health

# Development
up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

clean:
	docker compose down -v --rmi local

restart:
	docker compose down && docker compose up -d --build

# Production
prod:
	docker compose up -d --build --remove-orphans

prod-logs:
	docker compose logs -f --tail=100

# Database
db-shell:
	docker compose exec postgres psql -U teamvault -d teamvault

migrate:
	docker compose exec backend /usr/local/bin/server migrate

# Health
health:
	curl -s http://localhost/health | python -m json.tool 2>/dev/null || curl -s http://localhost/health
