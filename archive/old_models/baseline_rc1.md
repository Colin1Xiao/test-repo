# OpenClaw 试运行基线 RC1

**版本号：** openclaw-2026.3.11-rc1  
**冻结日期：** 2026-03-13  
**状态：** 试运行候选 (Production Candidate)

---

## 1. 模型别名映射

| 别名 | 完整路径 | 用途 |
|------|----------|------|
| MAIN | bailian/kimi-k2.5 | 总控、兜底、汇总 |
| FAST | bailian/qwen3-max-2026-01-23 | 简单问答 |
| LONG | bailian/qwen3.5-plus | 长文档总结 |
| CODE | bailian/qwen3-coder-next | 普通代码生成 |
| CODE-PLUS | bailian/qwen3-coder-plus | 大型代码重构 |
| GROK-CODE | xai/grok-code-fast-1 | 代码诊断、Debug |
| REASON | xai/grok-4-1-fast-reasoning | 复杂推理 |
| CN | bailian/MiniMax-M2.5 | 中文润色 |

---

## 2. Timeout 配置

| 模型 | 别名 | 超时 | 任务类型 |
|------|------|------|----------|
| bailian/qwen3-max-2026-01-23 | FAST | 30s | 简单问答 |
| bailian/qwen3-coder-next | CODE | 45s | 普通代码 |
| xai/grok-code-fast-1 | GROK-CODE | 60s | 代码诊断 |
| xai/grok-4-1-fast-reasoning | REASON | 60s | 复杂推理 |
| bailian/qwen3.5-plus | LONG | 90s | 长文档总结 |
| bailian/qwen3-coder-plus | CODE-PLUS | 120s | 大型重构 |
| bailian/MiniMax-M2.5 | CN | 90s | 中文润色 |
| bailian/kimi-k2.5 | MAIN | 90s | 总控汇总 |

---

## 3. 路由规则

### 单模型路由

| 任务类型 | 路由目标 |
|----------|----------|
| 简单问答 / 轻量任务 | FAST |
| 长文档 / 多文档 / 大上下文 | LONG |
| 普通代码生成 | CODE |
| 大型代码 / 重构 / 多文件 | CODE-PLUS |
| 代码报错 / Debug / 根因分析 | GROK-CODE |
| 复杂推理 / 方案比较 / 决策 | REASON |
| 中文润色 / 改写 | CN |
| 图片理解 / 兜底 | MAIN |

### 混合任务路由

| 任务组合 | 链路 | 总超时 |
|----------|------|--------|
| 调试+修复 | GROK-CODE → CODE → MAIN | 195s |
| 长文+推理 | LONG → REASON → MAIN | 240s |
| 推理+润色 | REASON → CN → MAIN | 240s |

---

## 4. MAIN 汇总限长策略

### 约束规则

- 只输出：结论 + 关键理由 + 风险 + 下一步
- 避免：重复展开前两步全部内容、过长的背景描述
- 优先：结构化输出（表格/列表）、关键数据/指标
- 长度控制：
  - 简单任务：200-500字
  - 复杂任务：500-800字
  - 除非用户要求详细说明，否则不超过1000字

---

## 5. Telegram 安全策略

| 配置项 | 值 |
|--------|-----|
| dmPolicy | allowlist |
| allowFrom | ["5885419859"] |
| groupPolicy | allowlist |
| sandbox.mode | all |

---

## 6. 已验证通过项

### 单模型路由 (7/7)

- [x] A1: FAST 简单问答
- [x] A3: LONG 长文总结
- [x] A5: CODE 普通代码
- [x] A7: CODE-PLUS 大型重构
- [x] A8: GROK-CODE 代码诊断
- [x] A10: REASON 复杂推理
- [x] A11: CN 中文润色

### 混合任务路由 (3/3)

- [x] B1: 调试+修复 (GROK-CODE → CODE → MAIN)
- [x] B2: 长文+推理 (LONG → REASON → MAIN)
- [x] B3: 推理+润色 (REASON → CN → MAIN)

### 并发压测 (5/5)

- [x] 5个并发任务无串线
- [x] 无新的超时热点
- [x] 配置一致性良好

---

## 7. 已知风险

| 风险 | 级别 | 说明 |
|------|------|------|
| GROK-CODE 偶发抖动 | 中 | 并发环境下可能接近超时，已调整至60s |
| 长任务内存占用 | 低 | LONG/CODE-PLUS 处理超长文本时需注意 |
| 混合任务 Step 3 汇总 | 低 | 已配置限长策略，需持续观察 |

---

## 8. 基线文件清单

| 文件 | 说明 |
|------|------|
| `multi_model_config.py` | 超时配置策略 |
| `multi_model_router.py` | 路由协调器 |
| `hybrid_task_runner.py` | 混合任务执行器 |
| `test_hybrid_fixed.py` | 修复验证测试 |
| `acceptance_test_final_report.md` | 验收报告 |
| `baseline_rc1.md` | 本基线文档 |

---

**基线冻结完成时间：** 2026-03-13 06:45 GMT+8  
**下一阶段：** 补齐可观测性