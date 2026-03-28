# 📘 运维 Runbook

_标准化故障处理流程_

---

## 告警分级

| 级别 | 状态 | 响应时间 | 通知方式 |
|------|------|---------|---------|
| 🔴 CRITICAL | FAILED | 立即 | Telegram + 日志 |
| ⚠️ WARNING | DEGRADED | 15 分钟内 | 日志（可配置 Telegram） |
| ✅ NORMAL | OK | - | 无通知 |

---

## 场景 1：进程不存在

**症状：**
```
./trading-system.sh status
进程状态：❌ 未运行
```

**处理流程：**

```bash
# 1. 确认进程状态
ps aux | grep panel_v40 | grep -v grep

# 2. 检查端口占用
lsof -ti :8780 2>/dev/null || netstat -anv -p tcp | grep "\.8780 "

# 3. 清理残留
rm -f .panel.pid .panel.lock

# 4. 启动服务
./trading-system.sh start

# 5. 验证
./trading-system.sh status
curl http://127.0.0.1:8780/api/health | jq .status
```

**预期结果：**
- `status=ok` 或 `status=degraded`
- `worker_alive=true`
- `snapshot_age_sec<10`

**升级条件：**
- 启动失败 → 查看 `tail -100 panel_v40.log`
- 启动后立即崩溃 → 联系开发

---

## 场景 2：端口存活但服务异常

**症状：**
```
端口 8780: ✅ 监听中
状态：● 异常
worker_alive: false
```

**处理流程：**

```bash
# 1. 查看健康状态
curl http://127.0.0.1:8780/api/health | jq '{
  status: .status,
  worker: .worker_alive,
  snapshot_age: .snapshot_age_sec,
  error: .last_error
}'

# 2. 查看最近日志
tail -50 panel_v40.log | grep -E "(ERROR|WARN|Exception)"

# 3. 检查 OKX API
curl -s "https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT" | jq '.code'
# 期望输出："0"

# 4. 重启服务
./trading-system.sh restart

# 5. 等待并验证
sleep 10
./trading-system.sh status
```

**预期结果：**
- `worker_alive=true`
- `snapshot_age_sec<10`

**升级条件：**
- OKX API 持续失败 → 检查网络/代理
- Worker 反复崩溃 → 查看日志 + 联系开发

---

## 场景 3：日志持续报错

**症状：**
```bash
grep "ERROR" panel_v40.log | tail -20
# 大量错误日志
```

**处理流程：**

```bash
# 1. 统计错误类型
grep "ERROR" panel_v40.log | awk -F']' '{print $NF}' | sort | uniq -c | sort -rn

# 2. 查看最新错误
tail -100 panel_v40.log | grep -A3 "ERROR"

# 3. 检查健康状态
./trading-system.sh status

# 4. 根据错误类型处理
# - OKX API 失败 → 场景 2
# - SQLite 错误 → 检查磁盘空间
# - Worker 崩溃 → 重启服务

# 5. 如无法判断，收集信息
tar -czf /tmp/panel-logs-$(date +%Y%m%d-%H%M%S).tar.gz \
  panel_v40.log healthcheck.log healthcheck-alerts.log
```

**预期结果：**
- 错误类型明确
- 有对应处理流程

**升级条件：**
- 未知错误类型 → 收集日志 + 联系开发

---

## 场景 4：告警通道失效

**症状：**
- Telegram 无通知
- 但 `healthcheck-alerts.log` 有记录

**处理流程：**

```bash
# 1. 检查 Telegram 配置
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID

# 2. 手动测试 Telegram
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=测试消息"

# 3. 检查 launchd/cron 状态
# macOS
launchctl list | grep xiaolong

# Linux
crontab -l

# 4. 查看 healthcheck 日志
tail -50 healthcheck.log

# 5. 重新加载配置
# macOS
launchctl unload ~/Library/LaunchAgents/com.xiaolong.healthcheck.plist
launchctl load ~/Library/LaunchAgents/com.xiaolong.healthcheck.plist

# Linux
crontab -e  # 保存触发重载
```

**预期结果：**
- Telegram 配置正确
- 定时任务运行中

**升级条件：**
- Telegram API 失败 → 检查 token/chat_id
- 定时任务未运行 → 重新安装

---

## 场景 5：重启后未自启动

