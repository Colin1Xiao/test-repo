# OpenClaw Auto-Heal

**版本**: `ops-baseline-1.0` (Stable)
**发布日期**: 2026-03-17

---

## 版本标签

```
OpenClaw Ops Baseline 1.0
```

此版本是 OpenClaw 运维系统的**首个稳定基线**，包含完整的事件驱动架构、策略引擎、多代理裁决和可观测性。

---

## 快速开始

```bash
# 查看版本
cat VERSION

# 系统状态
./manage.sh status

# 基线检查
./bin/baseline_check.sh check

# Dashboard
open dashboard/index.html
```

---

## 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 事件总线 | ✅ v1.0 | emit_event + process_event |
| 策略引擎 | ✅ v1.0 | policies.yaml 配置驱动 |
| Judge Agent | ✅ v1.0 | 多代理裁决，置信度判断 |
| 事件复盘 | ✅ v1.0 | 时间线重建，快照关联 |
| Dashboard | ✅ v1.0 | 事件时间线，模型评分 |
| 基线检查 | ✅ v1.0 | 10项指标自动检测 |
| 自动修复 | ✅ v1.0 | 白名单保护，高风险阻止 |

---

## 架构

```
事件驱动 → 策略引擎 → 多代理裁决 → 可复盘
    ↓           ↓           ↓          ↓
 emit_event → run_policy → judge → replay
```

---

## 基线指标

```yaml
核心:
  critical_count: 0
  exit_code: 0
  gateway_online: true
  ocnmps_online: true

性能:
  telegram_latency < 2000ms

Judge:
  confidence_threshold: 0.75
```

---

## 目录结构

```
autoheal/
├── VERSION              # 版本文件
├── VERSION.md           # 版本说明
├── config/
│   ├── baselines.yaml   # 基线配置
│   ├── event_schema.json # 事件字典
│   └── policies.yaml    # 策略配置
├── bin/                 # 核心脚本
├── dashboard/           # Web 面板
├── events/              # 事件存储
├── state/               # 运行时状态
└── manage.sh            # 统一入口
```

---

## 回滚方法

```bash
# 检查是否偏离基线
./bin/baseline_check.sh check

# 恢复到基线状态
./autoheal.sh
./bin/baseline_check.sh check
# 输出: 10/10 通过, ✅ 符合基线
```

---

## 升级计划

| 版本 | 计划功能 |
|------|----------|
| v1.1 | Dashboard 模型评分可视化 |
| v1.2 | Telegram 远程命令增强 |
| v1.3 | ML 增强 Judge 决策 |

---

## 许可

内部使用 - OpenClaw 运维系统