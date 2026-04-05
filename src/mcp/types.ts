/**
 * MCP Types - MCP 核心类型定义
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 3A: MCP Core Registry
 * Sprint 3B: MCP Policy & Approval
 * Sprint 3C: MCP Resources Layer
 * Sprint 3D: Agent/MCP Integration
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * MCP Server ID
 */
export type McpServerId = string;

/**
 * MCP 能力类型
 */
export type McpCapabilityType =
  | 'tool'
  | 'resource'
  | 'prompt';

/**
 * MCP 健康状态
 */
export type McpHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

// ============================================================================
// MCP 描述符
// ============================================================================

/**
 * MCP Tool 描述符
 */
export interface McpToolDescriptor {
  /** 工具名称（不含 server 前缀） */
  name: string;
  
  /** 限定名称（含 server 前缀） */
  qualifiedName: string;
  
  /** 描述 */
  description: string;
  
  /** 输入 Schema */
  inputSchema: Record<string, unknown>;
  
  /** 输出 Schema（可选） */
  outputSchema?: Record<string, unknown>;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 需要审批 */
  requiresApproval?: boolean;
  
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * MCP Resource 描述符
 */
export interface McpResourceDescriptor {
  /** 资源名称 */
  name: string;
  
  /** 限定名称 */
  qualifiedName: string;
  
  /** 资源类型 */
  resourceType: string;
  
  /** 描述 */
  description: string;
  
  /** MIME 类型 */
  mimeType?: string;
  
  /** 是否可写 */
  writable: boolean;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 需要审批 */
  requiresApproval?: boolean;
}

/**
 * MCP Prompt 描述符
 */
export interface McpPromptDescriptor {
  /** Prompt 名称 */
  name: string;
  
  /** 限定名称 */
  qualifiedName: string;
  
  /** 描述 */
  description: string;
  
  /** 参数列表 */
  arguments?: McpPromptArgument[];
  
  /** 是否启用 */
  enabled: boolean;
}

/**
 * MCP Prompt 参数
 */
export interface McpPromptArgument {
  /** 参数名 */
  name: string;
  
  /** 描述 */
  description: string;
  
  /** 是否必需 */
  required: boolean;
  
  /** 默认值 */
  defaultValue?: string;
}

// ============================================================================
// MCP Server 描述符
// ============================================================================

/**
 * MCP Server 描述符
 */
export interface McpServerDescriptor {
  /** Server ID */
  id: McpServerId;
  
  /** Server 名称 */
  name: string;
  
  /** 版本 */
  version: string;
  
  /** 描述 */
  description: string;
  
  /** 工具列表 */
  tools: McpToolDescriptor[];
  
  /** 资源列表 */
  resources: McpResourceDescriptor[];
  
  /** Prompt 列表 */
  prompts: McpPromptDescriptor[];
  
  /** 能力列表 */
  capabilities: McpCapabilityRef[];
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 健康状态 */
  healthStatus: McpHealthStatus;
  
  /** 注册时间 */
  registeredAt: number;
  
  /** 最后健康检查时间 */
  lastHealthCheckAt?: number;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP 能力引用
// ============================================================================

/**
 * MCP 能力引用
 */
export interface McpCapabilityRef {
  /** 能力类型 */
  type: McpCapabilityType;
  
  /** 限定名称 */
  qualifiedName: string;
  
  /** 描述 */
  description: string;
  
  /** 是否启用 */
  enabled: boolean;
}

// ============================================================================
// MCP 注册结果
// ============================================================================

/**
 * MCP 注册结果
 */
export interface McpRegistrationResult {
  /** 是否成功 */
  success: boolean;
  
  /** Server ID */
  serverId: McpServerId;
  
  /** 注册的 tool 数量 */
  toolsRegistered: number;
  
  /** 注册的 resource 数量 */
  resourcesRegistered: number;
  
  /** 注册的 prompt 数量 */
  promptsRegistered: number;
  
  /** 错误信息（如果有） */
  error?: string;
  
