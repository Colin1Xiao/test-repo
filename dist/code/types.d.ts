/**
 * Code Intelligence Types - 统一类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 2A: Repo Understanding
 * Sprint 2B: Symbol Intelligence
 * Sprint 2C: Test & Impact Intelligence
 * Sprint 2D: LSP Bridge
 */
/**
 * 代码库画像
 */
export interface RepoProfile {
    /** 仓库根目录 */
    repoRoot: string;
    /** 编程语言 */
    languages: string[];
    /** 框架 */
    frameworks: string[];
    /** 包管理器 */
    packageManagers: string[];
    /** 构建系统 */
    buildSystems: string[];
    /** 测试框架 */
    testFrameworks: string[];
    /** 入口点 */
    entrypoints: Entrypoint[];
    /** 重要路径分类 */
    importantPaths: ImportantPaths;
    /** 检测证据（用于调试） */
    evidence: DetectionEvidence[];
    /** 检测时间 */
    detectedAt: number;
}
/**
 * 重要路径分类
 */
export interface ImportantPaths {
    /** 应用代码 */
    app: string[];
    /** 库代码 */
    lib: string[];
    /** 测试代码 */
    tests: string[];
    /** 基础设施 */
    infra: string[];
    /** 脚本 */
    scripts: string[];
    /** 文档 */
    docs: string[];
    /** 配置文件 */
    configs: string[];
}
/**
 * 入口点
 */
export interface Entrypoint {
    /** 路径 */
    path: string;
    /** 类型 */
    type: EntrypointType;
    /** 置信度 */
    confidence: 'primary' | 'secondary' | 'possible';
    /** 描述 */
    description?: string;
    /** 语言 */
    language?: string;
}
/**
 * 入口点类型
 */
export type EntrypointType = 'app' | 'cli' | 'server' | 'worker' | 'test' | 'config' | 'page' | 'api' | 'library';
/**
 * 检测证据
 */
export interface DetectionEvidence {
    /** 证据类型 */
    type: EvidenceType;
    /** 证据来源（文件路径） */
    source: string;
    /** 证据内容 */
    content?: string;
    /** 置信度 */
    confidence: number;
    /** 检测时间 */
    detectedAt: number;
}
/**
 * 证据类型
 */
export type EvidenceType = 'package_json' | 'tsconfig' | 'vite_config' | 'next_config' | 'pyproject' | 'requirements' | 'poetry_lock' | 'pytest_ini' | 'manage_py' | 'setup_py' | 'cargo_toml' | 'go_mod' | 'gemfile' | 'composer_json' | 'file_pattern' | 'directory_pattern' | 'import_statement' | 'shebang';
/**
 * 仓库地图
 */
export interface RepoMap {
    /** 仓库根目录 */
    repoRoot: string;
    /** 顶层目录 */
    topLevelDirs: DirectoryNode[];
    /** 关键目录 */
    keyDirectories: KeyDirectory[];
    /** 语言分布 */
    languageDistribution: LanguageDistribution;
    /** 重要配置文件 */
    importantFiles: ImportantFile[];
    /** 入口候选 */
    entrypointCandidates: Entrypoint[];
    /** 生成时间 */
    generatedAt: number;
}
/**
 * 目录节点
 */
export interface DirectoryNode {
    /** 目录名 */
    name: string;
    /** 相对路径 */
    path: string;
    /** 分类 */
    category?: ModuleCategory;
    /** 子目录 */
    children?: DirectoryNode[];
    /** 文件数量 */
    fileCount?: number;
}
/**
 * 关键目录
 */
export interface KeyDirectory {
    /** 路径 */
    path: string;
    /** 分类 */
    category: ModuleCategory;
    /** 重要性 */
    importance: 'critical' | 'important' | 'normal';
    /** 描述 */
    description?: string;
}
/**
 * 语言分布
 */
export interface LanguageDistribution {
    /** 按语言统计的文件数 */
    byLanguage: Record<string, number>;
    /** 按扩展名统计的文件数 */
    byExtension: Record<string, number>;
    /** 总文件数 */
    totalFiles: number;
}
/**
 * 重要文件
 */
