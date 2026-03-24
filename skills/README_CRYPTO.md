# 🐉 加密货币合约交易系统 - 安装指南

## 技能清单

已开发完成 5 个核心技能：

| 技能 | 功能 | 状态 |
|------|------|------|
| **crypto-data** | 实时行情数据获取 | ✅ 完成 |
| **crypto-ta** | 技术指标计算 | ✅ 完成 |
| **crypto-signals** | 交易信号生成 | ✅ 完成 |
| **crypto-risk** | 风险管理 | ✅ 完成 |
| **crypto-execute** | 交易执行 | ✅ 完成 |

## 快速安装

### 1. 安装 Python 依赖

```bash
# 核心依赖
pip3 install ccxt pandas pandas-ta numpy

# 可选（回测用）
pip3 install vectorbt backtrader
```

### 2. 配置交易所 API

创建配置文件 `~/.openclaw/workspace/skills/crypto-execute/config.json`:

```json
{
  "exchange": "okx",
  "apiKey": "你的 API Key",
  "secret": "你的 Secret",
  "password": "你的 Passphrase",
  "testnet": true
}
```

**获取 OKX API 密钥**：
1. 访问 https://www.okx.com/
2. 个人中心 → API 管理
3. 创建 API（勾选"读取"和"交易"权限）
4. **重要**：先使用测试网！

### 3. 测试安装

```bash
# 测试数据获取
python3 ~/.openclaw/workspace/skills/crypto-data/scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m

# 测试指标计算
python3 ~/.openclaw/workspace/skills/crypto-ta/scripts/calculate_ta.py --input data.csv --indicators rsi,macd

# 测试信号生成
python3 ~/.openclaw/workspace/skills/crypto-signals/scripts/monitor.py --symbol BTC/USDT --strategy combo

# 测试风险管理
python3 ~/.openclaw/workspace/skills/crypto-risk/scripts/calculate_position.py --balance 10000 --risk 2 --stop-loss 1.5
```

## 使用流程

### 日内交易工作流

```
1. 获取数据 → crypto-data
   python3 fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m --output btc_5m.csv

2. 计算指标 → crypto-ta
   python3 calculate_ta.py --input btc_5m.csv --indicators all

3. 生成信号 → crypto-signals
   python3 monitor.py --symbol BTC/USDT --strategy combo --continuous

4. 风险评估 → crypto-risk
   python3 calculate_position.py --balance 10000 --leverage 10 --stop-loss 1.5

5. 执行交易 → crypto-execute (测试网)
   python3 trade.py --symbol BTC/USDT --side buy --size 1000 --leverage 10 --dry-run
```

### 回测策略

```bash
# 回测双均线策略
python3 backtest.py --symbol BTC/USDT --timeframe 5m --strategy ma_cross --balance 10000

# 回测 RSI 策略
python3 backtest.py --symbol ETH/USDT --timeframe 5m --strategy rsi --leverage 20
```

## 风险提示 ⚠️

**高杠杆交易风险极高**：

- 50 倍杠杆 = 价格波动 2% 爆仓
- 100 倍杠杆 = 价格波动 1% 爆仓
- **90%+ 的散户亏损**

**建议**：

1. **只用测试网** - 先模拟交易 1 个月
2. **低杠杆起步** - ≤10 倍，熟练后再增加
3. **严格止损** - 每笔 ≤2% 本金
4. **不要满仓** - 仓位 ≤30%
5. **遵守法律** - 中国大陆用户注意合规

## 策略建议

### 日内波段（5 分钟）

```
入场条件（combo 策略）:
- RSI < 40 或 > 60
- MACD 金叉/死叉
- 价格 > EMA9 > EMA20 (多头)

出场条件:
- 止损：1.5-2%
- 止盈：3-4% (盈亏比 2:1)
- 追踪止损：1%

杠杆：10-20 倍
```

### 超短线剥头皮（1 分钟）

```
入场条件:
- RSI < 30 或 > 70
- 快速进出

出场条件:
- 止损：0.5-1%
- 止盈：1-2%

杠杆：20-50 倍（高风险）
持仓时间：< 5 分钟
```

## 常见问题

**Q: 数据获取失败？**
A: 检查网络连接，OKX 可能需要代理

**Q: API 认证失败？**
A: 检查 config.json 配置，确认 API 权限

**Q: 回测结果太好？**
A: 回测不等于实盘，注意滑点和手续费

**Q: 信号不准？**
A: 没有 100% 准确的策略，做好风险管理

## 下一步

1. **测试网练习** - 至少 2 周模拟交易
2. **优化策略** - 根据回测调整参数
3. **小资金实盘** - ≤100 USDT 试水
4. **持续学习** - 市场永远在变

---

**祝你好运！记住：活着比赚钱更重要 🐉**