  /** 警告信息（如果有） */
  warnings?: string[];
}

// ============================================================================
// MCP 查询
// ============================================================================

/**
 * MCP 能力查询
 */
export interface McpCapabilityQuery {
  /** Server ID */
  serverId?: string;
  
  /** 能力类型 */
  type?: McpCapabilityType;
  
  /** 关键词 */
  keyword?: string;
  
  /** 是否仅启用 */
  enabledOnly?: boolean;
}

/**
 * MCP 能力摘要
 */
export interface McpCapabilitySummary {
  /** Server ID */
  serverId: string;
  
  /** Server 名称 */
  serverName: string;
  
  /** 能力类型 */
  type: McpCapabilityType;
  
  /** 限定名称 */
  qualifiedName: string;
  
  /** 描述 */
  description: string;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 健康状态 */
  healthStatus: McpHealthStatus;
}

// ============================================================================
// MCP 注册表统计
// ============================================================================

/**
 * MCP 注册表统计
 */
export interface McpRegistryStats {
  /** Server 总数 */
  totalServers: number;
  
  /** 启用的 Server 数 */
  enabledServers: number;
  
  /** Tool 总数 */
  totalTools: number;
  
  /** Resource 总数 */
  totalResources: number;
  
  /** Prompt 总数 */
  totalPrompts: number;
  
  /** 按 Server 统计 */
  byServer: Record<string, {
    tools: number;
    resources: number;
    prompts: number;
  }>;
  
  /** 按类型统计 */
  byType: Record<McpCapabilityType, number>;
}

// ============================================================================
// MCP Policy Types (Sprint 3B)
// ============================================================================

/**
 * MCP 策略动作
 */
export type McpPolicyAction =
  | 'server.connect'
  | 'tool.invoke'
  | 'resource.read'
  | 'resource.write'
  | 'resource.search';

/**
 * MCP 策略效果
 */
export type McpPolicyEffect = 'allow' | 'ask' | 'deny';

/**
 * MCP 策略范围
 */
export type McpPolicyScope = 'server' | 'tool' | 'resource';

/**
 * MCP 策略规则
 */
export interface McpPolicyRule {
  /** 规则 ID */
  id: string;
  
  /** 范围 */
  scope: McpPolicyScope;
  
  /** 目标（serverId / qualifiedName） */
  target: string;
  
  /** 动作 */
  action: McpPolicyAction | McpPolicyAction[];
  
  /** 效果 */
  effect: McpPolicyEffect;
  
  /** 原因说明 */
  reason?: string;
  
  /** 优先级（数字越大优先级越高） */
  priority?: number;
  
  /** 创建时间 */
  createdAt?: number;
}

/**
 * MCP 策略决策
 */
export interface McpPolicyDecision {
  /** 效果 */
  effect: McpPolicyEffect;
  
  /** 范围 */
  scope: McpPolicyScope;
  
  /** 目标 */
  target: string;
  
  /** 动作 */
  action: McpPolicyAction;
  
  /** 匹配的规则 ID */
  matchedRuleId?: string;
  
  /** 原因 */
  reason: string;
  
  /** 是否需要审批 */
  requiresApproval: boolean;
}

/**
 * MCP 访问控制上下文
 */
export interface McpAccessContext {
  /** Agent ID */
  agentId: string;
  
  /** Task ID */
  taskId?: string;
  
  /** Session ID */
  sessionId: string;
  
  /** 请求的 Server */
  serverId: string;
  
  /** 请求的 Capability */
  capabilityName?: string;
  
  /** 请求的动作 */
  action: McpPolicyAction;
  
  /** 请求参数 */
  payload?: Record<string, unknown>;
}

/**
 * MCP 审批请求
 */
export interface McpApprovalRequest {
  /** 请求 ID */
  requestId: string;
  
  /** Agent ID */
  agentId: string;
  
  /** Task ID */
  taskId?: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Server ID */
  serverId: string;
  
  /** Capability 名称 */
  capabilityName?: string;
  
  /** 动作 */
  action: McpPolicyAction;
  
  /** 请求说明 */
  reason: string;
  