export interface ImportantFile {
    /** 路径 */
    path: string;
    /** 类型 */
    type: ImportantFileType;
    /** 描述 */
    description?: string;
}
/**
 * 重要文件类型
 */
export type ImportantFileType = 'package_manifest' | 'config' | 'entrypoint' | 'test_config' | 'build_config' | 'env_example' | 'readme' | 'license' | 'gitignore';
/**
 * 模块分类
 */
export type ModuleCategory = 'app' | 'lib' | 'tests' | 'infra' | 'scripts' | 'docs' | 'config' | 'unknown';
/**
 * 模块分类结果
 */
export interface ModuleClassification {
    /** 路径 */
    path: string;
    /** 分类 */
    category: ModuleCategory;
    /** 置信度 */
    confidence: number;
    /** 分类依据 */
    reasons: string[];
}
/**
 * 代码上下文（注入给 agent）
 */
export interface CodeContext {
    /** 任务 ID */
    taskId?: string;
    /** 代理角色 */
    role?: string;
    /** 仓库画像 */
    repoProfile?: RepoProfile;
    /** 仓库地图 */
    repoMap?: RepoMap;
    /** 相关符号 */
    relevantSymbols?: SymbolRef[];
    /** 符号摘要 */
    symbolSummaries?: SymbolSummary[];
    /** 影响报告 */
    impactReport?: ImpactReport;
    /** 建议测试 */
    suggestedTests?: string[];
    /** 验证范围 */
    verificationScope?: VerificationScope;
    /** 文件内容映射 */
    files?: Map<string, string>;
}
/**
 * 符号引用（2B 定义）
 */
export interface SymbolRef {
    /** 名称 */
    name: string;
    /** 符号类型 */
    kind: SymbolKind;
    /** 文件路径 */
    file: string;
    /** 行号 */
    line: number;
    /** 列号 */
    column?: number;
    /** 语言 */
    language: string;
    /** 结束行号 */
    endLine?: number;
    /** 结束列号 */
    endColumn?: number;
}
/**
 * 符号类型
 */
export type SymbolKind = 'function' | 'class' | 'method' | 'type' | 'interface' | 'module' | 'variable' | 'constant' | 'parameter';
/**
 * 符号摘要（2B 定义）
 */
export interface SymbolSummary {
    /** 符号引用 */
    symbol: SymbolRef;
    /** 摘要 */
    summary?: string;
    /** 文档注释 */
    docstring?: string;
    /** 引用数 */
    referenceCount?: number;
}
/**
 * 影响报告（2C 定义）
 */
export interface ImpactReport {
    /** 变更文件 */
    changedFiles: string[];
    /** 影响的符号 */
    impactedSymbols: SymbolRef[];
    /** 相关测试 */
    relatedTests: string[];
    /** 风险等级 */
    risk: RiskLevel;
    /** 建议验证范围 */
    suggestedVerificationScope: VerificationScope;
}
/**
 * 风险等级
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * 验证范围
 */
export type VerificationScope = 'smoke' | 'targeted' | 'broad';
/**
 * 测试信息
 */
export interface TestInfo {
    /** 路径 */
    path: string;
    /** 测试框架 */
    framework?: string;
    /** 测试类型 */
    type: 'unit' | 'integration' | 'e2e' | 'smoke';
    /** 相关模块 */
    relatedModules?: string[];
}
/**
 * 测试映射
 */
export interface TestMapping {
    /** 文件到测试的映射 */
    fileToTests: Map<string, string[]>;
    /** 测试到文件的映射 */
    testToFiles: Map<string, string[]>;
}
/**
 * Code Intelligence 服务接口
 */
export interface ICodeIntelligenceService {
    /** 分析仓库 */
    analyzeRepo(repoRoot: string): Promise<RepoProfile>;
    /** 构建仓库画像 */
    buildRepoProfile(repoRoot: string): Promise<RepoProfile>;
    /** 构建仓库地图 */
    buildRepoMap(repoRoot: string): Promise<RepoMap>;
    /** 发现入口点 */
    discoverEntrypoints(repoRoot: string): Promise<Entrypoint[]>;
    /** 构建代码上下文 */
    buildCodeContext(role: string, task?: any, repoRoot?: string): Promise<CodeContext>;
    /** 索引符号 */
    indexSymbols(repoRoot: string, options?: IndexOptions): Promise<SymbolIndex>;
    /** 查找定义 */
    findDefinition(symbol: SymbolRef): Promise<SymbolRef | null>;
    /** 查找引用 */
    findReferences(symbol: SymbolRef): Promise<SymbolRef[]>;
    /** 发现测试 */
    discoverTests(repoRoot: string): Promise<TestInfo[]>;
    /** 分析影响 */
    analyzeImpact(changedFiles: string[], repoRoot: string): Promise<ImpactReport>;
}
/**
 * 符号索引（2B 定义）
 */
