/**
 * Trading Engineering Ops Types
 * Phase 2C-1 - 交易工程运维域类型定义
 */
export type TradingEventType = 'release_requested' | 'release_approved' | 'release_rejected' | 'release_deployed' | 'release_rolled_back' | 'risk_parameter_changed' | 'config_changed' | 'system_alert' | 'deployment_pending' | 'deployment_failed' | 'execution_anomaly' | 'market_data_degradation';
export type TradingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TradingReleaseStatus = 'pending_approval' | 'approved' | 'rejected' | 'deploying' | 'deployed' | 'rolled_back' | 'failed';
export type TradingAlertType = 'latency_spike' | 'order_failure' | 'market_data_degradation' | 'deployment_regression' | 'risk_breach' | 'system_health';
export interface TradingEvent {
    type: TradingEventType;
    timestamp: number;
    severity: TradingSeverity;
    source: {
        system: string;
        component: string;
        environment: 'testnet' | 'mainnet';
    };
    actor: {
        userId: string;
        username: string;
    };
    metadata: Record<string, any>;
}
export interface TradingReleaseRequest {
    id: string;
    type: 'strategy_release' | 'config_change' | 'risk_parameter_change';
    status: TradingReleaseStatus;
    createdAt: number;
    updatedAt: number;
    requestedBy: {
        userId: string;
        username: string;
    };
    approvedBy?: {
        userId: string;
        username: string;
        approvedAt: number;
    };
    rejectedBy?: {
        userId: string;
        username: string;
        rejectedAt: number;
        reason: string;
    };
    details: {
        strategy?: string;
        version?: string;
        description: string;
        changes: string[];
        riskLevel: TradingSeverity;
        rollbackPlan: string;
    };
    deployment?: {
        environment: string;
        githubDeploymentId?: number;
        workflowId?: string;
        status: string;
    };
}
export interface TradingSystemAlert {
    id: string;
    type: TradingAlertType;
    severity: TradingSeverity;
    title: string;
    description: string;
    createdAt: number;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: number;
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: number;
    resolution?: string;
    metadata: {
        system: string;
        component: string;
        environment: 'testnet' | 'mainnet';
        metric?: string;
        threshold?: string;
        currentValue?: string;
        relatedDeploymentId?: string;
        relatedReleaseId?: string;
    };
}
export interface TradingRunbookAction {
    id: string;
    type: RunbookActionType;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    createdAt: number;
    executedAt?: number;
    executedBy?: string;
    target: {
        type: string;
        id: string;
    };
    parameters?: Record<string, any>;
    result?: {
        success: boolean;
        message: string;
        metadata?: Record<string, any>;
    };
}
export type RunbookActionType = 'acknowledge' | 'rollback' | 'pause' | 'escalate' | 'replay' | 'recovery' | 'request_recovery' | 'pause_rollout' | 'rollback_hint' | 'release_hold' | 'risk_override';
/**
 * 映射到 Operator Approval
 */
export interface MappedTradingApproval {
    approvalId: string;
    scope: string;
    reason: string;
    requestingAgent: string;
    metadata: {
        source: 'trading_ops';
        sourceType: 'release_approval' | 'risk_change_approval' | 'deployment_gate';
        sourceId?: string;
        releaseId?: string;
        deploymentId?: string;
        riskLevel: TradingSeverity;
        environment: string;
        strategyName?: string;
        version?: string;
        parameter?: string;
        oldValue?: string;
        newValue?: string;
        githubDeploymentId?: number;
        environmentName?: string;
    };
}
/**
 * 映射到 Operator Incident
 */
export interface MappedTradingIncident {
    incidentId: string;
    type: string;
    severity: TradingSeverity;
    description: string;
    metadata: {
        source: 'trading_ops';
        sourceId?: string;
        alertId: string;
        alertType: TradingAlertType;
        system: string;
        component: string;
        environment: string;
        relatedReleaseId?: string;
        relatedDeploymentId?: string;
        githubDeploymentId?: number;
        orderType?: string;
        failureReason?: string;
        errorMessage?: string;
    };
}
/**
 * 映射到 Operator Task
 */
export interface MappedTradingTask {
    taskId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'running' | 'completed' | 'failed';
    metadata: {
        source: 'trading_ops';
        releaseId?: string;
        deploymentId?: string;
        alertId?: string;
    };
}
export interface TradingDashboardSnapshot {
    snapshotId: string;
    generatedAt: number;
    releases: {
        pending: number;
        deploying: number;
        deployed24h: number;
        rolledBack24h: number;
    };
    alerts: {
        active: number;
        critical: number;
        acknowledged: number;
        resolved24h: number;
    };
    deployments: {
        pending: number;
        failed24h: number;
        successRate24h: number;
    };
    risk: {
        currentLevel: TradingSeverity;
        recentChanges: number;
        breaches24h: number;
    };
}
export interface TradingReleaseReadiness {
    releaseId: string;
    ready: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message?: string;
    }>;
    blockers: string[];
    warnings: string[];
}
export interface TradingActiveIncidents {
    total: number;
    critical: number;
    items: Array<{
        id: string;
        type: TradingAlertType;
        severity: TradingSeverity;
        title: string;
        age: number;
        acknowledged: boolean;
    }>;
}
export interface TradingPendingApprovals {
    total: number;
    items: Array<{
        id: string;
        type: string;
        scope: string;
        riskLevel: TradingSeverity;
        age: number;
        requestedBy: string;
    }>;
}
export interface TradingRiskState {
    level: TradingSeverity;
    lastChanged: number;
    recentChanges: Array<{
        timestamp: number;
        from: TradingSeverity;
        to: TradingSeverity;
        reason: string;
        changedBy: string;
    }>;
    breaches24h: Array<{
        timestamp: number;
        metric: string;
        threshold: string;
        value: string;
    }>;
}
export interface TradingOpsPackConfig {
    environment?: 'testnet' | 'mainnet';
    autoCreateApproval?: boolean;
    autoCreateIncident?: boolean;
    alertSeverityThreshold?: TradingSeverity;
    requireApprovalForRiskLevel?: TradingSeverity;
    githubActionsIntegration?: {
        enabled: boolean;
        deploymentWebhookPath?: string;
    };
}
