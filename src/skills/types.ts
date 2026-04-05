/**
 * Skill Types - Skill Package 核心类型定义
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 4A: Skill Package Core
 * Sprint 4B: Installer / Resolver
 * Sprint 4C: Trust / Security
 * Sprint 4D: Runtime Integration
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * Skill 名称
 */
export type SkillName = string;

/**
 * Skill 版本（语义化版本）
 */
export type SkillVersion = string;

/**
 * Skill 来源类型
 */
export type SkillSourceType = 'builtin' | 'workspace' | 'external';

/**
 * 信任级别
 */
export type SkillTrustLevel = 'builtin' | 'verified' | 'workspace' | 'external' | 'untrusted';

/**
 * 能力类型
 */
export type SkillCapabilityType =
  | 'tool_runtime'
  | 'code_intel'
  | 'mcp_integration'
  | 'verification'
  | 'repo_analysis'
  | 'review'
  | 'release'
  | 'automation';

// ============================================================================
// Skill Manifest 类型
// ============================================================================

/**
 * Skill 能力描述
 */
export interface SkillCapability {
  /** 能力名称 */
  name: string;
  
  /** 能力描述 */
  description: string;
  
  /** 能力类型 */
  type: SkillCapabilityType;
  
  /** 输入 Schema（可选） */
  inputSchema?: Record<string, unknown>;
  
  /** 输出 Schema（可选） */
  outputSchema?: Record<string, unknown>;
}

/**
 * Skill 工具描述
 */
export interface SkillTool {
  /** 工具名称 */
  name: string;
  
  /** 工具描述 */
  description: string;
  
  /** 输入 Schema */
  inputSchema: Record<string, unknown>;
  
  /** 输出 Schema（可选） */
  outputSchema?: Record<string, unknown>;
  
  /** 是否需要审批 */
  requiresApproval?: boolean;
  
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * Skill 依赖
 */
export interface SkillDependency {
  /** 依赖名称 */
  name: string;
  
  /** 版本约束 */
  version: string;
  
  /** 是否必需 */
  required: boolean;
  
  /** 可选的替代依赖 */
  alternatives?: string[];
}

/**
 * Agent 兼容性
 */
export interface AgentCompatibility {
  /** 最小 OpenClaw 版本 */
  minOpenClawVersion?: string;
  
  /** 最大 OpenClaw 版本 */
  maxOpenClawVersion?: string;
  
  /** 需要的 Agent 角色 */
  requiredAgents?: string[];
  
  /** 可选的 Agent 角色 */
  optionalAgents?: string[];
  
  /** 不兼容的 Agent 角色 */
  incompatibleAgents?: string[];
}

/**
 * Skill Manifest
 */
export interface SkillManifest {
  /** Skill 名称 */
  name: SkillName;
  
  /** Skill 版本 */
  version: SkillVersion;
  
  /** 描述 */
  description?: string;
  
  /** 作者 */
  author?: string;
  
  /** 许可证 */
  license?: string;
  
  /** 能力列表 */
  capabilities: SkillCapability[];
  
  /** 工具列表 */
  tools: SkillTool[];
  
  /** MCP Server 依赖 */
  mcpServers?: string[];
  
  /** 依赖列表 */
  dependencies: SkillDependency[];
  
  /** 信任级别 */
  trustLevel?: SkillTrustLevel;
  
  /** Agent 兼容性 */
  compatibility?: AgentCompatibility;
  
  /** 入口文件 */
  entryPoint?: string;
  
  /** 主文件 */
  main?: string;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Skill Package 类型
// ============================================================================

/**
 * Skill Package 描述符
 */
export interface SkillPackageDescriptor {
  /** Package ID */
  id: string;
  
  /** Package Key（name@version） */
  key: string;
  
  /** Manifest */
  manifest: SkillManifest;
  
  /** 来源类型 */
  source: SkillSourceType;
  
  /** 来源路径/URL */
  sourcePath?: string;
  
  /** 安装路径 */
  installPath?: string;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 安装时间 */
  installedAt?: number;
  
  /** 最后更新时间 */
  updatedAt?: number;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Skill 注册表条目
 */
export interface SkillRegistryEntry {
  /** Package ID */
  id: string;
  
  /** Skill 名称 */
  name: SkillName;
  
  /** Skill 版本 */
  version: SkillVersion;
  
  /** 描述 */
  description?: string;
  
  /** 信任级别 */
  trustLevel: SkillTrustLevel;
  
