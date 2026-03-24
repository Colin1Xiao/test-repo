#!/bin/bash
# 一键启动公网 Control Tower
# 用法: ./start-public.sh [ngrok|cloudflare|local]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8767
TUNNEL_TYPE="${1:-ngrok}"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 小龙 Control Tower v3 - 公网启动             ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查 Control Tower 是否运行
check_server() {
    if curl -s http://localhost:$PORT/api/system/status > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 启动 Control Tower
start_control_tower() {
    echo -e "${GREEN}🚀 启动 Control Tower...${NC}"
    cd "$SCRIPT_DIR"
    
    if check_server; then
        echo -e "${YELLOW}⚠️  Control Tower 已在运行${NC}"
    else
        nohup python3 control_tower_server.py $PORT > logs/control_tower.log 2>&1 &
        sleep 2
        
        if check_server; then
            echo -e "${GREEN}✅ Control Tower 启动成功${NC}"
        else
            echo -e "${RED}❌ Control Tower 启动失败${NC}"
            exit 1
        fi
    fi
    
    echo ""
    echo -e "${BLUE}📊 本地访问:${NC}"
    echo "    http://localhost:$PORT/control-tower"
    
    # 获取本机 IP
    local ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    if [ -n "$ip" ]; then
        echo "    http://$ip:$PORT/control-tower"
    fi
    echo ""
}

# 启动 ngrok
start_ngrok() {
    echo -e "${GREEN}🌍 启动 ngrok 隧道...${NC}"
    
    if ! command -v ngrok &> /dev/null; then
        echo -e "${RED}❌ ngrok 未安装${NC}"
        echo "    安装: brew install ngrok"
        echo "    或: https://ngrok.com/download"
        exit 1
    fi
    
    # 检查 authtoken
    if ! grep -q "authtoken: YOUR_NGROK_AUTHTOKEN" ngrok-control-tower.yml 2>/dev/null; then
        echo -e "${YELLOW}⚠️  请先在 ngrok-control-tower.yml 中配置 authtoken${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}⏳ 等待 ngrok 启动...${NC}"
    echo -e "${YELLOW}   按 Ctrl+C 停止${NC}"
    echo ""
    
    # 启动 ngrok
    ngrok http $PORT --log=stdout
}

# 启动 Cloudflare Tunnel
start_cloudflare() {
    echo -e "${GREEN}🌍 启动 Cloudflare Tunnel...${NC}"
    
    if ! command -v cloudflared &> /dev/null; then
        echo -e "${RED}❌ cloudflared 未安装${NC}"
        echo "    安装: brew install cloudflared"
        exit 1
    fi
    
    echo ""
    echo -e "${YELLOW}⏳ 启动 Cloudflare Tunnel...${NC}"
    echo -e "${YELLOW}   按 Ctrl+C 停止${NC}"
    echo ""
    
    cloudflared tunnel --url http://localhost:$PORT
}

# 打印访问信息
print_access_info() {
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Control Tower v3 公网访问已就绪${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# 主逻辑
print_banner

# 启动 Control Tower
start_control_tower

# 根据类型启动隧道
case "$TUNNEL_TYPE" in
    ngrok)
        start_ngrok
        ;;
    cloudflare|cf)
        start_cloudflare
        ;;
    local)
        print_access_info
        echo -e "${BLUE}📝 Control Tower 已在本地运行${NC}"
        echo ""
        echo "要启用公网访问，请运行:"
        echo "    ./start-public.sh ngrok"
        echo "    或"
        echo "    ./start-public.sh cloudflare"
        ;;
    *)
        echo -e "${RED}❌ 未知选项: $TUNNEL_TYPE${NC}"
        echo ""
        echo "用法:"
        echo "    ./start-public.sh local      # 仅本地"
        echo "    ./start-public.sh ngrok      # ngrok 公网"
        echo "    ./start-public.sh cloudflare # Cloudflare 公网"
        exit 1
        ;;
esac
