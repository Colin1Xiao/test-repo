/**
 * Hook Actions - 动作执行
 *
 * 职责：
 * 1. 执行规则命中的动作
 * 2. 复用现有主干（TaskStore / ApprovalBridge / HookBus / notifications）
 * 3. 返回结构化动作结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AutomationAction, AutomationEvent, AutomationExecutionContext, ActionExecutionResult } from './types';
/**
 * 动作执行器接口
 */
export interface IActionExecutor {
    /**
     * 执行动作
     */
    execute(action: AutomationAction, event: AutomationEvent, context: AutomationExecutionContext): Promise<ActionExecutionResult>;
}
/**
 * 动作处理器注册表
 */
export interface ActionHandlerRegistry {
    /**
     * 注册处理器
     */
    register(type: string, handler: (action: AutomationAction, event: AutomationEvent, context: AutomationExecutionContext) => Promise<ActionExecutionResult>): void;
    /**
     * 获取处理器
     */
    getHandler(type: string): typeof ActionHandlerRegistry.prototype.register | null;
}
export declare class ActionExecutor implements IActionExecutor, ActionHandlerRegistry {
    private handlers;
    constructor();
    /**
     * 注册处理器
     */
    register(type: string, handler: (action: AutomationAction, event: AutomationEvent, context: AutomationExecutionContext) => Promise<ActionExecutionResult>): void;
    /**
     * 获取处理器
     */
    getHandler(type: string): ((action: AutomationAction, event: AutomationEvent, context: AutomationExecutionContext) => Promise<ActionExecutionResult>) | null;
    /**
     * 执行动作
     */
    execute(action: AutomationAction, event: AutomationEvent, context: AutomationExecutionContext): Promise<ActionExecutionResult>;
    /**
     * 执行通知动作
     */
    private executeNotify;
    /**
     * 执行重试动作
     */
    private executeRetry;
    /**
     * 执行升级动作
     */
    private executeEscalate;
    /**
     * 执行日志动作
     */
    private executeLog;
    /**
     * 执行取消动作
     */
    private executeCancel;
    /**
     * 执行暂停动作
     */
    private executePause;
    /**
     * 执行自定义动作
     */
    private executeCustom;
}
/**
 * 执行多个动作
 */
export declare function executeActions(actions: AutomationAction[], event: AutomationEvent, context: AutomationExecutionContext, executor?: IActionExecutor): Promise<ActionExecutionResult[]>;
/**
 * 构建动作执行上下文
 */
export declare function buildActionContext(event: AutomationEvent, additionalData?: Record<string, any>): AutomationExecutionContext;
/**
 * 创建动作执行器
 */
export declare function createActionExecutor(): IActionExecutor;
/**
 * 快速执行单个动作
 */
export declare function executeAction(action: AutomationAction, event: AutomationEvent, context?: AutomationExecutionContext): Promise<ActionExecutionResult>;
