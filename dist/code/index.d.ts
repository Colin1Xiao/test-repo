/**
 * Code Intelligence - 统一导出
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 2A: Repo Understanding
 * Sprint 2B: Symbol Intelligence
 */
export type * from './types';
export { ProjectDetector, createProjectDetector, detectProject, } from './project_detector';
export type { DetectorConfig, DetectionResult } from './project_detector';
export { ModuleClassifier, createModuleClassifier, classifyPath, getCategoryDescription, } from './module_classifier';
export type { ClassifierConfig, ModuleClassification } from './module_classifier';
export { RepoMapGenerator, createRepoMapGenerator, generateRepoMap, } from './repo_map';
export type { RepoMapGeneratorConfig } from './repo_map';
export { EntrypointDiscovery, createEntrypointDiscovery, discoverEntrypoints, } from './entrypoint_discovery';
export type { EntrypointDiscoveryConfig } from './entrypoint_discovery';
export { CodeContextService, createCodeContextService, analyzeRepo, buildCodeContext, } from './code_context_service';
export type { CodeContextServiceConfig } from './code_context_service';
export { SymbolIndexer, createSymbolIndexer, buildSymbolIndex, } from './symbol_index';
export type { SymbolIndexerConfig } from './symbol_index';
export { DefinitionLookup, createDefinitionLookup, findDefinitions, } from './definition_lookup';
export type { DefinitionLookupConfig, DefinitionLookupResult } from './definition_lookup';
export { ReferenceSearch, createReferenceSearch, findReferences, } from './reference_search';
export type { ReferenceSearchConfig, ReferenceSearchResult } from './reference_search';
export { CallGraphBuilder, createCallGraphBuilder, buildCallGraph, } from './call_graph';
export type { FileRelation, CallGraphSummary } from './call_graph';
export { SymbolQueryService, createSymbolQueryService, querySymbol, } from './symbol_query';
export type { SymbolQueryServiceConfig, QueryResult } from './symbol_query';
export { TestDiscovery, createTestDiscovery, discoverTests, } from './test_discovery';
export type { TestDiscoveryConfig } from './test_discovery';
export { TestMapper, createTestMapper, mapFileToTests, } from './test_mapper';
export type { TestMapperConfig } from './test_mapper';
export { PatchImpactAnalyzer, createPatchImpactAnalyzer, analyzePatchImpact, } from './patch_impact';
export type { PatchImpactConfig } from './patch_impact';
export { VerificationScopeAdvisor, createVerificationScopeAdvisor, generateVerificationPlan, } from './verification_scope';
export type { VerificationScopeConfig } from './verification_scope';
export { ParserFallback, createParserFallback, } from './parser_fallback';
export type { ParserFallbackConfig } from './parser_fallback';
export { LspBridge, createLspBridge, } from './lsp_bridge';
export type { LspBridgeConfig } from './lsp_bridge';
export { LspClientPool, createLspClientPool, ILspClient, } from './lsp_client_pool';
export { IndexCache, createIndexCache, getGlobalCache, } from './index_cache';
export type { IndexCacheConfig, CacheItem } from './index_cache';
