# Full Mode P2 Isolated Execution Checklist

**阶段**: Wave 2-B: Gray 10% → Gate 2 Preparation  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**目的**: 定义 Full Mode P2 测试的隔离执行标准与验收流程

---

## 一、概述

### 目的

明确**Full Mode P2 测试的隔离执行要求**，确保高风险验证不污染 Gray 10% 观察结果。

### 适用范围

- Gate 2 决策前验证
- 生产就绪验证
- 高风险测试场景

### 核心原则

| 原则 | 说明 |
|------|------|
| **隔离执行** | 独立环境，不影响 Gray 10% |
| **可回滚** | 所有测试可快速回滚 |
| **可追溯** | 完整审计日志 |
| **风险分级** | Blocker/Warning/Informational |

---

## 二、隔离环境要求

### 环境隔离

| 要求 | Gray 10% 集群 | Full Mode P2 隔离环境 |
|------|-------------|---------------------|
| 实例 | 3 实例 (3101-3103) | 独立 3 实例 (3201-3203) |
| 端口 | BASE_PORT=3101 | BASE_PORT=3201 |
| 存储 | `storage/instance-{1,2,3}/` | `storage-p2-test/instance-{1,2,3}/` |
| 日志 | `logs/deploy/` | `logs-p2-test/` |
| 配置 | `config/runtime.json` | `config/p2-test.json` |
| PID 文件 | `pids/` | `pids-p2-test/` |

### 网络隔离

| 要求 | 说明 |
|------|------|
| 独立端口范围 | 3201-3203 (不与 3101-3103 冲突) |
| 独立 API Key | 测试环境 API Key，非生产 Key |
| 独立数据库 | 测试数据库，非生产数据库 |
| 独立告警通道 | 测试告警通道，不影响生产告警 |

### 数据隔离

| 要求 | 说明 |
|------|------|
| 测试数据 | 使用测试账户/测试数据 |
| 数据备份 | 测试前备份，测试后恢复 |
| 数据清理 | 测试后清理测试数据 |

### 禁止事项

| 禁止项 | 原因 |
|--------|------|
| ❌ 连接生产共享存储 | 可能污染生产数据 |
| ❌ 影响 Gray 10% 运行实例 | 污染观察结果 |
| ❌ 使用生产 API Key | 安全风险 |
| ❌ 发送生产告警 | 告警噪音 |
| ❌ 修改生产配置 | 配置污染 |

---

## 三、执行前准备

### 配置快照

**执行命令**:
```bash
# 备份当前配置
cp config/runtime.json config/p2-test.json.bak

# 记录配置哈希
sha256sum config/runtime.json > config/p2-test-config-hash.txt
```

**检查清单**:
- [ ] 配置文件已备份
- [ ] 配置哈希已记录
- [ ] 测试配置已准备

### 数据备份

**执行命令**:
```bash
# 备份存储目录
cp -r storage/ storage-p2-test-backup/

# 备份数据库 (如适用)
pg_dump -h localhost -U user dbname > storage-p2-test-backup/db-backup.sql
```

**检查清单**:
- [ ] 存储目录已备份
- [ ] 数据库已备份 (如适用)
- [ ] 备份验证通过

### 测试账户/测试数据

**准备项**:
- [ ] 测试账户已创建
- [ ] 测试数据已准备
- [ ] 测试数据已导入

### 回滚脚本

**脚本内容**:
```bash
#!/bin/bash
# scripts/rollback-p2-test.sh

set -e

echo "Rolling back P2 test..."

# 停止测试实例
bash scripts/stop-p2-test.sh

# 恢复存储
rm -rf storage/
cp -r storage-p2-test-backup/ storage/

# 恢复配置
cp config/p2-test.json.bak config/runtime.json

# 清理测试目录
rm -rf storage-p2-test/
rm -rf logs-p2-test/
rm -rf pids-p2-test/

echo "Rollback complete"
```

**检查清单**:
- [ ] 回滚脚本已准备
- [ ] 回滚脚本已测试
- [ ] 回滚时间 < 5min

### 观察窗口

**建议时间**:
- **时间段**: 非高峰时段 (02:00-06:00)
- **时长**: 2-4 小时
- **人员**: On-call + Tech Lead

**检查清单**:
- [ ] 观察窗口已预约
- [ ] 负责人已确认
- [ ] 告警通道已配置

### 负责人

| 角色 | 姓名 | 职责 |
|------|------|------|
| **执行负责人** | [姓名] | 测试执行 |
| **技术负责人** | Tech Lead | 技术决策 |
| **On-call** | [姓名] | 监控与告警 |
| **审批人** | PM/Tech Lead | 测试审批 |

**检查清单**:
- [ ] 所有角色已分配
- [ ] 联系方式已确认
- [ ] 审批已完成

---

## 四、测试项清单

### 1. 存储写入验证

**测试内容**:
- 大量数据写入
- 并发写入
- 写入后读取验证

**执行命令**:
```bash
bash scripts/smoke-test-p2.sh --full --test storage-write
```

