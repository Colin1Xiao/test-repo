# Phase 4.x-A2: Multi-Instance Coordination Design

**阶段**: Phase 4.x-A2: Multi-Instance Coordination Foundation  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**

---

## 一、背景与目标

### 1.1 Phase 4.x-A1 完成状态

**已完成能力**:
- ✅ 单对象并发冲突检测 (version 字段)
- ✅ Compare-And-Set 语义 (CAS)
- ✅ 冲突可解释性 (audit/timeline)
- ✅ 测试覆盖 ~80% (119/119 通过)

**缺失能力**:
- ❌ 多实例身份识别
- ❌ 分布式租约/所有权
- ❌ 跨实例 work item 协议
- ❌ 跨实例去重确认

### 1.2 问题场景

**场景 1: 多实例重复处理**
```
Instance A: claim item-1 (session-A)
Instance B: claim item-1 (session-B)

结果：两个实例都处理同一 item，重复执行
```

**场景 2: 实例故障后 ownership 丢失**
```
Instance A: claim item-1, lease expires at T+30s
Instance A: crashes at T+10s

Item-1: 无人处理，直到 lease 过期
```

**场景 3: 跨实例状态不一致**
```
Instance A: update incident-1 (version=5)
Instance B: update incident-1 (version=5, stale read)

结果：B 的写入被 CAS 拒绝，但 B 不知道 A 的存在
```

---

## 二、设计目标

### 2.1 核心目标

| 目标 | 描述 | 优先级 |
|------|------|--------|
| Instance Identity | 每个实例有唯一标识 | P0 |
| Distributed Lease | 跨实例所有权/租约机制 | P0 |
| Work Item Protocol | claim/renew/release 协议 | P0 |
| Duplicate Suppression | 跨实例去重确认 | P0 |
| Failure Recovery | 实例故障后自动恢复 | P1 |
| Coordination Overhead | 低开销 (<5% 延迟) | P1 |

### 2.2 非目标

| 非目标 | 原因 |
|--------|------|
| 强一致性分布式事务 | 用最终一致性，避免复杂 2PC |
| 全局时钟同步 | 用本地时间戳 + lease 机制 |
| 跨数据中心复制 | 单区域多实例 |
| 动态扩缩容 | 手动配置实例数 |

---

## 三、核心设计

### 3.1 Instance Identity (修正后)

**设计决策**: 节点级 identity + 会话级 session_id 双标识

```typescript
interface InstanceIdentity {
  instance_id: string;      // 节点级 UUID (持久化，重启不变)
  session_id: string;       // 进程级 UUID (每次启动变化)
  instance_name: string;    // 可读名称 (e.g., "worker-1")
  node_info: {
    hostname: string;       // 主机名
    pid: number;            // 进程 ID
    started_at: number;     // 当前进程启动时间
  };
  last_heartbeat: number;   // 最后心跳时间
  status: 'active' | 'inactive' | 'failed';
  metadata?: {
    region?: string;
    zone?: string;
    version?: string;
  };
}
```

**生成规则**:
- `instance_id`: UUID v4，首次启动时生成，持久化到 `~/.openclaw/runtime/instance_id.json`
- `session_id`: UUID v4，每次启动时重新生成
- `instance_name`: 环境变量 `INSTANCE_NAME` 或 `worker-${hostname}`
- `node_info`: 当前进程信息 (每次启动更新)

**持久化**:
```json
// ~/.openclaw/runtime/instance_id.json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "instance_name": "worker-1",
  "created_at": 1712329200000
}
```

---

### 3.1.1 Registry Schema (修正后)

**存储结构**: log + snapshot 混合模式

```
~/.openclaw/runtime/registry/
├── instances.json          // 当前活跃实例 (snapshot，内存缓存)
├── instances_log.jsonl     // 增量事件日志 (append-only)
└── instances_snapshot.json // 定期快照 (加速恢复)
```

**事件类型**:
```typescript
interface InstanceEvent {
  type: 'registered' | 'unregistered' | 'heartbeat' | 'stale_detected';
  instance_id: string;
  timestamp: number;
  data: Partial<InstanceIdentity>;
}
```

