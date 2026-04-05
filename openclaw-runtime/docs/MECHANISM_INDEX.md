# Mechanism Index

**阶段**: Phase Y-1: Mechanism Asset Grounding  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、文档分类索引

### X-1: 状态与边界 (7 份)

| 文档 | 类别 | 约束对象 | 代码模块 | 测试模块 | 优先级 |
|------|------|---------|---------|---------|--------|
| incident_lifecycle.md | 状态机 | Incident | incident_file_repository.ts | incident.test.ts | P0 |
| approval_state_machine.md | 状态机 | Approval | approval_repository.ts | approval.test.ts | P1 |
| failure_modes_catalog.md | 失败模式 | 全系统 | 多模块 | failure.test.ts | P1 |
| idempotency_blueprint.md | 幂等规则 | 全系统 | 多模块 | idempotency.test.ts | P0 |
| event_schema_catalog.md | 数据模型 | Event | 多模块 | schema.test.ts | P0 |
| platform_boundary.md | 平台边界 | 架构 | 架构设计 | - | P2 |
| PHASE_X1_COMPLETION.md | 完成报告 | - | - | - | - |

### X-2: 时序与恢复 (5 份)

| 文档 | 类别 | 约束对象 | 代码模块 | 测试模块 | 优先级 |
|------|------|---------|---------|---------|--------|
| incident_sequence.md | 时序 | Incident | incident_file_repository.ts | sequence.test.ts | P0 |
| approval_sequence.md | 时序 | Approval | approval_repository.ts | sequence.test.ts | P1 |
| replay_recovery_sequence.md | 恢复 | Replay/Recovery | replay_engine.ts | recovery.test.ts | P0 |
| connector_event_sequence.md | 时序 | Connector | webhook_ingest.ts | connector.test.ts | P1 |
| PHASE_X2_COMPLETION.md | 完成报告 | - | - | - | - |

### X-3: 约束与演进 (7 份)

| 文档 | 类别 | 约束对象 | 代码模块 | 测试模块 | 优先级 |
|------|------|---------|---------|---------|--------|
| system_invariants.md | 不变性 | 全系统 | 多模块 | invariants.test.ts | P0 |
| write_ordering_rules.md | 写入顺序 | 全系统 | 多模块 | ordering.test.ts | P0 |
| audit_timeline_consistency_rules.md | 一致性 | Audit/Timeline | audit_log_service.ts | consistency.test.ts | P0 |
| recovery_safety_contract.md | 恢复安全 | Recovery | recovery_engine.ts | recovery_safety.test.ts | P0 |
| lock_and_ownership_contract.md | 锁与所有权 | Lock | file_lock.ts | lock.test.ts | P0 |
| evolution_guardrails.md | 演进护栏 | 架构 | 架构设计 | - | P1 |
| PHASE_X3_COMPLETION.md | 完成报告 | - | - | - | - |

---

## 二、规则到代码映射摘要

### Incident 相关

| 规则 | 代码位置 | 状态 |
|------|---------|------|
| W-1: Incident 创建顺序 | incident_file_repository.ts:create() | ✅ 已实现 |
| W-2: Incident 更新顺序 | incident_file_repository.ts:update() | ✅ 已实现 |
| W-3: Incident 快照顺序 | incident_file_repository.ts:createSnapshot() | ✅ 已实现 |
| I-1: Incident/Timeline 一致性 | 待验证 | ⚠️ 待测试 |
| I-10: 状态迁移合法性 | state_sequence.ts:transition() | ✅ 已实现 |

### Timeline 相关

| 规则 | 代码位置 | 状态 |
|------|---------|------|
| W-4: Timeline 事件顺序 | timeline_file_repository.ts:addEvent() | ✅ 已实现 |
| W-5: Timeline vs Incident 顺序 | alert_ingest.ts:ingest() | ✅ 已实现 |
| C-1: Incident 创建一致性 | 待验证 | ⚠️ 待测试 |
| C-3: Timeline 顺序一致性 | 待验证 | ⚠️ 待测试 |

### Audit 相关

