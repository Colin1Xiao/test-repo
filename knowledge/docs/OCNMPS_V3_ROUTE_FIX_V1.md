# OCNMPS V3 路由异常修复方案 v1

**文档状态**: Draft  
**创建时间**: 2026-04-04 18:30 (Asia/Shanghai)  
**优先级**: P0 - 阻塞灰度验收  
**负责人**: Colin

---

## 📋 执行摘要

### 问题概述

OCNMPS V3 灰度期间持续出现路由异常，24 小时内 10 次错误，全部收敛于同一错误：

```
resolved.model.split is not a function or its return value is not iterable
```

### 优先级判断

| 问题 | 优先级 | 影响 |
|------|--------|------|
| V3 Routing Error | **P0** | 灰度命中请求直接报错 |
| 灰度命中率偏低 | P1 | 仅影响样本代表性 |

**结论**: 先修 Routing Error，再查灰度比例。

---

## 🔍 根因分析

### 错误特征

- **错误类型**: TypeError
- **错误位置**: `resolved.model.split('/')`
- **根本原因**: `resolved.model` 不是字符串类型
- **错误频率**: 04-03 (5 次) + 04-04 (5 次) = 10 次/2 天

### 可能的数据类型

`resolved.model` 实际可能是：

```javascript
null
undefined
{ provider: "modelstudio", model: "qwen3.5-plus" }
{ name: "modelstudio/qwen3.5-plus" }
{ modelId: "qwen3.5-plus" }
["modelstudio", "qwen3.5-plus"]
```

### 代码位置

**Workspace 插件** (`~/.openclaw/plugins/ocnmps-router/plugin.js`):
- 第 153 行已有防御性处理，但可能不是错误来源

**Gateway 内置子系统** (`/usr/local/lib/node_modules/openclaw/dist/`):
- 真正的错误来源（错误日志来自 Gateway）
- 需要定位具体文件

---

## 🛠️ 修复方案

### 方案 A: 临时止血（立即执行）

**目标**: 防止错误继续影响用户

**代码修改** (Gateway 内置 OCNMPS 子系统):

```javascript
// 原代码（假设）
const [provider, model] = resolved.model.split('/');

// 修复后
const rawModel = resolved?.model;

if (typeof rawModel !== 'string') {
  logger.error('v3_route_invalid_model_shape', {
    resolved,
    modelType: typeof rawModel,
    modelConstructor: rawModel?.constructor?.name,
  });
  // Fallback 到默认模型
  return {
    provider: 'modelstudio',
    model: 'qwen3.5-plus',
    fallbackReason: 'invalid_model_shape',
  };
}

const parts = rawModel.split('/');
const provider = parts[0] || 'modelstudio';
const model = parts.slice(1).join('/') || parts[0];
```

**验收标准**:
- [ ] 同类错误不再出现
- [ ] 错误日志包含结构化数据（便于追踪来源）
- [ ] 用户请求正常完成（fallback 生效）

---

### 方案 B: 统一模型解析契约（紧接着执行）

**目标**: 消除散落的 `.split()` 调用，建立单一可信入口

#### 1. 类型定义

```typescript
// 统一模型解析结果
interface ResolvedModel {
  raw: string | null;           // 原始输入
  provider: string | null;      // 提供商
  model: string | null;         // 模型名
  isValid: boolean;             // 是否有效
}

// 路由决策结果
interface RouteDecision {
  intent: string;
  recommendedModel: string;
  finalModel: string;
  grayHit: boolean;
  model: ResolvedModel;         // 结构化模型信息
}
```

#### 2. 统一解析函数

```javascript
/**
 * 统一模型解析（单一可信入口）
 * @param {unknown} input - 可能是 string/object/null/undefined
 * @returns {ResolvedModel}
 */
function normalizeResolvedModel(input) {
  const result = {
    raw: null,
    provider: null,
    model: null,
    isValid: false,
  };

  // 处理 null/undefined
  if (input == null) {
    return result;
  }

  // 处理字符串
  if (typeof input === 'string') {
    result.raw = input;
    const parts = input.split('/');
    if (parts.length >= 2) {
      result.provider = parts[0];
      result.model = parts.slice(1).join('/');
    } else {
      result.model = parts[0];
      result.provider = 'modelstudio'; // 默认
    }
    result.isValid = true;
    return result;
  }

  // 处理对象
  if (typeof input === 'object') {
    if (input.provider && input.model) {
      result.provider = input.provider;
      result.model = input.model;
      result.raw = `${input.provider}/${input.model}`;
      result.isValid = true;
    } else if (input.name) {
      result.raw = input.name;
      const parts = input.name.split('/');
      if (parts.length >= 2) {
        result.provider = parts[0];
        result.model = parts.slice(1).join('/');
      } else {
        result.model = input.name;
        result.provider = 'modelstudio';
      }
      result.isValid = true;
    } else if (input.modelId) {
      result.model = input.modelId;
      result.raw = input.modelId;
      result.provider = 'modelstudio';
      result.isValid = true;
    }
    return result;
  }

  // 其他类型（数组等）
  try {
    result.raw = String(input);
    result.model = result.raw;
    result.provider = 'modelstudio';
    result.isValid = true;
  } catch (e) {
    // 无法转换，保持 invalid
  }

  return result;
}
```

