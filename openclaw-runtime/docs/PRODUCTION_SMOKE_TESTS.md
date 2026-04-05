# Production Smoke Tests

**阶段**: Wave 2-B: Production Readiness  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**依赖**: 
- FEATURE_FLAG_MATRIX.md ✅
- DEFAULT_ENABLEMENT_POLICY.md ✅
- GRAY10_OBSERVATION_PLAN.md ✅

---

## 一、测试概述

### 目的

定义生产环境部署后的**标准冒烟测试**流程，确保：
- 部署成功验证
- 核心功能正常
- 监控告警可用
- 回滚能力就绪

### 适用范围

| 场景 | 适用 | 说明 |
|------|------|------|
| Gray 10% 部署 | ✅ | 3 实例集群部署后 |
| 生产环境部署 | ✅ | 正式生产部署后 |
| 版本升级 | ✅ | 新版本部署后 |
| 回滚后验证 | ✅ | 回滚操作后 |
| 定期健康检查 | ✅ | 每日/每周例行 |

---

## 二、测试分类

### P0: 部署后立即执行

**触发条件**: 部署脚本完成  
**执行时间**: < 5 分钟  
**通过标准**: 所有检查项通过

| 测试 | 说明 | 优先级 |
|------|------|--------|
| 3 实例健康检查 | 所有实例 /health 通过 | P0 |
| Feature Flags 验证 | 默认配置正确 | P0 |
| 共享存储验证 | leases/, items/, suppression/ 可访问 | P0 |
| 监控端点验证 | /metrics 正常响应 | P0 |

### P1: 功能验证

**触发条件**: P0 测试通过  
**执行时间**: < 10 分钟  
**通过标准**: 核心功能正常

| 测试 | 说明 | 优先级 |
|------|------|--------|
| Triple-chain 查询 | Incident/Timeline/Audit 查询正常 | P1 |
| Stale cleanup 验证 | Stale 租约自动清理 | P1 |
| Snapshot 验证 | 状态快照正常生成 | P1 |
| 告警规则验证 | P0/P1 告警可触发 | P1 |

### P2: 压力与恢复

**触发条件**: P1 测试通过  
**执行时间**: < 30 分钟  
**通过标准**: 系统稳定

| 测试 | 说明 | 优先级 |
|------|------|--------|
| 并发请求测试 | 模拟多客户端并发 | P2 |
| 回滚演练 | 停止 → 恢复验证 | P2 |
| 故障注入测试 | 单实例故障转移 | P2 |
| 内存泄漏检查 | 运行 1h 内存增长 < 50MB | P2 |

---

## 三、P0 测试用例

### P0-1: 3 实例健康检查

**目的**: 验证所有实例正常启动并响应

**前置条件**:
- 部署脚本执行完成
- 3 实例进程运行中

**测试步骤**:
```bash
# 1. 检查实例进程
ps aux | grep "node dist/server" | grep -v grep

# 2. 检查健康端点
NO_PROXY=localhost curl -s http://localhost:3101/health
NO_PROXY=localhost curl -s http://localhost:3102/health
NO_PROXY=localhost curl -s http://localhost:3103/health

# 3. 验证响应
# 期望输出:
# {"ok":true,"status":"live","version":"production","timestamp":...}
```

**通过标准**:
- ✅ 3 实例进程存在
- ✅ 3 实例 /health 返回 HTTP 200
- ✅ 响应包含 `ok: true` 和 `status: live`

**失败处理**:
```
1. 检查实例日志：tail -100 logs/deploy/instance-X.log
2. 检查端口占用：lsof -i :3101
3. 重启失败实例：./scripts/deploy-local-prod.sh
```

---

### P0-2: Feature Flags 验证

**目的**: 验证默认配置正确加载

**前置条件**: P0-1 通过

**测试步骤**:
```bash
# 1. 获取配置
NO_PROXY=localhost curl -s http://localhost:3101/config | jq

# 2. 验证 Core 层
# 期望：所有 Core enabled = true
jq '.core.registry.enabled'  # true
jq '.core.lease.enabled'     # true
jq '.core.item.enabled'      # true
jq '.core.suppression.enabled'  # true

# 3. 验证 Module 层
# 期望：所有 Module enabled = true
jq '.modules.stale_cleanup.enabled'  # true
jq '.modules.snapshot.enabled'       # true
jq '.modules.health_monitor.enabled' # true
jq '.modules.metrics.enabled'        # true
jq '.modules.alerting.enabled'       # true

# 4. 验证 Plugin 层
# 期望：所有 Plugin enabled = false (Gray 10%)
jq '.plugins.github.enabled'   # false
jq '.plugins.jenkins.enabled'  # false
jq '.plugins.trading.enabled'  # false
```