export interface SymbolIndex {
    /** 按名称索引 */
    byName: Map<string, SymbolRef[]>;
    /** 按文件索引 */
    byFile: Map<string, SymbolRef[]>;
    /** 按类型索引 */
    byKind: Map<SymbolKind, SymbolRef[]>;
    /** 索引时间 */
    indexedAt: number;
}
/**
 * 索引选项
 */
export interface IndexOptions {
    /** 包含的语言 */
    languages?: string[];
    /** 排除的目录 */
    excludeDirs?: string[];
    /** 排除的文件 */
    excludeFiles?: string[];
}
/**
 * 符号定义
 */
export interface SymbolDefinition {
    /** 符号名称 */
    name: string;
    /** 符号类型 */
    kind: SymbolKind;
    /** 文件路径 */
    file: string;
    /** 行号 */
    line: number;
    /** 列号 */
    column?: number;
    /** 结束行号 */
    endLine?: number;
    /** 结束列号 */
    endColumn?: number;
    /** 语言 */
    language: string;
    /** 是否导出 */
    exported?: boolean;
    /** 作用域 */
    scope?: 'module' | 'class' | 'function' | 'block';
    /** 签名摘要 */
    signature?: string;
    /** 文档注释 */
    docstring?: string;
    /** 父符号（类中的方法等） */
    parentSymbol?: string;
    /** 置信度 */
    confidence?: number;
    /** 证据来源 */
    evidence?: SymbolEvidence;
}
/**
 * 符号证据
 */
export interface SymbolEvidence {
    /** 证据类型 */
    type: 'ast' | 'static_scan' | 'grep' | 'import';
    /** 证据内容 */
    content?: string;
    /** 检测时间 */
    detectedAt: number;
}
/**
 * 符号引用
 */
export interface SymbolReference {
    /** 引用的符号 */
    symbol: SymbolDefinition;
    /** 引用位置 */
    location: {
        file: string;
        line: number;
        column?: number;
    };
    /** 引用类型 */
    referenceType: ReferenceType;
    /** 上下文代码 */
    context?: string;
}
/**
 * 引用类型
 */
export type ReferenceType = 'import' | 'export' | 'call' | 'inherit' | 'implement' | 'reference' | 'type_reference' | 'decorator';
/**
 * 符号关系
 */
export interface SymbolRelation {
    /** 源符号 */
    from: SymbolDefinition;
    /** 目标符号 */
    to: SymbolDefinition;
    /** 关系类型 */
    relation: RelationType;
    /** 置信度 */
    confidence?: number;
}
/**
 * 关系类型
 */
export type RelationType = 'calls' | 'imports' | 'inherits' | 'implements' | 'extends' | 'references' | 'depends_on';
/**
 * 符号索引
 */
export interface SymbolIndex {
    /** 仓库根目录 */
    repoRoot: string;
    /** 按名称索引 */
    byName: Map<string, SymbolDefinition[]>;
    /** 按文件索引 */
    byFile: Map<string, SymbolDefinition[]>;
    /** 按类型索引 */
    byKind: Map<SymbolKind, SymbolDefinition[]>;
    /** 按语言索引 */
    byLanguage: Map<string, SymbolDefinition[]>;
    /** 导出符号 */
    exported: SymbolDefinition[];
    /** 索引时间 */
    indexedAt: number;
    /** 统计 */
    stats: {
        totalSymbols: number;
        byKind: Record<SymbolKind, number>;
        byLanguage: Record<string, number>;
        byFile: Record<string, number>;
    };
}
/**
 * 符号查询
 */