**写入语义**:
- `instances_log.jsonl`: append-only (文件锁保护)
- `instances.json`: 内存缓存 + 定期 snapshot (每 60s 或 100 次事件)
- **崩溃恢复**: replay log + snapshot

**InstanceRegistry 接口**:
```typescript
interface InstanceRegistry {
  // 生命周期
  register(identity: InstanceIdentity): Promise<void>;
  unregister(instance_id: string, reason?: string): Promise<void>;
  
  // 心跳
  heartbeat(instance_id: string): Promise<void>;
  
  // 查询
  getInstance(instance_id: string): Promise<InstanceIdentity | null>;
  getActiveInstances(): Promise<InstanceIdentity[]>;
  getFailedInstances(threshold_ms?: number): Promise<InstanceIdentity[]>;
  
  // 维护
  cleanupStaleInstances(): Promise<void>;
}
```

---

### 3.1.2 Heartbeat Contract (修正后)

**配置**:
```typescript
interface HeartbeatConfig {
  interval_ms: number;        // 心跳间隔 (默认 10s)
  timeout_ms: number;         // 超时阈值 (默认 30s = 3x interval)
  grace_period_ms: number;    // 宽限期 (默认 10s，防止 GC/阻塞误判)
  max_clock_drift_ms: number; // 最大时钟漂移 (默认 5s)
}
```

**故障检测逻辑**:
```typescript
isStale(instance: InstanceIdentity, now: number): boolean {
  const elapsed = now - instance.last_heartbeat;
  return elapsed > (this.config.timeout_ms + this.config.grace_period_ms);
}
```

**决策点**:
- ✅ 心跳间隔：10s (可配置)
- ✅ 超时阈值：30s (3x interval)
- ✅ 宽限期：10s (防止 GC/阻塞误判)
- ✅ 时钟漂移：5s 容忍度

---

### 3.1.3 Graceful vs Fault 语义 (修正后)

**Graceful Shutdown**:
```typescript
async unregister(instance_id: string, reason: 'shutdown' | 'maintenance'): Promise<void> {
  // 1. 标记为 inactive (不立即删除)
  await this.registry.markInactive(instance_id, reason);
  
  // 2. 记录 audit
  await this.auditService.log({
    type: 'instance_shutdown',
    instance_id,
    reason,
    timestamp: Date.now(),
  });
  
  // 3. 从活跃列表移除 (保留历史记录)
  await this.registry.remove(instance_id);
}
```

**Fault Detection (stale instance)**:
```typescript
async handleStaleInstance(instance: InstanceIdentity): Promise<void> {
  // 1. 标记为 failed
  await this.registry.markFailed(instance.instance_id);
  
  // 2. 记录 audit
  await this.auditService.log({
    type: 'instance_failed',
    instance_id: instance.instance_id,
    last_heartbeat: instance.last_heartbeat,
    detected_at: Date.now(),
  });
  
  // 3. 暴露给 A2-2/A2-3 处理 (lease 释放、work item 重分配)
  // A2-1 只负责检测和标记，不负责副作用
}
```

**决策点**:
- ✅ Graceful: 主动标记 + 有序清理
- ✅ Fault: 标记 failed + 暴露给下游处理
- ✅ Audit 记录区分原因
- ✅ A2-1 边界：只负责检测/标记/记录/暴露

---

### 3.1.4 Stale Instance Cleanup Rules (修正后)

**检测规则**:
```typescript
isStale(instance: InstanceIdentity): boolean {
  const elapsed = Date.now() - instance.last_heartbeat;
  const threshold = this.config.timeout_ms + this.config.grace_period_ms;
  return elapsed > threshold;
}
```

**处理流程**:
```
stale detected
    ↓
标记为 failed
    ↓
记录 audit (instance_failed)
    ↓
暴露给 A2-2/A2-3 (lease 释放、work item 重分配)
    ↓
7 天后删除 failed 记录 (清理)
```

**边界明确**:
- ✅ A2-1 职责：检测 → 标记 failed → 记录 audit → 暴露结果
- ❌ A2-1 不负责：lease 释放、work item 重分配 (由 A2-2/A2-3 执行)

---

### 3.2 Distributed Lease (原设计保持不变)

