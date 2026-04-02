/**
 * AuditHandler - 审计处理器
 * 
 * 监听关键事件，写入审计日志。
 * 标记高风险行为，便于追溯。
 */

import { HookBus } from '../runtime/hook_bus';
import type { RuntimeEvent } from '../runtime/hook_types';
import * as fs from 'fs';
import * as path from 'path';

/** 配置 */
export interface AuditHandlerConfig {
  /** 审计日志路径 */
  logPath?: string;
  /** 只记录高风险事件 */
  highRiskOnly?: boolean;
}

/** 审计记录 */
interface AuditRecord {
  timestamp: number;
  sessionId: string;
  taskId?: string;
  eventType: string;
  tool?: string;
  risk?: string;
  details: string;
  ok?: boolean;
}

/** 审计处理器实现 */
export class AuditHandler {
  private logPath: string;
  private highRiskOnly: boolean;

  constructor(hookBus: HookBus, config: AuditHandlerConfig = {}) {
    this.logPath = config.logPath ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'runtime',
      'audit.log',
    );
    this.highRiskOnly = config.highRiskOnly ?? false;
    
    this.register(hookBus);
  }

  /**
   * 注册钩子处理器
   */
  private register(hookBus: HookBus): void {
    // tool.denied - 工具被拒绝
    hookBus.on('tool.denied', (event) => {
      this.record({
        timestamp: event.timestamp,
        sessionId: event.sessionId,
        taskId: event.taskId,
        eventType: 'tool.denied',
        tool: event.tool,
        risk: 'high',
        details: event.reason,
        ok: false,
      });
    });

    // tool.after - 工具执行后
    hookBus.on('tool.after', (event) => {
      // 只记录高风险工具或失败执行
      if (this.isHighRisk(event.tool) || !event.ok) {
        this.record({
          timestamp: event.timestamp,
          sessionId: event.sessionId,
          taskId: event.taskId,
          eventType: 'tool.after',
          tool: event.tool,
          risk: this.isHighRisk(event.tool) ? 'high' : 'medium',
          details: `Duration: ${event.durationMs}ms, OK: ${event.ok}`,
          ok: event.ok,
        });
      }
    });

    // task.status_changed - 任务状态变化
    hookBus.on('task.status_changed', (event) => {
      if (['failed', 'cancelled'].includes(event.to)) {
        this.record({
          timestamp: event.timestamp,
          sessionId: event.sessionId,
          taskId: event.taskId,
          eventType: 'task.status_changed',
          risk: 'high',
          details: `Status changed from ${event.from} to ${event.to}`,
          ok: false,
        });
      }
    });
  }

  /**
   * 记录审计日志
   */
  private record(audit: AuditRecord): void {
    // 如果只记录高风险，跳过其他
    if (this.highRiskOnly && audit.risk !== 'high') {
      return;
    }
    
    const line = JSON.stringify(audit) + '\n';
    
    try {
      fs.appendFileSync(this.logPath, line);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * 判断是否是高风险工具
   */
  private isHighRisk(tool: string): boolean {
    const highRiskTools = [
      'exec.run',
      'fs.write',
      'fs.delete',
      'git.push',
      'git.commit',
      'mcp__',
    ];
    
    return highRiskTools.some(pattern => 
      tool === pattern || tool.startsWith(pattern),
    );
  }

  /**
   * 读取审计日志
   */
  read(limit: number = 100): AuditRecord[] {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }
    
    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);
    
    return lines
      .slice(-limit)
      .map(line => JSON.parse(line));
  }

  /**
   * 搜索审计日志
   */
  search(options?: {
    sessionId?: string;
    taskId?: string;
    tool?: string;
    eventType?: string;
    after?: number;
    before?: number;
  }): AuditRecord[] {
    const all = this.read(1000);
    
    return all.filter(record => {
      if (options?.sessionId && record.sessionId !== options.sessionId) return false;
      if (options?.taskId && record.taskId !== options.taskId) return false;
      if (options?.tool && record.tool !== options.tool) return false;
      if (options?.eventType && record.eventType !== options.eventType) return false;
      if (options?.after && record.timestamp < options.after) return false;
      if (options?.before && record.timestamp > options.before) return false;
      return true;
    });
  }
}
