# Bootstrap Defaults Validation

**阶段**: Wave 3: Production Default Enablement  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**目的**: 定义 Bootstrap 默认配置清单与验证流程

---

## 一、概述

### 目的

明确**Bootstrap 默认配置清单**，以及启动后的验证步骤和与冒烟测试的对应关系。

### 适用范围

- OpenClaw Runtime 启动流程
- 默认配置验证
- 生产环境部署验证

### 核心原则

| 原则 | 说明 |
|------|------|
| **默认安全** | 缺省配置下系统可安全启动 |
| **可验证** | 所有默认值可验证 |
| **可追溯** | 配置来源可追溯 |
| **与测试对应** | 验证步骤与冒烟测试对应 |

---

## 二、Bootstrap 默认配置清单

### 环境配置 (Environment)

| 变量 | 默认值 | 说明 | 必填 |
|------|--------|------|------|
| `NODE_ENV` | `production` | 运行环境 | ✅ |
| `RUNTIME_PORT` | `3101` | HTTP 端口 | ✅ |
| `RUNTIME_HOST` | `0.0.0.0` | 监听地址 | ✅ |
| `RUNTIME_LOG_LEVEL` | `info` | 日志级别 | ✅ |
| `RUNTIME_CONFIG_FILE` | `config/runtime.json` | 配置文件路径 | ✅ |

### Core 组件配置

| 组件 | 配置项 | 默认值 | 说明 |
|------|--------|--------|------|
| **core.health** | `enabled` | `true` | 健康检查启用 |
| | `interval_seconds` | `30` | 检查间隔 |
| | `endpoint` | `/health` | 端点路径 |
| **core.event-bus** | `enabled` | `true` | 事件总线启用 |
| | `queue_size` | `10000` | 队列大小 |
| | `persist` | `false` | 持久化 |
| **core.config** | `enabled` | `true` | 配置管理启用 |
| | `hot_reload` | `true` | 热更新启用 |
| **core.logger** | `enabled` | `true` | 日志启用 |
| | `level` | `info` | 日志级别 |
| | `format` | `json` | 日志格式 |

### Module 配置

| 模块 | 配置项 | 默认值 | 说明 |
|------|--------|--------|------|
| **module-a** | `enabled` | `true` | 模块启用 |
| | `port` | `3101` | 监听端口 |
| | `log_level` | `info` | 日志级别 |
| **module-b** | `enabled` | `true` | 模块启用 |
| | `port` | `3102` | 监听端口 |
| | `log_level` | `info` | 日志级别 |

### Plugin 配置

| 插件 | 配置项 | 默认值 | 说明 |
|------|--------|--------|------|
| **plugin-x** | `enabled` | `false` | 插件启用 |
| | `config_path` | `plugins/plugin-x/config.json` | 配置路径 |

---

## 三、默认值来源优先级

### 优先级顺序 (从高到低)

```
1. 环境变量 (最高优先级)
       ↓
2. 命令行参数
       ↓
3. 用户配置文件 (config/runtime.json)
       ↓
4. 默认配置文件 (config/default.json)
       ↓
5. 代码内默认值 (最低优先级)
```

### 示例

**环境变量覆盖**:
```bash
export RUNTIME_PORT=3200
export RUNTIME_LOG_LEVEL=debug
```

**命令行参数覆盖**:
```bash
node dist/server.js --port 3200 --log-level debug
```

**配置文件覆盖**:
```json
{
  "runtime": {
    "port": 3200,
    "log_level": "debug"
  }
}
```

---

## 四、缺省配置下的启动结果

### 完全缺省 (无任何配置)

**预期行为**:
- 使用代码内默认值
- 端口：3101
- 日志级别：info
- Core 组件：全部启用
- 启动成功：✅

**验证命令**:
```bash
# 启动
node dist/server.js

# 验证健康
curl -s http://localhost:3101/health | jq '.ok'
# 预期：true
```

### 部分配置 (仅环境变量)

**预期行为**:
- 环境变量覆盖默认值
- 未设置的变量使用默认值
- 启动成功：✅

**验证命令**:
```bash
# 设置环境变量
export RUNTIME_PORT=3200
export RUNTIME_LOG_LEVEL=debug

# 启动
node dist/server.js

# 验证
curl -s http://localhost:3201/health | jq '.'
```

### 完整配置 (配置文件)

**预期行为**:
- 配置文件覆盖默认值
- 环境变量可进一步覆盖
- 启动成功：✅

**验证命令**:
```bash
# 使用配置文件
node dist/server.js --config config/production.json

# 验证
curl -s http://localhost:3101/config | jq '.'
```

---

## 五、Core/Module/Plugin 默认装配结果

### 装配顺序

```
1. Bootstrap 初始化
       ↓
2. 加载环境变量
       ↓
3. 加载配置文件
       ↓
4. 初始化 Core 组件
       ↓
5. 注册 Module
       ↓
6. 加载 Plugin (可选)
       ↓
7. 启动 HTTP 服务器
       ↓
8. 健康检查通过
```

### 装配验证

**Core 组件**:
```bash
curl -s http://localhost:3101/health | jq '.core'
# 预期：所有 Core 组件状态为 "ok"
```

**Module**:
```bash
curl -s http://localhost:3101/health | jq '.modules'
# 预期：已启用模块状态为 "ok"
```

**Plugin**:
```bash
curl -s http://localhost:3101/health | jq '.plugins'
# 预期：已启用插件状态为 "ok"
```

---

## 六、启动后验证步骤

### Step 1: 健康检查 (P0)

