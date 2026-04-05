# Release Guardrail Mapping

**阶段**: Phase Y-1: Mechanism Asset Grounding  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、发布准入总则

### 护栏 G-0: 发布四原则

```
RELEASE FOUR PRINCIPLES

1. 不变性保护 (Invariant Protection)
   发布不得破坏任何不变性
   违反不变性 → 禁止发布

2. 向后兼容 (Backward Compatibility)
   发布必须兼容现有数据
   破坏性变更 → 需要迁移期

3. 可回滚 (Rollback Capability)
   发布必须可回滚
   无回滚方案 → 禁止发布

4. 可验证 (Verifiability)
   发布必须可验证
   无验证方案 → 禁止发布
```

---

## 二、Schema 变更准入

### 护栏 G-1: 新增字段

**触发条件**: 新增数据字段

**准入要求**:
- [ ] E-1: Schema 变更文档
- [ ] 向后兼容 (可选字段)
- [ ] 迁移脚本 (如需)
- [ ] 验证测试

**检查清单**:
```markdown
## Schema Change Checklist (Add Field)

- [ ] 文档更新 (event_schema_catalog.md)
- [ ] 迁移脚本 (如需)
- [ ] 向后兼容验证
- [ ] 测试用例更新
- [ ] 发布说明
```

**示例**:
```typescript
// Before
interface Incident {
  id: string;
  status: string;
  // ...
}

// After (backward compatible)
interface Incident {
  id: string;
  status: string;
  metadata?: Record<string, unknown>;  // New optional field
  // ...
}
```

### 护栏 G-2: 删除字段

**触发条件**: 删除数据字段

**准入要求**:
- [ ] E-1: Schema 变更文档
- [ ] 迁移期 (至少 30 天)
- [ ] 迁移脚本
- [ ] 影响评估

**检查清单**:
```markdown
## Schema Change Checklist (Remove Field)

- [ ] 文档更新 (event_schema_catalog.md)
- [ ] 迁移期定义 (至少 30 天)
- [ ] 迁移脚本
- [ ] 影响评估 (代码/测试/文档)
- [ ] 发布说明
- [ ] 废弃通知
```

**示例**:
```typescript
// Phase 1: Deprecate (30 days)
interface Incident {
  /** @deprecated Use metadata.old_field instead */
  old_field?: string;
  metadata?: Record<string, unknown>;
}

// Phase 2: Remove (after 30 days)
interface Incident {
  metadata?: Record<string, unknown>;
}
```

### 护栏 G-3: 类型变更

**触发条件**: 字段类型变更

**准入要求**:
- [ ] E-1: Schema 变更文档
- [ ] 转换逻辑
- [ ] 迁移脚本
- [ ] 验证测试

**检查清单**:
```markdown
## Schema Change Checklist (Type Change)

- [ ] 文档更新 (event_schema_catalog.md)
- [ ] 类型转换逻辑
- [ ] 迁移脚本
- [ ] 验证测试
- [ ] 回滚方案
- [ ] 发布说明
```

**示例**:
```typescript
// Before
interface Incident {
  created_at: number;  // timestamp (ms)
}

// After
interface Incident {
  created_at: string;  // ISO 8601
}

// Migration
async migrate(): Promise<void> {
  for (const incident of incidents) {
    incident.created_at = new Date(incident.created_at).toISOString();
  }
}
```

---

## 三、Audit 准入

### 护栏 G-4: 状态变更 Audit

**触发条件**: 新增状态变更操作

**准入要求**:
- [ ] C-5: 状态变更 Audit 一致性
- [ ] Audit 记录实现
- [ ] 验证测试

**检查清单**:
```markdown
## Audit Checklist (Status Change)

- [ ] Audit 记录实现 (audit_log_service.ts)
- [ ] metadata 完整 (from/to/actor/timestamp)
- [ ] 验证测试 (test_consistency_status_audit)
- [ ] 发布说明
```

