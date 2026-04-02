# 🐉 小龙智能交易系统 - 完整架构文档

**更新时间**: 2026-03-12 13:53  
**系统版本**: v2.0  
**文档类型**: 系统架构与分类  

---

## 📋 系统总览

```
小龙智能交易系统 v2.0
├── 核心交易层
├── 监控保护层
├── 数据同步层
└── 工具支持层
```

---

## 🎯 第一层：核心交易层

### 1.1 OKX API 客户端
**文件**: `okx_api_client.py`  
**作用**: 连接 OKX 合约 API  
**功能**:
- ✅ 获取实时行情
- ✅ 获取账户余额
- ✅ 获取持仓信息
- ✅ 创建/撤销订单
- ✅ 获取 K 线数据

**技术特点**:
- 基于 requests 库
- 自动签名验证
- 代理支持
- 错误重试

**关键方法**:
```python
client.fetch_time()           # 服务器时间
client.fetch_ticker(symbol)   # 行情
client.fetch_ohlcv(symbol)    # K 线
client.fetch_balance()        # 余额
client.fetch_positions()      # 持仓
client.create_order(...)      # 下单
client.cancel_order(...)      # 撤单
```

---

### 1.2 订单管理系统
**文件**: `order_manager.py`  
**作用**: 管理所有订单，强制止损保护  
**功能**:
- ✅ 强制止损验证
- ✅ 订单提交前检查
- ✅ 网络故障保护
- ✅ 紧急平仓机制

**核心规则**:
```
❌ 拒绝无止损订单
✅ 每笔订单必须设置止损
✅ 使用硬止损 (市价单)
✅ 止损比例≤0.5%
```

**配置文件**: `order_manager_config.json`

---

### 1.3 智能挂单系统
**文件**: `smart_order_manager.py`  
**作用**: 优化挂单和撤单策略  
**功能**:
- ✅ 分批挂单 (3 批)
- ✅ 动态定价
- ✅ 智能撤单
- ✅ 超时保护

**挂单策略**:
| 批次 | 价格偏移 | 资金分配 |
|------|----------|----------|
| 第 1 批 | -0.10% | 50% |
| 第 2 批 | -0.30% | 30% |
| 第 3 批 | -0.50% | 20% |

**配置文件**: `smart_order_config.json`

---

### 1.4 预测性信号系统
**文件**: `predictive_signal.py`  
**作用**: 预测即将发生的大波动  
**功能**:
- ✅ RSI 背离检测
- ✅ MACD 即将交叉
- ✅ 布林带收口
- ✅ 成交量异常
- ✅ 订单簿预测
- ✅ 资金费率预测

**配置文件**: `predictive_config.json`

---

## 🛡️ 第二层：监控保护层

### 2.1 智能监控系统
**文件**: `auto_monitor_fixed.py`  
**作用**: 24 小时监控市场  
**功能**:
- ✅ 60 秒检查一次市场
- ✅ 计算技术指标
- ✅ 生成交易信号
- ✅ 发送 Telegram 告警
- ✅ 同步 Notion 数据

**监控频率**:
- 价格检查：60 秒/次
- 指标计算：60 秒/次
- 信号生成：实时
- 持仓监控：10 秒/次

**日志文件**: `monitor_live.log`

---

### 2.2 系统健康检查
**文件**: `system_health_check.py`  
**作用**: 每 5 分钟检查系统健康  
**功能**:
- ✅ 检查所有进程
- ✅ 检查 API 连通性
- ✅ 检查代理连通性
- ✅ 自动修复问题
- ✅ 生成健康报告

**检查频率**: 300 秒 (5 分钟)

**检查项目**:
- auto_monitor 进程
- ClashX 进程
- 代理连通性
- OKX API
- Notion API

**输出文件**:
- `health_check.log` - 检查日志
- `system_status.json` - 系统状态
- `health_report.json` - 健康报告

---

### 2.3 进程守护系统 ⭐
**文件**: `process_guardian.py`  
**作用**: 60 秒检查一次，确保进程不中断  
**功能**:
- ✅ 60 秒检查一次进程
- ✅ 进程崩溃自动重启
- ✅ API 失败自动处理
- ✅ 日志异常监控
- ✅ 重启次数限制

**监控频率**: 60 秒 (比健康检查更快)

**保护对象**:
- auto_monitor_fixed.py (关键)
- ClashX (关键)

**输出文件**:
- `guardian.log` - 守护日志
- `guardian_status.json` - 守护状态