  /** 建议的策略范围 */
  suggestedPolicyScope?: McpPolicyScope;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 状态 */
  status: 'pending' | 'approved' | 'rejected';
  
  /** 审批时间 */
  resolvedAt?: number;
  
  /** 审批者 */
  resolvedBy?: string;
  
  /** 审批原因 */
  resolvedReason?: string;
}

/**
 * MCP 审批结果
 */
export interface McpApprovalResult {
  /** 是否批准 */
  approved: boolean;
  
  /** 原因 */
  reason?: string;
  
  /** 审批者 */
  approvedBy?: string;
  
  /** 审批时间 */
  approvedAt?: number;
}

/**
 * MCP 策略决策结果
 */
export interface McpAccessResult {
  /** 是否允许 */
  allowed: boolean;
  
  /** 是否需要审批 */
  requiresApproval: boolean;
  
  /** 决策 */
  decision: McpPolicyDecision;
  
  /** 审批请求（如果需要审批） */
  approvalRequest?: McpApprovalRequest;
  
  /** 错误信息（如果被拒绝） */
  error?: string;
}

// ============================================================================
// MCP Resource Types (Sprint 3C)
// ============================================================================

/**
 * MCP 资源动作
 */
export type McpResourceAction = 'list' | 'read' | 'search';

/**
 * MCP 资源类型描述符
 */
export interface McpResourceTypeDescriptor {
  /** Server ID */
  server: string;
  
  /** 资源类型 */
  resourceType: string;
  
  /** 限定名称 */
  qualifiedName: string;
  
  /** 描述 */
  description?: string;
  
  /** 支持的动作 */
  supportedActions: McpResourceAction[];
  
  /** ID Schema（可选） */
  idSchema?: Record<string, unknown>;
  
  /** 查询 Schema（可选） */
  querySchema?: Record<string, unknown>;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * MCP 资源引用
 */
export interface McpResourceRef {
  /** Server */
  server: string;
  
  /** 资源类型 */
  resourceType: string;
  
  /** 资源 ID */
  resourceId: string;
  
  /** URI（可选） */
  uri?: string;
}

/**
 * MCP 资源文档
 */
export interface McpResourceDocument {
  /** 资源引用 */
  ref: McpResourceRef;
  
  /** 标题（可选） */
  title?: string;
  
  /** 内容 */
  content: string;
  
  /** 内容类型 */
  contentType: 'text' | 'markdown' | 'json' | 'html' | 'binary' | 'unknown';
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
  
  /** 获取时间 */
  fetchedAt: string;
  
  /** 来源能力 */
  sourceCapability: string;
}

/**
 * MCP 资源搜索命中
 */
export interface McpResourceSearchHit {
  /** 资源引用 */
  ref: McpResourceRef;
  
  /** 标题（可选） */
  title?: string;
  
  /** 摘要（可选） */
  snippet?: string;
  
  /** 分数（可选） */
  score?: number;
  
  /** 元数据（可选） */
  metadata?: Record<string, unknown>;
  
  /** 匹配的字段（可选） */
  matchedFields?: string[];
}

/**
 * 资源列表选项
 */
export interface ResourceListOptions {
  /** 分页大小 */
  pageSize?: number;
  
  /** 分页标记 */
  pageToken?: string;
  
  /** 过滤条件 */
  filters?: Record<string, unknown>;
}

/**
 * 资源读取选项
 */
export interface ResourceReadOptions {
  /** 内容格式 */
  format?: 'text' | 'markdown' | 'json' | 'html';
  
  /** 包含元数据 */
  includeMetadata?: boolean;
}

/**
 * 资源搜索选项
 */
export interface ResourceSearchOptions {
  /** 最大结果数 */
  maxResults?: number;
  
  /** 最小分数 */
  minScore?: number;
  
  /** 过滤条件 */
  filters?: Record<string, unknown>;
}

/**
 * 资源列表结果
 */
export interface ResourceListResult {
  /** 资源引用列表 */
  resources: McpResourceRef[];
  
  /** 下一页标记 */
  nextPageToken?: string;
  
