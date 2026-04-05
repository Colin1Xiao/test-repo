/**
 * P0: Alert Action API
 * 
 * 告警处置动作：acknowledge / silence / escalate / link_incident / open_runbook
 */

import { RoutedAlert, AlertAction, getAlertRouter } from './alert_router.js';

// ==================== Types ====================

export interface AlertActionRequest {
  alert_name: string;
  action: AlertAction;
  performed_by: string;
  performed_at?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertActionResponse {
  success: boolean;
  action: AlertAction;
  alert_name: string;
  performed_at: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentLink {
  incident_id: string;
  incident_type: string;
  created_at: number;
  created_by: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  correlation_id?: string;
  related_alerts: string[];
}

export interface RunbookSession {
  runbook_name: string;
  opened_at: number;
  opened_by: string;
  actions_taken: RunbookAction[];
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface RunbookAction {
  action: string;
  performed_at: number;
  performed_by: string;
  result?: string;
}

export interface SilenceConfig {
  alert_name: string;
  silenced_by: string;
  silenced_at: number;
  expires_at: number;
  reason: string;
}

export interface EscalationRecord {
  alert_name: string;
  escalated_from: string;
  escalated_to: string;
  escalated_at: number;
  reason: string;
}

// ==================== Alert Action Handler ====================

export class AlertActionHandler {
  private activeSilences: Map<string, SilenceConfig> = new Map();
  private incidentLinks: Map<string, IncidentLink> = new Map();
  private runbookSessions: Map<string, RunbookSession> = new Map();
  private escalationRecords: EscalationRecord[] = [];
  private actionHistory: AlertActionResponse[] = [];

  private router = getAlertRouter();

  /**
   * Execute an alert action
   */
  async execute(request: AlertActionRequest): Promise<AlertActionResponse> {
    const { alert_name, action, performed_by, reason, metadata } = request;

    // Validate alert exists
    const definition = this.router.getDefinition(alert_name);
    if (!definition) {
      return {
        success: false,
        action,
        alert_name,
        performed_at: Date.now(),
        message: `Unknown alert: ${alert_name}`,
      };
    }

    let response: AlertActionResponse;

    switch (action) {
      case 'acknowledge':
        response = await this.acknowledge(alert_name, performed_by, reason);
        break;
      case 'silence':
        response = await this.silence(alert_name, performed_by, metadata as Partial<SilenceConfig>);
        break;
      case 'escalate':
        response = await this.escalate(alert_name, performed_by, reason);
        break;
      case 'link_incident':
        response = await this.linkIncident(alert_name, performed_by, metadata as Partial<IncidentLink>);
        break;
      case 'open_runbook':
        response = await this.openRunbook(alert_name, performed_by);
        break;
      default:
        return {
          success: false,
          action,
          alert_name,
          performed_at: Date.now(),
          message: `Unknown action: ${action}`,
        };
    }

    // Record action
    this.actionHistory.push(response);

    return response;
  }

  /**
   * Acknowledge an alert
   */
  private async acknowledge(alert_name: string, performed_by: string, reason?: string): Promise<AlertActionResponse> {
    return {
      success: true,
      action: 'acknowledge',
      alert_name,
      performed_at: Date.now(),
      message: `Alert ${alert_name} acknowledged by ${performed_by}`,
      metadata: { acknowledged_by: performed_by, reason },
    };
  }

  /**
   * Silence an alert
   */
  private async silence(alert_name: string, performed_by: string, config?: Partial<SilenceConfig>): Promise<AlertActionResponse> {
    const duration = config?.expires_at ? config.expires_at - Date.now() : 3600000; // Default 1 hour
    const expires_at = config?.expires_at || Date.now() + duration;

    const silence: SilenceConfig = {
      alert_name,
      silenced_by: performed_by,
      silenced_at: Date.now(),
      expires_at,
      reason: config?.reason || 'Manual silence',
    };

    this.activeSilences.set(`${alert_name}:${performed_by}`, silence);

    return {
      success: true,
      action: 'silence',
      alert_name,
      performed_at: Date.now(),
      message: `Alert ${alert_name} silenced until ${new Date(expires_at).toISOString()}`,
      metadata: { expires_at: expires_at, reason: silence.reason },
    };
  }

  /**
   * Escalate an alert
   */
  private async escalate(alert_name: string, performed_by: string, reason?: string): Promise<AlertActionResponse> {
    const definition = this.router.getDefinition(alert_name);
    if (!definition) {
      return {
        success: false,
        action: 'escalate',
        alert_name,
        performed_at: Date.now(),
        message: `Unknown alert: ${alert_name}`,
      };
    }

    const escalation_policy = definition.escalation_policy || 'default';
    const escalated_to = this.getEscalationTarget(escalation_policy);

    const record: EscalationRecord = {
      alert_name,
      escalated_from: performed_by,
      escalated_to: escalated_to,
      escalated_at: Date.now(),
      reason: reason || 'Manual escalation',
    };

    this.escalationRecords.push(record);

    return {
      success: true,
      action: 'escalate',
      alert_name,
      performed_at: Date.now(),
      message: `Alert ${alert_name} escalated to ${escalated_to}`,
      metadata: { escalated_to, escalation_policy: escalation_policy },
    };
  }

  /**
   * Link alert to an incident
   */
  private async linkIncident(alert_name: string, performed_by: string, metadata?: Partial<IncidentLink>): Promise<AlertActionResponse> {
    const definition = this.router.getDefinition(alert_name);
    if (!definition) {
      return {
        success: false,
        action: 'link_incident',
        alert_name,
        performed_at: Date.now(),
        message: `Unknown alert: ${alert_name}`,
      };
    }

    const incident_id = metadata?.incident_id || `incident-${Date.now()}-${alert_name}`;
    const incident_type = metadata?.incident_type || definition.incident_type || 'general';

    const existing = this.incidentLinks.get(incident_id);
    if (existing) {
      // Add alert to existing incident
      if (!existing.related_alerts.includes(alert_name)) {
        existing.related_alerts.push(alert_name);
      }
    } else {
      // Create new incident
      const incident: IncidentLink = {
        incident_id,
        incident_type,
        created_at: Date.now(),
        created_by: performed_by,
        status: 'open',
        correlation_id: metadata?.correlation_id,
        related_alerts: [alert_name],
      };
      this.incidentLinks.set(incident_id, incident);
    }

    return {
      success: true,
      action: 'link_incident',
      alert_name,
      performed_at: Date.now(),
      message: `Alert ${alert_name} linked to incident ${incident_id}`,
      metadata: { incident_id, incident_type },
    };
  }

  /**
   * Open runbook for an alert
   */
  private async openRunbook(alert_name: string, performed_by: string): Promise<AlertActionResponse> {
    const definition = this.router.getDefinition(alert_name);
    if (!definition) {
      return {
        success: false,
        action: 'open_runbook',
        alert_name,
        performed_at: Date.now(),
        message: `Unknown alert: ${alert_name}`,
      };
    }

    const runbook_name = definition.runbook;
    const session_id = `${alert_name}:${performed_by}:${Date.now()}`;

    const session: RunbookSession = {
      runbook_name,
      opened_at: Date.now(),
      opened_by: performed_by,
      actions_taken: [],
      status: 'in_progress',
    };

    this.runbookSessions.set(session_id, session);

    return {
      success: true,
      action: 'open_runbook',
      alert_name,
      performed_at: Date.now(),
      message: `Runbook ${runbook_name} opened for alert ${alert_name}`,
      metadata: { runbook_name, session_id },
    };
  }

  /**
   * Get escalation target based on policy
   */
  private getEscalationTarget(policy: string): string {
    switch (policy) {
      case 'immediate':
        return 'on-call-lead';
      case '15min':
        return 'tech-lead';
      default:
        return 'default-escalation';
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get active silences
   */
  getActiveSilences(): SilenceConfig[] {
    const now = Date.now();
    return Array.from(this.activeSilences.values()).filter(s => s.expires_at > now);
  }

  /**
   * Get incident by ID
   */
  getIncident(incident_id: string): IncidentLink | undefined {
    return this.incidentLinks.get(incident_id);
  }

  /**
   * Get all open incidents
   */
  getOpenIncidents(): IncidentLink[] {
    return Array.from(this.incidentLinks.values()).filter(i => i.status === 'open' || i.status === 'investigating');
  }

  /**
   * Get runbook session
   */
  getRunbookSession(session_id: string): RunbookSession | undefined {
    return this.runbookSessions.get(session_id);
  }

  /**
   * Get action history
   */
  getActionHistory(limit: number = 100): AlertActionResponse[] {
    return this.actionHistory.slice(-limit);
  }

  /**
   * Get escalation records
   */
  getEscalationRecords(): EscalationRecord[] {
    return this.escalationRecords;
  }
}

// ==================== Singleton ====================

let _handler: AlertActionHandler | null = null;

export function getAlertActionHandler(): AlertActionHandler {
  if (!_handler) {
    _handler = new AlertActionHandler();
  }
  return _handler;
}
