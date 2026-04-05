/**
 * P0 告警闭环：Incident Repository 集成
 * 
 * Incident 持久化与防重复创建：
 * - 相同 alert/correlation/resource 防重复建 incident
 * - 已存在 incident 时自动挂接
 */

import { TimelineEvent, getTimelineStore } from './timeline_integration.js';

// ==================== Types ====================

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface Incident {
  id: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by?: string;
  resolved_at?: number;
  resolved_by?: string;
  correlation_id?: string;
  resource?: string;
  related_alerts: string[];
  related_incidents?: string[];
  metadata?: Record<string, unknown>;
  version: number;  // Phase 4.x-A1: Optimistic locking version
}

export interface IncidentCreateRequest {
  type: string;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  correlation_id?: string;
  resource?: string;
  alert_name?: string;
  created_by: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentUpdateRequest {
  status?: IncidentStatus;
  description?: string;
  related_incidents?: string[];
  metadata?: Record<string, unknown>;
  updated_by: string;
  version?: number;  // Phase 4.x-A1: Expected version for compare-and-set
}

// Phase 4.x-A1: Optimistic locking result types
export interface IncidentUpdateSuccess {
  success: true;
  incident: Incident;
}

export interface IncidentUpdateConflict {
  success: false;
  error: 'VERSION_MISMATCH' | 'NOT_FOUND';
  message: string;
  current_version?: number;
}

export type IncidentUpdateResult = IncidentUpdateSuccess | IncidentUpdateConflict;

// Phase 4.x-A1: Repository configuration
export interface IncidentRepositoryConfig {
  strict_version_check?: boolean;  // Default: false (backward compatible)
}

// Phase 4.x-A1-3: Conflict event types
export interface ConflictAuditEvent {
  type: 'write_conflict';
  object_type: 'incident';
  object_id: string;
  timestamp: number;
  actor: string;
  metadata: {
    expected_version: number;
    actual_version: number;
    attempted_change: {
      field: string;
      from: any;
      to: any;
    };
    correlation_id?: string;
  };
}

export interface ConflictTimelineEvent {
  type: 'update_conflict';
  incident_id: string;
  timestamp: number;
  correlation_id?: string;
  metadata: {
    reason: 'VERSION_MISMATCH';
    expected_version: number;
    actual_version: number;
    actor: string;
  };
}

export interface IncidentQuery {
  type?: string;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  correlation_id?: string;
  resource?: string;
  alert_name?: string;
  created_from?: number;
  created_to?: number;
  limit?: number;
}

// ==================== Incident Repository ====================

export class IncidentRepository {
  private incidents: Map<string, Incident> = new Map();
  private byCorrelation: Map<string, string[]> = new Map(); // correlation_id → incident_ids
  private byResource: Map<string, string[]> = new Map(); // resource → incident_ids
  private byAlert: Map<string, string[]> = new Map(); // alert_name → incident_ids
  private byStatus: Map<IncidentStatus, string[]> = new Map();

  private timelineStore = getTimelineStore();

  /**
   * Create or get existing incident
   * 
   * 防重复逻辑：
   * 1. 检查相同 correlation_id 的 open incident
   * 2. 检查相同 resource 的 open incident（同类型）
   * 3. 检查相同 alert 的 open incident（5 分钟内）
   */
  createOrGet(request: IncidentCreateRequest): { incident: Incident; created: boolean } {
    const { type, severity, title, description, correlation_id, resource, alert_name, created_by, metadata } = request;

    // Check for existing open incident
    const existing = this.findExistingIncident(type, correlation_id, resource, alert_name);
    if (existing) {
      // Add related alert if new
      if (alert_name && !existing.related_alerts.includes(alert_name)) {
        existing.related_alerts.push(alert_name);
        existing.updated_at = Date.now();
        existing.updated_by = created_by;
        this.save(existing);

        // Record in timeline
        this.timelineStore.recordIncidentLinked(existing.id, alert_name, created_by);
      }

      return { incident: existing, created: false };
    }

    // Create new incident
    const incident: Incident = {
      id: `incident-${Date.now()}-${type}`,
      type,
      severity,
      status: 'open',
      title,
      description,
      created_at: Date.now(),
      created_by,
      updated_at: Date.now(),
      correlation_id,
      resource,
      related_alerts: alert_name ? [alert_name] : [],
      related_incidents: [],
      metadata,
    };

    this.save(incident);

    // Record in timeline
    const timelineEvent: TimelineEvent = {
      id: `event-${Date.now()}-${incident.id}-created`,
      type: 'incident_created',
      timestamp: Date.now(),
      incident_id: incident.id,
      correlation_id: incident.correlation_id,
      performed_by: incident.created_by,
      metadata: {
        incident_type: incident.type,
        related_alerts: incident.related_alerts,
      },
    };
    this.timelineStore.addEvent(timelineEvent);

    return { incident, created: true };
  }

