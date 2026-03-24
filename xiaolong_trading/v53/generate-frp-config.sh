#!/bin/bash
# frp 配置生成器

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 frp 配置生成器                              ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 生成随机 token
generate_token() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# 生成随机密码
generate_password() {
    openssl rand -base64 16 | tr -d "=+/" | cut -c1-16
}

print_banner

echo "📝 请输入服务器信息:"
echo ""

# 获取服务器 IP
read -p "服务器 IP 或域名: " SERVER_IP
if [ -z "$SERVER_IP" ]; then
    echo "❌ 服务器 IP 不能为空"
    exit 1
fi

# 获取域名（可选）
read -p "域名 (可选，直接回车跳过): " DOMAIN

# 生成随机 token
TOKEN=$(generate_token)
DASHBOARD_PWD=$(generate_password)

echo ""
echo -e "${GREEN}✅ 生成配置...${NC}"
echo ""

# 生成客户端配置
cat > "$SCRIPT_DIR/frpc.ini" << EOF
# frp 客户端配置 - 小龙 Control Tower v3
# 生成时间: $(date)

[common]
server_addr = $SERVER_IP
server_port = 7000
token = $TOKEN

log_file = ./logs/frpc.log
log_level = info
log_max_days = 3

tcp_mux = true
pool_count = 5

# Control Tower HTTP 隧道
[control-tower-http]
type = http
local_port = 8767
EOF

if [ -n "$DOMAIN" ]; then
    echo "custom_domains = $DOMAIN" >> "$SCRIPT_DIR/frpc.ini"
fi

# 生成服务器端配置
cat > "$SCRIPT_DIR/frps.ini" << EOF
# frp 服务器端配置 - 小龙 Control Tower v3
# 生成时间: $(date)
# 服务器: $SERVER_IP

[common]
bind_port = 7000
token = $TOKEN

# 仪表盘
dashboard_port = 7500
dashboard_user = admin
dashboard_pwd = $DASHBOARD_PWD

log_file = ./frps.log
log_level = info
log_max_days = 30

heartbeat_timeout = 90
max_pool_count = 50
tcp_mux = true
EOF

echo -e "${GREEN}✅ 配置生成完成!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 生成的文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "客户端: $SCRIPT_DIR/frpc.ini"
echo "服务端: $SCRIPT_DIR/frps.ini"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 安全凭证（请保存）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Token: $TOKEN"
echo "Dashboard 密码: $DASHBOARD_PWD"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 部署步骤"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 服务器端部署:"
echo "   scp frps.ini root@$SERVER_IP:/opt/frp/"
echo "   ssh root@$SERVER_IP"
echo "   cd /opt/frp && ./frps -c frps.ini"
echo ""
echo "2. 客户端启动:"
echo "   ./start-frp.sh"
echo ""
if [ -n "$DOMAIN" ]; then
    echo "3. 访问地址:"
    echo "   http://$DOMAIN"
else
    echo "3. 访问地址:"
    echo "   http://$SERVER_IP:8080 (需要服务器配置 http 端口)"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
