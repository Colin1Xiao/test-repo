# 交易系统 Web 面板清单报告

**生成时间:** 2026-03-20 12:13 GMT+8
**发现问题:** 存在多个重复/类似的 Web 面板

---

## 🚨 发现的 Web 面板

### 1. V5.3 Monitor Server (trading_system_v5_3/)
**文件:** `trading_system_v5_3/monitor_server.py` (172KB)
**端口:** 8765
**框架:** FastAPI
**功能:**
- `/dashboard` - 主监控面板
- `/evolution/dashboard` - 演化引擎面板
- `/structure/dashboard` - 市场结构面板
- 决策追踪、信号漏斗、执行日志
- AI 风控评分、异常检测

**访问地址:**
- `http://localhost:8765/dashboard`

---

### 2. Control Tower v3 (xiaolong_trading/v53/)
**文件:** `xiaolong_trading/v53/control_tower_server.py` (34KB)
**端口:** 8765 (与上面冲突!)
**框架:** FastAPI + WebSocket
**功能:**
- 实时数据推送
- 公网访问支持 (frp/ngrok/cloudflared)
- Shadow Mode 集成
- 决策追踪查看器

**文件变体:**
- `control_tower_server.py` - v3 主版本
- `control_tower_server_v2.py` - v2 版本

---

### 3. 其他监控文件

| 文件 | 位置 | 类型 |
|------|------|------|
| `testnet_advanced_monitor.py` | trading_system_v5_3/ | 终端监控 |
| `testnet_standby_monitor.py` | trading_system_v5_3/ | 备用监控 |
| `testnet_structure_monitor.py` | trading_system_v5_3/ | 结构监控 |
| `live_ops_dashboard.py` | trading_system_v5_3/core/ | 终端仪表板 |
| `position_monitor.py` | trading_system_v5_3/core/ | 持仓监控 |
| `system_monitor.py` | trading_system_v5_3/core/ | 系统监控 |

---

### 4. 旧版本面板 (archive/)
| 文件 | 说明 |
|------|------|
| `auto_monitor_v4.py` ~ `v7.py` | 归档版本 |

---

## ⚠️ 问题分析

### 1. 端口冲突
```
trading_system_v5_3/monitor_server.py      → 端口 8765
xiaolong_trading/v53/control_tower_server.py → 端口 8765
```
**风险:** 同时启动会导致端口冲突

### 2. 功能重叠
- 两个 FastAPI 服务器都提供类似的监控功能
- 都有 `/dashboard` 路由
- 都集成了决策追踪功能

### 3. 代码重复
- `xiaolong_trading/v53/` 和 `trading_system_v5_3/` 结构相似
- 相同的模块在不同位置重复存在:
  - `core/system_monitor.py`
  - `core/position_monitor.py`
  - `core/live_ops_dashboard.py`

### 4. 维护困难
- 多个版本难以同步更新
- 容易产生功能不一致

---

## 💡 建议方案

### 方案 A: 统一到单一面板

**推荐:** 保留 `trading_system_v5_3/monitor_server.py`

原因:
1. 功能最完整 (172KB)
2. 包含演化引擎和结构预测面板
3. Level 2/3 功能齐全

**操作:**
1. 将 `xiaolong_trading/v53/` 中的独特功能迁移到 `trading_system_v5_3/`
2. 删除或归档 `xiaolong_trading/v53/` 中的服务器文件
3. 统一使用端口 8765

---

### 方案 B: 分离职责

| 面板 | 端口 | 职责 |
|------|------|------|
| Monitor Server | 8765 | 本地监控 |
| Control Tower | 8766 | 公网访问 |

**操作:**
1. 修改 `control_tower_server.py` 端口为 8766
2. Monitor Server 负责本地详细监控
3. Control Tower 负责公网简化访问

---

### 方案 C: 完整合并

创建统一入口:

```
trading_system_v5_3/
├── server.py              # 统一入口
├── routers/
│   ├── dashboard.py       # 主面板路由
│   ├── evolution.py       # 演化引擎路由
│   ├── structure.py       # 市场结构路由
│   └── public.py          # 公网访问路由
└── static/
    └── dashboard.html     # 前端页面
```

---

## 📊 当前状态

| 系统 | 面板数量 | 状态 |
|------|----------|------|
| trading_system_v5_3 | 1 主面板 + 3 终端监控 | 🟡 重复 |
| xiaolong_trading/v53 | 1 主面板 + 2 版本 | 🟡 冲突 |
| xiaolong_trading_system_4.2 | 相同结构复制 | 🟡 重复 |

---

## 🎯 推荐行动

### 短期 (立即)
1. ✅ 确认当前运行的是哪个面板
2. ✅ 避免同时启动两个服务器

### 中期 (本周)
1. 选择统一面板 (推荐方案 A)
2. 迁移独特功能
3. 删除/归档重复代码

### 长期 (下周)
1. 重构为模块化架构
2. 统一配置管理
3. 添加启动脚本

---

*报告生成时间: 2026-03-20 12:13 GMT+8*