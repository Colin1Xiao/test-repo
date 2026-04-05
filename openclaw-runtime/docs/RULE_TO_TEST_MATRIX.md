# Rule to Test Matrix

**阶段**: Phase Y-1: Mechanism Asset Grounding  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、不变性测试矩阵 (12 条)

### I-1: Incident/Timeline 一致性

**测试用例**: `test_invariants_incident_timeline_consistency()`

**测试步骤**:
1. 创建 Incident
2. 查询 Timeline 事件
3. 验证 `incident_created` 事件存在
4. 验证时间戳顺序

**预期结果**:
- Timeline 包含 `incident_created` 事件
- 事件时间戳 <= Incident 创建时间 + 1000ms

**实现状态**: ⚠️ 待实现

**优先级**: P0

### I-2: Correlation ID 可追踪性

**测试用例**: `test_invariants_correlation_chain()`

**测试步骤**:
1. 创建 Alert (带 correlation_id)
2. 查询所有相关事件
3. 验证包含 `alert_triggered` 和 `incident_created/linked`

**预期结果**:
- 事件链完整
- 所有事件 correlation_id 一致

**实现状态**: ⚠️ 待实现

**优先级**: P0

### I-3: 时间戳单调性

**测试用例**: `test_invariants_timestamp_monotonicity()`

**测试步骤**:
1. 查询 Incident 的 Timeline 事件
2. 验证时间戳递增

**预期结果**:
- 所有事件时间戳递增

**实现状态**: ⚠️ 待实现

**优先级**: P0

### I-4 ~ I-12

| 不变性 | 测试用例 | 状态 | 优先级 |
|--------|---------|------|--------|
| I-4: 写入顺序 | `test_invariants_write_order()` | ⚠️ 待实现 | P0 |
| I-5: 锁持有边界 | `test_invariants_lock_hold_time()` | ⚠️ 待实现 | P1 |
| I-6: 幂等键唯一性 | `test_invariants_idempotency_key()` | ✅ 已验证 | P0 |
| I-7: 重启恢复完整性 | `test_invariants_restart_recovery()` | ✅ 已验证 | P0 |
| I-8: Replay 无副作用 | `test_invariants_replay_dry_run()` | ✅ 已验证 | P0 |
| I-9: Recovery 幂等 | `test_invariants_recovery_idempotency()` | ✅ 已验证 | P0 |
| I-10: 状态迁移合法 | `test_invariants_state_transition()` | ✅ 已实现 | P0 |
| I-11: 终端状态保护 | `test_invariants_terminal_state()` | ⚠️ 待实现 | P1 |
| I-12: 并发 Last-Write-Wins | `test_invariants_concurrent_lww()` | ✅ 已验证 | P0 |

---

## 二、写入顺序测试矩阵 (14 条)

### W-1: Incident 创建顺序

**测试用例**: `test_write_order_incident_create()`

**测试步骤**:
1. 创建 Incident
2. 检查 JSONL 文件
3. 验证写入顺序

**预期结果**:
1. Dedupe 检查
2. 内存对象创建
3. 获取锁
4. 追加 JSONL
5. 更新内存索引
6. 释放锁
7. Timeline 记录

**实现状态**: ✅ 已实现

**优先级**: P0

### W-2: Incident 更新顺序

**测试用例**: `test_write_order_incident_update()`

**测试步骤**:
1. 更新 Incident 状态
2. 检查 JSONL 文件
3. 验证写入顺序

**预期结果**:
1. 状态验证
2. 获取锁
3. 更新内存
4. 追加 JSONL
5. 更新索引
6. 释放锁
7. Timeline/Audit 记录

**实现状态**: ✅ 已实现

**优先级**: P0

### W-3 ~ W-14

| 规则 | 测试用例 | 状态 | 优先级 |
|------|---------|------|--------|
| W-3: Incident 快照 | `test_write_order_snapshot()` | ⚠️ 待实现 | P1 |
| W-4: Timeline 事件 | `test_write_order_timeline()` | ✅ 已实现 | P0 |
| W-5: Timeline vs Incident | `test_write_order_timeline_incident()` | ⚠️ 待实现 | P1 |
| W-6: Audit 事件 | `test_write_order_audit()` | ⚠️ 待实现 | P1 |
| W-7: Audit vs 业务 | `test_write_order_audit_business()` | ⚠️ 待实现 | P1 |
| W-8: 锁获取 | `test_write_order_lock_acquire()` | ✅ 已实现 | P0 |
| W-9: 锁释放 | `test_write_order_lock_release()` | ✅ 已实现 | P0 |
| W-10: 锁持有期间 | `test_write_order_lock_hold()` | ⚠️ 待实现 | P2 |
| W-11: 重启恢复 | `test_write_order_restart()` | ✅ 已验证 | P0 |
| W-12: 恢复后首次写入 | `test_write_order_post_restart()` | ⚠️ 待实现 | P2 |
| W-13: 并发写入冲突 | `test_write_order_concurrent()` | ✅ 已验证 | P0 |
| W-14: 跨对象并发 | `test_write_order_cross_object()` | ✅ 已实现 | P0 |

