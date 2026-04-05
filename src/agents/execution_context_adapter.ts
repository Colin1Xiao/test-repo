/**
 * ExecutionContext Adapter - 执行上下文适配层
 * 
 * 将 OpenClaw 主 ExecutionContext 适配为 Agent Teams 可用格式
 * 
 * 核心职责：
 * 1. ExecutionContext → TeamContext 转换
 * 2. ExecutionContext + SubagentRole → SubagentContext 派生
 * 3. SubagentResult → 主任务可归档结果
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { ExecutionContext } from '../../core/runtime/execution_context';
import type {
  TeamContext,
  SubagentTask,
  SubagentResult,
  BudgetSpec,
  SubagentRole,
  MergedResult,
} from './types';
import { AGENT_ROLE_DEFAULTS } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 子代理执行上下文
 * 
 * 从父上下文派生，但权限/资源受限
 */
export interface SubagentExecutionContext {
  // 身份
  parentSessionId: string;
  parentTaskId: string;
  subagentTaskId: string;
  teamId: string;
  role: SubagentRole;
  
  // 继承的上下文（裁剪后）
  sessionId: string;           // 新会话 ID（子代理独立）
  cwd: string;                 // 工作目录（同父）
  workspaceRoot: string;       // 工作区根目录（同父）
  
  // 裁剪的权限
  allowedTools: string[];      // 工具白名单
  forbiddenTools: string[];    // 工具黑名单
  maxTurns: number;            // 最大轮次
  timeoutMs: number;           // 超时时间
  
  // 中止控制
  abortSignal?: AbortSignal;
  
  // 日志
  logger: {
    info: (msg: string, meta?: any) => void;
    warn: (msg: string, meta?: any) => void;
    error: (msg: string, meta?: any) => void;
    debug: (msg: string, meta?: any) => void;
  };
}

/**
 * 上下文派生配置
 */
export interface DeriveContextConfig {
  parentContext: ExecutionContext;
  task: SubagentTask;
  teamContext: TeamContext;
  role: SubagentRole;
}

/**
 * 上下文转换结果
 */
export interface ContextConversionResult {
  teamContext: TeamContext;
  subagentContexts: SubagentExecutionContext[];
}

// ============================================================================
// 适配器实现
// ============================================================================

export class ExecutionContextAdapter {
  /**
   * 将主 ExecutionContext 转换为 TeamContext
   */
  convertToTeamContext(
    parentContext: ExecutionContext,
    teamId: string,
    parentTaskId: string,
    totalBudget: BudgetSpec
  ): TeamContext {
    return {
      // 身份
      teamId,
      parentTaskId,
      sessionId: parentContext.sessionId,
      
      // 团队成员（初始为空，由 orchestrator 填充）
      agents: [],
      
      // 共享状态
      sharedState: {
        parentSessionId: parentContext.sessionId,
        parentTaskId,
        workspaceRoot: parentContext.workspaceRoot,
        cwd: parentContext.cwd,
      },
      
      // 资源
      worktree: parentContext.cwd,
      allowedTools: [], // 由 delegation policy 决定
      
      // 预算
      totalBudget,
      usedBudget: { turns: 0, tokens: 0, elapsedMs: 0 },
      
      // 状态
      status: 'active',
      createdAt: Date.now(),
    };
  }
  
  /**
   * 从父上下文派生子代理上下文
   * 
   * 关键：权限只能收缩，不能放大
   */
  deriveSubagentContext(config: DeriveContextConfig): SubagentExecutionContext {
    const { parentContext, task, teamContext, role } = config;
    
    // 获取角色默认配置
    const roleDefaults = AGENT_ROLE_DEFAULTS[role];
    if (!roleDefaults) {
      throw new Error(`Unknown agent role: ${role}`);
    }
    
    // 裁剪工具权限（子代理权限 ≤ 父上下文权限）
    const allowedTools = this.restrictToolAccess(
      task.allowedTools,
      roleDefaults.allowedTools,
      roleDefaults.forbiddenTools
    );
    
    // 派生日志器（带前缀）
    const logger = this.deriveLogger(parentContext.logger, `[${role}:${task.id.slice(-6)}]`);
    
    return {
      // 身份
      parentSessionId: parentContext.sessionId,
      parentTaskId,
      subagentTaskId: task.id,
      teamId: teamContext.teamId,
      role,
      
      // 继承的上下文
      sessionId: `${parentContext.sessionId}:subagent:${task.id}`,
      cwd: parentContext.cwd,
      workspaceRoot: parentContext.workspaceRoot,
      
      // 裁剪的权限
      allowedTools,
      forbiddenTools: roleDefaults.forbiddenTools,
      maxTurns: task.budget.maxTurns,
      timeoutMs: task.budget.timeoutMs,
      
      // 中止控制
      abortSignal: parentContext.signal,
      
      // 日志
      logger,
    };
  }
  
