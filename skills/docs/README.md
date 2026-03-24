# 📚 加密货币交易系统文档

> 完整的文档和使用指南，帮助你从零开始掌握加密货币合约交易

---

## 📖 文档目录

### 🚀 新手入门

| 文档 | 说明 | 阅读时间 |
|------|------|----------|
| [QUICKSTART.md](QUICKSTART.md) | **5 分钟快速上手**，从零配置到第一个信号 | 5 分钟 |
| [API_SETUP.md](API_SETUP.md) | **API 配置详解**，OKX/币安 API 获取步骤 | 10 分钟 |
| [FAQ.md](FAQ.md) | **常见问题解答**，遇到问题先查这里 | 随时查阅 |

### 📈 进阶指南

| 文档 | 说明 | 阅读时间 |
|------|------|----------|
| [STRATEGIES.md](STRATEGIES.md) | **策略配置指南**，5 种策略详解和参数优化 | 15 分钟 |
| [RISK_GUIDE.md](RISK_GUIDE.md) | **风险管理指南**，仓位管理和止损策略 | 15 分钟 |

### 📂 技能文档

| 技能 | 文档 | 功能 |
|------|------|------|
| crypto-data | [SKILL.md](../crypto-data/SKILL.md) | 实时行情数据获取 |
| crypto-ta | [SKILL.md](../crypto-ta/SKILL.md) | 技术指标计算 |
| crypto-signals | [SKILL.md](../crypto-signals/SKILL.md) | 交易信号生成 |
| crypto-risk | [SKILL.md](../crypto-risk/SKILL.md) | 风险管理 |
| crypto-execute | [SKILL.md](../crypto-execute/SKILL.md) | 交易执行 |

---

## 🎯 学习路径

### 新手路线（推荐）

```
Day 1-2: 阅读 QUICKSTART.md → 完成基础配置
Day 3-4: 阅读 API_SETUP.md → 配置测试网 API
Day 5-7: 阅读 STRATEGIES.md → 了解策略原理
Week 2:   测试网模拟交易 → 熟悉流程
Week 3:   阅读 RISK_GUIDE.md → 学习风险管理
Week 4+:  小资金实盘 → 谨慎开始
```

### 快速路线（有经验者）

```
1. QUICKSTART.md → 快速配置
2. STRATEGIES.md → 选择策略
3. RISK_GUIDE.md → 设置风控
4. 测试网验证 → 1-2 周
5. 实盘交易
```

---

## ⚡ 快速命令参考

```bash
# 获取 K 线数据
python3 ~/.openclaw/workspace/skills/crypto-data/scripts/fetch_ohlcv.py \
  --symbol BTC/USDT --timeframe 5m --limit 100

# 计算技术指标
python3 ~/.openclaw/workspace/skills/crypto-ta/scripts/calculate_ta.py \
  --input data.csv --indicators all

# 生成交易信号
python3 ~/.openclaw/workspace/skills/crypto-signals/scripts/monitor.py \
  --symbol BTC/USDT --timeframe 5m --strategy combo

# 计算安全仓位
python3 ~/.openclaw/workspace/skills/crypto-risk/scripts/calculate_position.py \
  --balance 10000 --risk 2 --stop-loss 1.5

# 执行交易（测试网）
python3 ~/.openclaw/workspace/skills/crypto-execute/scripts/trade.py \
  --symbol BTC/USDT --side buy --size 1000 --leverage 10
```

---

## ⚠️ 风险警示

> **加密货币合约交易风险极高，可能导致本金全部损失！**

- 📉 90% 以上的散户亏损
- 📉 高杠杆可能快速爆仓
- 📉 极端行情可能穿仓
- 📉 中国大陆用户注意合规风险

**建议**：
1. 只用测试网练习至少 2 周
2. 实盘从极小资金开始（≤100 USDT）
3. 严格止损，永不扛单
4. 不要借钱交易

---

## 🛠️ 技术支持

### 遇到问题？

1. 先查 [FAQ.md](FAQ.md)
2. 检查错误信息
3. 查看相关技能文档
4. 联系开发者

### 诊断命令

```bash
# 测试数据获取
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m --limit 5

# 测试信号生成
python3 scripts/monitor.py --symbol BTC/USDT --timeframe 5m --strategy combo

# 测试仓位计算
python3 scripts/calculate_position.py --balance 10000 --risk 2 --stop-loss 1.5
```

---

## 📝 更新日志

### 2024-03-11
- ✅ 创建完整文档体系
- ✅ 快速入门指南
- ✅ 策略配置指南
- ✅ 风险管理指南
- ✅ API 配置指南
- ✅ 常见问题 FAQ

---

## 🤝 贡献

欢迎提交问题和改进建议！

---

> 🐉 **龙叔寄语**：市场永远有机会，但本金只有一次。宁可错过，不要做错！

**祝你好运，交易顺利！** 🚀
