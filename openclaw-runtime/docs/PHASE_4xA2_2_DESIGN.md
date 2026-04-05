# Phase 4.x-A2-2: Distributed Lease Design

**阶段**: Phase 4.x-A2-2: Distributed Lease  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: Phase 4.x-A2-1 (Instance Registry) ✅

---

## 一、设计决策总结

### 1.1 Lease 唯一键设计

**决策**: 通用 lease_key + lease_type 抽象

```typescript
interface LeaseRecord {
  lease_key: string;        // 唯一键 (e.g., "incident:123")
  lease_type: string;       // 类型 (e.g., "incident", "work_item")
  // ...
}
```

**理由**:
- ✅ 统一管理所有资源类型
- ✅ 便于查询和审计
- ✅ 命名空间格式：`type:id`

---

### 1.2 Owner 双标识绑定

**决策**: instance_id + session_id 同时绑定

```typescript
interface LeaseRecord {
  owner_instance_id: string;  // 节点级 (重启不变)
  owner_session_id: string;   // 进程级 (每次启动变化)
}
```

**理由**:
- ✅ 防止重启后误继承旧 lease
- ✅ 节点级归属语义 + 进程级生命周期追踪

---

### 1.3 Lease 生命周期语义

**决策**: 结果驱动，定义清晰返回类型

| 操作 | 成功 | 失败/冲突 |
|------|------|----------|
| acquire | ✅ 获取成功 | ❌ ALREADY_LEASED |
| renew | ✅ 续租成功 | ❌ NOT_OWNER / EXPIRED |
| release | ✅ 释放成功 | ❌ NOT_OWNER (幂等) |
| reclaim | ✅ 回收获效 | ❌ NOT_STALE |

**理由**:
- ✅ 幂等性 - release 支持重复调用
- ✅ 错误码明确 - 便于调试和审计

---

### 1.4 Lease Timeout 与 Heartbeat 关系

**决策**: 两层判断

```typescript
isStale(lease, now): boolean {
  // 1. lease 自身是否过期
  if (now > lease.expires_at) return true;
  
  // 2. owner instance 是否仍有效
  const owner = await registry.getInstance(lease.owner_instance_id);
  if (!owner || owner.status === 'failed') return true;
  
  return false;
}
```

**理由**:
- ✅ lease 独立 timeout - 不依赖 instance heartbeat
- ✅ 双重验证 - 避免误回收

---

### 1.5 持久化结构

**决策**: log + snapshot (与 A2-1 一致)

```
~/.openclaw/runtime/leases/
├── leases_log.jsonl     // append-only
├── leases_snapshot.json // 定期快照
└── leases.json          // 内存缓存
```

**回收策略**:
- ✅ 标记回收 - status: 'reclaimed'
- ✅ audit 记录 - lease_reclaimed 事件
- ✅ 物理删除 - 7 天后清理

---

### 1.6 A2-2 / A2-3 边界

**决策**: 职责分离

| A2-2 (所有权层) | A2-3 (工作项协议层) |
|----------------|-------------------|
| acquire | claim (依赖 lease) |
| renew | complete |
| release | fail |
| detectStale | reassign |
| reclaimStale | - |

**理由**:
- ✅ A2-2: 管理"谁拥有某资源"
- ✅ A2-3: 管理"工作项生命周期"

---

## 二、核心接口

### 2.1 LeaseRecord Schema

```typescript
interface LeaseRecord {
  lease_key: string;        // 唯一键 (e.g., "incident:123")
  lease_type: string;       // 类型 (e.g., "incident", "work_item")
  owner_instance_id: string; // 节点级 UUID
  owner_session_id: string;  // 进程级 UUID
  acquired_at: number;      // 获取时间
  renewed_at: number;       // 最后续期时间
  expires_at: number;       // 过期时间
  version: number;          // 乐观锁版本号
  status: 'active' | 'released' | 'expired' | 'reclaimed';
  metadata?: Record<string, unknown>;
}
```

