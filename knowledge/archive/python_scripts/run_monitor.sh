#!/bin/bash
# 实盘监控运行脚本

cd /Users/colin/.openclaw/workspace

# 加载代理
source ~/.zshrc

echo "======================================"
echo "🤖 小龙智能交易系统 v2.0"
echo "======================================"
echo ""
echo "📋 系统状态"
echo "----------------------------------------------------------------------"
echo "代理配置：$https_proxy"
echo "交易模式：实盘 ⚠️"
echo "启动时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查市场状态
echo "📊 当前市场"
echo "----------------------------------------------------------------------"
python3 -c "
import ccxt, os
ex = ccxt.okx({'httpsProxy': os.getenv('https_proxy')})
t = ex.fetch_ticker('BTC/USDT')
print(f'BTC 价格：\${t[\"last\"]:,.2f}')
print(f'24h 变化：{t[\"percentage\"]:+.2f}%')
"
echo ""

# 启动监控
echo "🚀 启动实时监控..."
echo "----------------------------------------------------------------------"
echo ""
python3 auto_monitor_v2.py
