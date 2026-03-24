# 小龙自动交易系统 - 当前版本说明

**更新时间**: 2026-03-14 06:47  
**当前版本**: V3 Stable (OKX单交易所模式)  
**基线标记**: stable_20260314  
**状态**: 生产环境运行中

---

## 核心文件清单

### V3 主链 (当前运行版本)
| 文件 | 大小 | 说明 |
|------|------|------|
| auto_monitor_v3.py | 20KB | 多交易所监控主程序 |
| multi_exchange_adapter.py | 21KB | 多交易所适配器 (仅OKX模式) |
| execution_state_machine.py | 25KB | 执行状态机 |

### 启动/控制脚本
| 文件 | 大小 | 说明 |
|------|------|------|
| start_monitor.sh | 2.3KB | V3 启动脚本 |
| stop_v3_start_v2.sh | 1.1KB | V3->V2 回滚脚本 |
| run_monitor.sh | 992B | V2 启动脚本 (备用) |

### V2 回滚链
| 文件 | 大小 | 说明 |
|------|------|------|
| auto_monitor_v2.py | 16KB | V2 稳定版本 (回滚用) |

### 配置文件
| 文件 | 大小 | 说明 |
|------|------|------|
| trader_config.json | 204B | 交易配置 |
| symbols_config.json | 21B | 币种配置 |
| telegram_config.json | 511B | Telegram告警配置 |
| ~/.openclaw/secrets/multi_exchange_config.json | - | OKX API密钥配置 |

---

## 运行说明

### 启动 V3 (正常操作)
```bash
bash start_monitor.sh
```

### 查看实时日志
```bash
tail -f monitor_live.log
```

### 检查运行状态
```bash
ps aux | grep auto_monitor_v3
```

### 回滚到 V2 (紧急)
```bash
bash stop_v3_start_v2.sh
```

### 停止所有监控
```bash
pkill -f "auto_monitor"
```

---

## 版本历史

### stable_20260314 (当前)
- 修复: auto_monitor_v3.py 缩进语法错误
- 修复: telegram_alert.py 补全 send_system_alert 方法
- 修复: asyncio "This event loop is already running" 错误
- 修复: start_monitor.sh 移除旧 okx_api.json 检查
- 变更: 多交易所模式 -> 仅OKX单交易所模式
- 状态: 生产环境运行中

### V3 (2026-03-13)
- 22项检查通过版本
- 多交易所支持 (OKX + Binance备用)
- 自动故障转移

### V2 (2026-03-12)
- 稳定版本
- 单交易所
- 简单风控

---

## 注意事项

1. **不要修改核心文件**: auto_monitor_v3.py, multi_exchange_adapter.py, execution_state_machine.py
2. **配置在 secrets 目录**: ~/.openclaw/secrets/multi_exchange_config.json
3. **日志位置**: monitor_live.log
4. **回滚方案**: 使用 stop_v3_start_v2.sh 可快速回滚到 V2

---

*基线版本: stable_20260314*
*任何修改请先备份到 archive/20260314/ 目录*
