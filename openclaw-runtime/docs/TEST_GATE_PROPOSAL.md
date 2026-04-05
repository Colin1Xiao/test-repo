# Test Gate Proposal

**阶段**: Phase Y-2: Test Coverage Expansion  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、发布门槛总则

### 门槛 T-0: 测试覆盖四原则

```
TEST GATE FOUR PRINCIPLES

1. 规则覆盖 (Rule Coverage)
   每条规则必须有对应测试
   无测试规则 → 禁止发布

2. 类型匹配 (Type Matching)
   测试类型匹配规则类型
   一致性规则 → 集成测试
   不变性规则 → 集成/重启测试

3. 通过率要求 (Pass Rate)
   所有测试必须通过
   失败测试 → 禁止发布

4. 覆盖率门槛 (Coverage Threshold)
   覆盖率必须达到门槛
   低于门槛 → 禁止发布
```

---

## 二、规则到测试类型映射

### 2.1 一致性规则

| 规则 | 测试类型 | 阻塞发布 |
|------|---------|---------|
| C-1: Incident 创建一致 | Integration | 是 |
| C-2: 状态变更一致 | Integration | 是 |
| C-3: Timeline 顺序一致 | Integration | 是 |
| C-4: Incident-Audit 一致 | Integration | 是 |
| C-5: 状态变更 Audit | Integration | 是 |
| C-6: 事件类型映射 | Integration | 是 |
| C-7: 时间戳一致性 | Integration | 否 |
| C-8: Correlation 串联 | Integration | 是 |
| C-9: Correlation 唯一性 | Integration | 否 |

**发布要求**: C-1~C-6, C-8 必须通过

### 2.2 不变性规则

| 规则 | 测试类型 | 阻塞发布 |
|------|---------|---------|
| I-1: Incident/Timeline 一致 | Integration | 是 |
| I-2: Correlation ID 可追踪 | Integration | 是 |
| I-3: 时间戳单调性 | Integration | 是 |
| I-4: 写入顺序 | Integration | 是 |
| I-5: 锁持有边界 | Integration | 否 |
| I-6: 幂等键唯一性 | Integration | 是 |
| I-7: 重启恢复完整 | Restart | 是 |
| I-8: Replay 无副作用 | Unit | 是 |
| I-9: Recovery 幂等 | Integration | 是 |
| I-10: 状态迁移合法 | Unit | 是 |
| I-11: 终端状态保护 | Unit | 是 |
| I-12: 并发 Last-Write-Wins | Concurrency | 是 |

**发布要求**: I-1~I-4, I-6~I-10, I-12 必须通过

### 2.3 写入顺序规则

| 规则 | 测试类型 | 阻塞发布 |
|------|---------|---------|
| W-1: Incident 创建顺序 | Unit | 是 |
| W-2: Incident 更新顺序 | Unit | 是 |
| W-3: Incident 快照顺序 | Integration | 否 |
| W-4: Timeline 事件顺序 | Unit | 是 |
| W-5: Timeline vs Incident 顺序 | Integration | 是 |
| W-6: Audit 事件顺序 | Unit | 否 |
| W-7: Audit vs 业务动作顺序 | Integration | 是 |
| W-8: 锁获取顺序 | Unit | 是 |
| W-9: 锁释放顺序 | Unit | 是 |
| W-10: 锁持有期间顺序 | Integration | 否 |
| W-11: 重启恢复顺序 | Restart | 是 |
| W-12: 恢复后首次写入顺序 | Restart | 否 |
| W-13: 并发写入冲突 | Concurrency | 是 |
| W-14: 跨对象并发写入 | Concurrency | 是 |

**发布要求**: W-1, W-2, W-4, W-5, W-7~W-9, W-11, W-13, W-14 必须通过

### 2.4 恢复安全规则

| 规则 | 测试类型 | 阻塞发布 |
|------|---------|---------|
| R-1: Replay Dry-run 安全 | Unit | 是 |
| R-2: Replay 时间旅行 | Integration | 否 |
| R-3: Replay 审批 | Integration | 否 |
| R-4: Recovery Scan 安全 | Unit | 是 |
| R-5: Recovery 幂等 | Integration | 是 |
| R-6: Recovery 副作用抑制 | Integration | 否 |
| R-7: 重启只读加载 | Restart | 是 |
| R-8: 重启一致性验证 | Restart | 是 |
| R-9: 重启后静默期 | Restart | 否 |

**发布要求**: R-1, R-4, R-5, R-7, R-8 必须通过

### 2.5 锁与所有权规则

| 规则 | 测试类型 | 阻塞发布 |
|------|---------|---------|
| L-1: 写路径加锁 | Unit | 是 |
| L-2: 锁超时自动释放 | Unit | 是 |
| L-3: 陈旧锁检测清理 | Unit | 是 |
| L-4: Session 所有权 | Integration | 是 |
| L-5: Item 所有权 | Integration | 是 |
| L-6: 所有权超时释放 | Integration | 否 |
| L-7: 单实例并发保护 | Concurrency | 是 |
| L-8: 多实例协调 | Concurrency | 否 (Phase 4.x) |

