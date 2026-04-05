# Default Enablement Policy

**阶段**: Wave 2-B: Runtime Defaultization  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**依赖**: CORE_MODULE_PLUGIN_CLASSIFICATION.md ✅

---

## 一、政策概述

### 目的

定义 OpenClaw Runtime 各组件的**默认启用策略**，明确：
- 哪些组件默认启用
- 哪些组件按环境启用
- 哪些组件必须显式开关
- 哪些配置可动态修改

### 适用范围

| 环境 | 适用策略 | 说明 |
|------|---------|------|
| 单实例开发 | Local Dev | 功能完整，性能优先 |
| 多实例测试 | Multi-Instance Test | 协调协议完整验证 |
| Gray 10% | Gray 10% | 观察期策略 |
| 生产环境 | Production | 稳定性优先 |

---

## 二、Core 层默认策略

### 启用策略

**所有环境**: ✅ **始终启用** (不可禁用)

| 组件 | 默认启用 | 可禁用 | 动态修改 | 说明 |
|------|---------|--------|---------|------|
| InstanceRegistry | ✅ Yes | ❌ No | ❌ No | 实例注册与心跳 |
| LeaseManager | ✅ Yes | ❌ No | ❌ No | 租约生命周期管理 |
| WorkItemCoordinator | ✅ Yes | ❌ No | ❌ No | 工作项协调 |
| DuplicateSuppressionManager | ✅ Yes | ❌ No | ❌ No | 重复抑制 |

### 配置策略

**Core 层配置**: 🔒 **启动时固化**

| 配置项 | 修改方式 | 审批要求 | 说明 |
|--------|---------|---------|------|
| instanceIdFile | 重启生效 | Tech Lead | 实例身份文件路径 |
| dataDir | 重启生效 | Tech Lead | 数据目录 |
| heartbeatIntervalMs | 重启生效 | Tech Lead | 心跳间隔 |
| defaultTtlMs | 重启生效 | Tech Lead | 默认 TTL |
| maxTtlMs | 重启生效 | Tech Lead | 最大 TTL |

**Gray 10% 期间**: ❌ **禁止修改** Core 层配置

---

## 三、Module 层默认策略

### 启用策略

| 模块 | Local Dev | Multi-Instance | Gray 10% | Production | 说明 |
|------|-----------|----------------|----------|------------|------|
| StaleCleanupManager | ✅ | ✅ | ✅ | ✅ | Stale 租约清理 |
| SnapshotManager | ✅ | ✅ | ✅ | ✅ | 状态快照 |
| HealthMonitor | ✅ | ✅ | ✅ | ✅ | 健康监控 |
| MetricsCollector | ✅ | ✅ | ✅ | ✅ | 指标收集 |
| AlertingService | ⚠️ | ✅ | ✅ | ✅ | 告警服务 (Local 可选) |

### 配置策略

**Module 层配置**: ⚠️ **部分可动态修改**

| 配置项 | 默认值 | 动态修改 | 修改限制 | 说明 |
|--------|--------|---------|---------|------|
| stale_cleanup.enabled | true | ✅ Yes | 需记录 | 启用/禁用清理 |
| stale_cleanup.cleanupIntervalMs | 60000 | ✅ Yes | 10000-300000 | 清理间隔 |
| stale_cleanup.staleThresholdMs | 90000 | ✅ Yes | 60000-600000 | Stale 阈值 |
| snapshot.enabled | true | ✅ Yes | 需记录 | 启用/禁用快照 |
| snapshot.snapshotIntervalMs | 300000 | ✅ Yes | 60000-3600000 | 快照间隔 |
| snapshot.maxSnapshots | 10 | ✅ Yes | 1-100 | 最大快照数 |
| health_monitor.enabled | true | ✅ Yes | 需记录 | 启用/禁用监控 |
| metrics.enabled | true | ❌ No | 重启生效 | 启用/禁用指标 |
| metrics.collectIntervalMs | 10000 | ✅ Yes | 1000-60000 | 收集间隔 |
| alerting.enabled | true | ❌ No | 重启生效 | 启用/禁用告警 |

### Gray 10% 期间限制

