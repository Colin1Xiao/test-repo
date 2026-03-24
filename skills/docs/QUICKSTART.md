# 🚀 快速入门指南 - 5 分钟上手

> 从零基础到第一个交易信号，只需 5 分钟！

## 前置要求

- ✅ Python 3.8+
- ✅ pip3 包管理器
- ✅ 网络连接（访问交易所）

---

## 第一步：安装依赖（1 分钟）

```bash
# 安装核心依赖
pip3 install ccxt pandas pandas-ta numpy
```

---

## 第二步：配置 API（2 分钟）

### 2.1 获取 OKX API 密钥

1. 访问 [OKX 测试网](https://www.okx.com/demo)
2. 注册/登录账号
3. 进入 **个人中心 → API 管理**
4. 创建新 API，勾选权限：
   - ✅ 读取
   - ✅ 交易
5. 保存 API Key、Secret、Passphrase

> ⚠️ **重要**：新手务必使用**测试网**！零风险模拟交易。

### 2.2 创建配置文件

```bash
# 创建配置目录
mkdir -p ~/.openclaw/workspace/skills/crypto-execute

# 创建配置文件
cat > ~/.openclaw/workspace/skills/crypto-execute/config.json << EOF
{
  "exchange": "okx",
  "apiKey": "你的 API Key",
  "secret": "你的 Secret",
  "password": "你的 Passphrase",
  "testnet": true
}
EOF
```

---

## 第三步：测试安装（1 分钟）

```bash
# 测试数据获取
python3 ~/.openclaw/workspace/skills/crypto-data/scripts/fetch_ohlcv.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --limit 10
```

**预期输出**：
```json
{
  "timestamp": 1710172800000,
  "symbol": "BTC/USDT",
  "timeframe": "5m",
  "data": [
    {"timestamp": 1710172800000, "open": 68500, "high": 68550, "low": 68480, "close": 68520, "volume": 125.5}
  ]
}
```

---

## 第四步：获取第一个交易信号（1 分钟）

```bash
# 监控 BTC 5 分钟信号
python3 ~/.openclaw/workspace/skills/crypto-signals/scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy combo
```

**预期输出**：
```json
{
  "timestamp": 1710172800000,
  "symbol": "BTC/USDT",
  "signal": "HOLD",
  "price": 68500,
  "reason": "等待明确信号",
  "confidence": 0.5
}
```

### 信号说明

| 信号 | 含义 | 操作 |
|------|------|------|
| **STRONG_BUY** | 强烈买入 | 考虑开多 |
| **BUY** | 买入 | 可开多 |
| **HOLD** | 持有/观望 | 等待 |
| **SELL** | 卖出 | 可开空 |
| **STRONG_SELL** | 强烈卖出 | 考虑开空 |

---

## 第五步：计算安全仓位（可选）

```bash
# 计算仓位（10000 USDT 本金，2% 风险，1.5% 止损）
python3 ~/.openclaw/workspace/skills/crypto-risk/scripts/calculate_position.py \
  --balance 10000 \
  --risk 2 \
  --stop-loss 1.5
```

**输出示例**：
```
建议仓位：13,333 USDT
最大亏损：200 USDT (2%)
止损价格：67,472.5 USDT
```

---

## 下一步

恭喜你！已经完成基础配置。接下来：

1. 📚 阅读 [STRATEGIES.md](STRATEGIES.md) 了解策略配置
2. 🛡️ 阅读 [RISK_GUIDE.md](RISK_GUIDE.md) 学习风险管理
3. 🔧 阅读 [API_SETUP.md](API_SETUP.md) 详细配置 API
4. ❓ 遇到问题？查看 [FAQ.md](FAQ.md)

---

## 快速命令参考

```bash
# 获取 K 线数据
python3 ~/.openclaw/workspace/skills/crypto-data/scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m

# 计算技术指标
python3 ~/.openclaw/workspace/skills/crypto-ta/scripts/calculate_ta.py --input data.csv --indicators all

# 生成交易信号
python3 ~/.openclaw/workspace/skills/crypto-signals/scripts/monitor.py --symbol BTC/USDT --strategy combo

# 计算仓位
python3 ~/.openclaw/workspace/skills/crypto-risk/scripts/calculate_position.py --balance 10000 --risk 2 --stop-loss 1.5

# 执行交易（测试网）
python3 ~/.openclaw/workspace/skills/crypto-execute/scripts/trade.py --symbol BTC/USDT --side buy --size 1000 --leverage 10
```

---

> 💡 **提示**：始终先在测试网练习，熟练后再考虑实盘！
