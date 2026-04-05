/**
 * Response Formatter - 响应格式化执行层
 *
 * 职责：
 * 1. 接收结构化响应内容
 * 2. 根据 style 渲染为最终展示结果
 * 3. 统一处理 section 顺序、摘要长度、metadata 展示策略
 * 4. 输出给 CLI / Telegram / dashboard 可消费结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { OutputStyleDescriptor, StructuredResponseContent, ResponseFormatResult, StyleRenderOptions, ContentSection, FormattedBlock } from './types';
import { StyleRegistry } from './style_registry';
/**
 * 格式化器配置
 */
export interface ResponseFormatterConfig {
    /** 默认风格 ID */
    defaultStyleId?: string;
    /** 最大行宽 */
    maxLineWidth?: number;
    /** 是否启用颜色 */
    enableColor?: boolean;
}
export declare class ResponseFormatter {
    private config;
    private registry;
    constructor(registry: StyleRegistry, config?: ResponseFormatterConfig);
    /**
     * 格式化响应
     */
    formatResponse(content: StructuredResponseContent, styleId: string, options?: StyleRenderOptions): ResponseFormatResult;
    /**
     * 格式化分段
     */
    formatSections(sections: ContentSection[], style: OutputStyleDescriptor): FormattedBlock[];
    /**
     * 应用风格覆盖
     */
    private applyStyleOverrides;
    /**
     * 构建内容分段
     */
    private buildContentSections;
    /**
     * 创建分段
     */
    private createSection;
    /**
     * 创建摘要分段
     */
    private createSummarySection;
    /**
     * 创建状态分段
     */
    private createStatusSection;
    /**
     * 创建行动项分段
     */
    private createActionsSection;
    /**
     * 创建警告分段
     */
    private createWarningsSection;
    /**
     * 创建证据分段
     */
    private createEvidenceSection;
    /**
     * 创建指标分段
     */
    private createMetricsSection;
    /**
     * 创建时间线分段
     */
    private createTimelineSection;
    /**
     * 创建产物分段
     */
    private createArtifactsSection;
    /**
     * 创建建议分段
     */
    private createRecommendationsSection;
    /**
     * 创建元数据分段
     */
    private createMetadataSection;
    /**
     * 格式化单个分段
     */
    private formatSection;
    /**
     * 构建最终文本
     */
    private buildFormattedText;
    /**
     * 计算内容哈希
     */
    private calculateContentHash;
}
/**
 * 创建响应格式化器
 */
export declare function createResponseFormatter(registry: StyleRegistry, config?: ResponseFormatterConfig): ResponseFormatter;
/**
 * 快速格式化响应
 */
export declare function formatResponse(registry: StyleRegistry, content: StructuredResponseContent, styleId: string, options?: StyleRenderOptions): ResponseFormatResult;
