# 小龙智能交易系统 V5.4

**当前版本**: V5.4.0-verified (生产就绪)  
**更新时间**: 2026-03-29  
**状态**: 实盘验证完成，灰度运营中  

**运行目录**: `trading_system_v5_3/`  
**版本文档**: `trading_system_v5_4/`

---

## 🚨 重要说明

**版本命名 vs 运行目录**：
- **版本号**: V5.4（实盘验证完成，生产就绪）
- **运行目录**: `trading_system_v5_3/`（历史原因，所有运行时资产在此）
- **版本文档**: `trading_system_v5_4/`（架构、测试报告、发布说明）

**为什么目录名和版本号不一致？**
V5.4 是在 V5.3 运行目录上通过补丁方式完成实盘验证的，因此：
- 运行时文件（日志、配置、状态）→ `trading_system_v5_3/`
- 版本文档（架构、测试、发布说明）→ `trading_system_v5_4/`

**这是正常状态，不要误删 `trading_system_v5_3/`。**

---

## 快速开始

### 启动系统（当前版本）
```bash
cd ~/.openclaw/workspace/trading_system_v5_3
python3 run_v52_live.py
```

### 查看实时状态
```bash
# 实时状态（持仓、余额、价格）
cat ~/.openclaw/workspace/trading_system_v5_3/logs/live_state.json | jq

# 交易历史与盈亏统计
cat ~/.openclaw/workspace/trading_system_v5_3/logs/state_store.json | jq

# 系统日志
tail -f ~/.openclaw/workspace/trading_system_v5_3/logs/gray_phase2_live.log
```

### 访问控制面板
```bash
# 面板日志
tail -f ~/.openclaw/workspace/trading_system_v5_3/logs/panel_v40.log
```

### 紧急停止
```bash
# 停止交易进程
pkill -f "run_v52_live.py"
pkill -f "panel_v40.py"
```

---

## 核心文件（V5.4 生产版本）

### 运行目录结构 (`trading_system_v5_3/`)
```
trading_system_v5_3/
├── core/                    # 核心模块
│   ├── execution_engine.py  # 执行引擎（V5.4 安全执行链）
│   ├── position_gate.py     # 持仓门控（防叠仓）
│   ├── stoploss_manager.py  # 止损管理（订单级止损）
│   ├── decision_hub.py      # 决策中心
│   └── ...
├── config/                  # 配置文件
│   ├── trader_config.json   # 策略配置
│   ├── system_config.json   # 系统配置
│   └── market_data_v54.json # 市场数据
├── logs/                    # 运行日志
│   ├── live_state.json      # 实时状态（持仓/余额/价格）
│   ├── state_store.json     # 交易历史与盈亏统计
│   ├── profit_audit.json    # 盈亏审计
│   └── gray_phase2_live.log # 灰度运行日志
└── panel_v40.py             # Web 控制面板
```

### 版本文档 (`trading_system_v5_4/`)
| 文件 | 用途 |
|------|------|
| `V5_4_ARCHITECTURE.md` | 完整架构文档 (17.6KB) |
| `V5_4_TEST_REPORT.md` | 测试报告 (14/14 用例通过) |
| `PRODUCTION_READINESS_CHECKLIST.md` | 生产验证清单 |
| `RELEASE_NOTES_V5.4.md` | 发布说明 |
| `V54_INTEGRATION_GUIDE.md` | 集成指南 |
| `DEPLOYMENT_LOG.md` | 部署日志 |
| `GRAYSCALE_PHASE2_READY.md` | 灰度 Phase 2 就绪 |

### V5.4 核心修复
1. **Execution Lock** - 原子化执行，防止并发叠仓
2. **Position Gate (双层)** - 本地状态 + 交易所状态双重检查
3. **订单级止损** - 交易所托管止损，二次验证
4. **Exit Source 记录** - 完整退出原因审计
5. **StateStore 文件锁** - 防止并发写入损坏数据

---

## 系统状态

```
✅ V5.4 实盘验证完成 (3 笔 Safety Test 通过)
✅ 核心安全链验证通过
  - Execution Lock: 单线程执行
  - Position Gate: 无叠仓
  - Stop Loss: 交易所侧真实止损单
  - Exit Source: 正确记录
  - StateStore: 完整落盘 (5 字段)
✅ 灰度 Phase 2 就绪
🔄 等待 OKX 环境恢复后扩大样本
```

---

## 关键配置

### 交易参数
| 参数 | 值 |
|------|-----|
| 交易所 | OKX (实盘) |
| 交易对 | ETH/USDT:USDT |
| 杠杆 | 100x (强制锁定) |
| 止损 | -0.5% |
| 止盈 | 0.2% |
| 爆仓前退出 | -0.4% |
| Phase 1 仓位 | 3 USD |

### 安全设置
- ✅ 提现权限：关闭
- ✅ API 权限：仅交易，无提币
- ✅ 样本过滤：启用
- ✅ 参数审计锁：启用
- ✅ 异常自动回滚：启用

---

## 验证记录

### Safety Test #1 (2026-03-26)
- ✅ 开仓 + 止损单提交 + 验证 (8/8 通过)
- ✅ Position Gate 重复保护 (5/5 通过)
- ✅ 退出审计 + StateStore 更新 (4/4 通过)

**验收标准**：连续 3 笔通过 5 项检查
- Execution Lock: 无重复开仓
- Position Gate: 单仓 0.13 ETH
- Stop Loss: 存在且可查
- TIME_EXIT: ≤ 30s 触发
- Exit Source: 正确记录

---

## 下一步

1. ✅ ~~完成 V5.4 实盘验证~~ (已完成)
2. ✅ ~~统一命名规范~~ (进行中)
3. ⏳ 灰度 Phase 2 扩大样本
4. ⏳ Edge 验证阶段（100 笔统计显著性）
5. ⏳ 归档历史版本文档

---

## 文档导航

| 文档 | 用途 |
|------|------|
| `MEMORY.md` | 长期记忆与决策记录 |
| `AGENTS.md` | 工作台操作准则 |
| `HEARTBEAT.md` | 心跳任务与监控策略 |
| `TOOLS.md` | 本地备忘录与配置 |
| `WORKSPACE_INVENTORY_2026-03-29.md` | 工作区完整清单 |

---

## 历史版本

| 版本 | 状态 | 说明 |
|------|------|------|
| V5.4 | ✅ 生产就绪 | 当前版本，实盘验证完成 |
| V5.3 | 📦 归档 | V5.4 基础版本 |
| V5.2 | 📦 归档 | Phase 1 启动版本 |
| V4.x | 📦 归档 | 历史版本 |
| V3.x | 📦 归档 | 旧版模拟盘系统 |

---

*最后更新：2026-03-29 04:30*  
*确保任何窗口读取的都是最新唯一版本*
