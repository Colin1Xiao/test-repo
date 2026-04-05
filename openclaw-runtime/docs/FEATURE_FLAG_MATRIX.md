# Feature Flag Matrix

**阶段**: Wave 2-B: Runtime Defaultization  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**依赖**: 
- CORE_MODULE_PLUGIN_CLASSIFICATION.md ✅
- DEFAULT_ENABLEMENT_POLICY.md ✅

---

## 一、Flag 命名规范

### 格式

```
<layer>.<component>.<setting>
```

**示例**:
- `core.registry.enabled`
- `modules.stale_cleanup.enabled`
- `modules.metrics.collect_interval_ms`
- `plugins.github.enabled`

### 类型

| 类型 | 格式 | 示例 |
|------|------|------|
| Boolean | `enabled`, `auto_*` | `true` / `false` |
| Integer | `*_ms`, `*_count`, `max_*` | `30000`, `10` |
| String | `*_dir`, `*_file`, `endpoint` | `"./data"`, `"http://..."` |
| Enum | `log_level`, `severity` | `"INFO"`, `"P0"` |

---

## 二、Core 层 Flags

### Instance Registry

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `core.registry.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | 🔒 Frozen | Leadership |
| `core.registry.instance_id_file` | String | `"./data/instance_id.json"` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.registry.data_dir` | String | `"./data/registry"` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.registry.heartbeat_interval_ms` | Integer | `30000` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.registry.auto_heartbeat` | Boolean | `true` | ✅ Yes | ⚠️ Record | ⚠️ Record | On-call |

### Lease Manager

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `core.lease.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | 🔒 Frozen | Leadership |
| `core.lease.data_dir` | String | `"./data/shared/leases"` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.lease.default_ttl_ms` | Integer | `30000` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.lease.max_ttl_ms` | Integer | `300000` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.lease.auto_cleanup` | Boolean | `true` | ✅ Yes | ⚠️ Record | ⚠️ Record | On-call |

### Work Item Coordinator

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `core.item.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | 🔒 Frozen | Leadership |
| `core.item.data_dir` | String | `"./data/shared/items"` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.item.default_lease_ttl_ms` | Integer | `30000` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.item.auto_cleanup` | Boolean | `true` | ✅ Yes | ⚠️ Record | ⚠️ Record | On-call |

### Duplicate Suppression Manager

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `core.suppression.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | 🔒 Frozen | Leadership |
| `core.suppression.data_dir` | String | `"./data/shared/suppression"` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.suppression.default_ttl_ms` | Integer | `60000` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.suppression.scope_ttls` | Object | `{claim: 30000, complete: 60000}` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |
| `core.suppression.auto_cleanup` | Boolean | `true` | ✅ Yes | ⚠️ Record | ⚠️ Record | On-call |
| `core.suppression.replay_safe_mode` | Boolean | `true` | ✅ Yes | ⚠️ Record | ⚠️ Record | On-call |

---

## 三、Module 层 Flags

### Stale Cleanup Manager

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `modules.stale_cleanup.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.stale_cleanup.cleanup_interval_ms` | Integer | `60000` | ✅ Yes | ⚠️ 10000-300000 | ⚠️ 10000-300000 | On-call |
| `modules.stale_cleanup.stale_threshold_ms` | Integer | `90000` | ✅ Yes | ⚠️ 60000-600000 | ⚠️ 60000-600000 | On-call |

### Snapshot Manager

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `modules.snapshot.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.snapshot.snapshot_interval_ms` | Integer | `300000` | ✅ Yes | ⚠️ 60000-3600000 | ⚠️ 60000-3600000 | On-call |
| `modules.snapshot.max_snapshots` | Integer | `10` | ✅ Yes | ⚠️ 1-100 | ⚠️ 1-100 | On-call |
| `modules.snapshot.compression_enabled` | Boolean | `true` | ✅ Yes | ✅ Yes | ✅ Yes | On-call |

### Health Monitor

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `modules.health_monitor.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.health_monitor.check_interval_ms` | Integer | `30000` | ✅ Yes | ⚠️ 10000-60000 | ⚠️ 10000-60000 | On-call |
| `modules.health_monitor.report_interval_ms` | Integer | `60000` | ✅ Yes | ⚠️ 30000-300000 | ⚠️ 30000-300000 | On-call |

### Metrics Collector

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `modules.metrics.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | ⚠️ Change | PM + Tech Lead |
| `modules.metrics.collect_interval_ms` | Integer | `10000` | ✅ Yes | ⚠️ 1000-60000 | ⚠️ 1000-60000 | On-call |
| `modules.metrics.retention_hours` | Integer | `24` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.metrics.prometheus_port` | Integer | `9090` | ❌ No | 🔒 Frozen | 🔒 Frozen | Tech Lead |

