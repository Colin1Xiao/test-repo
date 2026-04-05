/**
 * Attention Engine - 注意力引擎
 * 
 * 职责：
 * 1. 从 task / approval / ops / agent 四类 view 中提取真正需要人关注的事项
 * 2. 输出 aged approvals / blocked tasks / failing agents / degraded servers / replay hotspots / active incidents
 * 3. 这个模块会决定 dashboard 是"有洞察"还是"只是列表"
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  ControlSurfaceSnapshot,
  AttentionItem,
  AttentionRule,
  AttentionAnalysis,
  ControlAction,
} from './control_types';
import type { DashboardSnapshot } from './dashboard_types';

// ============================================================================
// 内置注意力规则
// ============================================================================

/**
 * 超时审批规则
 */
export const AGED_APPROVAL_RULE: AttentionRule = {
  id: 'aged_approval',
  name: 'Aged Approval',
  description: 'Approvals pending for more than 1 hour',
  severity: 'high',
  match: (snapshot) => snapshot.approvalView.pendingApprovals.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    
    for (const approval of snapshot.approvalView.pendingApprovals) {
      if (approval.ageMs > oneHourMs) {
        items.push({
          id: `attention_approval_${approval.approvalId}`,
          sourceType: 'approval',
          sourceId: approval.approvalId,
          title: `Approval pending for ${Math.round(approval.ageMs / 60000)} minutes`,
          reason: `Approval "${approval.scope}" has been pending for ${Math.round(approval.ageMs / 60000)} minutes`,
          severity: approval.ageMs > 4 * oneHourMs ? 'critical' : 'high',
          ageMs: approval.ageMs,
          recommendedAction: {
            type: 'approve',
            targetType: 'approval',
            targetId: approval.approvalId,
            requestedBy: 'attention_engine',
            requestedAt: now,
          } as ControlAction,
        });
      }
    }
    
    return items;
  },
};

/**
 * 阻塞任务规则
 */
