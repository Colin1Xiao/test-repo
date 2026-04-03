/**
 * Operator Execution Policy
 * Phase 2A-1R′B - 执行策略控制
 * 
 * 职责：
 * - 按动作类型控制 real / simulated 模式
 * - 提供安全的执行开关
 * - 支持逐步放开真实执行
 */

import type { OperatorActionType } from '../types/surface_types';

// ============================================================================
// 执行模式
// ============================================================================

export type ExecutionMode = "real" | "simulated" | "unsupported";

// ============================================================================
// 执行策略配置
// ============================================================================

export interface ExecutionPolicyConfig {
  /** 默认执行模式 */
  defaultMode?: ExecutionMode;
  
  /** 按动作类型的执行模式覆盖 */
  perAction?: Partial<Record<OperatorActionType, ExecutionMode>>;
  
  /** 是否启用真实执行（全局开关） */
  enableRealExecution?: boolean;
}

// ============================================================================
// 执行策略接口
// ============================================================================

export interface ExecutionPolicy {
  /**
   * 获取动作的执行模式
   */
  getExecutionMode(actionType: OperatorActionType): ExecutionMode;
  
  /**
   * 检查动作是否支持真实执行
   */
  isRealExecution(actionType: OperatorActionType): boolean;
  
  /**
   * 启用全局真实执行
   */
  enableRealExecution(): void;
  
  /**
   * 禁用全局真实执行
   */
  disableRealExecution(): void;
  
  /**
   * 设置动作的执行模式
   */
  setExecutionMode(actionType: OperatorActionType, mode: ExecutionMode): void;
  
  /**
   * 获取当前策略状态
   */
  getPolicyState(): {
    defaultMode: ExecutionMode;
    perAction: Record<OperatorActionType, ExecutionMode>;
    globalEnabled: boolean;
  };
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultExecutionPolicy implements ExecutionPolicy {
  private defaultMode: ExecutionMode;
  private perAction: Map<OperatorActionType, ExecutionMode>;
  private globalEnabled: boolean;
  
  constructor(config: ExecutionPolicyConfig = {}) {
    this.defaultMode = config.defaultMode ?? 'simulated';
    this.perAction = new Map();
    this.globalEnabled = config.enableRealExecution ?? false;
    
    // 初始化 per-action 配置
    if (config.perAction) {
      Object.entries(config.perAction).forEach(([actionType, mode]) => {
        this.perAction.set(actionType as OperatorActionType, mode);
      });
    }
  }
  
  getExecutionMode(actionType: OperatorActionType): ExecutionMode {
    // 全局禁用 → 强制 simulated
    if (!this.globalEnabled) {
      return 'simulated';
    }
    
    // 检查 per-action 配置
    const perActionMode = this.perAction.get(actionType);
    if (perActionMode !== undefined) {
      return perActionMode;
    }
    
    // 返回默认模式
    return this.defaultMode;
  }
  
  isRealExecution(actionType: OperatorActionType): boolean {
    return this.getExecutionMode(actionType) === 'real';
  }
  
  enableRealExecution(): void {
    this.globalEnabled = true;
  }
  
  disableRealExecution(): void {
    this.globalEnabled = false;
  }
  
  setExecutionMode(actionType: OperatorActionType, mode: ExecutionMode): void {
    this.perAction.set(actionType, mode);
  }
  
  getPolicyState(): {
    defaultMode: ExecutionMode;
    perAction: Record<OperatorActionType, ExecutionMode>;
    globalEnabled: boolean;
  } {
    // 构建完整的 per-action 映射
    const allActionTypes: OperatorActionType[] = [
      'view_dashboard', 'view_tasks', 'view_approvals', 'view_incidents',
      'view_agents', 'view_inbox', 'view_interventions', 'view_history',
      'open_item', 'switch_workspace', 'approve', 'reject', 'escalate',
      'ack_incident', 'request_recovery', 'request_replay', 'retry_task',
      'cancel_task', 'pause_task', 'resume_task', 'pause_agent',
      'resume_agent', 'inspect_agent', 'confirm_action', 'dismiss_intervention',
      'snooze_intervention', 'go_back', 'refresh',
    ];
    
    const perAction: Record<OperatorActionType, ExecutionMode> = {} as any;
    allActionTypes.forEach(actionType => {
      perAction[actionType] = this.getExecutionMode(actionType);
    });
    
    return {
      defaultMode: this.defaultMode,
      perAction,
      globalEnabled: this.globalEnabled,
    };
  }
}

// ============================================================================
// 预定义策略
// ============================================================================

/**
 * 安全策略（默认）
 * - 所有动作 simulated
 */
export function createSafeExecutionPolicy(): ExecutionPolicy {
  return new DefaultExecutionPolicy({
    defaultMode: 'simulated',
    enableRealExecution: false,
  });
}

/**
 * 测试策略（2A-1R′B 推荐）
 * - retry_task: real
 * - ack_incident: real
 * - approve: real
 * - 其他：simulated
 */
export function create2A1RPrimeBExecutionPolicy(): ExecutionPolicy {
  return new DefaultExecutionPolicy({
    defaultMode: 'simulated',
    enableRealExecution: true,
    perAction: {
      retry_task: 'real',
      ack_incident: 'real',
      approve: 'real',
      reject: 'real',
    },
  });
}

/**
 * 生产策略（未来）
 * - 所有控制动作 real
 * - 视图动作 simulated（不需要真实副作用）
 */
export function createProductionExecutionPolicy(): ExecutionPolicy {
  return new DefaultExecutionPolicy({
    defaultMode: 'simulated',
    enableRealExecution: true,
    perAction: {
      // 视图动作 - simulated
      view_dashboard: 'simulated',
      view_tasks: 'simulated',
      view_approvals: 'simulated',
      view_incidents: 'simulated',
      view_agents: 'simulated',
      view_inbox: 'simulated',
      view_interventions: 'simulated',
      view_history: 'simulated',
      open_item: 'simulated',
      refresh: 'simulated',
      go_back: 'simulated',
      switch_workspace: 'simulated',
      
      // 控制动作 - real
      approve: 'real',
      reject: 'real',
      escalate: 'real',
      ack_incident: 'real',
      request_recovery: 'real',
      request_replay: 'real',
      retry_task: 'real',
      cancel_task: 'real',
      pause_task: 'real',
      resume_task: 'real',
      pause_agent: 'real',
      resume_agent: 'real',
      inspect_agent: 'simulated',
      
      // HITL 动作 - real
      confirm_action: 'real',
      dismiss_intervention: 'real',
      snooze_intervention: 'real',
    },
  });
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createExecutionPolicy(config?: ExecutionPolicyConfig): ExecutionPolicy {
  return new DefaultExecutionPolicy(config);
}
