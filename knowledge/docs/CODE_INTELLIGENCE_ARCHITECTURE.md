# Code Intelligence Layer 架构设计

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标与范围

### 1.1 核心目标

把 OpenClaw 从：

> 能调度多个代理的系统

升级为：

> 能让多个代理真正理解代码库的系统

**一句话定义**:

> Agent Teams 负责分工，Code Intelligence 负责让分工建立在真实代码结构之上。

### 1.2 核心价值

| 角色 | 获得的能力增强 |
|------|---------------|
| `planner` | 基于真实 entrypoints 和模块结构做规划 |
| `repo_reader` | 基于 repo map 快速定位核心模块 |
| `code_reviewer` | 基于 symbol references 评估影响范围 |
| `code_fixer` | 基于 definition lookup 理解现有代码 |
| `verify_agent` | 基于 test mapping 精准选择测试 |

### 1.3 不做的事情（边界）

| 不做 | 原因 |
|------|------|
| 完整 LSP 平台 | LSP 是增强层，不是前置依赖 |
| 支持太多语言 | 先做好 TS/JS + Python |
| 复杂 IDE 交互 | 聚焦 agent 上下文增强 |
| 分散接入各 agent | 统一服务层，不是私有功能 |

---

## 二、分阶段拆分

### 2.1 阶段划分

```
Sprint 2A: Repo Understanding Foundation
    ↓
Sprint 2B: Symbol Intelligence
    ↓
Sprint 2C: Test & Impact Intelligence
    ↓
Sprint 2D: LSP Bridge
```

### 2.2 Sprint 2A: Repo Understanding Foundation

**目标**: 建立代码库级别的结构理解

**核心模块**:
| 模块 | 职责 |
|------|------|
| `project_detector.ts` | 识别项目类型、语言、框架 |
| `repo_map.ts` | 生成目录拓扑、标记核心模块 |
| `entrypoint_discovery.ts` | 发现应用/CLI/服务/worker 入口 |
| `module_classifier.ts` | 分类模块（app/lib/tests/infra） |
| `code_context_service.ts` | 统一服务接口 |

**第一版输出**:
```typescript
type RepoProfile = {
  repoRoot: string;
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  entrypoints: string[];
  importantPaths: {
    app: string[];
    lib: string[];
    tests: string[];
    infra: string[];
    scripts: string[];
    docs: string[];
  };
}
```

**验收标准**:
- [ ] 能识别 repo 的主要语言与项目类型
- [ ] 能生成基础 repo map
- [ ] 能发现主要 entrypoints
- [ ] 支持 TypeScript/JavaScript + Python

---

### 2.3 Sprint 2B: Symbol Intelligence

**目标**: 建立符号级理解

**核心模块**:
| 模块 | 职责 |
|------|------|
| `symbol_index.ts` | 建立 symbol → definition 索引 |
| `definition_lookup.ts` | 查找符号定义 |
| `reference_search.ts` | 查找符号引用 |
| `call_graph.ts` | 构建调用关系图 |
| `symbol_query.ts` | 统一查询接口 |

**第一版输出**:
```typescript
type SymbolRef = {
  name: string;
  kind: "function" | "class" | "method" | "type" | "interface" | "module";
  file: string;
  line: number;
  language: string;
}

type SymbolRelation = {
  from: SymbolRef;
  to: SymbolRef;
  relation: "calls" | "imports" | "inherits" | "references";
}
```

**验收标准**:
- [ ] 能为 TS/JS 与 Python 建立基础 symbol index
- [ ] 能查询 symbol definition / references
- [ ] 能构建简单调用关系图

---

### 2.4 Sprint 2C: Test & Impact Intelligence

**目标**: 实现"改了哪，应该测哪"

**核心模块**:
| 模块 | 职责 |
|------|------|
| `test_discovery.ts` | 发现测试文件与框架 |
| `test_mapper.ts` | 映射文件→测试关系 |
| `patch_impact.ts` | 分析改动影响范围 |
| `verification_scope.ts` | 建议验证范围 |

**第一版输出**:
```typescript
type ImpactReport = {
  changedFiles: string[];
  impactedSymbols: SymbolRef[];
  relatedTests: string[];
  risk: "low" | "medium" | "high";
  suggestedVerificationScope: "smoke" | "targeted" | "broad";
}
```