**示例**:
```typescript
async updateStatus(incident_id: string, new_status: string, actor: string): Promise<void> {
  const incident = await this.getById(incident_id);
  const old_status = incident.status;
  
  // Update
  incident.status = new_status;
  await this.update(incident);
  
  // Audit (MUST)
  await this.audit.log({
    type: 'state_transition',
    object_type: 'incident',
    object_id: incident_id,
    actor,
    metadata: {
      from: old_status,
      to: new_status,
    },
  });
}
```

### 护栏 G-5: 新操作 Audit

**触发条件**: 新增业务操作

**准入要求**:
- [ ] W-7: Audit vs 业务动作顺序
- [ ] Audit 记录实现
- [ ] 验证测试

**检查清单**:
```markdown
## Audit Checklist (New Operation)

- [ ] Audit 记录实现
- [ ] 业务动作后记录 (非前)
- [ ] metadata 完整
- [ ] 验证测试
- [ ] 发布说明
```

### 护栏 G-6: 恢复动作 Audit

**触发条件**: 新增恢复操作

**准入要求**:
- [ ] R-6: Recovery 副作用抑制
- [ ] Audit 记录实现
- [ ] 验证测试

**检查清单**:
```markdown
## Audit Checklist (Recovery Action)

- [ ] Audit 记录实现 (recovery_safety_contract.md)
- [ ] 动作类型 (recovery_action)
- [ ] metadata 完整 (item_id/action/result)
- [ ] 验证测试
- [ ] 发布说明
```

---

## 四、Replay/Recovery 准入

### 护栏 G-7: 新业务对象 Replay/Recovery

**触发条件**: 新增可恢复对象

**准入要求**:
- [ ] R-5: Recovery 幂等
- [ ] 幂等检查实现
- [ ] 恢复流程定义
- [ ] 验证测试

**检查清单**:
```markdown
## Replay/Recovery Checklist (New Object)

- [ ] 幂等检查实现 (checkIfProcessed)
- [ ] 恢复流程定义
- [ ] 副作用评估
- [ ] 验证测试 (test_recovery_idempotency)
- [ ] 发布说明
```

**示例**:
```typescript
async recoverNewObject(obj: NewObject): Promise<void> {
  // Idempotency check (MUST)
  const processed = await this.checkIfProcessed(obj);
  if (processed) {
    await this.markAsRecovered(obj);
    return;
  }

  // Replay operation
  await this.replayOperation(obj);
  
  // Audit
  await this.audit.log({
    type: 'recovery_action',
    object_type: 'new_object',
    object_id: obj.id,
  });
}
```

### 护栏 G-8: 新状态 Recovery

**触发条件**: 新增状态类型

**准入要求**:
- [ ] R-0: 恢复三原则
- [ ] 恢复流程定义
- [ ] 验证测试

**检查清单**:
```markdown
## Replay/Recovery Checklist (New State)

- [ ] 恢复流程定义
- [ ] 幂等性保证
- [ ] 安全性保证
- [ ] 可追溯性保证
- [ ] 验证测试
- [ ] 发布说明
```

### 护栏 G-9: 新写入 Recovery

**触发条件**: 新增写入操作

**准入要求**:
- [ ] W-1~W-14: 写入顺序规则
- [ ] 顺序验证
- [ ] 验证测试

**检查清单**:
```markdown
## Replay/Recovery Checklist (New Write)

- [ ] 写入顺序定义 (write_ordering_rules.md)
- [ ] 顺序验证实现
- [ ] 验证测试
- [ ] 发布说明
```

---

## 五、Consistency Test 准入

### 护栏 G-10: Incident 变更

**触发条件**: Incident 相关变更

**准入要求**:
- [ ] C-1~C-3: Incident 一致性
- [ ] 一致性测试
- [ ] 验证通过

**检查清单**:
```markdown
## Consistency Test Checklist (Incident)

- [ ] test_consistency_incident_create()
- [ ] test_consistency_status_change()
- [ ] test_consistency_timeline_order()
- [ ] 测试通过
- [ ] 发布说明
```

