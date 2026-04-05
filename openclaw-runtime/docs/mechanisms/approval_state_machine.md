# Approval State Machine

**阶段**: Phase X-1: Source Intelligence Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、状态集合

### 1.1 核心状态

| 状态 | 含义 | 终端状态 |
|------|------|---------|
| `pending` | 等待审批 | ❌ |
| `approved` | 已批准 | ❌ |
| `rejected` | 已拒绝 | ❌ |
| `resolved` | 已解决/执行完成 | ✅ |

### 1.2 状态语义

| 状态 | 前置条件 | 后置动作 |
|------|---------|---------|
| `pending` | Approval 创建 | 等待审批者动作 |
| `approved` | 审批通过 | 执行批准的动作 |
| `rejected` | 审批拒绝 | 记录原因，可选重试 |
| `resolved` | 执行完成 | 归档 |

---

## 二、合法迁移

### 2.1 状态迁移图

```
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              │
pending ─────────► approved ─────────► resolved    │
    │                  ▲                           │
    │                  │                           │
    ▼                  │                           │
 rejected ─────────────┴───────────────────────────┘
         (re-submit)           (re-submit)
```

### 2.2 合法迁移表

| 从 | 到 | 触发条件 | 验证规则 |
|----|----|---------|---------|
| `pending` | `approved` | 审批者批准 | approver 必须存在 |
| `pending` | `rejected` | 审批者拒绝 | 必须有 rejection_reason |
| `approved` | `resolved` | 执行完成 | 必须有 execution_proof |
| `rejected` | `resolved` | 关闭/放弃 | 必须有 close_reason |
| `rejected` | `pending` | 重新提交 | 必须有 re-submit 理由 |
| `resolved` | `pending` | 重新审批 (罕见) | 必须有 re-approval 理由 |

---

## 三、非法迁移

### 3.1 明确禁止的迁移

| 从 | 到 | 原因 | 系统行为 |
|----|----|------|---------|
| `resolved` | `approved` | 已归档，不应回退 | 拒绝 |
| `resolved` | `rejected` | 已归档 | 拒绝 |
| `approved` | `pending` | 状态回退 | 拒绝 |
| `approved` | `rejected` | 审批后不能反向 | 拒绝，需 re-open 流程 |

### 3.2 并发冲突处理

**场景**: 两个审批者同时审批同一 approval

**行为**: Last-write-wins (当前实现)

**风险**: 后写入的覆盖先写入的

**缓解**:
- 短期：Audit 记录所有审批动作
- 中期：乐观锁 (version 字段)
- 长期：审批锁 (第一个审批者锁定)

---

## 四、触发条件

### 4.1 Approval 创建

**触发源**: 需要审批的业务动作

**条件**:
1. 业务规则要求审批 (如高风险操作)
2. 审批者/审批组已配置
3. 审批上下文完整

**创建动作**:
```typescript
approval = {
  id: `approval-${timestamp}-${type}`,
  type: approval_type,
  status: 'pending',
  title: approval_title,
  description: approval_description,
  created_at: Date.now(),
  created_by: requester_id,
  approvers: [approver_ids],
  context: { ... },
}
```

### 4.2 Approval 审批

**触发源**: POST /approvals/:id/resolve

**条件**:
1. Approval 存在
2. 状态为 `pending`
3. 审批者有权限

**审批动作**:
```typescript
if (action === 'approve') {
  approval.status = 'approved'
  approval.approved_at = Date.now()
  approval.approved_by = approver_id
} else if (action === 'reject') {
  approval.status = 'rejected'
  approval.rejected_at = Date.now()
  approval.rejected_by = approver_id
  approval.rejection_reason = reason
}
```

### 4.3 Approval 执行

**触发源**: 审批后的自动/手动执行

**条件**:
1. Approval 状态为 `approved`
2. 执行前置条件满足
3. 执行者有权限

**执行动作**:
```typescript
approval.status = 'resolved'
approval.resolved_at = Date.now()
approval.resolved_by = executor_id
approval.execution_proof = { ... }
```

---

## 五、并发/重复操作行为

### 5.1 重复审批

**场景**: 多个审批者同时审批同一 approval

**当前行为**:
- 文件锁保护写入 (单实例安全)
- Last-write-wins (内存索引)
- 所有审批动作记录到 Audit

**风险**:
- 后写入的覆盖先写入的
- 无法追踪"谁先审批"

**缓解**:
- Audit 记录所有审批动作
- 中期引入审批锁

### 5.2 重复 Resolve

**场景**: 同一 approval 多次 resolve 请求

**行为**:
- 第一次：成功
- 后续：状态不变，但记录更新

**验证**: 需要补充测试用例

---

## 六、恢复/Replay 状态规则

### 6.1 重启恢复

**恢复源**: `approvals.jsonl` + 增量回放

**规则**:
1. 加载快照
2. 回放增量事件
3. 重建内存索引
4. 验证状态一致性

### 6.2 Pending Approval 恢复

**场景**: 服务重启后，恢复 pending approvals

**规则**:
1. 扫描 pending approvals
2. 通知审批者 (可选)
3. 记录恢复动作到 Audit

**保护**:
- Recovery Coordinator 所有权保护
- 文件锁防止并发恢复

### 6.3 Replay 场景

**适用**: 测试/审计

**规则**:
1. Dry-run 模式 (无副作用)
2. 重放事件到内存 (不写文件)
3. 输出状态序列

---

## 七、实现映射

### 7.1 核心文件

| 文件 | 职责 |
|------|------|
| `approval_repository.ts` | Approval 存储 (内存 + 索引) |
| `approval_file_repository.ts` | 文件持久化 (待实现) |
| `trading_routes.ts` | HTTP 端点 (POST /approvals/:id/resolve) |

### 7.2 关键函数

| 函数 | 功能 |
|------|------|
| `ApprovalRepository.create()` | 创建 approval |
| `ApprovalRepository.update()` | 更新 approval |
| `ApprovalRepository.resolve()` | 审批/执行 |

### 7.3 已验证行为

| 测试 | 结果 |
|------|------|
| Approval 创建 | ✅ 通过 (内存) |
| 状态变更 | ✅ 通过 (内存) |
| 文件持久化 | ⚠️ 待实现 |
| 重启恢复 | ⚠️ 待验证 |

---

## 八、与 Incident 的关系

### 8.1 状态对比

| 维度 | Incident | Approval |
|------|---------|---------|
| 初始状态 | `open` | `pending` |
| 中间状态 | `investigating` | `approved`/`rejected` |
| 终端状态 | `resolved`/`closed` | `resolved` |
| 触发源 | Alert Ingest | 业务规则 |
| 执行者 | 人工/自动 | 审批者 |

### 8.2 关联场景

**场景**: Incident 解决需要 Approval

**流程**:
```
Incident (open) → Investigation → Solution Proposed
    ↓
Approval (pending) → Review → Approved
    ↓
Incident (resolved) ← Execution ← Approval (resolved)
```

---

## 九、待改进项

### 9.1 短期 (Wave 2 后)

- [ ] Approval 文件持久化
- [ ] 审批者权限验证
- [ ] 审批超时逻辑

### 9.2 中期 (Phase 4.x)

- [ ] 多级审批流
- [ ] 审批组/代理审批
- [ ] 审批 SLA 追踪

### 9.3 长期 (平台化)

- [ ] 可配置审批流
- [ ] 外部审批系统集成
- [ ] 审批模板库

---

_文档版本：1.0  
最后更新：2026-04-05 05:36 CST_