  /**
   * 将 SubagentResult 转换为可归档结果
   */
  normalizeSubagentResult(
    result: SubagentResult,
    parentTaskId: string
  ): {
    summary: string;
    artifacts: Array<{ type: string; path?: string; description: string }>;
    patches?: Array<{ file: string; diff: string }>;
    findings?: Array<{ type: string; severity: string; description: string }>;
  } {
    return {
      summary: result.summary,
      artifacts: (result.artifacts || []).map(a => ({
        type: a.type,
        path: a.path,
        description: a.description,
      })),
      patches: result.patches?.map(p => ({
        file: p.fileId,
        diff: p.diff,
      })),
      findings: result.findings?.map(f => ({
        type: f.type,
        severity: f.severity,
        description: f.description,
      })),
    };
  }
  
  /**
   * 归并结果转换为主任务格式
   */
  convertMergedResultToTaskOutput(merged: MergedResult): string {
    const lines: string[] = [];
    
    // 摘要
    lines.push('## 执行摘要\n');
    lines.push(merged.summary);
    lines.push('');
    
    // 置信度
    if (merged.confidence > 0) {
      lines.push(`**置信度**: ${(merged.confidence * 100).toFixed(0)}%\n`);
    }
    
    // 产出物
    if (merged.artifacts.length > 0) {
      lines.push('## 产出物\n');
      for (const artifact of merged.artifacts) {
        lines.push(`- [${artifact.type}] ${artifact.description}${artifact.path ? ` (\`${artifact.path}\`)` : ''}`);
      }
      lines.push('');
    }
    
    // 代码补丁
    if (merged.patches.length > 0) {
      lines.push('## 代码变更\n');
      for (const patch of merged.patches) {
        lines.push(`- \`${patch.fileId}\`: +${patch.linesAdded} -${patch.linesDeleted}`);
      }
      lines.push('');
    }
    
    // 发现的问题
    if (merged.findings.length > 0) {
      lines.push('## 发现\n');
      for (const finding of merged.findings) {
        const emoji = finding.severity === 'critical' ? '🔴' :
                     finding.severity === 'high' ? '🟠' :
                     finding.severity === 'medium' ? '🟡' : '🟢';
        lines.push(`${emoji} [${finding.severity}] ${finding.description}`);
      }
      lines.push('');
    }
    
    // 阻塞问题
    if (merged.blockers.length > 0) {
      lines.push('## 阻塞问题\n');
      for (const blocker of merged.blockers) {
        lines.push(`- ❌ ${blocker}`);
      }
      lines.push('');
    }
    
    // 建议
    if (merged.recommendations.length > 0) {
      lines.push('## 建议\n');
      for (const rec of merged.recommendations) {
        lines.push(`- 💡 ${rec}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 裁剪工具访问权限
   * 
   * 原则：子代理权限只能 ≤ 父上下文权限
   */
  private restrictToolAccess(
    taskAllowed: string[],
    roleAllowed: string[],
    roleForbidden: string[]
  ): string[] {
    // 取交集：任务允许 ∩ 角色允许
    const intersection = taskAllowed.filter(tool => roleAllowed.includes(tool));
    
    // 移除角色禁止的
    const restricted = intersection.filter(tool => !roleForbidden.includes(tool));
    
    return restricted;
  }
  
  /**
   * 派生日志器（带前缀）
   */
  private deriveLogger(
    parentLogger: any,
    prefix: string
  ): SubagentExecutionContext['logger'] {
    return {
      info: (msg: string, meta?: any) => parentLogger.info(`${prefix} ${msg}`, meta),
      warn: (msg: string, meta?: any) => parentLogger.warn(`${prefix} ${msg}`, meta),
      error: (msg: string, meta?: any) => parentLogger.error(`${prefix} ${msg}`, meta),
      debug: (msg: string, meta?: any) => parentLogger.debug(`${prefix} ${msg}`, meta),
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建适配器实例
 */
export function createExecutionContextAdapter(): ExecutionContextAdapter {
  return new ExecutionContextAdapter();
}

/**
 * 快速派生子代理上下文
 */
export function deriveSubagentContext(
  parentContext: ExecutionContext,
  task: SubagentTask,
  teamContext: TeamContext
): SubagentExecutionContext {
  const adapter = new ExecutionContextAdapter();
  return adapter.deriveSubagentContext({
    parentContext,
    task,
    teamContext,
    role: task.agent,
  });
}