**通过标准**:
- ✅ Core 层全部启用
- ✅ Module 层全部启用
- ✅ Plugin 层全部禁用 (Gray 10%)

**失败处理**:
```
1. 检查配置文件：cat config/production.json
2. 检查环境变量：env | grep RUNTIME_
3. 重启实例使配置生效
```

---

### P0-3: 共享存储验证

**目的**: 验证共享存储目录正确挂载并可访问

**前置条件**: P0-1 通过

**测试步骤**:
```bash
# 1. 检查目录存在
ls -la data/shared/leases/
ls -la data/shared/items/
ls -la data/shared/suppression/

# 2. 检查写权限
touch data/shared/leases/test-write && rm data/shared/leases/test-write

# 3. 检查实例访问
NO_PROXY=localhost curl -s http://localhost:3101/health | jq '.storage'
NO_PROXY=localhost curl -s http://localhost:3102/health | jq '.storage'
NO_PROXY=localhost curl -s http://localhost:3103/health | jq '.storage'
```

**通过标准**:
- ✅ leases/, items/, suppression/ 目录存在
- ✅ 所有实例可读写共享存储
- ✅ 无权限错误

**失败处理**:
```
1. 检查目录权限：ls -la data/shared/
2. 修复权限：chmod -R 755 data/shared/
3. 重启实例
```

---

### P0-4: 监控端点验证

**目的**: 验证 /metrics 端点正常响应

**前置条件**: P0-1 通过

**测试步骤**:
```bash
# 1. 获取指标
NO_PROXY=localhost curl -s http://localhost:3101/metrics

# 2. 验证关键指标存在
# 期望输出包含:
# - runtime_instance_info
# - runtime_health_status
# - runtime_lease_count
# - runtime_item_count
# - runtime_suppression_count

# 3. 验证 Prometheus 抓取
# 配置 prometheus.yml 后验证:
# http://localhost:9090/targets
```

**通过标准**:
- ✅ /metrics 返回 HTTP 200
- ✅ 包含所有核心指标
- ✅ Prometheus 可抓取目标

**失败处理**:
```
1. 检查 metrics 配置：jq '.modules.metrics' config/production.json
2. 检查端口占用：lsof -i :9090
3. 验证 prometheus.yml 配置
```

---

## 四、P1 测试用例

### P1-1: Triple-chain 查询验证

**目的**: 验证 Incident/Timeline/Audit 三链查询正常

**前置条件**: P0 测试全部通过

**测试步骤**:
```bash
# 1. 查询 Incident 列表
NO_PROXY=localhost curl -s "http://localhost:3101/api/v1/incidents?limit=10"

# 2. 查询 Timeline 事件
NO_PROXY=localhost curl -s "http://localhost:3101/api/v1/timeline?limit=10"

# 3. 查询 Audit 日志
NO_PROXY=localhost curl -s "http://localhost:3101/api/v1/audit?limit=10"

# 4. 三链联合查询 (如有)
NO_PROXY=localhost curl -s "http://localhost:3101/api/v1/triple-chain/query?query=incident-1"
```

**通过标准**:
- ✅ Incident 查询返回数据
- ✅ Timeline 查询返回数据
- ✅ Audit 查询返回数据
- ✅ 三链查询正常关联

**失败处理**:
```
1. 检查数据目录：ls -la data/*/
2. 检查仓库初始化：grep "Repository" logs/deploy/instance-1.log
3. 验证 API 路由：curl http://localhost:3101/
```

---

### P1-2: Stale Cleanup 验证

**目的**: 验证 Stale 租约自动清理功能正常

**前置条件**: P0 测试全部通过

**测试步骤**:
```bash
# 1. 检查 Stale cleanup 配置
NO_PROXY=localhost curl -s http://localhost:3101/config | jq '.modules.stale_cleanup'

# 2. 创建测试租约 (模拟 stale)
# 手动创建过期租约文件

# 3. 等待清理周期 (默认 60s)
sleep 65

# 4. 验证清理结果
ls -la data/shared/leases/
NO_PROXY=localhost curl -s http://localhost:3101/metrics | grep stale_cleanup
```

**通过标准**:
- ✅ Stale cleanup 已启用
- ✅ 过期租约被清理
- ✅ 清理指标正常更新

**失败处理**:
```
1. 检查配置：jq '.modules.stale_cleanup' config/production.json
2. 检查清理日志：grep "stale" logs/deploy/instance-1.log
3. 手动触发清理：curl -X POST http://localhost:3101/api/v1/stale-cleanup/run
```

