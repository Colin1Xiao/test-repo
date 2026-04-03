/**
 * GitHub Operator Bridge
 * Phase 2B-1-I - GitHub Connector 集成桥接
 * 
 * 职责：
 * - 将 GitHub 事件写入 Operator 数据面
 * - PR opened → TaskDataSource + Inbox
 * - Review requested → ApprovalDataSource
 * - Check failed → IncidentDataSource
 * - 动作后状态同步回写
 */

import type { GitHubPREvent, GitHubCheckEvent } from './github_types';
import type { TaskDataSource } from '../../operator/data/task_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { PREventAdapter } from './pr_event_adapter';
import type { PRTaskMapper } from './pr_task_mapper';
import type { CheckStatusAdapter } from './check_status_adapter';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubOperatorBridgeConfig {
  /** 默认 Workspace ID */
  defaultWorkspaceId?: string;
  
  /** 自动创建 Task */
  autoCreateTask?: boolean;
  
  /** 自动创建 Approval */
  autoCreateApproval?: boolean;
  
  /** 自动创建 Incident */
  autoCreateIncident?: boolean;
}

// ============================================================================
// GitHub Operator Bridge
// ============================================================================

export class GitHubOperatorBridge {
  private config: Required<GitHubOperatorBridgeConfig>;
  private taskDataSource: TaskDataSource;
  private approvalDataSource: ApprovalDataSource;
  private incidentDataSource: IncidentDataSource;
  private prEventAdapter: PREventAdapter;
  private prTaskMapper: PRTaskMapper;
  private checkStatusAdapter: CheckStatusAdapter;
  
  constructor(
    taskDataSource: TaskDataSource,
    approvalDataSource: ApprovalDataSource,
    incidentDataSource: IncidentDataSource,
    prEventAdapter: PREventAdapter,
    prTaskMapper: PRTaskMapper,
    checkStatusAdapter: CheckStatusAdapter,
    config: GitHubOperatorBridgeConfig = {}
  ) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
      autoCreateTask: config.autoCreateTask ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
      autoCreateIncident: config.autoCreateIncident ?? true,
    };
    
    this.taskDataSource = taskDataSource;
    this.approvalDataSource = approvalDataSource;
    this.incidentDataSource = incidentDataSource;
    this.prEventAdapter = prEventAdapter;
    this.prTaskMapper = prTaskMapper;
    this.checkStatusAdapter = checkStatusAdapter;
  }
  
  /**
   * 处理 GitHub PR 事件
   */
  async handlePREvent(event: GitHubPREvent, workspaceId?: string): Promise<{
    taskCreated?: boolean;
    approvalCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    const result: any = {};
    
    // 适配事件
    const adapted = this.prEventAdapter.adaptPREvent(event);
    
    // PR opened → Task
    if (adapted.task && this.config.autoCreateTask) {
      const task = this.prTaskMapper.mapPRToTask(event);
      this.taskDataSource.addTask({
        taskId: task.taskId,
        title: task.title,
        status: 'pending',
        priority: task.priority,
        risk: 'medium',
        ownerAgent: `github:${event.sender.login}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: task.metadata,
      });
      result.taskCreated = true;
    }
    
    // Review requested → Approval
    if (adapted.approval && this.config.autoCreateApproval) {
      this.approvalDataSource.addApproval({
        approvalId: adapted.approval.approvalId,
        scope: adapted.approval.scope,
        requestedAt: Date.now(),
        ageMs: 0,
        status: 'pending',
        reason: adapted.approval.reason,
        requestingAgent: adapted.approval.requestingAgent,
        metadata: adapted.approval.metadata,
      });
      result.approvalCreated = true;
    }
    
    return result;
  }
  
  /**
   * 处理 GitHub Check 事件
   */
  async handleCheckEvent(event: GitHubCheckEvent, workspaceId?: string): Promise<{
    incidentCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    const result: any = {};
    
    // 适配 Check 事件
    const adapted = this.checkStatusAdapter.adaptCheckEvent(event);
    
    // Check failed → Incident
    if (adapted.inboxItem && this.config.autoCreateIncident) {
      this.incidentDataSource.addIncident({
        id: adapted.inboxItem.sourceId,
        type: 'github_check',
        severity: adapted.inboxItem.severity as any,
        description: adapted.inboxItem.summary,
        createdAt: Date.now(),
        acknowledged: false,
        metadata: adapted.inboxItem.metadata,
      });
      result.incidentCreated = true;
    }
    
    return result;
  }
  
  /**
   * 处理 Approve 动作回写
   */
  async handleApproveAction(
    sourceId: string,
    actorId?: string
  ): Promise<{ success: boolean; message: string }> {
    // 解析 sourceId (格式：owner/repo#prNumber)
    const match = sourceId.match(/^(.+)\/(.+)#(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);
    
    // TODO: 调用 ReviewBridge 回写
    // MVP 版本：记录日志
    console.log(`[GitHub Bridge] Approve PR ${owner}/${repo}#${prNumber} by ${actorId}`);
    
    // 更新 Approval 状态
    this.approvalDataSource.updateApprovalStatus(
      `github_review_${owner}_${repo}_${prNumber}`,
      'approved',
      actorId
    );
    
    return {
      success: true,
      message: `Approved PR ${owner}/${repo}#${prNumber}`,
    };
  }
  
  /**
   * 处理 Reject 动作回写
   */
  async handleRejectAction(
    sourceId: string,
    actorId?: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    // 解析 sourceId
    const match = sourceId.match(/^(.+)\/(.+)#(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);
    
    // TODO: 调用 ReviewBridge 回写
    // MVP 版本：记录日志
    console.log(`[GitHub Bridge] Reject PR ${owner}/${repo}#${prNumber} by ${actorId}: ${reason}`);
    
    // 更新 Approval 状态
    this.approvalDataSource.updateApprovalStatus(
      `github_review_${owner}_${repo}_${prNumber}`,
      'rejected',
      actorId
    );
    
    return {
      success: true,
      message: `Rejected PR ${owner}/${repo}#${prNumber}`,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubOperatorBridge(
  taskDataSource: TaskDataSource,
  approvalDataSource: ApprovalDataSource,
  incidentDataSource: IncidentDataSource,
  prEventAdapter: PREventAdapter,
  prTaskMapper: PRTaskMapper,
  checkStatusAdapter: CheckStatusAdapter,
  config?: GitHubOperatorBridgeConfig
): GitHubOperatorBridge {
  return new GitHubOperatorBridge(
    taskDataSource,
    approvalDataSource,
    incidentDataSource,
    prEventAdapter,
    prTaskMapper,
    checkStatusAdapter,
    config
  );
}
