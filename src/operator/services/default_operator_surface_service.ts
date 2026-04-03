/**
 * Default Operator Surface Service
 * Phase 2A-1R - 视图服务实现
 * 
 * 职责：
 * - 实现 OperatorSurfaceService 接口
 * - 从现有系统组装真实视图数据
 * - 依赖：OperatorContextAdapter, OperatorViewFactory
 */

import type {
  GetSurfaceViewInput,
  OperatorViewPayload,
  OperatorSurfaceService,
} from '../types/surface_types';
import type { OperatorContextAdapter } from './operator_context_adapter';
import type { OperatorViewFactory } from './operator_view_factory';

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorSurfaceService implements OperatorSurfaceService {
  private contextAdapter: OperatorContextAdapter;
  private viewFactory: OperatorViewFactory;
  
  constructor(
    contextAdapter: OperatorContextAdapter,
    viewFactory: OperatorViewFactory
  ) {
    this.contextAdapter = contextAdapter;
    this.viewFactory = viewFactory;
  }
  
  async getDashboardView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const fullContext = await this.contextAdapter.getFullContext(input.workspaceId);
    
    return this.viewFactory.buildDashboardView({
      controlSnapshot: fullContext.control,
      dashboardSnapshot: fullContext.dashboard,
      humanLoopSnapshot: fullContext.humanLoop,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getTaskView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const controlSnapshot = await this.contextAdapter.getControlSnapshot(input.workspaceId);
    
    return this.viewFactory.buildTaskView({
      controlSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getApprovalView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const [controlSnapshot, humanLoopSnapshot] = await Promise.all([
      this.contextAdapter.getControlSnapshot(input.workspaceId),
      this.contextAdapter.getHumanLoopSnapshot(input.workspaceId),
    ]);
    
    return this.viewFactory.buildApprovalView({
      controlSnapshot,
      humanLoopSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getIncidentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const [controlSnapshot, dashboardSnapshot] = await Promise.all([
      this.contextAdapter.getControlSnapshot(input.workspaceId),
      this.contextAdapter.getDashboardSnapshot(input.workspaceId),
    ]);
    
    return this.viewFactory.buildIncidentView({
      controlSnapshot,
      dashboardSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getAgentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const controlSnapshot = await this.contextAdapter.getControlSnapshot(input.workspaceId);
    
    return this.viewFactory.buildAgentView({
      controlSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const [controlSnapshot, humanLoopSnapshot] = await Promise.all([
      this.contextAdapter.getControlSnapshot(input.workspaceId),
      this.contextAdapter.getHumanLoopSnapshot(input.workspaceId),
    ]);
    
    return this.viewFactory.buildInboxView({
      controlSnapshot,
      humanLoopSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getInterventionView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const humanLoopSnapshot = await this.contextAdapter.getHumanLoopSnapshot(input.workspaceId);
    
    return this.viewFactory.buildInterventionView({
      humanLoopSnapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getHistoryView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    // TODO: 实现历史记录视图
    // 目前返回一个占位视图
    
    return {
      viewKind: 'history',
      title: '历史记录',
      subtitle: '功能开发中',
      mode: input.mode,
      summary: '历史记录功能将在后续版本实现',
      content: {
        message: '历史记录功能开发中，敬请期待',
      },
      availableActions: [
        {
          actionType: 'go_back',
          label: '返回',
          style: 'default',
        },
      ],
      breadcrumbs: ['Dashboard', 'History'],
      generatedAt: Date.now(),
      freshnessMs: 0,
    };
  }
  
  async getItemDetailView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    // TODO: 根据 targetId 获取真实数据
    // 目前返回一个占位详情
    
    const data = {
      targetType: input.targetId ? 'unknown' : 'unknown',
      targetId: input.targetId || 'unknown',
      message: '详情功能开发中',
    };
    
    return this.viewFactory.buildDetailView({
      targetType: 'unknown',
      targetId: input.targetId || 'unknown',
      data,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
  
  async getView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    // 统一入口 - 按 viewKind 分发
    switch (input.viewKind) {
      case 'dashboard':
        return this.getDashboardView(input);
      case 'tasks':
        return this.getTaskView(input);
      case 'approvals':
        return this.getApprovalView(input);
      case 'incidents':
        return this.getIncidentView(input);
      case 'agents':
        return this.getAgentView(input);
      case 'inbox':
        return this.getInboxView(input);
      case 'interventions':
        return this.getInterventionView(input);
      case 'history':
        return this.getHistoryView(input);
      case 'item_detail':
        return this.getItemDetailView(input);
      default:
        throw new Error(`Unsupported view kind: ${input.viewKind}`);
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorSurfaceService(
  contextAdapter: OperatorContextAdapter,
  viewFactory: OperatorViewFactory
): OperatorSurfaceService {
  return new DefaultOperatorSurfaceService(contextAdapter, viewFactory);
}
