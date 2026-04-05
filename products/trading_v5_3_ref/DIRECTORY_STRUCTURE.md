# 目录结构规范

```
trading_system_v5_3/
├── core/                    # 核心模块（63个）
│   ├── decision_hub.py      # 唯一决策源 ⭐
│   ├── execution_gate.py    # 执行门控
│   ├── live_executor.py     # 实盘执行器
│   ├── profit_audit.py      # 收益审计
│   ├── capital_controller.py # 资金控制
│   ├── kill_switch.py       # 系统停止
│   ├── system_integrity_guard.py # 完整性守护
│   └── ...
├── config/                  # 配置文件
├── logs/                    # 日志文件
├── data/                    # 数据文件
├── scripts/                 # 运维脚本
├── vps_price_server/        # VPS价格服务
├── VERSION                   # 版本锁
├── MODULE_REGISTRY.md       # 模块职责表
├── DIRECTORY_STRUCTURE.md   # 目录结构（本文件）
└── run_v52_live.py          # 主入口
```

## 目录说明

### core/ - 核心模块

所有交易逻辑的模块存放位置

**命名规范**:
- 小写下划线命名
- 模块名 = 主要类名小写

**文件数**: 63 个活跃模块

### config/ - 配置文件

所有配置文件存放位置

**内容**:
- `regime_config.json` - Regime 配置
- `strategy_config.json` - 策略配置

### logs/ - 日志文件

所有运行日志存放位置

**核心日志**:
- `system_state.jsonl` - 系统状态
- `decision_log.jsonl` - 决策日志
- `latency_samples.json` - 延迟样本
- `profit_audit.json` - 审计报告

### data/ - 数据文件

运行时数据存放位置

---

_版本: V5.3 | 更新: 2026-03-20_
