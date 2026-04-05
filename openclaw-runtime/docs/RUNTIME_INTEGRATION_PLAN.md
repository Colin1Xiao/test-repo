# Runtime Integration Plan

**阶段**: Wave 2-A: Runtime Integration  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: Phase 4.x-B1 ✅, Phase 4.x-B2 ✅

---

## 一、Core / Module / Plugin 三层归类

### Core (核心层)

**定义**: 系统运行必需的基础组件，默认启用，不可禁用

**组件**:
- InstanceRegistry (实例注册)
- LeaseManager (租约管理)
- WorkItemCoordinator (工作项协调)
- DuplicateSuppressionManager (去重抑制)
- InstanceRegistry (实例注册)

**配置**:
```json
{
  "core": {
    "enabled": true,
    "config": {
      "default_lease_ttl_ms": 30000,
      "default_item_lease_ttl_ms": 30000,
      "suppression_scopes": {
        "alert_ingest": { "ttl_ms": 60000 },
        "work_item_claim": { "ttl_ms": 30000 }
      }
    }
  }
}
```

---

### Module (模块层)

**定义**: 可选功能模块，可按需启用/禁用

**组件**:
- StaleCleanupManager (stale 清理)
- SnapshotManager (快照管理)
- LogReplayManager (日志回放)
- HealthMonitor (健康监控)
- MetricsCollector (指标采集)

**配置**:
```json
{
  "modules": {
    "stale_cleanup": {
      "enabled": true,
      "config": {
        "cleanup_interval_ms": 60000,
        "stale_threshold_ms": 60000
      }
    },
    "snapshot": {
      "enabled": true,
      "config": {
        "snapshot_interval_ms": 300000,
        "max_snapshots": 10
      }
    },
    "health_monitor": {
      "enabled": true,
      "config": {
        "check_interval_ms": 30000,
        "report_interval_ms": 300000
      }
    }
  }
}
```

---

### Plugin (插件层)

**定义**: 扩展功能，独立部署，通过 API/RPC 通信

**组件**:
- AlertConnector (告警连接器)
- WebhookDispatcher (webhook 分发器)
- RecoveryExecutor (恢复执行器)
- AuditLogger (审计日志)
- ReplayConsole (回放控制台)

**配置**:
```json
{
  "plugins": {
    "alert_connector": {
      "enabled": false,
      "endpoint": "http://localhost:8080/alerts",
      "timeout_ms": 5000,
      "retry_count": 3
    },
    "webhook_dispatcher": {
      "enabled": false,
      "endpoints": [],
      "batch_size": 100,
      "flush_interval_ms": 1000
    }
  }
}
```

---

## 二、Runtime Bootstrap 接线设计

### 启动流程

```
1. 加载配置 (config.json)
   ↓
2. 初始化 Core 组件
   - InstanceRegistry
   - LeaseManager
   - WorkItemCoordinator
   - DuplicateSuppressionManager
   ↓
3. 初始化启用的 Module
   - StaleCleanupManager
   - SnapshotManager
   - HealthMonitor
   ↓
4. 连接启用的 Plugin
   - AlertConnector
   - WebhookDispatcher
   ↓
5. 注册 Health Check 端点
   ↓
6. 启动完成，开始服务
```

### 代码结构

```typescript
// src/bootstrap.ts
export async function bootstrap(config: RuntimeConfig): Promise<Runtime> {
  // 1. Core components (always enabled)
  const registry = new InstanceRegistry(config.core.registry);
  await registry.initialize();

  const leaseManager = new LeaseManager({
    registry,
    ...config.core.lease,
  });
  await leaseManager.initialize();

  const itemCoordinator = new WorkItemCoordinator({
    leaseManager,
    registry,
    ...config.core.item,
  });
  await itemCoordinator.initialize();

  const suppressionManager = new DuplicateSuppressionManager({
    ...config.core.suppression,
  });
  await suppressionManager.initialize();

  // 2. Modules (conditionally enabled)
  const modules: Record<string, any> = {};
  
  if (config.modules.stale_cleanup?.enabled) {
    modules.staleCleanup = new StaleCleanupManager({
      leaseManager,
      ...config.modules.stale_cleanup,
    });
    await modules.staleCleanup.initialize();
  }

  if (config.modules.snapshot?.enabled) {
    modules.snapshot = new SnapshotManager({
      leaseManager,
      itemCoordinator,
      ...config.modules.snapshot,
    });
    await modules.snapshot.initialize();
  }

  if (config.modules.health_monitor?.enabled) {
    modules.healthMonitor = new HealthMonitor({
      registry,
      leaseManager,
      itemCoordinator,
      ...config.modules.health_monitor,
    });
    await modules.healthMonitor.initialize();
  }

  // 3. Plugins (conditionally enabled)
  const plugins: Record<string, any> = {};
  
  for (const [name, pluginConfig] of Object.entries(config.plugins || {})) {
    if (pluginConfig.enabled) {
      plugins[name] = await loadPlugin(name, pluginConfig);
    }
  }

  // 4. Create runtime instance
  const runtime: Runtime = {
    registry,
    leaseManager,
    itemCoordinator,
    suppressionManager,
    modules,
    plugins,
    async shutdown() {
      // Shutdown in reverse order
      for (const plugin of Object.values(plugins)) {
        await plugin.shutdown();
      }
      for (const module of Object.values(modules)) {
        await module.shutdown();
      }
      await suppressionManager.shutdown();
      await itemCoordinator.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();
    },
  };

  return runtime;
}
```

