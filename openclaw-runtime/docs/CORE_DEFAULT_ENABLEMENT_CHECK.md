# Core Default Enablement Check

**阶段**: Wave 3: Production Default Enablement  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**目的**: 定义 Core 组件默认启用标准与验证清单

---

## 一、概述

### 目的

明确**哪些 Core 组件必须默认启用**，以及默认启用后的健康检查标准。

### 适用范围

- OpenClaw Runtime 默认配置
- 生产环境部署
- Gray 10% / Gray 50% / Gray 100% 各阶段

### 核心原则

| 原则 | 说明 |
|------|------|
| **安全默认** | 默认启用经过验证的安全组件 |
| **最小权限** | 默认配置遵循最小权限原则 |
| **可追溯** | 所有默认值可追溯、可验证 |
| **Gray 冻结** | Gray 期间核心配置冻结 |

---

## 二、Core 组件清单

### 必须默认启用的 Core 组件 (4 个)

| 组件 | 标识 | 用途 | 默认状态 |
|------|------|------|---------|
| **Health Monitor** | `core.health` | 健康检查与监控 | ✅ Enabled |
| **Event Bus** | `core.event-bus` | 事件分发与订阅 | ✅ Enabled |
| **Config Manager** | `core.config` | 配置管理与热更新 | ✅ Enabled |
| **Logger** | `core.logger` | 结构化日志记录 | ✅ Enabled |

### 可选启用的 Core 组件

| 组件 | 标识 | 用途 | 默认状态 | 说明 |
|------|------|------|---------|------|
| **Metrics Collector** | `core.metrics` | 指标收集 | ⏳ Optional | 依赖外部存储 |
| **Alerting** | `core.alerting` | 告警推送 | ⏳ Optional | 依赖通知渠道 |
| **Tracing** | `core.tracing` | 分布式追踪 | ⏳ Optional | 依赖 APM 系统 |

---

## 三、启动前置条件

### core.health (Health Monitor)

**前置条件**:
- [ ] HTTP 服务器已启动
- [ ] 健康检查端点已注册 (`/health`)
- [ ] 检查间隔配置有效 (默认：30s)

**验证命令**:
```bash
curl -s http://localhost:3101/health | jq '.ok'
# 预期：true
```

---

### core.event-bus (Event Bus)

**前置条件**:
- [ ] 事件队列已初始化
- [ ] 订阅者注册机制就绪
- [ ] 事件持久化配置 (可选)

**验证命令**:
```bash
# 发布测试事件
curl -X POST http://localhost:3101/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{"message":"hello"}}'

# 检查事件日志
tail -n 10 logs/events.log
```

---

### core.config (Config Manager)

**前置条件**:
- [ ] 配置文件存在 (`config/runtime.json`)
- [ ] 配置 Schema 已定义
- [ ] 配置验证器已注册

**验证命令**:
```bash
curl -s http://localhost:3101/config | jq '.ok'
# 预期：true
```

---

### core.logger (Logger)

**前置条件**:
- [ ] 日志目录可写 (`logs/`)
- [ ] 日志级别配置有效
- [ ] 日志轮转策略已配置

**验证命令**:
```bash
# 检查日志文件
ls -lh logs/*.log

# 检查日志内容
tail -n 20 logs/app.log
```

---

## 四、禁用策略

### 允许禁用的场景

| 组件 | 允许禁用 | 环境 | 说明 |
|------|---------|------|------|
| core.health | ❌ 不允许 | 所有 | 健康检查必须启用 |
| core.event-bus | ❌ 不允许 | 所有 | 事件总线必须启用 |
| core.config | ❌ 不允许 | 所有 | 配置管理必须启用 |
| core.logger | ❌ 不允许 | 所有 | 日志记录必须启用 |
| core.metrics | ✅ 允许 | Dev/Test | 指标收集可选 |
| core.alerting | ✅ 允许 | Dev/Test | 告警推送可选 |
| core.tracing | ✅ 允许 | Dev/Test | 追踪可选 |

### 禁用方法

**环境变量**:
```bash
# 禁用可选组件
export RUNTIME_CORE_METRICS_ENABLED=false
export RUNTIME_CORE_ALERTING_ENABLED=false
```