| 模块 | 可修改配置 | 禁止修改配置 | 审批要求 |
|------|-----------|-------------|---------|
| StaleCleanup | cleanupIntervalMs, staleThresholdMs | enabled | 禁用需 Tech Lead |
| Snapshot | snapshotIntervalMs, maxSnapshots | enabled | 禁用需 Tech Lead |
| HealthMonitor | checkIntervalMs, reportIntervalMs | enabled | 禁用需 Tech Lead |
| Metrics | collectIntervalMs | enabled | 禁用需 PM + Tech Lead |
| Alerting | - | enabled, 阈值 | 任何修改需 PM + Tech Lead |

---

## 四、Plugin 层默认策略

### 启用策略

| 插件 | Local Dev | Multi-Instance | Gray 10% | Production | 说明 |
|------|-----------|----------------|----------|------------|------|
| GitHub Connector | ⚠️ Config | ⚠️ Config | ❌ Disabled | ⚠️ Config | GitHub 集成 |
| Jenkins Connector | ⚠️ Config | ⚠️ Config | ❌ Disabled | ⚠️ Config | Jenkins 集成 |
| CircleCI Connector | ⚠️ Config | ⚠️ Config | ❌ Disabled | ⚠️ Config | CircleCI 集成 |
| Trading Pack | ⚠️ Config | ❌ Disabled | ❌ Disabled | ⚠️ Config | 交易场景包 |
| Alerting Webhook | ⚠️ Config | ⚠️ Config | ⚠️ Config | ⚠️ Config | 告警 Webhook |

**Gray 10% 期间**: ❌ **所有 Plugin 默认禁用** (避免外部依赖干扰观察)

### 配置策略

**Plugin 层配置**: ✅ **可自由修改** (需记录)

| 配置项 | 默认值 | 动态修改 | 说明 |
|--------|--------|---------|------|
| enabled | false | ❌ No | 启用/禁用 (重启生效) |
| endpoint | - | ✅ Yes | API 端点 |
| timeout_ms | 30000 | ✅ Yes | 超时时间 |
| retry_count | 3 | ✅ Yes | 重试次数 |

### Plugin 启用审批流程

```
1. 提交启用申请 (JIRA/GitHub Issue)
   ↓
2. Tech Lead 审查 (依赖/风险评估)
   ↓
3. 独立测试验证
   ↓
4. PM 批准 (业务影响评估)
   ↓
5. 启用并记录
   ↓
6. 观察期 (7 天)
```

---

## 五、环境差异矩阵

### 单实例开发环境 (Local Dev)

| 层级 | 策略 | 说明 |
|------|------|------|
| Core | ✅ 全部启用 | 不可禁用 |
| Module | ✅ 全部启用 | 可自由调整配置 |
| Plugin | ⚠️ 按需启用 | 需记录 |

**特点**:
- 功能完整性优先
- 配置修改自由
- 无需审批

### 多实例测试环境 (Multi-Instance Test)

| 层级 | 策略 | 说明 |
|------|------|------|
| Core | ✅ 全部启用 | 不可禁用 |
| Module | ✅ 全部启用 | 配置修改需记录 |
| Plugin | ⚠️ 按需启用 | 需 Tech Lead 批准 |

**特点**:
- 协调协议完整验证
- 配置修改需记录
- Plugin 需审查

### Gray 10% 观察期

| 层级 | 策略 | 说明 |
|------|------|------|
| Core | ✅ 全部启用 | 🔒 禁止修改配置 |
| Module | ✅ 全部启用 | ⚠️ 配置修改需 Tech Lead |
| Plugin | ❌ 全部禁用 | ❌ 禁止启用 |

**特点**:
- 稳定性优先
- Core 配置冻结
- Module 配置受限
- Plugin 全部禁用

### 生产环境 (Production)

| 层级 | 策略 | 说明 |
|------|------|------|
| Core | ✅ 全部启用 | 🔒 禁止修改配置 |
| Module | ✅ 全部启用 | ⚠️ 配置修改需变更流程 |
| Plugin | ⚠️ 按需启用 | ✅ 需完整审批流程 |