  /**
   * Find existing open incident
   */
  private findExistingIncident(
    type: string,
    correlation_id?: string,
    resource?: string,
    alert_name?: string
  ): Incident | undefined {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Check by correlation_id
    if (correlation_id) {
      const incidentIds = this.byCorrelation.get(correlation_id) || [];
      for (const id of incidentIds) {
        const incident = this.incidents.get(id);
        if (incident && incident.status === 'open' && incident.type === type) {
          return incident;
        }
      }
    }

    // Check by resource
    if (resource) {
      const incidentIds = this.byResource.get(resource) || [];
      for (const id of incidentIds) {
        const incident = this.incidents.get(id);
        if (incident && incident.status === 'open' && incident.type === type && incident.resource === resource) {
          return incident;
        }
      }
    }

    // Check by alert_name (within 5 minutes)
    if (alert_name) {
      const incidentIds = this.byAlert.get(alert_name) || [];
      for (const id of incidentIds) {
        const incident = this.incidents.get(id);
        if (incident && incident.status === 'open' && incident.type === type && incident.created_at > fiveMinutesAgo) {
          return incident;
        }
      }
    }

    return undefined;
  }

  /**
   * Save incident to repository
   */
  private save(incident: Incident): void {
    this.incidents.set(incident.id, incident);

    // Index by correlation_id
    if (incident.correlation_id) {
      const existing = this.byCorrelation.get(incident.correlation_id) || [];
      if (!existing.includes(incident.id)) {
        existing.push(incident.id);
        this.byCorrelation.set(incident.correlation_id, existing);
      }
    }

    // Index by resource
    if (incident.resource) {
      const existing = this.byResource.get(incident.resource) || [];
      if (!existing.includes(incident.id)) {
        existing.push(incident.id);
        this.byResource.set(incident.resource, existing);
      }
    }

    // Index by related_alerts
    for (const alert_name of incident.related_alerts) {
      const existing = this.byAlert.get(alert_name) || [];
      if (!existing.includes(incident.id)) {
        existing.push(incident.id);
        this.byAlert.set(alert_name, existing);
      }
    }

    // Index by status
    const statusGroup = this.byStatus.get(incident.status) || [];
    if (!statusGroup.includes(incident.id)) {
      statusGroup.push(incident.id);
      this.byStatus.set(incident.status, statusGroup);
    }
  }

  /**
   * Update incident
   */
  update(incident_id: string, request: IncidentUpdateRequest): Incident | undefined {
    const incident = this.incidents.get(incident_id);
    if (!incident) {
      return undefined;
    }

    const { status, description, related_incidents, metadata, updated_by } = request;

    if (status) {
      const oldStatus = incident.status;
      incident.status = status;
      incident.updated_at = Date.now();
      incident.updated_by = updated_by;

      // Update status index
      const oldGroup = this.byStatus.get(oldStatus) || [];
      const oldIndex = oldGroup.indexOf(incident_id);
      if (oldIndex > -1) {
        oldGroup.splice(oldIndex, 1);
        this.byStatus.set(oldStatus, oldGroup);
      }

      const newGroup = this.byStatus.get(status) || [];
      if (!newGroup.includes(incident_id)) {
        newGroup.push(incident_id);
        this.byStatus.set(status, newGroup);
      }

      // Record resolved
      if (status === 'resolved' || status === 'closed') {
        incident.resolved_at = Date.now();
        incident.resolved_by = updated_by;
      }
    }

    if (description) {
      incident.description = description;
      incident.updated_at = Date.now();
      incident.updated_by = updated_by;
    }

    if (related_incidents) {
      incident.related_incidents = related_incidents;
      incident.updated_at = Date.now();
      incident.updated_by = updated_by;
    }

    if (metadata) {
      incident.metadata = { ...incident.metadata, ...metadata };
      incident.updated_at = Date.now();
      incident.updated_by = updated_by;
    }

    this.incidents.set(incident_id, incident);
    return incident;
  }