---

## 三、一致性测试矩阵 (9 条)

### C-1: Incident 创建一致性

**测试用例**: `test_consistency_incident_create()`

**测试步骤**:
1. 创建 Incident
2. 查询 Timeline
3. 验证 `incident_created` 事件存在

**预期结果**:
- Timeline 包含事件
- 时间戳一致 (容差 1000ms)

**实现状态**: ⚠️ 待实现

**优先级**: P0

### C-2: Incident 状态变更一致性

**测试用例**: `test_consistency_status_change()`

**测试步骤**:
1. 更新 Incident 状态
2. 查询 Timeline
3. 验证 `incident_updated` 事件存在

**预期结果**:
- Timeline 包含事件
- metadata.status_change 正确

**实现状态**: ⚠️ 待实现

**优先级**: P0

### C-3 ~ C-9

| 规则 | 测试用例 | 状态 | 优先级 |
|------|---------|------|--------|
| C-3: Timeline 顺序 | `test_consistency_timeline_order()` | ⚠️ 待实现 | P1 |
| C-4: Incident-Audit | `test_consistency_incident_audit()` | ⚠️ 待实现 | P0 |
| C-5: 状态变更 Audit | `test_consistency_status_audit()` | ⚠️ 待实现 | P0 |
| C-6: 事件类型映射 | `test_consistency_event_mapping()` | ⚠️ 待实现 | P1 |
| C-7: 时间戳一致性 | `test_consistency_timestamp()` | ⚠️ 待实现 | P2 |
| C-8: Correlation 串联 | `test_consistency_correlation_chain()` | ⚠️ 待实现 | P0 |
| C-9: Correlation 唯一性 | `test_consistency_correlation_unique()` | ⚠️ 待实现 | P2 |

---

## 四、恢复安全测试矩阵 (9 条)

### R-1: Replay Dry-run 安全

**测试用例**: `test_recovery_replay_dry_run()`

**测试步骤**:
1. 执行 Replay (dry_run=true)
2. 检查文件是否修改
3. 检查 Timeline/Audit 是否记录

**预期结果**:
- 文件未修改
- 无 Timeline/Audit 记录
- 返回结果正确

**实现状态**: ✅ 已实现

**优先级**: P0

### R-4: Recovery Scan 安全

**测试用例**: `test_recovery_scan()`

**测试步骤**:
1. 执行 Recovery Scan (dry_run=true)
2. 检查是否修改状态
3. 检查恢复计划

**预期结果**:
- 状态未修改
- 恢复计划正确

**实现状态**: ✅ 已实现

**优先级**: P0

### R-2 ~ R-9

| 规则 | 测试用例 | 状态 | 优先级 |
|------|---------|------|--------|
| R-2: Replay 时间旅行 | `test_recovery_replay_timetravel()` | ⚠️ 待实现 | P2 |
| R-3: Replay 审批 | `test_recovery_replay_approval()` | ⚠️ 待实现 | P1 |
| R-5: Recovery 幂等 | `test_recovery_idempotency()` | ✅ 已实现 | P0 |
| R-6: Recovery 副作用 | `test_recovery_side_effects()` | ⚠️ 待实现 | P1 |
| R-7: 重启只读 | `test_recovery_restart_readonly()` | ✅ 已实现 | P0 |
| R-8: 重启一致性 | `test_recovery_restart_consistency()` | ✅ 已验证 | P0 |
| R-9: 重启静默期 | `test_recovery_restart_silent()` | ⚠️ 待实现 | P2 |

---

## 五、锁与所有权测试矩阵 (8 条)

### L-1: 写路径加锁

**测试用例**: `test_lock_write_path()`

**测试步骤**:
1. 执行写入操作
2. 检查是否获取锁
3. 检查锁释放

**预期结果**:
- 写入前获取锁
- 写入后释放锁
- 无锁残留