| 规则 | 代码位置 | 状态 |
|------|---------|------|
| W-6: Audit 事件顺序 | audit_file_repository.ts:addEvent() | ✅ 已实现 |
| W-7: Audit vs 业务动作 | 多模块 | ⚠️ 部分实现 |
| C-4: Incident 创建 Audit | 待验证 | ⚠️ 待测试 |
| C-5: 状态变更 Audit | 待验证 | ⚠️ 待测试 |

### Recovery 相关

| 规则 | 代码位置 | 状态 |
|------|---------|------|
| R-1: Replay Dry-run 安全 | replay_engine.ts:replay() | ✅ 已实现 |
| R-4: Recovery Scan 安全 | recovery_engine.ts:scan() | ✅ 已实现 |
| R-5: Recovery 幂等 | recovery_engine.ts:recoverPending() | ✅ 已实现 |
| R-7: 重启只读加载 | incident_file_repository.ts:initialize() | ✅ 已实现 |

### Lock 相关

| 规则 | 代码位置 | 状态 |
|------|---------|------|
| L-1: 写路径加锁 | incident_file_repository.ts:create()/update() | ✅ 已实现 |
| L-2: 锁超时自动释放 | file_lock.ts:acquire() | ✅ 已实现 |
| L-3: 陈旧锁检测清理 | file_lock.ts:cleanupStaleLocks() | ✅ 已实现 |
| L-4: Session 所有权 | recovery_coordinator.ts | ✅ 已实现 |
| L-5: Item 所有权 | recovery_coordinator.ts:claimItem() | ✅ 已实现 |

---

## 三、测试覆盖矩阵

### 不变性测试

| 不变性 | 测试用例 | 状态 |
|--------|---------|------|
| I-1: Incident/Timeline 一致 | test_invariants_incident_timeline_consistency() | ⚠️ 待实现 |
| I-2: Correlation ID 可追踪 | test_invariants_correlation_chain() | ⚠️ 待实现 |
| I-3: 时间戳单调性 | test_invariants_timestamp_monotonicity() | ⚠️ 待实现 |
| I-4: 写入顺序 | test_invariants_write_order() | ⚠️ 待实现 |
| I-5: 锁持有边界 | test_invariants_lock_hold_time() | ⚠️ 待实现 |
| I-6: 幂等键唯一性 | test_invariants_idempotency_key() | ✅ 已验证 (Wave 2-A) |
| I-7: 重启恢复完整性 | test_invariants_restart_recovery() | ✅ 已验证 (Wave 2-A) |
| I-8: Replay 无副作用 | test_invariants_replay_dry_run() | ✅ 已验证 (Wave 2-A) |
| I-9: Recovery 幂等 | test_invariants_recovery_idempotency() | ✅ 已验证 (Wave 2-A) |
| I-10: 状态迁移合法 | test_invariants_state_transition() | ✅ 已实现 |
| I-11: 终端状态保护 | test_invariants_terminal_state() | ⚠️ 待实现 |
| I-12: 并发 Last-Write-Wins | test_invariants_concurrent_lww() | ✅ 已验证 (3B-1) |

### 写入顺序测试

| 规则 | 测试用例 | 状态 |
|------|---------|------|
| W-1: Incident 创建 | test_write_order_incident_create() | ✅ 已实现 |
| W-2: Incident 更新 | test_write_order_incident_update() | ✅ 已实现 |
| W-3: Incident 快照 | test_write_order_snapshot() | ⚠️ 待实现 |
| W-4: Timeline 事件 | test_write_order_timeline() | ✅ 已实现 |
| W-5: Timeline vs Incident | test_write_order_timeline_incident() | ⚠️ 待实现 |
| W-8: 锁获取 | test_write_order_lock_acquire() | ✅ 已实现 |
| W-9: 锁释放 | test_write_order_lock_release() | ✅ 已实现 |

### 一致性测试

| 规则 | 测试用例 | 状态 |
|------|---------|------|
| C-1: Incident 创建一致 | test_consistency_incident_create() | ⚠️ 待实现 |
| C-2: 状态变更一致 | test_consistency_status_change() | ⚠️ 待实现 |
| C-3: Timeline 顺序 | test_consistency_timeline_order() | ⚠️ 待实现 |
| C-4: Incident-Audit 一致 | test_consistency_incident_audit() | ⚠️ 待实现 |
| C-8: Correlation 串联 | test_consistency_correlation_chain() | ⚠️ 待实现 |

