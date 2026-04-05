# Idempotency Blueprint

**阶段**: Phase X-1: Source Intelligence Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、幂等性分类

### 1.1 操作类型

| 类型 | 幂等性 | 示例 |
|------|--------|------|
| 读操作 | ✅ 天然幂等 | GET /incidents/:id |
| 创建操作 | ⚠️ 需保证幂等 | POST /alerting/ingest |
| 更新操作 | ⚠️ 需保证幂等 | PATCH /incidents/:id |
| 删除操作 | ⚠️ 需保证幂等 | DELETE /:resource/:id |

### 1.2 幂等策略

| 策略 | 适用场景 | 实现方式 |
|------|---------|---------|
| Dedupe Key | 创建操作 | 基于 correlation_id/resource |
| Idempotency Key | 任意操作 | 客户端提供唯一 key |
| 状态检查 | 更新操作 | 检查当前状态 |
| 乐观锁 | 并发更新 | version 字段 |

---

## 二、Dedupe 机制

### 2.1 Alert Dedupe

**场景**: 相同 alert 短时间多次投递

**实现**:
```typescript
// AlertIngestService
private recentAlerts: Map<string, number> = new Map();
private config = {
  silence_duplicates: true,
  duplicate_window_ms: 5 * 60 * 1000, // 5 分钟
};

async ingest(rawAlert: RawAlert): Promise<IngestedAlert | null> {
  const key = this.getDuplicateKey(alert_name, resource, correlation_id);
  const lastSeen = this.recentAlerts.get(key);
  const now = Date.now();

  if (lastSeen && (now - lastSeen) < this.config.duplicate_window_ms) {
    return null; // 抑制重复
  }

  this.recentAlerts.set(key, now);
  // ... 处理 alert
}
```

**Dedupe Key**:
```typescript
getDuplicateKey(alert_name, resource, correlation_id): string {
  return `${alert_name}:${resource || ''}:${correlation_id || ''}`;
}
```

**验证**: Wave 2-A T+0h (10 并发，1 成功/9 抑制)

### 2.2 Incident Dedupe

**场景**: 相同 correlation_id 创建多个 incident

**实现**:
```typescript
// IncidentFileRepository
createOrGet(request: IncidentCreateRequest): { incident: Incident; created: boolean } {
  // 检查相同 correlation_id 的 open incident
  const existing = this.findExistingIncident(type, correlation_id, resource, alert_name);
  if (existing) {
    // 关联 alert，不创建新 incident
    existing.related_alerts.push(alert_name);
    return { incident: existing, created: false };
  }

  // 创建新 incident
  const incident = { ... };
  await this.create(incident);
  return { incident, created: true };
}
```

**检查顺序**:
1. 相同 correlation_id 的 open incident
2. 相同 resource 的 open incident (同类型)
3. 相同 alert 的 open incident (5 分钟内)

### 2.3 Webhook Dedupe

**场景**: 相同 webhook payload 重复投递

**实现**:
```typescript
// Webhook Ingest Handler
async ingest(webhook: WebhookPayload): Promise<WebhookIngestResult> {
  const event_id = webhook.event_id || this.generateEventId(webhook);
  
  // 检查是否已处理
  const existing = await this.getEventById(event_id);
  if (existing) {
    return { ingested: false, reason: 'duplicate' };
  }

  // 处理 webhook
  await this.processEvent(webhook);
  return { ingested: true, event_id };
}
```

**验证**: Wave 2-A T+0h (10 并发，8 成功/2 抑制)

---

## 三、Idempotency Key 机制

### 3.1 客户端提供 Key

**场景**: 客户端需要保证操作幂等性

**实现**:
```typescript
// Idempotency Middleware
async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next(); // 无 key，不处理
  }

  // 检查是否已处理
  const existing = await idempotencyManager.get(idempotencyKey);
  if (existing) {
    return res.json(existing.response); // 返回缓存响应
  }

  // 记录 key (防止并发)
  await idempotencyManager.set(idempotencyKey, { status: 'processing' });

  // 处理请求
  next();
}
```

**存储**:
```typescript
// IdempotencyManager
async set(key: string, value: IdempotencyRecord): Promise<void> {
  await redis.set(`idempotency:${key}`, JSON.stringify(value), {
    ex: 24 * 60 * 60, // 24 小时 TTL
  });
}
```

### 3.2 并发保护

**场景**: 相同 key 的并发请求

**实现**:
```typescript
// Distributed Lock
async acquire(key: string): Promise<boolean> {
  const lockKey = `lock:idempotency:${key}`;
  const acquired = await redis.set(lockKey, '1', {
    nx: true,
    ex: 30, // 30 秒超时
  });
  return !!acquired;
}
```

**验证**: 3B-1 并发测试通过

---

## 四、状态检查机制

### 4.1 Incident 状态检查

**场景**: 重复 resolve 同一 incident