**验收标准**:
- [ ] 能发现测试文件
- [ ] 能生成 impact report
- [ ] 能建议验证范围

---

### 2.5 Sprint 2D: LSP Bridge

**目标**: 有 LSP 时获得更高精度，无 LSP 时优雅降级

**核心模块**:
| 模块 | 职责 |
|------|------|
| `lsp_bridge.ts` | LSP 客户端桥接 |
| `lsp_client_pool.ts` | LSP 客户端池管理 |
| `parser_fallback.ts` | Parser 降级方案 |
| `index_cache.ts` | 索引缓存 |

**Fallback 策略**:
```
有 LSP → 用 LSP
无 LSP → 用 parser / static scan
再不行 → 用 grep/fallback
```

**验收标准**:
- [ ] 能连接 TypeScript/Python LSP
- [ ] LSP 不可用时优雅降级
- [ ] 索引有缓存机制

---

## 三、统一类型设计

### 3.1 核心类型

```typescript
// 代码库画像
type RepoProfile = {
  repoRoot: string;
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  entrypoints: string[];
  importantPaths: ImportantPaths;
}

// 重要路径分类
type ImportantPaths = {
  app: string[];       // 应用入口
  lib: string[];       // 库代码
  tests: string[];     // 测试
  infra: string[];     // 基础设施
  scripts: string[];   // 脚本
  docs: string[];      // 文档
}

// 符号引用
type SymbolRef = {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  column?: number;
  language: string;
  endLine?: number;
  endColumn?: number;
}

type SymbolKind = 
  | "function"
  | "class"
  | "method"
  | "type"
  | "interface"
  | "module"
  | "variable"
  | "constant"
  | "parameter";

// 符号关系
type SymbolRelation = {
  from: SymbolRef;
  to: SymbolRef;
  relation: RelationType;
}

type RelationType = 
  | "calls"        // 调用
  | "imports"      // 导入
  | "inherits"     // 继承
  | "references"   // 引用
  | "implements"   // 实现
  | "extends";     // 扩展

// 影响报告
type ImpactReport = {
  changedFiles: string[];
  impactedSymbols: SymbolRef[];
  relatedTests: string[];
  risk: RiskLevel;
  suggestedVerificationScope: VerificationScope;
}

type RiskLevel = "low" | "medium" | "high" | "critical";

type VerificationScope = 
  | "smoke"     // 冒烟测试
  | "targeted"  // 针对性测试
  | "broad";    // 广泛测试
```

### 3.2 服务接口

```typescript
// Code Intelligence 统一服务接口
interface ICodeIntelligenceService {
  // Repo Understanding
  getRepoProfile(repoRoot: string): Promise<RepoProfile>;
  getRepoMap(repoRoot: string): Promise<RepoMap>;
  getEntrypoints(repoRoot: string): Promise<string[]>;
  
  // Symbol Intelligence
  indexSymbols(repoRoot: string, options?: IndexOptions): Promise<SymbolIndex>;
  findDefinition(symbol: SymbolRef): Promise<SymbolRef | null>;
  findReferences(symbol: SymbolRef): Promise<SymbolRef[]>;
  getCallGraph(symbol: SymbolRef): Promise<CallGraph>;
  
  // Test & Impact
  discoverTests(repoRoot: string): Promise<TestInfo[]>;
  mapTestsToCode(repoRoot: string): Promise<TestMapping>;
  analyzeImpact(changedFiles: string[], repoRoot: string): Promise<ImpactReport>;
  
  // Context Building
  buildContextForTask(
    task: SubagentTask,
    repoRoot: string
  ): Promise<CodeContext>;
}

// 代码上下文（注入给 agent）
type CodeContext = {
  // 任务相关
  taskId: string;
  role: SubagentRole;
  
  // Repo 信息
  repoProfile?: RepoProfile;
  repoMap?: RepoMap;
  
  // 符号信息
  relevantSymbols?: SymbolRef[];
  symbolSummaries?: SymbolSummary[];
  
  // 影响分析
  impactReport?: ImpactReport;
  
  // 测试建议
  suggestedTests?: string[];
  verificationScope?: VerificationScope;
  
  // 文件内容（按需加载）
  files?: Map<string, string>;
}
```

