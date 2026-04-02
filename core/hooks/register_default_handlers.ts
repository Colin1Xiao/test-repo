/**
 * RegisterDefaultHandlers - 注册默认钩子处理器
 * 
 * 一键注册所有默认 handlers：
 * - AuditHandler - 审计日志
 * - ApprovalNotifyHandler - 审批通知
 * - TaskSummaryHandler - 任务摘要
 * - SessionStartHandler - 会话启动
 */

import { HookBus } from '../runtime/hook_bus';
import { AuditHandler } from './audit_handler';
import { ApprovalNotifyHandler } from './approval_notify_handler';
import { TaskSummaryHandler } from './task_summary_handler';
import { SessionStartHandler } from './session_start_handler';
import { TelegramBridge } from '../bridge/telegram_bridge';
import { ApprovalBridge } from '../bridge/approval_bridge';
import { TaskStore } from '../runtime/task_store';
import { AgentRegistry } from '../agents/agent_registry';

/** 配置 */
export interface DefaultHandlersConfig {
  hookBus: HookBus;
  telegram?: TelegramBridge;
  approvalBridge?: ApprovalBridge;
  tasks?: TaskStore;
  agents?: AgentRegistry;
  /** 审计日志路径 */
  auditLogPath?: string;
  /** 输出存储根目录 */
  outputStoreRoot?: string;
  /** 默认代理 */
  defaultAgent?: string;
}

/** 默认处理器集合 */
export interface DefaultHandlers {
  audit: AuditHandler;
  approvalNotify: ApprovalNotifyHandler;
  taskSummary: TaskSummaryHandler;
  sessionStart: SessionStartHandler;
}

/**
 * 注册默认钩子处理器
 * 
 * @param config 配置
 * @returns 处理器集合
 */
export function registerDefaultHandlers(config: DefaultHandlersConfig): DefaultHandlers {
  const handlers: DefaultHandlers = {
    audit: new AuditHandler(config.hookBus, {
      logPath: config.auditLogPath,
    }),
    
    approvalNotify: new ApprovalNotifyHandler(config.hookBus, {
      telegram: config.telegram,
      approvalBridge: config.approvalBridge,
    }),
    
    taskSummary: new TaskSummaryHandler(config.hookBus, {
      tasks: config.tasks,
      outputStoreRoot: config.outputStoreRoot,
    }),
    
    sessionStart: new SessionStartHandler(config.hookBus, {
      agents: config.agents,
      defaultAgent: config.defaultAgent,
    }),
  };
  
  console.log('[DefaultHandlers] Registered: audit, approvalNotify, taskSummary, sessionStart');
  
  return handlers;
}

/**
 * 默认启用的钩子列表
 */
export const DEFAULT_HOOKS = [
  'tool.denied',
  'tool.after',
  'task.status_changed',
  'approval.requested',
  'approval.resolved',
  'session.started',
];
