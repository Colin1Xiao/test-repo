# Bootstrap Integration Checklist

**阶段**: Wave 2-B: Runtime Defaultization  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**依赖**: 
- CORE_MODULE_PLUGIN_CLASSIFICATION.md ✅
- DEFAULT_ENABLEMENT_POLICY.md ✅
- FEATURE_FLAG_MATRIX.md ✅

---

## 一、装配概述

### 目的

定义 OpenClaw Runtime **启动装配的标准流程**，确保：
- 组件按正确顺序初始化
- 依赖关系正确处理
- 配置按策略加载
- 健康检查正确接线
- 关闭时资源正确清理

### 适用范围

| 场景 | 适用 | 说明 |
|------|------|------|
| 本地开发启动 | ✅ | 单实例开发环境 |
| Gray 10% 部署 | ✅ | 3 实例集群部署 |
| 生产环境部署 | ✅ | 正式生产部署 |
| 版本升级重启 | ✅ | 新版本启动 |
| 故障恢复重启 | ✅ | 异常后恢复 |

---

## 二、启动流程

### 阶段划分

```
┌─────────────────────────────────────────────────────────┐
│ Phase 0: 环境准备 (Bootstrap)                           │
├─────────────────────────────────────────────────────────┤
│ 1. 加载环境变量                                         │
│ 2. 验证 NODE_ENV                                        │
│ 3. 加载配置文件                                         │
│ 4. 初始化 Feature Flags                                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Core 层初始化 (必须全部成功)                   │
├─────────────────────────────────────────────────────────┤
│ 1. InstanceRegistry                                     │
│ 2. LeaseManager                                         │
│ 3. WorkItemCoordinator                                  │
│ 4. DuplicateSuppressionManager                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Module 层初始化 (按配置启用)                   │
├─────────────────────────────────────────────────────────┤
│ 1. StaleCleanupManager                                  │
│ 2. SnapshotManager                                      │
│ 3. HealthMonitor                                        │
│ 4. MetricsCollector                                     │
│ 5. AlertingService                                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: Plugin 层初始化 (按配置启用)                   │
├─────────────────────────────────────────────────────────┤
│ 1. GitHub Connector (如启用)                            │
│ 2. Jenkins Connector (如启用)                           │
│ 3. Trading Pack (如启用)                                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 4: HTTP 服务启动                                  │
├─────────────────────────────────────────────────────────┤
│ 1. 注册路由                                             │
│ 2. 启动 HTTP 服务器                                      │
│ 3. 注册健康检查端点                                     │
│ 4. 注册 Metrics 端点                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 5: 启动后验证                                     │
├─────────────────────────────────────────────────────────┤
│ 1. 健康检查自测                                         │
│ 2. 依赖连接验证                                         │
│ 3. 启动日志输出                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 三、Phase 0: 环境准备

### 检查清单

- [ ] **环境变量加载**
  ```bash
  # 必需环境变量
  NODE_ENV=production
  INSTANCE_ID=instance-1
  INSTANCE_NAME=runtime-local-1
  PORT=3101
  GRAY_RATIO=0.1
  
  # 可选环境变量
  LOG_LEVEL=INFO
  CONFIG_PATH=./config/production.json
  DATA_DIR=./data
  ```

- [ ] **NODE_ENV 验证**
  ```typescript
  if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Invalid NODE_ENV');
  }
  ```

- [ ] **配置文件加载**
  ```typescript
  const config = await loadConfig(process.env.CONFIG_PATH);
  // 验证配置完整性
  validateConfig(config);
  ```

- [ ] **Feature Flags 初始化**
  ```typescript
  const flags = await loadFeatureFlags(config.flags);
  // 应用 Gray 10% 冻结策略
  applyGray10Freeze(flags);
  ```

### 失败处理

| 错误 | 处理 |
|------|------|
| 环境变量缺失 | 使用默认值或抛出错误 |
| 配置文件不存在 | 使用默认配置或抛出错误 |
| 配置验证失败 | 抛出错误，阻止启动 |
| Feature Flags 加载失败 | 使用默认 Flags |

---

## 四、Phase 1: Core 层初始化

### 初始化顺序

**严格顺序**: Registry → Lease → Item → Suppression

```typescript
// 1. InstanceRegistry (无依赖)
const registry = new InstanceRegistry(config.core.registry);
await registry.initialize();
await registry.startHeartbeat();

