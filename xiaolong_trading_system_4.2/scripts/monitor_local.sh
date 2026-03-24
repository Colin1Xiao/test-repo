#!/bin/bash
# 1000笔监控 - 使用本地日志

TARGET=1000
LOG_FILE="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/monitor_1000.log"
STATE_LOG="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/system_state.jsonl"

echo "开始监控: $(date)" > "$LOG_FILE"

while true; do
    # 从本地日志读取交易数
    COUNT=$(tail -1 "$STATE_LOG" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('total_trades', 0))
except:
    print(0)
")
    
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
    echo "[$TIMESTAMP] 完整闭环: $COUNT/$TARGET 笔" >> "$LOG_FILE"
    echo "[$TIMESTAMP] $COUNT/$TARGET"
    
    if [ "$COUNT" -ge "$TARGET" ]; then
        echo "" >> "$LOG_FILE"
        echo "✅ 达到目标！生成报告..." >> "$LOG_FILE"
        python3 /Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/scripts/tail_analysis.py >> "$LOG_FILE" 2>&1
        break
    fi
    
    sleep 180
done
