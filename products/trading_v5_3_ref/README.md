# 🐉 小龙交易系统 V5.4

**生产就绪版本** - v5.4.0-verified (2026-03-26)

---

## 🚀 快速开始

### 启动服务

```bash
cd ~/.openclaw/workspace/trading_system_v5_3
./trading-system.sh start
```

### 查看状态

```bash
./trading-system.sh status
```

### 停止服务

```bash
./trading-system.sh stop
```

### 查看日志

```bash
./trading-system.sh logs
# 或
tail -f panel_v41.log
```

---

## 📋 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     小龙交易系统 V5.4                        │
├─────────────────────────────────────────────────────────────┤
│  Signal → Decision Hub → Execution Lock → Position Gate    │
│                      → Stop Loss → StateStore               │
├─────────────────────────────────────────────────────────────┤
│  核心模块：                                                  │
│  - 信号引擎 (Signal Engine)                                 │
│  - 决策中心 (Decision Hub)                                  │
│  - 安全执行 (Safe Execution v5.4)                           │
│  - 止损管理 (Stop Loss Manager)                             │
│  - 状态存储 (StateStore)                                    │
│  - 实时数据 (Live Data Updater)                             │
│  - 控制面板 (Panel v41)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 运维命令

### 进程管理

| 命令 | 说明 |
|------|------|
| `./trading-system.sh start` | 启动服务（带单实例锁 + 健康验证） |
| `./trading-system.sh stop` | 停止服务（SIGTERM 优先） |
| `./trading-system.sh restart` | 重启服务 |
| `./trading-system.sh status` | 查看状态（进程 + 端口 + 健康） |
| `./trading-system.sh logs` | 实时日志 |

### 健康检查

```bash
# 命令行
./trading-system.sh status

# API
curl http://127.0.0.1:8780/api/health | jq

# 自动化健康检查（每分钟）
./healthcheck.sh --notify

# 查看告警日志
cat healthcheck-alerts.log
```

### 定时任务配置

**macOS (launchd):**
```bash
# 加载配置
cp com.xiaolong.healthcheck.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.xiaolong.healthcheck.plist

# 查看状态
launchctl list | grep xiaolong

# 卸载
launchctl unload ~/Library/LaunchAgents/com.xiaolong.healthcheck.plist
```

**Linux (crontab):**
```bash
crontab -e
# 添加：* * * * * /path/to/healthcheck.sh --notify >> /path/to/healthcheck.log 2>&1
```

详见 [`CRON_INSTALL.md`](CRON_INSTALL.md)

# 关键指标
curl http://127.0.0.1:8780/api/health | jq '{
  status: .status,
  worker: .worker_alive,
  snapshot_age: .snapshot_age_sec,
  equity: .equity,
  data_valid: .data_valid,
  okx: .dependency.okx_api,
  fallback: .dependency.file_fallback
}'
```

### 数据查看

```bash
# 实时状态
cat logs/live_state.json | jq

# 交易历史
cat logs/state_store.json | jq

# 最后交易
cat logs/state_store.json | jq '.last_trade'
```

---

## 📊 控制面板

访问：http://127.0.0.1:8780

- **主面板**: 实时持仓、账户权益、系统状态
- **历史页**: 交易历史、告警统计、决策分析
- **报表页**: 性能指标、演化日志、健康度

---

## 🔍 故障排查

遇到问题？查看 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

### 快速诊断流程

```bash
# 1. 检查服务状态
./trading-system.sh status

# 2. 检查健康端点
curl http://127.0.0.1:8780/api/health | jq

# 3. 查看最近日志
tail -100 panel_v41.log

# 4. 检查端口占用
lsof -ti :8780

