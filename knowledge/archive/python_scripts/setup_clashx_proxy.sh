#!/bin/bash
# ClashX 代理配置脚本
# 自动配置交易系统使用 ClashX 代理

echo "======================================"
echo "🔧 ClashX 代理配置"
echo "======================================"

# ClashX 默认端口
CLASH_PORT=7890
CLASH_SOCKS_PORT=7891

# 检测 ClashX 是否运行
echo -e "\n📋 检测 ClashX..."
if pgrep -x "ClashX" > /dev/null; then
    echo "✅ ClashX 正在运行"
else
    echo "⚠️  ClashX 未运行，请启动 ClashX"
    echo "   打开 /Applications/ClashX.app"
    exit 1
fi

# 测试代理连通性
echo -e "\n🧪 测试代理端口 $CLASH_PORT..."
if nc -z 127.0.0.1 $CLASH_PORT 2>/dev/null; then
    echo "✅ 代理端口 $CLASH_PORT 可用"
else
    echo "⚠️  端口 $CLASH_PORT 不可用，尝试 7891..."
    CLASH_PORT=7891
    if nc -z 127.0.0.1 $CLASH_PORT 2>/dev/null; then
        echo "✅ 使用 SOCKS 代理端口 $CLASH_PORT"
    else
        echo "❌ 无法连接到 ClashX 代理"
        exit 1
    fi
fi

# 配置环境变量
echo -e "\n⚙️  配置环境变量..."

# 添加到 ~/.zshrc
ZSHRC=~/.zshrc
if ! grep -q "ClashX 代理配置" $ZSHRC 2>/dev/null; then
    cat >> $ZSHRC << 'EOF'

# ClashX 代理配置 (自动添加)
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890
export all_proxy=socks5://127.0.0.1:7891
export no_proxy="localhost,127.0.0.1,.local,.lan,okx.com,binance.com"

# 代理切换函数
proxy_on() { export https_proxy=http://127.0.0.1:7890; export http_proxy=http://127.0.0.1:7890; echo "✅ 代理已开启"; }
proxy_off() { unset https_proxy; unset http_proxy; unset all_proxy; echo "❌ 代理已关闭"; }
proxy_status() { if [ -n "$https_proxy" ]; then echo "✅ 代理已开启：$https_proxy"; else echo "❌ 代理已关闭"; fi; }
EOF
    echo "✅ 已添加到 ~/.zshrc"
else
    echo "✅ ~/.zshrc 已包含代理配置"
fi

# 立即生效
source $ZSHRC
echo "✅ 环境变量已生效"

# 测试代理
echo -e "\n📊 测试代理..."
echo "   当前代理：$https_proxy"

# 测试恐惧贪婪指数
echo -e "\n📈 测试 Alternative.me (恐惧贪婪指数)..."
FNG=$(curl -x "http://127.0.0.1:$CLASH_PORT" -s --connect-timeout 10 \
  "https://api.alternative.me/fng/" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d['data'][0]['value']} ({d['data'][0]['value_classification']})\")" 2>/dev/null)

if [ -n "$FNG" ]; then
    echo "   ✅ 成功：恐惧贪婪指数 = $FNG"
else
    echo "   ⚠️  获取失败，可能需检查 ClashX 规则"
fi

# 创建项目代理配置
echo -e "\n⚙️  创建项目代理配置..."
PROXY_CONFIG="workspace/proxy_config.json"
cat > $PROXY_CONFIG << EOF
{
  "proxy": {
    "enabled": true,
    "type": "clashx",
    "http": "http://127.0.0.1:7890",
    "https": "http://127.0.0.1:7890",
    "socks5": "socks5://127.0.0.1:7891",
    "no_proxy": [
      "localhost",
      "127.0.0.1",
      ".local",
      ".lan",
      "okx.com",
      "binance.com"
    ]
  },
  "auto_detect": true,
  "verify_ssl": false
}
EOF
echo "✅ 已创建 $PROXY_CONFIG"

echo -e "\n======================================"
echo "🎉 配置完成！"
echo "======================================"
echo ""
echo "使用命令:"
echo "  proxy_status   - 查看代理状态"
echo "  proxy_on       - 开启代理"
echo "  proxy_off      - 关闭代理"
echo ""
echo "启动监控:"
echo "  cd /Users/colin/.openclaw/workspace"
echo "  python3 auto_monitor.py"
echo ""
echo "======================================"