  /** 来源 */
  source: SkillSourceType;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 能力数量 */
  capabilityCount: number;
  
  /** 工具数量 */
  toolCount: number;
  
  /** 依赖数量 */
  dependencyCount: number;
  
  /** 注册时间 */
  registeredAt: number;
}

// ============================================================================
// Skill 注册结果
// ============================================================================

/**
 * Skill 注册结果
 */
export interface SkillRegistrationResult {
  /** 是否成功 */
  success: boolean;
  
  /** Package ID */
  packageId: string;
  
  /** Skill 名称 */
  skillName: string;
  
  /** Skill 版本 */
  skillVersion: string;
  
  /** 错误信息（如果有） */
  error?: string;
  
  /** 警告信息（如果有） */
  warnings?: string[];
}

/**
 * Skill 查询结果
 */
export interface SkillQueryResult {
  /** Package */
  package: SkillPackageDescriptor | null;
  
  /** 是否找到 */
  found: boolean;
  
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * Skill 列表结果
 */
export interface SkillListResult {
  /** Skills 列表 */
  skills: SkillRegistryEntry[];
  
  /** 总数 */
  total: number;
  
  /** 过滤条件 */
  filters?: SkillListFilters;
}

/**
 * Skill 列表过滤条件
 */
export interface SkillListFilters {
  /** 来源类型 */
  source?: SkillSourceType;
  
  /** 信任级别 */
  trustLevel?: SkillTrustLevel;
  
  /** 是否启用 */
  enabled?: boolean;
  
  /** 能力类型 */
  capabilityType?: SkillCapabilityType;
  
  /** 关键词 */
  keyword?: string;
}

// ============================================================================
// Skill 安装类型
// ============================================================================

/**
 * Skill 安装信息
 */
export interface SkillInstallInfo {
  /** Package ID */
  packageId: string;
  
  /** 来源 */
  source: SkillSourceType;
  
  /** 来源路径/URL */
  sourcePath: string;
  
  /** 安装路径 */
  installPath: string;
  
  /** 安装时间 */
  installedAt: number;
}

/**
 * Skill 卸载结果
 */
export interface SkillUninstallResult {
  /** 是否成功 */
  success: boolean;
  
  /** Package ID */
  packageId: string;
  
  /** 错误信息（如果有） */
  error?: string;
}

// ============================================================================
// Installer / Resolver Types (Sprint 4B)
// ============================================================================

/**
 * Skill 来源描述符
 */
export interface SkillSourceDescriptor {
  /** 来源类型 */
  type: SkillSourceType;
  
  /** 位置（路径/URL） */
  location: string;
  
  /** 来源（原始 URL/路径） */
  origin?: string;
  
  /** 校验和（可选） */
  checksum?: string;
  
  /** 受信任的发布者（可选） */
  trustedPublisher?: string;
  
  /** 获取时间（可选） */
  fetchedAt?: number;
}

/**
 * Skill 安装目标
 */
export interface SkillInstallTarget {
  /** Skill 名称 */
  name: SkillName;
  
  /** 版本约束（可选） */
  version?: string;
  
  /** 来源（可选） */
  source?: string;
}

/**
 * Skill 依赖节点
 */
export interface SkillDependencyNode {
  /** Skill 名称 */
  name: SkillName;
  
  /** 版本 */
  version: SkillVersion;
  
  /** 依赖方 */
  dependents: string[];
  
  /** 依赖项 */
  dependencies: SkillDependency[];
}

/**
 * Skill 依赖图
 */
export interface SkillDependencyGraph {
  /** 节点 */
  nodes: Map<string, SkillDependencyNode>;
  
  /** 边 */
  edges: Map<string, string[]>;
}

/**
 * Skill 冲突
 */
export interface SkillConflict {
  /** 冲突类型 */
  type: 'version' | 'circular' | 'missing';
  
  /** 涉及的 skills */
  skills: string[];
  
  /** 原因 */
  reason: string;
}

/**
 * Skill 解析结果
 */
export interface SkillResolutionResult {
  /** 是否成功 */
  success: boolean;
  
  /** 解析的 packages */
  resolvedPackages: SkillPackageDescriptor[];
  
  /** 缺失的依赖 */
  missingDependencies: string[];
  
  /** 冲突 */
  conflicts: SkillConflict[];
  
  /** 循环依赖 */
  cycles: string[][];
  
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * Skill 安装步骤
 */
export interface SkillInstallStep {
  /** 步骤名称 */
  name: string;
  
  /** 步骤描述 */
  description: string;
  
