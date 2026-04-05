# Skill Package / Trust / Registry 架构设计

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标与范围

### 1.1 核心目标

把 OpenClaw 从：

> 有能力模块的开发框架

升级为：

> 有能力分发与治理的平台化系统

**一句话定义**:

> Skill Package 让能力可安装、可版本化、可依赖、可信任管理。

### 1.2 核心价值

| 能力 | 获得的平台化能力 |
|------|-----------------|
| Skill Manifest | 标准化的能力描述 |
| Skill Package | 可安装/卸载的能力包 |
| Skill Registry | 能力注册与查询 |
| Skill Trust | 信任级别与来源验证 |
| Skill Resolver | 依赖解析与冲突处理 |
| Skill Runtime | 与 Agent Runtime 集成 |

### 1.3 不做的事情（边界）

| 不做 | 原因 |
|------|------|
| 替代现有 Tool Runtime | Skill 是能力描述层，不是执行层 |
| 独立权限体系 | 服从现有 PermissionEngine |
| 独立 Agent 调度 | 通过 Agent Teams 统一调度 |
| 过度复杂的版本解析 | 先做简单语义化版本 |

---

## 二、分阶段拆分

### 2.1 阶段划分

```
Sprint 4A: Skill Package Core
    ↓
Sprint 4B: Installer / Resolver
    ↓
Sprint 4C: Trust / Security
    ↓
Sprint 4D: Runtime Integration
```

### 2.2 Sprint 4A: Skill Package Core

**目标**: 建立 package 与 manifest 核心层

**核心模块**:
| 模块 | 职责 |
|------|------|
| `skill_manifest.ts` | Manifest 定义与解析 |
| `skill_package.ts` | Package 描述符 |
| `skill_registry.ts` | Skill 注册与查询 |

**第一版输出对象**:
```typescript
type SkillManifest = {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  
  // 能力声明
  capabilities: SkillCapability[];
  tools?: SkillTool[];
  mcpServers?: string[];
  
  // 依赖
  dependencies?: SkillDependency[];
  
  // 元数据
  trustLevel?: TrustLevel;
  compatibility?: AgentCompatibility;
  
  // 入口
  entryPoint?: string;
  main?: string;
}

type SkillCapability = {
  name: string;
  description: string;
  type: 'tool' | 'mcp' | 'code_intel' | 'automation';
}
```

**验收标准**:
- [ ] 定义标准 manifest 格式
- [ ] package descriptor 完整
- [ ] 注册、查询、版本信息可用

---

### 2.3 Sprint 4B: Installer / Resolver

**目标**: 做安装、依赖与启用逻辑

**核心模块**:
| 模块 | 职责 |
|------|------|
| `skill_installer.ts` | 安装/卸载 |
| `skill_resolver.ts` | 依赖解析 |
| `skill_source.ts` | 来源管理 |

**第一版输出对象**:
```typescript
type SkillSource = 'builtin' | 'workspace' | 'external';

type SkillInstallResult = {
  success: boolean;
  skillId: string;
  version: string;
  error?: string;
};

type DependencyResolution = {
  resolved: SkillDependency[];
  conflicts: DependencyConflict[];
  missing: string[];
};
```

**验收标准**:
- [ ] install / uninstall 可用
- [ ] dependency resolution 工作
- [ ] builtin / workspace / external 区分

---

### 2.4 Sprint 4C: Trust / Security

**目标**: 把 skill 治理纳入平台

**核心模块**:
| 模块 | 职责 |
|------|------|
| `skill_trust.ts` | 信任级别管理 |
| `skill_policy.ts` | 策略管理 |
| `skill_validation.ts` | 验证与审计 |

**第一版输出对象**:
```typescript
type TrustLevel = 'builtin' | 'verified' | 'workspace' | 'external' | 'untrusted';

type SkillTrustPolicy = {
  allowedTrustLevels: TrustLevel[];
  requireApprovalFor: TrustLevel[];
  deniedSkills: string[];
};

type SkillValidationResult = {
  valid: boolean;
  trustLevel: TrustLevel;
  warnings: string[];
  errors: string[];
};
```

**验收标准**:
- [ ] trust level 定义清晰
- [ ] source 验证工作
- [ ] enabled/disabled 控制
- [ ] agent compatibility 校验

---

### 2.5 Sprint 4D: Runtime Integration

**目标**: 把 skill 真正接进 Agent Runtime

**核心模块**:
| 模块 | 职责 |
|------|------|
| `skill_runtime_adapter.ts` | Runtime 适配 |
| `agent_skill_compat.ts` | Agent 兼容性 |
| `skill_capability_view.ts` | 能力视图 |

**第一版输出对象**:
```typescript
type AgentSkillContext = {
  availableSkills: SkillDescriptor[];
  enabledSkills: string[];
  disabledSkills: string[];
  trustWarnings: string[];
};

type SkillRuntimeConfig = {
  skillId: string;
  enabled: boolean;
  trustLevel: TrustLevel;
  capabilities: string[];
};
```

**验收标准**:
- [ ] agent 能查询可用 skill
- [ ] runtime 能根据 trust/compatibility 决定是否加载
- [ ] skill 与 MCP / code intelligence / tool runtime 串起来

---

## 三、Manifest 规范

### 3.1 标准格式

