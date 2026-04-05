#!/bin/bash
# VPS 部署检查脚本

echo "=========================================="
echo "🔍 VPS 网络检查"
echo "=========================================="

# 1. 检查系统
echo ""
echo "📋 1. 系统信息:"
uname -a
cat /etc/os-release 2>/dev/null | grep PRETTY_NAME || echo "Unknown OS"

# 2. 检查 Python
echo ""
echo "📋 2. Python 版本:"
python3 --version

# 3. 测试网络连通性
echo ""
echo "📋 3. 网络连通性测试:"
echo "   测试 OKX API..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://www.okx.com | grep -q "200\|301\|302"; then
    echo "   ✅ OKX API 可访问"
else
    echo "   ❌ OKX API 不可访问"
fi

# 4. 测试 DNS 解析
echo ""
echo "📋 4. DNS 解析测试:"
if nslookup ws.okx.com > /dev/null 2>&1; then
    echo "   ✅ DNS 解析正常"
    nslookup ws.okx.com | grep Address | tail -1
else
    echo "   ❌ DNS 解析失败"
fi

# 5. 测试 WebSocket 连接
echo ""
echo "📋 5. WebSocket 连接测试:"
python3 << 'PYEOF'
import asyncio
import sys

async def test_ws():
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                "wss://ws.okx.com:8443/ws/v5/public",
                timeout=aiohttp.ClientTimeout(total=10)
            ) as ws:
                print("   ✅ WebSocket 连接成功")
                return True
    except Exception as e:
        print(f"   ❌ WebSocket 连接失败: {e}")
        return False

result = asyncio.run(test_ws())
sys.exit(0 if result else 1)
PYEOF

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ VPS 网络检查通过"
    echo "   可以部署 Price Server"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "❌ VPS 网络检查失败"
    echo "   建议："
    echo "   1. 更换 VPS 地区（新加坡优先）"
    echo "   2. 或在 VPS 上配置代理"
    echo "=========================================="
fi