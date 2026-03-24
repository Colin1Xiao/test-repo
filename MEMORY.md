# 🧠 MEMORY.md - 长期记忆

_精选的重要信息，跨会话持久化_

---

## 👤 用户档案

- **名称**: Colin
- **身份**: 量化交易者 / 开发者
- **时区**: Asia/Shanghai (GMT+8)
- **偏好**: 简洁高效，重视安全

---

## 🎯 核心项目

### 小龙智能交易系统 V5.2 (2026-03-19 上线)

**版本演进**:
- V4.2 → 100x杠杆 + 执行验证
- V4.3 → Regime驱动 + 动态权重
- V5.1 → 自适应进化 + 自动停止
- V5.2 → 完全可控 + 异常回滚 ✅ 当前版本

**系统架构**:
- 14个核心模块，生产级可控系统
- Regime驱动 (RANGE/TREND/BREAKOUT)
- 7层安全防护

**关键配置**:
- 交易所: OKX (实盘/Testnet)
- 杠杆: 100x (强制锁定)
- 止损: -0.5%
- 止盈: 0.2%
- 爆仓前退出: -0.4%
- Phase 1仓位: 3 USD

**安全设置**:
- 提现权限: 关闭
- API权限: 仅交易，无提币
- 样本过滤: 启用
- 参数审计锁: 启用
- 异常自动回滚: 启用

---

## 🔐 安全偏好

- **风险容忍度**: 中等偏低
- **密码策略**: 强密码 + 定期轮换
- **API安全**: 最小权限原则，禁用提现
- **系统安全**: 启用防火墙，定期安全审计

---

## 🤖 AI助手配置

- **助手名称**: 小龙
- **性格**: 幽默友好，可切换正式模式
- **Emoji**: 🐉
- **记忆搜索**: 已启用 (2026-03-16)

---

## 📅 重要日期

| 日期 | 事件 |
|------|------|
| 2026-03-12 | 小龙智能交易系统完整搭建 |
| 2026-03-16 | OpenClaw安全审计与加固 |
| 2026-03-17 | 本地Memory Search完全启用 |
| 2026-03-18 | V5.2生产级系统完成，Phase 1启动 |

---

## ⚠️ 安全事件

### 2026-03-16 安全审计

**发现问题**:
- `repo-analyzer` skill: 5个关键问题，已隔离
- `skill-mermaid-diagrams`: 2个关键问题，已审查恢复
- 应用防火墙: 已启用

**处置状态**:
- ✅ repo-analyzer: 保持隔离
- ✅ skill-mermaid-diagrams: 已恢复
- ✅ 防火墙: 已启用

---

## 🔧 系统配置

### OpenClaw
- **版本**: 2026.3.12 (stable)
- **网关**: 127.0.0.1:18789 (本地回环)
- **通道**: Telegram (@AlanColin_Xiao_bot)
- **Memory Search**: ✅ **本地向量检索已完全启用**

### 已安装Skills (36个)
- clawhub
- coding-agent
- skill-vetter
- skill-mermaid-diagrams (已恢复)
- ...等

### 隔离区Skills
- repo-analyzer (高风险，保持隔离)

---

## 📝 决策记录

### 2026-03-16
1. **保持repo-analyzer隔离**: 命令注入风险，需进一步审查
2. **恢复skill-mermaid-diagrams**: 风险可控，仅调用mmdc
3. **启用Memory Search**: 提升跨会话记忆能力
4. **跳过Time Machine**: 用户取消备份策略

### 2026-03-17
1. **OpenClaw 本地 memory search 已成功启用**
2. **当前使用本地模型** `/Users/colin/.openclaw/memory/models/embeddinggemma-300M-Q8_0.gguf`
3. **node-llama-cpp 需使用预编译包** `@node-llama-cpp/mac-x64` **才能稳定工作**
4. **本机已完成 5/5 files、12 chunks 的本地向量索引，hybrid search 可用**

### 2026-03-18
1. **100x杠杆系统验证通过**: 执行测试滑点0.00007%
2. **V4.3 Regime驱动架构完成**: 解决"错过趋势行情"问题
3. **手续费优化**: 从50%降至27.6%（提高止盈到0.2%）
4. **V5.1质量评估系统完成**: 信号质量 + 执行质量 + 守护者
5. **V5.2安全控制层完成**: 7层防护 + 异常自动回滚
6. **盘口深度检查修复**: `depth`变量按`side`选择
7. **Phase 1启动**: 3 USD × 100x，严格3笔验证

