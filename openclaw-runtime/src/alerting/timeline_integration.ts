/**
 * P0 告警闭环：Timeline 集成
 * 
 * 告警动作写入 Timeline：
 * - alert_routed
 * - alert_acknowledged
 * - alert_silenced
 * - alert_escalated
 * - incident_linked
 * - runbook_opened
 */

import { RoutedAlert, AlertAction } from './alert_router.js';
import { IncidentLink, RunbookSession, SilenceConfig, EscalationRecord } from './alert_actions.js';

// ==================== Types ====================

export type TimelineEventType =
  | 'alert_triggered'
  | 'alert_routed'
  | 'alert_acknowledged'
  | 'alert_silenced'
  | 'alert_escalated'
  | 'incident_linked'
  | 'incident_created'
  | 'incident_updated'
  | 'runbook_opened'
  | 'runbook_action'
  | 'runbook_completed'
  | 'recovery_action';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  alert_name?: string;
  alert_severity?: string;
  incident_id?: string;
  correlation_id?: string;
  resource?: string;
  performed_by?: string;
  metadata?: Record<string, unknown>;
  related_events?: string[];
}

export interface TimelineQuery {
  alert_name?: string;
  incident_id?: string;
  correlation_id?: string;
  resource?: string;
  event_type?: TimelineEventType;
  from?: number;
  to?: number;
  limit?: number;
}

// ==================== Timeline Store ====================

export class TimelineStore {
  private events: TimelineEvent[] = [];
  private byAlert: Map<string, string[]> = new Map();
  private byIncident: Map<string, string[]> = new Map();
  private byCorrelation: Map<string, string[]> = new Map();
  private fileRepo: any | null = null; // TimelineFileRepository (lazy load)

  async initialize(): Promise<void> {
    try {
      const { getTimelineFileRepository } = await import('../persistence/timeline_file_repository.js');
      this.fileRepo = getTimelineFileRepository();
      await this.fileRepo.initialize();
      
      // Load events from file into memory
      const loaded = this.fileRepo.query({ limit: 10000 });
      for (const event of loaded) {
        this.events.push(event);
        this.indexEvent(event);
      }
      console.log(`[TimelineStore] Loaded ${loaded.length} events from file`);
    } catch (error) {
      console.warn(`[TimelineStore] File repository initialization failed: ${error}`);
    }
  }

