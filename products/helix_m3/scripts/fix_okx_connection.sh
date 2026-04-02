#!/bin/bash
# OKX 连接修复脚本

echo "============================================================"
echo "🔧 OKX 连接修复工具"
echo "============================================================"
echo

# 1. 检查当前代理设置
echo "[1/5] 检查代理设置..."
echo "   https_proxy: $https_proxy"
echo "   http_proxy: $http_proxy"
echo

# 2. 尝试清除代理
echo "[2/5] 清除代理设置..."
export https_proxy=""
export http_proxy=""
export no_proxy=""
echo "   ✅ 代理已清除"
echo

# 3. 刷新 DNS (macOS)
echo "[3/5] 刷新 DNS 缓存..."
sudo dscacheutil -flushcache 2>/dev/null || echo "   ⚠️  需要 sudo 权限"
sudo killall -HUP mDNSResponder 2>/dev/null || echo "   ⚠️  mDNSResponder 刷新失败"
echo "   ✅ DNS 缓存已尝试刷新"
echo

# 4. 测试连接
echo "[4/5] 测试 OKX 连接..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "https://okx.com/api/v5/public/time" 2>&1)
if [ "$RESULT" == "200" ]; then
    echo "   ✅ OKX 连接成功！"
    echo
    echo "[5/5] 运行 M2 Live 验证..."
    /usr/local/bin/python3.14 /Users/colin/.openclaw/workspace/helix_crypto_trading_platform/scripts/m2_live_validation.py
else
    echo "   ❌ OKX 连接失败 (状态码：$RESULT)"
    echo
    echo "建议:"
    echo "  1. 连接手机热点后重试"
    echo "  2. 检查防火墙设置"
    echo "  3. 等待网络恢复"
fi

echo
echo "============================================================"
