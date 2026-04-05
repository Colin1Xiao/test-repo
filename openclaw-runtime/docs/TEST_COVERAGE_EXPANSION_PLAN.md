# Test Coverage Expansion Plan

**阶段**: Phase Y-2: Test Coverage Expansion  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、当前覆盖现状

### 1.1 总体覆盖

| 类别 | 总规则数 | 已实现 | 待实现 | 覆盖率 |
|------|---------|--------|--------|--------|
| 不变性 (I) | 12 | 5 | 7 | 42% |
| 写入顺序 (W) | 14 | 7 | 7 | 50% |
| 一致性 (C) | 9 | 0 | 9 | 0% |
| 恢复安全 (R) | 9 | 4 | 5 | 44% |
| 锁与所有权 (L) | 8 | 5 | 3 | 62% |
| **总计** | **52** | **21** | **31** | **40%** |

### 1.2 缺口分类

**P0 缺口 (10 条)**:
- I-1: Incident/Timeline 一致性
- I-2: Correlation ID 可追踪性
- I-3: 时间戳单调性
- C-1: Incident 创建一致性
- C-2: 状态变更一致性
- C-4: Incident-Audit 一致性
- C-5: 状态变更 Audit
- C-8: Correlation 串联
- W-5: Timeline vs Incident 顺序
- W-7: Audit vs 业务动作顺序

**P1 缺口 (11 条)**:
- I-4: 写入顺序
- I-5: 锁持有边界
- I-11: 终端状态保护
- C-3: Timeline 顺序一致性
- C-6: 事件类型映射
- C-7: 时间戳一致性
- C-9: Correlation 唯一性
- W-3: Incident 快照顺序
- W-6: Audit 事件顺序
- L-6: 所有权超时
- R-6: Recovery 副作用抑制

**P2 缺口 (10 条)**:
- W-10: 锁持有期间顺序
- W-12: 恢复后首次写入顺序
- R-2: Replay 时间旅行
- R-3: Replay 审批
- R-9: 重启静默期
- L-8: 多实例协调
- 其他低优先级规则

---

## 二、覆盖率提升路线

### 2.1 目标设定

| 阶段 | 目标覆盖率 | 时间窗口 |
|------|----------|---------|
| 当前 | 40% | - |
| Wave 2-A 后 | 60% | T+48h ~ T+7d |
| Phase 4.x 前 | 80% | T+7d ~ T+30d |
| 长期 | 95% | T+30d+ |

### 2.2 执行批次

**Batch 1 (Wave 2-A 后，P0)**:
- 一致性测试包 (C-1~C-9)
- 不变性测试包 (I-1~I-3)
- 写入顺序测试包 (W-5, W-7)

**Batch 2 (Phase 4.x 前，P1)**:
- 不变性测试包 (I-4, I-5, I-11)
- 写入顺序测试包 (W-3, W-6)
- 恢复安全测试包 (R-6)
- 锁与所有权测试包 (L-6)

**Batch 3 (长期，P2)**:
- 剩余低优先级规则
- 多实例协调测试 (L-8)

---

## 三、高优先级测试包定义

### 3.1 一致性测试包 (9 条)

**测试目标**: Incident/Timeline/Audit 三者一致性

**测试列表**:
| 规则 | 测试用例 | 类型 | 优先级 |
|------|---------|------|--------|
| C-1 | test_consistency_incident_create() | Integration | P0 |
| C-2 | test_consistency_status_change() | Integration | P0 |
| C-3 | test_consistency_timeline_order() | Integration | P1 |
| C-4 | test_consistency_incident_audit() | Integration | P0 |
| C-5 | test_consistency_status_audit() | Integration | P0 |
| C-6 | test_consistency_event_mapping() | Integration | P1 |
| C-7 | test_consistency_timestamp() | Integration | P2 |
| C-8 | test_consistency_correlation_chain() | Integration | P0 |
| C-9 | test_consistency_correlation_unique() | Integration | P2 |

**预计工作量**: 5 人日

### 3.2 写入顺序测试包 (14 条)

**测试目标**: 写入顺序规则验证

