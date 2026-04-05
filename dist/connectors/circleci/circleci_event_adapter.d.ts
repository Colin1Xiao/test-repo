/**
 * CircleCI Event Adapter
 * Phase 2B-3B - CircleCI 事件适配器
 *
 * 职责：
 * - 将 CircleCI 事件转换为内部标准事件
 * - workflow_failed → Incident
 * - approval_pending → Approval
 */
import type { CircleCIEvent, MappedCircleCIIncident, MappedCircleCIApproval, MappedCircleCIInboxItem } from './circleci_types';
export interface CircleCIEventAdapterConfig {
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
    autoCreateAttention?: boolean;
    failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
    ignoreProjects?: string[];
    requireApprovalForWorkflows?: string[];
}
export declare class CircleCIEventAdapter {
    private config;
    constructor(config?: CircleCIEventAdapterConfig);
    /**
     * 适配 CircleCI 事件
     */
    adaptEvent(event: CircleCIEvent): {
        incident?: MappedCircleCIIncident;
        approval?: MappedCircleCIApproval;
        inboxItem?: MappedCircleCIInboxItem;
    };
    /**
     * 适配失败事件 → Incident
     */
    private adaptFailedEvent;
    /**
     * 适配审批事件 → Approval
     */
    private adaptApprovalEvent;
    /**
     * 适配等待事件 → Attention
     */
    private adaptOnHoldEvent;
    /**
     * 映射失败事件到 Incident
     */
    private mapFailedEventToIncident;
    /**
     * 映射失败事件到 Inbox Item
     */
    private mapFailedEventToInboxItem;
    /**
     * 映射审批事件到 Approval
     */
    private mapApprovalEventToApproval;
    /**
     * 映射审批事件到 Inbox Item
     */
    private mapApprovalEventToInboxItem;
    /**
     * 映射等待事件到 Inbox Item
     */
    private mapOnHoldEventToInboxItem;
}
export declare function createCircleCIEventAdapter(config?: CircleCIEventAdapterConfig): CircleCIEventAdapter;