export const BLOCKED_TASK_RULE: AttentionRule = {
  id: 'blocked_task',
  name: 'Blocked Task',
  description: 'Tasks that are blocked',
  severity: 'high',
  match: (snapshot) => snapshot.taskView.blockedTasks.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const task of snapshot.taskView.blockedTasks) {
      items.push({
        id: `attention_task_${task.taskId}`,
        sourceType: 'task',
        sourceId: task.taskId,
        title: `Task blocked: ${task.title}`,
        reason: task.blockedReason || 'Task is blocked',
        severity: task.risk === 'critical' || task.risk === 'high' ? 'critical' : 'high',
        ageMs: now - task.updatedAt,
        recommendedAction: {
          type: 'retry_task',
          targetType: 'task',
          targetId: task.taskId,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

/**
 * 失败任务规则
 */
export const FAILED_TASK_RULE: AttentionRule = {
  id: 'failed_task',
  name: 'Failed Task',
  description: 'Tasks that have failed',
  severity: 'medium',
  match: (snapshot) => snapshot.taskView.failedTasks.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const task of snapshot.taskView.failedTasks.slice(0, 5)) {
      items.push({
        id: `attention_task_${task.taskId}`,
        sourceType: 'task',
        sourceId: task.taskId,
        title: `Task failed: ${task.title}`,
        reason: `Task failed with status: ${task.status}`,
        severity: 'medium',
        ageMs: now - task.updatedAt,
        recommendedAction: {
          type: 'retry_task',
          targetType: 'task',
          targetId: task.taskId,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

/**
 * 降级 Server 规则
 */
export const DEGRADED_SERVER_RULE: AttentionRule = {
  id: 'degraded_server',
  name: 'Degraded Server',
  description: 'Servers that are degraded or unavailable',
  severity: 'critical',
  match: (snapshot) => snapshot.opsView.degradedServers.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const server of snapshot.opsView.degradedServers) {
      items.push({
        id: `attention_server_${server.serverId}`,
        sourceType: 'ops',
        sourceId: server.serverId,
        title: `Server ${server.status}: ${server.serverId}`,
        reason: `Server has error rate of ${(server.errorRate * 100).toFixed(1)}%`,
        severity: server.status === 'unavailable' ? 'critical' : 'high',
        ageMs: now - server.lastCheck,
        recommendedAction: {
          type: 'request_recovery',
          targetType: 'incident',
          targetId: `server_${server.serverId}`,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

/**
 * 不健康 Agent 规则
 */
export const UNHEALTHY_AGENT_RULE: AttentionRule = {
  id: 'unhealthy_agent',
  name: 'Unhealthy Agent',
  description: 'Agents that are unhealthy or blocked',
  severity: 'high',
  match: (snapshot) => snapshot.agentView.unhealthyAgents.length > 0 || snapshot.agentView.blockedAgents.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const agent of [...snapshot.agentView.unhealthyAgents, ...snapshot.agentView.blockedAgents].slice(0, 5)) {
      items.push({
        id: `attention_agent_${agent.agentId}`,
        sourceType: 'agent',
        sourceId: agent.agentId,
        title: `Agent ${agent.status}: ${agent.agentId}`,
        reason: `Agent has failure rate of ${(agent.failureRate * 100).toFixed(1)}% and health score of ${agent.healthScore}`,
        severity: agent.status === 'unhealthy' && (agent.healthScore || 100) < 30 ? 'critical' : 'high',
        ageMs: now - agent.lastSeenAt,
        recommendedAction: {
          type: 'inspect_agent',
          targetType: 'agent',
          targetId: agent.agentId,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

/**
 * 重放热点规则
 */
export const REPLAY_HOTSPOT_RULE: AttentionRule = {
  id: 'replay_hotspot',
  name: 'Replay Hotspot',
  description: 'Tasks with multiple replays',
  severity: 'medium',
  match: (snapshot) => snapshot.opsView.replayHotspots.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const hotspot of snapshot.opsView.replayHotspots.slice(0, 3)) {
      items.push({
        id: `attention_replay_${hotspot.taskId}`,
        sourceType: 'task',
        sourceId: hotspot.taskId,
        title: `Task replayed ${hotspot.replayCount} times`,
        reason: hotspot.reason || 'Task requires multiple replays',
        severity: hotspot.replayCount > 5 ? 'high' : 'medium',
        recommendedAction: {
          type: 'request_recovery',
          targetType: 'task',
          targetId: hotspot.taskId,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

/**
 * 顶级失败规则
 */
export const TOP_FAILURE_RULE: AttentionRule = {
  id: 'top_failure',
  name: 'Top Failure',
  description: 'Top failure categories',
  severity: 'high',
  match: (snapshot) => snapshot.opsView.topFailures.length > 0,
  generateItem: (snapshot) => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    
    for (const failure of snapshot.opsView.topFailures.slice(0, 3)) {
      items.push({
        id: `attention_failure_${failure.category}`,
        sourceType: 'ops',
        sourceId: failure.category,
        title: `${failure.category}: ${failure.count} events`,
        reason: failure.impact || `High failure rate in ${failure.category}`,
        severity: failure.count > 50 ? 'critical' : failure.count > 20 ? 'high' : 'medium',
        recommendedAction: {
          type: 'ack_incident',
          targetType: 'incident',
          targetId: `failure_${failure.category}`,
          requestedBy: 'attention_engine',
          requestedAt: now,
        } as ControlAction,
      });
    }
    
    return items;
  },
};

// ============================================================================
// 所有内置规则
// ============================================================================

/**
 * 所有内置注意力规则
 */
export const BUILTIN_ATTENTION_RULES: AttentionRule[] = [
  AGED_APPROVAL_RULE,
  BLOCKED_TASK_RULE,
  FAILED_TASK_RULE,
  DEGRADED_SERVER_RULE,
  UNHEALTHY_AGENT_RULE,
  REPLAY_HOTSPOT_RULE,
  TOP_FAILURE_RULE,
];

// ============================================================================
// 注意力引擎
// ============================================================================

export class AttentionEngine {
  private rules: Map<string, AttentionRule> = new Map();
  
  constructor() {
    // 注册内置规则
    for (const rule of BUILTIN_ATTENTION_RULES) {
      this.registerRule(rule);
    }
  }
  
  /**
   * 注册注意力规则
   */
  registerRule(rule: AttentionRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * 注销注意力规则
   */
  unregisterRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }
  
  /**
   * 分析快照生成关注项
   */
  analyze(snapshot: ControlSurfaceSnapshot): AttentionAnalysis {
    const items: AttentionItem[] = [];
    const appliedRules: string[] = [];
    
    for (const [ruleId, rule] of this.rules.entries()) {
      // 检查是否匹配
      if (rule.match(snapshot)) {
        appliedRules.push(ruleId);
        
        // 生成关注项
        const ruleItems = rule.generateItem(snapshot);
        items.push(...ruleItems);
      }
    }
    
    // 按严重级别排序
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    return {
      items,
      appliedRules,
      analyzedAt: Date.now(),
    };
  }
  
  /**
   * 获取所有规则
   */
  getAllRules(): AttentionRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * 获取规则数量
   */
  getRuleCount(): number {
    return this.rules.size;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建注意力引擎
 */
export function createAttentionEngine(): AttentionEngine {
  return new AttentionEngine();
}

/**
 * 快速分析快照
 */
export function analyzeAttention(snapshot: ControlSurfaceSnapshot): AttentionAnalysis {
  const engine = new AttentionEngine();
  return engine.analyze(snapshot);
}
