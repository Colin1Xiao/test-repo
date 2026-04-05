/**
 * Human Loop Service - 人机协同服务
 * 
 * 职责：
 * 1. 统一编排入口
 * 2. 输入：dashboard snapshot + attention items + control surface actions + operator context
 * 3. 输出：intervention items + suggestions + workflow actions + confirmations + trail updates
 * 
 * @version v0.1.0
 * @date 2026-04-04
 */

import type {
  DashboardSnapshot,
  AttentionItem,
} from './dashboard_types';
import type {
  ControlSurfaceSnapshot,
  ControlAction,
} from './control_types';
import type {
  InterventionItem,
  OperatorSuggestion,
  ActionConfirmation,
  WorkflowState,
  InterventionTrailEntry,
  HumanLoopSnapshot,
  InterventionEngineConfig,
  SuggestionEngineConfig,
  ActionConfirmationConfig,
  InterventionTrailConfig,
  HumanLoopServiceConfig,
} from './hitl_types';
import {
  InterventionEngine,
  generateInterventions,
} from './intervention_engine';
import {
  SuggestionEngine,
  generateSuggestions,
  refineGuidedActions,
} from './suggestion_engine';
import {
  ActionConfirmationManager,
  createConfirmation,
} from './action_confirmation';
import {
  ApprovalWorkflowBuilder,
  buildApprovalWorkflow,
} from './approval_workflow';
import {
  IncidentWorkflowBuilder,
  buildIncidentWorkflow,
} from './incident_workflow';
import {
  InterventionTrailManager,
  createInterventionTrailManager,
} from './intervention_trail';

// ============================================================================
// 人机协同服务
// ============================================================================

export class HumanLoopService {
  private config: Required<HumanLoopServiceConfig>;
  private interventionEngine: InterventionEngine;
  private suggestionEngine: SuggestionEngine;
  private confirmationManager: ActionConfirmationManager;
  private approvalWorkflowBuilder: ApprovalWorkflowBuilder;
  private incidentWorkflowBuilder: IncidentWorkflowBuilder;
  private trailManager: InterventionTrailManager;
  
  // 当前状态
  private interventions: Map<string, InterventionItem> = new Map();
  private suggestions: Map<string, OperatorSuggestion> = new Map();
  private confirmations: Map<string, ActionConfirmation> = new Map();
  private workflows: Map<string, WorkflowState> = new Map();
  
  constructor(config: HumanLoopServiceConfig = {}) {
    this.config = {
      autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
      maxTrailEntries: config.maxTrailEntries ?? 1000,
      interventionTimeoutMs: config.interventionTimeoutMs ?? 24 * 60 * 60 * 1000, // 24 小时
    };
    
    this.interventionEngine = new InterventionEngine({
      maxOpenInterventions: 50,
    } as InterventionEngineConfig);
    
    this.suggestionEngine = new SuggestionEngine({
      maxSuggestions: 5,
    } as SuggestionEngineConfig);
    
    this.confirmationManager = new ActionConfirmationManager({} as ActionConfirmationConfig);
    this.approvalWorkflowBuilder = new ApprovalWorkflowBuilder();
    this.incidentWorkflowBuilder = new IncidentWorkflowBuilder();
    this.trailManager = createInterventionTrailManager({
      maxEntries: this.config.maxTrailEntries,
    } as InterventionTrailConfig);
  }
  
  /**
   * 处理仪表盘快照
   */
  processDashboardSnapshot(dashboard: DashboardSnapshot): HumanLoopSnapshot {
    const now = Date.now();
    
    // 生成介入项
    const newInterventions = this.interventionEngine.generateInterventionsFromDashboard(dashboard);
    
    // 记录介入创建
    for (const intervention of newInterventions) {
      if (!this.interventions.has(intervention.id)) {
        this.interventions.set(intervention.id, intervention);
        this.trailManager.recordCreation(intervention);
        
        // 生成建议
        const suggestions = this.suggestionEngine.generateSuggestions(intervention);
        for (const suggestion of suggestions) {
          this.suggestions.set(suggestion.id, suggestion);
        }
        
        // 为审批事件创建工作流
        if (intervention.sourceType === 'approval') {
          const workflow = buildApprovalWorkflow(
            intervention,
            intervention.sourceId,
            'approval',
            'unknown'
          );
          this.workflows.set(workflow.id, workflow);
        }
        
        // 为事件创建工作流
        if (intervention.sourceType === 'ops') {
          const workflow = buildIncidentWorkflow(
            intervention,
            `incident_${intervention.sourceId}`,
            intervention.sourceType
          );
          this.workflows.set(workflow.id, workflow);
        }
      }
    }
    
    // 构建快照
    return this.buildSnapshot(now);
  }
  