**发布要求**: L-1~L-5, L-7 必须通过

---

## 三、发布门槛定义

### 3.1 覆盖率门槛

| 阶段 | 目标覆盖率 | 阻塞发布 |
|------|----------|---------|
| Wave 2-A 后 | 60% | 是 |
| Phase 4.x 前 | 80% | 是 |
| 长期 | 95% | 否 (指导性) |

### 3.2 规则覆盖门槛

**P0 规则 (必须 100% 覆盖)**:
- C-1~C-6, C-8 (一致性)
- I-1~I-4, I-6~I-10, I-12 (不变性)
- W-1, W-2, W-4, W-5, W-7~W-9, W-11, W-13, W-14 (写入顺序)
- R-1, R-4, R-5, R-7, R-8 (恢复安全)
- L-1~L-5, L-7 (锁与所有权)

**P1 规则 (Phase 4.x 前必须覆盖)**:
- C-3, C-6, C-7, C-9 (一致性)
- I-5, I-11 (不变性)
- W-3, W-6, W-10, W-12 (写入顺序)
- R-2, R-3, R-6, R-9 (恢复安全)
- L-6, L-8 (锁与所有权)

**P2 规则 (长期覆盖)**:
- 剩余低优先级规则

### 3.3 测试通过率门槛

| 指标 | 门槛 | 阻塞发布 |
|------|------|---------|
| 单元测试通过率 | 100% | 是 |
| 集成测试通过率 | 100% | 是 |
| 重启测试通过率 | 100% | 是 |
| 并发测试通过率 | 100% | 是 |

---

## 四、发布流程联动

### 4.1 Pre-commit Gate

**触发条件**: 每次提交

**检查项**:
- [ ] 单元测试通过
- [ ] 代码格式化
- [ ] Lint 通过

**阻塞**: 是

### 4.2 Pre-merge Gate

**触发条件**: 每次 PR

**检查项**:
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 代码审查通过
- [ ] 文档更新

**阻塞**: 是

### 4.3 Pre-release Gate

**触发条件**: 每次发布

**检查项**:
- [ ] 所有测试通过
- [ ] 覆盖率达标 (60%/80%)
- [ ] P0 规则 100% 覆盖
- [ ] 发布说明完整
- [ ] 回滚方案就绪

**阻塞**: 是

### 4.4 Post-deploy Gate

**触发条件**: 每次部署后

**检查项**:
- [ ] 端到端测试通过
- [ ] 监控指标正常
- [ ] 用户反馈正常

**阻塞**: 否 (但触发告警)

---

## 五、CI/CD 集成方案

### 5.1 GitHub Actions 配置

```yaml
name: Test Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Check coverage
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

### 5.2 覆盖率报告

```bash
# Generate coverage report
npm run test:coverage

# Check threshold
node scripts/check-coverage-threshold.js --threshold 80
```

### 5.3 发布检查脚本

```bash
#!/bin/bash
# scripts/check-release-gate.sh

# Check test pass rate
echo "Checking test pass rate..."
npm run test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

# Check coverage
echo "Checking coverage..."
npm run test:coverage
COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "❌ Coverage below threshold: $COVERAGE%"
  exit 1
fi

# Check P0 rules
echo "Checking P0 rules..."
node scripts/check-p0-rules.js
if [ $? -ne 0 ]; then
  echo "❌ P0 rules not fully covered"
  exit 1
fi

echo "✅ All gates passed"
exit 0
```

---

## 六、违反处理

### 6.1 分级

| 级别 | 违反类型 | 响应时间 |
|------|---------|---------|
| P0 | 测试失败/覆盖率不达标 | 立即 |
| P1 | P0 规则未覆盖 | 1 小时 |
| P2 | P1/P2 规则未覆盖 | 4 小时 |

### 6.2 处理流程

```
检测到违反
    ↓
阻止发布
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
  修复   修复   计划
    ↓
重新运行测试
    ↓
通过后发布
```

---

## 七、例外处理

### 7.1 紧急发布

**场景**: 生产紧急修复

**流程**:
1. 负责人批准
2. 最小测试集通过
3. 发布后补全测试
4. 记录例外原因

**要求**:
- 必须负责人批准
- 必须最小测试集通过
- 必须 24h 内补全测试

### 7.2 实验功能

**场景**: 实验性功能发布

**流程**:
1. Feature Flag 控制
2. 测试覆盖可豁免
3. 明确实验范围
4. 监控指标定义

**要求**:
- 必须 Feature Flag 控制
- 必须明确实验范围
- 必须定义监控指标

---

## 八、持续改进

### 8.1 定期审查

**频率**: 每月

**审查项**:
- 测试覆盖率趋势
- 测试失败分析
- 新规则覆盖情况
- 测试维护成本

### 8.2 门槛调整

**频率**: 每季度

**调整项**:
- 覆盖率门槛 (60% → 80% → 95%)
- P0/P1/P2 规则分类
- 测试类型优化

### 8.3 自动化改进

**方向**:
- 测试自动生成
- 测试数据工厂
- 测试用例复用
- 测试报告自动化

---

_文档版本：1.0  
最后更新：2026-04-05 06:01 CST_
