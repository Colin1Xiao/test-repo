/**
 * Operator Execution Bridge
 * Phase 2A-1R′ - 真实动作执行桥接
 * 
 * 职责：
 * - 承接 OperatorCommandDispatch 的真实动作调用
 * - 向下调用 ControlSurface / ApprovalWorkflow / IncidentWorkflow
 * - 区分 real / simulated 执行模式
 * - 返回 ExecutionResult
 */

import type { ControlSurfaceBuilder } from '../ux/control_surface';
import type { HumanLoopService } from '../ux/human_loop_service';
import type { ControlActionResult } from '../ux/control_types';

// ============================================================================
// 执行结果类型
// ============================================================================

export type ExecutionMode = "real" | "simulated" | "unsupported";

export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  
  /** 执行模式 */
  executionMode: ExecutionMode;
  
  /** 动作类型 */
  actionType: string;
  
  /** 目标 ID */
  targetId?: string;
  
  /** 结果消息 */
  message: string;
  
  /** 错误信息（如果失败） */
  error?: string;
  
  /** 底层控制动作结果（如果有） */
  controlResult?: ControlActionResult;
  
  /** 执行时间戳 */
  executedAt: number;
}

// ============================================================================
// Execution Bridge 接口
// ============================================================================

export interface OperatorExecutionBridge {
  /**
   * 批准审批
   */
  approveApproval(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 拒绝审批
   */
  rejectApproval(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 确认事件
   */
  ackIncident(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 重试任务
   */
  retryTask(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 暂停 Agent
   */
  pauseAgent(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 恢复 Agent
   */
  resumeAgent(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 检查 Agent
   */
  inspectAgent(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 取消任务
   */
  cancelTask(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 暂停任务
   */
  pauseTask(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 恢复任务
   */
  resumeTask(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 升级审批/事件
   */
  escalate(targetType: string, id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 请求恢复
   */
  requestRecovery(id: string, actorId?: string): Promise<ExecutionResult>;
  
  /**
   * 请求重放
   */
  requestReplay(id: string, actorId?: string): Promise<ExecutionResult>;
}

// ============================================================================
// 配置
// ============================================================================

export interface OperatorExecutionBridgeConfig {
  /** 是否启用真实执行（默认 false = 模拟模式） */
  enableRealExecution?: boolean;
  
  /** ControlSurfaceBuilder 实例（用于真实执行） */
  controlSurfaceBuilder?: ControlSurfaceBuilder;
  
  /** HumanLoopService 实例（用于 HITL 动作） */
  humanLoopService?: HumanLoopService;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorExecutionBridge implements OperatorExecutionBridge {
  private config: Required<OperatorExecutionBridgeConfig>;
  
  constructor(config: OperatorExecutionBridgeConfig = {}) {
    this.config = {
      enableRealExecution: config.enableRealExecution ?? false,
      controlSurfaceBuilder: config.controlSurfaceBuilder ?? null,
      humanLoopService: config.humanLoopService ?? null,
    } as Required<OperatorExecutionBridgeConfig>;
  }
  
  async approveApproval(id: string, actorId?: string): Promise<ExecutionResult> {
    // 真实执行路径
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'approve',
          targetType: 'approval',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'approve',
          targetId: id,
          message: result.message || `Approval ${id} approved`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'approve',
          targetId: id,
          message: `Failed to approve ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    // 模拟执行路径
    return this.buildSimulatedResult('approve', id, `Approval ${id} approved`);
  }
  
  async rejectApproval(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'reject',
          targetType: 'approval',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'reject',
          targetId: id,
          message: result.message || `Approval ${id} rejected`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'reject',
          targetId: id,
          message: `Failed to reject ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('reject', id, `Approval ${id} rejected`);
  }
  
  async ackIncident(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'ack_incident',
          targetType: 'incident',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'ack_incident',
          targetId: id,
          message: result.message || `Incident ${id} acknowledged`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'ack_incident',
          targetId: id,
          message: `Failed to acknowledge ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('ack_incident', id, `Incident ${id} acknowledged`);
  }
  
  async retryTask(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'retry_task',
          targetType: 'task',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'retry_task',
          targetId: id,
          message: result.message || `Task ${id} retry initiated`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'retry_task',
          targetId: id,
          message: `Failed to retry ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('retry_task', id, `Task ${id} retry initiated`);
  }
  
  async pauseAgent(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'pause_agent',
          targetType: 'agent',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'pause_agent',
          targetId: id,
          message: result.message || `Agent ${id} paused`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'pause_agent',
          targetId: id,
          message: `Failed to pause ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('pause_agent', id, `Agent ${id} paused`);
  }
  
  async resumeAgent(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'resume_agent',
          targetType: 'agent',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'resume_agent',
          targetId: id,
          message: result.message || `Agent ${id} resumed`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'resume_agent',
          targetId: id,
          message: `Failed to resume ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('resume_agent', id, `Agent ${id} resumed`);
  }
  
  async inspectAgent(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'inspect_agent',
          targetType: 'agent',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'inspect_agent',
          targetId: id,
          message: result.message || `Agent ${id} inspection opened`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'inspect_agent',
          targetId: id,
          message: `Failed to inspect ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('inspect_agent', id, `Agent ${id} inspection opened`);
  }
  
  async cancelTask(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'cancel_task',
          targetType: 'task',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'cancel_task',
          targetId: id,
          message: result.message || `Task ${id} cancelled`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'cancel_task',
          targetId: id,
          message: `Failed to cancel ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('cancel_task', id, `Task ${id} cancelled`);
  }
  
  async pauseTask(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'pause_task',
          targetType: 'task',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'pause_task',
          targetId: id,
          message: result.message || `Task ${id} paused`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'pause_task',
          targetId: id,
          message: `Failed to pause ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('pause_task', id, `Task ${id} paused`);
  }
  
  async resumeTask(id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'resume_task',
          targetType: 'task',
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'resume_task',
          targetId: id,
          message: result.message || `Task ${id} resumed`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'resume_task',
          targetId: id,
          message: `Failed to resume ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('resume_task', id, `Task ${id} resumed`);
  }
  
  async escalate(targetType: string, id: string, actorId?: string): Promise<ExecutionResult> {
    if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
      try {
        const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
          type: 'escalate_approval',
          targetType: targetType as any,
          targetId: id,
          requestedBy: actorId || 'operator',
          requestedAt: Date.now(),
        });
        
        return {
          success: result.success,
          executionMode: 'real',
          actionType: 'escalate',
          targetId: id,
          message: result.message || `${targetType} ${id} escalated`,
          error: result.error,
          controlResult: result,
          executedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          executionMode: 'real',
          actionType: 'escalate',
          targetId: id,
          message: `Failed to escalate ${id}`,
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }
    }
    
    return this.buildSimulatedResult('escalate', id, `${targetType} ${id} escalated`);
  }
  
  async requestRecovery(id: string, actorId?: string): Promise<ExecutionResult> {
    return this.buildSimulatedResult('request_recovery', id, `Recovery requested for ${id}`);
  }
  
  async requestReplay(id: string, actorId?: string): Promise<ExecutionResult> {
    return this.buildSimulatedResult('request_replay', id, `Replay requested for ${id}`);
  }
  
  // ============================================================================
  // 辅助方法
  // ============================================================================
  
  private buildSimulatedResult(actionType: string, targetId: string, message: string): ExecutionResult {
    return {
      success: true,
      executionMode: 'simulated',
      actionType,
      targetId,
      message,
      executedAt: Date.now(),
    };
  }
  
  /**
   * 启用真实执行
   */
  enableRealExecution(): void {
    this.config.enableRealExecution = true;
  }
  
  /**
   * 禁用真实执行（模拟模式）
   */
  disableRealExecution(): void {
    this.config.enableRealExecution = false;
  }
  
  /**
   * 检查是否启用真实执行
   */
  isRealExecutionEnabled(): boolean {
    return this.config.enableRealExecution;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorExecutionBridge(
  config?: OperatorExecutionBridgeConfig
): OperatorExecutionBridge {
  return new DefaultOperatorExecutionBridge(config);
}
