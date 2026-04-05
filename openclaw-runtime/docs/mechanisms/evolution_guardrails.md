# Evolution Guardrails

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、演进护栏总则

### 护栏 E-0: 演进四原则

```
EVOLUTION FOUR PRINCIPLES

1. 向后兼容 (Backward Compatibility)
   新版本必须兼容旧数据
   不破坏现有功能

2. 渐进式演进 (Incremental Evolution)
   小步迭代，不大步跳跃
   每步可验证，可回滚

3. 可追溯性 (Traceability)
   演进决策必须记录
   演进影响必须评估

4. 护栏优先 (Guardrails First)
   先定义护栏，再实施演进
   护栏不成，演进不行
```

---

## 二、数据演进护栏

### 护栏 E-1: Schema 变更护栏

```
SCHEMA CHANGE GUARDRAILS

FOR EACH schema_change:
  MUST:
  - 定义新旧 Schema 映射
  - 提供迁移脚本
  - 验证迁移完整性
  - 保留回滚方案
  
  MUST NOT:
  - 破坏性变更 (无迁移)
  - 静默丢弃字段
  - 改变字段语义
END FOR
```

**变更分类**:
| 类型 | 示例 | 要求 |
|------|------|------|
| 新增字段 | 添加 `metadata` | 可选，向后兼容 |
| 删除字段 | 移除 `old_field` | 需要迁移期 |
| 重命名字段 | `old_name` → `new_name` | 需要别名层 |
| 类型变更 | `string` → `number` | 需要转换逻辑 |

### 护栏 E-2: 数据迁移护栏

```
DATA MIGRATION GUARDRAILS

BEFORE MIGRATION:
- 备份数据
- 验证备份完整性
- 定义回滚方案

DURING MIGRATION:
- 增量迁移 (非全量)
- 验证每批数据
- 记录迁移进度

AFTER MIGRATION:
- 验证数据完整性
- 验证功能正常
- 保留旧数据 (观察期)
```

**迁移脚本模板**:
```typescript
async migrateData(): Promise<MigrationResult> {
  // 1. 备份
  await this.backup();
  
  // 2. 增量迁移
  const batches = await this.splitIntoBatches();
  for (const batch of batches) {
    await this.migrateBatch(batch);
    await this.verifyBatch(batch);
  }
  
  // 3. 验证
  const valid = await this.verifyMigration();
  if (!valid) {
    await this.rollback();
    throw new MigrationError('Verification failed');
  }
  
  // 4. 清理 (观察期后)
  // await this.cleanupOldData();
  
  return { success: true, migrated: batches.length };
}
```

### 护栏 E-3: 持久化格式演进

```
PERSISTENCE FORMAT EVOLUTION

JSONL → 新格式:
- 提供读取兼容层
- 渐进式转换
- 不中断服务

快照格式变更:
- 版本号标记
- 多版本支持
- 自动升级
```

**版本标记**:
```json
{
  "_version": "1.0",
  "_migrated_at": "2026-04-05T05:52:00Z",
  "incidents": [...]
}
```

---

## 三、功能演进护栏

### 护栏 E-4: 新功能引入护栏

```
NEW FEATURE INTRODUCTION GUARDRAILS

BEFORE IMPLEMENTATION:
- 定义功能边界
- 评估对现有功能影响
- 定义回滚方案

DURING IMPLEMENTATION:
- Feature Flag 控制
- 渐进式发布
- 监控指标定义

AFTER IMPLEMENTATION:
- 观察期 (至少 7 天)
- 性能基线对比
- 用户反馈收集
```

**Feature Flag 要求**:
```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout_percentage: number; // 0-100
  allowed_users?: string[];   // 白名单
  blocked_users?: string[];   // 黑名单
}
```

### 护栏 E-5: 功能废弃护栏

```
FEATURE DEPRECATION GUARDRAILS

PHASE 1 (宣布废弃):
- 文档标记 deprecated
- 日志记录使用情况
- 提供迁移指南

PHASE 2 (限制使用):
- Feature Flag 限制
- 仅白名单可用
- 迁移支持

PHASE 3 (移除):
- 确认无使用
- 移除代码
- 清理文档

MINIMUM TIMELINE: 30 天
```

### 护栏 E-6: API 演进护栏

```
API EVOLUTION GUARDRAILS

ENDPOINT CHANGES:
- 不破坏现有端点
- 新版本用 v2/v3 标记
- 旧版本保留 (至少 90 天)

REQUEST/RESPONSE CHANGES:
- 新增字段：可选
- 删除字段：标记 deprecated
- 改变语义：新版本

STATUS CODE CHANGES:
- 不改变现有状态码语义
- 新状态码需文档说明
```

---

## 四、架构演进护栏

### 护栏 E-7: 平台化护栏

```
PLATFORMIZATION GUARDRAILS

WHAT TO GENERALIZE:
- 通用能力 (持久化/锁/事件)
- 已验证模式 (Incident/Approval)
- 明确边界 (L1 平台核心)

WHAT NOT TO GENERALIZE:
- Trading 特定逻辑
- OKX 特定集成
- 未验证模式

GENERALIZATION CRITERIA:
- 至少 2 个使用场景
- 明确抽象边界
- 性能可接受
```