---

## 📊 第三层：数据同步层

### 3.1 Notion 数据同步
**文件**: `notion_trading_dashboard.py` (创建中)  
**作用**: 同步交易数据到 Notion  
**功能**:
- ✅ 实时更新账户数据
- ✅ 记录交易历史
- ✅ 性能统计
- ✅ 收益曲线

**Notion 页面**: 
https://www.notion.so/32071d2818c48035919ffbdd05eea938

**数据库**:
- 💰 交易记录 (13 字段)
- 📡 信号记录 (8 字段)
- 📈 性能统计 (10 字段)

---

### 3.2 Telegram 告警
**文件**: `telegram_alert.py`  
**作用**: 实时推送重要告警  
**功能**:
- ✅ STRONG_BUY/SELL信号
- ✅ 黑天鹅 RED 警报
- ✅ 止损触发通知
- ✅ 每日交易总结

**配置**:
- Chat ID: 5885419859
- Bot Token: 已配置

**配置文件**: `telegram_config.json`

---

## 🔧 第四层：工具支持层

### 4.1 系统启动脚本
**文件**: `start_trading_system.py`  
**作用**: 一键启动整个系统  
**功能**:
- ✅ 设置代理环境变量
- ✅ 测试 API 连接
- ✅ 启动监控系统
- ✅ 启动守护进程

**使用方式**:
```bash
python3 start_trading_system.py
```

---

### 4.2 API 连接检查
**文件**: `check_okx_connection.py`  
**作用**: 诊断 API 连接问题  
**功能**:
- ✅ 测试公共 API
- ✅ 测试私有 API
- ✅ 测试网络连接
- ✅ 生成诊断报告

**使用方式**:
```bash
python3 check_okx_connection.py
```

---

### 4.3 限价单交易系统
**文件**: `limit_order_trading.py`  
**作用**: 限价单挂单交易  
**功能**:
- ✅ 日常使用限价单
- ✅ 紧急情况市价单
- ✅ 节省 60% 手续费

**配置文件**: `trading_config.json`

---

## 📄 配置文件汇总

| 文件 | 作用 | 所属系统 |
|------|------|----------|
| `okx_api.json` | OKX API 配置 | 核心交易层 |
| `order_manager_config.json` | 订单管理配置 | 核心交易层 |
| `smart_order_config.json` | 挂单策略配置 | 核心交易层 |
| `predictive_config.json` | 预测信号配置 | 核心交易层 |
| `trading_config.json` | 交易配置 | 核心交易层 |
| `telegram_config.json` | Telegram 配置 | 数据同步层 |
| `notion_config.json` | Notion 配置 | 数据同步层 |

---

## 📊 日志文件汇总

| 文件 | 说明 | 更新频率 |
|------|------|----------|
| `monitor_live.log` | 监控系统日志 | 实时 |
| `health_check.log` | 健康检查日志 | 5 分钟/次 |
| `guardian.log` | 进程守护日志 | 60 秒/次 |
| `guardian_status.json` | 守护状态 | 60 秒/次 |
| `system_status.json` | 系统状态 | 5 分钟/次 |
| `health_report.json` | 健康报告 | 5 分钟/次 |

---

## 🎯 系统启动顺序

### 正常启动流程

```
1. 启动进程守护系统
   ↓
   process_guardian.py (PID: 守护进程)
   ↓
2. 守护系统启动监控系统
   ↓
   auto_monitor_fixed.py (PID: 监控进程)
   ↓
3. 健康检查系统自动启动
   ↓
   system_health_check.py (PID: 健康检查)
   ↓
4. 所有系统正常运行
   ↓
   ✅ 60 秒检查一次 (守护)
   ✅ 5 分钟检查一次 (健康)
   ✅ 60 秒监控市场 (监控)
```

---

## 🛡️ 保护机制层级

### 第一层保护：进程守护 (60 秒)
- 最快响应
- 进程崩溃立即重启
- API 失败自动处理

### 第二层保护：健康检查 (5 分钟)
- 全面健康检查
- 所有组件检查
- 生成详细报告

### 第三层保护：监控系统自身
- 内置错误处理
- 自动重试机制
- 日志记录

---

## 📋 完整文件清单

