/**
 * HealthReport - 运行时健康报告
 * 
 * 提供：
 * - 最近失败 task 列表
 * - 最近 denied actions 列表
 * - pending approvals 列表
 * - worktree 清理状态
 * - orphaned task 检查
 */

import { TaskStore } from '../runtime/task_store';
import { ApprovalStore } from '../bridge/approval_store';
import { WorktreeManager } from '../workspace/worktree_manager';
import { AuditHandler } from '../hooks/audit_handler';

/** 健康报告数据 */
export interface HealthReport {
  /** 报告时间 */
  timestamp: number;
  /** 系统状态 */
  system: {
    uptime: number;
    version: string;
  };
  /** 任务统计 */
  tasks: {
    total: number;
    running: number;
    waitingApproval: number;
    failed24h: number;
    orphaned: number;
  };
  /** 审批统计 */
  approvals: {
    pending: number;
    expired: number;
    avgResponseTimeMs?: number;
  };
  /** Worktree 统计 */
  worktrees: {
    active: number;
    pendingCleanup: number;
    totalSize?: number;
  };
  /** 最近失败任务 */
  recentFailures: Array<{
    taskId: string;
    type: string;
    error: string;
    failedAt: number;
  }>;
  /** 最近拒绝操作 */
  recentDenials: Array<{
    tool: string;
    reason: string;
    deniedAt: number;
  }>;
  /** 建议 */
  recommendations: string[];
}

/** 健康报告生成器 */
export class HealthReporter {
  private tasks?: TaskStore;
  private approvals?: ApprovalStore;
  private worktrees?: WorktreeManager;
  private audit?: AuditHandler;

  constructor(options?: {
    tasks?: TaskStore;
    approvals?: ApprovalStore;
    worktrees?: WorktreeManager;
    audit?: AuditHandler;
  }) {
    this.tasks = options?.tasks;
    this.approvals = options?.approvals;
    this.worktrees = options?.worktrees;
    this.audit = options?.audit;
  }

  /**
   * 生成健康报告
   */
  generate(): HealthReport {
    const recommendations: string[] = [];
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;

    // 任务统计
    const taskStats = this.tasks?.getStats() ?? { total: 0, byStatus: {}, byType: {} };
    const recentFailures: HealthReport['recentFailures'] = [];
    
    if (this.tasks) {
      const failedTasks = this.tasks.list({ statusIn: ['failed'] });
      for (const task of failedTasks.slice(0, 10)) {
        if (task.endedAt && task.endedAt > cutoff24h) {
          recentFailures.push({
            taskId: task.id,
            type: task.type,
            error: task.error ?? 'Unknown error',
            failedAt: task.endedAt,
          });
        }
      }

      // 检查 orphaned tasks（运行超过 1 小时）
      const runningTasks = this.tasks.list({ statusIn: ['running'] });
      const orphaned = runningTasks.filter(
        t => t.startedAt && now - t.startedAt > 60 * 60 * 1000,
      ).length;

      if (orphaned > 0) {
        recommendations.push(`⚠️ 发现 ${orphaned} 个运行超过 1 小时的任务，可能需要检查`);
      }
    }

    // 审批统计
    const approvalStats = this.approvals?.getStats() ?? { total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 };
    const pendingApprovals = this.approvals?.listPending() ?? [];

    if (pendingApprovals.length > 10) {
      recommendations.push(`⚠️ 有 ${pendingApprovals.length} 个待审批请求堆积`);
    }

    // 检查过期审批
    const expiredApprovals = pendingApprovals.filter(
      p => p.expiresAt && now > p.expiresAt,
    ).length;

    if (expiredApprovals > 0) {
      recommendations.push(`⚠️ 有 ${expiredApprovals} 个审批请求已过期`);
    }

    // Worktree 统计
    const worktreeStats = this.worktrees?.getStats() ?? { total: 0, active: 0, completed: 0, destroyed: 0 };
    
    if (worktreeStats.active > 20) {
      recommendations.push(`⚠️ 有 ${worktreeStats.active} 个活跃 worktree，可能需要清理`);
    }

    // 最近拒绝操作
    const recentDenials: HealthReport['recentDenials'] = [];
    if (this.audit) {
      const audits = this.audit.search({ eventType: 'tool.denied', after: cutoff24h });
      for (const audit of audits.slice(0, 10)) {
        recentDenials.push({
          tool: audit.tool ?? 'unknown',
          reason: audit.details,
          deniedAt: audit.timestamp,
        });
      }
    }

    return {
      timestamp: now,
      system: {
        uptime: now, // 简化实现
        version: '0.1.0',
      },
      tasks: {
        total: taskStats.total,
        running: taskStats.byStatus?.['running'] ?? 0,
        waitingApproval: taskStats.byStatus?.['waiting_approval'] ?? 0,
        failed24h: recentFailures.length,
        orphaned: 0, // 简化实现
      },
      approvals: {
        pending: approvalStats.pending,
        expired: approvalStats.expired,
      },
      worktrees: {
        active: worktreeStats.active,
        pendingCleanup: worktreeStats.completed,
      },
      recentFailures,
      recentDenials,
      recommendations,
    };
  }

  /**
   * 获取文本格式报告
   */
  getReportText(): string {
    const report = this.generate();
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('🐉 OpenClaw Runtime 健康报告');
    lines.push('='.repeat(60));
    lines.push(`生成时间：${new Date(report.timestamp).toISOString()}`);
    lines.push('');

    lines.push('📊 任务状态');
    lines.push('-'.repeat(40));
    lines.push(`总计：${report.tasks.total}`);
    lines.push(`运行中：${report.tasks.running}`);
    lines.push(`等待审批：${report.tasks.waitingApproval}`);
    lines.push(`24h 失败：${report.tasks.failed24h}`);
    lines.push('');

    lines.push('🔐 审批状态');
    lines.push('-'.repeat(40));
    lines.push(`待审批：${report.approvals.pending}`);
    lines.push(`已过期：${report.approvals.expired}`);
    lines.push('');

    lines.push('🌳 Worktree 状态');
    lines.push('-'.repeat(40));
    lines.push(`活跃：${report.worktrees.active}`);
    lines.push(`待清理：${report.worktrees.pendingCleanup}`);
    lines.push('');

    if (report.recentFailures.length > 0) {
      lines.push('❌ 最近失败任务');
      lines.push('-'.repeat(40));
      for (const f of report.recentFailures.slice(0, 5)) {
        lines.push(`- ${f.taskId}: ${f.error}`);
      }
      lines.push('');
    }

    if (report.recentDenials.length > 0) {
      lines.push('🚫 最近拒绝操作');
      lines.push('-'.repeat(40));
      for (const d of report.recentDenials.slice(0, 5)) {
        lines.push(`- ${d.tool}: ${d.reason}`);
      }
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('💡 建议');
      lines.push('-'.repeat(40));
      for (const r of report.recommendations) {
        lines.push(r);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}
