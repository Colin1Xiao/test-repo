# 📊 监控面板数据源绑定问题

**发现时间**: 2026-03-27 04:40  
**发现者**: Colin (用户)  
**问题状态**: 🔴 已识别，需要修复

## 🚨 问题描述

监控面板 `heartbeat-state.json` 中的交易系统状态与当前 Phase 1C 主网真实执行状态不一致。

### 错误状态 (之前):
```json
"xiaolongSystem": {
  "version": "V5.4",
  "status": "READY",
  "phase": "MICRO_MODE_ENABLED",
  "totalTrades": 89,
  "capitalState": "MICRO",
  "equityUsdt": 1.35,
  "lastActivity": "2026-03-26T12:55:51.182643Z",
  "capitalMode": "MICRO_MODE (样本模式)"
}
```

### 真实状态 (当前 Phase 1C 主网):
```json
"xiaolongSystem": {
  "version": "V5.4.1",
  "status": "PHASE1C_ACTIVE",
  "phase": "MAINNET_PHASE1",
  "totalTrades": 0,
  "capitalState": "INIT",
  "equityUsdt": 0.0,
  "lastActivity": "2026-03-27T01:36:00+08:00",
  "capitalMode": "MAINNET_PHASE1 (干净初始化)"
}
```

## 🔍 根本原因

1. **数据源脱钩**: `heartbeat-state.json` 由独立的监控聚合器更新，未绑定到当前主网会话
2. **状态陈旧**: 使用旧轮换A的数据源 (`trading_system_v5_3/logs/state_store.json`)
3. **版本错位**: 显示 V5.4 而非当前的 V5.4.1
4. **模式不匹配**: 显示 MICRO_MODE 而非当前 MAINNET_PHASE1

## 🎯 影响

1. **监控误导**: 监控汇报不能反映当前真实交易状态
2. **决策风险**: 可能基于错误数据做出交易决策
3. **状态混淆**: 无法准确判断系统是否可交易
4. **版本管理**: 无法追踪当前真实部署版本

## 🔧 临时修复

已手动更新 `heartbeat-state.json` 中的 `xiaolongSystem` 部分，以反映真实 Phase 1C 状态。

## 🛠️ 长期解决方案需求

1. **动态绑定**: 监控脚本需要根据当前运行环境选择正确的数据源
2. **会话检测**: 自动检测当前运行的交易系统会话 (mainnet/testnet/micro)
3. **版本同步**: 监控数据源需与当前代码版本同步
4. **状态验证**: 监控前验证数据源是否与当前运行状态匹配

## 📋 验证清单

- [ ] 识别更新 `heartbeat-state.json` 的所有脚本/程序
- [ ] 建立主网/测试网/微样本模式的数据源映射
- [ ] 实现环境检测逻辑
- [ ] 添加数据源验证机制
- [ ] 更新所有监控聚合器使用正确的数据源

## 🚦 紧急处理

1. ✅ 已向执行窗口发送澄清信息
2. ✅ 已手动更新 `heartbeat-state.json` 正确状态
3. ✅ 已标记监控汇报为"非当前 mainnet Phase 1C 会话"
4. ⏳ 需要实现长期数据源绑定方案

## 📝 记录追踪

- **2026-03-27 04:40**: Colin 发现问题，监控数据与当前现场不一致
- **2026-03-27 04:45**: 手动更新 `heartbeat-state.json` 正确状态
- **2026-03-27 04:46**: 创建问题记录文档

---

## 📋 3条核心纪律 (立即实施)

### 1. 交易判定源优先级 (已固化)
```
优先级链:
1. 实时交易日志 - Phase 1C 实时输出
2. 当前会话 StateStore - state_store_mainnet_v541_phase1.json
3. heartbeat / 聚合监控面板 - 仅辅助参考

规则: 面板永远不能高于实时日志
```

### 2. 环境切换同步检查清单
```
每次切换环境 (testnet→mainnet, shadow→execute, v5.4.0→v5.4.1, phase0→phase1) 必须检查:
- state_source
- heartbeat_source
- version_tag
- phase_tag
- network_tag
- shadow_mode_flag
- execute_mode_flag
```

### 3. 当前参数锁定
```
can_open=true ✓
max_daily_trades=1 ✓
其余参数不变 ✓
```

## 🔐 最小防呆机制 (已实施)

在 `heartbeat-state.json` 中增加以下字段:
```json
"metadata_failsafe": {
  "state_store_path": "/Users/colin/.openclaw/workspace/trading_system_v5_3/logs/state_store_mainnet_v541_phase1.json",
  "session_id": "mainnet_phase1c_v541",
  "network": "mainnet",
  "phase": "phase1_first_trade",
  "shadow_mode": false,
  "execute_mode": true,
  "data_source_last_sync": "2026-03-27T04:47:00+08:00",
  "priority_chain": ["实时交易日志", "当前会话 StateStore", "heartbeat/聚合面板"],
  "warning": "面板永远不能高于实时日志"
}
```

## 🎯 当前目标

**唯一目标**: 等待首个可解释的真实主网执行结果

**监控重点**: 一旦出现以下任一情况，立即回传:
- `[EXECUTION_ATTEMPT]`
- `[PRE_TRADE_CHECK]` 
- `[ORDER_RESULT]`

**第一笔真实主网单必须包含**:
```
signal_score
volatility
spread_bps
ORDER_RESULT
```
若成交，再补完整 9 项复审数据

---

**当前状态**: 监控数据源错位已从交易判断中剥离，后续只剩真实执行本身。