// 2. LeaseManager (依赖：Registry)
const leaseManager = new LeaseManager(config.core.lease, registry);
await leaseManager.initialize();

// 3. WorkItemCoordinator (依赖：LeaseManager)
const coordinator = new WorkItemCoordinator(config.core.item, leaseManager);
await coordinator.initialize();

// 4. DuplicateSuppressionManager (无 Core 依赖)
const suppression = new DuplicateSuppressionManager(config.core.suppression);
await suppression.initialize();
```

### 检查清单

- [ ] **InstanceRegistry**
  - [ ] 实例 ID 文件存在或创建
  - [ ] 数据目录存在
  - [ ] 心跳线程启动
  - [ ] 健康检查注册

- [ ] **LeaseManager**
  - [ ] 租约目录存在
  - [ ] 现有租约加载
  - [ ] 清理线程启动 (如启用)
  - [ ] 健康检查注册

- [ ] **WorkItemCoordinator**
  - [ ] 工作项目录存在
  - [ ] 现有工作项加载
  - [ ] 协调线程启动
  - [ ] 健康检查注册

- [ ] **DuplicateSuppressionManager**
  - [ ] 抑制目录存在
  - [ ] 现有抑制记录加载
  - [ ] 清理线程启动 (如启用)
  - [ ] 健康检查注册

### 依赖注入点

```typescript
interface CoreComponents {
  registry: InstanceRegistry;
  leaseManager: LeaseManager;
  coordinator: WorkItemCoordinator;
  suppression: DuplicateSuppressionManager;
}
```

### 失败处理

| 错误 | 处理 |
|------|------|
| Registry 初始化失败 | **停止启动** (Critical) |
| LeaseManager 初始化失败 | **停止启动** (Critical) |
| Coordinator 初始化失败 | **停止启动** (Critical) |
| Suppression 初始化失败 | **停止启动** (Critical) |

**原则**: Core 层任一组件失败 → 整个系统停止启动

---

## 五、Phase 2: Module 层初始化

### 初始化顺序

**推荐顺序**: StaleCleanup → Snapshot → Health → Metrics → Alerting

```typescript
// 1. StaleCleanupManager (依赖：LeaseManager)
if (config.modules.stale_cleanup.enabled) {
  const staleCleanup = new StaleCleanupManager(
    config.modules.stale_cleanup,
    coreComponents.leaseManager
  );
  await staleCleanup.initialize();
  await staleCleanup.startCleanupLoop();
}

// 2. SnapshotManager (依赖：Core)
if (config.modules.snapshot.enabled) {
  const snapshot = new SnapshotManager(
    config.modules.snapshot,
    coreComponents
  );
  await snapshot.initialize();
  await snapshot.startSnapshotLoop();
}

// 3. HealthMonitor (依赖：Core)
if (config.modules.health_monitor.enabled) {
  const health = new HealthMonitor(
    config.modules.health_monitor,
    coreComponents
  );
  await health.initialize();
  await health.startMonitoringLoop();
}

// 4. MetricsCollector (依赖：Core)
if (config.modules.metrics.enabled) {
  const metrics = new MetricsCollector(
    config.modules.metrics,
    coreComponents
  );
  await metrics.initialize();
  await metrics.startCollectionLoop();
}

