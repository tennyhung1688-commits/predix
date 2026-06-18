#!/bin/bash
# Let's Encrypt SSL 证书初始化脚本
# 使用方法: ./nginx/init-letsencrypt.sh 你的域名.com

set -e

DOMAIN=${1:?请提供域名，例如: ./nginx/init-letsencrypt.sh example.com}
EMAIL=${2:-"admin@${DOMAIN}"}

echo "=== 为 ${DOMAIN} 申请 Let's Encrypt 证书 ==="

# 1. 先启动仅 HTTP 的 Nginx（用于证书验证）
echo "[1/4] 创建临时 Nginx 配置..."
cat > ./nginx/nginx-http.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
EOF

echo "[2/4] 启动 Nginx（仅 HTTP）..."
docker compose -f docker-compose.prod.yml run --rm -d \
    --name certbot-nginx \
    -v ./nginx/nginx-http.conf:/etc/nginx/conf.d/default.conf \
    nginx

# 3. 申请证书
echo "[3/4] 申请 SSL 证书..."
docker compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot \
    -w /var/www/certbot \
    -d ${DOMAIN} \
    -d www.${DOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email

# 4. 停止临时 Nginx
echo "[4/4] 清理..."
docker stop certbot-nginx 2>/dev/null || true
docker rm certbot-nginx 2>/dev/null || true
rm ./nginx/nginx-http.conf

echo ""
echo "✅ SSL 证书申请成功！"
echo "现在请把 nginx/nginx.conf 中的「你的域名.com」替换为「${DOMAIN}」"
echo "然后运行: docker compose -f docker-compose.prod.yml up -d"
