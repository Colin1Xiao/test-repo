# Core / Module / Plugin Classification

**阶段**: Wave 2-B: Runtime Defaultization  
**日期**: 2026-04-05  
**状态**: 🟡 **DRAFT**

---

## 一、分类原则

### 分层定义

| 层级 | 定义 | 启用策略 | 示例 |
|------|------|---------|------|
| **Core** | 核心协调协议 | 始终启用 | Registry, Lease, Item, Suppression |
| **Module** | 增强功能模块 | 默认启用 | Stale Cleanup, Snapshot, Metrics |
| **Plugin** | 外部集成插件 | 按需启用 | GitHub, Jenkins, Trading |

---

## 二、Core 层 (核心协议)

### 组件清单

| 组件 | 职责 | 依赖 | 启用 |
|------|------|------|------|
| InstanceRegistry | 实例注册与心跳 | 无 | 必须 |
| LeaseManager | 租约生命周期管理 | Registry | 必须 |
| WorkItemCoordinator | 工作项协调 | LeaseManager | 必须 |
| DuplicateSuppressionManager | 重复抑制 | 无 | 必须 |

### 配置要求

```typescript
interface CoreConfig {
  registry: {
    instanceIdFile: string;      // 必须
    dataDir: string;             // 必须
    heartbeatIntervalMs: number; // 默认：30000
    autoHeartbeat: boolean;      // 默认：true
  };
  lease: {
    dataDir: string;             // 必须
    defaultTtlMs: number;        // 默认：30000
    maxTtlMs: number;            // 默认：300000
    autoCleanup: boolean;        // 默认：true
  };
  item: {
    dataDir: string;             // 必须
    defaultLeaseTtlMs: number;   // 默认：30000
    autoCleanup: boolean;        // 默认：true
  };
  suppression: {
    dataDir: string;             // 必须
    defaultTtlMs: number;        // 默认：60000
    scopeTtls: Record<string, number>;
    autoCleanup: boolean;        // 默认：true
    replaySafeMode: boolean;     // 默认：true
  };
}
```

### 默认启用策略

**Gray 10% 期间**:
- ✅ 所有 Core 组件必须启用
- ✅ 配置使用默认值
- ✅ 禁止动态修改核心参数

**生产环境**:
- ✅ 始终启用
- ⚠️ 修改需通过变更流程

---

## 三、Module 层 (增强功能)

### 组件清单

| 模块 | 职责 | 依赖 | 默认启用 |
|------|------|------|---------|
| StaleCleanupManager | Stale 租约清理 | LeaseManager | ✅ Yes |
| SnapshotManager | 状态快照 | Core | ✅ Yes |
| HealthMonitor | 健康监控 | Core | ✅ Yes |
| MetricsCollector | 指标收集 | Core | ✅ Yes |
| AlertingService | 告警服务 | Core | ✅ Yes |

### 配置要求

```typescript
interface ModulesConfig {
  stale_cleanup?: {
    enabled: boolean;            // 默认：true
    cleanupIntervalMs: number;   // 默认：60000
    staleThresholdMs: number;    // 默认：90000
  };
  snapshot?: {
    enabled: boolean;            // 默认：true
    snapshotIntervalMs: number;  // 默认：300000
    maxSnapshots: number;        // 默认：10
  };
  health_monitor?: {
    enabled: boolean;            // 默认：true
    checkIntervalMs: number;     // 默认：30000
    reportIntervalMs: number;    // 默认：60000
  };
  metrics?: {
    enabled: boolean;            // 默认：true
    collectIntervalMs: number;   // 默认：10000
    retentionHours: number;      // 默认：24
  };
}
```

### 默认启用策略

**Gray 10% 期间**:
- ✅ Stale Cleanup: 启用 (观察行为)
- ✅ Snapshot: 启用 (观察增长)
- ✅ Health Monitor: 启用 (基础监控)
- ✅ Metrics: 启用 (Prometheus 集成)
- ✅ Alerting: 启用 (P0/P1 告警)

**生产环境**:
- ✅ 默认全部启用
- ⚠️ 可按需禁用 (需评估影响)

---

## 四、Plugin 层 (外部集成)

### 组件清单

| 插件 | 职责 | 依赖 | 默认启用 |
|------|------|------|---------|
| GitHub Connector | GitHub 集成 | Core | ❌ No |
| Jenkins Connector | CI/CD 集成 | Core | ❌ No |
| CircleCI Connector | CI/CD 集成 | Core | ❌ No |
| Trading Pack | 交易场景包 | Core | ❌ No |
| Alerting Webhook | 告警 Webhook | Alerting | ⚠️ Config |

### 配置要求

```typescript
interface PluginsConfig {
  github?: {
    enabled: boolean;            // 默认：false
    endpoint?: string;
    timeout_ms?: number;         // 默认：30000
    retry_count?: number;        // 默认：3
  };
  jenkins?: {
    enabled: boolean;            // 默认：false
    endpoint?: string;
    timeout_ms?: number;
    retry_count?: number;
  };
  trading?: {
    enabled: boolean;            // 默认：false
    provider?: 'okx' | 'binance';
    testnet?: boolean;           // 默认：true
  };
}
```

