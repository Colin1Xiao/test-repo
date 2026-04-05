# Lock & Ownership Contract

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、锁安全总则

### 契约 L-0: 锁三原则

```
LOCK THREE PRINCIPLES

1. 互斥性 (Mutual Exclusion)
   同一资源同一时间只有一个持有者
   防止并发写入冲突

2. 有限持有 (Limited Hold)
   锁持有时间有上限
   超时自动释放

3. 可追溯性 (Traceability)
   锁获取/释放必须记录 Audit
   锁泄漏可检测
```

---

## 二、文件锁契约

### 契约 L-1: 写路径加锁

```
WRITE PATH LOCKING

FOR EACH file_write:
  MUST:
  - 获取文件锁
  - 执行写入
  - 验证写入成功
  - 释放文件锁
  
  MUST NOT:
  - 无锁写入
  - 持有锁超时 (>30s)
  - 释放非己方锁
END FOR
```

**实现约束**:
```typescript
async writeWithLock(data: any): Promise<void> {
  const lock = getFileLock();
  
  // 获取锁
  const acquired = await lock.acquire('incidents', 30000);
  if (!acquired) {
    throw new LockAcquireError('Failed to acquire lock');
  }
  
  try {
    // 执行写入
    await this.appendJsonl(data);
    
    // 验证写入
    await this.verifyWrite();
  } finally {
    // 释放锁 (必须)
    await lock.release('incidents');
  }
}
```

### 契约 L-2: 锁超时自动释放

```
LOCK TIMEOUT AUTO-RELEASE

MUST:
- 设置锁超时 (默认 30s)
- 超时后自动释放
- 记录锁超时到 Audit

MUST NOT:
- 无限期持有锁
- 静默超时 (不记录)
```

**实现约束**:
```typescript
async acquire(lockName: string, timeout_ms: number = 30000): Promise<boolean> {
  const lockPath = path.join(this.lockDir, `${lockName}.lock`);
  const lockData = {
    acquired_at: Date.now(),
    timeout_ms,
    pid: process.pid,
  };
  
  // 原子写入 (带超时)
  await fs.writeFile(lockPath, JSON.stringify(lockData));
  
  // 设置自动释放 (超时)
  setTimeout(async () => {
    await this.release(lockName);
    await this.audit.log({
      type: 'lock_timeout_release',
      object_type: 'file_lock',
      object_id: lockName,
    });
  }, timeout_ms);
  
  return true;
}
```

### 契约 L-3: 陈旧锁检测与清理

```
STALE LOCK DETECTION AND CLEANUP

DETECTION:
- 锁年龄 > 60s → 陈旧锁
- 锁持有者 PID 不存在 → 孤儿锁

CLEANUP:
- 自动清理陈旧锁
- 记录清理到 Audit
- 不清理活跃锁 (<60s)
```

**实现约束**:
```typescript
async cleanupStaleLocks(): Promise<number> {
  const locks = await fs.readdir(this.lockDir);
  let cleaned = 0;
  
  for (const lockFile of locks) {
    const lockPath = path.join(this.lockDir, lockFile);
    const stat = await fs.stat(lockPath);
    const age = Date.now() - stat.mtimeMs;
    
    if (age > 60000) { // 60s
      // 检查 PID 是否存在
      const lockData = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
      if (!processExists(lockData.pid)) {
        await fs.unlink(lockPath);
        cleaned++;
        
        await this.audit.log({
          type: 'stale_lock_cleaned',
          object_type: 'file_lock',
          object_id: lockFile,
          metadata: { age, pid: lockData.pid },
        });
      }
    }
  }
  
  return cleaned;
}
```

---

## 三、所有权契约

### 契约 L-4: Session 所有权

```
SESSION OWNERSHIP

FOR EACH recovery_session:
  MUST HAVE:
  - session_id
  - owner_id (持有者)
  - created_at
  - expires_at
  
  OWNERSHIP RULES:
  - 单实例：只有一个活跃 Session
  - 多实例：分布式锁确保互斥
  - 过期：自动标记为 expired
END FOR
```

### 契约 L-5: Item 所有权

```
ITEM OWNERSHIP

FOR EACH recovery_item:
  IF (item.status == 'claimed') THEN
    MUST HAVE:
    - claimed_by (声明者)
    - claimed_at
    - session_id (所属 Session)
    
    OWNERSHIP RULES:
    - 只有所属 Session 可操作
    - 其他 Session 不可 claim
    - 超时自动释放
  END IF
END FOR
```

