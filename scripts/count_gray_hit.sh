#!/bin/bash
#
# count_gray_hit.sh - 统计日志中 gray_hit=true 的数量
#
# 用法:
#   ./count_gray_hit.sh [日志文件路径]
#
# 如果不指定文件，默认搜索 workspace 下所有 .log 文件
#

set -e

WORKSPACE="${HOME}/.openclaw/workspace"

# 参数处理
if [ $# -eq 0 ]; then
    # 未指定文件，搜索所有包含 gray_hit 的日志文件
    echo "🔍 搜索 workspace 下所有日志文件..."
    LOG_FILES=$(find "$WORKSPACE" -name "*.log" -type f 2>/dev/null | xargs grep -l "gray_hit" 2>/dev/null || true)
    
    if [ -z "$LOG_FILES" ]; then
        echo "❌ 未找到包含 gray_hit 的日志文件"
        exit 1
    fi
    
    echo "📁 找到以下日志文件:"
    echo "$LOG_FILES"
    echo ""
    
    # 统计所有文件
    TOTAL=0
    for file in $LOG_FILES; do
        COUNT=$(grep -c '"gray_hit": true' "$file" 2>/dev/null || echo 0)
        echo "  $(basename "$file"): $COUNT"
        TOTAL=$((TOTAL + COUNT))
    done
    
    echo ""
    echo "✅ gray_hit=true 总数：$TOTAL"
else
    # 指定文件
    LOG_FILE="$1"
    
    if [ ! -f "$LOG_FILE" ]; then
        echo "❌ 文件不存在：$LOG_FILE"
        exit 1
    fi
    
    COUNT=$(grep -c '"gray_hit": true' "$LOG_FILE" 2>/dev/null || echo 0)
    echo "📊 文件：$(basename "$LOG_FILE")"
    echo "✅ gray_hit=true 数量：$COUNT"
fi
