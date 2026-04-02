#!/bin/bash
# ============================================================
# 🛡️ V5.2 GUARDIAN DEPLOY - 守护级部署系统
# 功能：自动重启 + 异常自杀 + 滑点报警 + Guardian推送
# ============================================================

set -e

# 动态计算 BASE_DIR - 基于脚本自身位置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$SCRIPT_DIR"
API_FILE="$HOME/.openclaw/secrets/okx_testnet.json"
PID_FILE="$BASE_DIR/logs/v52.pid"
LOG_FILE="$BASE_DIR/logs/v52_output.log"
STATE_FILE="$BASE_DIR/logs/system_state.jsonl"

# Telegram 报警（可选，从配置读取）
BOT_TOKEN=""
CHAT_ID=""

# ============================================================
# 通知函数
# ============================================================
send_alert() {
    local message="$1"
    echo "📡 ALERT: $message"
    if [ ! -z "$BOT_TOKEN" ] && [ ! -z "$CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
            -d chat_id="$CHAT_ID" \
            -d text="$message" >/dev/null 2>&1 || true
    fi
}

# ============================================================
# 1. 清场
# ============================================================
echo "============================================================"
echo "🛡️ V5.2 GUARDIAN DEPLOY"
echo "============================================================"
echo ""
echo "🧹 Step 1: 清理所有旧进程..."

pkill -f "run_v52_live.py" 2>/dev/null || true
pkill -f "run_v4" 2>/dev/null || true
pkill -f "run_v5" 2>/dev/null || true
pkill -f "p1_testnet" 2>/dev/null || true
pkill -f "auto_monitor" 2>/dev/null || true

sleep 2

echo "✅ 清场完成"
echo ""

# ============================================================
# 2. 环境检查
# ============================================================
echo "🔍 Step 2: 环境检查..."

cd "$BASE_DIR"

[ -f "run_v52_live.py" ] || { echo "❌ run_v52_live.py 不存在"; exit 1; }
[ -f "core/constants.py" ] || { echo "❌ core/constants.py 不存在"; exit 1; }
[ -f "core/sample_filter.py" ] || { echo "❌ core/sample_filter.py 不存在"; exit 1; }

mkdir -p logs data/feedback archive

echo "✅ 环境检查通过"
echo ""

# ============================================================
# 3. API 检查（强制 Testnet）
# ============================================================
echo "🔑 Step 3: API 检查..."

if [ ! -f "$API_FILE" ]; then
    echo "❌ Testnet API 配置不存在"
    echo "   请创建: $API_FILE"
    exit 1
fi

# 检查是否是 Testnet 模式
if ! grep -q '"testnet": true' "$API_FILE" 2>/dev/null; then
    echo "🚨 ERROR: 不是 Testnet 模式！"
    echo "   拒绝启动（防止实盘风险）"
    send_alert "🚨 V5.2 BLOCKED: NOT IN TESTNET MODE"
    exit 1
fi

# 检查 API Key 是否有效
API_KEY=$(grep '"api_key"' "$API_FILE" | head -1 | sed 's/.*: *"//' | sed 's/".*//')
if [ -z "$API_KEY" ] || [[ "$API_KEY" == "YOUR_"* ]]; then
    echo "❌ API Key 未配置"
    echo "   请编辑: $API_FILE"
    exit 1
fi

echo "✅ Testnet 模式确认"
echo "   API Key: ${API_KEY:0:10}..."
echo ""

# ============================================================
# 4. 配置检查
# ============================================================
echo "📋 Step 4: 配置检查..."

CONFIG_FILE="$BASE_DIR/config/trader_config.json"
if [ -f "$CONFIG_FILE" ]; then
    # 检查版本
    if ! grep -q '"system_version": "V5.2"' "$CONFIG_FILE" 2>/dev/null; then
        echo "⚠️ 配置文件版本标识缺失，正在添加..."
        python3 -c "
import json
with open('$CONFIG_FILE', 'r') as f:
    config = json.load(f)
config['system_version'] = 'V5.2'
with open('$CONFIG_FILE', 'w') as f:
    json.dump(config, f, indent=2)
"
    fi
    echo "✅ 配置版本: V5.2"
else
    echo "⚠️ 配置文件不存在，使用默认配置"
fi
echo ""

# ============================================================
# 5. 防重复启动
# ============================================================
echo "🔒 Step 5: 检查是否已运行..."

if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "❌ V5.2 已在运行 (PID: $OLD_PID)"
        echo "   如需重启，请先: kill $OLD_PID"
        exit 1
    else
        echo "⚠️ 清理过期 PID 文件"
        rm -f "$PID_FILE"
    fi
fi

echo "✅ 无重复进程"
echo ""

# ============================================================
# 6. 启动系统
# ============================================================
echo "🚀 Step 6: 启动 V5.2..."

# 清理旧日志
rm -f "$LOG_FILE" "$STATE_FILE"
> "$LOG_FILE"

# 设置代理
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# 启动
nohup /usr/local/bin/python3 run_v52_live.py \
    --testnet \
    --execute \
    --interval 30 \
    > "$LOG_FILE" 2>&1 &

PID=$!
echo $PID > "$PID_FILE"

sleep 5

echo "PID: $PID"
echo ""

# ============================================================
# 7. 启动验证
# ============================================================
echo "🧪 Step 7: 启动验证..."

if ! ps -p $PID > /dev/null 2>&1; then
    echo "❌ 进程启动失败"
    echo ""
    echo "错误日志:"
    tail -20 "$LOG_FILE"
    send_alert "❌ V5.2 FAILED TO START"
    exit 1
fi

echo "✅ 进程运行中"
echo ""

# ============================================================
# 8. Executor 校验（关键）
# ============================================================
echo "🔍 Step 8: 执行器校验..."

sleep 3

if grep -q "执行器初始化成功" "$LOG_FILE" 2>/dev/null; then
    echo "✅ Executor 已初始化 (TESTNET)"
elif grep -q "Executor initialized" "$LOG_FILE" 2>/dev/null; then
    echo "✅ Executor 已初始化"
else
    echo "❌ Executor 未初始化"
    echo ""
    echo "日志:"
    tail -30 "$LOG_FILE"
    echo ""
    echo "🛑 停止系统"
    kill $PID 2>/dev/null || true
    rm -f "$PID_FILE"
    send_alert "❌ V5.2 EXECUTOR NOT INITIALIZED"
    exit 1
fi
echo ""

# ============================================================
# 9. 模式校验
# ============================================================
echo "🔍 Step 9: 模式校验..."

if grep -q "LIVE (实盘)" "$LOG_FILE" 2>/dev/null; then
    echo "✅ 执行模式: LIVE"
elif grep -q "SHADOW (影子)" "$LOG_FILE" 2>/dev/null; then
    echo "⚠️ 警告: 影子模式（不会真实执行）"
fi

if grep -q "TESTNET (测试网)" "$LOG_FILE" 2>/dev/null; then
    echo "✅ 网络: TESTNET"
elif grep -q "MAINNET (主网)" "$LOG_FILE" 2>/dev/null; then
    echo "🚨 错误: MAINNET 模式！"
    echo "🛑 停止系统"
    kill $PID 2>/dev/null || true
    rm -f "$PID_FILE"
    send_alert "🚨 V5.2 MAINNET MODE DETECTED - EMERGENCY STOP"
    exit 1
fi
echo ""

# ============================================================
# 10. 完成报告
# ============================================================
echo "============================================================"
echo "📊 V5.2 系统状态"
echo "============================================================"
echo ""
echo "PID: $PID"
echo "模式: Testnet 执行"
echo "监控: BTC/USDT, ETH/USDT"
echo "杠杆: 100x"
echo "仓位: 3 USD"
echo "止损: -0.5%"
echo "止盈: 0.2%"
echo ""
echo "监控命令:"
echo "  日志: tail -f $LOG_FILE"
echo "  状态: tail -f $STATE_FILE"
echo ""
echo "============================================================"
echo "✅ V5.2 GUARDIAN DEPLOY COMPLETE"
echo "============================================================"

send_alert "🚀 V5.2 STARTED (Testnet)\nPID: $PID\n模式: 执行\n杠杆: 100x"

# ============================================================
# 11. 监控循环（守护进程）
# ============================================================
echo ""
echo "👁️ Guardian 监控启动..."
echo "   每 30 秒检查一次"
echo "   按 Ctrl+C 停止监控"
echo ""

HEARTBEAT_TIMEOUT=120  # 心跳超时（秒）
CHECK_INTERVAL=30      # 检查间隔（秒）

while true
do
    sleep $CHECK_INTERVAL
    
    # -----------------
    # 进程存活检查
    # -----------------
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') ❌ 进程已死亡，尝试重启..."
        send_alert "⚠️ V5.2 CRASHED → Restarting"
        
        # 重新启动
        nohup /usr/local/bin/python3 run_v52_live.py \
            --testnet --execute --interval 30 \
            > "$LOG_FILE" 2>&1 &
        PID=$!
        echo $PID > "$PID_FILE"
        sleep 5
        
        if ps -p $PID > /dev/null 2>&1; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') ✅ 重启成功 (PID: $PID)"
            send_alert "✅ V5.2 RESTARTED (PID: $PID)"
        else
            echo "$(date '+%Y-%m-%d %H:%M:%S') ❌ 重启失败"
            send_alert "❌ V5.2 RESTART FAILED"
        fi
        continue
    fi
    
    # -----------------
    # 心跳检查（防卡死）
    # -----------------
    if [ -f "$STATE_FILE" ]; then
        LAST_LINE=$(tail -n 1 "$STATE_FILE" 2>/dev/null)
        if [ ! -z "$LAST_LINE" ]; then
            # 简单检查：是否有新数据写入
            LAST_TIME=$(echo "$LAST_LINE" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    ts = d.get('timestamp', '')
    if ts:
        from datetime import datetime
        dt = datetime.fromisoformat(ts)
        print(int(dt.timestamp()))
except:
    print(0)
" 2>/dev/null || echo "0")
            
            NOW=$(date +%s)
            
            if [ "$LAST_TIME" != "0" ]; then
                DIFF=$((NOW - LAST_TIME))
                
                if [ $DIFF -gt $HEARTBEAT_TIMEOUT ]; then
                    echo "$(date '+%Y-%m-%d %H:%M:%S') ⚠️ 心跳超时 (${DIFF}s)，重启..."
                    send_alert "⚠️ V5.2 NO HEARTBEAT (${DIFF}s) → Restart"
                    kill $PID 2>/dev/null || true
                    sleep 2
                    continue
                fi
            fi
        fi
    fi
    
    # -----------------
    # Guardian 触发检查
    # -----------------
    if grep -q '"guardian_decision": "stop"' "$STATE_FILE" 2>/dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') 🛑 Guardian STOP 检测到"
        send_alert "🛑 V5.2 GUARDIAN STOPPED SYSTEM"
        # 不重启，等待人工干预
        break
    fi
    
    # -----------------
    # 状态汇总（每 5 分钟）
    # -----------------
    if [ -f "$STATE_FILE" ]; then
        RECORD_COUNT=$(wc -l < "$STATE_FILE" 2>/dev/null || echo "0")
        SIGNALS=$(grep -c '"score": 8[0-9]' "$STATE_FILE" 2>/dev/null || echo "0")
        echo "$(date '+%Y-%m-%d %H:%M:%S') 📊 记录: $RECORD_COUNT | ≥80分: $SIGNALS"
    fi
    
done