### 2026-03-19
1. **系统状态**: FULLY CLEARED FOR PHASE 1
2. **角色定位**: OBSERVER_ONLY
3. **等待**: 第一笔真实交易审计数据
4. **🔥 OpenClaw 智能自愈系统完成**: V1.0 → V3.6 完整演进
   - V1.0: 状态检测
   - V1.5: 状态变化 + 健康度
   - V2.0: 状态驱动行为 + 自愈建议
   - V2.5: 受控自动恢复（安全版）
   - V3.0: 智能自愈（策略选择 + 学习）
   - V3.5: 预测性恢复（受控版）
   - V3.6: **行为收敛 + 控制系统**（迟滞 + 门控 + 速率限制）
   - V3.7: **决策一致性层**（仲裁器 + 冲突检测）
   - V3.8: **决策动量**（防止过度约束 → 系统僵死）
   - V3.9: **行为护栏**（防止行为漂移 → 系统失控）
   - V4.0: **自认知系统**（可解释性 + 自评估 + TL;DR）
5. **Shadow Mode 启用**: 预测系统只记录不执行，验证准确性
6. **错误预算机制**: 定义系统健康阈值
7. **每日运行报告**: 自动化系统健康统计
8. **进入收敛阶段**: 不再加功能，跑 5-7 天验证稳定性
9. **V3.6 核心升级**:
   - 迟滞控制: 状态必须稳定 10 秒才确认
   - 恢复门控: 判断"该不该恢复"
   - 预测执行灰度: 置信度 ≥ 85% 执行
   - 速率限制: 最多 5 次/小时, 20 次/天

---

## 🔧 OpenClaw 智能自愈系统

**版本**: V3.5（预测式自愈）
**状态**: Shadow Mode（验证阶段）

### 系统架构
```
感知层: 健康检查 → 事件识别 → 状态变化检测
决策层: 策略选择 → 动态优先级 → 学习反馈 → 预测判断
执行层: Wrapper启动 → Recovery(V2.5) → Recovery(V3) → Predictive
知识层: 策略库 + 历史记录 + 学习系统 + 预测统计
```

### 核心文件
| 文件 | 功能 |
|-----|------|
| `openclaw-health-check.json` | 实时健康状态 |
| `recovery-strategies.json` | 多策略数据库 |
| `recovery-history.json` | 恢复历史 + 学习 |
| `predictive-log.json` | 预测日志 + 统计 |
| `error-budget.json` | 错误预算 |

### 安全机制
- 冷却时间（防止频繁恢复）
- 最大尝试次数（防止无限重试）
- Shadow Mode（预测只记录不执行）
- 错误预算（定义系统健康阈值）

### 运行脚本
- `scripts/openclaw-health-check.sh` - 健康检查
- `scripts/recovery-controller.sh` - V2.5 安全恢复
- `scripts/recovery-controller-v3.sh` - V3.0 智能恢复
- `scripts/predictive-engine.sh` - V3.5 预测引擎
- `scripts/daily-report.sh` - 每日报告

---

## 💡 使用模式

- 偏好简洁回复，避免冗余
- 重视代码审查和安全分析
- 需要时会要求详细解释
- 喜欢结构化的输出格式
- Phase 1阶段: 不干预系统，只记录和提交

---

### 2026-03-19
1. **OCNMPS Bridge v2 完成**: 从 2.6/5 提升到 4.8/5
2. **修复 4 个核心漏洞**: CODE边界、CN意图组、LONG前置纠偏、REASON中文意图组
3. **灰度集成就绪**: 可通过 `ocnmps_integration_config.py` 控制灰度比例
4. **完整闭环**: 路由 + 日志 + 日报 + 回退机制
5. **进入灰度运营阶段**: 30%起步，数据驱动扩容
6. **汇报体系统一**: Daily Digest 唯一入口，6套→1套
7. **决策闭环系统**: 异常检测 → 自动追问 → 决策建议，L5 自动运营
8. **7天验证实验启动**: 验证"系统是否改变行为"
9. **证据驱动补证体系建立**:
   - 台账 → 看级别
   - 全景汇报 → 看全貌
   - 证据缺口清单 → 推动升级
10. **4类证据模板**: 真实调用、端到端闭环、日志可追溯、异常/恢复验证

### 2026-03-21
1. **交易质量验证完成**: 46笔样本
2. **策略本质确认**: 尾部捕获策略 (Tail Capture Strategy)
   - 低胜率 (11.4%) + 高赔率
   - 99.8% 收益来自主动退出
3. **关键指标**:
   - Profit Factor: 3.23 ✅
   - Expectancy: +0.03% ✅
   - Edge 存在但极度脆弱
