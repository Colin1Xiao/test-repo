#!/bin/bash
# ============================================================
# 小龙交易系统 V5.3 - 统一监控服务器启动脚本
# ============================================================

cd "$(dirname "$0")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}🐉 小龙交易系统 V5.3 - 统一监控服务器${NC}"
echo -e "${BLUE}============================================================${NC}"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 未找到 Python3${NC}"
    exit 1
fi

# 检查依赖
echo -e "${YELLOW}📦 检查依赖...${NC}"
pip3 show fastapi &> /dev/null || pip3 install fastapi uvicorn

# 创建必要目录
mkdir -p logs data config

# 端口配置
PORT=${1:-8765}

echo ""
echo -e "${GREEN}启动信息:${NC}"
echo -e "  本地访问: ${BLUE}http://localhost:${PORT}${NC}"
echo -e "  监控面板: ${BLUE}http://localhost:${PORT}/dashboard/${NC}"
echo -e "  API文档:  ${BLUE}http://localhost:${PORT}/docs${NC}"
echo -e "  控制平面: ${BLUE}http://localhost:${PORT}/control/${NC}"
echo -e "  决策追踪: ${BLUE}http://localhost:${PORT}/decision/trace${NC}"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}按 Ctrl+C 停止服务器${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# 启动服务器
if [ -f "server/main.py" ]; then
    python3 -m server.main
else
    # 回退到旧版启动方式
    python3 -c "
import uvicorn
from monitor_server import app
uvicorn.run(app, host='0.0.0.0', port=${PORT})
"
fi