```json
{
  "name": "repo-analyzer",
  "version": "1.2.0",
  "description": "Analyze repository structure and generate insights",
  "author": "OpenClaw Team",
  "license": "MIT",
  
  "capabilities": [
    {
      "name": "repo_analysis",
      "description": "Analyze repository structure",
      "type": "code_intel"
    },
    {
      "name": "dependency_graph",
      "description": "Generate dependency graph",
      "type": "code_intel"
    }
  ],
  
  "tools": [
    {
      "name": "analyze_repo",
      "description": "Analyze a repository",
      "inputSchema": { ... },
      "outputSchema": { ... }
    }
  ],
  
  "mcpServers": ["github", "gdrive"],
  
  "dependencies": [
    {
      "name": "code-intelligence",
      "version": "^2.0.0",
      "required": true
    }
  ],
  
  "trustLevel": "verified",
  
  "compatibility": {
    "minOpenClawVersion": "2026.4.0",
    "requiredAgents": ["planner", "repo_reader"],
    "optionalAgents": ["code_reviewer"]
  },
  
  "entryPoint": "./dist/index.js",
  "main": "index.ts"
}
```

### 3.2 版本规范

**语义化版本**:
```
major.minor.patch

major: 破坏性变更
minor: 向后兼容的功能新增
patch: 向后兼容的问题修复
```

**版本约束**:
```
^1.2.0  - >=1.2.0 <2.0.0
~1.2.0  - >=1.2.0 <1.3.0
>=1.2.0 - 1.2.0 及以上
*       - 任意版本
```

---

## 四、信任级别定义

### 4.1 Trust Level

| 级别 | 说明 | 自动启用 | 需要审批 |
|------|------|---------|---------|
| `builtin` | 系统内置 skill | ✅ | ❌ |
| `verified` | 已验证的外部 skill | ✅ | ❌ |
| `workspace` | 工作区 skill | ✅ | ❌ |
| `external` | 外部来源 skill | ❌ | ✅ |
| `untrusted` | 未信任 skill | ❌ | ✅ |

### 4.2 信任评估

```typescript
type TrustAssessment = {
  source: SkillSource;
  signature?: string;
  author?: string;
  reputation?: number;
  auditStatus?: 'audited' | 'pending' | 'failed';
};
```

---

## 五、与现有主干的接法

### 5.1 与 AgentSpec 集成

```typescript
interface AgentSpec {
  // 现有字段
  id: string;
  role: string;
  
  // Skill 字段（新增）
  requiredSkills?: string[];
  optionalSkills?: string[];
  deniedSkills?: string[];
}
```

### 5.2 与 MCP 集成

```typescript
// Skill 可声明 MCP 依赖
type SkillManifest = {
  // ...
  mcpServers: ['github', 'cicd'];
};

// Skill 可提供 MCP 能力
type SkillCapability = {
  type: 'mcp';
  mcpServer: string;
  mcpTools: string[];
};
```

### 5.3 与 Code Intelligence 集成

```typescript
// Skill 可使用 Code Intelligence
type SkillCapability = {
  type: 'code_intel';
  requiresSymbolIndex: boolean;
  requiresTestDiscovery: boolean;
};
```

### 5.4 与 PermissionEngine 集成

```typescript
// Skill 权限检查
if (skill.trustLevel === 'untrusted') {
  const decision = permissionEngine.evaluate({
    tool: `skill:${skill.name}`,
    riskLevel: 'high',
  });
  
  if (decision.effect === 'deny') {
    throw new Error(`Skill ${skill.name} is denied by policy`);
  }
}
```

---

## 六、目录结构

```
src/skills/
  # 4A: Package Core
  skill_manifest.ts
  skill_package.ts
  skill_registry.ts
  
  # 4B: Installer / Resolver
  skill_installer.ts
  skill_resolver.ts
  skill_source.ts
  
  # 4C: Trust / Security
  skill_trust.ts
  skill_policy.ts
  skill_validation.ts
  
  # 4D: Runtime Integration
  skill_runtime_adapter.ts
  agent_skill_compat.ts
  skill_capability_view.ts
  
  # Types
  types.ts
  index.ts
  
  # Built-in Skills
  builtin/
    code-analysis/
    repo-review/
    test-runner/
```

---

## 七、MVP 验收标准

### 7.1 Sprint 4A MVP

- [ ] 定义标准 manifest 格式
- [ ] package descriptor 完整
- [ ] 注册、查询、版本信息可用

### 7.2 Sprint 4B MVP

- [ ] install / uninstall 可用
- [ ] dependency resolution 工作
- [ ] builtin / workspace / external 区分

### 7.3 Sprint 4C MVP

- [ ] trust level 定义清晰
- [ ] source 验证工作
- [ ] enabled/disabled 控制
- [ ] agent compatibility 校验

### 7.4 Sprint 4D MVP

- [ ] agent 能查询可用 skill
- [ ] runtime 能根据 trust/compatibility 决定是否加载
- [ ] skill 与 MCP / code intelligence / tool runtime 串起来

---

## 八、依赖关系

### 8.1 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|------|
| `semver` | 语义化版本解析 | P0 |
| `zod` / `ajv` | Manifest 验证 | P0 |
| `tar` / `zip` | Package 解压 | P1 |

### 8.2 内部依赖

| 模块 | 依赖 |
|------|------|
| Skill Registry | AgentSpec (types) |
| Skill Trust | PermissionEngine |
| Skill Runtime | Agent Teams (runtime) |
| Skill Installer | MCP Registry (optional) |

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Skill 来源不可信 | 高 | 强制 trust level + 审批 |
| 依赖冲突 | 中 | 简单版本解析 + 冲突报告 |
| 版本不兼容 | 中 | compatibility 声明 + 验证 |
| 权限逃逸 | 高 | 服从现有 PermissionEngine |

---

**下一步**: 开始 Sprint 4A 实现

---

_Skill Package 是让 OpenClaw 从"框架"迈向"平台"的关键。_
