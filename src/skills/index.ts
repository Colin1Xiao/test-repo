/**
 * Skills - 统一导出
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 4A: Skill Package Core
 * Sprint 4B: Installer / Resolver
 */

// Types
export type * from './types';

// Skill Manifest
export {
  parseManifest,
  validateManifest,
  normalizeManifest,
  getManifestId,
  isValidSkillName,
  isValidSkillVersion,
  isValidTrustLevel,
  parseAndValidateManifest,
} from './skill_manifest';
export type { ManifestParseResult, ManifestValidationResult } from './skill_manifest';

// Skill Package
export {
  buildSkillPackage,
  getPackageId,
  getPackageKey,
  isBuiltinSkill,
  isExternalSkill,
  isWorkspaceSkill,
  toRegistryEntry,
  updatePackageStatus,
  updatePackageInstallPath,
  getPackageCapabilities,
  getPackageTools,
  getPackageMcpServers,
  getPackageDependencies,
  hasCapability,
  hasTool,
  requiresMcpServer,
  dependsOnSkill,
  comparePackageVersions,
  isCompatibleWithAgent,
  createPackageSnapshot,
  clonePackage,
} from './skill_package';
export type { SourceInfo } from './skill_package';

// Skill Registry
export {
  SkillRegistry,
  createSkillRegistry,
} from './skill_registry';
export type { SkillRegistryConfig } from './skill_registry';

// Skill Source (4B)
export {
  resolveSource,
  normalizeSource,
  isBuiltinSource,
  isWorkspaceSource,
  isExternalSource,
  isBuiltinSourcePath,
  isWorkspaceSourcePath,
  isExternalSourcePath,
  getSourceType,
  isSourceAvailable,
  createBuiltinSource,
  createWorkspaceSource,
  createExternalSource,
} from './skill_source';
export type { SourceResolveResult } from './skill_source';

// Skill Resolver (4B)
export {
  SkillResolver,
  createSkillResolver,
  resolveSkillDependencies,
} from './skill_resolver';
export type { ResolverConfig } from './skill_resolver';

// Skill Installer (4B)
export {
  SkillInstaller,
  createSkillInstaller,
} from './skill_installer';
export type { InstallerConfig } from './skill_installer';

// Skill Trust (4C)
export {
  SkillTrustEvaluator,
  createSkillTrustEvaluator,
  evaluateSkillTrust,
  isSkillTrusted,
  doesSkillRequireApproval,
} from './skill_trust';

// Skill Validation (4C)
export {
  SkillValidator,
  createSkillValidator,
  validateSkill,
} from './skill_validation';
export type { ValidatorConfig } from './skill_validation';

// Skill Policy (4C)
export {
  SkillPolicyEvaluator,
  createSkillPolicyEvaluator,
  evaluateInstallPolicy,
  evaluateEnablePolicy,
  evaluateLoadPolicy,
} from './skill_policy';
export type { PolicyEvaluatorConfig } from './skill_policy';

// Agent Skill Compatibility (4D)
export {
  AgentSkillCompatChecker,
  createAgentSkillCompatChecker,
} from './agent_skill_compat';
export type { CompatConfig, CompatCheckResult } from './agent_skill_compat';

// Skill Runtime Adapter (4D)
export {
  SkillRuntimeAdapter,
  createSkillRuntimeAdapter,
} from './skill_runtime_adapter';
export type { RuntimeAdapterConfig, SkillRuntimeState } from './skill_runtime_adapter';

// Skill Capability View (4D)
export {
  SkillCapabilityView,
  createSkillCapabilityView,
  buildSkillCapabilityView,
  buildAgentCapabilitySummary,
} from './skill_capability_view';
export type { CapabilityViewConfig } from './skill_capability_view';
