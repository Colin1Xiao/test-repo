/**
 * MCP - 统一导出
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 3A: MCP Core Registry
 * Sprint 3B: MCP Policy & Approval
 */

// Types
export type * from './types';

// MCP Naming
export {
  buildToolName,
  buildResourceName,
  buildPromptName,
  parseQualifiedName,
  validateQualifiedName,
  normalizeServerName,
  normalizeNamePart,
  validateNamePart,
  checkNameConflict,
  getCapabilityType,
  extractServerName,
  extractNamePart,
  buildQualifiedName,
  getSupportedServers,
} from './mcp_naming';

// MCP Registry
export {
  McpRegistry,
  createMcpRegistry,
} from './mcp_registry';
export type { McpRegistryConfig } from './mcp_registry';

// Capability Index
export {
  CapabilityIndex,
  createCapabilityIndex,
} from './capability_index';
export type { CapabilityIndexConfig, CapabilitySearchQuery } from './capability_index';

// MCP Policy (3B)
export {
  McpPolicy,
  createMcpPolicy,
  createPermissivePolicy,
  createRestrictivePolicy,
  createConservativePolicy,
  createDefaultMcpPolicy,
} from './mcp_policy';
export type { McpPolicyConfig } from './mcp_policy';

// MCP Access Control (3B)
export {
  McpAccessControl,
  createMcpAccessControl,
  checkMcpAccess,
} from './mcp_access_control';
export type { AccessControlConfig } from './mcp_access_control';

// MCP Approval (3B)
export {
  McpApprovalManager,
  createMcpApprovalManager,
  requestMcpApproval,
} from './mcp_approval';
export type { IApprovalHandler, McpApprovalConfig } from './mcp_approval';

// MCP Resources (3C)
export {
  ResourceRegistry,
  createResourceRegistry,
} from './resource_registry';
export type { ResourceRegistryConfig } from './resource_registry';

export {
  ResourceReader,
  createResourceReader,
} from './resource_reader';
export type { ResourceReaderConfig, IResourceExecutor } from './resource_reader';

export {
  ResourceSearcher,
  createResourceSearcher,
} from './resource_search';
export type { ResourceSearcherConfig, IResourceSearchExecutor } from './resource_search';

// Agent/MCP Integration (3D)
export {
  AgentMcpRequirementsResolver,
  createAgentMcpRequirementsResolver,
  resolveMcpRequirements,
} from './agent_mcp_requirements';
export type { RequirementsResolution } from './agent_mcp_requirements';

export {
  McpContextAdapter,
  createMcpContextAdapter,
} from './mcp_context_adapter';
export type { ContextBuildOptions, MissingDependencyReport } from './mcp_context_adapter';

export {
  ServerHealthManager,
  createServerHealthManager,
} from './server_health';
export type { ServerHealthConfig } from './server_health';
