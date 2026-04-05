# OCNMPS V3 P1 源级修复计划

**文档状态**: Draft  
**创建时间**: 2026-04-04 18:45 (Asia/Shanghai)  
**优先级**: P1 - 非紧急但必要  
**预计工作量**: 4-8 小时

---

## 📋 背景

### 当前状态

- **P0 补丁位置**: `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js`
- **修复函数**: `splitModelRef(ref)`
- **修复方式**: 类型守卫 + 对象兼容
- **风险**: 升级/重装会丢失

### 为什么需要 P1

| 问题 | P0 热修 | P1 源修 |
|------|--------|--------|
| 持久性 | ❌ 升级覆盖 | ✅ 版本固化 |
| 可追溯 | ❌ 无 commit | ✅ Git 历史 |
| 可测试 | ❌ 手动验证 | ✅ 自动化测试 |
| 类型安全 | ❌ 运行时检查 | ✅ 编译时检查 |
| 最佳实践 | ❌ 防御性补丁 | ✅ 契约统一 |

---

## 🎯 目标

### 核心目标

1. **统一模型引用契约** — 明确字符串 vs 对象
2. **收口解析责任** — 单一可信入口
3. **消除类型猜测** — 下游不再猜类型
4. **源码固化** — 纳入正式版本

### 验收标准

- [ ] 全项目不再散落 `resolved.model.split()`
- [ ] 统一使用 `normalizeResolvedModel()` 或等价函数
- [ ] TypeScript 类型定义完整
- [ ] 自动化测试覆盖
- [ ] 通过 CI/CD 流水线
- [ ] 发布新版本

---

## 🔍 待定位源码

### 已知信息

| 函数 | 编译产物 | 源码待定位 |
|------|---------|-----------|
| `splitModelRef()` | `pi-embedded-BYdcxQ5A.js:22323` | `src/agents/pi-embedded-runner/???.ts` |
| `resolveHookModelSelection()` | `pi-embedded-BYdcxQ5A.js:39330` | `src/agents/pi-embedded-runner/run/setup.ts` |
| `resolveSubagentSpawnModelSelection()` | `model-selection-8a6zD_aX.js:316` | `src/model-selection/???.ts` |

### 源码目录结构

```
openclaw/
├── src/
│   ├── agents/
│   │   └── pi-embedded-runner/
│   │       ├── run.ts
│   │       ├── run/
│   │       │   └── setup.ts
│   │       └── subagent/
│   │           └── spawn.ts
│   ├── model-selection/
│   │   ├── index.ts
│   │   ├── model-ref.ts
│   │   └── subagent-model.ts
│   └── plugin-sdk/
│       └── src/
│           └── plugins/
│               └── types.d.ts
├── dist/  (编译产物，不要直接修改)
└── package.json
```

---

## 🛠️ 修复方案

### Step 1: 定位源码文件

**任务**: 找到 `splitModelRef()` 的源码定义

**方法**:

```bash
# 1. 搜索源码
cd /usr/local/lib/node_modules/openclaw
grep -rn "function splitModelRef" src/

# 2. 或搜索导出
grep -rn "splitModelRef" src/ --include="*.ts"

# 3. 查看 package.json 了解 build 流程
cat package.json | grep -A5 '"scripts"'
```

**预期结果**: `src/agents/pi-embedded-runner/subagent/spawn.ts` 或类似

---

### Step 2: 定义统一类型契约

**目标**: 明确模型引用的标准格式

**类型定义** (TypeScript):

```typescript
// 模型引用（统一格式）
type ModelRef = string | { provider: string; model: string };

// 解析结果（结构化）
interface ResolvedModel {
  provider: string;
  model: string;
  raw: ModelRef;
  isValid: boolean;
}

// 路由决策结果
interface RouteDecision {
  intent: string;
  recommendedModel: string;
  finalModel: string;
  grayHit: boolean;
  model: ResolvedModel;
}
```

---

### Step 3: 实现统一解析函数

**位置**: `src/model-selection/model-ref.ts` (新建或现有)

```typescript
/**
 * 统一模型解析（单一可信入口）
 * @param ref - 可能是 string 或 { provider, model }
 * @returns 结构化的 ResolvedModel
 */
function normalizeModelRef(ref: ModelRef): ResolvedModel {
  const result: ResolvedModel = {
    provider: '',
    model: '',
    raw: ref,
    isValid: false,
  };

  // 处理 null/undefined
  if (ref == null) {
    return result;
  }

  // 处理字符串
  if (typeof ref === 'string') {
    result.raw = ref;
    const trimmed = ref.trim();
    if (!trimmed) {
      return result;
    }
    
    const parts = trimmed.split('/');
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
  if (typeof ref === 'object') {
    if (ref.provider && ref.model) {
      result.provider = ref.provider;
      result.model = ref.model;
      result.raw = `${ref.provider}/${ref.model}`;
      result.isValid = true;
    }
    return result;
  }

  // 其他类型（防御性）
  console.warn('[normalizeModelRef] Unexpected type', { ref, type: typeof ref });
  return result;
}

/**
 * 旧函数 splitModelRef 的兼容性封装
 * @deprecated 使用 normalizeModelRef 代替
 */
function splitModelRef(ref: ModelRef): { provider?: string; model?: string } {
  const resolved = normalizeModelRef(ref);
  return {
    provider: resolved.isValid ? resolved.provider : undefined,
    model: resolved.isValid ? resolved.model : undefined,
  };
}
```

