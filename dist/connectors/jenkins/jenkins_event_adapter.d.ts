/**
 * Jenkins Event Adapter
 * Phase 2B-3A - Jenkins 事件适配器
 *
 * 职责：
 * - 将 Jenkins 事件转换为内部标准事件
 * - build_failed → Incident
 * - input_pending → Approval
 */
import type { JenkinsEvent, MappedJenkinsIncident, MappedJenkinsApproval, MappedJenkinsInboxItem } from './jenkins_types';
export interface JenkinsEventAdapterConfig {
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
    autoCreateAttention?: boolean;
    failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
    ignoreJobs?: string[];
    requireApprovalForJobs?: string[];
}
export declare class JenkinsEventAdapter {
    private config;
    constructor(config?: JenkinsEventAdapterConfig);
    /**
     * 适配 Jenkins 事件
     */
    adaptEvent(event: JenkinsEvent): {
        incident?: MappedJenkinsIncident;
        approval?: MappedJenkinsApproval;
        inboxItem?: MappedJenkinsInboxItem;
    };
    /**
     * 适配失败事件 → Incident
     */
    private adaptFailedEvent;
    /**
     * 适配 Input 事件 → Approval
     */
    private adaptInputEvent;
    /**
     * 适配不稳定事件 → Attention
     */
    private adaptUnstableEvent;
    /**
     * 映射失败事件到 Incident
     */
    private mapFailedEventToIncident;
    /**
     * 映射失败事件到 Inbox Item
     */
    private mapFailedEventToInboxItem;
    /**
     * 映射 Input 事件到 Approval
     */
    private mapInputEventToApproval;
    /**
     * 映射 Input 事件到 Inbox Item
     */
    private mapInputEventToInboxItem;
    /**
     * 映射不稳定事件到 Inbox Item
     */
    private mapUnstableEventToInboxItem;
}
export declare function createJenkinsEventAdapter(config?: JenkinsEventAdapterConfig): JenkinsEventAdapter;
