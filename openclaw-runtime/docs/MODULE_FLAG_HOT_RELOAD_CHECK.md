# Module Flag Hot Reload Check

**阶段**: Wave 3: Production Default Enablement  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**目的**: 定义 Module Flag 热更新规则与安全边界

---

## 一、概述

### 目的

明确**哪些 Module Flag 支持热更新**，以及热更新的安全边界和回退机制。

### 适用范围

- OpenClaw Runtime Module 配置
- 生产环境热更新操作
- Gray 10% / Gray 50% / Gray 100% 各阶段

### 核心原则

| 原则 | 说明 |
|------|------|
| **安全优先** | 不影响核心语义的热更新才允许 |
| **可回退** | 所有热更新必须支持快速回退 |
| **可追溯** | 所有变更必须记录审计日志 |
| **Gray 限制** | Gray 期间限制热更新范围 |

---

## 二、Module Flag 分类

### 支持热更新的 Flag (Hot-Reload Safe)

| Flag | 用途 | 热更新 | 影响范围 | 说明 |
|------|------|-------|---------|------|
| `module.log_level` | 日志级别 | ✅ 支持 | 本模块 | 立即生效 |
| `module.feature_toggle` | 功能开关 | ✅ 支持 | 本模块 | 需验证 |
| `module.rate_limit` | 速率限制 | ✅ 支持 | 本模块 | 立即生效 |
| `module.timeout_ms` | 超时配置 | ✅ 支持 | 本模块 | 新请求生效 |
| `module.retry_count` | 重试次数 | ✅ 支持 | 本模块 | 新操作生效 |
| `module.cache_ttl` | 缓存过期 | ✅ 支持 | 本模块 | 新缓存生效 |

### 需要重启的 Flag (Restart Required)

| Flag | 用途 | 热更新 | 影响范围 | 说明 |
|------|------|-------|---------|------|
| `module.port` | 监听端口 | ❌ 不支持 | 本模块 | 需重启 |
| `module.database_url` | 数据库连接 | ❌ 不支持 | 本模块 | 需重启 |
| `module.api_key` | API 密钥 | ❌ 不支持 | 本模块 | 需重启 |
| `module.storage_path` | 存储路径 | ❌ 不支持 | 本模块 | 需重启 |

### 禁止修改的 Flag (Frozen)

| Flag | 用途 | 热更新 | 原因 |
|------|------|-------|------|
| `module.lease_semantic` | Lease 语义 | 🔒 禁止 | 核心协议 |
| `module.item_semantic` | Item 语义 | 🔒 禁止 | 核心协议 |
| `module.suppression_rule` | Suppression 规则 | 🔒 禁止 | 核心协议 |
| `module.coordination_protocol` | 协调协议 | 🔒 禁止 | 核心协议 |

---

## 三、热更新影响分析

### 对核心路径的影响

| 核心路径 | 热更新影响 | 风险等级 |
|---------|----------|---------|
| **Lease 管理** | 无影响 (语义冻结) | 🟢 安全 |
| **Item 管理** | 无影响 (语义冻结) | 🟢 安全 |
| **Suppression** | 无影响 (规则冻结) | 🟢 安全 |
| **Runtime 协调** | 无影响 (协议冻结) | 🟢 安全 |
| **日志记录** | 日志级别可变 | 🟢 安全 |
| **速率限制** | 阈值可变 | 🟡 需注意 |

### 热更新传播机制

```
Config Change
    ↓
Config Manager (core.config)
    ↓
Event Bus (core.event-bus) → CONFIG_CHANGED event
    ↓
Module A (订阅者) → 重新加载配置
Module B (订阅者) → 重新加载配置
Module C (订阅者) → 重新加载配置
    ↓
验证健康状态
```

---

## 四、热更新流程

### 标准流程

```
1. 提交配置变更
       ↓
2. 配置验证 (Schema + 业务规则)
       ↓
3. 发布 CONFIG_CHANGED 事件
       ↓
4. 模块接收并应用新配置
       ↓
5. 模块健康检查
       ↓
6. 成功 → 记录审计日志
   失败 → 自动回退
```

### 配置验证

**Schema 验证**:
```json
{
  "type": "object",
  "properties": {
    "log_level": { "type": "string", "enum": ["debug", "info", "warn", "error"] },
    "rate_limit": { "type": "integer", "minimum": 1, "maximum": 10000 }
  }
}
```

**业务规则验证**:
- 日志级别不能为空
- 速率限制必须在合理范围
- 超时不能小于 100ms

### 健康检查

**检查项**:
- [ ] 模块响应正常
- [ ] 无异常日志
- [ ] 性能指标正常
- [ ] 核心功能可用

