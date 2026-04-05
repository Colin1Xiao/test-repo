/**
 * Failure Taxonomy - 失败分类法
 *
 * 职责：
 * 1. 定义统一失败分类
 * 2. 把 task / approval / MCP / skill / agent / runtime 失败映射到标准 category
 * 3. 给 audit 和 health 统一语言
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { UnifiedFailureCategory, FailureRecord, AuditEvent } from './types';
export declare class FailureTaxonomy {
    /**
     * 分类失败
     */
    classifyFailure(eventOrError: any): UnifiedFailureCategory;
    /**
     * 规范化失败分类
     */
    normalizeFailureCategory(input: string): UnifiedFailureCategory;
    /**
     * 构建失败记录
     */
    buildFailureRecord(event: AuditEvent | any, errorMessage: string, rootCause?: string): FailureRecord;
    /**
     * 获取失败分类描述
     */
    getCategoryDescription(category: UnifiedFailureCategory): string;
    /**
     * 获取失败分类建议操作
     */
    getSuggestedAction(category: UnifiedFailureCategory): string;
    /**
     * 提取错误信息
     */
    private extractErrorMessage;
    /**
     * 生成失败 ID
     */
    private generateFailureId;
}
/**
 * 创建失败分类器
 */
export declare function createFailureTaxonomy(): FailureTaxonomy;
/**
 * 快速分类失败
 */
export declare function classifyFailure(eventOrError: any): UnifiedFailureCategory;
/**
 * 快速构建失败记录
 */
export declare function buildFailureRecord(event: any, errorMessage: string, rootCause?: string): FailureRecord;