**预期结果**:
- 写入成功
- 读取一致
- 无数据损坏

**风险等级**: 🟡 Warning

---

### 2. 优雅关闭验证

**测试内容**:
- 发送 SIGTERM 信号
- 等待连接 draining
- 验证数据持久化
- 重启后健康检查

**执行命令**:
```bash
# 优雅关闭
kill -TERM $(cat pids-p2-test/instance-1.pid)

# 等待关闭完成
sleep 30

# 重启
bash scripts/start-p2-test.sh instance-1

# 健康检查
curl -s http://localhost:3201/health | jq '.ok'
```

**预期结果**:
- 关闭时间 < 30s
- 数据无丢失
- 重启后健康

**风险等级**: 🟡 Warning

---

### 3. 故障注入

**测试内容**:
- 网络延迟注入
- CPU 压力注入
- 内存压力注入
- 磁盘 IO 压力注入

**执行命令**:
```bash
# 网络延迟 (使用 tc)
tc qdisc add dev lo root netem delay 100ms

# CPU 压力 (使用 stress)
stress --cpu 4 --timeout 60s

# 内存压力
stress --vm 2 --vm-bytes 500M --timeout 60s
```

**预期结果**:
- 系统降级但不崩溃
- 核心功能可用
- 压力释放后恢复

**风险等级**: 🔴 Blocker (必须通过)

---

### 4. 回滚动作

**测试内容**:
- 配置回滚
- 数据回滚
- 版本回滚

**执行命令**:
```bash
bash scripts/rollback-p2-test.sh
```

**预期结果**:
- 回滚时间 < 5min
- 回滚后状态一致
- 无残留数据

**风险等级**: 🔴 Blocker (必须通过)

---

### 5. 日志轮转

**测试内容**:
- 触发日志轮转
- 验证旧日志归档
- 验证新日志写入
- 验证日志完整性

**执行命令**:
```bash
# 触发日志轮转
kill -USR1 $(cat pids-p2-test/instance-1.pid)

# 验证归档
ls -lh logs-p2-test/*.log.*

# 验证完整性
grep "ERROR" logs-p2-test/*.log | wc -l
```

**预期结果**:
- 日志轮转成功
- 归档完整
- 新日志正常写入

**风险等级**: 🟡 Warning

---

### 6. 恢复后健康检查

**测试内容**:
- 所有实例健康
- 所有端点可访问
- 所有功能可用
- 性能指标正常

**执行命令**:
```bash
# 健康检查
for port in 3201 3202 3203; do
  curl -s http://localhost:$port/health | jq '.ok'
done

# 功能验证
bash scripts/smoke-test-p0.sh 3201
bash scripts/smoke-test-p1.sh 3201
```

**预期结果**:
- 所有实例健康
- 所有测试通过
- 性能指标正常

**风险等级**: 🔴 Blocker (必须通过)

---

## 五、验收标准

### Blocker (一票否决)

| 测试项 | 通过标准 | 失败后果 |
|--------|---------|---------|
| 故障注入 | 系统不崩溃，核心功能可用 | Gate 2 不通过 |
| 回滚动作 | 回滚时间 < 5min，状态一致 | Gate 2 不通过 |
| 恢复后健康检查 | 所有实例健康，所有测试通过 | Gate 2 不通过 |
| 数据一致性 | 无数据损坏，无数据丢失 | Gate 2 不通过 |

### Warning (需解释)

| 测试项 | 通过标准 | 失败后果 |
|--------|---------|---------|
| 存储写入验证 | 写入成功，读取一致 | 需解释原因 |
| 优雅关闭验证 | 关闭时间 < 30s，数据无丢失 | 需解释原因 |
| 日志轮转 | 轮转成功，归档完整 | 需解释原因 |
| 性能指标 | P99 < 500ms | 需解释原因 |

### Informational (仅供参考)

| 测试项 | 说明 |
|--------|------|
| 并发性能 | 记录最大并发数 |
| 资源使用 | 记录峰值内存/CPU |
| 日志量 | 记录日志生成速率 |

---

## 六、结果归档格式

### 日志归档

**目录结构**:
```
evidence/p2-full-mode-test/
├── logs/
│   ├── instance-1.log
│   ├── instance-2.log
│   ├── instance-3.log
│   └── test-execution.log
├── metrics/
│   ├── memory-usage.json
│   ├── cpu-usage.json
│   └── latency-percentiles.json
├── screenshots/
│   ├── health-check.png
│   ├── test-results.png
│   └── metrics-dashboard.png
├── test-results.json
├── summary.md
└── conclusion.md
```

### 测试结果表

**格式**:
```markdown
| 测试项 | 状态 | 耗时 | 备注 |
|--------|------|------|------|
| 存储写入验证 | ✅ Pass | 2min | - |
| 优雅关闭验证 | ✅ Pass | 1min | - |
| 故障注入 | ✅ Pass | 5min | - |
| 回滚动作 | ✅ Pass | 3min | - |
| 日志轮转 | ✅ Pass | 1min | - |
| 恢复后健康检查 | ✅ Pass | 2min | - |
```