  /**
   * Get incident by ID
   */
  getById(incident_id: string): Incident | undefined {
    return this.incidents.get(incident_id);
  }

  /**
   * Query incidents
   */
  query(filters: IncidentQuery): Incident[] {
    let results = Array.from(this.incidents.values());

    // Filter by type
    if (filters.type) {
      results = results.filter(i => i.type === filters.type);
    }

    // Filter by status
    if (filters.status) {
      results = results.filter(i => i.status === filters.status);
    }

    // Filter by severity
    if (filters.severity) {
      results = results.filter(i => i.severity === filters.severity);
    }

    // Filter by correlation_id
    if (filters.correlation_id) {
      results = results.filter(i => i.correlation_id === filters.correlation_id);
    }

    // Filter by resource
    if (filters.resource) {
      results = results.filter(i => i.resource === filters.resource);
    }

    // Filter by alert_name
    if (filters.alert_name) {
      results = results.filter(i => i.related_alerts.includes(filters.alert_name!));
    }

    // Filter by time range
    if (filters.created_from) {
      results = results.filter(i => i.created_at >= filters.created_from!);
    }
    if (filters.created_to) {
      results = results.filter(i => i.created_at <= filters.created_to!);
    }

    // Sort by created_at descending
    results.sort((a, b) => b.created_at - a.created_at);

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get open incidents
   */
  getOpen(limit: number = 100): Incident[] {
    return this.query({ status: 'open', limit });
  }

  /**
   * Get investigating incidents
   */
  getInvestigating(limit: number = 100): Incident[] {
    return this.query({ status: 'investigating', limit });
  }

  /**
   * Get incidents by correlation ID
   */
  getByCorrelation(correlation_id: string, limit: number = 100): Incident[] {
    return this.query({ correlation_id, limit });
  }

  /**
   * Get incidents by resource
   */
  getByResource(resource: string, limit: number = 100): Incident[] {
    return this.query({ resource, limit });
  }

  /**
   * Get incidents by alert name
   */
  getByAlert(alert_name: string, limit: number = 100): Incident[] {
    return this.query({ alert_name, limit });
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
    by_severity: Record<IncidentSeverity, number>;
    by_type: Record<string, number>;
  } {
    const all = Array.from(this.incidents.values());

    return {
      total: all.length,
      open: all.filter(i => i.status === 'open').length,
      investigating: all.filter(i => i.status === 'investigating').length,
      resolved: all.filter(i => i.status === 'resolved').length,
      closed: all.filter(i => i.status === 'closed').length,
      by_severity: {
        P0: all.filter(i => i.severity === 'P0').length,
        P1: all.filter(i => i.severity === 'P1').length,
        P2: all.filter(i => i.severity === 'P2').length,
        P3: all.filter(i => i.severity === 'P3').length,
      },
      by_type: all.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Clear all incidents (for testing)
   */
  clear(): void {
    this.incidents.clear();
    this.byCorrelation.clear();
    this.byResource.clear();
    this.byAlert.clear();
    this.byStatus.clear();
  }
}

// ==================== Singleton ====================

let _repository: IncidentRepository | null = null;

export function getIncidentRepository(): IncidentRepository {
  if (!_repository) {
    _repository = new IncidentRepository();
  }
  return _repository;
}

export function resetIncidentRepository(): void {
  _repository = null;
}