export interface SymbolQuery {
    /** 查询名称 */
    name?: string;
    /** 查询类型 */
    kind?: SymbolKind;
    /** 查询语言 */
    language?: string;
    /** 查询文件 */
    file?: string;
    /** 模糊匹配 */
    fuzzy?: boolean;
    /** 仅导出符号 */
    exportedOnly?: boolean;
}
/**
 * 符号匹配结果
 */
export interface SymbolMatch {
    /** 符号定义 */
    symbol: SymbolDefinition;
    /** 匹配分数 */
    score: number;
    /** 匹配原因 */
    reasons: string[];
}
/**
 * 符号上下文（注入给 agent）
 */
export interface SymbolContext {
    /** 任务 ID */
    taskId?: string;
    /** 代理角色 */
    role?: string;
    /** 相关符号 */
    relevantSymbols?: SymbolDefinition[];
    /** 符号定义 */
    definitions?: SymbolDefinition[];
    /** 符号引用 */
    references?: SymbolReference[];
    /** 符号关系 */
    relations?: SymbolRelation[];
    /** 调用图摘要 */
    callGraphSummary?: CallGraphSummary;
    /** 影响分析 */
    impact?: SymbolImpact;
}
/**
 * 调用图摘要
 */
export interface CallGraphSummary {
    /** 调用者 */
    callers: SymbolDefinition[];
    /** 被调用者 */
    callees: SymbolDefinition[];
    /** 调用深度 */
    depth: number;
}
/**
 * 符号影响
 */
export interface SymbolImpact {
    /** 直接影响的符号 */
    directImpacts: SymbolDefinition[];
    /** 间接影响的符号 */
    indirectImpacts: SymbolDefinition[];
    /** 风险等级 */
    risk: RiskLevel;
}
/**
 * 测试引用
 */
export interface TestRef {
    /** 文件路径 */
    file: string;
    /** 测试框架 */
    framework?: string;
    /** 测试类型 */
    kind: TestKind;
    /** 语言 */
    language: string;
    /** 相关模块 */
    relatedModules?: string[];
    /** 置信度 */
    confidence: number;
    /** 识别原因 */
    reasons: string[];
}
/**
 * 测试类型
 */
export type TestKind = 'unit' | 'integration' | 'e2e' | 'smoke' | 'unknown';
/**
 * 测试清单
 */
export interface TestInventory {
    /** 仓库根目录 */
    repoRoot: string;
    /** 所有测试 */
    tests: TestRef[];
    /** 按类型分组 */
    byKind: Record<TestKind, TestRef[]>;
    /** 按框架分组 */
    byFramework: Record<string, TestRef[]>;
    /** 按语言分组 */
    byLanguage: Record<string, TestRef[]>;
    /** 统计 */
    stats: {
        total: number;
        byKind: Record<TestKind, number>;
        byFramework: Record<string, number>;
    };
    /** 生成时间 */
    generatedAt: number;
}
/**
 * 测试映射
 */
export interface TestMapping {
    /** 源文件路径 */
    sourceFile: string;
    /** 相关测试 */
    tests: TestRef[];
    /** 映射强度 */
    strength: 'strong' | 'medium' | 'weak';
    /** 映射原因 */
    reasons: string[];
}
/**
 * 影响报告
 */
export interface ImpactReport {
    /** 变更文件 */
    changedFiles: string[];
    /** 影响的符号 */
    impactedSymbols: SymbolDefinition[];
    /** 影响的文件 */
    impactedFiles: string[];
    /** 相关入口点 */
    affectedEntrypoints: Entrypoint[];
    /** 相关测试 */
    relatedTests: TestRef[];
    /** 风险等级 */
    risk: RiskLevel;
    /** 风险原因 */
    riskReasons: string[];
    /** 影响证据 */
    evidence: ImpactEvidence[];
}
/**
 * 影响证据
 */
export interface ImpactEvidence {
    /** 证据类型 */
    type: 'file_change' | 'symbol_change' | 'import_relation' | 'call_relation' | 'test_relation';
    /** 证据描述 */
    description: string;
    /** 置信度 */
    confidence: number;
    /** 来源 */
    source: string;
}
/**
 * 验证范围
 */
export type VerificationScope = 'smoke' | 'targeted' | 'broad';
/**
 * 验证计划
 */
