#!/bin/bash
# 使用宽带公网 IP 直接访问 Control Tower

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8767

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 Control Tower - 公网 IP 直连               ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 获取公网 IP
get_public_ip() {
    curl -s https://api.ipify.org 2>/dev/null || \
    curl -s http://ifconfig.me 2>/dev/null || \
    curl -s https://icanhazip.com 2>/dev/null || \
    echo "未知"
}

# 获取本地 IP
get_local_ip() {
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
}

# 检查 Control Tower
check_server() {
    curl -s http://localhost:$PORT/api/system/status > /dev/null 2>&1
}

# 启动 Control Tower
start_server() {
    echo -e "${GREEN}🚀 启动 Control Tower...${NC}"
    
    if check_server; then
        echo -e "${YELLOW}⚠️  Control Tower 已在运行${NC}"
    else
        cd "$SCRIPT_DIR"
        nohup python3 control_tower_server.py $PORT > logs/control_tower.log 2>&1 &
        sleep 2
        
        if check_server; then
            echo -e "${GREEN}✅ Control Tower 启动成功${NC}"
        else
            echo -e "${RED}❌ Control Tower 启动失败${NC}"
            exit 1
        fi
    fi
}

# 主逻辑
print_banner

PUBLIC_IP=$(get_public_ip)
LOCAL_IP=$(get_local_ip)

echo "🌐 网络信息:"
echo "   公网 IP: $PUBLIC_IP"
echo "   本地 IP: $LOCAL_IP"
echo "   端口: $PORT"
echo ""

# 启动服务器
start_server

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 访问地址"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}本地:${NC}    http://localhost:$PORT/control-tower"
echo -e "${GREEN}局域网:${NC}  http://$LOCAL_IP:$PORT/control-tower"

if [ "$PUBLIC_IP" != "未知" ]; then
    echo -e "${GREEN}公网:${NC}    http://$PUBLIC_IP:$PORT/control-tower"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  重要提示"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$PUBLIC_IP" != "未知" ]; then
    echo "1. 路由器端口映射"
    echo "   需要在路由器设置端口转发:"
    echo "   外部端口 $PORT -> $LOCAL_IP:$PORT"
    echo ""
    echo "2. 防火墙设置"
    echo "   Mac 防火墙需要允许 Python 传入连接"
    echo "   系统设置 -> 网络 -> 防火墙"
    echo ""
    echo "3. 动态 IP"
    echo "   宽带 IP 可能会变化，建议使用 DDNS"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 测试命令"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "本地测试:"
echo "  curl http://localhost:$PORT/api/system/status"
echo ""
if [ "$PUBLIC_IP" != "未知" ]; then
    echo "公网测试:"
    echo "  curl http://$PUBLIC_IP:$PORT/api/system/status"
    echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
