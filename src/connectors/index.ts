/**
 * Connectors Module
 * Phase 2B - Workflow Connectors
 */

// ============================================================================
// GitHub Connector (2B-1)
// ============================================================================

export * from './github';

// ============================================================================
// GitHub Actions Connector (2B-2)
// ============================================================================

export * from './github-actions';

// ============================================================================
// Policy
// ============================================================================

export type {
  ConnectorTrustLevel,
  ConnectorActionScope,
  ConnectorPolicy,
} from './policy/connector_policy';

export {
  GITHUB_CONNECTOR_POLICY,
  CICD_CONNECTOR_POLICY,
  ALERT_CONNECTOR_POLICY,
  ConnectorPolicyManager,
  createConnectorPolicyManager,
} from './policy/connector_policy';
