# Phase 4.x-A2-4: Duplicate Suppression Design

**阶段**: Phase 4.x-A2-4: Duplicate Suppression  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: 
- Phase 4.x-A2-1 (Instance Registry) ✅
- Phase 4.x-A2-2 (Distributed Lease) ✅
- Phase 4.x-A2-3 (Work Item Protocol) ✅

---

## 一、设计决策总结

### 1.1 Suppression Key 构成

**决策**: 显式 key 构成

```typescript
interface SuppressionKey {
  suppression_scope: string;    // e.g., "alert_ingest", "incident_transition"
  action_type: string;          // e.g., "create", "update", "claim"
  correlation_id?: string;      // 业务唯一键
  fingerprint?: string;         // payload fingerprint (可选)
  source?: string;              // provider/source (可选)
}
```

**生成规则**:
```typescript
generateSuppressionKey(input: EvaluateSuppressionInput): string {
  const parts = [
    input.suppression_scope,
    input.action_type,
    input.correlation_id || '',
    input.fingerprint || '',
  ];
  return parts.filter(p => p).join(':');
  // e.g., "alert_ingest:create:alert-123"
}
```

**理由**:
- ✅ scope + action 明确层级
- ✅ correlation_id 业务唯一性
- ✅ fingerprint 内容去重
- ✅ 可解释性

---

### 1.2 Dedupe Scope 层级

**决策**: 显式 scope 枚举

```typescript
type SuppressionScope = 
  | 'alert_ingest'        // 告警摄入
  | 'webhook_ingest'      // webhook 摄入
  | 'incident_transition' // incident 状态变更
  | 'work_item_claim'     // work item 认领
  | 'recovery_scan'       // 恢复扫描
  | 'replay_run'          // 回放执行
  | 'connector_sync'      // connector 同步
  | 'global';             // 全局去重
```

**理由**:
- ✅ 显式 scope 避免隐含规则
- ✅ 不同链路互不污染
- ✅ 便于查询和审计

---

### 1.3 TTL / Duplicate Window 语义

**决策**: scope 差异化 TTL

```typescript
interface SuppressionConfig {
  default_ttl_ms: number;              // 默认 TTL (24h)
  scope_ttls: Record<string, number>;  // scope 差异化 TTL
  max_ttl_ms: number;                  // 最大 TTL (7d)
  replay_safe_mode: boolean;           // replay 安全模式
}

const DEFAULT_SUPPRESSION_CONFIG: SuppressionConfig = {
  default_ttl_ms: 24 * 60 * 60 * 1000,   // 24h
  scope_ttls: {
    'alert_ingest': 5 * 60 * 1000,       // 5min
    'webhook_ingest': 1 * 60 * 1000,     // 1min
    'incident_transition': 60 * 60 * 1000, // 1h
    'work_item_claim': 30 * 60 * 1000,   // 30min
    'recovery_scan': 24 * 60 * 60 * 1000, // 24h
    'replay_run': 7 * 24 * 60 * 60 * 1000, // 7d
  },
  max_ttl_ms: 7 * 24 * 60 * 60 * 1000,   // 7d
  replay_safe_mode: true,
};
```

**规则**:
- ✅ TTL 到期后再次出现 → ALLOWED
- ✅ replay 模式 → REPLAY_SAFE_ALLOWED (绕过 TTL)
- ✅ 不同 scope 不同 TTL

---

### 1.4 Suppress / Allow / Replay-Safe 结果语义

**决策**: 正式枚举

```typescript
type SuppressionDecision = 'ALLOWED' | 'SUPPRESSED' | 'INVALID_SCOPE' | 'ERROR';

interface SuppressionResult {
  decision: SuppressionDecision;
  reason: string;
  record?: SuppressionRecord;  // SUPPRESSED 时返回
  ttl_ms?: number;             // ALLOWED 时返回
  expires_at?: number;         // ALLOWED 时返回
}
```

**语义**:
- ✅ `ALLOWED` - 首次出现 / TTL 过期 / replay 安全模式
- ✅ `SUPPRESSED` - 重复 / 已处理
- ✅ `INVALID_SCOPE` - 未知 scope
- ✅ `ERROR` - 系统错误

---

### 1.5 与 A2-2 / A2-3 的边界

**决策**: A2-4 只负责判断，不负责执行

**调用链**:
```
Ingest / Webhook
    ↓
A2-4: DuplicateSuppressionManager.evaluate()
    ↓
    ├─ SUPPRESSED → 返回，不继续
    └─ ALLOWED → 继续
        ↓
    A2-2: LeaseManager.acquire()
        ↓
    A2-3: WorkItemCoordinator.claim()
        ↓
    Business Logic
```

**边界清晰**:
- ✅ A2-4: 判断"该不该继续"
- ❌ A2-4 不负责: lease 所有权、work item 生命周期

---

### 1.6 持久化与恢复语义

**决策**: 与 A2-1/A2-2/A2-3 一致

**存储结构**:
```
~/.openclaw/runtime/suppression/
├── suppression_log.jsonl     // append-only 事件日志
├── suppression_snapshot.json // 定期快照
└── suppression.json          // 内存缓存
```