// 5. AlertingService (依赖：Core + Metrics)
if (config.modules.alerting.enabled) {
  const alerting = new AlertingService(
    config.modules.alerting,
    coreComponents,
    metrics
  );
  await alerting.initialize();
  await alerting.startAlertingLoop();
}
```

### 检查清单

- [ ] **StaleCleanupManager**
  - [ ] 配置验证 (enabled = true)
  - [ ] LeaseManager 依赖可用
  - [ ] 清理线程启动
  - [ ] 健康检查注册

- [ ] **SnapshotManager**
  - [ ] 配置验证 (enabled = true)
  - [ ] 快照目录存在
  - [ ] 快照线程启动
  - [ ] 健康检查注册

- [ ] **HealthMonitor**
  - [ ] 配置验证 (enabled = true)
  - [ ] 监控线程启动
  - [ ] 健康检查注册

- [ ] **MetricsCollector**
  - [ ] 配置验证 (enabled = true)
  - [ ] 收集线程启动
  - [ ] Prometheus 端点注册
  - [ ] 健康检查注册

- [ ] **AlertingService**
  - [ ] 配置验证 (enabled = true)
  - [ ] 告警规则加载
  - [ ] 告警线程启动
  - [ ] 健康检查注册

### 依赖注入点

```typescript
interface ModuleComponents {
  staleCleanup?: StaleCleanupManager;
  snapshot?: SnapshotManager;
  health?: HealthMonitor;
  metrics?: MetricsCollector;
  alerting?: AlertingService;
}
```

### 失败处理

| 错误 | 处理 |
|------|------|
| StaleCleanup 初始化失败 | 记录错误，继续启动 (Warning) |
| Snapshot 初始化失败 | 记录错误，继续启动 (Warning) |
| Health 初始化失败 | 记录错误，继续启动 (Warning) |
| Metrics 初始化失败 | 记录错误，继续启动 (Warning) |
| Alerting 初始化失败 | 记录错误，继续启动 (Warning) |

**原则**: Module 层组件失败 → 记录警告，继续启动 (降级运行)

---

## 六、Phase 3: Plugin 层初始化

### 初始化顺序

**按需顺序**: 无固定顺序，按配置启用

```typescript
const plugins: PluginComponents = {};

// GitHub Connector
if (config.plugins.github.enabled) {
  plugins.github = new GitHubConnector(config.plugins.github);
  await plugins.github.initialize();
}

// Jenkins Connector
if (config.plugins.jenkins.enabled) {
  plugins.jenkins = new JenkinsConnector(config.plugins.jenkins);
  await plugins.jenkins.initialize();
}

// Trading Pack
if (config.plugins.trading.enabled) {
  plugins.trading = new TradingPack(config.plugins.trading);
  await plugins.trading.initialize();
}
```

### 检查清单

- [ ] **GitHub Connector** (如启用)
  - [ ] 配置验证 (endpoint, timeout)
  - [ ] API 连接测试
  - [ ] 健康检查注册

- [ ] **Jenkins Connector** (如启用)
  - [ ] 配置验证 (endpoint, timeout)
  - [ ] API 连接测试
  - [ ] 健康检查注册

- [ ] **Trading Pack** (如启用)
  - [ ] 配置验证 (provider, testnet)
  - [ ] 交易所连接测试
  - [ ] 健康检查注册

### 依赖注入点

```typescript
interface PluginComponents {
  github?: GitHubConnector;
  jenkins?: JenkinsConnector;
  trading?: TradingPack;
}
```

### 失败处理

| 错误 | 处理 |
|------|------|
| Plugin 初始化失败 | 记录错误，禁用该 Plugin，继续启动 |

**原则**: Plugin 层组件失败 → 记录错误，禁用该组件，不影响其他

---

## 七、Phase 4: HTTP 服务启动

### 路由注册顺序

```typescript
// 1. 基础路由
app.get('/health', healthHandler);
app.get('/metrics', metricsHandler);
app.get('/config', configHandler);