---

### Step 4: 替换所有消费点

**搜索所有调用点**:

```bash
grep -rn "\.split.*/" src/ --include="*.ts" | grep -i model
```

**替换模式**:

```typescript
// ❌ 旧代码（散落各处）
const [provider, model] = resolved.model.split('/');

// ✅ 新代码（统一入口）
const modelInfo = normalizeModelRef(resolved.model);
if (!modelInfo.isValid) {
  logger.error('invalid_model', { resolved, modelInfo });
  return fallbackRoute();
}
const { provider, model } = modelInfo;
```

---

### Step 5: 添加类型检查

**启用严格模式** (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**添加类型测试**:

```typescript
// src/model-selection/__tests__/model-ref.test.ts
import { normalizeModelRef } from '../model-ref';

describe('normalizeModelRef', () => {
  it('should parse string format', () => {
    const result = normalizeModelRef('provider/model');
    expect(result.provider).toBe('provider');
    expect(result.model).toBe('model');
    expect(result.isValid).toBe(true);
  });

  it('should parse object format', () => {
    const result = normalizeModelRef({ provider: 'p', model: 'm' });
    expect(result.provider).toBe('p');
    expect(result.model).toBe('m');
    expect(result.isValid).toBe(true);
  });

  it('should handle null/undefined', () => {
    expect(normalizeModelRef(null).isValid).toBe(false);
    expect(normalizeModelRef(undefined).isValid).toBe(false);
  });
});
```

---

### Step 6: Build & Test

**构建流程**:

```bash
# 1. 安装依赖
npm install

# 2. 运行测试
npm test

# 3. 构建
npm run build

# 4. 验证产物
ls -la dist/
```

**验证清单**:

- [ ] TypeScript 编译无错误
- [ ] 单元测试通过率 100%
- [ ] 集成测试通过
- [ ] 产物文件大小正常
- [ ] 版本号更新

---

### Step 7: 发布 & 替换

**发布流程**:

```bash
# 1. 更新版本号
npm version patch  # 或 minor/major

# 2. 提交 Git
git add .
git commit -m "fix: unify model reference type contract

- Add normalizeModelRef() as single source of truth
- Deprecate splitModelRef() in favor of structured parsing
- Add TypeScript type definitions
- Add unit tests

Fixes: OCNMPS V3 routing error (resolved.model.split is not a function)"

# 3. 推送到仓库
git push origin main
git push --tags

# 4. 发布 npm (如适用)
npm publish
```

**替换热修**:

```bash
# 1. 备份热修文件
cp /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js \
   /tmp/pi-embedded-BYdcxQ5A.js.hotfix.bak

# 2. 安装新版本
npm install -g openclaw@latest

# 3. 验证新版本包含修复
grep -c "normalizeModelRef" /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js

# 4. 重启 Gateway
openclaw gateway restart
```

---

## 📋 任务清单

| 任务 | 状态 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 定位源码文件 | ⏳ 待执行 | 1 小时 | Colin |
| 定义类型契约 | ⏳ 待执行 | 1 小时 | Colin |
| 实现统一解析函数 | ⏳ 待执行 | 2 小时 | Colin |
| 替换所有消费点 | ⏳ 待执行 | 2 小时 | Colin |
| 添加类型检查 | ⏳ 待执行 | 1 小时 | Colin |
| Build & Test | ⏳ 待执行 | 1 小时 | Colin |
| 发布 & 替换 | ⏳ 待执行 | 1 小时 | Colin |

**总计**: 9 小时

---

## 🚨 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 源码定位失败 | 中 | 中 | 联系 OpenClaw 核心团队 |
| 破坏性变更 | 低 | 高 | 保留兼容性封装 |
| 测试覆盖率不足 | 中 | 中 | 手动回归测试 |
| 发布流程复杂 | 低 | 低 | 提前准备 release note |

---

## 📎 附录

### A. 相关文件

- **P0 补丁**: `OCNMPS_V3_GATEWAY_PATCH_P0.md`
- **P0 观察清单**: `OCNMPS_V3_P0_OBSERVE_24H.md`
- **完整修复方案**: `OCNMPS_V3_ROUTE_FIX_V1.md`

### B. 参考代码

- `splitModelRef()` 当前实现 (热修版)
- `normalizeModelRef()` 目标实现 (待实现)
- TypeScript 类型定义 (待添加)

### C. 命令速查

```bash
# 定位源码
grep -rn "splitModelRef" src/ --include="*.ts"

# 构建
npm run build

# 测试
npm test

# 发布
npm version patch && npm publish
```

---

**最后更新**: 2026-04-04 18:45  
**下次审查**: P0 观察期结束后  
**负责人**: Colin