4. **连续亏损保护已添加**: 最大30笔暂停
5. **目标**: 100笔验证稳定性
6. **🚨 P0 生产级漏洞发现**: Position Control Failure
   - 系统在同一周期内重复开仓 (0.13→0.26 ETH)
   - 根因: 缺少 Position Gate (持仓门控)
   - 状态: 待修复 (等当前交易闭环)
   - 计划: V5.4 首要修复
7. **止损机制升级关键知识**:
   - ❌ 当前是"逻辑止损"(轮询触发) → 网络卡顿会失效
   - ✅ 必须是"订单级止损"(交易所托管) → 最安全
   - 关键参数: `reduceOnly=True` (防止反向开仓)
   - 止损数量 = 持仓数量 (必须绑定)
8. **V5.4 修复优先级**:
   - P0: Position Gate + 真实 Fill Pipeline
   - P1: 订单级止损 (交易所托管)
   - P2: Trailing Stop / Break-even Stop
9. **系统生存三原则**:
   - 不乱开仓 (Position Gate)
   - 不丢数据 (真实 Fill)
   - 不爆仓 (订单级止损)
10. **2026-03-21 首笔真实交易审计完成**:
    - 盈利: +$1.09 (+19.5%)
    - 执行链验证: ✅ 真实闭环
    - 市场连接: ✅ 滑点<0.01%
    - 问题: 叠仓 + 无订单级止损
    - 文档: `audit/TRADE_AUDIT_2026-03-21.md`
11. **V5.4 最小修复包（严格排序）**:
    - P0-1: Position Gate（防叠仓）→ 风险指数级放大
    - P0-2: Exit Source 记录 → Edge 审计基础
    - P1: 订单级止损 → 交易所托管
12. **系统阶段划分**:
    - 执行验证阶段 ✅ 完成
    - 控制验证阶段 🔜 V5.4
    - Edge 验证阶段 🔜 待启动
13. **V5.4 验收标准**:
    - 每笔 trade 必须包含: entry_price, exit_price, pnl, exit_source, position_size
    - 缺任何一个字段 → 不合格
14. **V5.4 三个隐藏坑**:
    - 坑1: Position Gate 误判 → OKX 返回 pos/contracts/positionAmt 多种字段，必须兼容
    - 坑2: 止损挂单失败 → 必须 try + fallback，否则你以为有止损其实没有
    - 坑3: Exit Source 误标 → 来源≠结果，不能根据 pnl 判断，要根据触发原因
15. **工程顺序修正**:
    - ❌ 错误顺序: Position Gate / Exit Source / Stop Loss
    - ✅ 正确顺序: Execution → Position State → Risk Binding
16. **V5.4 硬验收清单**:
    - 连续触发信号 → 只开 1 笔
    - 交易所订单列表 → 能看到止损单
    - 数据完整性 → 所有字段非零
    - 不允许 → pnl=0, exit=ticker长期, 多笔叠仓
17. **核心原则**:
    - V5.4 做完 ≠ 系统变强
    - V5.4 做完 = 系统变"可信"
18. **执行引擎禁用必须双断路**:
    - 逻辑断路: DISABLE_EXECUTION_ENGINE = True
    - 物理断路: stop() + = None
    - 单独 stop() 不安全 → 线程可能还在跑
19. **Position Gate 必须双层**:
    - 第一层: 本地状态 (self.current_position)
    - 第二层: 交易所状态 (get_position_size)
    - 两者都必须通过
    - 只检查字典 ≠ 真实仓位
20. **止损价格必须用真实成交价**:
    - ❌ estimated_price * 0.995 → 位置偏移
    - ✅ entry_price * 0.995 → 真实风险
21. **OKX 止损订单完整参数**:
    - stopPrice, reduceOnly, tdMode (cross/isolated)
    - 缺 tdMode 可能 silently fail
22. **Exit Source 需要 trigger_module**:
    - exit_source: STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL
    - trigger_module: 谁触发的 (便于 debug)
23. **当前风险等级**:
    - Execution 🟢 Data 🟢 Control 🟡 Risk 🔴
24. **修复顺序**:
    - Step 1: 执行入口（最危险）
    - Step 2: Position Gate（双层）
    - Step 3: 止损（真实 entry）
    - ❌ 不要调参数、优化策略、加功能
25. **两个隐性风险（关键）**:
    - 风险1: Position Gate 与执行之间有时间窗口 → 并发叠仓
    - 风险2: 止损单"成功提交 ≠ 真正存在" → OKX 可能静默失败
