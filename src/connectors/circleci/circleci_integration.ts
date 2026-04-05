/**
 * CircleCI Integration
 * Phase 2B-3B - CircleCI 与 Operator 主链路集成
 * 
 * 职责：
 * - 组装所有 CircleCI 相关组件
 * - 提供统一的初始化接口
 */

import { createCircleCIConnector } from './circleci_connector';
import { createCircleCIEventAdapter } from './circleci_event_adapter';
import { createCircleCIOperatorBridge } from './circleci_operator_bridge';
import type { CircleCIConnector } from './circleci_connector';
import type { CircleCIEventAdapter } from './circleci_event_adapter';
import type { CircleCIOperatorBridge } from './circleci_operator_bridge';

// ============================================================================
// 集成配置
// ============================================================================

export interface CircleCIIntegrationConfig {
  apiToken: string;
  webhookSecret?: string;
  baseUrl?: string;
  ignoreProjects?: string[];
  requireApprovalForWorkflows?: string[];
  verboseLogging?: boolean;
}

// ============================================================================
// 集成结果
// ============================================================================

export interface CircleCIIntegrationResult {
  connector: CircleCIConnector;
  eventAdapter: CircleCIEventAdapter;
  operatorBridge: CircleCIOperatorBridge;
}

// ============================================================================
// 集成初始化
// ============================================================================

export function initializeCircleCIIntegration(
  config: CircleCIIntegrationConfig
): CircleCIIntegrationResult {
  // 1. 创建 Connector
  const connector = createCircleCIConnector({
    apiToken: config.apiToken,
    webhookSecret: config.webhookSecret,
    baseUrl: config.baseUrl,
  });

  // 2. 创建事件适配器
  const eventAdapter = createCircleCIEventAdapter({
    autoCreateIncident: true,
    autoCreateApproval: true,
    autoCreateAttention: true,
    ignoreProjects: config.ignoreProjects,
    requireApprovalForWorkflows: config.requireApprovalForWorkflows,
  });

  // 3. 创建 Operator 桥接
  const operatorBridge = createCircleCIOperatorBridge(
    eventAdapter,
    connector
  );

  return {
    connector,
    eventAdapter,
    operatorBridge,
  };
}

// ============================================================================
// Webhook 处理器包装器
// ============================================================================

export function createCircleCIWebhookHandler(
  integration: CircleCIIntegrationResult
) {
  return async (payload: any): Promise<{
    success: boolean;
    eventsProcessed: number;
    incidentsCreated: number;
    approvalsCreated: number;
    errors?: Array<{ eventId: string; error: string }>;
  }> => {
    try {
      // 1. Connector 处理 Webhook，解析事件
      const events = await integration.connector.handleWebhook(payload);

      if (events.length === 0) {
        return {
          success: true,
          eventsProcessed: 0,
          incidentsCreated: 0,
          approvalsCreated: 0,
        };
      }

      // 2. 处理每个事件
      let incidentsCreated = 0;
      let approvalsCreated = 0;
      const errors: Array<{ eventId: string; error: string }> = [];

      for (const event of events) {
        try {
          const result = await integration.operatorBridge.handleCircleCIEvent(event);

          if (result.incidentCreated) incidentsCreated++;
          if (result.approvalCreated) approvalsCreated++;
        } catch (error) {
          errors.push({
            eventId: `${event.type}_${Date.now()}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        success: errors.length === 0,
        eventsProcessed: events.length,
        incidentsCreated,
        approvalsCreated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        eventsProcessed: 0,
        incidentsCreated: 0,
        approvalsCreated: 0,
        errors: [
          {
            eventId: 'webhook_handler',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  };
}

// ============================================================================
// 动作处理器包装器
// ============================================================================

export function createCircleCIActionHandler(
  integration: CircleCIIntegrationResult
) {
  return {
    async handleApprove(
      sourceId: string,
      actorId?: string
    ): Promise<{ success: boolean; message: string }> {
      if (!sourceId.startsWith('circleci_approval:')) {
        return {
          success: false,
          message: 'Not a CircleCI approval sourceId',
        };
      }

      return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
    },

    async handleReject(
      sourceId: string,
      actorId?: string,
      reason?: string
    ): Promise<{ success: boolean; message: string }> {
      if (!sourceId.startsWith('circleci_approval:')) {
        return {
          success: false,
          message: 'Not a CircleCI approval sourceId',
        };
      }

      return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
    },

    async handleRerun(sourceId: string): Promise<{ success: boolean; message: string }> {
      if (!sourceId.startsWith('circleci_workflow:')) {
        return {
          success: false,
          message: 'Not a CircleCI workflow sourceId',
        };
      }

      return await integration.operatorBridge.handleRerunAction(sourceId);
    },
  };
}