---

## 四、Fallback 策略

### 4.1 精度层级

```
Level 1 (最高精度): LSP
  - definition/references 100% 准确
  - 支持 rename/find all references
  - 需要语言服务器运行

Level 2 (中等精度): Parser
  - 基于 AST 解析
  - 能识别大部分符号
  - 无需语言服务器

Level 3 (基础精度): Static Scan
  - 基于正则/模式匹配
  - 能识别基本符号
  - 可能有误报/漏报

Level 4 (最低精度): Grep
  - 文本搜索
  - 仅作为最后手段
```

### 4.2 降级逻辑

```typescript
async function findDefinition(symbol: SymbolRef): Promise<SymbolRef | null> {
  // Try LSP first
  if (lspBridge.isAvailable(symbol.language)) {
    const result = await lspBridge.findDefinition(symbol);
    if (result) return result;
  }
  
  // Fallback to parser
  const parserResult = await parserFallback.findDefinition(symbol);
  if (parserResult) return parserResult;
  
  // Fallback to static scan
  const scanResult = await staticScan.findDefinition(symbol);
  if (scanResult) return scanResult;
  
  // Last resort: grep
  return await grepSearch.findDefinition(symbol);
}
```

### 4.3 语言支持优先级

| 优先级 | 语言 | LSP 支持 | Parser 支持 |
|--------|------|---------|------------|
| P0 | TypeScript | ✅ tsserver | ✅ tree-sitter |
| P0 | JavaScript | ✅ tsserver | ✅ tree-sitter |
| P0 | Python | ✅ pyright | ✅ tree-sitter |
| P1 | Go | ✅ gopls | ✅ tree-sitter |
| P1 | Rust | ✅ rust-analyzer | ✅ tree-sitter |
| P2 | Java | ✅ jdtls | ⚠️ 有限 |
| P2 | C/C++ | ✅ clangd | ⚠️ 有限 |

---

## 五、与 Agent Teams 的集成点

### 5.1 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Teams                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ planner  │ │reviewer  │ │ fixer    │ │ verifier │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │            │             │
│       └────────────┴────────────┴────────────┘             │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Code Intelligence Service                  │   │
│  │  - getRepoProfile()                                  │   │
│  │  - findRelevantSymbols()                             │   │
│  │  - getImpactReport()                                 │   │
│  │  - suggestVerificationScope()                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Repo       │  │ Symbol     │  │ Test &     │           │
│  │ Understand │  │ Intelligence│ │ Impact     │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 角色上下文注入

#### planner_agent
```typescript
const context = await codeIntelligence.buildContextForTask(task, repoRoot);

// 注入：
// - repoProfile (项目类型、语言、框架)
// - entrypoints (入口点)
// - importantPaths (核心目录)
```

#### repo_reader
```typescript
const context = await codeIntelligence.buildContextForTask(task, repoRoot);

// 注入：
// - repoMap (目录拓扑)
// - moduleSummaries (模块摘要)
```

#### code_reviewer
```typescript
const context = await codeIntelligence.buildContextForTask(task, repoRoot);

// 注入：
// - relevantSymbols (相关符号)
// - references (引用关系)
// - nearbyTests (附近测试)
```

#### code_fixer
```typescript
const context = await codeIntelligence.buildContextForTask(task, repoRoot);

// 注入：
// - definition (符号定义)
// - impactedFiles (影响文件)
// - relatedTests (相关测试)
```

#### verify_agent
```typescript
const context = await codeIntelligence.buildContextForTask(task, repoRoot);

// 注入：
// - impactReport (影响报告)
// - suggestedTests (建议测试)
// - verificationScope (验证范围)
```

### 5.3 统一接入点