---

### P1-3: Snapshot 验证

**目的**: 验证状态快照正常生成

**前置条件**: P0 测试全部通过

**测试步骤**:
```bash
# 1. 检查 Snapshot 配置
NO_PROXY=localhost curl -s http://localhost:3101/config | jq '.modules.snapshot'

# 2. 检查快照目录
ls -la data/snapshots/

# 3. 验证最新快照
cat data/snapshots/latest.json | jq

# 4. 验证快照指标
NO_PROXY=localhost curl -s http://localhost:3101/metrics | grep snapshot
```

**通过标准**:
- ✅ Snapshot 已启用
- ✅ 快照文件正常生成
- ✅ 快照包含完整状态

**失败处理**:
```
1. 检查配置：jq '.modules.snapshot' config/production.json
2. 检查目录权限：ls -la data/snapshots/
3. 手动触发快照：curl -X POST http://localhost:3101/api/v1/snapshot/run
```

---

### P1-4: 告警规则验证

**目的**: 验证 P0/P1 告警规则可正常触发

**前置条件**: P0 测试全部通过

**测试步骤**:
```bash
# 1. 检查告警配置
cat monitoring/alerts.yml | head -50

# 2. 验证告警端点
NO_PROXY=localhost curl -s http://localhost:3101/api/v1/alerting/rules

# 3. 模拟告警触发 (测试模式)
NO_PROXY=localhost curl -s -X POST http://localhost:3101/api/v1/alerting/test

# 4. 检查告警历史
NO_PROXY=localhost curl -s http://localhost:3101/api/v1/alerting/incidents?limit=10
```

**通过标准**:
- ✅ 告警规则已加载
- ✅ 告警端点正常响应
- ✅ 测试告警可触发

**失败处理**:
```
1. 检查 alerts.yml 语法：yamllint monitoring/alerts.yml
2. 检查告警服务日志：grep "alerting" logs/deploy/instance-1.log
3. 重启告警服务
```

---

## 五、P2 测试用例

### P2-1: 并发请求测试

**目的**: 验证系统在高并发下的稳定性

**前置条件**: P1 测试全部通过

**测试步骤**:
```bash
# 1. 安装 ab (Apache Bench)
brew install apache-benchmark  # macOS

# 2. 执行并发测试
ab -n 1000 -c 10 http://localhost:3101/health
ab -n 1000 -c 10 http://localhost:3101/api/v1/incidents
ab -n 1000 -c 10 http://localhost:3101/api/v1/timeline

# 3. 检查结果
# 期望：
# - Failed requests: 0
# - Time per request: < 100ms
# - Requests per second: > 100
```

**通过标准**:
- ✅ 失败请求数 = 0
- ✅ P99 延迟 < 200ms
- ✅ 吞吐量 > 100 req/s

**失败处理**:
```
1. 检查实例资源：top -pid $(cat pids/instance-1.pid)
2. 检查连接数：lsof -i :3101 | wc -l
3. 降低并发重试
```

---

### P2-2: 回滚演练

**目的**: 验证回滚流程可正常执行

**前置条件**: P1 测试全部通过

**测试步骤**:
```bash
# 1. 记录当前状态
NO_PROXY=localhost curl -s http://localhost:3101/health > /tmp/before-rollback.json

# 2. 执行回滚
./scripts/rollback-local.sh

# 3. 验证实例停止
ps aux | grep "node dist/server" | grep -v grep
# 期望：无输出

# 4. 验证健康检查失败
NO_PROXY=localhost curl -s http://localhost:3101/health
# 期望：连接拒绝

# 5. 执行恢复部署
./scripts/deploy-local-prod.sh

# 6. 验证恢复成功
NO_PROXY=localhost curl -s http://localhost:3101/health
# 期望：恢复正常
```

**通过标准**:
- ✅ 回滚后实例全部停止
- ✅ 健康检查失败 (预期)
- ✅ 恢复后实例全部正常
- ✅ 数据无丢失

**失败处理**:
```
1. 检查回滚日志：cat logs/rollback-*.log
2. 手动清理残留：rm pids/*.pid
3. 重新启动部署
```

---

### P2-3: 故障注入测试

**目的**: 验证单实例故障时的转移能力

**前置条件**: P1 测试全部通过，3 实例运行中

