# Connector Event Sequence

**阶段**: Phase X-2: Temporal & Recovery Mechanics Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、Connector 事件传播顺序

### 1.1 Webhook 入口流程

**时序**:
```
T0:   Webhook 到达 (外部系统)
T0+ε: 验证签名 (安全)
T0+2ε: ├─ 如果签名无效 → 返回 401
T0+2ε: └─ 如果签名有效 → 继续
T0+3ε: 解析 Payload
T0+4ε: 提取 event_id (幂等 key)
T0+5ε: 检查是否已处理 (幂等)
T0+6ε: ├─ 如果已处理 → 返回 ingested=false
T0+6ε: └─ 如果未处理 → 继续
T0+7ε: 获取文件锁 (audit)
T0+8ε: 记录 Audit (webhook_received)
T0+9ε: 释放文件锁
T0+10ε: Webhook Mapping (provider → internal)
T0+11ε: 转换为 Alert/Incident
T0+12ε: 调用 Alert Ingest (见 Incident Sequence 1.1)
T0+13ε: 获取文件锁 (audit)
T0+14ε: 记录 Audit (webhook_processed)
T0+15ε: 释放文件锁
T0+16ε: 返回 ingested=true
```

**关键点**:
1. 签名验证 **先于** 解析 (安全)
2. 幂等检查 **先于** 任何写入
3. Audit 入口记录 **先于** 业务处理
4. Mapping **后于** 幂等检查 (避免无效计算)
5. Audit 出口记录 **后于** 业务处理

**实现**:
```typescript
async ingestWebhook(webhook: WebhookPayload, signature: string): Promise<WebhookIngestResult> {
  // 1. 签名验证
  const valid = await this.verifySignature(webhook, signature);
  if (!valid) {
    throw new UnauthorizedError('Invalid signature');
  }

  // 2. 解析
  const event_id = this.extractEventId(webhook);

  // 3. 幂等检查
  const existing = await this.getEventById(event_id);
  if (existing) {
    return { ingested: false, reason: 'duplicate' };
  }

  // 4. Audit 入口
  await this.audit.log({
    type: 'webhook_received',
    object_type: 'webhook',
    object_id: event_id,
    metadata: { provider: webhook.provider },
  });

  // 5. Mapping
  const alert = await this.mapWebhookToAlert(webhook);

  // 6. Alert Ingest
  const result = await this.alertIngest.ingest(alert);

  // 7. Audit 出口
  await this.audit.log({
    type: 'webhook_processed',
    object_type: 'webhook',
    object_id: event_id,
    metadata: { result },
  });

  return { ingested: true, event_id };
}
```

### 1.2 定时轮询流程

**时序**:
```
T0:   定时任务触发 (每 N 秒)
T0+ε: 获取轮询锁 (防止多实例重复)
T0+2ε: ├─ 如果锁获取失败 → 跳过本轮
T0+2ε: └─ 如果锁获取成功 → 继续
T0+3ε: 调用 Connector API (拉取事件)
T0+4ε: FOR EACH event IN events:
T0+5ε:   检查是否已处理 (幂等)
T0+6ε:   ├─ 如果已处理 → 跳过
T0+6ε:   └─ 如果未处理 → 处理事件
T0+7ε:     转换为 Alert/Incident
T0+8ε:     调用 Alert Ingest
T0+9ε:     记录处理进度 (checkpoint)
T0+10ε: 释放轮询锁
T0+11ε: 记录轮询日志
```

**关键点**:
1. 轮询锁 **先于** API 调用 (防止重复)
2. 每个事件独立幂等检查
3. Checkpoint 记录 (支持断点续传)
4. 锁持有时间 = 轮询耗时

---

## 二、Connector 与 Incident 的时序关系

### 2.1 Webhook → Alert → Incident

**时序**:
```
T0:   OKX Order Webhook 到达
T0+ε: 签名验证
T0+2ε: 解析 Payload
T0+3ε: 提取 event_id (ordId)
T0+4ε: 幂等检查
T0+5ε: Audit (webhook_received)
T0+6ε: Webhook Mapping
T0+7ε:   event_type: order → alert_type: order_event
T0+8ε:   severity: 根据订单状态映射
T0+9ε:   correlation_id: clOrdId
T0+10ε: Alert Ingest
T0+11ε:   Dedupe 检查
T0+12ε:   Timeline (alert_triggered)
T0+13ε:   Alert Router
T0+14ε:   Timeline (alert_routed)
T0+15ε:   Incident 检查
T0+16ε:   ├─ 如果存在 → 关联 alert
T0+16ε:   └─ 如果不存在 → 创建 Incident
T0+17ε:       Timeline (incident_created)
T0+18ε: Audit (webhook_processed)
```