### 护栏 G-11: Timeline 变更

**触发条件**: Timeline 相关变更

**准入要求**:
- [ ] C-3: Timeline 顺序一致性
- [ ] 一致性测试
- [ ] 验证通过

**检查清单**:
```markdown
## Consistency Test Checklist (Timeline)

- [ ] test_consistency_timeline_order()
- [ ] 测试通过
- [ ] 发布说明
```

### 护栏 G-12: Audit 变更

**触发条件**: Audit 相关变更

**准入要求**:
- [ ] C-4~C-7: Audit 一致性
- [ ] 一致性测试
- [ ] 验证通过

**检查清单**:
```markdown
## Consistency Test Checklist (Audit)

- [ ] test_consistency_incident_audit()
- [ ] test_consistency_status_audit()
- [ ] test_consistency_event_mapping()
- [ ] test_consistency_timestamp()
- [ ] 测试通过
- [ ] 发布说明
```

---

## 六、Platform Boundary 准入

### 护栏 G-13: 新功能

**触发条件**: 新增功能

**准入要求**:
- [ ] E-7: 平台化护栏
- [ ] 边界评估
- [ ] 通用化评估

**检查清单**:
```markdown
## Platform Boundary Checklist (New Feature)

- [ ] 边界评估 (platform_boundary.md)
- [ ] 通用化评估 (2+ 使用场景?)
- [ ] L1/L2/L3 分层正确
- [ ] 发布说明
```

### 护栏 G-14: 新 Connector

**触发条件**: 新增 Connector

**准入要求**:
- [ ] E-9: Connector 标准化护栏
- [ ] 接口规范
- [ ] 隔离实现

**检查清单**:
```markdown
## Platform Boundary Checklist (New Connector)

- [ ] 接口规范 (connector_event_sequence.md)
- [ ] 隔离实现 (不污染通用层)
- [ ] 可独立测试
- [ ] 发布说明
```

### 护栏 G-15: 多实例

**触发条件**: 多实例相关变更

**准入要求**:
- [ ] E-8: 多实例演进护栏
- [ ] 分布式锁
- [ ] 稳定性验证 (至少 7 天)

**检查清单**:
```markdown
## Platform Boundary Checklist (Multi-Instance)

- [ ] 分布式锁实现
- [ ] Session 所有权
- [ ] Item 所有权
- [ ] 心跳机制
- [ ] 稳定性验证 (至少 7 天)
- [ ] 发布说明
```

---

## 七、发布准入流程

### 7.1 准入评估

```
变更请求
    ↓
分类 (Schema/Audit/Recovery/Consistency/Boundary)
    ↓
适用护栏评估
    ↓
检查清单填写
    ↓
┌─────────────────────┐
│ 全部通过？          │
└─────────────────────┘
    │ Yes              │ No
    ↓                  ↓
批准发布          修复/补充
```

### 7.2 发布验证

**发布前**:
- [ ] 所有检查清单通过
- [ ] 测试通过
- [ ] 文档更新
- [ ] 回滚方案就绪

**发布后**:
- [ ] 观察期 (至少 24h)
- [ ] 指标监控
- [ ] 用户反馈
- [ ] 问题响应

---

## 八、违反处理

### 8.1 分级

| 级别 | 护栏 | 响应时间 |
|------|------|---------|
| P0 | G-1, G-2, G-3, G-10, G-11, G-12 | 立即 |
| P1 | G-4, G-5, G-6, G-7, G-8, G-9 | 1 小时 |
| P2 | G-13, G-14, G-15 | 4 小时 |

### 8.2 处理流程

```
检测到违反
    ↓
停止发布
    ↓
记录违反详情
    ↓
分级 (P0/P1/P2)
    ↓
┌─────────────────────┐
│ P0? │ P1? │ P2? │
└─────────────────────┘
    ↓     ↓     ↓
  立即   1h   4h
  回滚   修复   观察
    ↓
根因分析
    ↓
修复 + 预防
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:57 CST_
