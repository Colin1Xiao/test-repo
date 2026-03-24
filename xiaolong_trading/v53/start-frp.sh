#!/bin/bash
# frp 客户端启动脚本 - 小龙 Control Tower

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRPC_BIN="${FRPC_BIN:-$HOME/frp/frpc}"
CONFIG_FILE="$SCRIPT_DIR/frpc.ini"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         🐉 小龙 Control Tower - frp 公网隧道            ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查 frpc
check_frpc() {
    if [ ! -f "$FRPC_BIN" ]; then
        echo -e "${RED}❌ frpc 未找到: $FRPC_BIN${NC}"
        echo ""
        echo "请下载 frp:"
        echo "  1. 访问 https://github.com/fatedier/frp/releases"
        echo "  2. 下载 frp_xxx_darwin_amd64.tar.gz"
        echo "  3. 解压到 $HOME/frp/"
        echo ""
        echo "或使用环境变量指定路径:"
        echo "  FRPC_BIN=/path/to/frpc ./start-frp.sh"
        exit 1
    fi
    
    echo -e "${GREEN}✅ frpc 已找到: $FRPC_BIN${NC}"
}

# 检查配置文件
check_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}❌ 配置文件不存在: $CONFIG_FILE${NC}"
        exit 1
    fi
    
    # 检查占位符
    if grep -q "YOUR_SERVER_IP\|YOUR_TOKEN" "$CONFIG_FILE"; then
        echo -e "${YELLOW}⚠️  请先编辑配置文件: $CONFIG_FILE${NC}"
        echo ""
        echo "需要修改:"
        echo "  - server_addr: 你的服务器 IP 或域名"
        echo "  - token: 与服务器端一致的认证 token"
        echo "  - custom_domains: 你的域名（可选）"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 配置文件已就绪${NC}"
}

# 启动 Control Tower
start_control_tower() {
    echo -e "${BLUE}🚀 检查 Control Tower...${NC}"
    
    if curl -s http://localhost:8767/api/system/status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Control Tower 已在运行${NC}"
    else
        echo -e "${YELLOW}⚠️  Control Tower 未运行，正在启动...${NC}"
        cd "$SCRIPT_DIR"
        nohup python3 control_tower_server.py 8767 > logs/control_tower.log 2>&1 &
        sleep 2
        
        if curl -s http://localhost:8767/api/system/status > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Control Tower 启动成功${NC}"
        else
            echo -e "${RED}❌ Control Tower 启动失败${NC}"
            exit 1
        fi
    fi
    
    echo ""
    echo -e "${BLUE}📊 本地访问:${NC}"
    echo "    http://localhost:8767/control-tower"
    echo ""
}

# 启动 frpc
start_frpc() {
    echo -e "${GREEN}🌍 启动 frp 客户端...${NC}"
    echo ""
    echo -e "${YELLOW}配置文件: $CONFIG_FILE${NC}"
    echo -e "${YELLOW}按 Ctrl+C 停止${NC}"
    echo ""
    
    "$FRPC_BIN" -c "$CONFIG_FILE"
}

# 主逻辑
print_banner
check_frpc
check_config
start_control_tower
start_frpc
