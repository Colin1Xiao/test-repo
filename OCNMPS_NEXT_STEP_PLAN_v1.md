# OCNMPS Next Step Plan v1

**文档状态:** 执行中  
**创建时间:** 2026-04-02 06:15 (Asia/Shanghai)  
**当前阶段:** Bridge v2 灰度验证 → 运行基线固化  
**灰度比例:** 5%

---

## 一、阶段判断

### 当前结论

**Bridge v2 已通过第一轮运行有效性验证，进入运行基线固化阶段。**

### 验证依据

| 指标 | 数据 | 判断 |
|------|------|------|
| 累计路由次数 | 371 次 | ✅ 非偶发命中 |
| 灰度命中率 | ~5% | ✅ 与配置一致 |
| 意图分布集中度 | MAIN 55.3% + CODE 27.2% + REASON 13.2% = 95.7% | ✅ 主流量稳定 |
| 模型映射正确性 | CODE→qwen3-coder-next, REASON→grok-4-1-fast | ✅ 符合预期 |
| Provider 错误 | 无异常峰值 | ✅ 运行正常 |

---

## 二、历史运行数据分析

### 2.1 意图分布（总路由 371 次）

| 意图 | 次数 | 占比 | 优先级 |
|------|------|------|--------|
| MAIN | 205 | 55.3% | P0 |
| CODE | 101 | 27.2% | P1 |
| REASON | 49 | 13.2% | P2 |
| LONG | 15 | 4.0% | P3 |
| CN | 1 | 0.3% | P4 |

### 2.2 模型使用分布

| 模型 | 次数 | 占比 | 对应意图 |
|------|------|------|---------|
| bailian/kimi-k2.5 | 171 | 46.1% | MAIN |
| bailian/qwen3-coder-next | 72 | 19.4% | CODE |
| xai/grok-4-1-fast-reasoning | 49 | 13.2% | REASON |
| volcengine-plan/kimi-k2.5 | 35 | 9.4% | MAIN(fallback) |
| volcengine-plan/ark-code-latest | 28 | 7.5% | CODE(fallback) |
| bailian/qwen3.5-plus | 14 | 3.8% | LONG |
| bailian/MiniMax-M2.5 | 1 | 0.3% | CN |

### 2.3 关键信号

#### ✅ 正面信号
1. **主流量结构稳定** - MAIN/CODE/REASON 占 95.7%
2. **专业路由成型** - CODE 和 REASON 已有清晰主模型
3. **无异常错误** - 无 fallback/provider error 峰值

#### ⚠️ 待优化点
1. **MAIN 过重** - 55.3% 流量单一意图，需拆分
2. **CN 样本不足** - 仅 1 次，无法验证中文路由
3. **FAST 未生效** - 配置存在但未形成有效分布
4. **统计窗口混用** - 历史全量与当前灰度窗口混在一起

---

## 三、执行优先级

### P0：建立统一统计窗口

**目标：** 固定统计口径，确保数据可比

**动作：**
- 短窗口：最近 500 条路由日志 → 看当前配置是否生效
- 长窗口：最近 24 小时 → 看趋势是否稳定

**产物：**
- `scripts/ocnmps_analyze_recent_500.sh`
- `scripts/ocnmps_analyze_last_24h.sh`

**验收标准：**
- 两套脚本可独立运行
- 输出格式统一（意图分布/模型分布/错误统计）

---

### P1：拆分 MAIN 意图

**目标：** 将 MAIN 流量细分为 GENERAL / FAST / LONG 三档

**背景：** MAIN 占 55.3%，过重，导致：
- 成本优化无法进行
- 快速任务吞吐无法提升
- FAST 意图形同虚设

**拆分方案：**

| 子意图 | 适用场景 | 目标模型 | 预期占比 |
|--------|---------|---------|---------|
| MAIN-GENERAL | 普通对话、一般说明、常规规划、中等复杂问题 | qwen3.5-plus · bailian | 60% |
| MAIN-FAST | 简单问答、短指令、单步小任务、轻量检索 | glm-4.7 · bailian | 25% |
| MAIN-LONG | 长输入、长总结、长归纳、长上下文处理 | kimi-k2.5 · bailian | 15% |

**动作：**
1. 修改 `ocnmps_bridge_v2.py` INTENT_KEYWORDS
2. 添加 MAIN-FAST 判定规则（关键词 + 长度阈值）
3. 添加 MAIN-LONG 判定规则（输入长度 > N tokens）
4. 更新 `ocnmps_plugin_config.json` 路由映射

**验收标准：**
- 最近 500 条中 FAST 占比 > 15%
- 最近 500 条中 LONG 占比 > 10%

---

### P2：建立意图质量验证集

**目标：** 从"看日志"升级到"看样例"，量化意图正确率

**动作：**
建立固定任务样例集（共 60 条）：

| 意图 | 样例数 | 状态 |
|------|--------|------|
| MAIN | 20 | 待整理 |
| CODE | 20 | 待整理 |
| REASON | 20 | 待整理 |
| LONG | 10 | 待整理 |
| CN | 10 | 待整理 |

**每条记录字段：**
```json
{
  "id": "main_001",
  "input": "写一个 Python 函数计算斐波那契数列",
  "detected_intent": "CODE",
  "selected_model": "bailian/qwen3-coder-next",
  "expected_intent": "CODE",
  "expected_model": "bailian/qwen3-coder-next",
  "accepted": true,
  "notes": ""
}
```