  /** 是否完成 */
  completed: boolean;
  
  /** 是否成功 */
  success?: boolean;
  
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * Skill 安装计划
 */
export interface SkillInstallPlan {
  /** 要安装的 packages */
  toInstall: SkillPackageDescriptor[];
  
  /** 要更新的 packages */
  toUpdate: SkillPackageDescriptor[];
  
  /** 要跳过的 packages */
  toSkip: string[];
  
  /** 安装步骤 */
  steps: SkillInstallStep[];
}

/**
 * Skill 安装结果
 */
export interface SkillInstallResult {
  /** 是否成功 */
  success: boolean;
  
  /** 安装的 packages */
  installed: SkillPackageDescriptor[];
  
  /** 跳过的 packages */
  skipped: string[];
  
  /** 失败的 packages */
  failed: string[];
  
  /** 错误信息（如果有） */
  error?: string;
  
  /** 警告信息 */
  warnings?: string[];
}

/**
 * Skill 安装选项
 */
export interface SkillInstallOptions {
  /** 是否启用 */
  enable?: boolean;
  
  /** 是否强制安装 */
  force?: boolean;
  
  /** 是否解析依赖 */
  resolveDependencies?: boolean;
  
  /** 安装路径 */
  installPath?: string;
}

// ============================================================================
// Trust / Security Types (Sprint 4C)
// ============================================================================

/**
 * Skill 信任摘要
 */
export interface SkillTrustSummary {
  /** 信任级别 */
  trustLevel: SkillTrustLevel;
  
  /** 来源类型 */
  sourceType: SkillSourceType;
  
  /** 是否可信 */
  isTrusted: boolean;
  
  /** 是否需要审批 */
  requiresApproval: boolean;
  
  /** 信任信号 */
  trustSignals: SkillTrustSignal[];
  
  /** 警告信息 */
  warnings: string[];
}

/**
 * Skill 信任信号
 */
export interface SkillTrustSignal {
  /** 信号类型 */
  type: 'builtin' | 'verified_publisher' | 'checksum_valid' | 'signature_valid' | 'workspace_local';
  
  /** 信号值 */
  value: string;
  
  /** 置信度 */
  confidence: number;
}

/**
 * Skill 验证结果
 */
export interface SkillValidationResult {
  /** 是否有效 */
  valid: boolean;
  
  /** 错误列表 */
  errors: string[];
  
  /** 警告列表 */
  warnings: string[];
  
  /** 信任信号 */
  trustSignals: SkillTrustSignal[];
  
  /** 兼容性问题 */
  compatibilityIssues: SkillCompatibilityIssue[];
  
  /** 安全警告 */
  securityWarnings: SkillSecurityWarning[];
}

/**
 * Skill 兼容性问题
 */
export interface SkillCompatibilityIssue {
  /** 问题类型 */
  type: 'version' | 'agent' | 'platform' | 'dependency';
  
  /** 问题描述 */
  description: string;
  
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** 建议操作 */
  suggestedAction?: string;
}

/**
 * Skill 安全警告
 */
export interface SkillSecurityWarning {
  /** 警告类型 */
  type: 'permission' | 'network' | 'filesystem' | 'execution' | 'data_access';
  
  /** 警告描述 */
  description: string;
  
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Skill 策略动作
 */
export type SkillPolicyAction = 'install' | 'enable' | 'load';

/**
 * Skill 策略效果
 */
export type SkillPolicyEffect = 'allow' | 'ask' | 'deny';

/**
 * Skill 策略决策
 */
export interface SkillPolicyDecision {
  /** 动作 */
  action: SkillPolicyAction;
  
  /** 效果 */
  effect: SkillPolicyEffect;
  
  /** 原因 */
  reason: string;
  
  /** 是否需要审批 */
  requiresApproval: boolean;
  
  /** 信任级别 */
  trustLevel: SkillTrustLevel;
  
  /** 兼容性是否 OK */
  compatibilityOk: boolean;
  
  /** 匹配的规则 ID（可选） */
  matchedRuleId?: string;
}

/**
 * Skill 策略上下文
 */
export interface SkillPolicyContext {
  /** Agent ID */
  agentId?: string;
  
  /** Session ID */
  sessionId?: string;
  
  /** 运行时信息 */
  runtimeInfo?: {
    openClawVersion: string;
    availableAgents: string[];
  };
}

/**
 * Skill 策略规则
 */
export interface SkillPolicyRule {
  /** 规则 ID */
  id: string;
  
  /** 规则名称 */
  name: string;
  
