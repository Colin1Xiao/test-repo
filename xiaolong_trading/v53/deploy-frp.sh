#!/bin/bash
# frp 一键部署脚本
# 用法: ./deploy-frp.sh <服务器IP> [域名]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_IP="${1:-}"
DOMAIN="${2:-}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}❌ 请提供服务器 IP${NC}"
    echo ""
    echo "用法:"
    echo "  ./deploy-frp.sh 1.2.3.4"
    echo "  ./deploy-frp.sh 1.2.3.4 control.example.com"
    exit 1
fi

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 frp 一键部署                                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_banner

echo "📝 部署信息:"
echo "   服务器: $SERVER_IP"
[ -n "$DOMAIN" ] && echo "   域名: $DOMAIN"
echo ""

# 检查 SSH 连接
echo -e "${YELLOW}🔍 检查 SSH 连接...${NC}"
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@$SERVER_IP "echo 'OK'" 2>/dev/null; then
    echo -e "${RED}❌ 无法连接到服务器 $SERVER_IP${NC}"
    echo ""
    echo "请确保:"
    echo "  1. 服务器 IP 正确"
    echo "  2. SSH 密钥已配置"
    echo "  3. 服务器在线"
    exit 1
fi
echo -e "${GREEN}✅ SSH 连接正常${NC}"
echo ""

# 生成配置
echo -e "${YELLOW}🔧 生成配置...${NC}"
"$SCRIPT_DIR/generate-frp-config.sh" << EOF
$SERVER_IP
$DOMAIN
EOF

# 读取生成的 token
TOKEN=$(grep "^token = " "$SCRIPT_DIR/frpc.ini" | cut -d' ' -f3)
DASHBOARD_PWD=$(grep "^dashboard_pwd = " "$SCRIPT_DIR/frps.ini" | cut -d' ' -f3)

echo -e "${GREEN}✅ 配置生成完成${NC}"
echo ""

# 部署到服务器
echo -e "${YELLOW}🚀 部署到服务器...${NC}"

ssh root@$SERVER_IP "
    # 安装 frp
    if [ ! -f /opt/frp/frps ]; then
        echo '下载 frp...'
        cd /opt
        wget -q https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz
        tar -xzf frp_0.52.3_linux_amd64.tar.gz
        mv frp_0.52.3_linux_amd64 frp
        rm frp_0.52.3_linux_amd64.tar.gz
    fi
    
    # 防火墙
    ufw allow 7000/tcp 2>/dev/null || true
    ufw allow 7500/tcp 2>/dev/null || true
    ufw allow 80/tcp 2>/dev/null || true
    
    echo 'frp 安装完成'
"

# 上传配置
scp "$SCRIPT_DIR/frps.ini" root@$SERVER_IP:/opt/frp/

echo -e "${GREEN}✅ 部署完成${NC}"
echo ""

# 启动命令
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 启动命令"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 服务器端启动:"
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
    echo "   http://$SERVER_IP:8080"
fi
echo ""
echo "4. frp 仪表盘:"
echo "   http://$SERVER_IP:7500"
echo "   用户名: admin"
echo "   密码: $DASHBOARD_PWD"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 安全凭证（请保存）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Token: $TOKEN"
echo "Dashboard 密码: $DASHBOARD_PWD"
echo ""