**测试列表**:
| 规则 | 测试用例 | 类型 | 优先级 |
|------|---------|------|--------|
| W-1 | test_write_order_incident_create() | Unit | ✅ 已实现 |
| W-2 | test_write_order_incident_update() | Unit | ✅ 已实现 |
| W-3 | test_write_order_snapshot() | Integration | P1 |
| W-4 | test_write_order_timeline() | Unit | ✅ 已实现 |
| W-5 | test_write_order_timeline_incident() | Integration | P0 |
| W-6 | test_write_order_audit() | Unit | P1 |
| W-7 | test_write_order_audit_business() | Integration | P0 |
| W-8 | test_write_order_lock_acquire() | Unit | ✅ 已实现 |
| W-9 | test_write_order_lock_release() | Unit | ✅ 已实现 |
| W-10 | test_write_order_lock_hold() | Integration | P2 |
| W-11 | test_write_order_restart() | Restart | ✅ 已验证 |
| W-12 | test_write_order_post_restart() | Restart | P2 |
| W-13 | test_write_order_concurrent() | Concurrency | ✅ 已验证 |
| W-14 | test_write_order_cross_object() | Concurrency | ✅ 已实现 |

**预计工作量**: 3 人日

### 3.3 恢复安全测试包 (9 条)

**测试目标**: Replay/Recovery/Restart 安全

**测试列表**:
| 规则 | 测试用例 | 类型 | 优先级 |
|------|---------|------|--------|
| R-1 | test_recovery_replay_dry_run() | Unit | ✅ 已实现 |
| R-2 | test_recovery_replay_timetravel() | Integration | P2 |
| R-3 | test_recovery_replay_approval() | Integration | P1 |
| R-4 | test_recovery_scan() | Unit | ✅ 已实现 |
| R-5 | test_recovery_idempotency() | Integration | ✅ 已实现 |
| R-6 | test_recovery_side_effects() | Integration | P1 |
| R-7 | test_recovery_restart_readonly() | Restart | ✅ 已实现 |
| R-8 | test_recovery_restart_consistency() | Restart | ✅ 已验证 |
| R-9 | test_recovery_restart_silent() | Restart | P2 |

**预计工作量**: 3 人日

### 3.4 锁与所有权测试包 (8 条)

**测试目标**: 文件锁与所有权保护

**测试列表**:
| 规则 | 测试用例 | 类型 | 优先级 |
|------|---------|------|--------|
| L-1 | test_lock_write_path() | Unit | ✅ 已实现 |
| L-2 | test_lock_timeout() | Unit | ✅ 已实现 |
| L-3 | test_lock_stale_cleanup() | Unit | ✅ 已实现 |
| L-4 | test_lock_session_ownership() | Integration | ✅ 已实现 |
| L-5 | test_lock_item_ownership() | Integration | ✅ 已实现 |
| L-6 | test_lock_ownership_timeout() | Integration | P1 |
| L-7 | test_lock_single_instance() | Concurrency | ✅ 已验证 |
| L-8 | test_lock_multi_instance() | Concurrency | P2 (待实现) |

**预计工作量**: 2 人日

### 3.5 不变性测试包 (12 条)

**测试目标**: 系统不变性验证

**测试列表**:
| 规则 | 测试用例 | 类型 | 优先级 |
|------|---------|------|--------|
| I-1 | test_invariants_incident_timeline_consistency() | Integration | P0 |
| I-2 | test_invariants_correlation_chain() | Integration | P0 |
| I-3 | test_invariants_timestamp_monotonicity() | Integration | P0 |
| I-4 | test_invariants_write_order() | Integration | P1 |
| I-5 | test_invariants_lock_hold_time() | Integration | P1 |
| I-6 | test_invariants_idempotency_key() | Integration | ✅ 已验证 |
| I-7 | test_invariants_restart_recovery() | Restart | ✅ 已验证 |
| I-8 | test_invariants_replay_dry_run() | Unit | ✅ 已验证 |
| I-9 | test_invariants_recovery_idempotency() | Integration | ✅ 已验证 |
| I-10 | test_invariants_state_transition() | Unit | ✅ 已实现 |
| I-11 | test_invariants_terminal_state() | Unit | P1 |
| I-12 | test_invariants_concurrent_lww() | Concurrency | ✅ 已验证 |

**预计工作量**: 4 人日

---

## 四、测试实现优先级

### 4.1 P0 (Wave 2-A 后，立即实现)

**测试数量**: 10 条

**预计工作量**: 5 人日

**测试列表**:
- C-1, C-2, C-4, C-5, C-8 (一致性)
- I-1, I-2, I-3 (不变性)
- W-5, W-7 (写入顺序)

**阻塞发布**: 是

### 4.2 P1 (Phase 4.x 前)

**测试数量**: 11 条

