/**
 * Connectors Module
 * Phase 2B - Workflow Connectors
 */

// ============================================================================
// GitHub Connector
// ============================================================================

export * from './github';

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