**设计**:
```typescript
interface DistributedLease {
  lease_id: string;         // 租约 ID (UUID)
  resource_type: string;    // 资源类型 (e.g., "incident", "work_item")
  resource_id: string;      // 资源 ID
  owner_instance_id: string; // 所有者实例 ID
  acquired_at: number;      // 获取时间
  expires_at: number;       // 过期时间
  renewed_count: number;    // 续租次数
  metadata?: Record<string, unknown>;
}
```

**租约语义**:
- **获取**: CAS 语义 (version 检查)
- **续租**: 仅 owner 可续租
- **释放**: owner 主动释放或过期自动释放
- **抢占**: 过期后可被其他实例抢占

**接口**:
```typescript
interface LeaseManager {
  acquire(
    resource_type: string,
    resource_id: string,
    instance_id: string,
    ttl_ms: number
  ): Promise<AcquireLeaseResult>;
  
  renew(
    lease_id: string,
    instance_id: string,
    ttl_ms: number
  ): Promise<RenewLeaseResult>;
  
  release(
    lease_id: string,
    instance_id: string
  ): Promise<ReleaseLeaseResult>;
  
  getLease(
    resource_type: string,
    resource_id: string
  ): Promise<DistributedLease | null>;
}
```

### 3.3 Work Item Protocol

**状态机**:
```
pending → claimed → processing → completed
              ↓           ↓
          released    failed
              ↓           ↓
          pending     pending (retry)
```

**协议**:
```typescript
interface WorkItem {
  id: string;
  type: string;
  status: 'pending' | 'claimed' | 'processing' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  
  // Ownership
  claimed_by?: string;      // instance_id
  claimed_at?: number;
  lease_expires_at?: number;
  
  // Processing
  processing_started_at?: number;
  processing_completed_at?: number;
  retry_count: number;
  max_retries: number;
  
  // Result
  result?: unknown;
  error?: string;
}

interface WorkItemCoordinator {
  // Claim
  claim(instance_id: string, filter?: WorkItemFilter): Promise<ClaimResult>;
  
  // Renew
  renew(item_id: string, instance_id: string, ttl_ms: number): Promise<RenewResult>;
  
  // Complete
  complete(item_id: string, instance_id: string, result: unknown): Promise<void>;
  
  // Fail
  fail(item_id: string, instance_id: string, error: string): Promise<void>;
  
  // Release (without completing)
  release(item_id: string, instance_id: string): Promise<void>;
}
```

### 3.4 Duplicate Suppression

**设计**:
```typescript
interface DeduplicationRecord {
  id: string;             // dedup key (e.g., hash of item)
  created_at: number;
  expires_at: number;     // TTL (e.g., 24h)
  instance_id: string;    // 首次处理的实例
  status: 'processing' | 'completed' | 'failed';
}

interface DuplicateSuppressor {
  // 检查是否重复
  checkAndMark(key: string, instance_id: string, ttl_ms: number): Promise<CheckResult>;
  
  // 清理过期记录
  cleanupExpired(): Promise<void>;
}
```

**去重策略**:
- **时间窗口**: 24h 内相同 key 视为重复
- **幂等键**: 基于业务 key (e.g., `alert_id + action`)
- **跨实例**: 共享存储 (文件/数据库)

---

## 四、实现计划

### 4.1 Phase 4.x-A2-1: Instance Identity (1-2 人日) (修正后)

**任务**:
- [ ] `InstanceIdentity` 类型定义 (instance_id + session_id 双标识)
- [ ] `InstanceRegistry` 接口定义
- [ ] 文件持久化实现 (log + snapshot 混合模式)
- [ ] `register()` - 实例启动自动注册
- [ ] `unregister()` - graceful shutdown
- [ ] `heartbeat()` - 每 10s 更新
- [ ] `getActiveInstances()` / `getFailedInstances()`
- [ ] `cleanupStaleInstances()` - 检测 + 标记 failed (不处理 lease/work item)

**边界明确**:
- ✅ A2-1 职责：检测 → 标记 failed → 记录 audit → 暴露结果
- ❌ A2-1 不负责：lease 释放、work item 重分配 (由 A2-2/A2-3 执行)