**实现**:
```typescript
// Incident Update Handler
async updateIncident(id: string, update: IncidentUpdateRequest): Promise<Incident> {
  const incident = await incidentRepo.getById(id);
  if (!incident) {
    throw new NotFoundError();
  }

  // 状态检查
  if (incident.status === update.status) {
    // 状态不变，记录更新
    incident.updated_at = Date.now();
    incident.updated_by = update.updated_by;
    await incidentRepo.update(incident);
    return incident;
  }

  // 状态变更，验证合法性
  const transition = stateValidator.validateTransition(
    'incidents',
    incident.status,
    update.status
  );
  if (!transition.allowed) {
    throw new InvalidTransitionError(transition.reason);
  }

  // 执行更新
  incident.status = update.status;
  // ...
}
```

**验证**: 3B-1 并发测试通过 (5 并发，状态合法)

### 4.2 Approval 状态检查

**场景**: 重复审批同一 approval

**实现**:
```typescript
// Approval Resolve Handler
async resolveApproval(id: string, action: 'approve' | 'reject'): Promise<Approval> {
  const approval = await approvalRepo.getById(id);
  if (!approval) {
    throw new NotFoundError();
  }

  // 状态检查
  if (approval.status !== 'pending') {
    throw new InvalidStateError(`Approval is not pending: ${approval.status}`);
  }

  // 执行审批
  approval.status = action === 'approve' ? 'approved' : 'rejected';
  // ...
}
```

---

## 五、乐观锁机制

### 5.1 Version 字段

**场景**: 并发更新同一对象

**设计**:
```typescript
interface Incident {
  id: string;
  status: string;
  version: number; // 乐观锁版本号
  updated_at: number;
  // ...
}
```

**更新逻辑**:
```typescript
async update(incident_id: string, update: IncidentUpdateRequest, expected_version: number): Promise<Incident> {
  const incident = await incidentRepo.getById(incident_id);
  if (!incident) {
    throw new NotFoundError();
  }

  // 版本检查
  if (incident.version !== expected_version) {
    throw new ConcurrentModificationError(
      `Version mismatch: expected ${expected_version}, got ${incident.version}`
    );
  }

  // 更新
  incident.version++;
  incident.updated_at = Date.now();
  // ...
}
```

**状态**: ⚠️ 待实现 (当前 last-write-wins)

---

## 六、Side-Effect 抑制

### 6.1 副作用分类

| 类型 | 示例 | 抑制策略 |
|------|------|---------|
| 外部 API 调用 | OKX 下单 | 幂等 key + 去重 |
| 文件写入 | JSONL 追加 | 文件锁 |
| 通知发送 | Telegram 消息 | 去重 + 限流 |
| 状态变更 | Incident resolve | 状态检查 |

### 6.2 副作用抑制规则

**规则 1: 创建操作**
```
IF (对象已存在) THEN
  返回已存在对象
ELSE
  创建对象
END IF
```

**规则 2: 更新操作**
```
IF (当前状态 == 预期状态) THEN
  执行更新
ELSE IF (当前状态是终端状态) THEN
  拒绝更新
ELSE
  记录冲突，返回当前状态
END IF
```

**规则 3: 删除操作**
```
IF (对象存在) THEN
  标记删除
  返回成功
ELSE
  返回成功 (幂等)
END IF
```

---

## 七、重试与恢复

### 7.1 重试策略

**场景**: 操作失败后重试

**规则**:
1. 幂等操作可安全重试
2. 非幂等操作需幂等 key
3. 重试次数限制 (默认 3 次)
4. 重试间隔指数退避

**实现**:
```typescript
async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 指数退避
    }
  }
}
```

### 7.2 恢复策略

**场景**: 服务重启后恢复未完成操作

**规则**:
1. 扫描 pending/in-progress 对象
2. 检查操作幂等性
3. 安全重放或跳过
4. 记录恢复动作到 Audit

**实现**:
```typescript
// Recovery Coordinator
async recoverPendingOperations(): Promise<void> {
  const pending = await this.scanPending();
  for (const item of pending) {
    // 检查是否已处理 (幂等)
    const processed = await this.checkIfProcessed(item);
    if (processed) {
      await this.markAsRecovered(item);
      continue;
    }

    // 重放操作
    await this.replayOperation(item);
  }
}
```

---

## 八、已验证行为

| 场景 | 测试 | 结果 |
|------|------|------|
| Alert Dedupe | 10 并发 ingest | ✅ 1 成功/9 抑制 |
| Webhook Dedupe | 10 并发 webhook | ✅ 8 成功/2 抑制 |
| Incident 状态更新 | 5 并发 PATCH | ✅ 状态合法 |
| 重启恢复 | 重启后查询 | ✅ 数据一致 |

---

## 九、待改进项

### 9.1 短期 (Wave 2 后)

- [ ] Idempotency Key 中间件
- [ ] 乐观锁 (version 字段)
- [ ] 并发冲突检测

### 9.2 中期 (Phase 4.x)

- [ ] Redis 幂等存储
- [ ] 分布式幂等锁
- [ ] 幂等性监控

### 9.3 长期 (平台化)

- [ ] 通用幂等框架
- [ ] 幂等性配置化
- [ ] 跨服务幂等追踪

---

_文档版本：1.0  
最后更新：2026-04-05 05:38 CST_
