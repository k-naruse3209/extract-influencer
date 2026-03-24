.PHONY: dev db db-stop db-test db-test-stop migrate migrate-test seed

# Start dev infrastructure (PostgreSQL + Redis)
dev:
	docker compose up -d
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis:      localhost:6379"

# Start only DB + Cache (alias for clarity)
db:
	docker compose up -d postgres redis

# Stop dev infrastructure
db-stop:
	docker compose down

# Start test infrastructure (separate ports, isolated DB)
db-test:
	docker compose -f docker-compose.test.yml up -d

# Stop test infrastructure
db-test-stop:
	docker compose -f docker-compose.test.yml down

# Run Prisma migrations against the dev DB
migrate:
	cd backend && npx prisma migrate dev

# Run Prisma migrations against the test DB
migrate-test:
	cd backend && DATABASE_URL=postgresql://user:password@localhost:5433/influencer_platform_test npx prisma migrate deploy

# Seed the dev DB with fixture data
seed:
	cd backend && npx prisma db seed
