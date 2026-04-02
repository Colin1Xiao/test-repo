# 🔧 故障排查手册

_面向"面板数据显示为 0"类问题的系统化诊断流程_

---

## 🎯 核心症状

> **面板数据显示为 0 / 数据不更新 / 状态异常**

---

## ⏱️ 3 分钟快速检查

### Step 1: 服务是否运行？

```bash
./trading-system.sh status
```

**预期输出:**
```
进程状态：✅ 运行中 (PID: 12345)
端口 8780: ✅ 监听中
健康检查:
  状态：● 正常
  Worker: ✅
  快照新鲜度：3.2s
  账户权益：$1234.56 USDT
  数据有效：✅
```

**异常处理:**

| 状态 | 操作 |
|------|------|
| 进程未运行 | `./trading-system.sh start` |
| 端口未监听 | `./trading-system.sh restart` |
| 健康检查失败 | 进入 Step 2 |

---

### Step 2: 健康端点是否正常？

```bash
curl http://127.0.0.1:8780/api/health | jq
```

**关键指标:**

```json
{
  "status": "ok",           // ❌ failed/degraded → 有问题
  "worker_alive": true,     // ❌ false → Worker 挂了
  "snapshot_age_sec": 3,    // ❌ >15 → 数据陈旧
  "data_valid": true,       // ❌ false → 数据无效
  "equity": 1234.56,        // ❌ 0 → 账户权益为 0
  "dependency": {
    "okx_api": "ok",        // ❌ degraded/failed → OKX 异常
    "file_fallback": "ok"   // ❌ missing → 文件回退失效
  }
}
```

**快速诊断表:**

| 字段 | 异常值 | 可能原因 | 下一步 |
|------|--------|---------|--------|
| `status` | failed | Worker 死亡/快照陈旧 | 查看 Step 3 |
| `worker_alive` | false | Worker 线程崩溃 | 查看日志 |
| `snapshot_age_sec` | >60 | 数据采集停止 | 检查 OKX API |
| `data_valid` | false | equity=0 | 检查账户/文件回退 |
| `okx_api` | failed | OKX 连接失败 | 检查网络/API |

---

### Step 3: 查看最近日志

```bash
tail -100 panel_v41.log | grep -E "(ERROR|WARN|snapshot|worker)"
```

**关键错误模式:**

| 日志模式 | 含义 | 处理 |
|---------|------|------|
| `Worker thread crashed` | Worker 线程崩溃 | 重启服务 |
| `OKX API failed` | OKX 连接失败 | 检查网络/API 密钥 |
| `Snapshot publish failed` | 快照发布失败 | 检查内存/磁盘 |
| `StorageError` | SQLite 异常 | 检查数据库文件 |

---

## 🔬 10 分钟详细诊断

### 场景 A: 服务未运行

```bash
# 1. 检查 PID 文件残留
ls -la .panel.pid .panel.lock

# 2. 清理残留
rm -f .panel.pid .panel.lock

# 3. 检查端口占用
lsof -ti :8780

# 4. 强制释放端口
lsof -ti :8780 | xargs kill -9

# 5. 重新启动
./trading-system.sh start
```

---

### 场景 B: Worker 未运行 / 快照陈旧

**症状:** `worker_alive=false` 或 `snapshot_age_sec>60`

```bash
# 1. 查看 Worker 错误日志
tail -200 panel_v41.log | grep -A5 "background_update"

# 2. 检查 OKX API 连接
curl -s https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT | jq

# 3. 检查文件回退
cat logs/live_state.json | jq '.timestamp'

# 4. 重启服务
./trading-system.sh restart

# 5. 验证恢复
curl http://127.0.0.1:8780/api/health | jq '{worker,snapshot_age,status}'
```

---

### 场景 C: 数据无效 (equity=0)

**症状:** `data_valid=false` 或 `equity=0`

```bash
# 1. 检查实时状态文件
cat logs/live_state.json | jq '{equity,balance,position}'

# 2. 检查 StateStore
cat logs/state_store.json | jq '.capital.equity_usdt'

# 3. 验证 OKX 账户
# (需要 API 密钥)
curl -s https://www.okx.com/api/v5/account/balance \
  -H "OKX-ACCESS-KEY: xxx" \
  -H "OKX-TIMESTAMP: xxx" \
  -H "OKX-SIGN: xxx" | jq

# 4. 如果 OKX 正常但面板为 0 → 数据采集链路问题
tail -100 panel_v41.log | grep -E "(capital|equity|balance)"
```

---

### 场景 D: OKX API 异常

**症状:** `dependency.okx_api=failed`

```bash
# 1. 测试 OKX 公共 API
curl -s "https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT" | jq '.code'

# 期望输出: "0" (成功)

# 2. 检查网络连通性
ping www.okx.com
curl -I https://www.okx.com

# 3. 检查系统时间（签名依赖时间同步）
date

# 4. 如果是 API 密钥问题 → 检查配置文件
cat config/exchange_config.json | jq

# 5. 临时切换到文件回退
# (系统会自动回退，无需手动操作)
cat logs/live_state.json | jq '.timestamp'
```

---

### 场景 E: 端口占用 / 无法启动

**症状:** `Address already in use` 或 `端口 8780 被占用`

