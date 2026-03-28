#!/bin/bash
# 网络问题修复脚本

echo "======================================"
echo "🔧 OKX 网络连接修复"
echo "======================================"

# 1. 检查 ClashX
echo -e "\n📋 检查 ClashX..."
if pgrep -x "ClashX" > /dev/null; then
    echo "   ✅ ClashX 正在运行"
    CLASH_PORT=7890
else
    echo "   ⚠️  ClashX 未运行"
    echo "   请打开 /Applications/ClashX.app"
    exit 1
fi

# 2. 测试代理端口
echo -e "\n🧪 测试代理端口 $CLASH_PORT..."
if nc -z 127.0.0.1 $CLASH_PORT 2>/dev/null; then
    echo "   ✅ 代理端口 $CLASH_PORT 可用"
else
    echo "   ❌ 端口 $CLASH_PORT 不可用"
    exit 1
fi

# 3. 设置环境变量
echo -e "\n⚙️  设置环境变量..."
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890
export all_proxy=socks5://127.0.0.1:7891

echo "   https_proxy=$https_proxy"
echo "   http_proxy=$http_proxy"

# 4. 测试 OKX 连接
echo -e "\n📊 测试 OKX 连接..."
if curl -x "$https_proxy" -s --connect-timeout 10 https://www.okx.com > /dev/null 2>&1; then
    echo "   ✅ OKX 可访问"
else
    echo "   ⚠️  OKX 访问失败，尝试备用代理..."
    # 尝试其他常见端口
    for port in 7890 7891 1080 1081; do
        if curl -x "http://127.0.0.1:$port" -s --connect-timeout 5 https://www.okx.com > /dev/null 2>&1; then
            echo "   ✅ 端口 $port 可用"
            export https_proxy=http://127.0.0.1:$port
            export http_proxy=http://127.0.0.1:$port
            break
        fi
    done
fi

# 5. 添加到 zshrc
echo -e "\n💾 保存代理配置..."
if ! grep -q "export https_proxy=http://127.0.0.1:7890" ~/.zshrc 2>/dev/null; then
    cat >> ~/.zshrc << 'EOF'

# OKX 交易代理配置
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890
export all_proxy=socks5://127.0.0.1:7891
EOF
    echo "   ✅ 已添加到 ~/.zshrc"
else
    echo "   ✅ ~/.zshrc 已包含代理配置"
fi

# 6. 测试 API 连接
echo -e "\n🧪 测试 OKX API..."
cd /Users/colin/.openclaw/workspace
python3 -c "
import ccxt
import os

proxy = os.getenv('https_proxy', 'http://127.0.0.1:7890')
print(f'   使用代理：{proxy}')

exchange = ccxt.okx({
    'enableRateLimit': True,
    'httpsProxy': proxy,
})

try:
    ticker = exchange.fetch_ticker('BTC/USDT')
    print(f'   ✅ API 连接成功')
    print(f'   BTC 价格：\${ticker[\"last\"]:,.2f}')
except Exception as e:
    print(f'   ❌ API 连接失败：{e}')
"

echo -e "\n======================================"
echo "✅ 网络配置完成！"
echo "======================================"
echo ""
echo "使用命令:"
echo "   source ~/.zshrc"
echo "   python3 auto_monitor_v2.py"
echo ""
