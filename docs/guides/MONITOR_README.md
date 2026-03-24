# 🖥️ 自动监控系统使用指南

> 7×24 小时不间断监控，捕捉每个交易机会

---

## 🚀 快速开始

### 1. 基础监控

```bash
# 启动监控（默认 BTC/ETH/SOL）
python3 auto_monitor.py

# 指定币种
python3 auto_monitor.py --symbols BTC/USDT,ETH/USDT

# 指定检查间隔
python3 auto_monitor.py --interval 60

# 禁用声音
python3 auto_monitor.py --no-sound
```

### 2. 使用配置文件

```bash
# 创建配置文件
cp monitor_config.yaml my_config.yaml

# 编辑配置
nano my_config.yaml

# 使用配置启动
python3 auto_monitor.py --config my_config.yaml
```

### 3. 后台运行

```bash
# 使用 nohup
nohup python3 auto_monitor.py > monitor.log 2>&1 &

# 查看日志
tail -f monitor.log

# 停止监控
pkill -f auto_monitor.py

# 使用 screen
screen -S crypto_monitor
python3 auto_monitor.py
# Ctrl+A, D 脱离

# 恢复
screen -r crypto_monitor
```

---

## 📊 监控仪表板

### 启动仪表板

```bash
python3 dashboard.py
```

### 快捷键

| 按键 | 功能 |
|------|------|
| Q | 退出 |
| R | 刷新 |
| S | 保存快照 |

### 界面说明

```
╔══════════════════════════════════════════════╗
║       🤖 加密货币自动监控系统                 ║
║       2026-03-11 21:23:45                    ║
╠══════════════════════════════════════════════╣
║  BTC/USDT  $68,523  [+1.2%]                  ║
║  技术分：0.85  │  预测分：0.72  │  综合：0.79║
║  CSI: 45  │  ML: 看涨 65%  │  状态：趋势市  ║
╚══════════════════════════════════════════════╝
```

---

## 🔔 告警说明

### 告警级别

| 级别 | 说明 | 声音 |
|------|------|------|
| 🚨 CRITICAL | 红色风险、情绪极端 | ✅ |
| ⚠️ WARNING | 技术信号、ML 预测 | ✅ |
| ℹ️ INFO | 日常更新 | ❌ |

### 告警类型

| 类型 | 说明 | 示例 |
|------|------|------|
| TECHNICAL | 技术面信号 | 放量上涨、EMA 金叉 |
| SENTIMENT | 情绪极端 | CSI<20 或>80 |
| ML_PREDICTION | ML 预测 | 看涨/看跌预测 |
| MACRO_EVENT | 宏观事件 | 美联储决议 |
| MARKET_STATE | 状态转换 | 震荡→趋势 |

### 告警日志

告警记录保存在：`monitor_alerts.log`

```bash
# 查看最新告警
tail -20 monitor_alerts.log

# 搜索特定告警
grep "BTC" monitor_alerts.log
```

---

## ⚙️ 配置说明

### 基础配置

```yaml
check_interval: 30              # 检查间隔（秒）
price_alert_threshold: 0.02     # 价格告警阈值（2%）
volume_alert_threshold: 1.5     # 成交量告警阈值（1.5 倍）
csi_extreme_low: 20             # 极度恐惧阈值
csi_extreme_high: 80            # 极度贪婪阈值
ml_confidence_threshold: 0.8    # ML 置信度阈值
```

### 告警配置

```yaml
enable_telegram: false          # Telegram 告警
enable_email: false             # 邮件告警
enable_sound: true              # 声音告警
enable_push: false              # Push 推送

alert_cooldown: 300             # 冷却时间（秒）
max_alerts_per_hour: 20         # 每小时最多告警数
```

### Telegram 配置

1. 创建 Telegram Bot
   - 联系 @BotFather
   - 发送 `/newbot`
   - 获取 bot_token

2. 获取 chat_id
   - 联系 @userinfobot
   - 发送任意消息
   - 获取 chat_id

3. 配置
```yaml
enable_telegram: true
telegram:
  bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
  chat_id: "123456789"
```

---

## 📋 监控场景

### 场景 1: 技术面买入

```
📈 [BTC/USDT 技术面买入信号]
量价评分：4
原因：放量上涨 + EMA 多头 + RSI 超卖
置信度：85%
建议：50% 仓位，10x 杠杆
```

### 场景 2: 情绪极端

```
😨 [市场极度恐惧]
CSI 指数：18
历史统计：见底概率 85%
建议：准备买入，分批建仓
```

### 场景 3: 宏观事件

```
🚨 [红色风险事件]
事件：美联储利率决议
时间：2 小时后
影响分数：14.0
操作：停止开仓，降低仓位至 20%
```

---

## 🔧 故障排查

### 问题 1: 无法获取数据

```bash
# 检查网络
ping okx.com

# 检查代理
export https_proxy=http://127.0.0.1:7890

# 测试 API
python3 -c "import ccxt; print(ccxt.okx().fetch_ticker('BTC/USDT'))"
```

### 问题 2: 声音告警不响

```bash
# macOS 测试
afplay /System/Library/Sounds/Glass.aiff

# Linux 测试
paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga

# Windows 测试
python3 -c "import winsound; winsound.Beep(1000, 500)"
```

### 问题 3: 告警过多

```yaml
# 增加冷却时间
alert_cooldown: 600  # 10 分钟

# 减少每小时告警数
max_alerts_per_hour: 10
```

---

## 📊 性能监控

### 查看监控状态

```bash
# 查看进程
ps aux | grep auto_monitor

# 查看资源使用
top -pid $(pgrep -f auto_monitor)

# 查看日志
tail -f monitor.log
```

### 生成日报

```bash
# 统计今日告警
grep "$(date +%Y-%m-%d)" monitor_alerts.log | wc -l

# 导出今日告警
grep "$(date +%Y-%m-%d)" monitor_alerts.log > today_alerts.txt
```

---

## 🎯 最佳实践

### 1. 多币种监控

```bash
# 监控主流币种
python3 auto_monitor.py --symbols BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,ADA/USDT

# 监控小币种（更高风险）
python3 auto_monitor.py --symbols DOGE/USDT,SHIB/USDT,PEPE/USDT --interval 60
```

### 2. 分级告警

```yaml
# 重要币种更频繁检查
symbols:
  - symbol: BTC/USDT
    interval: 30
  - symbol: ETH/USDT
    interval: 30
  - symbol: SOL/USDT
    interval: 60
```

### 3. 安静时段

```yaml
# 夜间降低频率
quiet_hours:
  start: "02:00"
  end: "08:00"
  interval: 300  # 5 分钟检查一次
```

---

## 📁 文件清单

| 文件 | 说明 |
|------|------|
| `auto_monitor.py` | 主监控引擎 |
| `dashboard.py` | 监控仪表板 |
| `monitor_config.yaml` | 配置文件模板 |
| `MONITOR_README.md` | 本文档 |
| `monitor_alerts.log` | 告警日志 |

---

## ⚠️ 注意事项

1. **网络要求**: 需要稳定网络连接
2. **API 限制**: 注意交易所 API 速率限制
3. **资源占用**: 后台运行注意内存占用
4. **告警疲劳**: 合理设置阈值避免告警过多
5. **定期更新**: 定期检查系统更新

---

**监控系统已就绪！开始 7×24 小时守护你的交易！** 🖥️🐉
