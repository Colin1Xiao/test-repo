---
name: crypto-execute
description: 加密货币交易执行 - OKX/币安合约下单、撤单、查询仓位。支持测试网模拟交易和实盘交易。
metadata:
  openclaw:
    emoji: ⚡
    version: 1.0.0
    requires:
      bins:
        - python3
        - pip3
      pip:
        - ccxt
    primaryEnv: OKX_API_KEY
---

# Crypto Execute - 交易执行

执行加密货币合约交易，支持测试网和实盘。

## 依赖安装

```bash
pip3 install ccxt
```

## API 配置

在 `~/.openclaw/workspace/skills/crypto-execute/config.json`:

```json
{
  "exchange": "okx",
  "apiKey": "your_api_key",
  "secret": "your_secret",
  "password": "your_passphrase",
  "testnet": true
}
```

**测试网**：OKX 测试网 https://www.okx.com/demo

## 快速开始

### 开仓

```bash
# 做多 BTC
python3 scripts/trade.py --symbol BTC/USDT --side buy --size 1000 --leverage 10

# 做空 ETH
python3 scripts/trade.py --symbol ETH/USDT --side sell --size 500 --leverage 20
```

### 平仓

```bash
# 平掉所有 BTC 仓位
python3 scripts/trade.py --symbol BTC/USDT --close-all

# 平仓 50%
python3 scripts/trade.py --symbol BTC/USDT --close-pct 50
```

### 查询

```bash
# 查询仓位
python3 scripts/trade.py --symbol BTC/USDT --get-position

# 查询余额
python3 scripts/trade.py --get-balance
```

## 订单类型

- **市价单** - 立即成交（默认）
- **限价单** - 指定价格
- **止损单** - 触发后市价单
- **止盈止损** - TP/SL 组合

## 相关文件

- `scripts/trade.py` - 交易执行
- `scripts/position.py` - 仓位管理
- `references/exchange_api.md` - API 文档
