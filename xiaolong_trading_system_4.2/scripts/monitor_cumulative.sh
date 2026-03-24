#!/bin/bash
# 累计统计脚本 - 从当前开始计数

BASE_COUNT=50  # 当前已知基数
TARGET_ADD=950  # 需要新增的数量
LOG_FILE="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/monitor_1000.log"
STATE_FILE="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/cumulative_state.json"

echo "$(date): 开始累计监控，基数=$BASE_COUNT" >> "$LOG_FILE"

LAST_COUNT=50

while true; do
    COUNT=$(python3 << 'PYEOF'
import ccxt, json, os
from datetime import datetime, timedelta

with open(os.path.expanduser('~/.openclaw/secrets/okx_testnet.json')) as f:
    config = json.load(f)['okx']

exchange = ccxt.okx({
    'apiKey': config['api_key'],
    'secret': config['secret_key'],
    'password': config['passphrase'],
    'enableRateLimit': True,
    'options': {'defaultType': 'swap'},
    'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
})
exchange.set_sandbox_mode(True)

orders = exchange.fetch_closed_orders('ETH/USDT:USDT', limit=100)
today = datetime.now().strftime('%Y-%m-%d')
yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
recent = [o for o in orders if today in o['datetime'] or yesterday in o['datetime']]
buys = [o for o in recent if o['side'] == 'buy']
sells = [o for o in recent if o['side'] == 'sell']
print(min(len(buys), len(sells)))
PYEOF
)
    
    # 如果API返回的计数增加了，累加到总数
    if [ "$COUNT" -gt "$LAST_COUNT" ]; then
        DIFF=$((COUNT - LAST_COUNT))
        BASE_COUNT=$((BASE_COUNT + DIFF))
        echo "$(date '+%H:%M'): +$DIFF 笔 → 总计 $BASE_COUNT 笔" >> "$LOG_FILE"
        LAST_COUNT=$COUNT
        
        # 保存状态
        echo "{\"total\": $BASE_COUNT, \"last_api_count\": $COUNT}" > "$STATE_FILE"
    fi
    
    TIMESTAMP=$(date '+%H:%M')
    echo "[$TIMESTAMP] 累计: $BASE_COUNT/1000 笔 (API显示: $COUNT)"
    
    if [ "$BASE_COUNT" -ge 1000 ]; then
        echo "" >> "$LOG_FILE"
        echo "$(date): ✅ 达到 $BASE_COUNT 笔！" >> "$LOG_FILE"
        python3 /Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/scripts/tail_analysis.py >> "$LOG_FILE"
        break
    fi
    
    sleep 180
done