**产物：**
- `ocnmps_golden_cases.json`

**验收标准：**
- 60 条样例全部整理完成
- 每条标注预期意图和模型

---

### P3：补日志字段

**目标：** 增强日志可诊断性，支持深度分析

**新增字段：**

1. **intent_scores** - 意图检测分数
```json
"intent_scores": {
  "CODE": 5,
  "REASON": 2,
  "LONG": 0,
  "CN": 1,
  "MAIN": 3
}
```

2. **gray_roll** - 灰度随机值
```json
"gray_roll": {
  "grayRatio": 0.05,
  "gray_roll": 0.0312,
  "gray_hit": true
}
```

3. **fallback_reason** - 回退原因
```json
"fallback_reason": {
  "reason": "provider_timeout",
  "from_model": "xai/grok-4-1-fast-reasoning",
  "to_model": "bailian/qwen3-max-2026-01-23"
}
```

**动作：**
- 修改 `ocnmps_bridge_v2.py` 日志输出逻辑
- 修改 `plugin.js` 日志记录逻辑

**验收标准：**
- 新日志字段在下次路由中可见
- 可解释"为什么判成某个意图"

---

### P4：建立运行基线文档

**目标：** 形成第一版运行基线，作为后续优化对照物

**产物：**
- `ocnmps_runtime_baseline_v1.md`

**内容结构：**
1. 当前启用意图列表
2. 当前灰度比例
3. 当前主模型映射表
4. 最近一轮统计结果（500 条/24h）
5. 已知问题清单
6. 下一轮优化目标

**验收标准：**
- 文档可独立阅读
- 数据可追溯

---

### P5：新架构落盘准备

**目标：** 开始从 Bridge v2 过渡到 OCNMPS 新架构

**落盘顺序：**

**第一批（执行侧 + 指标侧）：**
1. `real_model_executor.py` - 真实模型执行器
2. `executor_factory.py` - 执行器工厂
3. `metrics_collector.py` - 指标收集器
4. `bootstrap_demo.py` - 引导演示

**第二批（验证侧）：**
1. `golden_runner.py` - 金样运行器
2. `golden_cases.json` - 金样用例
3. `smoke_runner.py` - 冒烟测试

**第三批（判定层 + 编排层）：**
1. `task_classifier.py` - 任务分类器
2. `risk_evaluator.py` - 风险评估器
3. `routing_policy.py` - 路由策略
4. `review_gate.py` - 审查门控
5. `execution_orchestrator.py` - 执行编排器

**验收标准：**
- 第一批文件可独立运行
- 不破坏当前 Bridge v2 功能

---

## 四、7 天执行计划

| 日期 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **Day 1** (04-02) | 固定统计窗口 | 两套分析脚本 | ⏳ |
| **Day 2** (04-03) | 输出首份统计报告 | 500 条/24h 报告 | ⏳ |
| **Day 3** (04-04) | 补日志字段 | intent_scores/gray_roll/fallback_reason | ⏳ |
| **Day 4** (04-05) | 整理验证样例 | golden_cases.json (60 条) | ⏳ |
| **Day 5** (04-06) | 拆分 MAIN 意图 | MAIN-GENERAL/FAST/LONG | ⏳ |
| **Day 6** (04-07) | 输出基线文档 | ocnmps_runtime_baseline_v1.md | ⏳ |
| **Day 7** (04-08) | 灰度评估决策 | 是否从 5% → 15% | ⏳ |

---

## 五、灰度放大条件

### 当前判断

**暂不建议从 5% 升到 15%**

### 原因

| 问题 | 风险 |
|------|------|
| CN 样本不足 | 无法验证中文路由有效性 |
| FAST 未形成分布 | 快速任务路由未验证 |
| MAIN 内部分流不清 | 拆分前放大风险高 |
| 统计窗口未统一 | 数据不可比 |

### 放大条件

满足以下 4 条后再考虑升到 15%：

1. ✅ 最近 500 条内灰度命中接近 5%
2. ✅ MAIN/CODE/REASON 分布稳定（波动 < 10%）
3. ✅ 无明显 provider 错误峰值（错误率 < 1%）
4. ✅ FAST 开始出现可解释样本（占比 > 15%）

---

## 六、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| MAIN 拆分后 FAST 判定不准 | 中 | 中 | 保留回滚配置，随时切回 |
| CN 样本长期不足 | 低 | 低 | 人工构造测试用例 |
| xAI Provider 不稳定 | 中 | 高 | 配置 fallback 到 bailian |
| 日志字段增加影响性能 | 低 | 低 | 异步写入，控制日志量 |

---

## 七、核心原则

1. **数据驱动** - 所有优化基于统计，不凭感觉
2. **小步快跑** - 每次只改一个变量，可回滚
3. **基线对照** - 每次改动后与基线对比
4. **灰度优先** - 先灰度验证，再全量发布

---

## 八、下一步行动

**立即执行（P0）：**
1. 创建 `scripts/ocnmps_analyze_recent_500.sh`
2. 创建 `scripts/ocnmps_analyze_last_24h.sh`
3. 运行首份统计报告

**今日完成：**
- [ ] 统计脚本可用
- [ ] 输出 Day 1 报告
- [ ] 更新本文档状态

---

**文档维护：** 每次阶段完成后更新状态和日期

**最后更新:** 2026-04-02 06:15
