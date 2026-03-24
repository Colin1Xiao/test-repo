---
name: crypto-data
description: 加密货币实时行情数据获取 - K 线、订单簿、 ticker、资金费率。支持币安、OKX 等交易所。使用 ccxt 库获取公开市场数据。
metadata:
  openclaw:
    emoji: 📊
    version: 1.0.0
    requires:
      bins:
        - python3
        - pip3
      pip:
        - ccxt
        - pandas
    primaryEnv: OKX_API_KEY
---

# Crypto Data - 加密货币行情数据获取

获取实时加密货币市场数据，支持日内高频交易所需的低延迟数据流。

## 依赖安装

```bash
pip3 install ccxt pandas asyncio
```

## 快速开始

### 获取 K 线数据

```bash
# 获取 BTC/USDT 1 分钟 K 线（最近 100 根）
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 1m --limit 100

# 获取 5 分钟 K 线
python3 scripts/fetch_ohlcv.py --symbol ETH/USDT --timeframe 5m --limit 500

# 导出为 CSV
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 1m --output ./data/btc_1m.csv
```

### 获取实时订单簿

```bash
# 获取订单簿深度
python3 scripts/fetch_orderbook.py --symbol BTC/USDT --depth 20
```

### 获取资金费率

```bash
# 获取当前资金费率
python3 scripts/fetch_funding.py --symbol BTC/USDT
```

## 支持的时间框架

- `1m` - 1 分钟（日内高频）
- `5m` - 5 分钟（日内波段）
- `15m` - 15 分钟
- `1h` - 1 小时
- `4h` - 4 小时
- `1d` - 1 天

## 支持的交易所

- OKX（推荐，大陆友好）
- Binance
- Bybit
- Gate.io

## API 配置

在 `~/.openclaw/workspace/skills/crypto-data/config.json` 配置：

```json
{
  "exchange": "okx",
  "apiKey": "your_api_key",
  "secret": "your_secret",
  "password": "your_passphrase",
  "testnet": true
}
```

**测试网模式**：设置 `"testnet": true` 使用 OKX 模拟交易，零风险。

## 输出格式

所有脚本输出标准 JSON 格式：

```json
{
  "timestamp": 1710172800000,
  "symbol": "BTC/USDT",
  "timeframe": "1m",
  "data": [
    {"timestamp": 1710172800000, "open": 68500, "high": 68550, "low": 68480, "close": 68520, "volume": 125.5}
  ]
}
```

## 速率限制

- OKX 公共接口：~10 次/秒
- 建议添加缓存避免频繁请求
- 生产环境考虑 WebSocket 订阅

## 错误处理

所有脚本包含重试逻辑：
- 网络错误自动重试 3 次
- 速率限制等待后重试
- 失败时输出详细错误信息

## 相关文件

- `scripts/fetch_ohlcv.py` - K 线数据获取
- `scripts/fetch_orderbook.py` - 订单簿获取
- `scripts/fetch_funding.py` - 资金费率获取
- `references/exchange_api.md` - 交易所 API 文档摘要
