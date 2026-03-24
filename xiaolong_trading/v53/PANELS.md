# 📋 小龙交易系统 - Web 面板

**更新时间**: 2026-03-20 13:19
**状态**: ✅ 统一入口

---

## 🟢 完整统一面板 V5.3

### 访问地址

| 类型 | 地址 |
|------|------|
| **本地** | http://localhost:8780/ |
| **公网** | https://unpersonal-currently-amberly.ngrok-free.dev/ |

---

## 📋 功能模块（顶部导航切换）

### 1. 📊 主面板
- 总交易次数、累计盈亏、胜率、平均评分
- 信号漏斗、系统状态
- GO/NO-GO 裁决显示

### 2. 🧬 演化引擎
- 参数演化、适应度追踪
- 变异记录、最优参数

### 3. 📊 市场结构
- 趋势分析、波动性监控
- 结构识别、信号列表

### 4. 🎯 决策追踪
- 决策统计、审批记录
- 通过率监控

### 5. 🎮 控制中心
- GO/NO-GO 裁决
- GO Stability 稳定性计数
- Hybrid 模式控制
- 权重推进 (STEP 0-4)
- 紧急回退
- Shadow 指标、安全状态

---

## 🚀 启动命令

```bash
cd /Users/colin/.openclaw/workspace/xiaolong_trading/v53
python3 integrated_server.py 8780

# 公网访问
~/.local/bin/ngrok http 8780
```

---

## 📁 核心文件

| 文件 | 说明 |
|------|------|
| `integrated_server.py` | 统一服务器 |
| `state_store.py` | 状态存储 + GO Stability |
| `control_flags.py` | 权重推进 + 安全保护 |
| `hybrid_controller.py` | Hybrid 模式控制 |

---

## 📁 已归档

旧面板文件已移动到 `_archived_panels/` 目录：
- `control_tower_server_v2.py`
- `control_tower_v3/`
- `full_server.py`
- `unified_server.py`

---

_最后更新: 2026-03-20 13:19_