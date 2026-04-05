# Approval Sequence

**阶段**: Phase X-2: Temporal & Recovery Mechanics Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、Approval 事件传播顺序

### 1.1 Approval 创建流程

**时序**:
```
T0:   业务动作触发审批需求
T0+ε: 创建 Approval 对象 (内存)
T0+2ε: 验证审批配置 (审批者/规则)
T0+3ε: ├─ 如果配置无效 → 返回错误
T0+3ε: └─ 如果配置有效 → 继续
T0+4ε: 获取文件锁 (approvals)
T0+5ε: 追加 JSONL (approval_created)
T0+6ε: 更新内存索引
T0+7ε: 释放文件锁
T0+8ε: 记录 Audit (approval_created)
T0+9ε: 记录 Timeline (approval_created)
T0+10ε: 通知审批者
T0+11ε: 返回 approval_id
```

**关键点**:
1. 配置验证 **先于** 锁获取
2. 文件写入 **先于** 通知 (保证可追溯)
3. Audit/Timeline **后于** 持久化

### 1.2 Approval 审批流程

**时序**:
```
T0:   POST /approvals/:id/resolve 请求
T0+ε: 验证 Approval 存在 (内存)
T0+2ε: 验证审批者权限
T0+3ε: ├─ 如果无权限 → 返回 403
T0+3ε: └─ 如果有权限 → 继续
T0+4ε: 验证状态 (必须 pending)
T0+5ε: ├─ 如果不是 pending → 返回 400
T0+5ε: └─ 如果是 pending → 继续
T0+6ε: 获取文件锁 (approvals)
T0+7ε: 更新状态 (approved/rejected)
T0+8ε: 追加 JSONL (approval_updated)
T0+9ε: 更新内存索引
T0+10ε: 释放文件锁
T0+11ε: 记录 Audit (approval_resolved)
T0+12ε: 记录 Timeline (approval_resolved)
T0+13ε: 如果 approved → 触发执行
T0+14ε: 返回成功
```

**关键点**:
1. 权限验证 **先于** 状态验证
2. 状态验证 **先于** 锁获取
3. 执行触发 **后于** 所有记录

---

## 二、Approval 与 Incident 的时序关系

### 2.1 Incident 解决需要 Approval

**时序**:
```
T0:   Incident 调查完成，提出解决方案
T0+ε: 检查是否需要审批
T0+2ε: ├─ 如果不需要 → 直接 resolve
T0+2ε: └─ 如果需要 → 创建 Approval
T0+3ε:     创建 Approval (见 1.1)
T0+4ε:     Incident 状态 → investigating (等待审批)
T0+5ε:     记录 Timeline (incident_waiting_approval)
T0+6ε:     返回 approval_id

// 审批完成后

T1:   Approval 审批通过
T1+ε: Approval 状态 → approved
T1+2ε: 触发执行
T1+3ε: 执行解决方案
T1+4ε: 验证执行结果
T1+5ε: Incident 状态 → resolved
T1+6ε: 记录 Timeline (incident_resolved)
T1+7ε: 记录 Audit (incident_resolved_via_approval)
```

**关联字段**:
```typescript
interface Approval {
  // ...
  related_incident_id?: string;  // 关联 Incident
  approval_type: 'incident_resolution' | 'high_risk_action';
}

interface Incident {
  // ...
  pending_approval_id?: string;  // 等待的 Approval
}
```

### 2.2 Approval 拒绝后的处理

**时序**:
```
T0:   Approval 审批拒绝
T0+ε: Approval 状态 → rejected
T0+2ε: 记录 Audit (approval_rejected)
T0+3ε: 记录 Timeline (approval_rejected)
T0+4ε: 通知请求者
T0+5ε: Incident 状态 → open (重新调查)
T0+6ε: 记录 Timeline (incident_reopened)
T0+7ε: 清除 pending_approval_id
```

---

## 三、状态迁移与持久化顺序

### 3.1 写入顺序保证

**规则 1: Approval 创建**
```
1. 验证配置 (内存)
2. 创建内存对象
3. 获取文件锁
4. 追加 JSONL (approval_created)
5. 更新内存索引
6. 释放文件锁
7. 记录 Timeline
8. 记录 Audit
9. 通知审批者
```

**规则 2: Approval 审批**
```
1. 验证权限 (内存)
2. 验证状态 (内存)
3. 获取文件锁
4. 更新内存对象
5. 追加 JSONL (approval_updated)
6. 更新内存索引
7. 释放文件锁
8. 记录 Timeline
9. 记录 Audit
10. 如果 approved → 触发执行
```

### 3.2 顺序不变性