### 核心交易层 (5 个文件)
```
okx_api_client.py              # OKX API 客户端 ⭐⭐⭐⭐⭐
order_manager.py               # 订单管理系统 ⭐⭐⭐⭐⭐
smart_order_manager.py         # 智能挂单系统 ⭐⭐⭐⭐
predictive_signal.py           # 预测信号系统 ⭐⭐⭐⭐
limit_order_trading.py         # 限价单交易 ⭐⭐⭐⭐
```

### 监控保护层 (3 个文件)
```
auto_monitor_fixed.py          # 智能监控系统 ⭐⭐⭐⭐⭐
system_health_check.py         # 健康检查系统 ⭐⭐⭐⭐⭐
process_guardian.py            # 进程守护系统 ⭐⭐⭐⭐⭐
```

### 数据同步层 (2 个文件)
```
telegram_alert.py              # Telegram 告警 ⭐⭐⭐⭐
notion_trading_dashboard.py    # Notion 同步 ⭐⭐⭐⭐
```

### 工具支持层 (3 个文件)
```
start_trading_system.py        # 系统启动 ⭐⭐⭐⭐
check_okx_connection.py        # API 检查 ⭐⭐⭐
fix_okx_api.py                 # API 修复 ⭐⭐
```

### 配置文件 (7 个)
```
okx_api.json                   # OKX 配置 ⭐⭐⭐⭐⭐
order_manager_config.json      # 订单配置 ⭐⭐⭐⭐
smart_order_config.json        # 挂单配置 ⭐⭐⭐⭐
predictive_config.json         # 预测配置 ⭐⭐⭐
trading_config.json            # 交易配置 ⭐⭐⭐
telegram_config.json           # Telegram 配置 ⭐⭐⭐⭐
notion_config.json             # Notion 配置 ⭐⭐⭐
```

### 日志文件 (6 个)
```
monitor_live.log               # 监控日志 ⭐⭐⭐⭐⭐
health_check.log               # 健康日志 ⭐⭐⭐⭐
guardian.log                   # 守护日志 ⭐⭐⭐⭐⭐
guardian_status.json           # 守护状态 ⭐⭐⭐⭐
system_status.json             # 系统状态 ⭐⭐⭐⭐
health_report.json             # 健康报告 ⭐⭐⭐
```

---

## 🎯 快速命令索引

### 启动系统
```bash
# 一键启动
python3 start_trading_system.py

# 单独启动守护
python3 process_guardian.py

# 单独启动监控
python3 auto_monitor_fixed.py
```

### 查看状态
```bash
# 查看守护状态
cat guardian_status.json | python3 -m json.tool

# 查看系统状态
cat system_status.json | python3 -m json.tool

# 查看健康报告
cat health_report.json | python3 -m json.tool
```

### 查看日志
```bash
# 实时监控日志
tail -f monitor_live.log

# 守护日志
tail -f guardian.log

# 健康日志
tail -f health_check.log
```

### 停止系统
```bash
# 停止所有
pkill -f process_guardian
pkill -f system_health
pkill -f auto_monitor

# 或一键停止
pkill -f python3
```

---

## 🎊 系统架构图

```
┌─────────────────────────────────────────────────┐
│              用户界面层                          │
│  Notion 仪表盘 | Telegram 告警 | 日志文件        │
└─────────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────────┐
│              监控保护层                          │
│  进程守护 (60 秒) | 健康检查 (5 分钟)            │
│  auto_monitor_fixed.py                          │
└─────────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────────┐
│              核心交易层                          │
│  OKX API | 订单管理 | 智能挂单 | 预测信号        │
│  okx_api_client.py                              │
│  order_manager.py                               │
│  smart_order_manager.py                         │
│  predictive_signal.py                           │
└─────────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────────┐
│              网络层                              │
│  代理：http://127.0.0.1:7890 (ClashX)          │
└─────────────────────────────────────────────────┘
```

---

## 🎯 系统特点总结

### 核心交易层
- ✅ 专业 API 客户端
- ✅ 强制止损保护
- ✅ 智能挂单优化
- ✅ 预测性信号

### 监控保护层
- ✅ 60 秒快速检查
- ✅ 5 分钟全面检查
- ✅ 自动修复能力
- ✅ 双重保护机制

### 数据同步层
- ✅ Notion 实时同步
- ✅ Telegram 实时告警
- ✅ 多平台支持

### 工具支持层
- ✅ 一键启动
- ✅ 诊断工具
- ✅ 修复工具

---

**🎉 系统整理完成！所有系统已清晰归类！** 📚🐉

**完整文档**: `/Users/colin/.openclaw/workspace/SYSTEM_ARCHITECTURE.md`