#### 3. 下游使用

```javascript
// ❌ 错误用法（散落各处）
const [provider, model] = resolved.model.split('/');

// ✅ 正确用法（统一入口）
const modelInfo = normalizeResolvedModel(resolved.model);

if (!modelInfo.isValid) {
  logger.error('invalid_model', { resolved, modelInfo });
  return fallbackRoute();
}

const { provider, model } = modelInfo;
```

**验收标准**:
- [ ] 全项目不再出现 `resolved.model.split()`
- [ ] 所有模型解析通过 `normalizeResolvedModel()`
- [ ] 类型定义文档化

---

### 方案 C: 灰度配置核验（Routing Error 修复后执行）

**目标**: 解释为什么灰度命中率只有 3-4%（预期 30%）

#### 检查清单

| 检查项 | 预期值 | 实际值 | 状态 |
|--------|--------|--------|------|
| `grayRatio` 配置 | 0.30 | ? | 待查 |
| Hash Bucket 空间 | 0-9999 | ? | 待查 |
| Hit 判定条件 | `bucket < threshold` | ? | 待查 |
| 统计样本口径 | 全部 eligible 请求 | ? | 待查 |

#### 可能原因

1. **单位不一致**: 配置 0.30，代码按 0-100 读（应为 0-1）
2. **Bucket 范围错误**: 阈值计算错误
3. **统计口径问题**: 只统计了部分流量
4. **二次过滤**: 灰度命中后被其他条件过滤

#### 验证方法

```bash
# 1. 查看当前配置
cat ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin_config.json | jq .grayRatio

# 2. 查看 Gateway 日志中的实际灰度比例
grep "grayRatio" ~/.openclaw/logs/gateway.log | tail -20

# 3. 手动计算命中率
# 最近 100 次请求中 grayHit=true 的数量 / 100
```

**验收标准**:
- [ ] 能数学上解释当前 3-4% 命中率
- [ ] 修正后命中率接近 30%（±5%）

---

## 📊 影响评估

### 当前风险

| 风险 | 等级 | 说明 |
|------|------|------|
| 用户请求失败 | 🟡 中 | 有 fallback，但体验受损 |
| 灰度数据污染 | 🟡 中 | 错误样本无法用于分析 |
| 问题扩大 | 🟢 低 | 错误频率稳定，未上升 |

### 修复风险

| 操作 | 风险 | 缓解措施 |
|------|------|----------|
| 方案 A（临时止血） | 🟢 低 | 仅增加防御，不改变逻辑 |
| 方案 B（统一契约） | 🟡 中 | 需全面回归测试 |
| 方案 C（灰度配置） | 🟢 低 | 仅配置调整 |

---

## ✅ 验收标准

### Phase 1: 临时止血（P0）

- [ ] 同类错误 24 小时内不再出现
- [ ] 错误日志包含结构化数据
- [ ] 用户请求 100% 正常完成

### Phase 2: 统一契约（P1）

- [ ] 代码审查：无散落 `.split()` 调用
- [ ] 回归测试：50 样本无异常
- [ ] 类型定义文档化

### Phase 3: 灰度校正（P2）

- [ ] 灰度命中率 25-35%（目标 30%）
- [ ] 配置文档更新
- [ ] 监控告警配置

---

## 🚫 灰度期间禁止事项

1. **禁止扩大灰度比例** — 在 Routing Error 修复前
2. **禁止放宽路由逻辑** — 避免引入更多异常
3. **禁止跳过回归测试** — 每次修改必须验证
4. **禁止直接修改生产配置** — 必须经过测试环境

---

## 📝 执行计划

| 阶段 | 任务 | 预计时间 | 状态 |
|------|------|----------|------|
| Phase 1 | 临时止血补丁 | 1 小时 | 待执行 |
| Phase 1 | 验证补丁效果 | 24 小时观察 | 待执行 |
| Phase 2 | 统一解析契约 | 4 小时 | 待执行 |
| Phase 2 | 回归测试 | 2 小时 | 待执行 |
| Phase 3 | 灰度配置核验 | 2 小时 | 待执行 |
| Phase 3 | 灰度比例调整 | 1 小时 | 待执行 |

---

## 📎 附录

### A. 错误日志示例

```json
{
  "timestamp": "2026-04-04T17:59:48+08:00",
  "level": "error",
  "message": "resolved.model.split is not a function or its return value is not iterable"
}
```

### B. 相关文件

- `~/.openclaw/plugins/ocnmps-router/plugin.js`
- `~/.openclaw/plugins/ocnmps-router/ocnmps_core.js`
- `~/.openclaw/plugins/ocnmps-router/ocnmps_plugin_config.json`
- `/usr/local/lib/node_modules/openclaw/dist/` (Gateway 内置)

### C. 参考文档

- [OCNMPS V3 架构文档](./OCNMPS_V3_ARCHITECTURE.md)
- [灰度配置一致性验证](./OCNMPS_CONFIG_CONSISTENCY.md)

---

**最后更新**: 2026-04-04 18:30  
**下次审查**: 修复完成后
