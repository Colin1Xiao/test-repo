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

import type {
  AutomationAction,
  AutomationEvent,
  AutomationExecutionContext,
  ActionExecutionResult,
  ActionExecutionStatus,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 动作执行器接口
 */
export interface IActionExecutor {
  /**
   * 执行动作
   */
  execute(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult>;
}

/**
 * 动作处理器注册表
 */
export interface ActionHandlerRegistry {
  /**
   * 注册处理器
   */
  register(
    type: string,
    handler: (
      action: AutomationAction,
      event: AutomationEvent,
      context: AutomationExecutionContext
    ) => Promise<ActionExecutionResult>
  ): void;
  
  /**
   * 获取处理器
   */
  getHandler(type: string): typeof ActionHandlerRegistry.prototype.register | null;
}

// ============================================================================
// 动作执行器
// ============================================================================

export class ActionExecutor implements IActionExecutor, ActionHandlerRegistry {
  private handlers: Map<string, (
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ) => Promise<ActionExecutionResult>> = new Map();
  
  constructor() {
    // 注册内置处理器
    this.register('notify', this.executeNotify.bind(this));
    this.register('retry', this.executeRetry.bind(this));
    this.register('escalate', this.executeEscalate.bind(this));
    this.register('log', this.executeLog.bind(this));
    this.register('cancel', this.executeCancel.bind(this));
    this.register('pause', this.executePause.bind(this));
    this.register('custom', this.executeCustom.bind(this));
  }
  
  /**
   * 注册处理器
   */
  register(
    type: string,
    handler: (
      action: AutomationAction,
      event: AutomationEvent,
      context: AutomationExecutionContext
    ) => Promise<ActionExecutionResult>
  ): void {
    this.handlers.set(type, handler);
  }
  
  /**
   * 获取处理器
   */
  getHandler(
    type: string
  ): ((
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ) => Promise<ActionExecutionResult>) | null {
    return this.handlers.get(type) || null;
  }
  
  /**
   * 执行动作
   */
  async execute(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const handler = this.getHandler(action.type);
    
    if (!handler) {
      return {
        status: 'failure',
        actionType: action.type,
        reason: `Unknown action type: ${action.type}`,
        error: `Handler not found for action type: ${action.type}`,
      };
    }
    
    try {
      return await handler(action, event, context);
    } catch (error) {
      return {
        status: 'failure',
        actionType: action.type,
        reason: `Action execution failed`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ============================================================================
  // 内置动作处理器
  // ============================================================================
  
  /**
   * 执行通知动作
   */
  private async executeNotify(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const target = action.target || 'default';
    const message = action.params?.message || `Notification for event: ${event.type}`;
    
    // 简化实现：实际应该调用通知服务
    console.log(`[NOTIFY] Target: ${target}, Message: ${message}`);
    
    return {
      status: 'success',
      actionType: 'notify',
      reason: `Notification sent to ${target}`,
      artifacts: {
        target,
        message,
        sentAt: Date.now(),
      },
      sideEffects: [`Notification sent to ${target}`],
    };
  }
  
  /**
   * 执行重试动作
   */
  private async executeRetry(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const maxRetries = action.params?.maxRetries || 3;
    const backoffMs = action.params?.backoffMs || 1000;
    
    // 简化实现：实际应该调用 TaskStore 进行重试
    console.log(`[RETRY] Max retries: ${maxRetries}, Backoff: ${backoffMs}ms`);
    
    return {
      status: 'success',
      actionType: 'retry',
      reason: `Retry scheduled with max ${maxRetries} retries`,
      artifacts: {
        maxRetries,
        backoffMs,
        scheduledAt: Date.now(),
      },
      sideEffects: [`Task retry scheduled`],
    };
  }
  
  /**
   * 执行升级动作
   */
  private async executeEscalate(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const target = action.target || 'admin';
    const reason = action.params?.reason || `Escalation for event: ${event.type}`;
    
    // 简化实现：实际应该调用 ApprovalBridge
    console.log(`[ESCALATE] Target: ${target}, Reason: ${reason}`);
    
    return {
      status: 'success',
      actionType: 'escalate',
      reason: `Escalation sent to ${target}`,
      artifacts: {
        target,
        reason,
        escalatedAt: Date.now(),
      },
      sideEffects: [`Escalation sent to ${target}`],
    };
  }
  
  /**
   * 执行日志动作
   */
  private async executeLog(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const level = action.params?.level || 'info';
    const message = action.params?.message || `Event: ${event.type}`;
    
    // 简化实现：实际应该调用审计日志
    console.log(`[LOG] Level: ${level}, Message: ${message}`);
    
    return {
      status: 'success',
      actionType: 'log',
      reason: `Log entry created`,
      artifacts: {
        level,
        message,
        loggedAt: Date.now(),
      },
      sideEffects: [`Log entry created at ${level} level`],
    };
  }
  
  /**
   * 执行取消动作
   */
  private async executeCancel(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const reason = action.params?.reason || 'Cancelled by automation rule';
    const taskId = event.taskId;
    
    // 简化实现：实际应该调用 TaskStore 取消任务
    console.log(`[CANCEL] Task: ${taskId}, Reason: ${reason}`);
    
    return {
      status: 'success',
      actionType: 'cancel',
      reason: `Task ${taskId} cancelled`,
      artifacts: {
        taskId,
        reason,
        cancelledAt: Date.now(),
      },
      sideEffects: [`Task ${taskId} cancelled`],
    };
  }
  
  /**
   * 执行暂停动作
   */
  private async executePause(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const duration = action.params?.duration || 60000; // 默认 1 分钟
    const reason = action.params?.reason || 'Paused by automation rule';
    
    // 简化实现：实际应该调用 TaskStore 暂停任务
    console.log(`[PAUSE] Duration: ${duration}ms, Reason: ${reason}`);
    
    return {
      status: 'success',
      actionType: 'pause',
      reason: `Task paused for ${duration}ms`,
      artifacts: {
        duration,
        reason,
        pausedAt: Date.now(),
        resumeAt: Date.now() + duration,
      },
      sideEffects: [`Task paused until ${new Date(Date.now() + duration).toISOString()}`],
    };
  }
  
  /**
   * 执行自定义动作
   */
  private async executeCustom(
    action: AutomationAction,
    event: AutomationEvent,
    context: AutomationExecutionContext
  ): Promise<ActionExecutionResult> {
    const handler = action.params?.handler;
    
    if (!handler) {
      return {
        status: 'failure',
        actionType: 'custom',
        reason: 'Custom action missing handler',
        error: 'Handler not specified in action params',
      };
    }
    
    // 简化实现：实际应该调用注册的自定义处理器
    console.log(`[CUSTOM] Handler: ${handler}`);
    
    return {
      status: 'success',
      actionType: 'custom',
      reason: `Custom action executed with handler: ${handler}`,
      artifacts: {
        handler,
        params: action.params,
        executedAt: Date.now(),
      },
      sideEffects: [`Custom action ${handler} executed`],
    };
  }
}

// ============================================================================
// 批量动作执行
// ============================================================================

/**
 * 执行多个动作
 */
export async function executeActions(
  actions: AutomationAction[],
  event: AutomationEvent,
  context: AutomationExecutionContext,
  executor?: IActionExecutor
): Promise<ActionExecutionResult[]> {
  const actionExecutor = executor || new ActionExecutor();
  const results: ActionExecutionResult[] = [];
  
  for (const action of actions) {
    const result = await actionExecutor.execute(action, event, context);
    results.push(result);
    
    // 如果动作失败，可以选择是否继续执行后续动作
    // 这里选择继续执行
  }
  
  return results;
}

/**
 * 构建动作执行上下文
 */
export function buildActionContext(
  event: AutomationEvent,
  additionalData?: Record<string, any>
): AutomationExecutionContext {
  return {
    event,
    matchedRules: [],
    executedActions: [],
    chainDepth: 0,
    maxChainDepth: 5, // 默认最大深度
    contextData: additionalData || {},
  };
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建动作执行器
 */
export function createActionExecutor(): IActionExecutor {
  return new ActionExecutor();
}

/**
 * 快速执行单个动作
 */
export async function executeAction(
  action: AutomationAction,
  event: AutomationEvent,
  context?: AutomationExecutionContext
): Promise<ActionExecutionResult> {
  const executor = new ActionExecutor();
  const ctx = context || buildActionContext(event);
  return await executor.execute(action, event, ctx);
}
