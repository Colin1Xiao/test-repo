#!/bin/bash
# Cloudflare Tunnel 启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARED="$HOME/.local/bin/cloudflared"
PORT=8767

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🌐 Cloudflare Tunnel 启动                     ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 安装 cloudflared
install_cloudflared() {
    if [ -f "$CLOUDFLARED" ]; then
        return 0
    fi
    
    echo -e "${YELLOW}📦 安装 cloudflared...${NC}"
    mkdir -p ~/.local/bin
    
    curl -Lo "$CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64
    chmod +x "$CLOUDFLARED"
    
    echo -e "${GREEN}✅ 安装完成${NC}"
}

# 启动 Control Tower
start_control_tower() {
    echo -e "${BLUE}🚀 检查 Control Tower...${NC}"
    
    if curl -s http://localhost:$PORT/api/system/status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Control Tower 运行中${NC}"
    else
        echo -e "${YELLOW}⚠️  Control Tower 未运行，正在启动...${NC}"
        cd "$SCRIPT_DIR"
        nohup python3 control_tower_server.py $PORT > logs/control_tower.log 2>&1 &
        sleep 2
        
        if curl -s http://localhost:$PORT/api/system/status > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Control Tower 启动成功${NC}"
        else
            echo -e "${RED}❌ Control Tower 启动失败${NC}"
            exit 1
        fi
    fi
}

# 主逻辑
print_banner

# 安装
install_cloudflared

# 启动 Control Tower
start_control_tower

echo ""
echo -e "${GREEN}🌐 启动 Cloudflare Tunnel...${NC}"
echo -e "${YELLOW}   按 Ctrl+C 停止${NC}"
echo ""

# 启动 tunnel
"$CLOUDFLARED" tunnel --url http://localhost:$PORT