### 恢复安全测试

| 规则 | 测试用例 | 状态 |
|------|---------|------|
| R-1: Replay Dry-run | test_recovery_replay_dry_run() | ✅ 已实现 |
| R-4: Recovery Scan | test_recovery_scan() | ✅ 已实现 |
| R-5: Recovery 幂等 | test_recovery_idempotency() | ✅ 已实现 |
| R-7: 重启只读 | test_recovery_restart_readonly() | ✅ 已实现 |
| R-8: 重启一致性 | test_recovery_restart_consistency() | ✅ 已实现 (Wave 2-A) |

### 锁与所有权测试

| 规则 | 测试用例 | 状态 |
|------|---------|------|
| L-1: 写路径加锁 | test_lock_write_path() | ✅ 已实现 |
| L-2: 锁超时 | test_lock_timeout() | ✅ 已实现 |
| L-3: 陈旧锁清理 | test_lock_stale_cleanup() | ✅ 已实现 |
| L-4: Session 所有权 | test_lock_session_ownership() | ✅ 已实现 |
| L-5: Item 所有权 | test_lock_item_ownership() | ✅ 已实现 |

---

## 四、发布准入映射

### 必须补 Schema 的改动

| 改动类型 | 受影响规则 | 准入要求 |
|---------|----------|---------|
| 新增字段 | E-1: Schema 变更 | 迁移脚本 + 验证 |
| 删除字段 | E-1: Schema 变更 | 迁移期 + 文档 |
| 类型变更 | E-1: Schema 变更 | 转换逻辑 + 验证 |

### 必须补 Audit 的改动

| 改动类型 | 受影响规则 | 准入要求 |
|---------|----------|---------|
| 状态变更 | C-5: 状态变更 Audit | Audit 记录 |
| 新操作 | W-7: Audit vs 业务 | Audit 记录 |
| 恢复动作 | R-6: Recovery 副作用 | Audit 记录 |

### 必须补 Replay/Recovery 规则的改动

| 改动类型 | 受影响规则 | 准入要求 |
|---------|----------|---------|
| 新业务对象 | R-5: Recovery 幂等 | 幂等检查 |
| 新状态 | R-0: 恢复三原则 | 恢复流程 |
| 新写入 | W-1~W-14: 写入顺序 | 顺序验证 |

### 必须补 Consistency Test 的改动

| 改动类型 | 受影响规则 | 准入要求 |
|---------|----------|---------|
| Incident 变更 | C-1~C-3: Incident 一致性 | 一致性测试 |
| Timeline 变更 | C-3: Timeline 顺序 | 顺序测试 |
| Audit 变更 | C-4~C-7: Audit 一致性 | 一致性测试 |

### 必须更新 Platform Boundary 的改动

| 改动类型 | 受影响规则 | 准入要求 |
|---------|----------|---------|
| 新功能 | E-7: 平台化护栏 | 边界评估 |
| 新 Connector | E-9: Connector 标准化 | 接口规范 |
| 多实例 | E-8: 多实例护栏 | 分布式锁 |

---

## 五、后续实现优先级

### P0 (立即实现)

- [ ] 不变性自动化测试 (I-1~I-12)
- [ ] 一致性自动化测试 (C-1~C-9)
- [ ] Audit 完整记录 (W-7, C-4, C-5)

### P1 (Wave 2 后)

- [ ] Approval 文件持久化
- [ ] 乐观锁 (version 字段)
- [ ] 多实例分布式锁

### P2 (Phase 4.x)

- [ ] Schema 迁移框架
- [ ] Feature Flag 系统
- [ ] Connector 标准化

---

## 六、文档维护

### 更新频率

| 文档类型 | 频率 | 负责人 |
|---------|------|--------|
| 机制文档 (X-1/X-2/X-3) | 按需 | 架构组 |
| 索引文档 (Y-1) | 每月 | 架构组 |
| 映射文档 (Y-1) | 按需 | 开发组 |
| 测试矩阵 (Y-1) | 每周 | 测试组 |

### 版本控制

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-04-05 | 初始版本 (Phase X 完成) |

---

_文档版本：1.0  
最后更新：2026-04-05 05:54 CST_
