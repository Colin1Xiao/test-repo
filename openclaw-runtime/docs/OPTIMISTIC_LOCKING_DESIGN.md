# Optimistic Locking Design

**阶段**: Phase 4.x-A1: Optimistic Concurrency Control  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**

---

## 一、问题陈述

### 1.1 当前状态

**Phase 4.0 完成后**:
- ✅ 测试覆盖率 ~75% (104/104 测试通过)
- ✅ 状态机合法性验证 (I-11)
- ✅ 文件锁本地保护 (2E-4A)
- ✅ 写入顺序保证 (W-5, W-7)
- ✅ 无重复创建 (I-5)

**缺失能力**:
- ❌ 并发写入冲突检测
- ❌ version / 序列号机制
- ❌ compare-and-set 语义
- ❌ 冲突可解释性 (audit/timeline)

### 1.2 风险场景

**场景 1: 并发状态变更**
```
Actor A: open → investigating (t1)
Actor B: open → resolved (t1 + 5ms)

结果：B 的写入覆盖 A，A 的变更丢失
```

**场景 2:  stale write**
```
Reader: 读取 incident (version=1, status=open)
Writer1: open → investigating (version=2)
Reader: 基于旧版本更新 (version=1 → resolved)

结果：Reader 的写入覆盖 Writer1，investigating 状态丢失
```

**场景 3: 多实例并发**
```
Instance 1: claim item-1 (session-A)
Instance 2: claim item-1 (session-B)

结果：两个实例都认为 claim 成功，重复处理
```

---

## 二、设计目标

### 2.1 核心目标

| 目标 | 描述 | 优先级 |
|------|------|--------|
| 冲突检测 | 并发写入时能检测到冲突 | P0 |
| 冲突拒绝 | 冲突写入被拒绝而非覆盖 | P0 |
| 冲突可解释 | 冲突原因可追溯 (audit/timeline) | P0 |
| 向后兼容 | 不影响现有单实例行为 | P1 |
| 性能 | 无锁读取，乐观写入 | P1 |

### 2.2 非目标

| 非目标 | 原因 |
|--------|------|
| 分布式事务 | 超出范围，用最终一致性 |
| 悲观锁 | 已有文件锁，不需要双重保护 |
| 自动重试 | 应用层策略，非核心机制 |
| 多实例协调 | Phase 4.x-A2 范围 |

---

## 三、数据模型

### 3.1 Incident Version 字段

**新增字段**:
```typescript
interface Incident {
  id: string;
  version: number;        // 新增：乐观锁版本号
  status: IncidentStatus;
  // ... 其他字段
  updated_at: number;
}
```

**语义**:
- 初始值：`1` (创建时)
- 每次更新：`version++`
- 读取：返回当前 version
- 更新：检查 version 匹配，然后 `version++`

**示例**:
```typescript
// 创建
const incident = await incidentRepo.create({...});
// incident.version = 1

// 更新
await incidentRepo.update(incident.id, {
  status: 'investigating',
  version: 1,  // 期望版本
});
// incident.version = 2
```

### 3.2 Timeline Event Version 引用

**可选增强**:
```typescript
interface TimelineEvent {
  id: string;
  incident_id: string;
  incident_version?: number;  // 新增：关联的 incident version
  type: string;
  timestamp: number;
  // ...
}
```

**用途**:
- 追踪事件产生时的 incident 版本
- 支持"事件重放"到特定版本
- 调试并发冲突时间线

### 3.3 Audit Event Version 引用

**可选增强**:
```typescript
interface AuditEvent {
  id: string;
  object_id: string;
  object_version?: number;  // 新增：操作时的对象版本
  type: string;
  metadata?: {
    expected_version?: number;  // 期望版本
    actual_version?: number;    // 实际版本 (冲突时)
    // ...
  };
}
```

---

## 四、更新语义

### 4.1 Compare-And-Set (CAS)

**接口设计**:
```typescript
interface IncidentUpdateRequest {
  status?: IncidentStatus;
  version: number;  // 必需：期望版本
  updated_by: string;
}

interface IncidentUpdateResult {
  success: true;
  incident: Incident;
} | {
  success: false;
  error: 'VERSION_MISMATCH' | 'NOT_FOUND';
  message: string;
  current_version?: number;
}
```

