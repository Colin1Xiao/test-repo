# HEARTBEAT.md - 小龙的心跳任务

_夜猫子模式：监控一切，适时打扰。_

---

## 🐉 心跳策略

**用户模式：** 夜猫子（活跃时间偏夜间）  
**风险偏好：** 高（加密货币交易）  
**通知原则：**
- 🔴 紧急（爆仓/大额亏损）→ **立即通知，不限时间**
- 🟡 重要（持仓异常/风险上升）→ **夜间也通知**
- 🟢 一般（信号/提醒）→ **08:00-02:00 通知**（夜猫子友好）
- ⚪ 日常（状态正常）→ **仅异常时通知**

---

## 💓 心跳检查频率

**已配置:** 每日两次 (08:00 / 20:00)

**Cron 表达式:** `0 8,20 * * *` (Asia/Shanghai 时区)

**通知原则:**
- 🟢 正常状态 → 仅记录，不通知
- 🟡 警告状态 → 记录 + 下次心跳时报告
- 🔴 严重状态 → 立即通知 (不限时间)

### 1. 系统健康检查
```bash
~/.openclaw/workspace/scripts/openclaw-health-check.sh
```

**读取：** `openclaw-health-check.json`

**状态变化时报告：**
```
【小龙状态更新】

{🟢|🟡|🔴} Gateway：{变化}
{🟢|🟡|🔴} Telegram：{变化}
{🟢|🟡|🔴} Memory Search：{变化}
{🟢|🟡|🔴} 交易系统：{变化}

🧭 系统健康度：{🟢正常|🟡部分受限|🔴需要关注}
```

### 2. 自动恢复控制器
```bash
~/.openclaw/workspace/scripts/recovery-controller.sh
```

### 3. 预测引擎
```bash
~/.openclaw/workspace/scripts/predictive-engine.sh
```

---

## 💰 交易监控（高优先级）

### 轮换 A：持仓与风险检查

**执行频率：** 每次心跳（~30分钟）

**数据读取：**
```bash
# 读取实时状态
cat ~/.openclaw/workspace/trading_system_v5_3/logs/live_state.json

# 读取交易统计
cat ~/.openclaw/workspace/trading_system_v5_3/logs/state_store.json
```

**检查项：**
- [ ] **持仓状态** (`live_state.json` → `position`)
  - 当前仓位大小
  - 持仓方向（多/空）
  - 开仓价格
  - 当前盈亏

- [ ] **账户余额** (`live_state.json` → `balance`)
  - 可用余额 (`usdt_free`)
  - 总余额 (`usdt_total`)
  - 已用保证金 (`usdt_used`)

- [ ] **风险水平** (`state_store.json` → `capital`)
  - 杠杆倍数 (`leverage`)
  - 风险百分比 (`risk_pct`)
  - 权益 (`equity_usdt`)

- [ ] **交易统计** (`state_store.json`)
  - 总交易数 (`total_trades`)
  - 总盈亏 (`total_pnl`)
  - 胜率 (`win_count / total_trades`)

- [ ] **止损状态** (`last_event` → `stop_ok`, `stop_verified`)
  - 止损单是否存在
  - 是否已验证

**告警阈值：**
- 🔴 **Critical：** 爆仓距离 < 10% 或保证金率 < 20%
- 🟡 **Warning：** 爆仓距离 < 25% 或亏损 > 5%
- 🟢 **Info：** 正常范围

**报告格式：**
```
【交易风险提醒】

📊 持仓：[方向] [数量] @ [均价]
   来自: ~/.openclaw/workspace/trading_system_v5_3/logs/live_state.json
   
💰 盈亏：+$X / -$X ([百分比])
   总盈亏: [total_pnl] ([win_count]胜/[loss_count]负)
   
⚠️ 风险：杠杆 [leverage]x | 权益 [equity_usdt] USDT
   保证金状态: [capital_state]
   
🔴 状态：[Critical/Warning/Normal]

💡 建议：[如有]
```

---

### 轮换 B：交易信号与策略检查

**执行频率：** 每 2-3 次心跳

**数据读取：**
```bash
# 读取最后交易事件
cat ~/.openclaw/workspace/trading_system_v5_3/logs/state_store.json | jq '.last_event'

# 读取所有事件历史
cat ~/.openclaw/workspace/trading_system_v5_3/logs/state_store.json | jq '.events[-5:]'
```

**检查项：**
- [ ] **策略引擎状态**
  - 最后事件时间戳 (`last_event.timestamp`)
  - 事件类型（entry/exit）
  - 退出原因 (`exit_source`: STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL)

- [ ] **新信号检测**
  - 对比上次检查的事件数 (`total_events`)
  - 新事件类型和方向 (`side`: buy/sell)
  - 入场价格 (`entry_price`)

- [ ] **执行质量**
  - 止损是否成功 (`stop_ok`, `stop_verified`)
  - 保证金状态 (`capital_state`)
  - 资金模式 (`capital_reason`)

**报告格式：**
```
【交易信号】

🎯 新信号：[side] [position_size] @ [entry_price]
📈 方向: [buy/sell] | 杠杆: [leverage]x
⏰ 时间: [timestamp]
💰 保证金: [margin_usdt] USDT
✅ 止损: [stop_ok] | 验证: [stop_verified]

[或]

✅ 策略运行正常
📊 总交易: [total_trades] | 盈亏: [total_pnl]
📈 胜率: [win_rate]% ([win_count]胜/[loss_count]负)
⏰ 最后交易: [N] 分钟前
🔴 退出原因: [exit_source]
```

---

### 轮换 C：API 与连接检查