---

### 2.2 LeaseManager Interface

```typescript
interface LeaseManager {
  // 租约操作
  acquire(input: AcquireLeaseInput): Promise<AcquireLeaseResult>;
  renew(input: RenewLeaseInput): Promise<RenewLeaseResult>;
  release(input: ReleaseLeaseInput): Promise<ReleaseLeaseResult>;
  
  // 查询
  getLease(lease_key: string): Promise<LeaseRecord | null>;
  getActiveLeases(): Promise<LeaseRecord[]>;
  getLeasesByOwner(instance_id: string): Promise<LeaseRecord[]>;
  
  // Stale 检测与回收
  detectStaleLeases(now?: number): Promise<LeaseRecord[]>;
  reclaimStaleLease(input: ReclaimLeaseInput): Promise<ReclaimLeaseResult>;
}
```

---

### 2.3 Input Types

```typescript
interface AcquireLeaseInput {
  lease_key: string;
  lease_type: string;
  owner_instance_id: string;
  owner_session_id: string;
  ttl_ms?: number;  // 默认 30s
}

interface RenewLeaseInput {
  lease_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  ttl_ms?: number;  // 默认保持原 TTL
}

interface ReleaseLeaseInput {
  lease_key: string;
  owner_instance_id: string;
  owner_session_id: string;
}

interface ReclaimLeaseInput {
  lease_key: string;
  reclaimed_by_instance_id: string;
  reclaimed_by_session_id: string;
  reason?: string;
}
```

---

### 2.4 Result Types

```typescript
interface AcquireLeaseResult {
  success: true;
  lease: LeaseRecord;
} | {
  success: false;
  error: 'ALREADY_LEASED';
  message: string;
  current_owner?: { instance_id: string; session_id: string };
}

interface RenewLeaseResult {
  success: true;
  lease: LeaseRecord;
} | {
  success: false;
  error: 'NOT_OWNER' | 'EXPIRED';
  message: string;
}

interface ReleaseLeaseResult {
  success: true;
  already_released?: boolean;  // 幂等：已释放
} | {
  success: false;
  error: 'NOT_OWNER';
  message: string;
}

interface ReclaimLeaseResult {
  success: true;
  lease: LeaseRecord;
} | {
  success: false;
  error: 'NOT_STALE';
  message: string;
}
```

---

### 2.5 LeaseEvent Schema

```typescript
interface LeaseEvent {
  type: 'lease_acquired' | 'lease_renewed' | 'lease_released' | 'lease_expired' | 'lease_reclaimed';
  lease_key: string;
  timestamp: number;
  data: Partial<LeaseRecord> & {
    previous_owner?: { instance_id: string; session_id: string };
    new_owner?: { instance_id: string; session_id: string };
    reason?: string;
  };
}
```

---

## 三、配置

### 3.1 LeaseConfig

```typescript
interface LeaseConfig {
  default_ttl_ms: number;        // 默认租期 (30s)
  max_ttl_ms: number;            // 最大租期 (300s)
  renew_grace_period_ms: number; // 续租宽限期 (5s)
  stale_cleanup_interval_ms: number; // stale 清理间隔 (60s)
}

const DEFAULT_LEASE_CONFIG: LeaseConfig = {
  default_ttl_ms: 30000,        // 30s
  max_ttl_ms: 300000,           // 5min
  renew_grace_period_ms: 5000,  // 5s
  stale_cleanup_interval_ms: 60000, // 60s
};
```

---

## 四、实现计划

### 4.1 Phase 4.x-A2-2-1: LeaseManager 核心 (1-2 人日)

**任务**:
- [ ] LeaseRecord 类型定义
- [ ] LeaseManager 接口定义
- [ ] acquire / renew / release 实现
- [ ] version CAS 语义 (与 A1 一致)

**验收**:
- [ ] acquire 成功/冲突路径
- [ ] renew owner 验证
- [ ] release 幂等性