**症状：**
- 系统重启后服务未运行
- 需要手动启动

**处理流程：**

```bash
# 1. 检查是否有自启动配置
# macOS
ls -la ~/Library/LaunchAgents/ | grep xiaolong

# Linux
crontab -l | grep trading

# 2. 如无配置，添加自启动
# macOS: 编辑 ~/.config/autostart/xiaolong.desktop
# Linux: 编辑 /etc/rc.local 或 systemd service

# 3. 手动启动
./trading-system.sh start

# 4. 验证
./trading-system.sh status
```

**推荐方案：**

创建 systemd service（Linux）:

```ini
# /etc/systemd/system/xiaolong-panel.service
[Unit]
Description=小龙交易系统面板
After=network.target

[Service]
Type=simple
User=colin
WorkingDirectory=/home/colin/.openclaw/workspace/trading_system_v5_3
ExecStart=/usr/bin/python3 panel_v40.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启用
sudo systemctl enable xiaolong-panel
sudo systemctl start xiaolong-panel
sudo systemctl status xiaolong-panel
```

---

## 场景 6：快照陈旧（snapshot_age_sec > 60）

**症状：**
```json
{
  "snapshot_age_sec": 120,
  "worker_alive": true,
  "status": "failed"
}
```

**处理流程：**

```bash
# 1. 确认 Worker 状态
curl http://127.0.0.1:8780/api/health | jq .worker_alive

# 2. 查看 Worker 日志
grep "worker_heartbeat\|snapshot_published" panel_v40.log | tail -20

# 3. 检查 OKX API
curl -s "https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT" | jq

# 4. 检查文件回退
cat logs/live_state.json | jq .timestamp

# 5. 如 OKX 异常但文件回退正常 → 降级运行
# 6. 如 Worker 卡死 → 重启服务
./trading-system.sh restart
```

**预期结果：**
- OKX API 正常 → Worker 应恢复
- OKX API 异常 → 文件回退应工作

**升级条件：**
- 两者都异常 → 检查网络 + 磁盘空间

---

## 场景 7：账户权益为 0（equity=0）

**症状：**
```json
{
  "equity": 0.0,
  "data_valid": false,
  "status": "degraded"
}
```

**处理流程：**

```bash
# 1. 检查 OKX 账户
curl -s https://www.okx.com/api/v5/account/balance \
  -H "OKX-ACCESS-KEY: xxx" \
  -H "OKX-TIMESTAMP: xxx" \
  -H "OKX-SIGN: xxx" | jq

# 2. 检查文件回退
cat logs/live_state.json | jq '.balance'

# 3. 判断原因
# - OKX 余额确实为 0 → 充值
# - OKX 余额正常但面板为 0 → API 采集问题
# - 文件回退数据陈旧 → 等待更新

# 4. 如为采集问题，重启服务
./trading-system.sh restart
```

**预期结果：**
- OKX 余额正常 → 采集链路应恢复
- OKX 余额为 0 → 需要充值

**升级条件：**
- 采集链路持续异常 → 查看日志 + 联系开发

---

## 通用诊断命令

```bash
# 快速状态
./trading-system.sh status

# 健康详情
curl http://127.0.0.1:8780/api/health | jq

# 最近日志
tail -50 panel_v40.log

# 告警历史
cat healthcheck-alerts.log

# 结构化日志检索
grep "snapshot_published" panel_v40.log | tail -10
grep "snapshot_failed" panel_v40.log | tail -10
grep "worker_heartbeat" panel_v40.log | tail -10

# 进程信息
ps aux | grep panel_v40 | grep -v grep

# 端口检查
lsof -ti :8780 2>/dev/null || echo "端口未监听"
```

---

## 联系开发

**需要提供：**

1. **时间范围**：故障发生时间
2. **状态输出**：`./trading-system.sh status`
3. **健康详情**：`curl .../api/health | jq`
4. **最近日志**：`tail -100 panel_v40.log`
5. **告警历史**：`cat healthcheck-alerts.log`
6. **已尝试操作**：列出所有已执行的命令

**日志打包：**
```bash
tar -czf /tmp/panel-logs-$(date +%Y%m%d-%H%M%S).tar.gz \
  panel_v40.log healthcheck.log healthcheck-alerts.log
```

---

_最后更新：2026-03-29 04:15_