```bash
# 1. 查找占用进程
lsof -ti :8780

# 2. 检查是否是自己的旧进程
ps -p $(lsof -ti :8780) -o command=

# 3. 如果是旧进程 → 停止它
./trading-system.sh stop

# 4. 如果 stop 失败 → 强制 kill
lsof -ti :8780 | xargs kill -9

# 5. 清理残留文件
rm -f .panel.pid .panel.lock

# 6. 重新启动
./trading-system.sh start
```

---

## 🧩 根因决策树

```
面板数据为 0
    │
    ├─→ 服务未运行？
    │     └─→ ./trading-system.sh start
    │
    ├─→ Worker 未运行？
    │     ├─→ 查看日志：tail -100 panel_v41.log
    │     ├─→ 检查 OKX API
    │     └─→ ./trading-system.sh restart
    │
    ├─→ 快照陈旧 (>60s)？
    │     ├─→ OKX API 异常？ → 检查网络/API 密钥
    │     └─→ Worker 卡死？ → 重启服务
    │
    ├─→ 数据无效 (equity=0)？
    │     ├─→ OKX 账户余额为 0？ → 充值
    │     ├─→ 文件回退失效？ → 检查 live_state.json
    │     └─→ 数据采集链路问题？ → 查看日志
    │
    └─→ 端口占用？
          └─→ lsof -ti :8780 | xargs kill -9
```

---

## 📊 健康状态速查

### 状态码含义

| status | 含义 | 处理 |
|--------|------|------|
| `ok` | 系统正常 | 无需操作 |
| `degraded` | 降级运行 | 检查警告项 |
| `failed` | 严重故障 | 立即处理 |

### 阈值定义

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| `snapshot_age_sec` | ≤15s | 15-60s | >60s |
| `worker_alive` | true | - | false |
| `equity` | >0 | - | 0 |
| `okx_api` | ok | degraded | failed |
| `fail_count` | 0 | 1-2 | ≥3 |

---

## 🛠️ 工具命令速查

```bash
# 进程管理
./trading-system.sh {start|stop|restart|status|logs}

# 健康检查
curl http://127.0.0.1:8780/api/health | jq

# 实时状态
cat logs/live_state.json | jq

# 交易历史
cat logs/state_store.json | jq '.last_trade'

# 日志跟踪
tail -f panel_v41.log

# 端口检查
lsof -ti :8780

# 进程检查
ps aux | grep panel_v4

# 文件回退
cat logs/live_state.json | jq '.timestamp'
```

---

## 🚨 紧急恢复流程

**当系统完全不可用时:**

```bash
# 1. 强制停止所有相关进程
pkill -f panel_v4
lsof -ti :8780 | xargs kill -9

# 2. 清理残留文件
rm -f .panel.pid .panel.lock

# 3. 备份当前状态
cp logs/live_state.json logs/live_state.json.backup
cp logs/state_store.json logs/state_store.json.backup

# 4. 重新启动
./trading-system.sh start

# 5. 验证恢复
./trading-system.sh status
curl http://127.0.0.1:8780/api/health | jq .status
```

---

## 📝 诊断记录模板

**遇到问题时，记录以下信息:**

```markdown
### 问题描述
[症状描述]

### 发生时间
[YYYY-MM-DD HH:MM]

### 健康状态
```json
[curl .../api/health | jq 输出]
```

### 最近日志
```
[tail -50 panel_v41.log 输出]
```

### 已尝试操作
1. [操作 1]
2. [操作 2]

### 结果
[成功/失败/部分恢复]
```

---

## 🎓 核心原则

> **先确认你看到的是不是"当前进程的真实状态"，再谈代码优化。**

> **在排查实时系统问题时，优先验证运行环境一致性，而不是先怀疑业务逻辑。**

---

---

## 💻 平台差异说明

### macOS vs Linux

本系统支持 macOS 和 Linux，部分命令自动降级：

| 功能 | macOS | Linux | 备注 |
|------|-------|-------|------|
| 端口检测 | `netstat` | `lsof`/`ss` | 自动检测 |
| JSON 解析 | Python | Python/jq | 优先 jq |
| 颜色输出 | TTY 检测 | TTY 检测 | 非 TTY 禁用 |

### 非故障现象（预期行为）

以下情况**不是故障**，无需处理：

| 现象 | 原因 | 验证 |
|------|------|------|
| `command not found: lsof` | macOS 使用 `netstat` 降级 | `./trading-system.sh status` 仍正常 |
| `status` 输出无颜色 | 非 TTY 环境（如重定向） | 直接运行脚本即有颜色 |
| JSON 解析较慢 | 无 `jq`，使用 Python | 功能正常，仅速度略慢 |
| 日志文件无 ANSI 码 | 自动检测非 TTY | `cat panel_v40.log` 干净 |

### `status` 命令数据来源

```
./trading-system.sh status
         │
         ├─→ ps (进程状态)
         ├─→ netstat/lsof (端口状态)
         └─→ curl /api/health (健康状态)
                  │
                  └─→ panel_v40.py → worker_state + snapshot
```

**关键字段说明：**
- `worker_alive` → Worker 线程心跳
- `snapshot_age_sec` → 快照年龄（秒）
- `data_valid` → equity > 0
- `dependency.okx_api` → OKX API 连接状态
- `dependency.file_fallback` → 文件回退状态

---

_最后更新：2026-03-29 04:05_