**验收**:
- [ ] 实例启动时自动注册 (instance_id 持久化)
- [ ] graceful unregister 正常 (标记 inactive)
- [ ] heartbeat 每 10s 更新
- [ ] 30s + 10s 宽限期后标记 failed
- [ ] stale cleanup 正常 (仅标记，无副作用)
- [ ] 旧 snapshot / log 恢复兼容

### 4.2 Phase 4.x-A2-2: Distributed Lease (2-3 人日)

**任务**:
- [ ] `DistributedLease` 接口定义
- [ ] `LeaseManager` 实现 (CAS 语义)
- [ ] 租约获取/续租/释放
- [ ] 过期检测与自动释放
- [ ] 租约审计记录

**验收**:
- [ ] 单实例获取租约成功
- [ ] 并发获取仅一个成功
- [ ] 续租仅 owner 可操作
- [ ] 过期后自动释放

### 4.3 Phase 4.x-A2-3: Work Item Protocol (3-4 人日)

**任务**:
- [ ] `WorkItem` 状态机定义
- [ ] `WorkItemCoordinator` 实现
- [ ] claim/renew/complete/fail/release
- [ ] 重试机制 (max_retries)
- [ ] 租约集成 (lease_expires_at)

**验收**:
- [ ] claim 后状态变更
- [ ] renew 延长租约
- [ ] complete 标记完成
- [ ] fail 触发重试
- [ ] release 返回 pending

### 4.4 Phase 4.x-A2-4: Duplicate Suppression (2-3 人日)

**任务**:
- [ ] `DeduplicationRecord` 定义
- [ ] `DuplicateSuppressor` 实现
- [ ] 幂等键生成策略
- [ ] 过期清理机制
- [ ] 去重审计记录

**验收**:
- [ ] 重复请求被拒绝
- [ ] 幂等键一致
- [ ] 过期记录自动清理

### 4.5 Phase 4.x-A2-5: 集成测试 (2-3 人日)

**任务**:
- [ ] 多实例并发 claim 测试
- [ ] 实例故障恢复测试
- [ ] 租约过期自动释放测试
- [ ] 去重有效性测试
- [ ] 性能压测 (开销 <5%)

**验收**:
- [ ] 20+ 集成测试通过
- [ ] 总测试覆盖率 ≥85%
- [ ] CI 全绿通过

---

## 五、技术细节

### 5.1 Instance ID 生成

**方案**: UUID v4
```typescript
import { v4 as uuidv4 } from 'uuid';

const instance_id = uuidv4();
// e.g., "550e8400-e29b-41d4-a716-446655440000"
```

**持久化**:
```typescript
// ~/.openclaw/runtime/instance_id.json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "instance_name": "worker-1",
  "started_at": 1712329200000
}
```

### 5.2 Lease 存储

**文件结构**:
```
~/.openclaw/runtime/leases/
├── incident_incident-123.json
├── work_item_item-456.json
└── ...
```

**CAS 实现**:
```typescript
async acquire(resource_type: string, resource_id: string, instance_id: string, ttl_ms: number): Promise<AcquireLeaseResult> {
  const fileLock = getFileLock();
  return await fileLock.withLock('leases', async () => {
    const lease = await this.loadLease(resource_type, resource_id);
    
    // Check if already leased
    if (lease && lease.expires_at > Date.now()) {
      if (lease.owner_instance_id === instance_id) {
        // Already owned by this instance
        return { success: true, lease, already_owned: true };
      } else {
        // Owned by another instance
        return { success: false, error: 'ALREADY_LEASED', current_owner: lease.owner_instance_id };
      }
    }
    
    // Acquire new lease
    const newLease: DistributedLease = {
      lease_id: uuidv4(),
      resource_type,
      resource_id,
      owner_instance_id: instance_id,
      acquired_at: Date.now(),
      expires_at: Date.now() + ttl_ms,
      renewed_count: 0,
    };
    
    await this.saveLease(newLease);
    return { success: true, lease: newLease };
  });
}
```

### 5.3 Work Item 存储

**文件结构**:
```
~/.openclaw/runtime/work_items/
├── pending/
│   ├── item-123.json
│   └── ...
├── processing/
│   └── item-456.json
├── completed/
│   └── item-789.json
└── failed/
    └── item-012.json
```

