# Platform Boundary

**阶段**: Phase X-1: Source Intelligence Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、能力分层

### 1.1 层级定义

| 层级 | 名称 | 职责 | 示例 |
|------|------|------|------|
| L0 | 基础设施 | 运行时、存储、网络 | Node.js、文件系统、Redis |
| L1 | 平台核心 | 通用能力、抽象层 | 持久化、锁、事件、审计 |
| L2 | 领域服务 | 业务逻辑、工作流 | Incident、Approval、Recovery |
| L3 | 产品/场景 | 具体实现、UI | Trading Dashboard、Alerting |

### 1.2 分层原则

**向上依赖**: L3 → L2 → L1 → L0

**向下抽象**: L0/L1 不应知道 L2/L3 的存在

**边界清晰**: 每层有明确的职责和接口

---

## 二、当前能力映射

### 2.1 L0: 基础设施

| 能力 | 状态 | 归属 |
|------|------|------|
| Node.js 运行时 | ✅ | 平台 |
| 文件系统 | ✅ | 平台 |
| Redis (可选) | ✅ | 平台 |
| HTTP Server | ✅ | 平台 |

### 2.2 L1: 平台核心

| 能力 | 状态 | 归属 |
|------|------|------|
| 文件持久化 (JSONL+ 快照) | ✅ | 平台 |
| 文件锁 (单实例) | ✅ | 平台 |
| 事件存储 (Timeline) | ✅ | 平台 |
| 审计日志 (Audit) | ✅ | 平台 |
| 状态机引擎 | ✅ | 平台 |
| 幂等控制 | ✅ | 平台 |
| 恢复引擎 (Recovery) | ✅ | 平台 |
| 重放引擎 (Replay) | ✅ | 平台 |

### 2.3 L2: 领域服务

| 能力 | 状态 | 归属 |
|------|------|------|
| Incident 管理 | ✅ | Trading |
| Alert 管理 | ✅ | Trading |
| Approval 管理 | ⚠️ | Trading (可平台化) |
| Webhook 处理 | ✅ | Trading |
| Risk Management | 🔜 | Trading |

### 2.4 L3: 产品/场景

| 能力 | 状态 | 归属 |
|------|------|------|
| Trading Dashboard | ✅ | Trading Product |
| Alerting UI | ⚠️ | Trading Product |
| OKX Integration | ✅ | Trading Specific |
| Telegram Bot | ✅ | Communication |

---

## 三、通用化评估

### 3.1 已通用化能力

| 能力 | 通用化程度 | 证据 |
|------|----------|------|
| 文件持久化 | ✅ 100% | 与业务逻辑解耦 |
| 文件锁 | ✅ 100% | 通用锁接口 |
| 事件存储 | ✅ 100% | 通用事件 Schema |
| 审计日志 | ✅ 100% | 通用审计 Schema |
| 状态机引擎 | ✅ 90% | 支持多状态机定义 |
| 幂等控制 | ✅ 80% | 通用 Dedupe/Idempotency |
| 恢复引擎 | ✅ 70% | 通用 Recovery Coordinator |
| 重放引擎 | ✅ 70% | 通用 Replay Engine |

### 3.2 待通用化能力

| 能力 | 通用化程度 | 障碍 |
|------|----------|------|
| Approval 管理 | ⚠️ 50% | 硬编码 Trading 场景 |
| Webhook 处理 | ⚠️ 60% | OKX 特定映射 |
| Alert 定义 | ⚠️ 70% | P0 告警硬编码 |

### 3.3 不应通用化能力

| 能力 | 原因 |
|------|------|
| OKX API 集成 | 交易所特定 |
| Trading 策略 | 业务特定 |
| Risk Parameters | 业务特定 |

---

## 四、接口预留

### 4.1 生态接口

**Connector API**:
```typescript
interface Connector {
  name: string;
  version: string;
  capabilities: string[];
  resources: ResourceSchema[];
  events: EventSchema[];
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<HealthStatus>;
}
```

**用途**: MCP、Skill、外部系统集成

### 4.2 Skill 接口

**Skill API**:
```typescript
interface Skill {
  name: string;
  version: string;
  triggers: TriggerSchema[];
  actions: ActionSchema[];
  
  execute(action: Action): Promise<ActionResult>;
}
```

**用途**: 自动化技能、插件系统

### 4.3 MCP 接口

**MCP Resource**:
```typescript
interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  
  read(): Promise<Buffer>;
}
```

**MCP Tool**:
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  
  execute(args: Record<string, unknown>): Promise<unknown>;
}
```

---

## 五、平台化路线图

### 5.1 Phase 4.x (短期)

**目标**: 巩固平台核心，解耦领域服务

- [ ] Approval 管理通用化
- [ ] Webhook 映射配置化
- [ ] Alert 定义配置化
- [ ] Connector 框架完善

### 5.2 Phase 5.x (中期)

**目标**: 生态集成，插件系统

- [ ] MCP 集成
- [ ] Skill 系统
- [ ] 插件市场
- [ ] 多租户支持

### 5.3 Phase 6.x (长期)

**目标**: 平台产品化

- [ ] 云原生部署
- [ ] 多实例协调
- [ ] 高可用架构
- [ ] 商业化支持

---

## 六、过度平台化风险

### 6.1 识别标准

**过度平台化信号**:
- 为"可能有用"的场景设计接口
- 抽象层超过 3 级
- 配置复杂度超过业务价值
- 通用化导致性能显著下降

### 6.2 当前风险评估

| 领域 | 风险等级 | 备注 |
|------|---------|------|
| 文件持久化 | 🟢 低 | 抽象合理 |
| 文件锁 | 🟢 低 | 单实例场景清晰 |
| 状态机 | 🟢 低 | 配置化适中 |
| Approval | 🟡 中 | 待通用化 |
| Webhook | 🟡 中 | OKX 耦合待解 |

### 6.3 缓解策略

1. **YAGNI 原则**: 不为未来需求过度设计
2. **演进式抽象**: 从具体实现中提炼抽象
3. **性能基线**: 平台化不牺牲核心性能
4. **用户反馈**: 以实际使用场景驱动

---

## 七、决策记录

### 7.1 已决策

| 决策 | 日期 | 理由 |
|------|------|------|
| 文件持久化平台化 | 2026-04-05 | 通用能力，与业务解耦 |
| 文件锁单实例 | 2026-04-05 | 当前场景足够，多实例后续扩展 |
| Approval 暂不平台化 | 2026-04-05 | Trading 特定场景为主 |

### 7.2 待决策

| 决策 | 截止日期 | 影响 |
|------|---------|------|
| Webhook 映射配置化 | Wave 2 后 | 多交易所支持 |
| Alert 定义配置化 | Wave 2 后 | 多监控源支持 |
| Connector 框架 | Phase 4.x | 生态集成 |

---

## 八、与 Wave 2-A 的关系

### 8.1 不干扰原则

**Phase X-1 不修改**:
- Wave 2-A 运行链路
- 当前观察指标
- 已部署功能

**Phase X-1 只提炼**:
- 现有实现的抽象
- 已验证行为的规则
- 未来扩展的边界

### 8.2 后续集成

**Wave 2-A 后**:
1. 评估平台化需求
2. 优先级排序
3. 分阶段实施
4. 验证不影响稳定性

---

_文档版本：1.0  
最后更新：2026-04-05 05:40 CST_
