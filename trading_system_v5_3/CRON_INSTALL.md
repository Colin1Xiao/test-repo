# 小龙交易系统健康检查 - Crontab 配置

## 安装步骤

### 1. 编辑 crontab
```bash
crontab -e
```

### 2. 添加以下行（每分钟执行一次）

```cron
# 小龙交易系统健康检查
* * * * * /Users/colin/.openclaw/workspace/trading_system_v5_3/healthcheck.sh --notify >> /Users/colin/.openclaw/workspace/trading_system_v5_3/healthcheck.log 2>&1
```

### 3. 保存并退出

### 4. 验证
```bash
crontab -l  # 查看已安装的 crontab
```

---

## 可选配置

### 仅白天通知（08:00-23:00）

```cron
* 8-23 * * * /path/to/healthcheck.sh --notify >> /path/to/healthcheck.log 2>&1
```

### 仅记录日志，不通知

```cron
* * * * * /path/to/healthcheck.sh >> /path/to/healthcheck.log 2>&1
```

### 每小时发送一次摘要（无论状态）

```cron
0 * * * * /path/to/healthcheck.sh --notify --summary >> /path/to/healthcheck.log 2>&1
```

---

## 查看日志

```bash
# 实时查看
tail -f /Users/colin/.openclaw/workspace/trading_system_v5_3/healthcheck.log

# 查看告警
cat /Users/colin/.openclaw/workspace/trading_system_v5_3/healthcheck-alerts.log

# 统计告警次数
grep "FAILED" healthcheck-alerts.log | wc -l
grep "DEGRADED" healthcheck-alerts.log | wc -l
```

---

## 禁用/启用

```bash
# 禁用（注释掉）
crontab -e
# 在行首添加 #

# 启用（取消注释）
crontab -e
# 移除行首的 #

# 完全删除
crontab -r
```

---

## 环境变量配置

如需 Telegram 通知，在 crontab 文件顶部添加：

```cron
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

* * * * * /path/to/healthcheck.sh --notify >> /path/to/healthcheck.log 2>&1
```

或编辑 `healthcheck.sh` 顶部的默认值。
