# 小龙自动交易系统 - 运行说明

## 快速开始

### 1. 启动 V3 (推荐)
```bash
cd ~/.openclaw/workspace
bash start_monitor.sh
```

### 2. 查看运行状态
```bash
# 检查进程
ps aux | grep auto_monitor_v3

# 查看实时日志
tail -f monitor_live.log

# 查看告警日志
tail -f monitor_alerts.log
```

### 3. 停止系统
```bash
# 正常停止
pkill -f auto_monitor_v3

# 回滚到 V2 (如果 V3 有问题)
bash stop_v3_start_v2.sh
```

---

## 配置文件位置

| 配置项 | 文件路径 | 说明 |
|--------|----------|------|
| OKX API | ~/.openclaw/secrets/multi_exchange_config.json | API密钥、密码 |
| 交易参数 | trader_config.json | 仓位、杠杆等 |
| 监控币种 | symbols_config.json | BTC/ETH/SOL等 |
| Telegram | telegram_config.json | 告警机器人配置 |

---

## 常见问题

### Q: V3 启动失败怎么办？
A: 执行回滚脚本切换到 V2:
```bash
bash stop_v3_start_v2.sh
```

### Q: 如何修改监控币种？
A: 编辑 symbols_config.json，格式:
```json
["BTC/USDT", "ETH/USDT", "SOL/USDT"]
```

### Q: 如何关闭 Telegram 告警？
A: 编辑 telegram_config.json，设置 `"enabled": false`

### Q: 日志文件在哪里？
A: 
- 主日志: `monitor_live.log`
- 告警日志: `monitor_alerts.log`

---

## 系统架构

```
start_monitor.sh
    └── auto_monitor_v3.py (主监控)
            ├── multi_exchange_adapter.py (交易所适配)
            │       └── OKX API 连接
            ├── execution_state_machine.py (执行控制)
            └── telegram_alert.py (告警发送)
```

---

## 紧急联系

- 系统异常时先执行: `bash stop_v3_start_v2.sh`
- 查看日志: `tail -n 100 monitor_live.log`
- 完全停止: `pkill -f auto_monitor`

---

*版本: stable_20260314*
