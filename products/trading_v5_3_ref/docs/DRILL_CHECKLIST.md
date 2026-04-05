# 🧪 故障演练清单

_验证监控系统的真实有效性_

---

## 演练原则

1. **在安全环境执行**（Testnet 或非交易时段）
2. **每次只演练一个场景**
3. **记录所有观察结果**
4. **演练后恢复原状**

---

## 演练前准备

### 1. 确认当前状态

```bash
# 系统状态
./trading-system.sh status

# 健康状态
curl http://127.0.0.1:8780/api/health | jq

# 告警通道
echo "测试消息" | ./healthcheck.sh --notify

# 日志基线
tail -10 panel_v40.log
```

**预期：**
- ✅ 所有指标正常
- ✅ Telegram 收到测试消息
- ✅ 日志正常更新

### 2. 准备观察点

打开 3 个终端：

```bash
# 终端 1: 实时日志
tail -f panel_v40.log | grep -E "(ERROR|WARN|snapshot|worker)"

# 终端 2: 告警日志
tail -f healthcheck-alerts.log

# 终端 3: 健康状态（每 5 秒）
watch -n 5 'curl -s http://127.0.0.1:8780/api/health | jq "{status,worker,snapshot_age}"'
```

### 3. 准备恢复脚本

```bash
# 快速恢复
recover() {
  ./trading-system.sh restart
  sleep 10
  ./trading-system.sh status
}
```

---

## 演练场景

### 场景 1：杀掉主进程

**目标：** 验证进程监控和告警

**执行：**
```bash
# 1. 记录当前 PID
ps aux | grep panel_v40 | grep -v grep

# 2. 杀掉进程
kill $(cat .panel.pid)

# 3. 观察（1 分钟内）
# - 终端 2 应出现 FAILED 告警
# - Telegram 应收到通知
```

**预期：**
- ✅ 1 分钟内检测到进程消失
- ✅ `healthcheck-alerts.log` 记录 FAILED
- ✅ Telegram 收到告警（如配置）

**恢复：**
```bash
./trading-system.sh start
```

---

### 场景 2：占用端口但不启动服务

**目标：** 验证端口冲突检测

**执行：**
```bash
# 1. 停止服务
./trading-system.sh stop

# 2. 占用端口（Python 简易服务器）
python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',8780)); s.listen(); import time; time.sleep(300)" &

# 3. 尝试启动
./trading-system.sh start

# 4. 观察
# - 应提示端口被占用
# - 启动失败
```

**预期：**
- ✅ 检测到端口占用
- ✅ 启动失败并有明确错误信息
- ✅ 无告警（因为健康检查未通过）

**恢复：**
```bash
# 杀掉占用进程
lsof -ti :8780 | xargs kill -9 2>/dev/null || pkill -f "python3 -c"
./trading-system.sh start
```

---

### 场景 3：模拟 Worker 卡死

**目标：** 验证 Worker 心跳监控

**执行：**
```bash
# 1. 找到 Worker 线程 PID
ps aux | grep panel_v40 | grep -v grep

# 2. 发送 SIGSTOP（暂停线程）
kill -STOP <PID>

# 3. 观察（1-2 分钟）
# - snapshot_age_sec 应持续增长
# - 应触发 DEGRADED 或 FAILED 告警
```

**预期：**
- ✅ `snapshot_age_sec` 超过 15s → 60s
- ✅ 状态从 OK → DEGRADED → FAILED
- ✅ Telegram 收到告警

**恢复：**
```bash
# 恢复线程
kill -CONT <PID>

# 或重启服务
./trading-system.sh restart
```

---

### 场景 4：模拟 OKX API 失败

**目标：** 验证依赖监控和文件回退

**执行：**
```bash
# 1. 修改 hosts 文件（临时屏蔽 OKX）
sudo sh -c 'echo "127.0.0.1 www.okx.com" >> /etc/hosts'

# 2. 观察（2-3 分钟）
# - OKX API 应失败
# - 文件回退应生效
# - 状态可能 DEGRADED 但不应 FAILED
```

**预期：**
- ✅ OKX API 失败被检测到
- ✅ 文件回退自动生效
- ✅ 状态为 DEGRADED（不是 FAILED）
- ✅ Telegram 收到降级通知

**恢复：**
```bash
# 恢复 hosts
sudo sh -c 'sed -i "/www.okx.com/d" /etc/hosts'

# 或重启服务
./trading-system.sh restart
```

---

### 场景 5：模拟 equity=0

**目标：** 验证数据有效性检测