**配置文件**:
```json
{
  "core": {
    "metrics": { "enabled": false },
    "alerting": { "enabled": false }
  }
}
```

---

## 五、Gray 期间冻结策略

### Gray 10% / Gray 50% / Gray 100%

| 配置项 | Gray 10% | Gray 50% | Gray 100% |
|--------|---------|---------|----------|
| Core 组件启用状态 | 🔒 冻结 | 🔒 冻结 | 🔒 冻结 |
| Core 组件配置 | 🔒 冻结 | 🟡 可调整 | 🟡 可调整 |
| 可选组件启用 | 🔒 冻结 | 🟡 可调整 | ✅ 开放 |

### 冻结原因

- Gray 期间需要**稳定观察**
- 配置变更会**污染观察结果**
- Core 组件是**系统基础**，不宜频繁变动

### 例外情况

| 场景 | 处理 |
|------|------|
| P0 事件 (安全漏洞) | 立即修复，不受冻结限制 |
| P1 事件 (功能缺陷) | 评估后修复，记录变更 |
| 性能优化 | 延迟到 Gray 结束后 |

---

## 六、健康检查项

### 启动后验证 (Post-Startup Verification)

**执行时机**: 实例启动后 5 分钟内

| 检查项 | 方法 | 预期 | 严重性 |
|--------|------|------|--------|
| Health 端点 | `GET /health` | `{"ok":true}` | P0 |
| Config 端点 | `GET /config` | `{"ok":true}` | P0 |
| 日志写入 | 检查 `logs/app.log` | 有内容 | P0 |
| 事件总线 | 发布测试事件 | 成功 | P1 |
| 内存使用 | `ps -o rss=` | < 100MB | P1 |
| 启动时长 | 计时 | < 10s | P2 |

### 持续监控 (Continuous Monitoring)

| 指标 | 阈值 | 检查频率 | 告警级别 |
|------|------|---------|---------|
| 健康检查失败 | 连续 3 次 | 30s | P0 |
| 内存增长 | > 10MB/h | 5min | P1 |
| 错误日志 | > 10/min | 1min | P1 |
| 事件积压 | > 1000 | 1min | P2 |

---

## 七、验证清单

### 部署前验证

- [ ] 所有 Core 组件已启用
- [ ] 配置文件已验证
- [ ] 日志目录可写
- [ ] 健康检查端点可访问
- [ ] 事件总线可发布/订阅

### 部署后验证

- [ ] 实例启动成功
- [ ] 健康检查通过
- [ ] 日志正常写入
- [ ] 内存使用正常
- [ ] 无 P0/P1 事件

### Gray 期间验证

- [ ] 配置未变更 (冻结)
- [ ] 健康检查持续通过
- [ ] 无异常告警
- [ ] 性能指标稳定

---

## 八、故障排查

### 常见问题

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| Health 端点返回 false | 组件未就绪 | 检查组件状态 |
| 日志不写入 | 目录权限问题 | `chmod 755 logs/` |
| 事件总线失败 | 队列满 | 增加队列容量 |
| 配置加载失败 | JSON 格式错误 | 验证配置文件 |

### 诊断命令

```bash
# 检查实例状态
ps aux | grep "node dist/server"

# 检查端口占用
lsof -i :3101

# 检查日志错误
grep "ERROR" logs/app.log | tail -n 20

# 检查内存使用
ps -o pid,rss,command -p $(cat pids/instance-1.pid)
```

---

## 九、附录

### Core 组件依赖关系

```
core.logger (基础)
    ↓
core.config (依赖 logger)
    ↓
core.health (依赖 config + logger)
    ↓
core.event-bus (依赖 config + logger)
```

### 配置示例

```json
{
  "core": {
    "health": {
      "enabled": true,
      "interval_seconds": 30,
      "endpoint": "/health"
    },
    "event-bus": {
      "enabled": true,
      "queue_size": 10000,
      "persist": false
    },
    "config": {
      "enabled": true,
      "file": "config/runtime.json",
      "hot_reload": true
    },
    "logger": {
      "enabled": true,
      "level": "info",
      "format": "json",
      "output": "logs/app.log"
    }
  }
}
```

---

_文档版本：1.0_  
_最后更新：2026-04-06_  
_下次审查：Gray 100% 后_
