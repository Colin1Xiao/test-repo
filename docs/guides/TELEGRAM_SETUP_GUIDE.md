# 📱 Telegram 告警配置指南

> 5 分钟快速配置，实时接收交易告警

**配置时间**: 2026-03-12  
**难度**: ⭐⭐ (简单)

---

## 🎯 配置步骤

### 第 1 步：创建 Telegram Bot ⭐⭐⭐⭐⭐

#### 1.1 打开 Telegram

搜索并联系 **@BotFather**

#### 1.2 创建新 Bot

发送命令：
```
/newbot
```

#### 1.3 设置 Bot 名称

按提示输入：
```
Bot 名称：小龙智能交易助手
Bot 用户名：XiaoLongTradingBot (必须以 bot 结尾)
```

#### 1.4 获取 Bot Token

BotFather 会返回：
```
Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

Keep your token secure and store it safely.
```

**保存这个 Token！** 🔐

---

### 第 2 步：获取 Chat ID ⭐⭐⭐⭐⭐

#### 方法 1: 使用 @userinfobot (推荐)

1. 搜索并联系 **@userinfobot**
2. 发送任意消息
3. 机器人会回复你的 ID：
   ```
   Your user ID: 123456789
   ```

#### 方法 2: 使用 @getidsbot

1. 搜索并联系 **@getidsbot**
2. 发送 `/start`
3. 获取你的 ID

#### 方法 3: 手动获取

1. 在浏览器打开：
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
2. 给你的 Bot 发送一条消息
3. 刷新页面，找到 `"chat":{"id":123456789}`

**保存这个 Chat ID！** 📝

---

### 第 3 步：配置到系统 ⭐⭐⭐⭐⭐

#### 3.1 复制配置文件

```bash
cd /Users/colin/.openclaw/workspace
cp telegram_config.template.json telegram_config.json
```

#### 3.2 编辑配置

```bash
nano telegram_config.json
```

#### 3.3 填入配置

```json
{
  "enabled": true,
  "bot_token": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chat_id": "123456789",
  
  "alert_types": {
    "trading_signal": true,
    "black_swan": true,
    "price_alert": true,
    "daily_summary": true
  },
  
  "filters": {
    "min_confidence": 0.7,
    "min_leverage": 20,
    "only_strong_signals": true
  }
}
```

#### 3.4 设置安全权限

```bash
chmod 600 telegram_config.json
```

---

### 第 4 步：测试配置 ⭐⭐⭐⭐⭐

```bash
cd /Users/colin/.openclaw/workspace
python3 telegram_alert.py
```

**预期输出**:
```
======================================================================
📱 Telegram 告警测试
======================================================================
✅ Telegram 告警已配置

发送测试消息...
✅ Telegram 消息发送成功

发送交易信号...
✅ Telegram 消息发送成功

======================================================================
```

**检查 Telegram**:
- 应该收到 2 条消息
- 1 条测试消息
- 1 条交易信号

---

## 📋 配置说明

### 核心配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **enabled** | 是否启用 | true/false |
| **bot_token** | Bot Token | 1234567890:ABCdef... |
| **chat_id** | 你的 Telegram ID | 123456789 |

### 告警类型

| 类型 | 说明 | 默认 |
|------|------|------|
| **trading_signal** | 交易信号 | ✅ |
| **black_swan** | 黑天鹅警报 | ✅ |
| **price_alert** | 价格告警 | ✅ |
| **daily_summary** | 每日总结 | ✅ |

### 过滤器

| 配置 | 说明 | 推荐值 |
|------|------|--------|
| **min_confidence** | 最小置信度 | 0.7 |
| **min_leverage** | 最小杠杆 | 20 |
| **only_strong_signals** | 仅强信号 | true |

---

## 🎯 告警示例

### 交易信号告警

```
🚀 交易信号告警

币种：BTC/USDT
信号：STRONG_BUY
价格：$68,500.00
置信度：85%
仓位：80%
杠杆：50x
止损：$67,815.00
止盈：$70,555.00

原因：放量上涨 + EMA 多头 + RSI 超卖

时间：2026-03-12 06:10:00
```

### 黑天鹅警报

```
🚨 黑天鹅警报

级别：RED
币种：BTC/USDT
价格：$64,500.00
原因：5 分钟闪崩 -6.2%

建议动作：立即清仓

时间：2026-03-12 06:15:00
```

### 每日总结

```
📊 每日交易总结

日期：2026-03-12
交易次数：8
盈利交易：6
亏损交易：2
胜率：75.0%

总盈亏：$1,200.00
总收益率：2.40%
最大回撤：-0.80%

当前资金：$51,200.00
目标进度：51.2%

时间：2026-03-12 23:00:00
```

---

## 🔧 故障排查

### 问题 1: 收不到消息

**检查**:
```bash
# 1. 检查配置
cat telegram_config.json | python3 -m json.tool

# 2. 测试连接
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"<YOUR_CHAT_ID>","text":"测试"}'
```

**解决**:
- 检查 bot_token 是否正确
- 检查 chat_id 是否正确
- 检查是否给 Bot 发送过消息

---

### 问题 2: Bot Token 错误

**错误信息**:
```
❌ Telegram 发送失败：Unauthorized
```

**解决**:
1. 重新从 BotFather 获取 Token
2. 更新 telegram_config.json
3. 重启 Bot（如有）

---

### 问题 3: Chat ID 错误

**错误信息**:
```
❌ Telegram 发送失败：Bad Request: chat not found
```

**解决**:
1. 重新获取 Chat ID
2. 确保是数字格式
3. 给 Bot 发送一条消息

---

### 问题 4: 网络问题

**错误信息**:
```
❌ Telegram 发送异常：Connection timeout
```

**解决**:
```bash
# 检查代理
export https_proxy=http://127.0.0.1:7890

# 测试连接
curl https://api.telegram.org
```

---

## 🎊 高级配置

### 1. 多用户告警

```json
{
  "enabled": true,
  "bot_token": "YOUR_TOKEN",
  "chat_ids": [
    "123456789",
    "987654321"
  ]
}
```

### 2. 自定义告警频率

```json
{
  "filters": {
    "min_confidence": 0.8,
    "alert_cooldown": 300
  }
}
```

### 3. 仅接收强信号

```json
{
  "filters": {
    "only_strong_signals": true,
    "min_leverage": 50
  }
}
```

---

## 📱 手机端配置

### iOS/Android

1. 下载 Telegram
2. 登录账号
3. 搜索你的 Bot
4. 发送 `/start`
5. 完成！

---

## 🎯 完整配置流程

### 5 分钟快速配置

```bash
# 1. 创建 Bot (2 分钟)
# Telegram → @BotFather → /newbot

# 2. 获取 Chat ID (1 分钟)
# Telegram → @userinfobot

# 3. 配置文件 (1 分钟)
cd /Users/colin/.openclaw/workspace
cp telegram_config.template.json telegram_config.json
nano telegram_config.json
# 填入 bot_token 和 chat_id

# 4. 测试 (1 分钟)
python3 telegram_alert.py

# 完成！✅
```

---

## 🎊 总结

### 已配置功能

✅ 交易信号告警  
✅ 黑天鹅警报  
✅ 价格告警  
✅ 每日总结  
✅ Markdown 格式  
✅ 过滤器配置  

### 下一步

1. ✅ 创建 Telegram Bot
2. ✅ 获取 Chat ID
3. ✅ 配置 telegram_config.json
4. ✅ 测试告警
5. ✅ 启动监控系统

---

**🎉 配置完成后，实时接收所有交易告警！** 📱🐉

**启动监控**:
```bash
python3 auto_monitor_v2.py
```