// 2. Core API
app.use('/api/v1/registry', registryRoutes);
app.use('/api/v1/leases', leaseRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/suppression', suppressionRoutes);

// 3. Module API
app.use('/api/v1/stale-cleanup', staleCleanupRoutes);
app.use('/api/v1/snapshot', snapshotRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/alerting', alertingRoutes);

// 4. Plugin API (如启用)
if (plugins.github) {
  app.use('/api/v1/github', githubRoutes);
}
if (plugins.jenkins) {
  app.use('/api/v1/jenkins', jenkinsRoutes);
}
if (plugins.trading) {
  app.use('/api/v1/trading', tradingRoutes);
}

// 5. Triple-chain API
app.use('/api/v1/triple-chain', tripleChainRoutes);
app.use('/api/v1/timeline', timelineRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/incidents', incidentRoutes);
```

### 检查清单

- [ ] **基础路由注册**
  - [ ] /health 端点注册
  - [ ] /metrics 端点注册
  - [ ] /config 端点注册

- [ ] **Core API 注册**
  - [ ] Registry 路由
  - [ ] Lease 路由
  - [ ] Item 路由
  - [ ] Suppression 路由

- [ ] **Module API 注册**
  - [ ] Stale cleanup 路由
  - [ ] Snapshot 路由
  - [ ] Health 路由
  - [ ] Alerting 路由

- [ ] **Plugin API 注册** (如启用)
  - [ ] GitHub 路由
  - [ ] Jenkins 路由
  - [ ] Trading 路由

- [ ] **HTTP 服务器启动**
  - [ ] 端口绑定
  - [ ] HTTPS 配置 (如启用)
  - [ ] CORS 配置
  - [ ] 请求日志

### 健康检查接线点

```typescript
// Health check handler
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    version: process.env.VERSION || 'unknown',
    timestamp: Date.now(),
    components: {
      registry: await registry.getHealth(),
      leaseManager: await leaseManager.getHealth(),
      coordinator: await coordinator.getHealth(),
      suppression: await suppression.getHealth(),
      staleCleanup: staleCleanup?.getHealth() || { status: 'disabled' },
      snapshot: snapshot?.getHealth() || { status: 'disabled' },
      healthMonitor: healthMonitor?.getHealth() || { status: 'disabled' },
      metrics: metrics?.getHealth() || { status: 'disabled' },
      alerting: alerting?.getHealth() || { status: 'disabled' },
    },
  };
  
  // 计算整体状态
  health.status = calculateOverallStatus(health.components);
  
  res.json(health);
});
```

### Metrics 接线点

```typescript
// Prometheus metrics
const registry = new Registry();

// Core metrics
registry.registerMetric(new InstanceInfoMetric());
registry.registerMetric(new LeaseCountMetric());
registry.registerMetric(new ItemCountMetric());

// Module metrics
registry.registerMetric(new StaleCleanupMetric());
registry.registerMetric(new SnapshotMetric());
registry.registerMetric(new HealthStatusMetric());

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = await registry.metrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

### 失败处理

| 错误 | 处理 |
|------|------|
| 端口被占用 | 尝试备用端口或停止启动 |
| 路由注册失败 | **停止启动** (Critical) |
| HTTPS 配置失败 | 降级到 HTTP 或停止启动 |
| CORS 配置失败 | 使用默认配置 |

---

## 八、Phase 5: 启动后验证

### 自测流程