### Alerting Service

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `modules.alerting.enabled` | Boolean | `true` | ❌ No | 🔒 Frozen | ⚠️ Change | PM + Tech Lead |
| `modules.alerting.p0_threshold_error_rate` | Float | `0.01` (1%) | ❌ No | 🔒 Frozen | 🔒 Frozen | Leadership |
| `modules.alerting.p1_threshold_latency_ms` | Integer | `500` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.alerting.p2_threshold_memory_mb` | Integer | `50` | ❌ No | 🔒 Frozen | ⚠️ Change | Tech Lead |
| `modules.alerting.webhook_url` | String | `""` | ✅ Yes | ⚠️ Record | ✅ Yes | On-call |

---

## 四、Plugin 层 Flags

### GitHub Connector

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `plugins.github.enabled` | Boolean | `false` | ❌ No | 🔒 Disabled | ⚠️ Opt-in | PM + Tech Lead |
| `plugins.github.endpoint` | String | `"https://api.github.com"` | ✅ Yes | N/A | ✅ Yes | On-call |
| `plugins.github.timeout_ms` | Integer | `30000` | ✅ Yes | N/A | ✅ Yes | On-call |
| `plugins.github.retry_count` | Integer | `3` | ✅ Yes | N/A | ✅ Yes | On-call |

### Jenkins Connector

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `plugins.jenkins.enabled` | Boolean | `false` | ❌ No | 🔒 Disabled | ⚠️ Opt-in | PM + Tech Lead |
| `plugins.jenkins.endpoint` | String | `""` | ✅ Yes | N/A | ✅ Yes | On-call |
| `plugins.jenkins.timeout_ms` | Integer | `30000` | ✅ Yes | N/A | ✅ Yes | On-call |
| `plugins.jenkins.retry_count` | Integer | `3` | ✅ Yes | N/A | ✅ Yes | On-call |

### Trading Pack

| Flag | 类型 | 默认值 | 热更新 | Gray 10% | Production | 审批 |
|------|------|--------|-------|---------|-----------|------|
| `plugins.trading.enabled` | Boolean | `false` | ❌ No | 🔒 Disabled | ⚠️ Opt-in | PM + Tech Lead |
| `plugins.trading.provider` | Enum | `"okx"` | ❌ No | N/A | ⚠️ Change | Tech Lead |
| `plugins.trading.testnet` | Boolean | `true` | ✅ Yes | N/A | ⚠️ Record | Tech Lead |

---

## 五、环境差异矩阵

### Flag 行为对比

| Flag | Local Dev | Multi-Instance | Gray 10% | Production |
|------|-----------|----------------|----------|------------|
| **Core enabled** | ✅ True | ✅ True | ✅ True | ✅ True |
| **Module enabled** | ✅ True | ✅ True | ✅ True | ✅ True |
| **Plugin enabled** | ⚠️ Config | ⚠️ Config | ❌ False | ⚠️ Config |
| **Core config** | ✏️ Free | ✏️ Record | 🔒 Frozen | 🔒 Frozen |
| **Module config** | ✏️ Free | ✏️ Record | ⚠️ Limited | ⚠️ Change |
| **Plugin config** | ✏️ Free | ✏️ Record | N/A | ✏️ Opt-in |

### 图例

| 符号 | 含义 |
|------|------|
| ✅ | 默认启用/允许 |
| ❌ | 默认禁用/禁止 |
| ⚠️ | 受限/需审批 |
| 🔒 | 冻结 (不可修改) |
| ✏️ | 可修改 |
| N/A | 不适用 |

---

## 六、热更新能力

### 支持热更新的 Flags

| Flag | 热更新方式 | 生效延迟 | 回滚方式 |
|------|-----------|---------|---------|
| `core.*.auto_*` | API PATCH | < 1s | API PATCH |
| `modules.*.enabled` | ❌ No | N/A | 重启 |
| `modules.*.*_interval_ms` | API PATCH | < 1s | API PATCH |
| `modules.*.*_threshold_ms` | ❌ No (Gray) | N/A | 重启 |
| `plugins.*.endpoint` | API PATCH | < 1s | API PATCH |

### 热更新 API

```typescript
// PATCH /api/v1/config/flags
interface UpdateFlagRequest {
  flag: string;
  value: string | number | boolean;
  reason: string;
}

