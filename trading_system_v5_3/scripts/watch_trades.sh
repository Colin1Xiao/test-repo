#!/bin/bash
# 实时监控交易数量

LOG_FILE="/Users/colin/.openclaw/workspace/trading_system_v5_3/logs/system_state.jsonl"

echo "🐉 小龙交易系统 V5.3 - 实时监控"
echo "================================"
echo ""

while true; do
    if [ -f "$LOG_FILE" ]; then
        LAST_LINE=$(tail -1 "$LOG_FILE" 2>/dev/null)
        if [ -n "$LAST_LINE" ]; then
            echo "$LAST_LINE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"\r⏰ {d.get('timestamp', 'N/A')[-8:]} | 📈 交易: {d.get('total_trades', 0):4d} | 🎯 评分: {d.get('score', 0):2d} | 📊 成交量: {d.get('volume_ratio', 0):.2f}x | 🛡️ {d.get('guardian_decision', 'unknown')[:8]:8s}\", end='')
"
        fi
    fi
    sleep 2
done