  /**
   * Record an alert triggered event
   */
  recordAlertTriggered(alert_name: string, alert_value?: string, resource?: string, correlation_id?: string): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${alert_name}-triggered`,
      type: 'alert_triggered',
      timestamp: Date.now(),
      alert_name,
      alert_severity: undefined,
      correlation_id,
      resource,
      metadata: { alert_value },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an alert routed event
   */
  recordAlertRouted(routedAlert: RoutedAlert): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${routedAlert.alert_name}-routed`,
      type: 'alert_routed',
      timestamp: Date.now(),
      alert_name: routedAlert.alert_name,
      alert_severity: routedAlert.alert_severity,
      correlation_id: routedAlert.correlation_id,
      resource: routedAlert.resource,
      metadata: {
        runbook_url: routedAlert.runbook_url,
        incident_id: routedAlert.incident_id,
        suggested_actions: routedAlert.suggested_actions,
        related_metrics: routedAlert.related_metrics,
        related_alerts: routedAlert.related_alerts,
      },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an alert action event
   */
  recordAlertAction(
    action: AlertAction,
    alert_name: string,
    performed_by: string,
    metadata?: Record<string, unknown>
  ): TimelineEvent {
    const eventType: TimelineEventType = `alert_${action}` as TimelineEventType;

    const event: TimelineEvent = {
      id: `event-${Date.now()}-${alert_name}-${action}`,
      type: eventType,
      timestamp: Date.now(),
      alert_name,
      performed_by,
      metadata,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an incident created event
   */
  recordIncidentCreated(incident: IncidentLink): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${incident.incident_id}-created`,
      type: 'incident_created',
      timestamp: Date.now(),
      incident_id: incident.incident_id,
      correlation_id: incident.correlation_id,
      performed_by: incident.created_by,
      metadata: {
        incident_type: incident.incident_type,
        related_alerts: incident.related_alerts,
      },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an incident linked event
   */
  recordIncidentLinked(incident_id: string, alert_name: string, performed_by: string): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${incident_id}-linked`,
      type: 'incident_linked',
      timestamp: Date.now(),
      incident_id,
      alert_name,
      performed_by,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record a runbook opened event
   */
  recordRunbookOpened(session: RunbookSession, alert_name: string): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${session.runbook_name}-opened`,
      type: 'runbook_opened',
      timestamp: Date.now(),
      alert_name,
      performed_by: session.opened_by,
      metadata: {
        runbook_name: session.runbook_name,
        session_id: `${alert_name}:${session.opened_by}:${session.opened_at}`,
      },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record a runbook action event
   */
  recordRunbookAction(session: RunbookSession, action: string, performed_by: string, result?: string): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-${session.runbook_name}-action`,
      type: 'runbook_action',
      timestamp: Date.now(),
      performed_by,
      metadata: {
        runbook_name: session.runbook_name,
        action,
        result,
      },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record a recovery action event
   */
  recordRecoveryAction(action: string, performed_by: string, metadata?: Record<string, unknown>): TimelineEvent {
    const event: TimelineEvent = {
      id: `event-${Date.now()}-recovery-${action}`,
      type: 'recovery_action',
      timestamp: Date.now(),
      performed_by,
      metadata,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Add event to store
   */
  public async addEvent(event: TimelineEvent): Promise<void> {
    this.events.push(event);
    this.indexEvent(event);
    
    // Persist to file
    if (this.fileRepo) {
      await this.fileRepo.addEvent(event);
    }
  }

  /**
   * Index event for fast lookup
   */
  private indexEvent(event: TimelineEvent): void {
    if (event.alert_name) {
      const existing = this.byAlert.get(event.alert_name) || [];
      existing.push(event.id);
      this.byAlert.set(event.alert_name, existing);
    }
    if (event.incident_id) {
      const existing = this.byIncident.get(event.incident_id) || [];
      existing.push(event.id);
      this.byIncident.set(event.incident_id, existing);
    }
    if (event.correlation_id) {
      const existing = this.byCorrelation.get(event.correlation_id) || [];
      existing.push(event.id);
      this.byCorrelation.set(event.correlation_id, existing);
    }
  }

  /**
   * Query timeline events
   */
  query(filters: TimelineQuery): TimelineEvent[] {
    let results = [...this.events];

    // Filter by alert_name
    if (filters.alert_name) {
      results = results.filter(e => e.alert_name === filters.alert_name);
    }

    // Filter by incident_id
    if (filters.incident_id) {
      results = results.filter(e => e.incident_id === filters.incident_id);
    }

    // Filter by correlation_id
    if (filters.correlation_id) {
      results = results.filter(e => e.correlation_id === filters.correlation_id);
    }

    // Filter by event_type
    if (filters.event_type) {
      results = results.filter(e => e.type === filters.event_type);
    }

    // Filter by time range
    if (filters.from) {
      results = results.filter(e => e.timestamp >= filters.from!);
    }
    if (filters.to) {
      results = results.filter(e => e.timestamp <= filters.to!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get events by alert name
   */
  getByAlert(alert_name: string, limit: number = 100): TimelineEvent[] {
    return this.query({ alert_name, limit });
  }

  /**
   * Get events by incident ID
   */
  getByIncident(incident_id: string, limit: number = 100): TimelineEvent[] {
    return this.query({ incident_id, limit });
  }

  /**
   * Get events by correlation ID
   */
  getByCorrelation(correlation_id: string, limit: number = 100): TimelineEvent[] {
    return this.query({ correlation_id, limit });
  }

  /**
   * Get recent events
   */
  getRecent(limit: number = 100): TimelineEvent[] {
    return this.query({ limit });
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
    this.byAlert.clear();
    this.byIncident.clear();
    this.byCorrelation.clear();
  }
  
  /**
   * Get statistics
   */
  getStats(): { total: number; by_type: Record<string, number> } {
    const by_type: Record<string, number> = {};
    for (const event of this.events) {
      by_type[event.type] = (by_type[event.type] || 0) + 1;
    }
    return { total: this.events.length, by_type };
  }
}

// ==================== Singleton ====================

let _store: TimelineStore | null = null;

export function getTimelineStore(): TimelineStore {
  if (!_store) {
    _store = new TimelineStore();
  }
  return _store;
}

export function resetTimelineStore(): void {
  _store = null;
}
