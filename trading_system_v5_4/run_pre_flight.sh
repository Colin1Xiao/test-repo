#!/bin/bash
# 运行预检脚本（自动加载测试网配置）

# 加载测试网配置
export OKX_API_KEY="2b3952f8-6538-48a4-a65a-4e219b61d6f5"
export OKX_API_SECRET="279DFFAE2F9F695C07A0D484FD414620"
export OKX_PASSPHRASE="Xzl405026."
export OKX_TESTNET="true"

# 确保清除可能的旧配置
unset OKX_API_KEY OKX_API_SECRET OKX_PASSPHRASE OKX_TESTNET

# 重新设置（确保覆盖）
export OKX_API_KEY="2b3952f8-6538-48a4-a65a-4e219b61d6f5"
export OKX_API_SECRET="279DFFAE2F9F695C07A0D484FD414620"
export OKX_PASSPHRASE="Xzl405026."
export OKX_TESTNET="true"

echo "🚀 开始预检 (测试网)"
echo "   OKX_TESTNET: true"
echo "   API Key: ${OKX_API_KEY:0:8}..."
echo ""

cd ~/.openclaw/workspace/trading_system_v5_4
python3 pre_flight_check.py