```typescript
// 在 SubagentExecutor 中注入
class SubagentExecutor {
  private codeIntelligence?: ICodeIntelligenceService;
  
  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    // 构建提示词前，先获取代码上下文
    const codeContext = await this.buildCodeContext(input.task);
    
    // 注入到提示词
    const { systemPrompt, userPrompt } = this.buildPrompt({
      ...input,
      codeContext,
    });
    
    // ...执行模型调用
  }
  
  private async buildCodeContext(task: SubagentTask): Promise<CodeContext> {
    if (!this.codeIntelligence) {
      return {}; // 无 Code Intelligence 时返回空上下文
    }
    
    return await this.codeIntelligence.buildContextForTask(
      task,
      this.workspaceRoot
    );
  }
}
```

---

## 六、支持语言优先级

### 6.1 第一阶段 (Sprint 2A/2B)

| 语言 | Repo Understanding | Symbol Intelligence |
|------|-------------------|---------------------|
| TypeScript | ✅ | ✅ |
| JavaScript | ✅ | ✅ |
| Python | ✅ | ✅ |

### 6.2 第二阶段 (Sprint 2C)

| 语言 | Test & Impact |
|------|---------------|
| TypeScript | ✅ |
| JavaScript | ✅ |
| Python | ✅ |

### 6.3 第三阶段 (Sprint 2D)

| 语言 | LSP Bridge |
|------|------------|
| TypeScript | ✅ tsserver |
| JavaScript | ✅ tsserver |
| Python | ✅ pyright |
| Go | 🔜 gopls |
| Rust | 🔜 rust-analyzer |

---

## 七、MVP 验收标准

### 7.1 Sprint 2A MVP

- [ ] 能识别 repo 的主要语言与项目类型
- [ ] 能生成基础 repo map
- [ ] 能发现主要 entrypoints
- [ ] 支持 TypeScript/JavaScript + Python

### 7.2 Sprint 2B MVP

- [ ] 能为 TS/JS 与 Python 建立基础 symbol index
- [ ] 能查询 symbol definition / references
- [ ] 能构建简单调用关系图

### 7.3 Sprint 2C MVP

- [ ] 能发现测试文件
- [ ] 能生成 impact report
- [ ] 能建议验证范围

### 7.4 Sprint 2D MVP

- [ ] 能连接 TypeScript/Python LSP
- [ ] LSP 不可用时优雅降级
- [ ] 索引有缓存机制

---

## 八、目录结构

```
src/code/
  # 2A: Repo Understanding
  project_detector.ts
  repo_map.ts
  entrypoint_discovery.ts
  module_classifier.ts
  code_context_service.ts
  
  # 2B: Symbol Intelligence
  symbol_index.ts
  definition_lookup.ts
  reference_search.ts
  call_graph.ts
  symbol_query.ts
  
  # 2C: Test & Impact
  test_discovery.ts
  test_mapper.ts
  patch_impact.ts
  verification_scope.ts
  
  # 2D: LSP Bridge
  lsp_bridge.ts
  lsp_client_pool.ts
  parser_fallback.ts
  index_cache.ts
  
  # 公共
  types.ts
  utils.ts
  index.ts
  
  # 测试
  tests/
    project_detector.test.ts
    repo_map.test.ts
    symbol_index.test.ts
    test_discovery.test.ts
    lsp_bridge.test.ts
```

---

## 九、依赖关系

### 9.1 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|------|
| `tree-sitter` | AST 解析 | P0 |
| `tree-sitter-typescript` | TS/JS parser | P0 |
| `tree-sitter-python` | Python parser | P0 |
| `vscode-languageserver` | LSP 客户端 | P1 |
| `glob` | 文件匹配 | P0 |
| `fast-glob` | 快速文件遍历 | P0 |

### 9.2 内部依赖

| 模块 | 依赖 |
|------|------|
| Code Intelligence | Agent Teams (types) |
| LSP Bridge | Symbol Intelligence |
| Test & Impact | Symbol Intelligence |
| Symbol Intelligence | Repo Understanding |

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LSP 连接不稳定 | 中 | Fallback 到 parser |
| Parser 精度不足 | 中 | 多引擎校验 |
| 索引构建慢 | 低 | 增量索引 + 缓存 |
| 内存占用高 | 中 | 流式处理 + 分页 |
| 多语言支持复杂 | 低 | 先做好 TS/JS + Python |

---

**下一步**: 开始 Sprint 2A 实现

---

_Code Intelligence 是让 Agent Teams 真正理解代码的关键。_
