/**
 * Code Intelligence - 统一导出
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 2A: Repo Understanding
 * Sprint 2B: Symbol Intelligence
 */

// Types
export type * from './types';

// === Sprint 2A: Repo Understanding ===

// Project Detector
export {
  ProjectDetector,
  createProjectDetector,
  detectProject,
} from './project_detector';
export type { DetectorConfig, DetectionResult } from './project_detector';

// Module Classifier
export {
  ModuleClassifier,
  createModuleClassifier,
  classifyPath,
  getCategoryDescription,
} from './module_classifier';
export type { ClassifierConfig, ModuleClassification } from './module_classifier';

// Repo Map
export {
  RepoMapGenerator,
  createRepoMapGenerator,
  generateRepoMap,
} from './repo_map';
export type { RepoMapGeneratorConfig } from './repo_map';

// Entrypoint Discovery
export {
  EntrypointDiscovery,
  createEntrypointDiscovery,
  discoverEntrypoints,
} from './entrypoint_discovery';
export type { EntrypointDiscoveryConfig } from './entrypoint_discovery';

// Code Context Service
export {
  CodeContextService,
  createCodeContextService,
  analyzeRepo,
  buildCodeContext,
} from './code_context_service';
export type { CodeContextServiceConfig } from './code_context_service';

// === Sprint 2B: Symbol Intelligence ===

// Symbol Index
export {
  SymbolIndexer,
  createSymbolIndexer,
  buildSymbolIndex,
} from './symbol_index';
export type { SymbolIndexerConfig } from './symbol_index';

// Definition Lookup
export {
  DefinitionLookup,
  createDefinitionLookup,
  findDefinitions,
} from './definition_lookup';
export type { DefinitionLookupConfig, DefinitionLookupResult } from './definition_lookup';

// Reference Search
export {
  ReferenceSearch,
  createReferenceSearch,
  findReferences,
} from './reference_search';
export type { ReferenceSearchConfig, ReferenceSearchResult } from './reference_search';

// Call Graph
export {
  CallGraphBuilder,
  createCallGraphBuilder,
  buildCallGraph,
} from './call_graph';
export type { FileRelation, CallGraphSummary } from './call_graph';

// Symbol Query
export {
  SymbolQueryService,
  createSymbolQueryService,
  querySymbol,
} from './symbol_query';
export type { SymbolQueryServiceConfig, QueryResult } from './symbol_query';

// === Sprint 2C: Test & Impact Intelligence ===

// Test Discovery
export {
  TestDiscovery,
  createTestDiscovery,
  discoverTests,
} from './test_discovery';
export type { TestDiscoveryConfig } from './test_discovery';

// Test Mapper
export {
  TestMapper,
  createTestMapper,
  mapFileToTests,
} from './test_mapper';
export type { TestMapperConfig } from './test_mapper';

// Patch Impact
export {
  PatchImpactAnalyzer,
  createPatchImpactAnalyzer,
  analyzePatchImpact,
} from './patch_impact';
export type { PatchImpactConfig } from './patch_impact';

// Verification Scope
export {
  VerificationScopeAdvisor,
  createVerificationScopeAdvisor,
  generateVerificationPlan,
} from './verification_scope';
export type { VerificationScopeConfig } from './verification_scope';

// === Sprint 2D: LSP Bridge ===

// Parser Fallback
export {
  ParserFallback,
  createParserFallback,
} from './parser_fallback';
export type { ParserFallbackConfig } from './parser_fallback';

// LSP Bridge
export {
  LspBridge,
  createLspBridge,
} from './lsp_bridge';
export type { LspBridgeConfig } from './lsp_bridge';

// LSP Client Pool
export {
  LspClientPool,
  createLspClientPool,
  ILspClient,
} from './lsp_client_pool';

// Index Cache
export {
  IndexCache,
  createIndexCache,
  getGlobalCache,
} from './index_cache';
export type { IndexCacheConfig, CacheItem } from './index_cache';
