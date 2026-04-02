/**
 * Bridge Module - 桥接模块
 * 
 * 审批桥接、Telegram 推送、远程会话等。
 */

export { ApprovalBridge } from './approval_bridge';
export { ApprovalStore, type ApprovalRequest, type ApprovalDecision } from './approval_store';
export { TelegramBridge } from './telegram_bridge';
