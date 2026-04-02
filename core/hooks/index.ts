/**
 * Hooks Module - 钩子模块
 * 
 * 事件总线 + 默认处理器。
 */

export { HookBus } from '../runtime/hook_bus';
export type { RuntimeEvent, HookHandler, HookConfig } from '../runtime/hook_types';

// 默认处理器
export { AuditHandler } from './audit_handler';
export { ApprovalNotifyHandler } from './approval_notify_handler';
export { TaskSummaryHandler } from './task_summary_handler';
export { SessionStartHandler } from './session_start_handler';

// 注册函数
export { registerDefaultHandlers, DEFAULT_HOOKS } from './register_default_handlers';
