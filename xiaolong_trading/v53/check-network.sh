#!/bin/bash
# 网络配置检查脚本

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         🔍 网络配置检查工具                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 获取 IP
PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "未知")
LOCAL_IP=$(/sbin/ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
GATEWAY=$(netstat -rn 2>/dev/null | grep default | awk '{print $2}' | head -1 || echo "192.168.1.1")

echo "📊 网络信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "公网 IP: $PUBLIC_IP"
echo "本地 IP: $LOCAL_IP"
echo "网关:    $GATEWAY"
echo "端口:    8767"
echo ""

# 检查 Control Tower
echo "🔍 检查 Control Tower"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:8767/api/system/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Control Tower 运行正常${NC}"
    curl -s http://localhost:8767/api/system/status | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   模式: {d[\"mode\"]}'); print(f'   决策: {d[\"diff\"][\"total\"]} 笔'); print(f'   状态: {d[\"stats\"][\"status\"]}')"
else
    echo -e "${RED}❌ Control Tower 未运行${NC}"
    echo "   启动命令: ./start-public-ip.sh"
fi
echo ""

# 检查本地访问
echo "🔍 检查本地访问"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:8767/api/system/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 本地访问正常${NC}"
    echo "   http://localhost:8767/control-tower"
else
    echo -e "${RED}❌ 本地访问失败${NC}"
fi
echo ""

# 检查局域网访问
echo "🔍 检查局域网访问"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://$LOCAL_IP:8767/api/system/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 局域网访问正常${NC}"
    echo "   http://$LOCAL_IP:8767/control-tower"
else
    echo -e "${YELLOW}⚠️  局域网访问可能受限${NC}"
    echo "   检查 Mac 防火墙设置"
fi
echo ""

# 检查公网访问
echo "🔍 检查公网访问"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "公网地址: http://$PUBLIC_IP:8767/control-tower"
echo ""
echo -e "${YELLOW}⚠️  需要手动测试:${NC}"
echo "   1. 用手机流量访问上述地址"
echo "   2. 或让朋友帮忙测试"
echo ""
echo "如果无法访问，请检查:"
echo "   1. 路由器端口映射是否配置"
echo "   2. Mac 防火墙是否关闭"
echo "   3. 运营商是否封锁端口"
echo ""

# 路由器信息
echo "📋 路由器配置信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "路由器型号: 华为 HN8156XR-10"
echo "管理地址:   http://$GATEWAY"
echo "配置指南:   router-config-huawei.md"
echo ""
echo "端口映射设置:"
echo "   外部端口: 8767"
echo "   内部 IP:  $LOCAL_IP"
echo "   内部端口: 8767"
echo "   协议:     TCP"
echo ""

# 备用方案
echo "🔄 备用方案"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "如果端口映射无法配置，可以使用:"
echo ""
echo "1. Cloudflare Tunnel (推荐)"
echo "   ./start-public.sh cloudflare"
echo ""
echo "2. ngrok"
echo "   ./start-public.sh ngrok"
echo ""
echo "3. frp (需要 VPS)"
echo "   ./start-frp.sh"
echo ""
