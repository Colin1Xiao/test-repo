# OKX API 代理配置
# 用于解决 DNS 污染问题，确保交易系统稳定连接
# 最后更新：2026-04-03

# ClashX 代理配置 (默认)
export OKX_PROXY_HTTP="http://127.0.0.1:7890"
export OKX_PROXY_HTTPS="http://127.0.0.1:7890"
export OKX_PROXY_SOCKS5="socks5://127.0.0.1:7891"

# OKX API 端点配置
export OKX_API_BASE="https://www.okx.com"
export OKX_API_WS="wss://ws.okx.com:8443/ws/v5"

# 备用端点 (主端点失败时使用)
export OKX_API_BASE_BACKUP="https://okx.com"

# 连接超时配置 (秒)
export OKX_CONNECT_TIMEOUT=5
export OKX_READ_TIMEOUT=10

# 重试配置
export OKX_MAX_RETRIES=3
export OKX_RETRY_DELAY=1

# 使用代理：true = 始终使用代理，false = 直连
export OKX_USE_PROXY=true

# 加载代理配置函数
load_okx_proxy() {
    if [ "$OKX_USE_PROXY" = "true" ]; then
        export http_proxy="$OKX_PROXY_HTTP"
        export https_proxy="$OKX_PROXY_HTTPS"
        export all_proxy="$OKX_PROXY_SOCKS5"
        echo "✅ OKX 代理已启用：$OKX_PROXY_HTTP"
    else
        unset http_proxy https_proxy all_proxy
        echo "❌ OKX 直连模式"
    fi
}

# 测试 OKX 连接函数
test_okx_connection() {
    echo "正在测试 OKX 连接..."
    local response=$(curl -x "$OKX_PROXY_HTTP" -s --max-time "$OKX_CONNECT_TIMEOUT" \
        "$OKX_API_BASE/api/v5/public/time" 2>&1)
    
    if echo "$response" | grep -q '"code":"0"'; then
        local ts=$(echo "$response" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4)
        echo "✅ OKX 连接成功 - 服务器时间：$ts"
        return 0
    else
        echo "❌ OKX 连接失败：$response"
        return 1
    fi
}

# 自动加载代理
load_okx_proxy
