/**
 * Jenkins Integration
 * Phase 2B-3A - Jenkins 与 Operator 主链路集成
 * 
 * 职责：
 * - 组装所有 Jenkins 相关组件
 * - 提供统一的初始化接口
 */

import { createJenkinsConnector } from './jenkins_connector';
import { createJenkinsEventAdapter } from './jenkins_event_adapter';
import { createJenkinsOperatorBridge } from './jenkins_operator_bridge';
import { createJenkinsBuildApprovalBridge } from './jenkins_build_approval_bridge';
import type { JenkinsConnector } from './jenkins_connector';
import type { JenkinsEventAdapter } from './jenkins_event_adapter';
import type { JenkinsOperatorBridge } from './jenkins_operator_bridge';
import type { JenkinsBuildApprovalBridge } from './jenkins_build_approval_bridge';

// ============================================================================
// 集成配置
// ============================================================================

export interface JenkinsIntegrationConfig {
  jenkinsBaseUrl: string;
  jenkinsUsername?: string;
  jenkinsToken?: string;
  webhookSecret?: string;
  autoApproveJobs?: string[];
  ignoreJobs?: string[];
  requireApprovalForJobs?: string[];
  verboseLogging?: boolean;
}

// ============================================================================
// 集成结果
// ============================================================================

export interface JenkinsIntegrationResult {
  connector: JenkinsConnector;
  eventAdapter: JenkinsEventAdapter;
  operatorBridge: JenkinsOperatorBridge;
  approvalBridge: JenkinsBuildApprovalBridge;
}

// ============================================================================
// 集成初始化
// ============================================================================

export function initializeJenkinsIntegration(
  config: JenkinsIntegrationConfig
): JenkinsIntegrationResult {
  // 1. 创建 Connector
  const connector = createJenkinsConnector({
    baseUrl: config.jenkinsBaseUrl,
    username: config.jenkinsUsername,
    token: config.jenkinsToken,
    webhookSecret: config.webhookSecret,
  });

  // 2. 创建事件适配器
  const eventAdapter = createJenkinsEventAdapter({
    autoCreateIncident: true,
    autoCreateApproval: true,
    autoCreateAttention: true,
    ignoreJobs: config.ignoreJobs,
    requireApprovalForJobs: config.requireApprovalForJobs,
  });

  // 3. 创建审批桥接
  const approvalBridge = createJenkinsBuildApprovalBridge(connector, {
    autoApproveJobs: config.autoApproveJobs,
  });

  // 4. 创建 Operator 桥接 (需要数据源，暂时占位)
  // @ts-ignore - 简化实现
  const operatorBridge = createJenkinsOperatorBridge(
    null, // incidentDataSource
    null, // approvalDataSource
    eventAdapter,
    connector
  );

  return {
    connector,
    eventAdapter,
    operatorBridge,
    approvalBridge,
  };
}

// ============================================================================
// Webhook 处理器包装器
// ============================================================================

export function createJenkinsWebhookHandler(
  integration: JenkinsIntegrationResult
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
          const result = await integration.operatorBridge.handleJenkinsEvent(event);

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

export function createJenkinsActionHandler(
  integration: JenkinsIntegrationResult
) {
  return {
    async handleApprove(
      sourceId: string,
      actorId?: string
    ): Promise<{ success: boolean; message: string }> {
      // 检查格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
      if (!sourceId.startsWith('jenkins_input:')) {
        return {
          success: false,
          message: 'Not a Jenkins input sourceId',
        };
      }

      return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
    },

    async handleReject(
      sourceId: string,
      actorId?: string,
      reason?: string
    ): Promise<{ success: boolean; message: string }> {
      // 检查格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
      if (!sourceId.startsWith('jenkins_input:')) {
        return {
          success: false,
          message: 'Not a Jenkins input sourceId',
        };
      }

      return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
    },

    async handleRerun(sourceId: string): Promise<{ success: boolean; message: string }> {
      // 检查格式：jenkins_build:<jobName>:<buildNumber>
      if (!sourceId.startsWith('jenkins_build:')) {
        return {
          success: false,
          message: 'Not a Jenkins build sourceId',
        };
      }

      return await integration.operatorBridge.handleRerunAction(sourceId);
    },
  };
}