---

## 五、热更新失败回退

### 自动回退机制

**触发条件**:
- 配置应用后健康检查失败
- 模块抛出异常
- P0/P1 事件触发

**回退流程**:
```
检测到失败
    ↓
加载上一版本配置
    ↓
重新应用配置
    ↓
验证健康状态
    ↓
成功 → 记录回退日志
失败 → 告警 + 人工介入
```

### 回退时间目标

| 场景 | 目标时间 | 说明 |
|------|---------|------|
| 自动回退 | < 30s | 配置应用失败 |
| 手动回退 | < 5min | 需要人工判断 |
| 紧急回退 | < 1min | P0 事件触发 |

---

## 六、Gray 期间限制

### Gray 10% 期间

| 操作 | 状态 | 说明 |
|------|------|------|
| 日志级别调整 | ✅ 允许 | 低风险 |
| 速率限制调整 | 🟡 需审批 | 可能影响观察 |
| 功能开关切换 | 🟡 需审批 | 需验证 |
| 核心协议修改 | 🔒 禁止 | 冻结 |
| 语义规则修改 | 🔒 禁止 | 冻结 |

### Gray 50% 期间

| 操作 | 状态 | 说明 |
|------|------|------|
| 日志级别调整 | ✅ 允许 | 低风险 |
| 速率限制调整 | ✅ 允许 | 风险可控 |
| 功能开关切换 | ✅ 允许 | 需验证 |
| 核心协议修改 | 🔒 禁止 | 冻结 |
| 语义规则修改 | 🔒 禁止 | 冻结 |

### Gray 100% 期间

| 操作 | 状态 | 说明 |
|------|------|------|
| 日志级别调整 | ✅ 允许 | 低风险 |
| 速率限制调整 | ✅ 允许 | 风险可控 |
| 功能开关切换 | ✅ 允许 | 需验证 |
| 核心协议修改 | 🟡 需审批 | 需评估 |
| 语义规则修改 | 🟡 需审批 | 需评估 |

---

## 七、审计与追溯

### 审计日志格式

```json
{
  "timestamp": "2026-04-06T02:30:00Z",
  "event": "CONFIG_CHANGED",
  "module": "module-a",
  "flag": "log_level",
  "old_value": "info",
  "new_value": "debug",
  "operator": "admin",
  "reason": "Debug production issue",
  "result": "success",
  "rollback_available": true
}
```

### 追溯查询

**查询命令**:
```bash
# 查询配置变更历史
grep "CONFIG_CHANGED" logs/audit.log | jq '.'

# 查询特定模块的变更
grep "module-a" logs/audit.log | jq '.'

# 查询回退事件
grep "ROLLBACK" logs/audit.log | jq '.'
```

---

## 八、验证清单

### 热更新前验证

- [ ] 配置变更已审批
- [ ] 影响范围已评估
- [ ] 回退方案已准备
- [ ] 健康检查已定义
- [ ] 审计日志已启用

### 热更新后验证

- [ ] 配置已应用
- [ ] 健康检查通过
- [ ] 无异常日志
- [ ] 性能指标正常
- [ ] 审计日志已记录

### Gray 期间额外验证

- [ ] 变更符合 Gray 限制
- [ ] 观察结果不受污染
- [ ] 变更已记录到日报

---

## 九、故障排查

### 常见问题

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| 配置不生效 | 事件未送达 | 检查 Event Bus |
| 模块异常 | 配置值非法 | 验证配置 Schema |
| 回退失败 | 旧配置丢失 | 检查配置备份 |
| 审计日志缺失 | 日志级别过高 | 调整为 info |

### 诊断命令

```bash
# 检查当前配置
curl -s http://localhost:3101/config | jq '.modules'

# 检查配置历史
tail -n 50 logs/audit.log | jq '.'

# 检查模块状态
curl -s http://localhost:3101/health | jq '.modules'
```

---

## 十、附录

### Flag 命名规范

```
<module>.<category>.<name>

示例:
- module-a.log.level
- module-a.rate_limit.requests_per_second
- module-b.feature.new_ui_enabled
```

### 配置 Schema 示例

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "modules": {
      "type": "object",
      "properties": {
        "module-a": {
          "type": "object",
          "properties": {
            "log_level": {
              "type": "string",
              "enum": ["debug", "info", "warn", "error"]
            },
            "rate_limit": {
              "type": "integer",
              "minimum": 1,
              "maximum": 10000
            }
          }
        }
      }
    }
  }
}
```

---

_文档版本：1.0_  
_最后更新：2026-04-06_  
_下次审查：Gray 100% 后_