```typescript
async function postStartupValidation() {
  const errors: string[] = [];
  
  // 1. 健康检查自测
  try {
    const health = await fetch(`http://localhost:${PORT}/health`);
    if (!health.ok) {
      errors.push('Health check self-test failed');
    }
  } catch (e) {
    errors.push(`Health check self-test error: ${e.message}`);
  }
  
  // 2. Metrics 端点自测
  try {
    const metrics = await fetch(`http://localhost:${PORT}/metrics`);
    if (!metrics.ok) {
      errors.push('Metrics endpoint self-test failed');
    }
  } catch (e) {
    errors.push(`Metrics endpoint self-test error: ${e.message}`);
  }
  
  // 3. 依赖连接验证
  if (components.staleCleanup) {
    const leaseHealth = await components.leaseManager.getHealth();
    if (leaseHealth.status !== 'ok') {
      errors.push('LeaseManager dependency unhealthy');
    }
  }
  
  // 4. 共享存储验证
  try {
    await fs.access('./data/shared/leases', fs.constants.R_OK | fs.constants.W_OK);
  } catch (e) {
    errors.push(`Shared storage access error: ${e.message}`);
  }
  
  // 5. Feature Flags 验证
  const flags = getFeatureFlags();
  if (!validateFeatureFlags(flags)) {
    errors.push('Feature flags validation failed');
  }
  
  // 输出结果
  if (errors.length > 0) {
    logger.warn('Post-startup validation warnings', { errors });
  } else {
    logger.info('Post-startup validation passed');
  }
  
  return errors;
}
```

### 检查清单

- [ ] **健康检查自测**
  - [ ] /health 返回 HTTP 200
  - [ ] 响应包含所有组件状态
  - [ ] 整体状态正确计算

- [ ] **Metrics 端点自测**
  - [ ] /metrics 返回 HTTP 200
  - [ ] 响应包含核心指标
  - [ ] Prometheus 格式正确

- [ ] **依赖连接验证**
  - [ ] Core 组件依赖正常
  - [ ] Module 组件依赖正常
  - [ ] Plugin 组件依赖正常 (如启用)

- [ ] **共享存储验证**
  - [ ] leases/ 目录可读写
  - [ ] items/ 目录可读写
  - [ ] suppression/ 目录可读写

- [ ] **Feature Flags 验证**
  - [ ] 所有 Flags 加载成功
  - [ ] Gray 10% 冻结策略应用
  - [ ] 默认值正确

### 启动日志输出

```
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw Runtime Service Started                ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: production                                 ║
║  Instance: instance-1 (runtime-local-1)                  ║
║  Host: localhost                                         ║
║  Port: 3101                                              ║
║  Gray Ratio: 0.1 (10%)                                   ║
╠═══════════════════════════════════════════════════════════╣
║  Core Components:                                         ║
║    ✓ InstanceRegistry                                    ║
║    ✓ LeaseManager                                        ║
║    ✓ WorkItemCoordinator                                 ║
║    ✓ DuplicateSuppressionManager                         ║
╠═══════════════════════════════════════════════════════════╣
║  Module Components:                                       ║
║    ✓ StaleCleanupManager                                 ║
║    ✓ SnapshotManager                                     ║
║    ✓ HealthMonitor                                       ║
║    ✓ MetricsCollector                                    ║
║    ✓ AlertingService                                     ║
╠═══════════════════════════════════════════════════════════╣
║  Plugin Components:                                       ║
║    - GitHub Connector (disabled)                         ║
║    - Jenkins Connector (disabled)                        ║
║    - Trading Pack (disabled)                             ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET  /health                                           ║
║    GET  /metrics                                          ║
║    GET  /config                                           ║
║    ...                                                    ║
╚═══════════════════════════════════════════════════════════╝

Post-startup validation: PASSED
```

---

## 九、关闭流程

### 关闭顺序

**反向顺序**: Plugin → Module → Core → HTTP

```typescript
async function shutdown() {
  logger.info('Shutting down...');
  
  // 1. 停止 HTTP 服务器
  await httpServer.close();
  logger.info('HTTP server stopped');
  
  // 2. 停止 Plugin 层
  if (plugins.github) {
    await plugins.github.shutdown();
  }
  if (plugins.jenkins) {
    await plugins.jenkins.shutdown();
  }
  if (plugins.trading) {
    await plugins.trading.shutdown();
  }
  logger.info('Plugin components stopped');
  
  // 3. 停止 Module 层
  if (components.alerting) {
    await components.alerting.shutdown();
  }
  if (components.metrics) {
    await components.metrics.shutdown();
  }
  if (components.health) {
    await components.health.shutdown();
  }
  if (components.snapshot) {
    await components.snapshot.shutdown();
  }
  if (components.staleCleanup) {
    await components.staleCleanup.shutdown();
  }
  logger.info('Module components stopped');
  
  // 4. 停止 Core 层
  await components.suppression.shutdown();
  await components.coordinator.shutdown();
  await components.leaseManager.shutdown();
  await components.registry.shutdown();
  logger.info('Core components stopped');
  
  // 5. 清理资源
  await cleanupResources();
  logger.info('Shutdown complete');
}
```

### 检查清单

- [ ] **HTTP 服务器停止**
  - [ ] 停止接收新请求
  - [ ] 等待现有请求完成 (timeout: 30s)
  - [ ] 关闭端口监听

- [ ] **Plugin 层停止**
  - [ ] 停止后台线程
  - [ ] 关闭外部连接
  - [ ] 清理缓存

- [ ] **Module 层停止**
  - [ ] 停止所有后台循环
  - [ ] 刷新待处理数据
  - [ ] 关闭文件句柄

- [ ] **Core 层停止**
  - [ ] 停止心跳线程
  - [ ] 释放租约
  - [ ] 保存状态快照
  - [ ] 关闭文件句柄

- [ ] **资源清理**
  - [ ] 删除临时文件
  - [ ] 释放内存
  - [ ] 关闭数据库连接 (如有)

### 优雅关闭

```typescript
// 信号处理
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT');
  await shutdown();
  process.exit(0);
});