**映射示例**:
```typescript
// OKX Order Webhook Mapping
const mapping: WebhookMapping = {
  provider: 'okx',
  event_type: 'order',
  mapping: {
    event_id: '$.data[0].ordId',
    correlation_id: '$.data[0].clOrdId',
    resource: '$.arg.instId',
    severity: mapOrderStateToSeverity($.data[0].state),
    metadata: {
      order_id: '$.data[0].ordId',
      status: '$.data[0].state',
      side: '$.data[0].side',
      price: '$.data[0].px',
      amount: '$.data[0].sz',
    },
  },
};

function mapOrderStateToSeverity(state: string): string {
  switch (state) {
    case 'filled': return 'P2';  // 正常成交
    case 'canceled': return 'P3';  // 取消
    case 'rejected': return 'P1';  // 拒绝
    default: return 'P3';
  }
}
```

### 2.2 Connector 事件去重

**场景**: 同一事件多次投递

**抑制规则**:
```
IF (event_id 已存在) THEN
  返回 ingested=false
  不创建 Alert/Incident
  记录 Audit (webhook_duplicate)
END IF
```

**实现**:
```typescript
async checkEventExists(event_id: string): Promise<boolean> {
  // 检查 Audit (最快)
  const audit_event = await this.audit.query({
    object_type: 'webhook',
    object_id: event_id,
  });
  if (audit_event.length > 0) return true;

  // 检查 Incident (correlation_id)
  const incidents = await this.incidentRepo.query({
    correlation_id: event_id,
  });
  if (incidents.length > 0) return true;

  return false;
}
```

---

## 三、副作用抑制规则

### 3.1 Webhook 入口抑制

| 操作 | 抑制规则 |
|------|---------|
| 签名验证 | ✅ 必须 (安全) |
| 幂等检查 | ✅ 必须 |
| 文件写入 | ⚠️ 仅 Audit (入口) |
| Alert/Incident | ✅ 允许 (如未处理) |
| 通知发送 | ❌ 禁止 (由 Alert 处理) |

### 3.2 轮询入口抑制

| 操作 | 抑制规则 |
|------|---------|
| 轮询锁 | ✅ 必须 (防重复) |
| API 调用 | ✅ 允许 |
| 事件处理 | ⚠️ 幂等检查后 |
| Checkpoint | ✅ 必须 (断点续传) |
| 通知发送 | ❌ 禁止 (由 Alert 处理) |

### 3.3 Restart 抑制

| 操作 | 抑制规则 |
|------|---------|
| 轮询锁清理 | ✅ 必须 (陈旧锁) |
| Checkpoint 恢复 | ✅ 允许 |
| 断点续传 | ✅ 允许 |
| 全量重放 | ❌ 禁止 (除非显式触发) |

---

## 四、已验证时序

| 场景 | 验证状态 | 备注 |
|------|---------|------|
| Webhook 签名验证 | ✅ 已实现 | 待 OKX 测试 |
| Webhook 幂等 | ✅ Wave 2-A | 10 并发，8 成功/2 抑制 |
| Webhook Mapping | ✅ Wave 2-A | OKX order 事件 |
| 轮询锁 | ⚠️ 待验证 | 单实例未启用 |
| Checkpoint | ⚠️ 待验证 | 功能已实现 |

---

## 五、时序异常处理

### 5.1 签名验证失败

**规则**:
```
IF (签名验证失败) THEN
  记录安全日志
  返回 401
  不记录 Audit (避免日志污染)
  如果连续失败 >10 次 → 告警
END IF
```

### 5.2 Mapping 失败

**规则**:
```
IF (Webhook Mapping 失败) THEN
  记录错误日志
  记录 Audit (webhook_mapping_failed)
  返回 500
  不创建 Alert/Incident
END IF
```

### 5.3 轮询超时

**规则**:
```
IF (轮询耗时 > 阈值) THEN
  记录警告日志
  释放轮询锁
  记录 Checkpoint (已处理事件)
  下次轮询从 Checkpoint 继续
END IF
```

**阈值**:
| Connector | 阈值 | 动作 |
|-----------|------|------|
| OKX | 30s | 释放锁 + Checkpoint |
| Binance | 30s | 释放锁 + Checkpoint |
| Generic | 60s | 释放锁 + Checkpoint |

---

_文档版本：1.0  
最后更新：2026-04-05 05:45 CST_