  /** 适用的信任级别 */
  trustLevels?: SkillTrustLevel[];
  
  /** 适用的来源类型 */
  sourceTypes?: SkillSourceType[];
  
  /** 适用的动作 */
  actions?: SkillPolicyAction[];
  
  /** 效果 */
  effect: SkillPolicyEffect;
  
  /** 是否需要审批 */
  requiresApproval?: boolean;
  
  /** 规则描述 */
  description?: string;
  
  /** 优先级 */
  priority?: number;
}

// ============================================================================
// Runtime Integration Types (Sprint 4D)
// ============================================================================

/**
 * Agent Skill 需求
 */
export interface AgentSkillRequirement {
  /** Skill 名称 */
  name: string;
  
  /** 需求级别 */
  level: 'required' | 'optional';
  
  /** 版本约束（可选） */
  versionRange?: string;
  
  /** 能力提示（可选） */
  capabilityHints?: string[];
}

/**
 * Agent Skill 上下文
 */
export interface AgentSkillContext {
  /** 已加载的 skills */
  loadedSkills: string[];
  
  /** 被阻塞的 skills */
  blockedSkills: string[];
  
  /** 等待审批的 skills */
  pendingSkills: string[];
  
  /** 缺失的 required skills */
  missingRequiredSkills: string[];
  
  /** 不可用的 optional skills */
  optionalUnavailableSkills: string[];
  
  /** 能力摘要 */
  capabilitySummary: Record<string, string[]>;
}

/**
 * Skill 加载决策
 */
export interface SkillLoadDecision {
  /** Skill 名称 */
  skillName: string;
  
  /** 效果 */
  effect: 'load' | 'skip' | 'block' | 'pending';
  
  /** 原因 */
  reason: string;
  
  /** 信任级别 */
  trustLevel?: SkillTrustLevel;
  
  /** 是否需要审批 */
  requiresApproval?: boolean;
}

/**
 * Skill 运行时视图
 */
export interface SkillRuntimeView {
  /** Skill ID */
  skillId: string;
  
  /** Skill 名称 */
  skillName: string;
  
  /** 版本 */
  version: string;
  
  /** 能力列表 */
  capabilities: string[];
  
  /** 工具列表 */
  tools: string[];
  
  /** MCP Server 依赖 */
  mcpServers: string[];
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 信任级别 */
  trustLevel: SkillTrustLevel;
}

/**
 * Skill 能力摘要
 */
export interface SkillCapabilitySummary {
  /** 能力类型 */
  capabilityType: SkillCapabilityType;
  
  /** 提供该能力的 skills */
  providedBy: string[];
  
  /** 能力描述 */
  description?: string;
}

/**
 * Agent 能力摘要
 */
export interface AgentCapabilitySummary {
  /** Agent 角色 */
  agentRole: string;
  
  /** 可用的能力类型 */
  availableCapabilities: SkillCapabilitySummary[];
  
  /** 可用的工具 */
  availableTools: string[];
  
  /** 需要的 MCP Servers */
  requiredMcpServers: string[];
  
  /** 缺失的能力 */
  missingCapabilities: string[];
}

/**
 * Skill 运行时配置
 */
export interface SkillRuntimeConfig {
  /** Skill ID */
  skillId: string;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 信任级别 */
  trustLevel: SkillTrustLevel;
  
  /** 能力列表 */
  capabilities: string[];
  
  /** 运行时选项 */
  runtimeOptions?: Record<string, unknown>;
}

/**
 * Agent Skill 加载计划
 */
export interface AgentSkillLoadPlan {
  /** 要加载的 skills */
  toLoad: SkillLoadDecision[];
  
  /** 要跳过的 skills */
  toSkip: SkillLoadDecision[];
  
  /** 要阻塞的 skills */
  toBlock: SkillLoadDecision[];
  
  /** 等待审批的 skills */
  pending: SkillLoadDecision[];
  
  /** 缺失的 required skills */
  missingRequired: string[];
  
  /** 不可用的 optional skills */
  optionalUnavailable: string[];
}

/**
 * AgentSpec 扩展（Skill 相关）
 */
export interface AgentSkillSpec {
  /** 必需的 Skills */
  requiredSkills?: AgentSkillRequirement[];
  
  /** 可选的 Skills */
  optionalSkills?: AgentSkillRequirement[];
  
  /** 拒绝的 Skills */
  deniedSkills?: string[];
  
  /** 能力需求（可选） */
  capabilityRequirements?: SkillCapabilityType[];
}