---

## 三、Feature Flags 规划

### Flag 分类

**Core Flags** (启动时确定，不可动态修改):
- `core.lease.enabled` - Lease 功能开关
- `core.item.enabled` - Item 功能开关
- `core.suppression.enabled` - Suppression 功能开关

**Module Flags** (可动态修改):
- `module.stale_cleanup.enabled` - Stale cleanup 开关
- `module.snapshot.enabled` - Snapshot 开关
- `module.health_monitor.enabled` - Health monitor 开关

**Plugin Flags** (可动态修改):
- `plugin.alert_connector.enabled` - Alert connector 开关
- `plugin.webhook_dispatcher.enabled` - Webhook 开关

### Flag 管理

**配置方式**:
```json
{
  "feature_flags": {
    "core": {
      "lease": { "enabled": true, "dynamic": false },
      "item": { "enabled": true, "dynamic": false },
      "suppression": { "enabled": true, "dynamic": false }
    },
    "module": {
      "stale_cleanup": { "enabled": true, "dynamic": true },
      "snapshot": { "enabled": true, "dynamic": true },
      "health_monitor": { "enabled": true, "dynamic": true }
    },
    "plugin": {
      "alert_connector": { "enabled": false, "dynamic": true },
      "webhook_dispatcher": { "enabled": false, "dynamic": true }
    }
  }
}
```

**动态修改 API**:
```typescript
// PATCH /api/v1/feature-flags
{
  "module.stale_cleanup.enabled": false
}

// Response
{
  "success": true,
  "flag": "module.stale_cleanup.enabled",
  "old_value": true,
  "new_value": false,
  "timestamp": "2026-04-05T18:30:00Z"
}
```

---

## 四、默认启用策略

### 开发环境

```json
{
  "core": { "enabled": true },
  "modules": {
    "stale_cleanup": { "enabled": true },
    "snapshot": { "enabled": true },
    "health_monitor": { "enabled": true }
  },
  "plugins": {
    "alert_connector": { "enabled": false },
    "webhook_dispatcher": { "enabled": false }
  }
}
```

### 测试环境

```json
{
  "core": { "enabled": true },
  "modules": {
    "stale_cleanup": { "enabled": true },
    "snapshot": { "enabled": true },
    "health_monitor": { "enabled": true }
  },
  "plugins": {
    "alert_connector": { "enabled": true },
    "webhook_dispatcher": { "enabled": true }
  }
}
```

### 生产环境

```json
{
  "core": { "enabled": true },
  "modules": {
    "stale_cleanup": { "enabled": true },
    "snapshot": { "enabled": true },
    "health_monitor": { "enabled": true }
  },
  "plugins": {
    "alert_connector": { "enabled": true },
    "webhook_dispatcher": { "enabled": false } // Enable after validation
  }
}
```

---

## 五、Config Schema

