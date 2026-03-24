# OpenClaw 第二阶段 7 天执行计划

**目标：** 从"正式可用"到"稳定、可运维、可降级"  
**开始时间：** 2026-03-13  
**周期：** 7 天

---

## Day 1-2：自动告警体系（P0）

### Day 1：告警规则设计

**上午：**
- [ ] 定义告警阈值表
  - 成功率 < 95%
  - timeout 率 > 10%
  - empty_response 连续 3 次
  - fallback 率 > 20%
  - MAIN 汇总 > 60s
  - 混合链路连续失败 2 次
  - GROK-CODE P95 > 40s

**下午：**
- [ ] 实现告警检测器
- [ ] 分级：warning / critical
- [ ] 测试告警触发

### Day 2：告警通知集成

**上午：**
- [ ] Telegram 告警通知
- [ ] 日志标记 ERROR
- [ ] 告警去重（5 分钟内同一问题不重复告警）

**下午：**
- [ ] 告警测试验证
- [ ] 产出：alerting_system.py

**产出物：**
- `alerting_system.py`
- `alert_rules.md`

---

## Day 3：回退策略正式化（P0）

### 上午：Fallback 规则设计

- [ ] GROK-CODE 失败 → CODE + MAIN
- [ ] REASON 失败 → MAIN 基于 LONG 摘要
- [ ] CN 失败 → 返回未润色版本
- [ ] MAIN 失败 → 返回子步骤摘要
- [ ] provider_error → 重试后 fallback
- [ ] timeout → 直接 fallback

### 下午：Fallback 实现

- [ ] 降级决策器
- [ ] 降级结果生成器
- [ ] 用户侧降级返回模板

**产出物：**
- `fallback_matrix.md`
- `fallback_handler.py`

---

## Day 4：结果质量抽样（P0）

### 上午：抽样机制

- [ ] 每类任务每日抽样 5 条
- [ ] 自动标记样本
- [ ] 存储到 quality_samples/

### 下午：质量评估

- [ ] 评估维度定义
  - FAST：是否过度简略
  - LONG：结构是否稳定
  - GROK-CODE：根因是否准确
  - REASON：推理是否漂移
  - CN：是否过润色
  - MAIN：是否压缩过头
- [ ] 质量评分：好 / 可接受 / 需改进

**产出物：**
- `quality_sampler.py`
- `quality_review.md`
- `quality_samples/` 目录

---

## Day 5：GROK-CODE 专项观察（P0）

### 上午：观测体系

- [ ] 每日稳定性报告生成
- [ ] 异常样本自动归档
- [ ] P95/P99 趋势记录

### 下午：决策阈值

- [ ] P95 > 40s 连续 3 天 → 调 timeout
- [ ] 空输出率 > 5% 连续 3 天 → 检查 provider
- [ ] 产出：grok_code_watchlist.md

**产出物：**
- `grok_code_monitor.py`
- `grok_code_watchlist.md`
- `weekly_stability_report.md`

---

## Day 6：任务白名单/黑名单 + 重试细化（P1）

### 上午：路由策略优化

- [ ] 短任务 (< 50字) → 强制单模型
- [ ] 长任务 (> 5000字) → 先摘要再编排
- [ ] 高不确定任务 → MAIN 兜底
- [ ] 产出：routing_policy_v2.md

### 下午：重试策略细化

| 错误类型 | 重试 | 次数 | 退避 |
|----------|------|------|------|
| empty_response | ✅ | 1 | 立即 |
| provider_slow | ✅ | 2 | 2s |
| provider_error | ✅ | 2 | 5s |
| timeout | ❌ | 0 | - |

- [ ] 实现错误分类器
- [ ] 实现重试计数器
- [ ] 实现退避延时器

**产出物：**
- `routing_policy_v2.md`
- `retry_handler.py`

---

## Day 7：整合测试 + 文档（P1-P2）

### 上午：整合测试

- [ ] 告警 + fallback + 质量抽样联调
- [ ] 模拟故障验证保护机制
- [ ] 模拟告警验证通知

### 下午：运行手册

- [ ] 系统结构简图
- [ ] 常见故障排查步骤
- [ ] 回滚条件与操作
- [ ] 发布新基线流程

**产出物：**
- `runbook.md`
- 整合测试报告

---

## 7 天产出汇总

| 天数 | 核心产出 |
|------|----------|
| Day 1-2 | 自动告警体系 |
| Day 3 | 回退策略正式化 |
| Day 4 | 结果质量抽样 |
| Day 5 | GROK-CODE 专项观察 |
| Day 6 | 路由优化 + 重试细化 |
| Day 7 | 整合测试 + 运行手册 |

---

## 验收标准

- [ ] 告警能正常触发和通知
- [ ] fallback 能正确降级
- [ ] 每日能生成质量抽样报告
- [ ] GROK-CODE 有持续观察数据
- [ ] 运行手册能指导新人排查问题

---

**计划版本：** v1.0  
**制定时间：** 2026-03-13  
**执行人：** MAIN (bailian/kimi-k2.5)