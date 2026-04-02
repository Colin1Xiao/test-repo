#!/bin/bash
# OCNMPS 路由日志分析
# 用法：./ocnmps_analyze_recent_500.sh [window]
# window: 500(默认) | config(配置更新后) | 24h

LOG_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log"
WINDOW=${1:-500}

echo "=== OCNMPS 路由日志分析 ==="
echo "统计时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "日志文件：$LOG_FILE"
echo "统计窗口：$WINDOW"
echo ""

# 根据窗口选择日志
if [ "$WINDOW" = "config" ]; then
    WINDOW_LOG=$(grep -E "^{.*2026-04-01T1[2-9]|^{.*2026-04-02" "$LOG_FILE" | grep -E "Model override applied|Gray release")
elif [ "$WINDOW" = "24h" ]; then
    WINDOW_LOG=$(grep -E "^{.*$(date -v-24H '+%Y-%m-%d')|^{.*$(date '+%Y-%m-%d')" "$LOG_FILE" | grep -E "Model override applied|Gray release")
else
    WINDOW_LOG=$(tail -"$WINDOW" "$LOG_FILE" | grep -E "Model override applied|Gray release")
fi

HIT_COUNT=$(echo "$WINDOW_LOG" | grep -c "Gray release hit" || echo "0")
MISS_COUNT=$(echo "$WINDOW_LOG" | grep -c "Gray release miss" || echo "0")
ROUTE_COUNT=$(echo "$WINDOW_LOG" | grep -c "Model override applied" || echo "0")

# 确保是数字
HIT_COUNT=${HIT_COUNT:-0}
MISS_COUNT=${MISS_COUNT:-0}
ROUTE_COUNT=${ROUTE_COUNT:-0}

echo "=== 1. 灰度命中统计 ==="
echo "Hit: $HIT_COUNT | Miss: $MISS_COUNT"
TOTAL_GRAY=$((HIT_COUNT + MISS_COUNT))
if [ "$TOTAL_GRAY" -gt 0 ]; then
    HIT_RATE=$(awk "BEGIN {printf \"%.1f\", ($HIT_COUNT / $TOTAL_GRAY) * 100}")
    echo "命中率：$HIT_RATE%"
fi
echo "按意图:"
echo "$WINDOW_LOG" | grep "Gray release" | grep -o '"intent":"[^"]*"' | sort | uniq -c | sort -rn 2>/dev/null || echo "无数据"
echo ""

echo "=== 2. 意图分布统计 ==="
echo "$WINDOW_LOG" | grep "Model override applied" | grep -o '"intent":"[^"]*"' | sort | uniq -c | sort -rn 2>/dev/null || echo "无数据"
echo ""

echo "=== 3. 模型使用统计 ==="
echo "$WINDOW_LOG" | grep "Model override applied" | grep -o '"model":"[^"]*"' | sort | uniq -c | sort -rn 2>/dev/null || echo "无数据"
echo ""

echo "=== 4. 总路由次数 ==="
echo "$ROUTE_COUNT"
echo ""

echo "=== 5. 最新路由日志 ==="
echo "$WINDOW_LOG" | grep "Model override applied" | tail -5 2>/dev/null || echo "无数据"
