#!/bin/bash
# 1000笔样本监控脚本 - 带自动重启

TARGET=1000
LOG_FILE="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/monitor_1000.log"
TRADE_LOG="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/logs/trade_quality_run.log"
SCRIPT_DIR="/Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2"

echo "开始监控: $(date)" > "$LOG_FILE"
echo "目标: $TARGET 笔" >> "$LOG_FILE"

while true; do
    # 检查交易系统是否运行
    if ! pgrep -f "run_v52_live.py" > /dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M')] ⚠️ 交易系统已停止，重启中..." >> "$LOG_FILE"
        cd "$SCRIPT_DIR" && nohup python3 -u run_v52_live.py --testnet --execute > "$TRADE_LOG" 2>&1 &
        sleep 10
    fi
    
    # 获取当前样本数
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
    
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
    echo "[$TIMESTAMP] 完整闭环: $COUNT/$TARGET 笔" >> "$LOG_FILE"
    
    if [ "$COUNT" -ge "$TARGET" ]; then
        echo "" >> "$LOG_FILE"
        echo "✅ 达到目标！生成报告..." >> "$LOG_FILE"
        python3 /Users/colin/.openclaw/workspace/xiaolong_trading_system_4.2/scripts/tail_analysis.py >> "$LOG_FILE" 2>&1
        break
    fi
    
    sleep 180
done

echo "监控完成: $(date)" >> "$LOG_FILE"
