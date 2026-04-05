/**
 * Jenkins Types
 * Phase 2B-3A - Jenkins Connector 类型定义
 */
export type JenkinsEventType = 'build_started' | 'build_completed' | 'build_failed' | 'build_unstable' | 'build_aborted' | 'pipeline_started' | 'pipeline_completed' | 'pipeline_failed' | 'input_pending' | 'approval_pending';
export type JenkinsBuildStatus = 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | 'IN_PROGRESS';
export interface JenkinsEvent {
    type: JenkinsEventType;
    timestamp: number;
    job: {
        name: string;
        fullName: string;
        url: string;
        color?: string;
    };
    build?: {
        number: number;
        status: JenkinsBuildStatus;
        duration: number;
        timestamp: number;
        estimatedDuration?: number;
    };
    pipeline?: {
        runId: string;
        status: JenkinsBuildStatus;
        stages?: PipelineStage[];
    };
    input?: {
        id: string;
        message: string;
        submitter: string;
        parameters?: InputParameter[];
    };
    sender: {
        userId: string;
        email?: string;
    };
}
export interface PipelineStage {
    name: string;
    status: JenkinsBuildStatus;
    startTimeMillis: number;
    durationMillis: number;
}
export interface InputParameter {
    name: string;
    type: string;
    value?: any;
    description?: string;
}
/**
 * 映射到 Operator Task
 */
export interface MappedJenkinsTask {
    taskId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'running' | 'completed' | 'failed';
    metadata: {
        source: 'jenkins';
        sourceType: 'build' | 'pipeline';
        sourceId: string;
        jobName: string;
        buildNumber: number;
        url: string;
    };
}
/**
 * 映射到 Operator Approval
 */
export interface MappedJenkinsApproval {
    approvalId: string;
    scope: string;
    reason: string;
    requestingAgent: string;
    metadata: {
        source: 'jenkins';
        sourceType: 'input_step' | 'approval';
        jobName: string;
        buildNumber: number;
        inputId: string;
        url: string;
    };
}
/**
 * 映射到 Operator Incident
 */
export interface MappedJenkinsIncident {
    incidentId: string;
    type: 'build_failure' | 'pipeline_failure' | 'test_failure';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metadata: {
        source: 'jenkins';
        jobName: string;
        buildNumber: number;
        failureReason?: string;
        url: string;
    };
}
/**
 * 映射到 Inbox Item
 */
export interface MappedJenkinsInboxItem {
    itemType: 'task' | 'approval' | 'incident' | 'attention';
    sourceId: string;
    title: string;
    summary: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedActions: string[];
    metadata: Record<string, any>;
}
/**
 * Generic Webhook Trigger Plugin Payload
 * https://plugins.jenkins.io/generic-webhook-trigger/
 */
export interface JenkinsWebhookPayload {
    name: string;
    build: {
        number: number;
        status: JenkinsBuildStatus;
        fullUrl: string;
        phase?: 'STARTED' | 'COMPLETED' | 'FINALIZED';
        status?: JenkinsBuildStatus;
    };
    url: string;
    job: {
        name: string;
        fullName: string;
        url: string;
    };
    user?: {
        userId: string;
        email?: string;
    };
    parameters?: {
        [key: string]: any;
    };
}
/**
 * Pipeline Stage View Plugin Payload
 */
export interface JenkinsPipelineWebhookPayload {
    job: {
        name: string;
        fullName: string;
        url: string;
    };
    run: {
        id: string;
        number: number;
        status: JenkinsBuildStatus;
        stages: PipelineStage[];
    };
}
/**
 * Input Step Payload
 */
export interface JenkinsInputWebhookPayload {
    job: {
        name: string;
        fullName: string;
        url: string;
    };
    build: {
        number: number;
        phase: 'PAUSED_PENDING_INPUT';
    };
    input: {
        id: string;
        message: string;
        submitter: string;
        parameters?: InputParameter[];
    };
}
export interface JenkinsBuildInfo {
    number: number;
    status: JenkinsBuildStatus;
    result: JenkinsBuildStatus | null;
    duration: number;
    timestamp: number;
    estimatedDuration: number;
    building: boolean;
    url: string;
    actions: JenkinsBuildAction[];
}
export interface JenkinsBuildAction {
    input?: {
        id: string;
        message: string;
        submitter: string;
        parameters?: InputParameter[];
    };
}
export interface JenkinsJobInfo {
    name: string;
    fullName: string;
    url: string;
    color: string;
    buildable: boolean;
    builds: Array<{
        number: number;
        url: string;
    }>;
}
export interface JenkinsConnectorConfig {
    baseUrl: string;
    username?: string;
    token?: string;
    webhookSecret?: string;
    timeoutMs?: number;
}
export interface JenkinsEventAdapterConfig {
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
    autoCreateTask?: boolean;
    failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
    ignoreJobs?: string[];
    requireApprovalForJobs?: string[];
}
