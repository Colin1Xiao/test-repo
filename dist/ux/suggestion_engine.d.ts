/**
 * Suggestion Engine - 建议引擎
 *
 * 职责：
 * 1. 为每个 intervention item 生成建议动作与理由
 * 2. 输出推荐动作/备选动作/原因解释/风险提示/预期影响
 * 3. 这是 6D 的"引导性"核心，决定体验是生硬还是智能
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { InterventionItem, GuidedAction, OperatorSuggestion, SuggestionEngineConfig } from './hitl_types';
export declare class SuggestionEngine {
    private config;
    constructor(config?: SuggestionEngineConfig);
    /**
     * 为介入项生成建议
     */
    generateSuggestions(intervention: InterventionItem): OperatorSuggestion[];
    /**
     * 优化引导动作
     */
    refineGuidedActions(actions: GuidedAction[], intervention: InterventionItem): GuidedAction[];
    /**
     * 生成必须确认的建议
     */
    private generateMustConfirmSuggestions;
    /**
     * 生成应该审查的建议
     */
    private generateShouldReviewSuggestions;
    /**
     * 生成可以驳回的建议
     */
    private generateCanDismissSuggestions;
    /**
     * 生成可以延后的建议
     */
    private generateCanSnoozeSuggestions;
    /**
     * 生成应该升级的建议
     */
    private generateShouldEscalateSuggestions;
    /**
     * 生成预期结果
     */
    private generateExpectedOutcome;
}
/**
 * 创建建议引擎
 */
export declare function createSuggestionEngine(config?: SuggestionEngineConfig): SuggestionEngine;
/**
 * 快速生成建议
 */
export declare function generateSuggestions(intervention: InterventionItem, config?: SuggestionEngineConfig): OperatorSuggestion[];
/**
 * 快速优化引导动作
 */
export declare function refineGuidedActions(actions: GuidedAction[], intervention: InterventionItem): GuidedAction[];
