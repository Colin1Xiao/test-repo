#!/bin/bash
# 小龙 Control Tower v3 启动脚本
# 支持本地/公网访问

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/control_tower.log"
PID_FILE="$SCRIPT_DIR/logs/control_tower.pid"
PORT=8767

# 创建日志目录
mkdir -p "$SCRIPT_DIR/logs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 小龙 Control Tower v3 启动脚本               ║"
    echo "║              V5.2 实时数据监控面板                      ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  local       本地模式 (localhost:8765)"
    echo "  public      公网模式 (0.0.0.0:8765)"
    echo "  ngrok       使用 ngrok 公网隧道"
    echo "  cloudflare  使用 Cloudflare Tunnel"
    echo "  frp         使用 frp 内网穿透"
    echo "  stop        停止服务器"
    echo "  status      查看状态"
    echo ""
    echo "示例:"
    echo "  $0 local      # 本地访问"
    echo "  $0 public     # 公网访问 (需端口转发)"
    echo "  $0 ngrok      # 快速公网访问"
}

start_server() {
    local mode=$1
    
    # 检查是否已在运行
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Control Tower 已在运行 (PID: $pid)${NC}"
            echo "    访问: http://localhost:$PORT/control-tower"
            return 1
        fi
    fi
    
    echo -e "${GREEN}🚀 启动 Control Tower v3...${NC}"
    echo "    模式: $mode"
    echo ""
    
    # 进入目录
    cd "$SCRIPT_DIR"
    
    # 启动服务器
    nohup python3 control_tower_server.py $PORT > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"
    
    # 等待启动
    sleep 2
    
    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${GREEN}✅ 启动成功 (PID: $pid)${NC}"
        echo ""
        echo "📊 访问地址:"
        echo "    本地: http://localhost:$PORT/control-tower"
        
        # 获取本机 IP
        local ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        if [ -n "$ip" ]; then
            echo "    局域网: http://$ip:$PORT/control-tower"
        fi
        
        echo ""
        echo "📋 日志文件: $LOG_FILE"
        echo "🛑 停止命令: $0 stop"
        return 0
    else
        echo -e "${RED}❌ 启动失败${NC}"
        echo "    查看日志: tail -f $LOG_FILE"
        return 1
    fi
}

start_ngrok() {
    echo -e "${GREEN}🌐 使用 ngrok 创建公网隧道...${NC}"
    
    # 检查 ngrok
    if ! command -v ngrok &> /dev/null; then
        echo -e "${RED}❌ ngrok 未安装${NC}"
        echo "    安装: brew install ngrok"
        echo "    或访问: https://ngrok.com/download"
        return 1
    fi
    
    # 先启动本地服务器
    start_server "local"
    
    # 启动 ngrok
    echo ""
    echo -e "${GREEN}🌍 启动 ngrok 隧道...${NC}"
    ngrok http 8765 --domain=your-domain.ngrok.io 2>/dev/null || ngrok http 8765
}

start_cloudflare() {
    echo -e "${GREEN}🌐 使用 Cloudflare Tunnel...${NC}"
    
    # 检查 cloudflared
    if ! command -v cloudflared &> /dev/null; then
        echo -e "${RED}❌ cloudflared 未安装${NC}"
        echo "    安装: brew install cloudflared"
        return 1
    fi
    
    # 先启动本地服务器
    start_server "local"
    
    # 启动 tunnel
    echo ""
    echo -e "${GREEN}🌍 启动 Cloudflare Tunnel...${NC}"
    cloudflared tunnel --url http://localhost:8765
}

start_frp() {
    echo -e "${GREEN}🌐 使用 frp 内网穿透...${NC}"
    
    # 检查 frpc
    if [ ! -f "$HOME/frp/frpc" ]; then
        echo -e "${RED}❌ frpc 未找到${NC}"
        echo "    请配置 frp 客户端"
        return 1
    fi
    
    # 先启动本地服务器
    start_server "local"
    
    # 启动 frpc
    echo ""
    echo -e "${GREEN}🌍 启动 frp 客户端...${NC}"
    $HOME/frp/frpc -c $HOME/frp/frpc.ini
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}🛑 停止 Control Tower (PID: $pid)...${NC}"
            kill "$pid"
            rm -f "$PID_FILE"
            echo -e "${GREEN}✅ 已停止${NC}"
        else
            echo -e "${YELLOW}⚠️  进程已不存在${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}⚠️  Control Tower 未运行${NC}"
    fi
}

check_status() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${GREEN}✅ Control Tower 运行中 (PID: $pid)${NC}"
            echo "    访问: http://localhost:$PORT/control-tower"
            
            # 获取本机 IP
            local ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
            if [ -n "$ip" ]; then
                echo "    局域网: http://$ip:$PORT/control-tower"
            fi
            
            echo ""
            echo "📋 最近日志:"
            tail -n 5 "$LOG_FILE" 2>/dev/null || echo "    无日志"
        else
            echo -e "${RED}❌ Control Tower 已停止 (PID 文件残留)${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}⚠️  Control Tower 未运行${NC}"
    fi
}

# 主逻辑
print_header

case "${1:-local}" in
    local)
        start_server "local"
        ;;
    public)
        start_server "public"
        ;;
    ngrok)
        start_ngrok
        ;;
    cloudflare|cf)
        start_cloudflare
        ;;
    frp)
        start_frp
        ;;
    stop)
        stop_server
        ;;
    status)
        check_status
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo -e "${RED}❌ 未知选项: $1${NC}"
        print_usage
        exit 1
        ;;
esac