**不变性 1: Approval 不先于配置验证**
- 配置无效时不创建 Approval
- 验证：检查配置是否存在

**不变性 2: 执行不先于 Approval**
- 必须 approved 后才能执行
- 验证：检查 Approval 状态

**不变性 3: Audit 不先于持久化**
- 文件写入成功后才记录 Audit
- 验证：检查时间戳顺序

---

## 四、Replay / Recovery 副作用抑制

### 4.1 Replay 副作用抑制

**场景**: 重放 Approval 历史

**抑制规则**:
```
IF (dry_run == true) THEN
  只读内存，不写文件
  不触发执行
  不通知审批者
  返回模拟结果
END IF
```

**实现**:
```typescript
async replayApproval(approval_id: string, options: ReplayOptions): Promise<ReplayResult> {
  if (options.dry_run) {
    const approval = await this.approvalRepo.getById(approval_id);
    return {
      approval_id,
      status: approval.status,
      dry_run: true,
      execution_skipped: true,
    };
  }

  // 真实重放 (需要额外审批)
  // ...
}
```

### 4.2 Recovery 副作用抑制

**场景**: 恢复 pending approvals

**抑制规则**:
```
FOR EACH pending_approval IN scan_pending():
  IF (already_processed(pending_approval)) THEN
    标记为 recovered，不重放
  ELSE IF (approver_available(pending_approval)) THEN
    重新通知审批者
    记录 Audit (recovery_notification_sent)
  ELSE
    标记为 failed，人工介入
  END IF
END FOR
```

**实现**:
```typescript
async recoverPendingApprovals(): Promise<void> {
  const pending = await this.approvalRepo.scanByStatus('pending');
  
  for (const approval of pending) {
    // 检查是否已处理 (幂等)
    const processed = await this.checkIfProcessed(approval);
    if (processed) {
      await this.markAsRecovered(approval);
      continue;
    }

    // 检查审批者是否可用
    const available = await this.checkApproverAvailable(approval);
    if (available) {
      await this.notifyApprover(approval);
      await this.audit.log({
        type: 'recovery_notification_sent',
        object_type: 'approval',
        object_id: approval.id,
      });
    } else {
      await this.markAsFailed(approval, 'approver_unavailable');
    }
  }
}
```

### 4.3 Restart 副作用抑制

**场景**: 服务重启后恢复

**抑制规则**:
```
1. 加载快照 (只读)
2. 回放增量 JSONL (只读)
3. 重建内存索引
4. 扫描 pending approvals
5. 不自动通知 (避免重启风暴)
6. 标记服务就绪
7. 等待手动触发或定时任务
```

**实现**:
```typescript
async initialize(): Promise<void> {
  // 1-3. 加载与重建
  await this.loadSnapshot();
  await this.loadIncrementalEvents();
  this.rebuildIndex();
  
  // 4. 扫描 pending
  const pending = await this.approvalRepo.scanByStatus('pending');
  console.log(`Found ${pending.length} pending approvals`);
  
  // 5-7. 不自动通知，等待手动触发
  this.pendingApprovals = pending;
  this.isReady = true;
  
  // 不触发通知 (避免重启风暴)
  // 由定时任务或手动触发
}
```

---

## 五、已验证时序

| 场景 | 验证状态 | 备注 |
|------|---------|------|
| Approval 创建 | ✅ 内存 | <50ms |
| Approval 审批 | ✅ 内存 | <30ms |
| 文件锁获取 | ✅ 3B-3.1 | <10ms |
| 重启恢复 | ⚠️ 待验证 | Approval 持久化待实现 |
| Replay Dry-run | ✅ Wave 2-A | <100ms |

---

## 六、时序异常处理

### 6.1 超时处理

**规则**:
```
IF (操作耗时 > 阈值) THEN
  记录警告日志
  如果是锁操作 → 强制释放
  如果是通知操作 → 重试或降级
  如果是执行操作 → 回滚
END IF
```

**阈值**:
| 操作 | 阈值 | 动作 |
|------|------|------|
| 锁获取 | 30s | 强制释放 |
| 审批通知 | 10s | 重试 (3 次) |
| 执行触发 | 60s | 回滚 + 告警 |

### 6.2 乱序处理

**场景**: Approval 与 Incident 状态不一致

**规则**:
```
IF (Approval.approved 但 Incident 未 resolved) THEN
  记录警告日志
  触发人工核查
  可选：自动执行解决方案
END IF

IF (Incident.resolved 但 Approval 未 approved) THEN
  记录严重日志
  触发审计告警
  回滚 Incident 状态
END IF
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:43 CST_