  /**
   * 处理控制面快照
   */
  processControlSurfaceSnapshot(controlSnapshot: ControlSurfaceSnapshot): HumanLoopSnapshot {
    const now = Date.now();
    
    // 为可用动作创建确认
    for (const action of controlSnapshot.availableActions) {
      const guidedAction = {
        id: action.type,
        actionType: action.type,
        label: action.type,
        recommended: false,
        requiresConfirmation: true,
        riskLevel: 'medium' as const,
        params: action,
      };
      
      const confirmation = createConfirmation(
        guidedAction,
        action.targetId,
        action.targetType
      );
      
      if (confirmation) {
        this.confirmations.set(confirmation.actionId, confirmation);
      }
    }
    
    // 构建快照（需要 dashboard，这里简化）
    return this.buildSnapshot(now);
  }
  
  /**
   * 确认动作
   */
  confirmAction(
    actionId: string,
    actor: string
  ): { success: boolean; confirmation?: ActionConfirmation; error?: string } {
    const confirmation = this.confirmations.get(actionId);
    
    if (!confirmation) {
      return {
        success: false,
        error: 'Confirmation not found',
      };
    }
    
    confirmation.status = 'confirmed';
    
    // 记录追踪
    this.trailManager.recordAction(
      `action_${actionId}`,
      actor,
      'action_confirmed',
      'accepted'
    );
    
    return {
      success: true,
      confirmation,
    };
  }
  
  /**
   * 拒绝动作
   */
  rejectAction(
    actionId: string,
    actor: string
  ): { success: boolean; confirmation?: ActionConfirmation; error?: string } {
    const confirmation = this.confirmations.get(actionId);
    
    if (!confirmation) {
      return {
        success: false,
        error: 'Confirmation not found',
      };
    }
    
    confirmation.status = 'rejected';
    
    // 记录追踪
    this.trailManager.recordAction(
      `action_${actionId}`,
      actor,
      'action_rejected',
      'rejected'
    );
    
    return {
      success: true,
      confirmation,
    };
  }
  
  /**
   * 解决介入项
   */
  resolveIntervention(
    interventionId: string,
    actor: string,
    result: 'resolved' | 'dismissed' | 'escalated',
    note?: string
  ): { success: boolean; intervention?: InterventionItem; error?: string } {
    const intervention = this.interventions.get(interventionId);
    
    if (!intervention) {
      return {
        success: false,
        error: 'Intervention not found',
      };
    }
    
    intervention.status = result;
    intervention.updatedAt = Date.now();
    
    // 记录追踪
    this.trailManager.recordResolution(interventionId, actor, result, note);
    
    return {
      success: true,
      intervention,
    };
  }
  
  /**
   * 获取介入项
   */
  getIntervention(interventionId: string): InterventionItem | undefined {
    return this.interventions.get(interventionId);
  }
  
  /**
   * 获取所有开放介入项
   */
  getOpenInterventions(): InterventionItem[] {
    return Array.from(this.interventions.values())
      .filter(i => i.status === 'open' || i.status === 'acknowledged' || i.status === 'in_review');
  }
  
  /**
   * 获取建议
   */
  getSuggestions(): OperatorSuggestion[] {
    return Array.from(this.suggestions.values());
  }
  
  /**
   * 获取待确认动作
   */
  getPendingConfirmations(): ActionConfirmation[] {
    return Array.from(this.confirmations.values())
      .filter(c => c.status === 'pending');
  }
  
  /**
   * 获取工作流
   */
  getWorkflows(): WorkflowState[] {
    return Array.from(this.workflows.values());
  }
  
  /**
   * 获取追踪记录
   */
  getTrail(limit?: number): InterventionTrailEntry[] {
    return this.trailManager.getRecentTrail(limit);
  }
  
  /**
   * 构建人机协同快照
   */
  buildSnapshot(now: number): HumanLoopSnapshot {
    const openInterventions = this.getOpenInterventions();
    const pendingConfirmations = this.getPendingConfirmations();
    const suggestions = this.getSuggestions();
    const workflows = this.getWorkflows();
    const trail = this.getTrail(50);
    
    return {
      snapshotId: `humanloop_${now}`,
      createdAt: now,
      openInterventions,
      queuedConfirmations: pendingConfirmations,
      suggestions,
      workflows,
      trail,
      summary: {
        openCount: openInterventions.length,
        criticalCount: openInterventions.filter(i => i.severity === 'critical').length,
        pendingConfirmations: pendingConfirmations.length,
        escalatedCount: openInterventions.filter(i => i.status === 'escalated').length,
      },
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建人机协同服务
 */
export function createHumanLoopService(config?: HumanLoopServiceConfig): HumanLoopService {
  return new HumanLoopService(config);
}

/**
 * 快速处理仪表盘快照
 */
export function processDashboardSnapshot(
  dashboard: DashboardSnapshot,
  config?: HumanLoopServiceConfig
): HumanLoopSnapshot {
  const service = new HumanLoopService(config);
  return service.processDashboardSnapshot(dashboard);
}
