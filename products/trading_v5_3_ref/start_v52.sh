#!/bin/bash
# ============================================================
# 小龙交易系统 V5.2 - 统一启动脚本
# 功能：清场 + 启动 + 验证
# 规则：只能通过此脚本启动，禁止手动启动
# ============================================================

set -e

# 动态计算 BASE_DIR - 基于脚本自身位置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$SCRIPT_DIR"
LOG_DIR="$BASE_DIR/logs"
PID_FILE="$LOG_DIR/v52.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "🐉 小龙交易系统 V5.2 - 统一启动"
echo "============================================================"
echo ""

# ============================================================
# Step 1: 清场 - 杀掉所有旧版本
# ============================================================
echo -e "${YELLOW}🧹 Step 1: 清理旧系统...${NC}"

# 杀掉所有可能的旧版本
pkill -f "run_v52_live.py" 2>/dev/null || true
pkill -f "run_v4" 2>/dev/null || true
pkill -f "p1_testnet" 2>/dev/null || true
pkill -f "auto_monitor" 2>/dev/null || true
pkill -f "xiaolong_trading_system.py" 2>/dev/null || true

sleep 2

# 验证清场成功
REMAINING=$(ps aux | grep -E "python.*(run_v|p1_testnet|auto_monitor|xiaolong_trading)" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${RED}❌ 清场失败，仍有旧进程运行:${NC}"
    ps aux | grep -E "python.*(run_v|p1_testnet|auto_monitor|xiaolong_trading)" | grep -v grep
    exit 1
fi
echo -e "${GREEN}✅ 清场成功${NC}"
echo ""

# ============================================================
# Step 2: 清理旧数据
# ============================================================
echo -e "${YELLOW}🧹 Step 2: 清理旧数据...${NC}"

# 备份旧数据
BACKUP_DIR="$BASE_DIR/archive/session_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$LOG_DIR/system_state.jsonl" "$BACKUP_DIR/" 2>/dev/null || true
cp "$LOG_DIR/v52_output.log" "$BACKUP_DIR/" 2>/dev/null || true
cp "$LOG_DIR/monitor_summary.json" "$BACKUP_DIR/" 2>/dev/null || true

# 清理当前数据
rm -f "$LOG_DIR/system_state.jsonl"
rm -f "$LOG_DIR/v52_output.log"
rm -f "$LOG_DIR/monitor_summary.json"
rm -f "$PID_FILE"
> "$LOG_DIR/v52_output.log"

echo -e "${GREEN}✅ 旧数据已备份到: $BACKUP_DIR${NC}"
echo ""

# ============================================================
# Step 3: 检查配置
# ============================================================
echo -e "${YELLOW}📋 Step 3: 检查配置...${NC}"

CONFIG_FILE="$BASE_DIR/config/trader_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ 配置文件不存在: $CONFIG_FILE${NC}"
    exit 1
fi

# 检查版本标识
if ! grep -q '"system_version": "V5.2"' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${YELLOW}⚠️ 配置文件缺少版本标识，正在添加...${NC}"
    # 使用 python 添加版本标识
    python3 -c "
import json
with open('$CONFIG_FILE', 'r') as f:
    config = json.load(f)
config['system_version'] = 'V5.2'
with open('$CONFIG_FILE', 'w') as f:
    json.dump(config, f, indent=2)
"
fi

echo -e "${GREEN}✅ 配置文件版本: V5.2${NC}"
echo ""

# ============================================================
# Step 4: 启动 V5.2
# ============================================================
echo -e "${YELLOW}🚀 Step 4: 启动 V5.2...${NC}"

cd "$BASE_DIR"

# 设置代理
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# 启动
nohup /usr/local/bin/python3 run_v52_live.py > "$LOG_DIR/v52_output.log" 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$PID_FILE"

sleep 3

# ============================================================
# Step 5: 验证启动
# ============================================================
echo -e "${YELLOW}🔍 Step 5: 验证启动...${NC}"

if ps -p $NEW_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ V5.2 启动成功${NC}"
    echo ""
    echo "PID: $NEW_PID"
    echo ""
    echo "启动日志:"
    tail -10 "$LOG_DIR/v52_output.log"
    echo ""
    echo "============================================================"
    echo -e "${GREEN}🐉 V5.2 正在运行${NC}"
    echo "============================================================"
    echo ""
    echo "监控命令:"
    echo "  tail -f $LOG_DIR/v52_output.log"
    echo "  cat $LOG_DIR/system_state.jsonl | head -5"
    echo ""
else
    echo -e "${RED}❌ V5.2 启动失败${NC}"
    echo ""
    echo "错误日志:"
    tail -20 "$LOG_DIR/v52_output.log"
    exit 1
fi