26. **执行锁 (execution_lock)**:
    - 必须加锁形成"原子化执行" (Critical Section)
    - 不加锁 → 未来一定会再次叠仓
    - 流程: 检查锁 → 加锁 → Gate → 执行 → 解锁
27. **止损二次验证**:
    - 提交后必须 fetch_open_orders 验证
    - 确认止损单真正存在
    - OKX 有概率返回成功但实际没挂上
28. **仓位限制**:
    - MAX_POSITION = 0.13 ETH（锁死单仓）
    - 当前余额 $13.86，杠杆 ≈ 40x+
    - 极端波动 → 账户清零风险
29. **V5.4 不可失败标准（最终版）**:
    - 同一时间只能有 1 个执行线程
    - 永远不会叠仓（除非设计允许）
    - 每一笔都有止损单（交易所可见）
    - 止损价格基于真实成交价
    - 所有 trade 数据完整（5 字段）
30. **进入 5 笔验证的条件**:
    - ✔ 双执行入口彻底关闭
    - ✔ execution_lock 已加
    - ✔ 止损验证机制存在
31. **系统骨架（最终成型）**:
    ```
    Signal → Decision Hub → 🔒Execution Lock → 🔒Position Gate(双层)
           → Execution → 🔒Stop Loss(交易所) → 二次验证
    ```
32. **Shadow Mode 认知纠正**:
    - Shadow ≠ Execution System
    - Shadow 验证的是信号/决策逻辑
    - 但问题在 Execution/Control/Risk 层
    - 205 笔 Shadow ≠ 1 笔真实交易验证
33. **系统真实评级**:
    - Strategy: 🟢 irrelevant
    - Decision: 🟢 irrelevant
    - Execution: 🟢 ⚠️
    - Control: 🔴 ❌ 禁止上线
    - Risk: 🔴 ❌ 禁止上线
34. **最大风险不是"没止损"，而是"多执行入口 + 叠仓 + 无锁"**
    - 这是"账户瞬间爆炸级风险"
35. **当前阶段**: SYSTEM SAFETY VALIDATION (系统安全验证)
    - 验证"系统不会犯致命错误"，不是验证策略有效
    - 优先级: 先解决"不会死"，再考虑"能不能赚"
36. **正确路径 (纠正后)**:
    - Step 1: 完成 V5.4 全部修复 (5项)
    - Step 2: 3 笔 Live Safety Test (不是 5 笔)
    - Step 3: 验收无叠仓/止损有效/数据完整
    - 通过后才允许扩大样本
37. **Live Safety Test 必须输出 6 字段**:
    - entry_price, exit_price, pnl, exit_source, position_size
    - stop_ok, stop_verified
38. **+$1.09 盈利的正确解读**:
    - ✅ 执行链正确
    - ❌ 风控无效 (叠仓)
    - ❌ 不能代表 Edge
    - 这笔盈利是"错误行为产生的"
39. **Single Source of Truth 已建立**:
    - `state_store.json` = 唯一真相源
    - 所有事件必须通过 `record_trade()` 写入
    - Dashboard 只能从 `state_store.to_dict()` 读取
40. **StateStore 三个关键修复**:
    - 🔒 文件锁：防止并发写入损坏数据
    - 📦 缓存：避免每次 API 都读取文件
    - 📊 区分：event（事件数）vs trade（交易数）
41. **StateStore 数据结构**:
    ```json
    {
      "total_events": 2,    // entry + exit
      "total_trades": 1,    // 仅 exit 算 trade
      "last_event": {...},  // 最近事件
      "last_trade": {...}   // 最近完整交易
    }
    ```
42. **Safety Test #1 失败 (2026-03-21 22:18)**:
    - 🔴 Position Gate 失效 → 叠仓 0.13 → 2.88 ETH
    - 🔴 TIME_EXIT 缺失 → 持仓 6 小时
    - 🔴 止损单不存在 → 裸奔
    - 结果: MANUAL 紧急平仓，亏损 -0.10%
43. **Safety Test 验收 5 项必测**:
    - Execution Lock: 无重复开仓
    - Position Gate: 单仓 0.13 ETH
    - Stop Loss: 存在且可查
    - TIME_EXIT: ≤ 30s 触发
    - Exit Source: 正确记录
44. **TIME_EXIT 必须由主循环控制**:
    - ❌ 线程版 → 多线程状态竞争
    - ✅ 主循环检查 → 单点控制
45. **止损强制验证**:
    ```python
    if not stop_result.get("stop_ok"):
        raise RuntimeError("STOP_LOSS_FAILED - SYSTEM_STOP")
    ```
    无止损 = 系统停止（不可运行）