### 异常记录

**格式**:
```markdown
## 异常记录

### 异常 1: [名称]

**时间**: 2026-04-06 03:00:00  
**严重性**: Blocker/Warning/Informational  
**描述**: [详细描述]  
**根因**: [根因分析]  
**解决**: [解决方法]  
**预防**: [预防措施]
```

### 结论摘要

**格式**:
```markdown
# Full Mode P2 测试结论

**执行时间**: 2026-04-06 02:00-06:00  
**执行环境**: Isolated (ports 3201-3203)  
**测试负责人**: [姓名]

## 测试结果

- **总测试项**: 6
- **通过**: 6
- **失败**: 0
- **警告**: 0

## 结论

✅ **Full Mode P2 测试通过**

所有 Blocker 测试项通过，无 Warning 项。
系统具备生产就绪条件，建议进入 Gate 2 审查。

## 建议

1. [建议 1]
2. [建议 2]
3. [建议 3]
```

---

## 七、与 Gate 2 证据包集成

### 证据包内容

**必须包含**:
- [ ] `test-results.json` - 测试结果
- [ ] `summary.md` - 测试摘要
- [ ] `conclusion.md` - 结论
- [ ] `logs/` - 日志归档
- [ ] `metrics/` - 指标数据
- [ ] `screenshots/` - 截图证据

### 与 GATE2_PRECHECK.md 集成

**引用方式**:
```markdown
## P2 Full Mode 测试

**状态**: ✅ 通过  
**执行时间**: 2026-04-06  
**测试报告**: [evidence/p2-full-mode-test/summary.md](../evidence/p2-full-mode-test/summary.md)

### 关键结果

- 故障注入：✅ 通过
- 回滚动作：✅ 通过 (< 5min)
- 恢复后健康：✅ 通过
```

### 与 Gate 2 决策包集成

**提交清单**:
- [ ] GATE2_DECISION_TEMPLATE.md
- [ ] GRAY10_OBSERVATION_SUMMARY.md
- [ ] P0/P1/P2 冒烟测试结果
- [ ] **Full Mode P2 测试结果** (新增)
- [ ] 证据包 (含 Full Mode P2 归档)

---

## 八、执行流程

### 完整流程

```
1. 审批测试计划
       ↓
2. 准备隔离环境
       ↓
3. 执行前检查清单
       ↓
4. 执行测试项
       ↓
5. 记录结果
       ↓
6. 执行后清理
       ↓
7. 结果归档
       ↓
8. 提交 Gate 2 证据包
```

### 时间估算

| 阶段 | 耗时 |
|------|------|
| 准备隔离环境 | 30min |
| 执行前检查 | 15min |
| 执行测试项 | 60-90min |
| 执行后清理 | 15min |
| 结果归档 | 30min |
| **总计** | **2.5-3 小时** |

---

## 九、检查清单

### 执行前

- [ ] 隔离环境已准备
- [ ] 配置快照已完成
- [ ] 数据备份已完成
- [ ] 测试账户已准备
- [ ] 回滚脚本已测试
- [ ] 观察窗口已预约
- [ ] 负责人已确认
- [ ] 审批已完成

### 执行中

- [ ] 所有测试项已执行
- [ ] 结果已记录
- [ ] 异常已记录
- [ ] 截图已保存

### 执行后

- [ ] 结果已归档
- [ ] 环境已清理
- [ ] 数据已恢复 (如需要)
- [ ] 结论已生成
- [ ] Gate 2 证据包已更新

---

## 十、附录

### 隔离环境启动脚本

```bash
#!/bin/bash
# scripts/start-p2-test.sh

set -e

BASE_PORT=3201
INSTANCE_COUNT=3

echo "Starting P2 test environment..."

for i in $(seq 1 $INSTANCE_COUNT); do
  port=$((BASE_PORT + i - 1))
  
  echo "Starting instance-$i on port $port..."
  
  RUNTIME_PORT=$port \
  RUNTIME_LOG_LEVEL=debug \
  RUNTIME_CONFIG_FILE=config/p2-test.json \
  node dist/server.js &
  
  echo $! > pids-p2-test/instance-$i.pid
done

echo "Waiting for instances to be healthy..."
sleep 10

for i in $(seq 1 $INSTANCE_COUNT); do
  port=$((BASE_PORT + i - 1))
  curl -s http://localhost:$port/health | jq '.ok'
done

echo "P2 test environment started"
```

### 隔离环境停止脚本

```bash
#!/bin/bash
# scripts/stop-p2-test.sh

set -e

BASE_PORT=3201
INSTANCE_COUNT=3

echo "Stopping P2 test environment..."

for i in $(seq 1 $INSTANCE_COUNT); do
  pid_file="pids-p2-test/instance-$i.pid"
  
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    echo "Stopping instance-$i (PID: $pid)..."
    kill -TERM "$pid" || true
    rm "$pid_file"
  fi
done

echo "P2 test environment stopped"
```

---

_文档版本：1.0_  
_最后更新：2026-04-06_  
_下次审查：Full Mode P2 执行后_