# 5. 检查进程
ps aux | grep panel_v4
```

### 常见症状

| 症状 | 可能原因 | 快速命令 |
|------|---------|---------|
| 面板数据为 0 | Worker 未运行 | `./trading-system.sh status` |
| 端口占用 | 旧进程残留 | `lsof -ti :8780 \| xargs kill -9` |
| 快照陈旧 | OKX API 异常 | `curl .../api/health \| jq .dependency` |
| 无法启动 | PID 文件残留 | `rm .panel.pid .panel.lock` |

---

## 📁 目录结构

```
trading_system_v5_3/
├── trading-system.sh      # 统一进程管理脚本 ⭐
├── panel_v41.py           # 控制面板 + API 后端
├── live_data_updater.py   # 实时数据采集
├── system_health_check.py # 系统健康检查
├── utils.py               # 工具函数库
├── storage_sqlite.py      # SQLite 存储
├── freshness.py           # 新鲜度追踪
├── performance_monitor.py # 性能监控
├── alert_manager.py       # 告警管理
├── templates/             # HTML 模板
│   ├── index.html
│   ├── history.html
│   └── reports.html
├── static/                # 静态资源
│   ├── sw.js             # Service Worker (PWA)
│   ├── manifest.json     # PWA Manifest
│   └── freshness-badge.js
├── logs/                  # 运行日志
│   ├── live_state.json   # 实时状态
│   ├── state_store.json  # 交易历史
│   └── ...
├── config/                # 配置文件
├── data/                  # 数据文件
├── docs/                  # 文档
│   └── TROUBLESHOOTING.md
└── README.md              # 本文件
```

---

## 🛡️ 安全特性

- **单实例锁**: flock + PID 文件 + 端口检查三层防护
- **执行锁**: asyncio.Lock 原子化执行
- **Position Gate**: 双层持仓检查（本地 + 交易所）
- **订单级止损**: 交易所托管止损单
- **状态存储**: 文件锁 + 缓存 + 完整审计链

---

## 💻 macOS 兼容性

本系统已在 macOS 和 Linux 上验证，支持自动降级适配：

| 功能 | macOS | Linux | 说明 |
|------|-------|-------|------|
| 端口检测 | `netstat` | `lsof`/`ss` | 自动检测可用工具 |
| JSON 解析 | Python | Python/jq | 优先使用 jq，无则 Python |
| 颜色输出 | TTY 检测 | TTY 检测 | 非交互终端自动禁用 |
| 进程管理 | 完整支持 | 完整支持 | `trading-system.sh` |

**最低依赖：**
- bash 4.0+
- python3 3.8+
- curl

**可选依赖（有则更佳）：**
- jq（加速 JSON 解析）
- lsof（Linux/macOS 端口检测）

**非故障现象：**
- ✅ 无 `lsof` 命令 → 自动使用 `netstat`
- ✅ 无 `jq` 命令 → 自动使用 Python
- ✅ 日志文件无颜色 → 非 TTY 环境预期行为

---

## 📊 结构化日志

系统输出 4 类关键事件，支持快速诊断：

| 事件 | 含义 | 字段 |
|------|------|------|
| `service_started` | 服务启动 | event, ts, port |
| `snapshot_published` | 快照发布成功 | event, ts, counter, equity, position_side |
| `worker_heartbeat` | Worker 心跳（每 50 秒） | event, ts, counter, equity, fail_count |
| `snapshot_failed` | 快照发布失败 | event, ts, counter, error, fail_count |

**快速查询：**
```bash
# 查看服务启动
grep "service_started" panel_v40.log

# 查看快照发布
grep "snapshot_published" panel_v40.log

# 查看 Worker 心跳
grep "worker_heartbeat" panel_v40.log

# 查看失败事件
grep "snapshot_failed" panel_v40.log

# 统计失败次数
grep "fail_count" panel_v40.log | tail -1
```

**日志位置：** `panel_v40.log`

---

## 📝 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SQLITE_DUAL_WRITE` | SQLite 双写开关 | `true` |
| `DISABLE_EXECUTION_ENGINE` | 禁用执行引擎 | `false` |

### 配置文件

- `config/trader_config.json` - 策略配置
- `config/exchange_config.json` - 交易所配置

---

## 🧪 测试

```bash
# 运行安全测试
python3 scripts/run_safety_test.py

# 运行健康检查
./scripts/openclaw-health-check.sh
```

---

## 📚 文档

- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) - 故障排查手册
- [`docs/CODE_REFACTORING_GUIDELINES.md`](docs/CODE_REFACTORING_GUIDELINES.md) - 代码优化准则
- [`MEMORY.md`](../../MEMORY.md) - 长期记忆与决策记录

---

## 🐉 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v5.4.0-verified | 2026-03-26 | 生产就绪，实盘验证通过 |
| v5.4.0-RC | 2026-03-26 | 正式候选版本 |
| v5.3 | 2026-03-21 | 安全验证阶段 |
| v5.2 | 2026-03-19 | Phase 1 启动 |

---

## ⚡ 核心原则

> **在排查实时系统问题时，优先验证运行环境一致性，而不是先怀疑业务逻辑。**

> **先确认你看到的是不是"当前进程的真实状态"，再谈代码优化。**

---

_最后更新：2026-03-29 04:00_
