/**
 * Result Normalizer - 结果标准化器
 *
 * 职责：
 * 1. 去除无效包装
 * 2. 提取结构化 summary
 * 3. 提取 findings / blockers / confidence
 * 4. 转为 SubagentResult
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentResult, SubagentRole, ArtifactRef, Finding, PatchRef } from './types';
/**
 * 标准化输入
 */
export interface NormalizationInput {
    subagentTaskId: string;
    parentTaskId: string;
    teamId: string;
    role: SubagentRole;
    rawContent: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    latencyMs: number;
    turnsUsed: number;
    finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'tool_call';
    error?: {
        type: string;
        message: string;
        recoverable: boolean;
    };
}
/**
 * 解析后的中间结果
 */
export interface ParsedResult {
    summary: string;
    confidence?: number;
    artifacts?: ArtifactRef[];
    patches?: PatchRef[];
    findings?: Finding[];
    blockers?: string[];
    recommendations?: string[];
    nextSteps?: string[];
}
export declare class ResultNormalizer {
    /**
     * 标准化结果
     */
    normalize(input: NormalizationInput): SubagentResult;
    /**
     * 创建错误结果
     */
    private createErrorResult;
    /**
     * 解析内容
     */
    private parseContent;
    /**
     * 清理内容
     */
    private cleanContent;
    /**
     * 解析 planner 结果
     */
    private parsePlannerResult;
    /**
     * 解析 repo_reader 结果
     */
    private parseRepoReaderResult;
    /**
     * 解析 code_fixer 结果
     */
    private parseCodeFixerResult;
    /**
     * 解析 code_reviewer 结果
     */
    private parseCodeReviewerResult;
    /**
     * 解析 verify_agent 结果
     */
    private parseVerifyAgentResult;
    /**
     * 解析 release_agent 结果
     */
    private parseReleaseAgentResult;
    /**
     * 解析通用结果
     */
    private parseGenericResult;
    /**
     * 提取章节内容
     */
    private extractSection;
    /**
     * 提取列表
     */
    private extractList;
    /**
     * 提取置信度
     */
    private extractConfidence;
    /**
     * 提取补丁
     */
    private extractPatches;
    /**
     * 提取发现的问题
     */
    private extractFindings;
    /**
     * 映射严重程度
     */
    private mapSeverity;
    /**
     * 提取风险等级
     */
    private extractRiskLevel;
}
/**
 * 创建结果标准化器
 */
export declare function createResultNormalizer(): ResultNormalizer;
/**
 * 快速标准化结果
 */
export declare function normalizeResult(input: NormalizationInput): SubagentResult;