**执行频率：** 每 3-4 次心跳

**数据读取：**
```bash
# 读取实时状态（包含价格和延迟信息）
cat ~/.openclaw/workspace/trading_system_v5_3/logs/live_state.json
```

**检查项：**
- [ ] **OKX API 连接**
  - 最后更新时间 (`timestamp`)
  - 当前价格 (`price`)
  - 买卖价差 (`spread_pct`)

- [ ] **订单簿状态**
  - 买一价 (`bid`)
  - 卖一价 (`ask`)
  - 价差百分比

- [ ] **网络状态**
  - 网络类型 (`network`: MAINNET/TESTNET)
  - 交易对 (`symbol`)

**告警阈值：**
- 🔴 数据更新时间 > 5 分钟（可能断连）
- 🟡 价差 > 0.1%（流动性问题）
- 🟢 正常更新且价差 < 0.05%

---

## 📅 日程与生产力

### 轮换 D：日历检查

**执行频率：** 每 2 次心跳

**检查项：**
- [ ] **24h 内事件**
  - 会议/约会
  - 截止日期
  - 提醒事项

**提醒阈值：**
- 🔴 事件即将开始（<30分钟）
- 🟡 事件在 2h 内
- 🟢 事件在 24h 内

**报告格式：**
```
【日程提醒】

📅 [时间] - [事件名称]
⏰ 还有 [X 分钟/小时]
📍 [地点/链接]
```

---

### 轮换 E：邮件检查

**执行频率：** 每 3 次心跳

**检查项：**
- [ ] **紧急邮件筛选**
  - VIP 联系人邮件
  - 包含关键词（urgent/urgent/asap）
  - 交易所/银行通知

**注意：** 仅检查，不读取内容，仅报告存在

---

### 轮换 F：待办事项

**执行频率：** 每 4 次心跳

**检查项：**
- [ ] **过期任务**
- [ ] **今日到期**
- [ ] **即将到期（24h）**

---

## 🖥️ 开发/项目

### 轮换 G：Git 状态检查

**执行频率：** 每 3 次心跳

**检查项：**
- [ ] **未提交更改**
  - 修改的文件数
  - 新增的文件数

- [ ] **待推送提交**
  - 本地领先远程的 commit 数

- [ ] **PR 状态**
  - 待审查的 PR
  - CI 状态变化

**报告格式：**
```
【Git 状态】

📝 未提交：[N] 个文件
⬆️ 待推送：[N] 个 commit
🔍 PR 待审：[N] 个
```

---

### 轮换 H：项目监控

**执行频率：** 每 6 次心跳

**检查项：**
- [ ] **关键项目目录**
  - 文件变化
  - 日志异常

- [ ] **运行中的服务**
  - 进程状态
  - 资源使用

---

## 🌐 其他监控

### 轮换 I：天气检查

**执行频率：** 每 6 次心跳（约 3 小时）

**检查项：**
- [ ] **当前天气**
- [ ] **未来 6 小时预报**
- [ ] **异常天气预警**

**触发条件：** 用户可能外出时（根据日历推断）

---

### 轮换 J：市场新闻

**执行频率：** 每 8 次心跳

**检查项：**
- [ ] **加密货币重大新闻**
- [ ] **监管动态**
- [ ] **市场异常波动**

**注意：** 使用 Tavily 搜索，仅报告标题和摘要

---

## 🔄 轮换执行计划

| 心跳 # | 执行任务 |
|--------|---------|
| 1 | 系统核心 + 持仓风险 (A) |
| 2 | 系统核心 + 日历 (D) |
| 3 | 系统核心 + 信号 (B) + Git (G) |
| 4 | 系统核心 + 邮件 (E) |
| 5 | 系统核心 + API (C) + 待办 (F) |
| 6 | 系统核心 + 日历 (D) + 天气 (I) |
| 7 | 系统核心 + 持仓风险 (A) + Git (G) |
| 8 | 系统核心 + 项目 (H) + 新闻 (J) |
| ... | 循环 |

---

## 📝 心跳状态记录

**文件：** `memory/heartbeat-state.json`

```json
{
  "lastChecks": {
    "health": "2026-03-25T03:00:00Z",
    "trading_position": "2026-03-25T03:00:00Z",
    "trading_signal": "2026-03-25T02:30:00Z",
    "trading_api": "2026-03-25T02:00:00Z",
    "calendar": "2026-03-25T02:30:00Z",
    "email": "2026-03-25T02:00:00Z",
    "git": "2026-03-25T02:30:00Z",
    "weather": "2026-03-25T01:00:00Z"
  },
  "lastNotifiedCritical": null,
  "lastNotifiedWarning": null,
  "pendingAlerts": []
}
```

---

## 🚨 紧急响应流程

**检测到 Critical 级别问题：**

1. **立即执行：**
   - 记录问题详情
   - 生成简要报告

2. **立即通知（不限时间）：**
   ```
   【🚨 紧急】
   
   [问题类型]：[描述]
   
   当前状态：[关键数据]
   建议行动：[操作]
   ```

3. **后续：**
   - 等待用户响应
   - 如用户无响应，15分钟后再次提醒
   - 持续恶化时升级告警

---

## ⚡ 快速检查清单

**心跳开始时：**
1. 读取 `memory/heartbeat-state.json`
2. 确定本次要执行的轮换任务
3. 执行系统核心检查
4. 执行轮换任务
5. 更新 `memory/heartbeat-state.json`
6. 如无异常 → `HEARTBEAT_OK`
7. 如有异常 → 生成报告并通知

---

_心跳不停，监控不止。小龙替你盯着。_