**状态转换**:
```typescript
async claim(instance_id: string, filter?: WorkItemFilter): Promise<ClaimResult> {
  const fileLock = getFileLock();
  return await fileLock.withLock('work_items', async () => {
    // Find pending item
    const item = await this.findPendingItem(filter);
    if (!item) {
      return { success: false, error: 'NO_PENDING_ITEMS' };
    }
    
    // Check for duplicate processing
    const dedupKey = this.generateDedupKey(item);
    const dedupResult = await this.deduplicator.checkAndMark(dedupKey, instance_id, 24 * 60 * 60 * 1000);
    if (!dedupResult.success) {
      return { success: false, error: 'DUPLICATE', existing_instance: dedupResult.existing_instance };
    }
    
    // Acquire lease
    const leaseResult = await this.leaseManager.acquire('work_item', item.id, instance_id, 30000);
    if (!leaseResult.success) {
      return { success: false, error: 'LEASE_FAILED' };
    }
    
    // Update status
    item.status = 'claimed';
    item.claimed_by = instance_id;
    item.claimed_at = Date.now();
    item.lease_expires_at = leaseResult.lease.expires_at;
    
    await this.saveItem(item);
    return { success: true, item };
  });
}
```

### 5.4 Heartbeat Mechanism

**心跳循环**:
```typescript
class InstanceHeartbeat {
  private intervalId: NodeJS.Timeout | null = null;
  
  start(instance_id: string, interval_ms: number = 10000): void {
    this.intervalId = setInterval(async () => {
      try {
        await this.registry.heartbeat(instance_id);
      } catch (error) {
        console.error(`[Heartbeat] Failed: ${error}`);
      }
    }, interval_ms);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

**故障检测**:
```typescript
async getFailedInstances(threshold_ms: number = 30000): Promise<InstanceIdentity[]> {
  const instances = await this.getActiveInstances();
  const now = Date.now();
  
  return instances.filter(instance => 
    now - instance.last_heartbeat > threshold_ms
  );
}
```

---

## 六、风险与缓解

### 6.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 文件锁竞争 | 中 | 中 | 细粒度锁 + 超时控制 |
| 心跳丢失 | 低 | 高 | 重试机制 + 宽限期 |
| 时钟漂移 | 低 | 中 | 本地时间戳 + lease 缓冲 |
| 存储损坏 | 低 | 高 | 备份 + 恢复机制 |

### 6.2 迁移风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 旧实例不兼容 | 中 | 中 | 向后兼容模式 |
| 配置复杂 | 中 | 低 | 默认配置 + 文档 |
| 性能退化 | 低 | 中 | 基准测试 + 优化 |

---

## 七、验收标准

### 7.1 Phase 4.x-A2 完成标准

- [ ] Instance Identity 实现
- [ ] Distributed Lease 实现
- [ ] Work Item Protocol 实现
- [ ] Duplicate Suppression 实现
- [ ] 20+ 集成测试通过
- [ ] 总测试覆盖率 ≥85%
- [ ] CI 全绿通过
- [ ] 性能开销 <5%

### 7.2 质量指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 测试通过率 | 100% | - |
| 测试覆盖率 | ≥85% | - |
| 并发冲突检测 | 100% | - |
| 租约有效性 | 100% | - |
| 去重准确率 | 100% | - |
| 性能开销 | <5% | - |

---

## 八、与 Phase 5.x 的关系

### 8.1 Phase 4.x-A2 范围

**多实例协调基础**:
- ✅ Instance Identity
- ✅ Distributed Lease
- ✅ Work Item Protocol
- ✅ Duplicate Suppression

### 8.2 Phase 5.x 范围

**平台化**:
- [ ] 水平扩展 (10+ 实例)
- [ ] 自动故障恢复
- [ ] 负载均衡
- [ ] 监控与告警
- [ ] 配置中心

### 8.3 依赖关系

```
Phase 4.x-A1 (乐观锁)
    ↓
Phase 4.x-A2 (多实例协调)
    ↓
Phase 5.x (平台化)
```

**Phase 4.x-A2 是 Phase 5.x 的基础**:
- 平台化需要 instance identity 识别实例
- 自动故障恢复需要 lease 机制
- 负载均衡需要 work item 协议
- 监控需要心跳数据

---

_文档版本：1.0  
创建时间：2026-04-05 15:25 CST_
