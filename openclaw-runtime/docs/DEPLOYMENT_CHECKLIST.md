# Gray 10% Deployment Checklist

**阶段**: Wave 2-B: Production Deployment  
**版本**: Phase 4.x Runtime v0.1.0  
**日期**: 2026-04-05  
**状态**: ⏳ **READY FOR DEPLOYMENT**

---

## 一、部署前检查

### 环境准备

- [ ] Docker 已安装并运行
- [ ] Docker Compose 已安装
- [ ] Node.js v24+ 已安装
- [ ] 构建完成 (`npm run build`)
- [ ] 磁盘空间 ≥ 10GB
- [ ] 内存 ≥ 2GB 可用

### 配置文件

- [ ] `.env.production` 已创建
- [ ] `docker-compose.prod.yml` 已配置
- [ ] `monitoring/prometheus.yml` 已配置
- [ ] `monitoring/alerts.yml` 已配置

### 测试验证

- [ ] B1 30/30 测试通过
- [ ] B2 21/21 测试通过
- [ ] B3 18/18 测试通过
- [ ] 本地运行 `npm test` 通过

---

## 二、部署执行

### Step 1: 运行部署脚本

```bash
cd ~/.openclaw/workspace/openclaw-runtime
./scripts/deploy-prod.sh
```

**预期输出**:
```
✓ All instances started
✓ All 3 instances are running
✓ Shared storage is accessible
Deployment Completed Successfully!
```

### Step 2: 验证实例状态

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查日志
docker-compose -f docker-compose.prod.yml logs runtime-instance-1
```

**预期状态**:
```
NAME                    STATUS
runtime-instance-1      Up (healthy)
runtime-instance-2      Up (healthy)
runtime-instance-3      Up (healthy)
prometheus              Up
grafana                 Up
```

### Step 3: 健康检查

```bash
# Instance 1
curl http://localhost:3001/health

# Instance 2
curl http://localhost:3002/health

# Instance 3
curl http://localhost:3003/health
```

**预期响应**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-05T14:00:00Z",
  "components": {
    "registry": {"status": "ok"},
    "lease_manager": {"status": "ok"},
    "item_coordinator": {"status": "ok"},
    "suppression_manager": {"status": "ok"}
  }
}
```

### Step 4: 验证共享存储

```bash
# 检查共享目录
ls -la ~/.openclaw/workspace/openclaw-runtime/data/shared

# 检查实例目录
ls -la ~/.openclaw/workspace/openclaw-runtime/data/instance-1
```

**预期**:
- `leases/` 目录存在
- `items/` 目录存在
- `suppression/` 目录存在

---

## 三、监控验证

### Prometheus

1. 访问：http://localhost:9090
2. 验证 targets: Status → Targets
3. 所有 runtime 实例应为 `UP` 状态

**查询验证**:
```promql
# 检查实例是否被 scrape
up{job=~"runtime-instance-.*"}

# 检查内存指标
process_resident_memory_bytes

# 检查请求指标
http_requests_total
```

### Grafana

1. 访问：http://localhost:3000
2. 登录：admin / admin123
3. 验证数据源：Configuration → Data Sources → Prometheus

**导入 Dashboard**:
- Runtime Overview (待创建)
- Instance Health (待创建)
- Alert Dashboard (待创建)

---

## 四、告警验证

### 告警规则验证

```bash
# 检查 Prometheus 告警规则
curl http://localhost:9090/api/v1/rules
```

**预期告警组**:
- `runtime_alerts` 已加载
- 7 条告警规则已配置

### 告警阈值确认

| 告警 | 阈值 | 严重性 |
|------|------|--------|
| HighErrorRate | > 1% (5min) | P0 |
| ServiceUnavailable | down (5min) | P0 |
| HighLatency | P99 > 500ms (10min) | P1 |
| HighMemoryGrowth | > 50MB/h (1h) | P1 |
| OwnerDriftDetected | > 0 | P1 |
| StaleCleanupFailure | > 0 (10min) | P1 |
| HighSnapshotGrowth | > 100KB/h (1h) | P2 |
| HighLogGrowth | > 200KB/h (1h) | P2 |

---

## 五、回滚演练

### 执行回滚

```bash
./scripts/rollback.sh
```

**预期输出**:
```
✓ All instances stopped
✓ Scaled down to 0 replicas
✓ Rollback completed successfully
```

### 回滚后验证

- [ ] 所有实例已停止
- [ ] 配置已回退（如有备份）
- [ ] 旧版本已恢复（如有备份）
- [ ] 健康检查通过

### 重新部署

```bash
./scripts/deploy-prod.sh
```

**验证**:
- [ ] 所有实例重新启动
- [ ] 健康检查通过
- [ ] 监控数据正常

---

## 六、Gate 1 准备

### 部署报告

完成以下报告：

- [ ] 部署时间戳
- [ ] 实例状态截图
- [ ] 健康检查响应
- [ ] 监控面板截图
- [ ] 告警规则验证

### 审查材料

- [ ] WAVE_2B_READINESS_REVIEW.md
- [ ] PHASE_4xB3_COMPLETION.md
- [ ] 部署检查清单（本文档）
- [ ] 回滚演练记录

### 会议安排

- [ ] 确定 Gate 1 会议时间
- [ ] 邀请参与者 (Tech Lead + PM + On-call)
- [ ] 准备演示材料
- [ ] 准备决策记录模板

---

## 七、签署

| 角色 | 姓名 | 日期 | 签署 |
|------|------|------|------|
| Deployer | - | 2026-04-05 | ⏳ |
| Tech Lead | - | 2026-04-05 | ⏳ |
| On-call | - | 2026-04-05 | ⏳ |

---

_文档版本：1.0 (Ready)_  
_最后更新：2026-04-05_  
_下次审查：部署完成后_
