# ❓ 常见问题解答 (FAQ)

> 遇到问题？先看看这里有没有答案！

---

## 📋 目录

1. [安装配置问题](#安装配置问题)
2. [数据获取问题](#数据获取问题)
3. [信号生成问题](#信号生成问题)
4. [交易执行问题](#交易执行问题)
5. [风险管理问题](#风险管理问题)
6. [策略相关问题](#策略相关问题)
7. [其他问题](#其他问题)

---

## 安装配置问题

### Q1: Python 版本要求？

**A**: 需要 Python 3.8 或更高版本。

```bash
# 检查 Python 版本
python3 --version

# 如果版本过低，使用 pyenv 安装
brew install pyenv
pyenv install 3.11.0
pyenv global 3.11.0
```

### Q2: 依赖安装失败？

**A**: 常见原因和解决方案：

```bash
# 问题 1: pip3 未安装
brew install python3

# 问题 2: 权限问题
pip3 install --user ccxt pandas pandas-ta

# 问题 3: 网络问题（使用国内镜像）
pip3 install -i https://pypi.tuna.tsinghua.edu.cn/simple ccxt pandas pandas-ta

# 问题 4: 依赖冲突
pip3 install --upgrade pip
pip3 install ccxt pandas pandas-ta numpy --force-reinstall
```

### Q3: 配置文件在哪里？

**A**: 配置文件位置：

```
~/.openclaw/workspace/skills/crypto-execute/config.json
```

创建方法：
```bash
mkdir -p ~/.openclaw/workspace/skills/crypto-execute
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

### Q4: API 认证失败？

**A**: 检查以下几点：

1. **配置文件格式** - 确保是有效的 JSON
2. **API 权限** - 确认勾选了"读取"和"交易"
3. **测试网模式** - 新手务必设置 `"testnet": true`
4. **IP 白名单** - OKX 可能需要配置 IP 白名单

```json
// 正确的配置格式
{
  "exchange": "okx",
  "apiKey": "abc123...",
  "secret": "xyz789...",
  "password": "your_passphrase",
  "testnet": true
}
```

---

## 数据获取问题

### Q5: 数据获取失败/超时？

**A**: 可能是网络问题。

```bash
# 测试网络连接
ping www.okx.com

# 使用代理（如果需要）
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 重试命令
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m
```

### Q6: 获取的数据不完整？

**A**: 检查 `limit` 参数。

```bash
# 默认获取 100 根 K 线
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m

# 获取 500 根 K 线
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m --limit 500
```

### Q7: 数据延迟怎么办？

**A**: 
- 公共 API 有速率限制（约 10 次/秒）
- 建议添加缓存机制
- 生产环境考虑 WebSocket 订阅

---

## 信号生成问题

### Q8: 一直显示 HOLD 信号？

**A**: 这是正常的！

- 市场大部分时间处于震荡
- 策略在等待明确的入场信号
- **宁可错过，不要做错**

建议：
- 检查时间框架是否合适（5m 比 1m 信号更可靠）
- 尝试 `combo` 策略（信号更准确）
- 多监控几个币种

### Q9: 信号不准确/反向？

**A**: 没有 100% 准确的策略！

- 所有策略都有胜率上限（通常 55-65%）
- 关键是**风险管理**，不是信号准确率
- 做好止损，小亏大赚

建议：
- 回测验证策略
- 调整参数优化
- 严格止损

### Q10: 如何同时监控多个币种？

**A**: 使用 `--symbols` 参数。

```bash
# 监控多个币种
python3 scripts/monitor.py \
  --symbols BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT \
  --timeframe 5m \
  --strategy combo
```

---

## 交易执行问题

### Q11: 下单失败？

**A**: 常见原因：

1. **余额不足** - 检查账户余额
2. **最小订单量** - OKX 有最小下单限制（通常 5 USDT）
3. **杠杆过高** - 保证金不足
4. **API 权限** - 确认有交易权限

```bash
# 查询余额
python3 scripts/trade.py --get-balance

# 查询仓位
python3 scripts/trade.py --symbol BTC/USDT --get-position
```

### Q12: 订单无法成交？

**A**: 
- **市价单** - 应该立即成交，不成交检查流动性
- **限价单** - 价格可能未达到设定值

建议：
- 使用市价单确保成交
- 检查订单簿深度

### Q13: 如何平仓？

**A**: 

```bash
# 平掉所有仓位
python3 scripts/trade.py --symbol BTC/USDT --close-all

# 平仓 50%
python3 scripts/trade.py --symbol BTC/USDT --close-pct 50

# 反向开仓（自动平仓）
python3 scripts/trade.py --symbol BTC/USDT --side sell --size 1000
```

### Q14: 测试网和实盘的区别？

**A**:

| 项目 | 测试网 | 实盘 |
|------|--------|------|
| 资金 | 虚拟资金 | 真实资金 |
| 风险 | 零风险 | 可能亏损 |
| 流动性 | 可能不同 | 真实流动性 |
| 建议 | 新手必用 | 熟练后用 |

**测试网配置**：
```json
{
  "testnet": true
}
```

---

## 风险管理问题

### Q15: 仓位大小如何计算？

**A**: 使用仓位计算器。

```bash
python3 scripts/calculate_position.py \
  --balance 10000 \
  --risk 2 \
  --stop-loss 1.5
```

公式：`仓位 = (本金 × 风险%) ÷ 止损%`

### Q16: 止损应该设多少？

**A**: 根据时间框架：

| 时间框架 | 建议止损 |
|----------|----------|
| 1m | 0.5-1% |
| 5m | 1.5-2% |
| 15m+ | 2-3% |

### Q17: 杠杆应该用多少？

**A**: 

| 经验水平 | 建议杠杆 |
|----------|----------|
| 新手 | 5-10x |
| 有经验 | 10-20x |
| 专业 | 20-50x |

**警告**：超过 50x 基本是赌博！

### Q18: 连续亏损怎么办？

**A**: 

1. **立即停止交易** - 达到日亏损上限（5-8%）
2. **休息** - 至少 30 分钟
3. **复盘** - 找出问题
4. **降低仓位** - 下次交易减半

---

## 策略相关问题

### Q19: 哪个策略最好？

**A**: 没有最好的策略，只有最适合的。

- **新手**：`combo` 策略（综合指标，信号准确）
- **震荡市**：`rsi` 策略
- **趋势市**：`ma_cross` 或 `macd`
- **超短线**：`scalp`（高风险）

建议：先用 `combo` 策略熟悉流程。

### Q20: 策略参数需要调整吗？

**A**: 

- **初期**：使用默认参数
- **1 周后**：根据交易记录微调
- **避免**：频繁调整（容易过度拟合）

### Q21: 如何回测策略？

**A**: 

```bash
python3 scripts/backtest.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy combo \
  --balance 10000 \
  --days 30
```

**注意**：回测结果≠实盘表现！

### Q22: 回测赚钱，实盘亏钱？

**A**: 这是正常的！原因：

- 回测不考虑滑点
- 回测不考虑手续费
- 回测是"上帝视角"
- 实盘有情绪影响

**建议**：回测后，先用测试网实盘验证 2 周。

---

## 其他问题

### Q23: 支持哪些交易所？

**A**: 

- ✅ OKX（推荐，大陆友好）
- ✅ Binance
- ✅ Bybit
- ✅ Gate.io

### Q24: 支持哪些币种？

**A**: 所有主流币种：

- BTC/USDT
- ETH/USDT
- SOL/USDT
- BNB/USDT
- 以及 OKX 支持的所有合约币种

### Q25: 可以 24 小时运行吗？

**A**: 可以，使用持续监控模式。

```bash
# 持续监控（每 30 秒检查一次）
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --interval 30 \
  --continuous
```

**注意**：需要保持电脑/服务器运行。

### Q26: 有手机 APP 吗？

**A**: 目前没有独立的手机 APP。

- 可以在手机上运行 Python 脚本（需要配置环境）
- 或者使用 OKX 官方 APP 手动交易
- 信号可以通过 Telegram 推送（需自行配置）

### Q27: 收费吗？

**A**: 

- 本工具**完全免费**（开源）
- 交易所收取手续费（通常 0.02-0.05%）
- 需要自备 API 密钥

### Q28: 安全吗？会盗取 API 密钥吗？

**A**: 

- 代码完全开源，可自行审查
- API 密钥只存储在本地配置文件
- 不会上传到任何服务器
- 建议设置 API IP 白名单

### Q29: 中国大陆用户可以使用吗？

**A**: 

- 技术上可以使用
- **但需注意合规风险**
- OKX 已退出中国大陆市场
- 请自行评估风险

### Q30: 遇到问题如何求助？

**A**: 

1. 先查看本 FAQ
2. 检查错误信息
3. 查看相关文档
4. 如仍无法解决，联系开发者

---

## 🔧 错误排查清单

遇到问题时，按顺序检查：

```
1. Python 版本是否正确？ → python3 --version
2. 依赖是否安装？ → pip3 list | grep -E "ccxt|pandas"
3. 配置文件是否存在？ → cat ~/.openclaw/workspace/skills/crypto-execute/config.json
4. API 密钥是否正确？ → 登录交易所验证
5. 网络是否通畅？ → ping www.okx.com
6. 是否在测试网模式？ → 检查 config.json 中 testnet 字段
7. 余额是否充足？ → python3 scripts/trade.py --get-balance
```

---

## 📞 快速诊断命令

```bash
# 1. 测试数据获取
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m --limit 5

# 2. 测试指标计算
echo "timestamp,open,high,low,close,volume" > /tmp/test.csv
echo "1710172800000,68500,68550,68480,68520,125.5" >> /tmp/test.csv
python3 scripts/calculate_ta.py --input /tmp/test.csv --indicators rsi

# 3. 测试信号生成
python3 scripts/monitor.py --symbol BTC/USDT --timeframe 5m --strategy combo

# 4. 测试仓位计算
python3 scripts/calculate_position.py --balance 10000 --risk 2 --stop-loss 1.5

# 5. 测试交易执行（干跑模式）
python3 scripts/trade.py --symbol BTC/USDT --side buy --size 100 --dry-run
```

---

> 💡 **提示**：如果以上命令都正常，但仍有问题，请记录完整的错误信息并联系开发者。