**实现逻辑**:
```typescript
async update(id: string, request: IncidentUpdateRequest): Promise<IncidentUpdateResult> {
  const fileLock = getFileLock();
  
  return await fileLock.withLock('incidents', async () => {
    const incident = await this.getById(id);
    if (!incident) {
      return { success: false, error: 'NOT_FOUND', ... };
    }
    
    // Version check
    if (incident.version !== request.version) {
      return {
        success: false,
        error: 'VERSION_MISMATCH',
        message: `Expected version ${request.version}, got ${incident.version}`,
        current_version: incident.version,
      };
    }
    
    // Update
    incident.version++;
    incident.status = request.status!;
    incident.updated_at = Date.now();
    incident.updated_by = request.updated_by;
    
    await this.save(incident);
    
    return { success: true, incident };
  });
}
```

### 4.2 Last-Write-Wins (受控)

**当前行为**: 无条件覆盖  
**新行为**: 可选 CAS 或 LWW

**配置开关**:
```typescript
interface IncidentRepositoryConfig {
  strict_version_check: boolean;  // 默认 false (向后兼容)
}
```

**迁移路径**:
1. Phase 4.x-A1: `strict_version_check = false` (可选 CAS)
2. Phase 4.x-A2: `strict_version_check = true` (强制 CAS)

---

## 五、冲突处理

### 5.1 冲突类型

| 类型 | 描述 | 处理策略 |
|------|------|---------|
| VERSION_MISMATCH | 期望版本 ≠ 实际版本 | 拒绝 + 返回当前版本 |
| CONCURRENT_UPDATE | 同一对象并发更新 | 拒绝 + 审计记录 |
| STALE_WRITE | 基于旧版本的写入 | 拒绝 + 时间线记录 |

### 5.2 冲突审计

**Audit 记录**:
```typescript
interface ConflictAuditEvent {
  type: 'write_conflict';
  object_type: 'incident';
  object_id: string;
  timestamp: number;
  actor: string;
  metadata: {
    expected_version: number;
    actual_version: number;
    attempted_change: {
      field: string;
      from: any;
      to: any;
    };
    conflicting_actor?: string;
  };
}
```

### 5.3 冲突时间线

**Timeline 记录** (关键路径):
```typescript
interface ConflictTimelineEvent {
  type: 'update_conflict';
  incident_id: string;
  timestamp: number;
  correlation_id?: string;
  metadata: {
    reason: 'VERSION_MISMATCH';
    expected_version: number;
    actual_version: number;
    actor: string;
  };
}
```

---

## 六、测试策略

### 6.1 单元测试

| 测试 | 描述 | 优先级 |
|------|------|--------|
| CAS 成功路径 | version 匹配时更新成功 | P0 |
| CAS 失败路径 | version 不匹配时拒绝 | P0 |
| version 递增 | 每次更新 version++ | P0 |
| 初始 version | 创建时 version=1 | P0 |

### 6.2 集成测试

| 测试 | 描述 | 优先级 |
|------|------|--------|
| 并发 resolve 冲突 | 两个 actor 同时 resolve | P0 |
| 并发 acknowledge/resolve | 不同状态变更并发 | P0 |
| stale write 拒绝 | 基于旧版本的写入被拒绝 | P0 |
| conflict audit 记录 | 冲突产生 audit 事件 | P1 |
| conflict timeline 记录 | 冲突产生 timeline 事件 | P1 |

### 6.3 并发测试

| 测试 | 描述 | 优先级 |
|------|------|--------|
| 多实例并发 claim | 两个实例 claim 同一 item | P0 |
| 并发更新同一 incident | 多 actor 并发更新 | P0 |
| 版本跳跃检测 | version 不连续时拒绝 | P1 |

---

## 七、实现计划

### 7.1 Phase 4.x-A1-1: 数据模型 (1-2 人日)

**任务**:
- [ ] `Incident` 增加 `version` 字段
- [ ] `IncidentFileRepository.create()` 初始化 version=1
- [ ] `IncidentFileRepository.update()` 增加 version 检查 (可选)
- [ ] 向后兼容：旧 incident 默认 version=1

**验收**:
- [ ] 新创建的 incident 有 version 字段
- [ ] 更新时 version 递增
- [ ] 单元测试通过

### 7.2 Phase 4.x-A1-2: CAS 语义 (2-3 人日)