**事件类型**:
```typescript
type SuppressionEvent = {
  type: 'suppression_created' | 'suppression_hit' | 'suppression_expired' | 'suppression_released';
  suppression_key: string;
  timestamp: number;
  data: Partial<SuppressionRecord> & {
    hit_count?: number;
    reason?: string;
  };
};
```

**恢复语义**:
- ✅ snapshot + log replay
- ✅ suppression 状态重启后恢复
- ✅ TTL 过期记录定期清理
- ✅ replay 模式绕过 TTL

---

### 1.7 冲突与证据链

**决策**: 完整审计记录

**Suppression Audit Event**:
```typescript
interface SuppressionAuditEvent {
  type: 'suppression_evaluated' | 'suppression_suppressed' | 'suppression_allowed';
  suppression_key: string;
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  decision: 'ALLOWED' | 'SUPPRESSED';
  reason: string;
  ttl_ms: number;
  expires_at: number;
  hit_count: number;
  timestamp: number;
  actor?: string;
}
```

**理由**:
- ✅ 完整证据链
- ✅ 可解释"为什么被吞掉"
- ✅ 便于调试和审计

---

## 二、核心接口

### 2.1 SuppressionRecord Schema

```typescript
interface SuppressionRecord {
  suppression_key: string;
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  first_seen_at: number;
  last_seen_at: number;
  expires_at: number;
  hit_count: number;
  status: 'active' | 'expired' | 'released';
  version: number;
  metadata?: Record<string, unknown>;
}
```

---

### 2.2 DuplicateSuppressionManager Interface

```typescript
interface DuplicateSuppressionManager {
  // 评估去重
  evaluate(input: EvaluateSuppressionInput): Promise<SuppressionResult>;
  
  // 记录去重 (显式记录)
  record(input: RecordSuppressionInput): Promise<RecordSuppressionResult>;
  
  // 查询
  getRecord(key: string): Promise<SuppressionRecord | null>;
  getActiveRecords(scope?: string): Promise<SuppressionRecord[]>;
  
  // 过期管理
  detectExpiredRecords(now?: number): Promise<SuppressionRecord[]>;
  cleanupExpiredRecords(): Promise<void>;
}
```

---

### 2.3 Input Types

```typescript
interface EvaluateSuppressionInput {
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  source?: string;
  replay_mode?: boolean;  // 是否 replay 模式
}

interface RecordSuppressionInput {
  suppression_key: string;
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  ttl_ms?: number;
  metadata?: Record<string, unknown>;
}
```

---

### 2.4 Result Types

```typescript
type SuppressionDecision = 'ALLOWED' | 'SUPPRESSED' | 'INVALID_SCOPE' | 'ERROR';

interface SuppressionResult {
  decision: SuppressionDecision;
  reason: string;
  record?: SuppressionRecord;
  ttl_ms?: number;
  expires_at?: number;
}

interface RecordSuppressionResult {
  success: boolean;
  record?: SuppressionRecord;
  error?: string;
}
```

---

## 三、实现计划

### 3.1 Phase 4.x-A2-4-1: DuplicateSuppressionManager 核心 (1-2 人日)

**任务**:
- [ ] SuppressionRecord 类型定义
- [ ] DuplicateSuppressionManager 接口定义
- [ ] evaluate 实现 (key 生成 + TTL 检查)
- [ ] record 实现 (显式记录)

**验收**:
- [ ] 首次出现 → ALLOWED
- [ ] 重复出现 → SUPPRESSED
- [ ] TTL 过期 → ALLOWED
- [ ] 未知 scope → INVALID_SCOPE

### 3.2 Phase 4.x-A2-4-2: TTL 管理 (1 人日)

**任务**:
- [ ] scope 差异化 TTL
- [ ] TTL 过期检测
- [ ] 定期清理机制
- [ ] replay 安全模式

**验收**:
- [ ] 不同 scope 不同 TTL
- [ ] TTL 过期自动清理
- [ ] replay 模式绕过 TTL

### 3.3 Phase 4.x-A2-4-3: 持久化 (1 人日)

**任务**:
- [ ] suppression_log.jsonl append-only
- [ ] suppression_snapshot.json 定期快照
- [ ] 崩溃恢复 (replay log + snapshot)

**验收**:
- [ ] 事件写入 log
- [ ] snapshot 恢复
- [ ] corrupted log 容错

### 3.4 Phase 4.x-A2-4-4: 测试 (2-3 人日)

**任务**:
- [ ] evaluate 测试 (8 条)
- [ ] TTL 管理测试 (6 条)
- [ ] replay 安全模式测试 (4 条)
- [ ] 持久化恢复测试 (6 条)
- [ ] 与 A2-2/A2-3 集成测试 (4 条)

**验收**:
- [ ] 28+ 测试通过
- [ ] 无回归失败

---

## 四、测试策略

### 4.1 测试模式配置

```typescript
const suppressionManager = new DuplicateSuppressionManager({
  dataDir,
  config: {
    default_ttl_ms: 100,   // 快速测试
    scope_ttls: {
      'test': 50,          // 快速测试
    },
  },
  autoCleanup: false,
});
```

### 4.2 测试覆盖矩阵

| 契约 | 测试 | 用例数 |
|------|------|--------|
|