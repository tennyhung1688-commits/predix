.PHONY: help dev install db-setup docker-up docker-down docker-build clean

help: ## 显示帮助信息
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ==================== 本地开发 ====================

install: ## 安装前后端依赖
	cd backend && npm install
	cd frontend && npm install

db-setup: ## 初始化数据库（生成 Prisma Client + 同步 schema）
	@echo "Generating Prisma Client..."
	cd backend && npx prisma generate
	@echo "Pushing schema to database..."
	cd backend && npx prisma db push --accept-data-loss
	@echo "Database setup complete."

db-reset: ## 重置数据库（⚠️ 删除所有数据）
	cd backend && npx prisma migrate reset --force

db-migrate-dev: ## 创建新迁移（开发环境）
	cd backend && npx prisma migrate dev --name $(name)

db-studio: ## 启动 Prisma Studio（数据库管理界面）
	cd backend && npx prisma studio

dev: ## 启动前后端开发服务器
	cd backend && npm run dev &
	cd frontend && npm run dev

# ==================== Docker ====================

docker-build: ## 构建所有 Docker 镜像
	docker compose build

docker-up: ## 启动所有 Docker 容器（后台运行）
	docker compose up -d

docker-down: ## 停止并移除所有 Docker 容器
	docker compose down

docker-logs: ## 查看所有容器日志
	docker compose logs -f

docker-clean: ## 清理 Docker 镜像和卷
	docker compose down -v --rmi all

# ==================== 清理 ====================

clean: ## 清理 node_modules 和构建产物
	rm -rf backend/node_modules frontend/node_modules
	rm -rf frontend/.next