**任务**:
- [ ] `IncidentUpdateRequest` 增加 `version` 字段
- [ ] `update()` 实现 compare-and-set 逻辑
- [ ] 返回 `IncidentUpdateResult` (带错误信息)
- [ ] 配置开关 `strict_version_check`

**验收**:
- [ ] CAS 成功路径测试通过
- [ ] CAS 失败路径测试通过
- [ ] version mismatch 返回正确错误

### 7.3 Phase 4.x-A1-3: 冲突可解释性 (2-3 人日)

**任务**:
- [ ] 冲突时写入 audit 事件
- [ ] 冲突时写入 timeline 事件 (关键路径)
- [ ] `ConflictAuditEvent` 和 `ConflictTimelineEvent` 定义

**验收**:
- [ ] 冲突产生 audit 记录
- [ ] 冲突产生 timeline 记录
- [ ] 审计事件包含 expected/actual version

### 7.4 Phase 4.x-A1-4: 测试补强 (2-3 人日)

**任务**:
- [ ] 单元测试 (4 条)
- [ ] 集成测试 (5 条)
- [ ] 并发测试 (2 条)

**验收**:
- [ ] 11 条测试全部通过
- [ ] 覆盖率提升至 ~80%

---

## 八、向后兼容

### 8.1 数据兼容

**旧 incident (无 version 字段)**:
- 读取时：默认 `version=1`
- 更新时：跳过 version 检查 (向后兼容模式)

**新 incident (有 version 字段)**:
- 读取时：返回实际 version
- 更新时：可选 version 检查

### 8.2 API 兼容

**当前 API**:
```typescript
update(id: string, update: { status?: IncidentStatus; updated_by?: string }): Promise<Incident>
```

**新 API** (向后兼容):
```typescript
update(id: string, update: IncidentUpdateRequest): Promise<Incident>
// 其中 IncidentUpdateRequest 包含可选的 version 字段
```

**迁移**:
1. Phase 4.x-A1: `version` 可选 (向后兼容)
2. Phase 4.x-A2: `version` 必需 (破坏性变更)

---

## 九、风险与缓解

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| version 字段遗漏 | 中 | 中 | 数据迁移脚本 + 默认值 |
| 并发测试 flaky | 中 | 中 | 增加重试 + 超时控制 |
| 性能退化 | 低 | 中 | 基准测试 + 优化文件锁粒度 |

### 9.2 迁移风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 旧数据不兼容 | 低 | 高 | 默认 version=1 + 向后兼容模式 |
| API 破坏 | 低 | 高 | 分阶段迁移 (可选 → 必需) |
| 测试覆盖不足 | 中 | 中 | 测试先行 + 并发场景补强 |

---

## 十、验收标准

### 10.1 Phase 4.x-A1 完成标准

- [ ] 数据模型完成 (version 字段)
- [ ] CAS 语义实现 (compare-and-set)
- [ ] 冲突可解释性 (audit/timeline)
- [ ] 测试覆盖 (11 条新增测试)
- [ ] 总测试覆盖率 ≥80%
- [ ] CI 全绿通过

### 10.2 质量指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 测试通过率 | 100% | - |
| 测试覆盖率 | ≥80% | - |
| 并发冲突检测 | 100% | - |
| 冲突可解释性 | 100% | - |

---

## 十一、与 Phase 4.x-A2 的关系

### 11.1 Phase 4.x-A1 范围

**单对象并发控制**:
- ✅ version 字段
- ✅ compare-and-set
- ✅ 冲突检测与拒绝
- ✅ 冲突可解释性

### 11.2 Phase 4.x-A2 范围

**多实例协调**:
- [ ] instance identity
- [ ] distributed lease / ownership
- [ ] work item claim / renew / release 跨实例协议
- [ ] duplicate suppression 跨实例确认

### 11.3 依赖关系

```
Phase 4.x-A1 (乐观锁)
    ↓
Phase 4.x-A2 (多实例协调)
    ↓
Phase 5.x (平台化)
```

**Phase 4.x-A1 是 Phase 4.x-A2 的基础**:
- 多实例协调需要 version 机制检测冲突
- distributed lease 需要 compare-and-set 语义
- 跨实例 duplicate suppression 需要冲突可解释性

---

_文档版本：1.0  
创建时间：2026-04-05 15:10 CST_