**实现状态**: ✅ 已实现

**优先级**: P0

### L-2: 锁超时自动释放

**测试用例**: `test_lock_timeout()`

**测试步骤**:
1. 获取锁
2. 等待超时
3. 检查锁是否自动释放

**预期结果**:
- 超时后锁自动释放
- Audit 记录超时事件

**实现状态**: ✅ 已实现

**优先级**: P0

### L-3 ~ L-8

| 规则 | 测试用例 | 状态 | 优先级 |
|------|---------|------|--------|
| L-3: 陈旧锁清理 | `test_lock_stale_cleanup()` | ✅ 已实现 | P0 |
| L-4: Session 所有权 | `test_lock_session_ownership()` | ✅ 已实现 | P0 |
| L-5: Item 所有权 | `test_lock_item_ownership()` | ✅ 已实现 | P0 |
| L-6: 所有权超时 | `test_lock_ownership_timeout()` | ⚠️ 待实现 | P1 |
| L-7: 单实例并发 | `test_lock_single_instance()` | ✅ 已验证 | P0 |
| L-8: 多实例协调 | `test_lock_multi_instance()` | ❌ 未实现 | P2 |

---

## 六、测试覆盖汇总

### 按类别

| 类别 | 总规则数 | 已实现 | 待实现 | 覆盖率 |
|------|---------|--------|--------|--------|
| 不变性 (I) | 12 | 5 | 7 | 42% |
| 写入顺序 (W) | 14 | 7 | 7 | 50% |
| 一致性 (C) | 9 | 0 | 9 | 0% |
| 恢复安全 (R) | 9 | 4 | 5 | 44% |
| 锁与所有权 (L) | 8 | 5 | 3 | 62% |
| **总计** | **52** | **21** | **31** | **40%** |

### 按优先级

| 优先级 | 规则数 | 已实现 | 待实现 |
|--------|--------|--------|--------|
| P0 | 25 | 15 | 10 |
| P1 | 15 | 4 | 11 |
| P2 | 12 | 2 | 10 |

---

## 七、测试实现计划

### Wave 2-A 期间 (T+0h ~ T+48h)

- [ ] I-6: 幂等键唯一性 (已验证)
- [ ] I-7: 重启恢复完整性 (已验证)
- [ ] I-8: Replay 无副作用 (已验证)
- [ ] I-9: Recovery 幂等 (已验证)
- [ ] I-10: 状态迁移合法 (已实现)
- [ ] I-12: 并发 Last-Write-Wins (已验证)
- [ ] R-8: 重启一致性 (已验证)

### Wave 2-A 后 (P0)

- [ ] I-1: Incident/Timeline 一致性
- [ ] I-2: Correlation ID 可追踪性
- [ ] I-3: 时间戳单调性
- [ ] C-1: Incident 创建一致性
- [ ] C-2: 状态变更一致性
- [ ] C-4: Incident-Audit 一致性
- [ ] C-5: 状态变更 Audit
- [ ] C-8: Correlation 串联

### Phase 4.x (P1/P2)

- [ ] I-4: 写入顺序
- [ ] I-5: 锁持有边界
- [ ] I-11: 终端状态保护
- [ ] C-3: Timeline 顺序
- [ ] C-6: 事件类型映射
- [ ] C-7: 时间戳一致性
- [ ] C-9: Correlation 唯一性
- [ ] L-6: 所有权超时
- [ ] L-8: 多实例协调

---

## 八、测试框架要求

### 8.1 测试工具

| 工具 | 用途 | 状态 |
|------|------|------|
| Jest / Vitest | 单元测试 | ⚠️ 待配置 |
| Supertest | HTTP 测试 | ⚠️ 待配置 |
| tmp | 临时文件 | ✅ 可用 |
| fs-extra | 文件操作 | ✅ 可用 |

### 8.2 测试数据

| 类型 | 来源 | 状态 |
|------|------|------|
| Incident 样本 | Wave 2-A 运行数据 | ✅ 可用 |
| Timeline 样本 | Wave 2-A 运行数据 | ✅ 可用 |
| Audit 样本 | 待生成 | ⚠️ 待实现 |

### 8.3 CI/CD 集成

| 阶段 | 测试类型 | 触发条件 |
|------|---------|---------|
| Pre-commit | 单元测试 | 每次提交 |
| Pre-merge | 集成测试 | 每次 PR |
| Post-deploy | 端到端测试 | 每次部署 |

---

_文档版本：1.0  
最后更新：2026-04-05 05:56 CST_