export interface VerificationPlan {
    /** 验证范围 */
    scope: VerificationScope;
    /** 建议测试 */
    suggestedTests: TestRef[];
    /** 额外检查 */
    extraChecks: string[];
    /** 范围原因 */
    whyThisScope: string;
    /** 风险等级 */
    risk: RiskLevel;
    /** 预计测试数量 */
    estimatedTestCount: number;
}
/**
 * 测试发现器配置
 */
export interface TestDiscoveryConfig {
    /** 包含的目录 */
    includeDirs?: string[];
    /** 排除的目录 */
    excludeDirs?: string[];
    /** 文件模式 */
    filePatterns?: string[];
}
/**
 * 测试映射器配置
 */
export interface TestMapperConfig {
    /** 最大返回测试数 */
    maxTests?: number;
    /** 最小置信度 */
    minConfidence?: number;
}
/**
 * 补丁影响分析器配置
 */
export interface PatchImpactConfig {
    /** 包含符号分析 */
    includeSymbols?: boolean;
    /** 包含测试映射 */
    includeTests?: boolean;
}
/**
 * 验证范围建议器配置
 */
export interface VerificationScopeConfig {
    /** 风险阈值 */
    riskThresholds?: {
        low: number;
        medium: number;
        high: number;
    };
    /** 最大建议测试数 */
    maxSuggestedTests?: number;
}
/**
 * LSP 能力
 */
export type LspCapability = 'definition' | 'references' | 'documentSymbols' | 'workspaceSymbols' | 'hover' | 'completion' | 'rename' | 'codeAction';
/**
 * LSP 客户端配置
 */
export interface LspClientConfig {
    /** 语言 */
    language: string;
    /** LSP 服务器命令 */
    command?: string;
    /** LSP 服务器参数 */
    args?: string[];
    /** 超时时间（毫秒） */
    timeoutMs?: number;
    /** 初始化选项 */
    initializationOptions?: Record<string, unknown>;
}
/**
 * LSP 查询结果
 */
export interface LspQueryResult<T> {
    /** 结果数据 */
    data: T | null;
    /** 来源 */
    source: 'lsp' | 'parser' | 'static_scan' | 'grep';
    /** 置信度 */
    confidence: number;
    /** 降级原因（如果有） */
    fallbackReason?: string;
    /** 查询耗时 */
    durationMs: number;
}
/**
 * 降级结果
 */
export interface FallbackResult<T> {
    /** 结果数据 */
    data: T | null;
    /** 使用的降级层 */
    usedFallback: 'parser' | 'static_scan' | 'grep';
    /** 降级原因 */
    reason: string;
    /** 原始错误（如果有） */
    originalError?: string;
}
/**
 * 语义查询结果
 */
export interface SemanticQueryResult {
    /** 定义 */
    definitions: SymbolDefinition[];
    /** 引用 */
    references: SymbolReference[];
    /** 文档符号 */
    documentSymbols: SymbolDefinition[];
    /** 工作区符号 */
    workspaceSymbols: SymbolDefinition[];
    /** 来源统计 */
    sourceStats: {
        lsp: number;
        parser: number;
        staticScan: number;
        grep: number;
    };
    /** 查询耗时 */
    durationMs: number;
}
/**
 * 索引缓存配置
 */
export interface IndexCacheConfig {
    /** 默认 TTL（毫秒） */
    defaultTtlMs?: number;
    /** 最大缓存项数 */
    maxItems?: number;
    /** 缓存目录 */
    cacheDir?: string;
}
/**
 * 缓存项
 */
export interface CacheItem<T> {
    /** 数据 */
    data: T;
    /** 创建时间 */
    createdAt: number;
    /** 过期时间 */
    expiresAt: number;
    /** 访问次数 */
    accessCount: number;
    /** 最后访问时间 */
    lastAccessAt: number;
}
/**
 * 语义查询服务配置
 */
export interface SemanticQueryServiceConfig {
    /** 优先使用 LSP */
    preferLsp?: boolean;
    /** LSP 超时时间 */
    lspTimeoutMs?: number;
    /** 降级超时时间 */
    fallbackTimeoutMs?: number;
    /** 最大返回结果数 */
    maxResults?: number;
}
