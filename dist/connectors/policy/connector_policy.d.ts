/**
 * Connector Policy
 * Phase 2B-1 - 连接器策略配置
 *
 * 职责：
 * - 定义连接器信任级别
 * - 定义可用动作范围
 * - 定义 Workspace 范围
 * - 定义失败降级策略
 */
export type ConnectorTrustLevel = 'full' | 'limited' | 'readonly' | 'untrusted';
export type ConnectorActionScope = 'all' | 'read' | 'write' | 'none';
export interface ConnectorPolicy {
    /** 连接器 ID */
    connectorId: string;
    /** 连接器名称 */
    name: string;
    /** 信任级别 */
    trustLevel: ConnectorTrustLevel;
    /** 可用动作范围 */
    actionScope: ConnectorActionScope;
    /** 允许的动作列表 */
    allowedActions?: string[];
    /** 禁止的动作列表 */
    deniedActions?: string[];
    /** Workspace 范围 */
    workspaceScope?: string[];
    /** 失败降级策略 */
    failurePolicy?: {
        /** 失败后重试次数 */
        maxRetries?: number;
        /** 失败后降级模式 */
        downgradeTo?: ConnectorTrustLevel;
        /** 失败后通知 */
        notifyOnFailure?: boolean;
    };
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * GitHub Connector 策略（默认）
 */
export declare const GITHUB_CONNECTOR_POLICY: ConnectorPolicy;
/**
 * CI/CD Connector 策略（预留）
 */
export declare const CICD_CONNECTOR_POLICY: ConnectorPolicy;
/**
 * Alert Connector 策略（预留）
 */
export declare const ALERT_CONNECTOR_POLICY: ConnectorPolicy;
export declare class ConnectorPolicyManager {
    private policies;
    constructor(policies?: ConnectorPolicy[]);
    /**
     * 注册策略
     */
    registerPolicy(policy: ConnectorPolicy): void;
    /**
     * 获取策略
     */
    getPolicy(connectorId: string): ConnectorPolicy | null;
    /**
     * 检查动作是否允许
     */
    isActionAllowed(connectorId: string, action: string): boolean;
    /**
     * 获取信任级别
     */
    getTrustLevel(connectorId: string): ConnectorTrustLevel | null;
}
export declare function createConnectorPolicyManager(policies?: ConnectorPolicy[]): ConnectorPolicyManager;
