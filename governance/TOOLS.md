# TOOLS.md - 小龙的本地备忘

_环境特定的配置，不随 skill 更新而丢失。_

---

## 💰 交易系统

### 路径
```
~/.openclaw/workspace/trading_system_v5_3/
├── logs/
│   ├── state_store.json    # 交易历史、盈亏统计
│   └── live_state.json     # 实时价格、持仓、余额
├── config/
│   └── trader_config.json  # 策略配置
└── data/
    └── env_filter_state.json
```

### 关键字段
**state_store.json:**
- `total_trades` - 总交易数
- `total_pnl` - 总盈亏
- `win_count/loss_count` - 胜负次数
- `last_event` - 最后交易事件
- `capital.equity_usdt` - 当前权益
- `capital.leverage` - 杠杆倍数

**live_state.json:**
- `price` - 当前价格
- `position` - 当前持仓（null = 无持仓）
- `balance.usdt_free` - 可用余额
- `balance.usdt_total` - 总余额

### 交易所
- **OKX** - 主交易所
- **网络** - MAINNET（实盘）
- **交易对** - ETH/USDT:USDT

---

## 🔊 TTS 语音

### 偏好
- **声音:** [待配置]
- **风格:** [待配置]
- **默认设备:** [待配置]

---

## 🖥️ SSH 主机

### 远程服务器
- **[别名]** → [IP/域名], user: [用户名]
- **[别名]** → [IP/域名], user: [用户名]

---

## 📷 设备

### 相机
- **[名称]** → [位置/描述]

### 其他设备
- **[名称]** → [描述]

---

## 🔧 常用命令

### 交易系统
```bash
# 查看最新状态
cat ~/.openclaw/workspace/trading_system_v5_3/logs/live_state.json | jq

# 查看交易历史
cat ~/.openclaw/workspace/trading_system_v5_3/logs/state_store.json | jq
```

### OpenClaw
```bash
# 健康检查
~/.openclaw/workspace/scripts/openclaw-health-check.sh

# 查看状态
cat ~/.openclaw/workspace/openclaw-health-check.json | jq
```

---

## 📝 待补充

- [ ] TTS 语音偏好
- [ ] SSH 主机配置
- [ ] 相机/设备列表
- [ ] 其他常用命令

---

_小龙的备忘，随时更新。_