### 护栏 E-8: 多实例演进护栏

```
MULTI-INSTANCE EVOLUTION GUARDRAILS

PREREQUISITES:
- 分布式锁 (Redis/etcd)
- Session 所有权
- Item 所有权
- 心跳机制

MIGRATION PATH:
1. 单实例 + 文件锁 (当前)
2. 单实例 + 分布式锁
3. 多实例 + 分布式锁
4. 自动扩缩容

EACH STEP MUST:
- 验证稳定性 (至少 7 天)
- 性能基线对比
- 回滚方案就绪
```

### 护栏 E-9: Connector 标准化护栏

```
CONNECTOR STANDARDIZATION GUARDRAILS

CONNECTOR INTERFACE:
- 统一 Connect/Disconnect
- 统一 Health Check
- 统一事件格式

PROVIDER-SPECIFIC:
- 隔离实现
- 不污染通用层
- 可独立测试

MIGRATION PATH:
1. OKX 专用 (当前)
2. OKX + Binance 隔离
3. 通用 Connector 框架
4. 插件市场
```

---

## 五、演进决策护栏

### 护栏 E-10: 演进决策流程

```
EVOLUTION DECISION PROCESS

1. PROPOSAL:
   - 问题描述
   - 演进方案
   - 影响评估
   - 回滚方案

2. REVIEW:
   - 技术审查
   - 风险评估
   - 护栏检查

3. APPROVAL:
   - 负责人批准
   - 记录决策
   - 定义观察期

4. IMPLEMENTATION:
   - 小步迭代
   - 持续监控
   - 随时回滚

5. POST-MORTEM:
   - 效果评估
   - 经验总结
   - 更新护栏
```

### 护栏 E-11: 演进文档要求

```
EVOLUTION DOCUMENTATION REQUIREMENTS

MUST DOCUMENT:
- 演进原因 (Why)
- 演进方案 (What)
- 实施步骤 (How)
- 验证方法 (Verify)
- 回滚方案 (Rollback)
- 观察指标 (Metrics)

MUST UPDATE:
- 架构文档
- API 文档
- 运维手册
- 护栏文档
```

---

## 六、护栏验证矩阵

| 护栏 | 自动验证 | 手动验证 | 频率 |
|------|---------|---------|------|
| E-0: 演进四原则 | ❌ | ✅ | 设计审查 |
| E-1: Schema 变更 | ✅ | ❌ | 每次变更 |
| E-2: 数据迁移 | ✅ | ❌ | 每次迁移 |
| E-3: 持久化格式 | ✅ | ❌ | 每次变更 |
| E-4: 新功能引入 | ✅ | ❌ | 每次发布 |
| E-5: 功能废弃 | ❌ | ✅ | 每次废弃 |
| E-6: API 演进 | ✅ | ❌ | 每次变更 |
| E-7: 平台化 | ❌ | ✅ | 设计审查 |
| E-8: 多实例 | ❌ | ✅ | 设计审查 |
| E-9: Connector | ❌ | ✅ | 设计审查 |
| E-10: 决策流程 | ❌ | ✅ | 每次决策 |
| E-11: 文档要求 | ❌ | ✅ | 每次变更 |

---

## 七、违反处理

### 7.1 分级

| 级别 | 护栏 | 响应时间 |
|------|------|---------|
| P0 | E-1, E-2, E-4 | 立即 |
| P1 | E-3, E-6, E-10 | 1 小时 |
| P2 | E-5, E-7, E-8, E-9, E-11 | 4 小时 |

### 7.2 处理流程

```
检测到违反
    ↓
停止演进操作
    ↓
记录违反详情
    ↓
分级 (P0/P1/P2)
    ↓
┌─────────────────────┐
│ P0? │ P1? │ P2? │
└─────────────────────┘
    ↓     ↓     ↓
  立即   1h   4h
  回滚   修复   观察
    ↓
根因分析
    ↓
修复 + 预防
```

---

## 八、后续 Phase 指引

### 8.1 Phase 4.x (短期)

**允许**:
- ✅ 乐观锁 (version 字段)
- ✅ Approval 文件持久化
- ✅ Webhook 映射配置化
- ✅ 多实例分布式锁 (基础)

**护栏**:
- E-1: Schema 变更需迁移脚本
- E-4: Feature Flag 控制
- E-7: 不破坏平台边界

### 8.2 Phase 5.x (中期)

**允许**:
- ✅ MCP 集成
- ✅ Skill 系统
- ✅ 插件市场

**护栏**:
- E-7: 通用能力平台化
- E-8: 多实例稳定性验证
- E-9: Connector 标准化

### 8.3 Phase 6.x (长期)

**允许**:
- ✅ 云原生部署
- ✅ 高可用架构
- ✅ 商业化支持

**护栏**:
- E-0: 向后兼容
- E-1: 数据迁移
- E-10: 决策流程

---

_文档版本：1.0  
最后更新：2026-04-05 05:52 CST_
