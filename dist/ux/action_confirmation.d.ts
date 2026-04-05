/**
 * Action Confirmation - 动作确认层
 *
 * 职责：
 * 1. 统一动作确认层
 * 2. 定义哪些动作无需确认/需一次确认/需强确认
 * 3. 确认文案所需字段/风险说明/影响范围/rollback hint
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { GuidedAction, ActionConfirmation, ConfirmationLevel, ActionConfirmationConfig } from './hitl_types';
export declare class ActionConfirmationManager {
    private config;
    constructor(config?: ActionConfirmationConfig);
    /**
     * 获取动作确认级别
     */
    getConfirmationLevel(actionType: string): ConfirmationLevel;
    /**
     * 创建动作确认
     */
    createConfirmation(action: GuidedAction, targetId: string, targetType: string): ActionConfirmation | null;
    /**
     * 确认动作
     */
    confirmConfirmation(confirmationId: string): ActionConfirmation | null;
    /**
     * 拒绝动作
     */
    rejectConfirmation(confirmationId: string): ActionConfirmation | null;
    /**
     * 过期动作
     */
    expireConfirmation(confirmationId: string): ActionConfirmation | null;
    /**
     * 生成确认标题
     */
    private generateConfirmationTitle;
    /**
     * 生成确认消息
     */
    private generateConfirmationMessage;
    /**
     * 生成风险摘要
     */
    private generateRiskSummary;
    /**
     * 生成回滚提示
     */
    private generateRollbackHint;
}
/**
 * 创建动作确认管理器
 */
export declare function createActionConfirmationManager(config?: ActionConfirmationConfig): ActionConfirmationManager;
/**
 * 快速创建动作确认
 */
export declare function createConfirmation(action: GuidedAction, targetId: string, targetType: string, config?: ActionConfirmationConfig): ActionConfirmation | null;
/**
 * 快速获取确认级别
 */
export declare function getConfirmationLevel(actionType: string, config?: ActionConfirmationConfig): ConfirmationLevel;
