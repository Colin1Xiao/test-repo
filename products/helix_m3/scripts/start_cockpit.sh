#!/bin/bash
# Helix 驾驶舱服务启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Helix 驾驶舱服务启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$PROJECT_ROOT/.venv"

echo -e "${YELLOW}[1/5] 检查环境...${NC}"

# 检查 Python 版本
if ! command -v python3.14 &> /dev/null; then
    echo -e "${RED}❌ Python 3.14 未找到${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3.14 --version)
echo -e "  Python 版本: $PYTHON_VERSION"

# 检查虚拟环境
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  虚拟环境不存在，创建中...${NC}"
    python3.14 -m venv "$VENV_DIR"
    echo -e "${GREEN}✅ 虚拟环境创建成功${NC}"
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"
echo

echo -e "${YELLOW}[2/5] 激活虚拟环境...${NC}"
source "$VENV_DIR/bin/activate"
echo -e "${GREEN}✅ 虚拟环境已激活${NC}"
echo

echo -e "${YELLOW}[3/5] 安装依赖...${NC}"
if [ -f "$PROJECT_ROOT/requirements.txt" ]; then
    pip install -r "$PROJECT_ROOT/requirements.txt"
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
else
    echo -e "${YELLOW}⚠️  requirements.txt 未找到，跳过依赖安装${NC}"
fi
echo

echo -e "${YELLOW}[4/5] 启动服务...${NC}"
echo -e "  环境:"
echo -e "   项目根目录: $PROJECT_ROOT"
echo -e "   虚拟环境: $VENV_DIR"
echo -e "   工作目录: $(pwd)"
echo

# 检查端口是否被占用
PORT=8000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 $PORT 已被占用，尝试关闭...${NC}"
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}🚀 启动 FastAPI 服务...${NC}"
echo -e "  访问地址:"
echo -e "    - API: ${BLUE}http://localhost:$PORT/api/v1${NC}"
echo -e "    - 文档: ${BLUE}http://localhost:$PORT/docs${NC}"
echo -e "    - 健康检查: ${BLUE}http://localhost:$PORT/health${NC}"
echo

# 启动服务
cd "$PROJECT_ROOT"
uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload &

# 获取进程 ID
UVICORN_PID=$!
echo $UVICORN_PID > "$PROJECT_ROOT/.cockpit.pid"

echo -e "${YELLOW}[5/5] 验证服务状态...${NC}"

# 等待服务启动
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✅ 服务启动成功！${NC}"
        echo
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 服务启动失败，超时等待${NC}"
        exit 1
    fi
    
    echo -n "."
    sleep 1
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    服务信息${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# 显示关键信息
echo -e "${GREEN}✅ 服务运行中${NC}"
echo -e "   进程ID: $UVICORN_PID"
echo -e "   端口: $PORT"
echo -e "   日志文件: $PROJECT_ROOT/logs/helix_cockpit.log"
echo

# 显示健康检查结果
echo -e "${YELLOW}📊 健康检查:${NC}"
curl -s "http://localhost:$PORT/health" | python3 -m json.tool | tail -30
echo

# 显示服务状态
echo -e "${YELLOW}📊 系统状态:${NC}"
curl -s "http://localhost:$PORT/api/v1/system/status" | python3 -m json.tool | tail -50

echo -e "\n${GREEN}🎉 Helix 驾驶舱服务已成功启动！${NC}"
echo -e "   按 Ctrl+C 停止服务"
echo

# 保持脚本运行，直到收到信号
wait $UVICORN_PID