**执行：**
```bash
# 1. 修改 live_state.json（备份先）
cp logs/live_state.json logs/live_state.json.backup

# 2. 修改 equity 为 0
cat logs/live_state.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
d['balance']['usdt_free']=0
d['balance']['usdt_total']=0
json.dump(d, sys.stdin)
" > /tmp/live_state_temp.json && mv /tmp/live_state_temp.json logs/live_state.json

# 3. 观察（3-5 分钟，需持续 3 次检查）
# - data_valid 应变为 false
# - 应触发 DEGRADED 告警
```

**预期：**
- ✅ `data_valid=false`
- ✅ 状态为 DEGRADED
- ✅ Telegram 收到告警（持续 3 次后）

**恢复：**
```bash
mv logs/live_state.json.backup logs/live_state.json
```

---

### 场景 6：模拟日志文件写满

**目标：** 验证磁盘空间告警（如有）

**执行：**
```bash
# 1. 创建大文件占满磁盘（谨慎！）
dd if=/dev/zero of=/tmp/fill_disk bs=1M count=1000

# 2. 观察
# - 日志写入可能失败
# - 系统应降级但不应崩溃
```

**预期：**
- ⚠️ 日志写入失败
- ⚠️ 系统可能降级
- ✅ 不应崩溃

**恢复：**
```bash
rm /tmp/fill_disk
```

---

### 场景 7：模拟 Telegram 通知失效

**目标：** 验证告警通道故障检测

**执行：**
```bash
# 1. 设置错误的 Token
export TELEGRAM_BOT_TOKEN="invalid_token"

# 2. 手动触发告警
./healthcheck.sh --notify

# 3. 观察
# - Telegram 应失败
# - 本地日志应记录
```

**预期：**
- ✅ Telegram 发送失败
- ✅ `healthcheck.log` 记录错误
- ✅ 本地告警日志仍更新

**恢复：**
```bash
unset TELEGRAM_BOT_TOKEN
# 或恢复正确的 Token
export TELEGRAM_BOT_TOKEN="your_real_token"
```

---

### 场景 8：验证告警降噪（Cooldown）

**目标：** 验证相同告警不重复发送

**执行：**
```bash
# 1. 触发告警
kill $(cat .panel.pid)

# 2. 等待 1 分钟，再次检查
./healthcheck.sh --notify

# 3. 观察 Telegram
# - 第一次应收到
# - 第二次应被抑制（冷却中）
```

**预期：**
- ✅ 第一次告警发送成功
- ✅ 第二次告警被抑制（5 分钟冷却）
- ✅ 日志记录"告警抑制"

**恢复：**
```bash
./trading-system.sh start
```

---

### 场景 9：验证恢复通知

**目标：** 验证系统恢复时发送通知

**执行：**
```bash
# 1. 制造故障
kill $(cat .panel.pid)

# 2. 等待告警发送
sleep 10

# 3. 恢复服务
./trading-system.sh start

# 4. 观察 Telegram
# - 应收到"恢复"通知
```

**预期：**
- ✅ 故障时收到告警
- ✅ 恢复时收到通知
- ✅ 通知包含持续时间

---

## 演练报告模板

```markdown
# 故障演练报告

**日期**: YYYY-MM-DD HH:MM
**场景**: [场景名称]
**执行人**: [姓名]

## 执行步骤

1. [步骤 1]
2. [步骤 2]

## 观察结果

| 预期 | 实际 | 状态 |
|------|------|------|
| ✅ 预期 1 | ✅/❌ | 通过/失败 |
| ✅ 预期 2 | ✅/❌ | 通过/失败 |

## 问题发现

- [问题 1]
- [问题 2]

## 改进建议

- [建议 1]
- [建议 2]

## 结论

✅ 通过 / ❌ 失败 / ⚠️ 部分通过
```

---

## 演练频率

| 场景 | 频率 | 说明 |
|------|------|------|
| 场景 1（杀进程） | 每月 1 次 | 核心监控验证 |
| 场景 3（Worker 卡死） | 每季度 1 次 | 心跳监控验证 |
| 场景 8-9（降噪/恢复） | 每季度 1 次 | 告警质量验证 |
| 全场景 | 每半年 1 次 | 全面演练 |

---

## 成功标准

- ✅ 所有预期结果达成
- ✅ 告警及时且准确
- ✅ 恢复路径清晰
- ✅ 无误报/漏报
- ✅ 文档与实际情况一致

---

_最后更新：2026-03-29 04:15_