### 默认启用策略

**Gray 10% 期间**:
- ❌ 所有 Connector 插件：禁用 (避免外部依赖)
- ❌ Trading Pack: 禁用 (独立验证)
- ⚠️ Alerting Webhook: 按需配置

**生产环境**:
- ⚠️ 按需启用
- ⚠️ 需独立配置和验证

---

## 五、Feature Flag 矩阵

### Core 层 Flags

| Flag | 默认值 | 动态修改 | 说明 |
|------|--------|---------|------|
| core.registry.enabled | true | false | 实例注册 |
| core.lease.enabled | true | false | 租约管理 |
| core.item.enabled | true | false | 工作项协调 |
| core.suppression.enabled | true | false | 重复抑制 |

### Module 层 Flags

| Flag | 默认值 | 动态修改 | 说明 |
|------|--------|---------|------|
| modules.stale_cleanup.enabled | true | true | Stale 清理 |
| modules.snapshot.enabled | true | true | 状态快照 |
| modules.health_monitor.enabled | true | true | 健康监控 |
| modules.metrics.enabled | true | true | 指标收集 |

### Plugin 层 Flags

| Flag | 默认值 | 动态修改 | 说明 |
|------|--------|---------|------|
| plugins.github.enabled | false | true | GitHub 集成 |
| plugins.jenkins.enabled | false | true | Jenkins 集成 |
| plugins.trading.enabled | false | true | 交易场景 |

---

## 六、Bootstrap 集成清单

### 装配顺序

```
1. Core 层 (必须全部成功)
   ├── InstanceRegistry
   ├── LeaseManager
   ├── WorkItemCoordinator
   └── DuplicateSuppressionManager

2. Module 层 (按配置启用)
   ├── StaleCleanupManager
   ├── SnapshotManager
   ├── HealthMonitor
   ├── MetricsCollector
   └── AlertingService

3. Plugin 层 (按配置启用)
   ├── GitHub Connector
   ├── Jenkins Connector
   └── Trading Pack
```

### 健康检查端点

```
GET /health
{
  "status": "healthy" | "degraded" | "unhealthy",
  "components": {
    "registry": {"status": "ok" | "degraded" | "error"},
    "lease_manager": {"status": "ok" | ...},
    "item_coordinator": {"status": "ok" | ...},
    "suppression_manager": {"status": "ok" | ...},
    "stale_cleanup": {"status": "ok" | "disabled"},
    "snapshot": {"status": "ok" | "disabled"},
    "health_monitor": {"status": "ok" | "disabled"},
    "metrics": {"status": "ok" | "disabled"}
  }
}
```

---

## 七、默认配置模板

### Gray 10% 配置

```typescript
const GRAY10_CONFIG = {
  core: {
    registry: {
      instanceIdFile: './data/instance_id.json',
      dataDir: './data/registry',
      heartbeatIntervalMs: 30000,
      autoHeartbeat: true,
    },
    lease: {
      dataDir: './data/shared/leases',
      defaultTtlMs: 30000,
      maxTtlMs: 300000,
      autoCleanup: true,
    },
    item: {
      dataDir: './data/shared/items',
      defaultLeaseTtlMs: 30000,
      autoCleanup: true,
    },
    suppression: {
      dataDir: './data/shared/suppression',
      defaultTtlMs: 60000,
      scopeTtls: { claim: 30000, complete: 60000 },
      autoCleanup: true,
      replaySafeMode: true,
    },
  },
  modules: {
    stale_cleanup: {
      enabled: true,
      cleanupIntervalMs: 60000,
      staleThresholdMs: 90000,
    },
    snapshot: {
      enabled: true,
      snapshotIntervalMs: 300000,
      maxSnapshots: 10,
    },
    health_monitor: {
      enabled: true,
      checkIntervalMs: 30000,
      reportIntervalMs: 60000,
    },
    metrics: {
      enabled: true,
      collectIntervalMs: 10000,
      retentionHours: 24,
    },
  },
  plugins: {
    // All disabled for Gray 10%
  },
};
```

---

## 八、变更管理

### Core 层变更

| 变更类型 | 审批 | 流程 |
|---------|------|------|
| 配置参数调整 | Tech Lead | 变更请求 + 测试验证 |
| 组件升级 | Tech Lead + PM | 完整回归测试 |
| 协议语义修改 | Leadership | RFC + 完整验证 |

### Module 层变更

| 变更类型 | 审批 | 流程 |
|---------|------|------|
| 启用/禁用 | On-call | 记录即可 |
| 配置参数调整 | Tech Lead | 测试验证 |
| 组件升级 | Tech Lead | 回归测试 |

### Plugin 层变更

| 变更类型 | 审批 | 流程 |
|---------|------|------|
| 启用/禁用 | On-call | 记录即可 |
| 配置参数调整 | Tech Lead | 独立验证 |
| 新增插件 | Tech Lead + PM | 完整测试 + 文档 |

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-05_  
_下次审查：Gray 10% 完成后_