**预计工作量**: 6 人日

**测试列表**:
- I-4, I-5, I-11 (不变性)
- C-3, C-6, C-7, C-9 (一致性)
- W-3, W-6 (写入顺序)
- L-6, R-6 (锁与恢复)

**阻塞发布**: 是 (Phase 4.x)

### 4.3 P2 (长期)

**测试数量**: 10 条

**预计工作量**: 5 人日

**测试列表**:
- W-10, W-12 (写入顺序)
- R-2, R-3, R-9 (恢复安全)
- L-8 (多实例)
- 其他低优先级规则

**阻塞发布**: 否

---

## 五、测试框架要求

### 5.1 测试工具

| 工具 | 用途 | 状态 | 预计配置时间 |
|------|------|------|------------|
| Jest / Vitest | 单元测试 | ⚠️ 待配置 | 0.5 人日 |
| Supertest | HTTP 测试 | ⚠️ 待配置 | 0.5 人日 |
| tmp | 临时文件 | ✅ 可用 | - |
| fs-extra | 文件操作 | ✅ 可用 | - |

### 5.2 测试环境

| 环境 | 用途 | 状态 |
|------|------|------|
| Unit Test | 单元测试 | ⚠️ 待配置 |
| Integration Test | 集成测试 | ⚠️ 待配置 |
| Restart Test | 重启测试 | ⚠️ 待配置 |
| Concurrency Test | 并发测试 | ⚠️ 待配置 |

### 5.3 CI/CD 集成

| 阶段 | 测试类型 | 触发条件 | 状态 |
|------|---------|---------|------|
| Pre-commit | 单元测试 | 每次提交 | ⚠️ 待配置 |
| Pre-merge | 集成测试 | 每次 PR | ⚠️ 待配置 |
| Post-deploy | 端到端测试 | 每次部署 | ⚠️ 待配置 |

---

## 六、执行时间表

### 6.1 Wave 2-A 期间 (T+0h ~ T+48h)

**任务**:
- [ ] 测试框架配置 (Jest/Vitest)
- [ ] 测试环境准备
- [ ] CI/CD 集成配置

**交付**:
- 测试框架就绪
- CI/CD 流水线配置完成

### 6.2 Wave 2-A 后 (T+48h ~ T+7d)

**任务**:
- [ ] P0 测试实现 (10 条)
- [ ] P0 测试验证
- [ ] 覆盖率提升至 60%

**交付**:
- P0 测试套件
- 测试报告
- 覆盖率报告

### 6.3 Phase 4.x 前 (T+7d ~ T+30d)

**任务**:
- [ ] P1 测试实现 (11 条)
- [ ] P1 测试验证
- [ ] 覆盖率提升至 80%

**交付**:
- P1 测试套件
- 测试报告
- 覆盖率报告

### 6.4 长期 (T+30d+)

**任务**:
- [ ] P2 测试实现 (10 条)
- [ ] 覆盖率提升至 95%

**交付**:
- 完整测试套件
- 测试报告
- 覆盖率报告

---

## 七、风险与缓解

### 7.1 风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 测试框架配置复杂 | 延迟 | 中 | 使用成熟框架 (Jest) |
| 测试实现工作量大 | 延迟 | 高 | 分批次实现 (P0/P1/P2) |
| 测试维护成本高 | 长期 | 中 | 自动化测试生成 |
| CI/CD 集成复杂 | 延迟 | 中 | 渐进式集成 |

### 7.2 缓解措施

**短期**:
- 优先配置 Jest/Vitest
- 优先实现 P0 测试
- 渐进式 CI/CD 集成

**长期**:
- 测试代码复用
- 测试数据工厂
- 自动化测试生成

---

## 八、成功标准

### 8.1 覆盖率目标

| 阶段 | 目标覆盖率 | 验证方式 |
|------|----------|---------|
| Wave 2-A 后 | 60% | 测试报告 |
| Phase 4.x 前 | 80% | 测试报告 |
| 长期 | 95% | 测试报告 |

### 8.2 质量目标

| 指标 | 目标 | 验证方式 |
|------|------|---------|
| 测试通过率 | 100% | CI/CD 报告 |
| 测试执行时间 | <10 分钟 | CI/CD 报告 |
| 测试稳定性 | >99% | CI/CD 报告 |
| 测试覆盖率 | 80%+ | 覆盖率报告 |

---

_文档版本：1.0  
最后更新：2026-04-05 05:59 CST_
