#!/bin/bash
# 运行预检脚本（自动加载实盘配置）

# 加载实盘配置
export OKX_API_KEY="8705ea66-bb2a-4eb3-b58a-768346d83657"
export OKX_API_SECRET="8D2DF7BEA6EA559FE5BD1F36E11C44B1"
export OKX_PASSPHRASE="Xzl405026."
export OKX_TESTNET="false"

echo "🚀 开始预检 (实盘)"
echo "   OKX_TESTNET: false"
echo "   API Key: ${OKX_API_KEY:0:8}..."
echo "   杠杆: 100x"
echo ""

cd ~/.openclaw/workspace/trading_system_v5_4
python3 pre_flight_check.py