**测试步骤**:
```bash
# 1. 记录当前状态
NO_PROXY=localhost curl -s http://localhost:3101/health
NO_PROXY=localhost curl -s http://localhost:3102/health
NO_PROXY=localhost curl -s http://localhost:3103/health

# 2. 停止 instance-2
kill $(cat pids/instance-2.pid)

# 3. 验证实例-2 停止
NO_PROXY=localhost curl -s http://localhost:3102/health
# 期望：连接拒绝

# 4. 验证实例-1/3 仍正常
NO_PROXY=localhost curl -s http://localhost:3101/health
NO_PROXY=localhost curl -s http://localhost:3103/health
# 期望：正常响应

# 5. 恢复 instance-2
./scripts/deploy-local-prod.sh

# 6. 验证全部恢复
NO_PROXY=localhost curl -s http://localhost:3102/health
```

**通过标准**:
- ✅ 单实例故障不影响其他实例
- ✅ 健康实例继续正常服务
- ✅ 故障实例可恢复

**失败处理**:
```
1. 检查故障实例日志
2. 验证共享存储访问
3. 重新部署全部实例
```

---

### P2-4: 内存泄漏检查

**目的**: 验证系统运行 1 小时内存增长 < 50MB

**前置条件**: P1 测试全部通过

**测试步骤**:
```bash
# 1. 记录初始内存
ps aux | grep "node dist/server" | awk '{print $2, $6}' > /tmp/memory-before.txt

# 2. 运行 1 小时
sleep 3600

# 3. 记录最终内存
ps aux | grep "node dist/server" | awk '{print $2, $6}' > /tmp/memory-after.txt

# 4. 计算增长
diff /tmp/memory-before.txt /tmp/memory-after.txt

# 5. 验证指标
NO_PROXY=localhost curl -s http://localhost:3101/metrics | grep memory
```

**通过标准**:
- ✅ 内存增长 < 50MB/h
- ✅ 无持续增长趋势
- ✅ GC 正常执行

**失败处理**:
```
1. 检查内存指标：curl http://localhost:3101/metrics | grep memory
2. 分析堆快照：node --inspect dist/server.js
3. 联系开发团队
```

---

## 六、测试结果记录

### 测试报告模板

```markdown
# Smoke Test Report

**Date**: 2026-04-XX  
**Environment**: Gray 10% / Production  
**Tester**: [Name]  
**Duration**: [X] minutes

## P0 Tests

| Test | Status | Notes |
|------|--------|-------|
| 3 实例健康检查 | ✅ Pass / ❌ Fail | |
| Feature Flags 验证 | ✅ Pass / ❌ Fail | |
| 共享存储验证 | ✅ Pass / ❌ Fail | |
| 监控端点验证 | ✅ Pass / ❌ Fail | |

## P1 Tests

| Test | Status | Notes |
|------|--------|-------|
| Triple-chain 查询 | ✅ Pass / ❌ Fail | |
| Stale cleanup 验证 | ✅ Pass / ❌ Fail | |
| Snapshot 验证 | ✅ Pass / ❌ Fail | |
| 告警规则验证 | ✅ Pass / ❌ Fail | |

## P2 Tests

| Test | Status | Notes |
|------|--------|-------|
| 并发请求测试 | ✅ Pass / ❌ Fail | |
| 回滚演练 | ✅ Pass / ❌ Fail | |
| 故障注入测试 | ✅ Pass / ❌ Fail | |
| 内存泄漏检查 | ✅ Pass / ❌ Fail | |

## Summary

**P0**: X/4 Pass  
**P1**: X/4 Pass  
**P2**: X/4 Pass  

**Overall**: ✅ Pass / ❌ Fail

## Issues

[List any failures or concerns]

## Sign-off

- [ ] Tech Lead
- [ ] On-call
- [ ] PM
```

---

## 七、自动化脚本

### 冒烟测试脚本

```bash
#!/bin/bash
# scripts/smoke-test.sh

set -e

echo "=== Production Smoke Tests ==="
echo "Date: $(date)"
echo ""

# P0 Tests
echo "=== P0 Tests ==="
./scripts/smoke-test-p0.sh

# P1 Tests
echo "=== P1 Tests ==="
./scripts/smoke-test-p1.sh

# P2 Tests (optional)
if [ "$1" == "--full" ]; then
    echo "=== P2 Tests ==="
    ./scripts/smoke-test-p2.sh
fi

echo "=== Smoke Tests Complete ==="
```

---

## 八、Gray 10% 特殊要求

### 每日冒烟测试

**频率**: 每日 09:00  
**范围**: P0 + P1  
**执行人**: On-call

```bash
# 每日例行
./scripts/smoke-test.sh

# 结果发送到
# - #gray10-observation Slack channel
# - Daily report email
```

### 事件触发测试

**触发条件**:
- 配置修改后
- 告警触发后
- 性能异常后

**范围**: P0 + 相关 P1

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-06_  
_下次审查：Gray 10% 完成后_