  /** 总数（如果已知） */
  total?: number;
}

/**
 * 资源搜索结果
 */
export interface ResourceSearchResult {
  /** 命中结果 */
  hits: McpResourceSearchHit[];
  
  /** 总命中数 */
  totalHits: number;
  
  /** 搜索耗时（毫秒） */
  searchDurationMs: number;
}

// ============================================================================
// Agent/MCP Integration Types (Sprint 3D)
// ============================================================================

/**
 * MCP 需求级别
 */
export type McpRequirementLevel = 'required' | 'optional';

/**
 * Agent MCP 需求
 */
export interface AgentMcpRequirement {
  /** Server ID */
  server: string;
  
  /** 需求级别 */
  level: McpRequirementLevel;
  
  /** 需要的能力（可选） */
  capabilities?: string[];
  
  /** 需要的资源类型（可选） */
  resourceTypes?: string[];
}

/**
 * Agent MCP 上下文
 */
export interface AgentMcpContext {
  /** 可用的 Servers */
  availableServers: string[];
  
  /** 可用的能力 */
  availableCapabilities: string[];
  
  /** 可用的资源 */
  availableResources: string[];
  
  /** 缺失的 required servers */
  requiredMissing: string[];
  
  /** 缺失的 optional servers */
  optionalMissing: string[];
  
  /** 等待审批的 */
  approvalPending: string[];
  
  /** 健康警告 */
  healthWarnings: string[];
}

/**
 * MCP 依赖状态
 */
export interface McpDependencyStatus {
  /** Server ID */
  server: string;
  
  /** 需求级别 */
  level: McpRequirementLevel;
  
  /** 状态 */
  status: 'available' | 'missing' | 'denied' | 'pending' | 'degraded' | 'unavailable';
  
  /** 原因 */
  reason?: string;
}

/**
 * MCP 能力可用性
 */
export interface McpCapabilityAvailability {
  /** Server ID */
  serverId: string;
  
  /** 健康状态 */
  healthStatus: McpServerHealthStatus;
  
  /** 是否可用 */
  isUsable: boolean;
  
  /** 是否降级 */
  isDegraded: boolean;
  
  /** 原因 */
  reason?: string;
}

/**
 * MCP Server 健康状态
 */
export type McpServerHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

/**
 * MCP Server 健康报告
 */
export interface McpServerHealthReport {
  /** Server ID */
  serverId: string;
  
  /** 健康状态 */
  status: McpServerHealthStatus;
  
  /** 详情 */
  details?: {
    /** 最后检查时间 */
    lastCheckAt?: number;
    
    /** 错误信息 */
    error?: string;
    
    /** 响应时间（毫秒） */
    responseTimeMs?: number;
    
    /** 成功率 */
    successRate?: number;
  };
  
  /** 报告时间 */
  reportedAt: number;
}

/**
 * MCP 健康快照
 */
export interface McpHealthSnapshot {
  /** 所有 server 的健康状态 */
  servers: Record<string, McpServerHealthReport>;
  
  /** 健康 server 数量 */
  healthyCount: number;
  
  /** 降级 server 数量 */
  degradedCount: number;
  
  /** 不可用 server 数量 */
  unavailableCount: number;
  
  /** 快照时间 */
  snapshotAt: number;
}

/**
 * AgentSpec 扩展（MCP 相关）
 */
export interface AgentMcpSpec {
  /** 必需的 MCP servers */
  requiredMcpServers: string[];
  
  /** 可选的 MCP servers */
  optionalMcpServers: string[];
  
  /** MCP 权限配置 */
  mcpPermissions?: {
    /** 允许的 servers */
    allowedServers?: string[];
    
    /** 拒绝的 servers */
    deniedServers?: string[];
    
    /** 需要审批的 servers */
    requiresApproval?: string[];
  };
  
  /** 资源偏好配置 */
  resourcePreferences?: {
    /** 首选资源类型 */
    preferredResourceTypes?: string[];
    
    /** 备选资源类型 */
    fallbackResourceTypes?: string[];
  };
}