**验证项**:
- [ ] `/health` 端点可访问
- [ ] 响应 `{"ok": true}`
- [ ] 所有 Core 组件状态正常

**命令**:
```bash
curl -s http://localhost:3101/health | jq '.'
```

**预期输出**:
```json
{
  "ok": true,
  "timestamp": "2026-04-06T02:30:00Z",
  "core": {
    "health": "ok",
    "event-bus": "ok",
    "config": "ok",
    "logger": "ok"
  }
}
```

---

### Step 2: 配置验证 (P0)

**验证项**:
- [ ] `/config` 端点可访问
- [ ] 配置值正确
- [ ] 热更新可用

**命令**:
```bash
curl -s http://localhost:3101/config | jq '.'
```

---

### Step 3: 日志验证 (P0)

**验证项**:
- [ ] 日志文件存在
- [ ] 日志内容正常
- [ ] 无 ERROR 级别日志

**命令**:
```bash
ls -lh logs/*.log
tail -n 20 logs/app.log
grep "ERROR" logs/app.log | wc -l
```

---

### Step 4: 内存验证 (P1)

**验证项**:
- [ ] 内存使用 < 100MB
- [ ] 内存增长稳定

**命令**:
```bash
ps -o pid,rss,command -p $(cat pids/instance-1.pid)
```

---

### Step 5: 功能验证 (P1/P2)

**验证项**:
- [ ] P0 冒烟测试通过
- [ ] P1 冒烟测试通过
- [ ] P2 冒烟测试通过

**命令**:
```bash
bash scripts/smoke-test-p0.sh 3101
bash scripts/smoke-test-p1.sh 3101
bash scripts/smoke-test-p2.sh 3101
```

---

## 七、与冒烟测试的对应关系

### P0 冒烟测试对应

| 验证步骤 | P0 测试项 | 说明 |
|---------|----------|------|
| 健康检查 | `test_health_endpoint` | `/health` 端点 |
| 配置验证 | `test_config_endpoint` | `/config` 端点 |
| 日志验证 | `test_log_writing` | 日志写入 |
| 内存验证 | `test_memory_usage` | 内存使用 |

### P1 冒烟测试对应

| 验证步骤 | P1 测试项 | 说明 |
|---------|----------|------|
| 功能验证 | `test_api_endpoints` | API 端点 |
| 事件总线 | `test_event_bus` | 事件发布/订阅 |
| 配置热更新 | `test_config_hot_reload` | 热更新 |

### P2 冒烟测试对应

| 验证步骤 | P2 测试项 | 说明 |
|---------|----------|------|
| 并发测试 | `test_concurrent_requests` | 并发请求 |
| 回滚验证 | `test_rollback_health` | 回滚健康 |
| 日志轮转 | `test_log_rotation` | 日志轮转 |

---

## 八、验证清单

### 启动前验证

- [ ] 环境变量已设置
- [ ] 配置文件存在
- [ ] 日志目录可写
- [ ] 端口未被占用
- [ ] 依赖服务可用

### 启动后验证

- [ ] 进程启动成功
- [ ] 健康检查通过 (P0)
- [ ] 配置验证通过 (P0)
- [ ] 日志验证通过 (P0)
- [ ] 内存验证通过 (P1)
- [ ] P0 冒烟测试通过
- [ ] P1 冒烟测试通过
- [ ] P2 冒烟测试通过

### 生产环境额外验证

- [ ] 监控已接入
- [ ] 告警已配置
- [ ] 备份已启用
- [ ] 安全配置已验证

---

## 九、故障排查

### 常见问题

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| 启动失败 | 端口被占用 | `lsof -i :3101` |
| 健康检查失败 | Core 组件未就绪 | 检查组件日志 |
| 配置加载失败 | JSON 格式错误 | `jq '.' config/runtime.json` |
| 日志不写入 | 目录权限问题 | `chmod 755 logs/` |

### 诊断命令

```bash
# 检查进程状态
ps aux | grep "node dist/server"

# 检查端口占用
lsof -i :3101

# 检查配置文件
jq '.' config/runtime.json

# 检查日志错误
grep "ERROR" logs/app.log | tail -n 20

# 检查内存使用
ps -o pid,rss,command -p $(cat pids/instance-1.pid)
```

---

## 十、附录

### 完整配置示例

```json
{
  "runtime": {
    "port": 3101,
    "host": "0.0.0.0",
    "log_level": "info",
    "config_file": "config/runtime.json"
  },
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
      "hot_reload": true
    },
    "logger": {
      "enabled": true,
      "level": "info",
      "format": "json",
      "output": "logs/app.log"
    }
  },
  "modules": {
    "module-a": {
      "enabled": true,
      "port": 3101,
      "log_level": "info"
    },
    "module-b": {
      "enabled": true,
      "port": 3102,
      "log_level": "info"
    }
  },
  "plugins": {
    "plugin-x": {
      "enabled": false,
      "config_path": "plugins/plugin-x/config.json"
    }
  }
}
```

### 启动脚本示例

```bash
#!/bin/bash
# scripts/start-runtime.sh

set -e

# 设置环境变量
export NODE_ENV=production
export RUNTIME_PORT=3101
export RUNTIME_LOG_LEVEL=info

# 创建日志目录
mkdir -p logs

# 启动
node dist/server.js \
  --config config/runtime.json \
  --port $RUNTIME_PORT \
  --log-level $RUNTIME_LOG_LEVEL

# 验证健康
sleep 5
curl -s http://localhost:$RUNTIME_PORT/health | jq '.ok'
```

---

_文档版本：1.0_  
_最后更新：2026-04-06_  
_下次审查：Gray 100% 后_