### 完整配置结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "core": {
      "type": "object",
      "properties": {
        "registry": {
          "type": "object",
          "properties": {
            "data_dir": { "type": "string" },
            "heartbeat_interval_ms": { "type": "number", "default": 30000 }
          }
        },
        "lease": {
          "type": "object",
          "properties": {
            "data_dir": { "type": "string" },
            "default_ttl_ms": { "type": "number", "default": 30000 },
            "max_ttl_ms": { "type": "number", "default": 300000 }
          }
        },
        "item": {
          "type": "object",
          "properties": {
            "data_dir": { "type": "string" },
            "default_lease_ttl_ms": { "type": "number", "default": 30000 }
          }
        },
        "suppression": {
          "type": "object",
          "properties": {
            "data_dir": { "type": "string" },
            "default_ttl_ms": { "type": "number", "default": 60000 },
            "scope_ttls": { "type": "object" }
          }
        }
      }
    },
    "modules": {
      "type": "object",
      "properties": {
        "stale_cleanup": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "cleanup_interval_ms": { "type": "number", "default": 60000 },
            "stale_threshold_ms": { "type": "number", "default": 60000 }
          }
        },
        "snapshot": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "snapshot_interval_ms": { "type": "number", "default": 300000 },
            "max_snapshots": { "type": "number", "default": 10 }
          }
        },
        "health_monitor": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "check_interval_ms": { "type": "number", "default": 30000 },
            "report_interval_ms": { "type": "number", "default": 300000 }
          }
        }
      }
    },
    "plugins": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean", "default": false },
          "endpoint": { "type": "string" },
          "timeout_ms": { "type": "number", "default": 5000 },
          "retry_count": { "type": "number", "default": 3 }
        }
      }
    },
    "feature_flags": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "dynamic": { "type": "boolean" }
        }
      }
    }
  }
}
```

---

## 六、Health / Metrics / Diagnostics 接线方案

### Health Check 端点

```typescript
// GET /health
{
  "status": "healthy",
  "timestamp": "2026-04-05T18:30:00Z",
  "components": {
    "registry": { "status": "healthy", "latency_ms": 5 },
    "lease_manager": { "status": "healthy", "latency_ms": 10 },
    "item_coordinator": { "status": "healthy", "latency_ms": 15 },
    "suppression_manager": { "status": "healthy", "latency_ms": 8 },
    "stale_cleanup": { "status": "healthy", "last_run": "2026-04-05T18:29:00Z" },
    "snapshot": { "status": "healthy", "last_snapshot": "2026-04-05T18:25:00Z" },
    "health_monitor": { "status": "healthy" }
  },
  "resources": {
    "memory_heap_used_mb": 256,
    "memory_heap_total_mb": 512,
    "file_handle_count": 50,
    "disk_used_gb": 10
  }
}
```

### Metrics 端点

```typescript
// GET /metrics (Prometheus format)
# HELP runtime_lease_acquire_total Total number of lease acquires
# TYPE runtime_lease_acquire_total counter
runtime_lease_acquire_total{status="success"} 10000
runtime_lease_acquire_total{status="failure"} 50

# HELP runtime_lease_acquire_latency_ms Lease acquire latency in milliseconds
# TYPE runtime_lease_acquire_latency_ms histogram
runtime_lease_acquire_latency_ms_bucket{le="10"} 8000
runtime_lease_acquire_latency_ms_bucket{le="50"} 9500
runtime_lease_acquire_latency_ms_bucket{le="100"} 9900
runtime_lease_acquire_latency_ms_bucket{le="+Inf"} 10000
runtime_lease_acquire_latency_ms_sum 150000
runtime_lease_acquire_latency_ms_count 10000

# HELP runtime_memory_heap_used_mb Memory heap used in MB
# TYPE runtime_memory_heap_used_mb gauge
runtime_memory_heap_used_mb 256
```

### Diagnostics 端点

```typescript
// GET /diagnostics
{
  "timestamp": "2026-04-05T18:30:00Z",
  "uptime_hours": 168,
  "version": "0.1.0",
  "git_commit": "abc123",
  "build_time": "2026-04-01T12:00:00Z",
  
  "coordination": {
    "active_leases": 1000,
    "active_items": 500,
    "stale_leases": 10,
    "suppression_records": 5000
  },
  
  "performance": {
    "acquire_latency_p50_ms": 5,
    "acquire_latency_p99_ms": 20,
    "claim_latency_p50_ms": 10,
    "claim_latency_p99_ms": 50,
    "suppression_latency_p50_ms": 3,
    "suppression_latency_p99_ms": 15
  },
  
  "resources": {
    "memory_heap_used_mb": 256,
    "memory_heap_total_mb": 512,
    "snapshot_size_kb": 1024,
    "log_size_kb": 5120,
    "temp_file_count": 5
  },
  
  "recent_events": [
    {
      "timestamp": "2026-04-05T18:29:00Z",
      "type": "stale_cleanup",
      "message": "Cleaned up 10 stale leases",
      "severity": "info"
    },
    {
      "timestamp": "2026-04-05T18:25:00Z",
      "type": "snapshot",
      "message": "Created snapshot leases_snapshot.json",
      "severity": "info"
    }
  ]
}
```

---

## 七、待办事项

### 工程 (Track C)

- [ ] 创建 bootstrap.ts
- [ ] 实现 Core/Module/Plugin 加载器
- [ ] 实现 Feature Flags 管理
- [ ] 实现 Config Schema 验证
- [ ] 实现 Health/Metrics/Diagnostics 端点
- [ ] 编写集成测试

### 文档 (Track C)

- [x] RUNTIME_INTEGRATION_PLAN.md (本文档)
- [ ] CORE_MODULE_PLUGIN_CLASSIFICATION.md (详细分类)
- [ ] DEFAULT_ENABLEMENT_POLICY.md (默认启用策略)
- [ ] FEATURE_FLAGS_API.md (Feature Flags API)
- [ ] CONFIG_SCHEMA.md (配置 Schema 文档)

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-05_  
_下次审查：Track C 工程完成后_
