"use strict";
/**
 * CircleCI Integration
 * Phase 2B-3B - CircleCI 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 CircleCI 相关组件
 * - 提供统一的初始化接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCircleCIIntegration = initializeCircleCIIntegration;
exports.createCircleCIWebhookHandler = createCircleCIWebhookHandler;
exports.createCircleCIActionHandler = createCircleCIActionHandler;
const circleci_connector_1 = require("./circleci_connector");
const circleci_event_adapter_1 = require("./circleci_event_adapter");
const circleci_operator_bridge_1 = require("./circleci_operator_bridge");
// ============================================================================
// 集成初始化
// ============================================================================
function initializeCircleCIIntegration(config) {
    // 1. 创建 Connector
    const connector = (0, circleci_connector_1.createCircleCIConnector)({
        apiToken: config.apiToken,
        webhookSecret: config.webhookSecret,
        baseUrl: config.baseUrl,
    });
    // 2. 创建事件适配器
    const eventAdapter = (0, circleci_event_adapter_1.createCircleCIEventAdapter)({
        autoCreateIncident: true,
        autoCreateApproval: true,
        autoCreateAttention: true,
        ignoreProjects: config.ignoreProjects,
        requireApprovalForWorkflows: config.requireApprovalForWorkflows,
    });
    // 3. 创建 Operator 桥接
    const operatorBridge = (0, circleci_operator_bridge_1.createCircleCIOperatorBridge)(eventAdapter, connector);
    return {
        connector,
        eventAdapter,
        operatorBridge,
    };
}
// ============================================================================
// Webhook 处理器包装器
// ============================================================================
function createCircleCIWebhookHandler(integration) {
    return async (payload) => {
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
            const errors = [];
            for (const event of events) {
                try {
                    const result = await integration.operatorBridge.handleCircleCIEvent(event);
                    if (result.incidentCreated)
                        incidentsCreated++;
                    if (result.approvalCreated)
                        approvalsCreated++;
                }
                catch (error) {
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
        }
        catch (error) {
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
function createCircleCIActionHandler(integration) {
    return {
        async handleApprove(sourceId, actorId) {
            if (!sourceId.startsWith('circleci_approval:')) {
                return {
                    success: false,
                    message: 'Not a CircleCI approval sourceId',
                };
            }
            return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
        },
        async handleReject(sourceId, actorId, reason) {
            if (!sourceId.startsWith('circleci_approval:')) {
                return {
                    success: false,
                    message: 'Not a CircleCI approval sourceId',
                };
            }
            return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
        },
        async handleRerun(sourceId) {
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
