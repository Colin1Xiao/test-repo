#!/bin/bash
# gray-stats.sh - 统计最近 500 条日志中的 gray hit 和 gray miss
# 用法：./gray-stats.sh [日志文件路径] [行数]

LOG_FILE="${1:-~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log}"
LINE_COUNT="${2:-500}"

# 展开波浪号路径
LOG_FILE=$(eval echo "$LOG_FILE")

# 检查文件是否存在
if [[ ! -f "$LOG_FILE" ]]; then
    echo "❌ 错误：日志文件不存在: $LOG_FILE"
    exit 1
fi

# 获取最近 N 行日志
RECENT_LOGS=$(tail -n "$LINE_COUNT" "$LOG_FILE")

# 统计 gray hit (包含 gray_hit:true 的行)
GRAY_HIT=$(echo "$RECENT_LOGS" | grep -c "gray_hit:true")

# 统计 gray miss (包含 "Gray release miss" 的行)
GRAY_MISS=$(echo "$RECENT_LOGS" | grep -c "Gray release miss")

# 输出结果
echo "【Gray 统计报告】"
echo "📄 日志文件：$LOG_FILE"
echo "📊 统计范围：最近 $LINE_COUNT 行"
echo ""
echo "🟢 Gray Hit:  $GRAY_HIT"
echo "🔴 Gray Miss: $GRAY_MISS"
echo ""
TOTAL=$((GRAY_HIT + GRAY_MISS))
if [[ $TOTAL -gt 0 ]]; then
    HIT_RATE=$(awk "BEGIN {printf \"%.1f\", ($GRAY_HIT / $TOTAL) * 100}")
    echo "📈 Hit Rate: ${HIT_RATE}%"
else
    echo "📈 Hit Rate: N/A (无灰度请求)"
fi