**实现约束**:
```typescript
async claimItem(item_id: string, session_id: string): Promise<ItemClaimResult> {
  const item = await this.getItem(item_id);
  if (!item) {
    return { success: false, error: 'ITEM_NOT_FOUND' };
  }
  
  // 检查是否已被 claim
  if (item.status === 'claimed') {
    if (item.session_id !== session_id) {
      return { success: false, error: 'ITEM_ALREADY_CLAIMED' };
    }
  }
  
  // 原子 claim (Lua 脚本)
  const claimed = await this.redis.eval(`
    local item = redis.call('GET', KEYS[1])
    if not item then return nil end
    local data = cjson.decode(item)
    if data.status == 'claimed' and data.session_id ~= ARGV[1] then
      return nil
    end
    data.status = 'claimed'
    data.session_id = ARGV[1]
    data.claimed_at = tonumber(ARGV[2])
    redis.call('SET', KEYS[1], cjson.encode(data))
    return data
  `, [this.getItemKey(item_id)], [session_id, Date.now().toString()]);
  
  if (!claimed) {
    return { success: false, error: 'ITEM_ALREADY_CLAIMED' };
  }
  
  return { success: true, item: claimed };
}
```

### 契约 L-6: 所有权超时释放

```
OWNERSHIP TIMEOUT RELEASE

FOR EACH claimed_item:
  IF (now - claimed_at > claim_ttl) THEN
    item.status = 'pending'
    item.session_id = null
    item.claimed_at = null
  END IF
END FOR

DEFAULT claim_ttl: 10 分钟
```

---

## 四、并发控制契约

### 契约 L-7: 单实例并发保护

```
SINGLE-INSTANCE CONCURRENCY PROTECTION

GUARANTEE:
- 文件锁保护并发写入
- 内存索引一致
- 无数据损坏

LIMITATION:
- 仅单实例有效
- 多实例需分布式锁
```

### 契约 L-8: 多实例协调 (待实现)

```
MULTI-INSTANCE COORDINATION

REQUIREMENTS:
- 分布式锁 (Redis/etcd)
- Session 所有权
- Item 所有权
- 心跳续期

STATUS: ⚠️ 待实现 (Phase 4.x)
```

---

## 五、锁验证矩阵

| 契约 | 自动验证 | 手动验证 | 频率 |
|------|---------|---------|------|
| L-0: 锁三原则 | ❌ | ✅ | 设计审查 |
| L-1: 写路径加锁 | ✅ | ❌ | 每次写入 |
| L-2: 锁超时 | ✅ | ❌ | 每次获取 |
| L-3: 陈旧锁清理 | ✅ | ❌ | 每小时 |
| L-4: Session 所有权 | ✅ | ❌ | 每次创建 |
| L-5: Item 所有权 | ✅ | ❌ | 每次 claim |
| L-6: 所有权超时 | ✅ | ❌ | 每分钟 |
| L-7: 单实例保护 | ✅ | ❌ | 每次写入 |
| L-8: 多实例协调 | ❌ | ❌ | 待实现 |

---

## 六、违反处理

### 6.1 分级

| 级别 | 契约 | 响应时间 |
|------|------|---------|
| P0 | L-1, L-4, L-5 | 立即 |
| P1 | L-2, L-3, L-6 | 1 小时 |
| P2 | L-7, L-8 | 4 小时 |

### 6.2 处理流程

```
检测到违反
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

## 七、锁审计要求

### 7.1 审计日志

```
LOCK AUDIT REQUIREMENTS

MUST RECORD:
- lock_acquired
- lock_released
- lock_timeout_release
- stale_lock_cleaned
- lock_acquire_failed

MUST INCLUDE:
- lock_name
- owner (pid/session_id)
- timestamp
- duration (释放时)
```

### 7.2 审计查询

```bash
# 查询锁历史
curl -s "http://localhost:3000/alerting/timeline?event_type=lock_acquired" | jq '
  .events | group_by(.lock_name) | 
  map({
    lock: .[0].lock_name,
    count: length,
    avg_duration: (map(.metadata.duration) | add / length)
  })
'
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:51 CST_