// 超时强制退出
const shutdownTimeout = setTimeout(() => {
  logger.error('Shutdown timeout, forcing exit');
  process.exit(1);
}, 30000); // 30s timeout
```

---

## 十、部署后验证

### 必须验证的装配项

| 验证项 | 检查方法 | 通过标准 |
|--------|---------|---------|
| **实例进程** | `ps aux \| grep server` | 进程存在 |
| **健康检查** | `curl /health` | HTTP 200, ok: true |
| **Metrics 端点** | `curl /metrics` | HTTP 200, 包含核心指标 |
| **共享存储** | `ls data/shared/` | 目录存在且可写 |
| **Feature Flags** | `curl /config` | Flags 正确加载 |
| **日志输出** | `tail logs/*.log` | 无 ERROR 级别错误 |
| **端口监听** | `lsof -i :PORT` | 端口正常监听 |

### 验证脚本

```bash
#!/bin/bash
# scripts/verify-deployment.sh

PORT=${1:-3101}

echo "=== Deployment Verification ==="
echo "Port: $PORT"
echo ""

# 1. 健康检查
echo "1. Health Check..."
curl -s http://localhost:$PORT/health | jq '.status'
if [ $? -ne 0 ]; then
  echo "❌ Health check failed"
  exit 1
fi
echo "✅ Health check passed"

# 2. Metrics 端点
echo "2. Metrics Endpoint..."
curl -s http://localhost:$PORT/metrics | head -10
if [ $? -ne 0 ]; then
  echo "❌ Metrics endpoint failed"
  exit 1
fi
echo "✅ Metrics endpoint passed"

# 3. 共享存储
echo "3. Shared Storage..."
ls -la data/shared/leases/ data/shared/items/ data/shared/suppression/
if [ $? -ne 0 ]; then
  echo "❌ Shared storage access failed"
  exit 1
fi
echo "✅ Shared storage passed"

# 4. Feature Flags
echo "4. Feature Flags..."
curl -s http://localhost:$PORT/config | jq '.modules | keys'
if [ $? -ne 0 ]; then
  echo "❌ Feature flags check failed"
  exit 1
fi
echo "✅ Feature flags passed"

# 5. 日志检查
echo "5. Log Check..."
tail -20 logs/deploy/instance-*.log | grep -i error
if [ $? -eq 0 ]; then
  echo "⚠️ Errors found in logs"
else
  echo "✅ No errors in logs"
fi

echo ""
echo "=== Verification Complete ==="
```

---

## 十一、故障排查

### 启动失败常见原因

| 问题 | 症状 | 排查步骤 |
|------|------|---------|
| 端口被占用 | EADDRINUSE | `lsof -i :PORT`, 更换端口或停止占用进程 |
| 配置错误 | Config validation failed | 检查配置文件语法，验证必填字段 |
| 目录权限 | EACCES | `ls -la data/`, `chmod -R 755 data/` |
| 依赖缺失 | Module not found | `npm install`, 检查 node_modules |
| 环境变量缺失 | Undefined env | `env \| grep RUNTIME`, 补充环境变量 |

### Core 层初始化失败

```typescript
// 调试模式
DEBUG=runtime:core node dist/server.js

// 检查日志
tail -100 logs/deploy/instance-1.log | grep -A 5 "Core initialization"
```

### Module 层初始化失败

```typescript
// 检查配置
curl http://localhost:3101/config | jq '.modules'

// 检查依赖
curl http://localhost:3101/health | jq '.components'
```

### HTTP 服务启动失败

```bash
# 检查端口
lsof -i :3101

# 检查路由注册
curl http://localhost:3101/ 2>&1 | head -20
```

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-06_  
_下次审查：Gray 10% 完成后_
