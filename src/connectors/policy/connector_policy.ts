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

// ============================================================================
// 基础类型
// ============================================================================

export type ConnectorTrustLevel =
  | 'full'       // 完全信任，可执行所有动作
  | 'limited'    // 有限信任，只读 + 部分写动作
  | 'readonly'   // 只读
  | 'untrusted'; // 不信任，需要人工确认

export type ConnectorActionScope =
  | 'all'        // 所有动作
  | 'read'       // 只读动作
  | 'write'      // 写动作
  | 'none';      // 无动作

// ============================================================================
// 连接器策略
// ============================================================================

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

// ============================================================================
// 预定义策略
// ============================================================================

/**
 * GitHub Connector 策略（默认）
 */
export const GITHUB_CONNECTOR_POLICY: ConnectorPolicy = {
  connectorId: 'github',
  name: 'GitHub Connector',
  trustLevel: 'limited',
  actionScope: 'write',
  allowedActions: [
    'view_pr',
    'approve_pr',
    'reject_pr',
    'merge_pr',
    'view_checks',
  ],
  deniedActions: [
    'delete_branch',
    'close_pr_without_approval',
  ],
  workspaceScope: ['local-default', 'demo-default'],
  failurePolicy: {
    maxRetries: 3,
    downgradeTo: 'readonly',
    notifyOnFailure: true,
  },
  metadata: {
    version: '1.0',
    lastUpdated: Date.now(),
  },
};

/**
 * CI/CD Connector 策略（预留）
 */
export const CICD_CONNECTOR_POLICY: ConnectorPolicy = {
  connectorId: 'cicd',
  name: 'CI/CD Connector',
  trustLevel: 'readonly',
  actionScope: 'read',
  allowedActions: [
    'view_builds',
    'view_deployments',
    'trigger_build',
  ],
  workspaceScope: ['local-default', 'demo-default'],
  failurePolicy: {
    maxRetries: 3,
    notifyOnFailure: false,
  },
};

/**
 * Alert Connector 策略（预留）
 */
export const ALERT_CONNECTOR_POLICY: ConnectorPolicy = {
  connectorId: 'alert',
  name: 'Alert Connector',
  trustLevel: 'limited',
  actionScope: 'write',
  allowedActions: [
    'view_alerts',
    'ack_alert',
    'resolve_alert',
  ],
  deniedActions: [
    'delete_alert',
  ],
  workspaceScope: ['local-default', 'demo-default', 'production'],
  failurePolicy: {
    maxRetries: 5,
    downgradeTo: 'readonly',
    notifyOnFailure: true,
  },
};

// ============================================================================
// 策略管理器
// ============================================================================

export class ConnectorPolicyManager {
  private policies: Map<string, ConnectorPolicy> = new Map();
  
  constructor(policies: ConnectorPolicy[] = []) {
    // 注册默认策略
    this.registerPolicy(GITHUB_CONNECTOR_POLICY);
    this.registerPolicy(CICD_CONNECTOR_POLICY);
    this.registerPolicy(ALERT_CONNECTOR_POLICY);
    
    // 注册自定义策略
    for (const policy of policies) {
      this.registerPolicy(policy);
    }
  }
  
  /**
   * 注册策略
   */
  registerPolicy(policy: ConnectorPolicy): void {
    this.policies.set(policy.connectorId, policy);
  }
  
  /**
   * 获取策略
   */
  getPolicy(connectorId: string): ConnectorPolicy | null {
    return this.policies.get(connectorId) || null;
  }
  
  /**
   * 检查动作是否允许
   */
  isActionAllowed(connectorId: string, action: string): boolean {
    const policy = this.getPolicy(connectorId);
    
    if (!policy) return false;
    
    // 检查 deniedActions
    if (policy.deniedActions?.includes(action)) {
      return false;
    }
    
    // 检查 allowedActions
    if (policy.allowedActions && policy.allowedActions.length > 0) {
      return policy.allowedActions.includes(action);
    }
    
    // 根据 actionScope 判断
    if (policy.actionScope === 'none') return false;
    if (policy.actionScope === 'all') return true;
    
    // read/write 需要更细粒度的判断
    return true;
  }
  
  /**
   * 获取信任级别
   */
  getTrustLevel(connectorId: string): ConnectorTrustLevel | null {
    const policy = this.getPolicy(connectorId);
    return policy?.trustLevel ?? null;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createConnectorPolicyManager(
  policies?: ConnectorPolicy[]
): ConnectorPolicyManager {
  return new ConnectorPolicyManager(policies);
}
