# Auto-Heal vNext 升级验收报告

**日期**: 2026-03-17
**版本**: vNext (事件驱动架构)
**状态**: ✅ 验收通过

---

## 一、架构升级总结

### 升级前 (v1.0)
- 脚本直接调用脚本
- 规则硬编码在 shell 中
- 单一 Agent 决策
- 无事件记录

### 升级后 (vNext)
- 事件驱动协作
- 策略可配置 (YAML)
- 多代理裁决 (Judge)
- 完整事件链路可复盘

---

## 二、新增组件清单

| 组件 | 文件 | 作用 |
|------|------|------|
| 事件发射器 | `bin/emit_event.sh` | 统一事件产出 |
| 事件处理器 | `bin/process_event.sh` | 事件消费与分发 |
| 策略引擎 | `bin/run_policy.sh` | 策略加载与执行 |
| Judge Agent | `bin/judge_agent.sh` | 多代理裁决 |
| 事件复盘 | `bin/replay.sh` | 时间线重建 |
| 故障注入 | `bin/fault_injection.sh` | 链路验收测试 |
| Judge 统计 | `bin/judge_stats.sh` | 决策统计分析 |

---

## 三、事件字典 (v1.0.0)

### 支持的事件类型

| 事件类型 | Severity | 触发动作 |
|----------|----------|----------|
| health.check.started | info | - |
| health.check.completed | info/warning/critical | - |
| health.check.failed | critical | Judge, Snapshot |
| critical.detected | critical | Snapshot, Alert, Judge |
| warning.detected | warning | Alert |
| baseline.drift.detected | warning | Alert, Judge |
| repair.started | info | - |
| repair.applied | info | - |
| repair.failed | error | - |
| repair.blocked | warning | - |
| snapshot.created | info | - |
| alert.sent | info | - |
| agent.analysis.* | info | - |
| judge.decision.made | info | 决策执行 |

### 事件 Schema (v1.0.0)

```json
{
  "id": "evt_YYYYMMDD_HHMMSS_XXXXXX",
  "ts": "ISO 8601",
  "schema_version": "1.0.0",
  "source": "auto_heal|snapshot|agents|judge|...",
  "type": "事件类型",
  "severity": "debug|info|warning|error|critical",
  "component": "health|gateway|repair|...",
  "status": "started|success|failed|detected|...",
  "summary": "事件摘要",
  "details": {},
  "tags": [],
  "links": {}
}
```

---

## 四、策略配置

### 运行模式
- **normal**: 自动修复开启
- **safe**: 仅巡检不修复
- **debug**: 详细日志

### 高风险动作 (禁止自动执行)
- modify_permissions
- change_operator_scope
- unquarantine_skill
- replace_model_config
- rotate_credentials
- modify_trusted_proxies

### Judge 裁决规则
- 置信度阈值: 0.75
- 低置信度 → manual_review
- Security 有顾虑 → manual_review
- SRE 建议修复 + Security 无异议 → auto_repair

---

## 五、故障注入验收结果

| 测试项 | 结果 |
|--------|------|
| 事件发射 → inbox | ✅ |
| 事件处理 → processed | ✅ |
| 策略引擎命中 | ✅ |
| 高风险动作阻止 | ✅ |
| Judge 裁决 | ✅ |
| 快照创建 | ✅ |
| 告警通知 | ✅ |
| 事件复盘 | ✅ |

---

## 六、目录结构

```
autoheal/
├── bin/                    # 核心脚本 (7个)
│   ├── emit_event.sh
│   ├── process_event.sh
│   ├── run_policy.sh
│   ├── judge_agent.sh
│   ├── replay.sh
│   ├── fault_injection.sh
│   └── judge_stats.sh
├── config/
│   ├── policies.yaml       # 策略配置
│   └── event_schema.json   # 事件字典
├── events/
│   ├── inbox/              # 待处理
│   ├── processed/          # 已处理
│   └── archive/            # 归档
├── state/                  # 运行时状态
├── data/judge_stats/       # Judge 统计
└── manage.sh              # 统一入口
```

---

## 七、已知限制

1. YAML 解析为简化版，复杂配置可能需要增强
2. Judge Agent 目前基于规则，未来可升级为 ML
3. 事件归档需要定期清理任务
4. 部分事件 JSON 格式需要优化

---

## 八、下一步建议

### P1: Dashboard 升级
- 事件流展示
- 模型评分卡片
- Judge 决策时间线

### P2: Telegram 增强
- /replay 命令
- /mode 命令
- 决策通知

### P3: 统计分析
- Judge 决策统计
- 模型稳定性评分
- 告警趋势分析

---

## 九、交付物清单

- [x] 事件总线 (emit + process)
- [x] 策略引擎 (policies.yaml)
- [x] Judge Agent
- [x] 事件复盘工具
- [x] 事件字典 v1.0.0
- [x] 故障注入测试
- [x] Schema 版本号支持
- [x] 高风险动作阻止机制

---

**验收结论**: vNext 架构升级完成，链路全通，可投入使用。