**特点**:
- 稳定性第一
- 所有修改需变更流程
- Plugin 需完整验证

---

## 六、Feature Flag 管理

### Flag 分类

| 类别 | 动态修改 | 审批要求 | 示例 |
|------|---------|---------|------|
| **Type A** | ✅ Yes | 无需审批 | metrics.collectIntervalMs |
| **Type B** | ✅ Yes | 需记录 | stale_cleanup.enabled |
| **Type C** | ✅ Yes | Tech Lead | health_monitor.enabled |
| **Type D** | ❌ No (重启) | Tech Lead | Core 层配置 |
| **Type E** | ❌ No (重启) | PM + Tech Lead | Module enabled |
| **Type F** | ❌ No | Leadership | 核心协议语义 |

### Flag 修改流程

**Type A/B (自由修改)**:
```
修改 → 记录 → 完成
```

**Type C/D (Tech Lead)**:
```
修改申请 → Tech Lead 审查 → 修改 → 记录 → 观察
```

**Type E/F (高层审批)**:
```
修改申请 → Tech Lead 审查 → PM 批准 → 修改 → 记录 → 观察期 (7 天)
```

---

## 七、Gray 10% 期间特殊政策

### 冻结项

| 项目 | 状态 | 说明 |
|------|------|------|
| Core 配置 | 🔒 冻结 | 禁止任何修改 |
| Module enabled | 🔒 冻结 | 禁止禁用 |
| Plugin enabled | 🔒 冻结 | 禁止启用 |
| 告警阈值 | 🔒 冻结 | 禁止修改 |
| 健康检查端点 | 🔒 冻结 | 禁止修改 |

### 可调整项

| 项目 | 限制 | 审批 |
|------|------|------|
| Stale cleanup 间隔 | 10000-300000ms | Tech Lead |
| Snapshot 间隔 | 60000-3600000ms | Tech Lead |
| 指标收集间隔 | 1000-60000ms | Tech Lead |
| 日志级别 | INFO/DEBUG/WARN | On-call |

### 紧急修改流程

**P0 事件响应**:
```
1. On-call 识别问题
   ↓
2. Tech Lead 电话批准
   ↓
3. 执行修改
   ↓
4. 记录修改原因
   ↓
5. 事后审查 (24h)
```

---

## 八、配置审计

### 审计要求

| 环境 | 审计频率 | 负责人 |
|------|---------|--------|
| Local Dev | 无需审计 | - |
| Multi-Instance | 每周 | Tech Lead |
| Gray 10% | 每日 | On-call + Tech Lead |
| Production | 每次变更 | Tech Lead + PM |

### 审计内容

- [ ] 配置变更记录
- [ ] Feature Flag 状态
- [ ] 审批流程合规性
- [ ] 观察期执行情况

### 审计工具

```bash
# 查看当前配置
curl http://localhost:3101/config

# 查看 Feature Flags
curl http://localhost:3101/feature-flags

# 查看配置历史
cat logs/config-changes.log
```

---

## 九、例外处理

### 例外申请流程

```
1. 提交例外申请 (说明原因/风险/回滚方案)
   ↓
2. Tech Lead 审查
   ↓
3. PM 批准 (如涉及业务影响)
   ↓
4. Leadership 批准 (如冻结项)
   ↓
5. 执行并记录
   ↓
6. 观察期 (7 天)
   ↓
7. 事后审查
```

### 例外记录模板

```markdown
## Exception Record #XXX

**Date**: 2026-04-XX  
**Requester**: [Name]  
**Approved By**: [Name]

### Description
[例外描述]

### Reason
[申请原因]

### Risk Assessment
- Technical Risk: Low/Medium/High
- Business Risk: Low/Medium/High

### Rollback Plan
[回滚方案]

### Observation Period
[观察期安排]

### Post-Review
[事后审查结果]
```

---

## 十、签署

| 角色 | 姓名 | 日期 | 签署 |
|------|------|------|------|
| Tech Lead | - | 2026-04-06 | ⏳ |
| PM | - | 2026-04-06 | ⏳ |
| On-call | - | 2026-04-06 | ⏳ |

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-06_  
_下次审查：Gray 10% 完成后_
