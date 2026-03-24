#!/bin/bash
# 监控新交易闭环

STATE_FILE="$HOME/.openclaw/workspace/trading_system_v5_3/logs/state_store.json"
LAST_COUNT=0

echo "🔍 开始监控新交易..."
echo "初始状态：$(cat $STATE_FILE 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("total_trades", 0))' 2>/dev/null || echo 0)"

while true; do
    CURRENT=$(cat $STATE_FILE 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("total_trades", 0))' 2>/dev/null || echo 0)
    
    if [ "$CURRENT" -gt "$LAST_COUNT" ]; then
        echo ""
        echo "🎉 发现新交易！总数：$CURRENT"
        python3 monitor_edge.py
        LAST_COUNT=$CURRENT
    fi
    
    sleep 10
done