interface UpdateFlagResponse {
  success: boolean;
  previous_value: any;
  new_value: any;
  effective_at: string;
}
```

---

## 七、Gray 10% 冻结清单

### 🔒 完全冻结 (禁止任何修改)

**Core 层**:
- `core.registry.enabled`
- `core.registry.instance_id_file`
- `core.registry.data_dir`
- `core.registry.heartbeat_interval_ms`
- `core.lease.enabled`
- `core.lease.data_dir`
- `core.lease.default_ttl_ms`
- `core.lease.max_ttl_ms`
- `core.item.enabled`
- `core.item.data_dir`
- `core.item.default_lease_ttl_ms`
- `core.suppression.enabled`
- `core.suppression.data_dir`
- `core.suppression.default_ttl_ms`
- `core.suppression.scope_ttls`

**Module 层**:
- `modules.stale_cleanup.enabled`
- `modules.snapshot.enabled`
- `modules.health_monitor.enabled`
- `modules.metrics.enabled`
- `modules.alerting.enabled`
- `modules.alerting.p0_threshold_error_rate`
- `modules.alerting.p1_threshold_latency_ms`
- `modules.alerting.p2_threshold_memory_mb`

**Plugin 层**:
- 所有 `plugins.*.enabled` (保持禁用)

### ⚠️ 受限修改 (需 Tech Lead 审批)

| Flag | 允许范围 | 审批 |
|------|---------|------|
| `modules.stale_cleanup.cleanup_interval_ms` | 10000-300000 | Tech Lead |
| `modules.stale_cleanup.stale_threshold_ms` | 60000-600000 | Tech Lead |
| `modules.snapshot.snapshot_interval_ms` | 60000-3600000 | Tech Lead |
| `modules.snapshot.max_snapshots` | 1-100 | Tech Lead |
| `modules.health_monitor.check_interval_ms` | 10000-60000 | Tech Lead |
| `modules.health_monitor.report_interval_ms` | 30000-300000 | Tech Lead |
| `modules.metrics.collect_interval_ms` | 1000-60000 | Tech Lead |

### ✅ 自由修改 (仅需记录)

| Flag | 允许范围 | 记录要求 |
|------|---------|---------|
| `core.*.auto_*` | true/false | 日志记录 |
| `core.lease.auto_cleanup` | true/false | 日志记录 |
| `core.item.auto_cleanup` | true/false | 日志记录 |
| `core.suppression.auto_cleanup` | true/false | 日志记录 |
| `core.suppression.replay_safe_mode` | true/false | 日志记录 |
| `modules.snapshot.compression_enabled` | true/false | 日志记录 |
| `modules.alerting.webhook_url` | 任意 URL | 日志记录 |
| `plugins.*.timeout_ms` | 1000-60000 | 日志记录 |
| `plugins.*.retry_count` | 0-10 | 日志记录 |

---

## 八、配置审计日志

### 审计要求

| 修改类型 | 记录内容 | 保留期 |
|---------|---------|-------|
| Type A/B (自由) | flag, old_value, new_value, timestamp, user | 30 天 |
| Type C/D (Tech Lead) | + reason, approval_id | 90 天 |
| Type E/F (Leadership) | + risk_assessment, rollback_plan | 1 年 |

### 审计日志格式

```json
{
  "timestamp": "2026-04-06T00:00:00Z",
  "flag": "modules.stale_cleanup.cleanup_interval_ms",
  "old_value": 60000,
  "new_value": 120000,
  "user": "on-call-1",
  "reason": "Reduce cleanup frequency during Gray 10%",
  "approval_id": "TL-2026-04-06-001",
  "environment": "gray-10",
  "rollback_plan": "Revert to 60000 if issues observed"
}
```

---

## 九、紧急修改流程

### P0 事件响应

```
1. 识别问题 (On-call)
   ↓
2. 电话批准 (Tech Lead, 5min)
   ↓
3. 执行修改 (On-call)
   ↓
4. 记录修改 (自动)
   ↓
5. 观察效果 (15min)
   ↓
6. 事后审查 (24h)
```

### 紧急修改记录

```markdown
## Emergency Change #XXX

**Date**: 2026-04-XX  
**Flag**: [flag name]  
**Old Value**: [value]  
**New Value**: [value]  
**Reason**: [P0 incident description]  
**Approved By**: [Tech Lead name]  
**Approval Time**: [timestamp]  
**Executed By**: [On-call name]  
**Execution Time**: [timestamp]  
**Result**: [Success/Failure]  
**Post-Review**: [24h review result]
```

---

## 十、验证清单

### 部署验证

- [ ] 所有 Core flags 使用默认值
- [ ] 所有 Module flags 使用默认值
- [ ] 所有 Plugin flags 为禁用状态
- [ ] Gray 10% 冻结项已锁定
- [ ] 热更新 API 正常工作

### 运行验证

- [ ] 修改 Type A/B flags 生效
- [ ] 修改 Type C/D flags 需要审批
- [ ] 修改冻结项被拒绝
- [ ] 审计日志正确记录
- [ ] 回滚功能正常

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-06_  
_下次审查：Gray 10% 完成后_