46. **当前系统状态**: 🔴 不可上线
    - 需要重新验证 Safety Test

### 2026-03-22
1. **V5.4 修复开始**: 创建 `safe_execution_v54.py`
2. **PositionGate**: 双层检查（本地 + 交易所）
3. **StopLossManager**: 止损提交 + 二次验证
4. **SafeExecutionV54**: asyncio.Lock 原子化执行
5. **Safety Test 脚本**: `run_safety_test.py`
6. **验收标准**: 连续 3 笔通过 5 项检查
7. **系统阶段**: SYSTEM SAFETY VALIDATION
8. **核心原则**: 先解决"不会死"，再考虑"能不能赚"

### 2026-03-23
1. **OCNMPS 插件创建完成**: `~/.openclaw/plugins/ocnmps-router/`
2. **插件架构**: 
   - `plugin.js` - 主插件，注册 `message:preprocessed` hook
   - `ocnmps_bridge_v2.py` - Python 桥接脚本
   - `openclaw.plugin.json` - OpenClaw 插件 manifest
3. **接入路径**: `hook → Python bridge → applyModelOverrideToSessionEntry`
4. **灰度配置**: 30% 流量，一致性哈希
5. **模型映射**: CODE/REASON/LONG/CN → 对应模型

### 2026-03-24
1. **动态保证金控制器 V2 完成**:
   - `core/capital_controller_v2.py` 创建
   - 支持 equity/drawdown/edge/risk 联动
   - 输出 margin/notional/position_size/capital_state
2. **OKX API 完全绕过 ccxt**:
   - 开仓：`POST /api/v5/trade/order`
   - 止损单：`conditional` 类型 + `slTriggerPx`
   - 平仓：`POST /api/v5/trade/order`
   - 保护单清理：`POST /api/v5/trade/cancel-algos`
   - 余额查询：`GET /api/v5/account/balance`
3. **修复合约规格错误**:
   - ❌ 错误假设：1 张 = 10 ETH
   - ✅ 正确规格：1 张 = **0.1 ETH**
   - ✅ 最小张数：**0.01 张**
4. **Safety Test V5.4 全部通过 (3/3)**:
   - ✅ Execution Lock: 无重复开仓
   - ✅ Position Gate: 单仓控制
   - ✅ Stop Loss: 存在且可验证
   - ✅ TIME_EXIT: 30s 触发
   - ✅ Exit Source: 正确记录
5. **系统状态**: 🟢 **GO** - 系统安全验证通过
6. **第一阶段限制**: 单模型替换，不启用 chain
7. **验收标准**:
   - 真实请求进入 hook
   - Python bridge 被调用
   - gray_hit=true 时发生 modelOverride
   - 实际执行模型不再总是固定 primary
   - 路由日志里开始出现真实流量样本

---

## 🔄 2026-03-20 更新

### 🎉 里程碑：完整统一面板 V5.3 完成

**系统状态**: ✅ STEP_4_FULL_READY

### 统一入口（端口 8780）

整合所有功能到单一入口：
- 📊 主面板 - 总交易、盈亏、胜率、信号漏斗
- 🧬 演化引擎 - 参数演化、适应度追踪
- 📊 市场结构 - 趋势分析、波动性监控
- 🎯 决策追踪 - 决策统计、审批记录
- 🎮 控制中心 - GO/NO-GO、权重推进、紧急回退

### 核心文件

| 文件 | 行数 | 功能 |
|------|------|------|
| integrated_server.py | 376 | 统一服务器 |
| state_store.py | 285 | 状态存储 + GO Stability |
| control_flags.py | 142 | 权重推进 + 安全保护 |
| hybrid_controller.py | 320 | Hybrid 模式控制 |

### GO/NO-GO 逻辑修正

**唯一硬红线**: `over_aggressive > 0 → NO-GO`

**不影响 GO**: diff_rate、reduce_ratio、edge 弱

### 安全机制实现

| 机制 | 文件数 |
|------|--------|
| 回退机制 | 4 |
| 错误限制 | 3 |
| 激进检测 | 4 |

### 访问地址

| 类型 | 地址 |
|------|------|
| 本地 | http://localhost:8780/ |
| 公网 | https://unpersonal-currently-amberly.ngrok-free.dev/ |

### 系统检查结果

```
核心模块: 7/7 ✅
代码总量: 3,484 行 | 136 函数 | 36 类
安全机制: ✅ 完备
代码质量: ✅ 良好
GO Stability: 41/10 ✅ READY
```

### 归档

旧面板文件移至 `_archived_panels/`

---

_最后更新: 2026-03-20 20:35_