### 4.2 Phase 4.x-A2-2-2: Stale Detection (1 人日)

**任务**:
- [ ] detectStaleLeases 实现
- [ ] 双重验证 (expires_at + owner status)
- [ ] reclaimStaleLease 实现

**验收**:
- [ ] lease 过期检测
- [ ] owner failed 检测
- [ ] reclaim 成功/失败路径

### 4.3 Phase 4.x-A2-2-3: 持久化 (1 人日)

**任务**:
- [ ] leases_log.jsonl append-only
- [ ] leases_snapshot.json 定期快照
- [ ] 崩溃恢复 (replay log + snapshot)

**验收**:
- [ ] 事件写入 log
- [ ] snapshot 恢复
- [ ] corrupted log 容错

### 4.4 Phase 4.x-A2-2-4: 测试 (1-2 人日)

**任务**:
- [ ] acquire 测试 (5 条)
- [ ] renew 测试 (4 条)
- [ ] release 测试 (4 条)
- [ ] stale detection 测试 (5 条)
- [ ] recovery 测试 (4 条)

**验收**:
- [ ] 20+ 测试通过
- [ ] 无回归失败

---

## 五、测试策略

### 5.1 测试模式配置

```typescript
const leaseManager = new LeaseManager({
  dataDir,
  config: {
    default_ttl_ms: 100,   // 快速测试
    stale_cleanup_interval_ms: 50,
  },
  autoCleanup: false,  // 测试模式禁用自动清理
});
```

### 5.2 测试覆盖矩阵

| 契约 | 测试 | 用例数 |
|------|------|--------|
| acquire 成功/冲突 | acquire.test.ts | 5 |
| renew owner 验证 | renew.test.ts | 4 |
| release 幂等性 | release.test.ts | 4 |
| stale 双重验证 | stale-detection.test.ts | 5 |
| 持久化恢复 | recovery.test.ts | 4 |
| **总计** | **5 文件** | **22** |

---

## 六、依赖关系

### 6.1 依赖 A2-1

```typescript
// LeaseManager 依赖 InstanceRegistry 验证 owner
async isOwnerValid(instance_id: string): Promise<boolean> {
  const instance = await this.registry.getInstance(instance_id);
  return instance !== null && instance.status !== 'failed';
}
```

### 6.2 被 A2-3 依赖

```typescript
// WorkItemCoordinator 依赖 LeaseManager
async claim(item_id: string): Promise<ClaimResult> {
  const leaseResult = await this.leaseManager.acquire({
    lease_key: `work_item:${item_id}`,
    lease_type: 'work_item',
    owner_instance_id: this.instanceId,
    owner_session_id: this.sessionId,
  });
  
  if (!leaseResult.success) {
    return { success: false, error: 'ALREADY_CLAIMED' };
  }
  
  // ... claim logic
}
```

---

## 七、风险与缓解

### 7.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| version CAS 竞争 | 中 | 中 | 文件锁保护 + 重试 |
| stale 误判 | 低 | 高 | 双重验证 + grace period |
| log 损坏 | 低 | 中 | 容错 + snapshot 恢复 |

### 7.2 迁移风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 旧 lease 格式不兼容 | 低 | 中 | 向后兼容模式 |
| TTL 配置不当 | 中 | 中 | 默认值 + 文档 |

---

## 八、验收标准

### 8.1 Phase 4.x-A2-2 完成标准

- [ ] LeaseManager 实现完成
- [ ] acquire / renew / release 测试通过
- [ ] stale detection 测试通过
- [ ] 持久化测试通过
- [ ] 20+ 测试全部通过
- [ ] 无回归失败

### 8.2 质量指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 测试通过率 | 100% | - |
| 测试用例数 | ≥20 | - |
| 回归失败 | 0 | - |
| 文档完整性 | 完整 | ✅ |

---

_文档版本：1.0  
创建时间：2026-04-05 15:40 CST_
