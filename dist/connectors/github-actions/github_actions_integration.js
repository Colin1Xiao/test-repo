"use strict";
/**
 * GitHub Actions Integration
 * Phase 2B-2-I - GitHub Actions 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 GitHub Actions 相关组件
 * - 提供统一的初始化接口
 * - 导出集成的数据源和处理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubActionsOperatorBridge = exports.GitHubActionsEventHandler = exports.GitHubActionsIncidentDataSource = exports.GitHubActionsApprovalDataSource = void 0;
exports.initializeGitHubActionsIntegration = initializeGitHubActionsIntegration;
exports.createWebhookHandler = createWebhookHandler;
exports.createActionHandler = createActionHandler;
const github_actions_connector_1 = require("./github_actions_connector");
const workflow_event_adapter_1 = require("./workflow_event_adapter");
const deployment_approval_bridge_1 = require("./deployment_approval_bridge");
const github_actions_approval_data_source_1 = require("../../operator/data/github_actions_approval_data_source");
const github_actions_incident_data_source_1 = require("../../operator/data/github_actions_incident_data_source");
const github_actions_event_handler_1 = require("./github_actions_event_handler");
const github_actions_operator_bridge_1 = require("./github_actions_operator_bridge");
// ============================================================================
// 集成初始化
// ============================================================================
function initializeGitHubActionsIntegration(config = {}) {
    // 1. 创建数据源
    const approvalDataSource = (0, github_actions_approval_data_source_1.createGitHubActionsApprovalDataSource)({
        autoApproveEnvironments: config.autoApproveEnvironments,
    });
    const incidentDataSource = (0, github_actions_incident_data_source_1.createGitHubActionsIncidentDataSource)({
        ignoreWorkflows: config.ignoreWorkflows,
    });
    // 2. 创建事件适配器
    const workflowEventAdapter = (0, workflow_event_adapter_1.createWorkflowEventAdapter)({
        requireApprovalForEnvironments: config.requireApprovalForEnvironments,
        autoCreateIncident: true,
        autoCreateApproval: true,
        autoCreateAttention: true,
    });
    // 3. 创建 Connector
    const connector = (0, github_actions_connector_1.createGitHubActionsConnector)({
        apiToken: config.githubToken,
        webhookSecret: config.webhookSecret,
    });
    // 4. 创建审批桥接
    const deploymentApprovalBridge = (0, deployment_approval_bridge_1.createDeploymentApprovalBridge)(connector);
    // 5. 创建事件处理器
    const eventHandler = (0, github_actions_event_handler_1.createGitHubActionsEventHandler)(approvalDataSource, incidentDataSource, workflowEventAdapter, {
        verboseLogging: config.verboseLogging,
        autoCreateApproval: true,
        autoCreateIncident: true,
        autoCreateAttention: true,
    });
    // 6. 创建 Operator 桥接
    const operatorBridge = (0, github_actions_operator_bridge_1.createGitHubActionsOperatorBridge)(incidentDataSource, approvalDataSource, workflowEventAdapter, deploymentApprovalBridge);
    return {
        connector,
        approvalDataSource,
        incidentDataSource,
        eventHandler,
        deploymentApprovalBridge,
        operatorBridge,
    };
}
// ============================================================================
// Webhook 处理器包装器
// ============================================================================
/**
 * 创建 Webhook 处理器
 *
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const webhookHandler = createWebhookHandler(integration);
 *
 * // 在 HTTP 服务器中使用
 * app.post('/webhooks/github', async (req, res) => {
 *   const result = await webhookHandler(req.body, req.headers['x-hub-signature-256']);
 *   res.json(result);
 * });
 * ```
 */
function createWebhookHandler(integration) {
    return async (payload, signature) => {
        try {
            // 1. Connector 处理 Webhook，解析事件
            const events = await integration.connector.handleWebhook(payload, signature);
            if (events.length === 0) {
                return {
                    success: true,
                    eventsProcessed: 0,
                    approvalsCreated: 0,
                    incidentsCreated: 0,
                };
            }
            // 2. Event Handler 处理事件，写入数据源
            const handlerResult = await integration.eventHandler.handleEvents(events);
            return {
                success: handlerResult.errors.length === 0,
                eventsProcessed: handlerResult.totalEvents,
                approvalsCreated: handlerResult.approvalsCreated,
                incidentsCreated: handlerResult.incidentsCreated,
                errors: handlerResult.errors.length > 0 ? handlerResult.errors : undefined,
            };
        }
        catch (error) {
            return {
                success: false,
                eventsProcessed: 0,
                approvalsCreated: 0,
                incidentsCreated: 0,
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
/**
 * 创建动作处理器
 *
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const actionHandler = createActionHandler(integration);
 *
 * // 在 Operator Action Handler 中使用
 * operatorActionHandler.on('approve', async (sourceId, actorId) => {
 *   return await actionHandler.handleApprove(sourceId, actorId);
 * });
 *
 * operatorActionHandler.on('reject', async (sourceId, actorId, reason) => {
 *   return await actionHandler.handleReject(sourceId, actorId, reason);
 * });
 * ```
 */
function createActionHandler(integration) {
    return {
        /**
         * 处理 Approve 动作
         */
        async handleApprove(sourceId, actorId) {
            // 检查是否是 GitHub Actions 来源
            if (!sourceId.includes('/deployments/')) {
                return {
                    success: false,
                    message: 'Not a GitHub Actions deployment sourceId',
                };
            }
            // 调用 Operator Bridge
            return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
        },
        /**
         * 处理 Reject 动作
         */
        async handleReject(sourceId, actorId, reason) {
            // 检查是否是 GitHub Actions 来源
            if (!sourceId.includes('/deployments/')) {
                return {
                    success: false,
                    message: 'Not a GitHub Actions deployment sourceId',
                };
            }
            // 调用 Operator Bridge
            return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
        },
        /**
         * 获取审批状态
         */
        async getApprovalStatus(sourceId) {
            // 解析 approvalId
            const match = sourceId.match(/deployments\/(\d+)$/);
            if (!match) {
                return { status: null };
            }
            const deploymentId = parseInt(match[1], 10);
            const approvalId = `github_deployment_${deploymentId}`;
            const approval = await integration.approvalDataSource.getApprovalById(approvalId);
            return {
                status: approval?.status || null,
                approvalId,
            };
        },
    };
}
// ============================================================================
// 导出
// ============================================================================
var github_actions_integration_1 = require("./github_actions_integration");
Object.defineProperty(exports, "GitHubActionsApprovalDataSource", { enumerable: true, get: function () { return github_actions_integration_1.GitHubActionsApprovalDataSource; } });
Object.defineProperty(exports, "GitHubActionsIncidentDataSource", { enumerable: true, get: function () { return github_actions_integration_1.GitHubActionsIncidentDataSource; } });
Object.defineProperty(exports, "GitHubActionsEventHandler", { enumerable: true, get: function () { return github_actions_integration_1.GitHubActionsEventHandler; } });
Object.defineProperty(exports, "GitHubActionsOperatorBridge", { enumerable: true, get: function () { return github_actions_integration_1.GitHubActionsOperatorBridge; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViX2FjdGlvbnNfaW50ZWdyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9naXRodWItYWN0aW9ucy9naXRodWJfYWN0aW9uc19pbnRlZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQW9ESCxnRkEwREM7QUFxQkQsb0RBOENDO0FBd0JELGtEQWlFQztBQXhRRCx5RUFBc0c7QUFDdEcscUVBQTRGO0FBQzVGLDZFQUF3RztBQUN4RyxpSEFBaUo7QUFDakosaUhBQWlKO0FBQ2pKLGlGQUE0RztBQUM1RyxxRkFBa0g7QUF3Q2xILCtFQUErRTtBQUMvRSxRQUFRO0FBQ1IsK0VBQStFO0FBRS9FLFNBQWdCLGtDQUFrQyxDQUNoRCxTQUF5QyxFQUFFO0lBRTNDLFdBQVc7SUFDWCxNQUFNLGtCQUFrQixHQUFHLElBQUEsMkVBQXFDLEVBQUM7UUFDL0QsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLHVCQUF1QjtLQUN4RCxDQUFDLENBQUM7SUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUEsMkVBQXFDLEVBQUM7UUFDL0QsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlO0tBQ3hDLENBQUMsQ0FBQztJQUVILGFBQWE7SUFDYixNQUFNLG9CQUFvQixHQUFHLElBQUEsbURBQTBCLEVBQUM7UUFDdEQsOEJBQThCLEVBQUUsTUFBTSxDQUFDLDhCQUE4QjtRQUNyRSxrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsbUJBQW1CLEVBQUUsSUFBSTtLQUMxQixDQUFDLENBQUM7SUFFSCxrQkFBa0I7SUFDbEIsTUFBTSxTQUFTLEdBQUcsSUFBQSx1REFBNEIsRUFBQztRQUM3QyxRQUFRLEVBQUUsTUFBTSxDQUFDLFdBQVc7UUFDNUIsYUFBYSxFQUFFLE1BQU0sQ0FBQyxhQUFhO0tBQ3BDLENBQUMsQ0FBQztJQUVILFlBQVk7SUFDWixNQUFN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UUFBUSxFQUFFLE1BQU0sSUFBSSxJQUFJO2dCQUNoQyxVQUFVO2FBQ1gsQ0FBQztRQUNKLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELCtFQUErRTtBQUMvRSxLQUFLO0FBQ0wsK0VBQStFO0FBRS9FLDJFQUtzQztBQUpwQyw2SUFBQSwrQkFBK0IsT0FBQTtBQUMvQiw2SUFBQSwrQkFBK0IsT0FBQTtBQUMvQix1SUFBQSx5QkFBeUIsT0FBQTtBQUN6Qix5SUFBQSwyQkFBMkIsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogR2l0SHViIEFjdGlvbnMgSW50ZWdyYXRpb25cbiAqIFBoYXNlIDJCLTItSSAtIEdpdEh1YiBBY3Rpb25zIOS4jiBPcGVyYXRvciDkuLvpk77ot6/pm4bmiJBcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOe7hOijheaJgOaciSBHaXRIdWIgQWN0aW9ucyDnm7jlhbPnu4Tku7ZcbiAqIC0g5o+Q5L6b57uf5LiA55qE5Yid5aeL5YyW5o6l5Y+jXG4gKiAtIOWvvOWHuumbhuaIkOeahOaVsOaNrua6kOWSjOWkhOeQhuWZqFxuICovXG5cbmltcG9ydCB7IEdpdEh1YkFjdGlvbnNDb25uZWN0b3JJbXBsLCBjcmVhdGVHaXRIdWJBY3Rpb25zQ29ubmVjdG9yIH0gZnJvbSAnLi9naXRodWJfYWN0aW9uc19jb25uZWN0b3InO1xuaW1wb3J0IHsgV29ya2Zsb3dFdmVudEFkYXB0ZXIsIGNyZWF0ZVdvcmtmbG93RXZlbnRBZGFwdGVyIH0gZnJvbSAnLi93b3JrZmxvd19ldmVudF9hZGFwdGVyJztcbmltcG9ydCB7IERlcGxveW1lbnRBcHByb3ZhbEJyaWRnZSwgY3JlYXRlRGVwbG95bWVudEFwcHJvdmFsQnJpZGdlIH0gZnJvbSAnLi9kZXBsb3ltZW50X2FwcHJvdmFsX2JyaWRnZSc7XG5pbXBvcnQgeyBHaXRIdWJBY3Rpb25zQXBwcm92YWxEYXRhU291cmNlLCBjcmVhdGVHaXRIdWJBY3Rpb25zQXBwcm92YWxEYXRhU291cmNlIH0gZnJvbSAnLi4vLi4vb3BlcmF0b3IvZGF0YS9naXRodWJfYWN0aW9uc19hcHByb3ZhbF9kYXRhX3NvdXJjZSc7XG5pbXBvcnQgeyBHaXRIdWJBY3Rpb25zSW5jaWRlbnREYXRhU291cmNlLCBjcmVhdGVHaXRIdWJBY3Rpb25zSW5jaWRlbnREYXRhU291cmNlIH0gZnJvbSAnLi4vLi4vb3BlcmF0b3IvZGF0YS9naXRodWJfYWN0aW9uc19pbmNpZGVudF9kYXRhX3NvdXJjZSc7XG5pbXBvcnQgeyBHaXRIdWJBY3Rpb25zRXZlbnRIYW5kbGVyLCBjcmVhdGVHaXRIdWJBY3Rpb25zRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi9naXRodWJfYWN0aW9uc19ldmVudF9oYW5kbGVyJztcbmltcG9ydCB7IEdpdEh1YkFjdGlvbnNPcGVyYXRvckJyaWRnZSwgY3JlYXRlR2l0SHViQWN0aW9uc09wZXJhdG9yQnJpZGdlIH0gZnJvbSAnLi9naXRodWJfYWN0aW9uc19vcGVyYXRvcl9icmlkZ2UnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpm4bmiJDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBHaXRIdWJBY3Rpb25zSW50ZWdyYXRpb25Db25maWcge1xuICAvKiogR2l0SHViIEFQSSBUb2tlbiAqL1xuICBnaXRodWJUb2tlbj86IHN0cmluZztcbiAgLyoqIFdlYmhvb2sgU2VjcmV0ICovXG4gIHdlYmhvb2tTZWNyZXQ/OiBzdHJpbmc7XG4gIC8qKiDoh6rliqjmibnlh4bnmoTnjq/looPliJfooaggKi9cbiAgYXV0b0FwcHJvdmVFbnZpcm9ubWVudHM/OiBzdHJpbmdbXTtcbiAgLyoqIOW/veeVpeeahCBXb3JrZmxvdyDliJfooaggKi9cbiAgaWdub3JlV29ya2Zsb3dzPzogc3RyaW5nW107XG4gIC8qKiDpnIDopoHlrqHmibnnmoTnjq/looPliJfooaggKi9cbiAgcmVxdWlyZUFwcHJvdmFsRm9yRW52aXJvbm1lbnRzPzogc3RyaW5nW107XG4gIC8qKiDor6bnu4bml6Xlv5cgKi9cbiAgdmVyYm9zZUxvZ2dpbmc/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpm4bmiJDnu5Pmnpxcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBHaXRIdWJBY3Rpb25zSW50ZWdyYXRpb25SZXN1bHQge1xuICAvKiogR2l0SHViIEFjdGlvbnMgQ29ubmVjdG9yICovXG4gIGNvbm5lY3RvcjogR2l0SHViQWN0aW9uc0Nvbm5lY3RvckltcGw7XG4gIC8qKiDlrqHmibnmlbDmja7mupAgKi9cbiAgYXBwcm92YWxEYXRhU291cmNlOiBHaXRIdWJBY3Rpb25zQXBwcm92YWxEYXRhU291cmNlO1xuICAvKiog5LqL5Lu25pWw5o2u5rqQICovXG4gIGluY2lkZW50RGF0YVNvdXJjZTogR2l0SHViQWN0aW9uc0luY2lkZW50RGF0YVNvdXJjZTtcbiAgLyoqIOS6i+S7tuWkhOeQhuWZqCAqL1xuICBldmVudEhhbmRsZXI6IEdpdEh1YkFjdGlvbnNFdmVudEhhbmRsZXI7XG4gIC8qKiDlrqHmibnmoaXmjqUgKi9cbiAgZGVwbG95bWVudEFwcHJvdmFsQnJpZGdlOiBEZXBsb3ltZW50QXBwcm92YWxCcmlkZ2U7XG4gIC8qKiBPcGVyYXRvciDmoaXmjqUgKi9cbiAgb3BlcmF0b3JCcmlkZ2U6IEdpdEh1YkFjdGlvbnNPcGVyYXRvckJyaWRnZTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6ZuG5oiQ5Yid5aeL5YyWXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0aWFsaXplR2l0SHViQWN0aW9uc0ludGVncmF0aW9uKFxuICBjb25maWc6IEdpdEh1YkFjdGlvbnNJbnRlZ3JhdGlvbkNvbmZpZyA9IHt9XG4pOiBHaXRIdWJBY3Rpb25zSW50ZWdyYXRpb25SZXN1bHQge1xuICAvLyAxLiDliJvlu7rmlbDmja7mupBcbiAgY29uc3QgYXBwcm92YWxEYXRhU291cmNlID0gY3JlYXRlR2l0SHViQWN0aW9uc0FwcHJvdmFsRGF0YVNvdXJjZSh7XG4gICAgYXV0b0FwcHJvdmVFbnZpcm9ubWVudHM6IGNvbmZpZy5hdXRvQXBwcm92ZUVudmlyb25tZW50cyxcbiAgfSk7XG4gIFxuICBjb25zdCBpbmNpZGVudERhdGFTb3VyY2UgPSBjcmVhdGVHaXRIdWJBY3Rpb25zSW5jaWRlbnREYXRhU291cmNlKHtcbiAgICBpZ25vcmVXb3JrZmxvd3M6IGNvbmZpZy5pZ25vcmVXb3JrZmxvd3MsXG4gIH0pO1xuICBcbiAgLy8gMi4g5Yib5bu65LqL5Lu26YCC6YWN5ZmoXG4gIGNvbnN0IHdvcmtmbG93RXZlbnRBZGFwdGVyID0gY3JlYXRlV29ya2Zsb3dFdmVudEFkYXB0ZXIoe1xuICAgIHJlcXVpcmVBcHByb3ZhbEZvckVudmlyb25tZW50czogY29uZmlnLnJlcXVpcmVBcHByb3ZhbEZvckVudmlyb25tZW50cyxcbiAgICBhdXRvQ3JlYXRlSW5jaWRlbnQ6IHRydWUsXG4gICAgYXV0b0NyZWF0ZUFwcHJvdmFsOiB0cnVlLFxuICAgIGF1dG9DcmVhdGVBdHRlbnRpb246IHRydWUsXG4gIH0pO1xuICBcbiAgLy8gMy4g5Yib5bu6IENvbm5lY3RvclxuICBjb25zdCBjb25uZWN0b3IgPSBjcmVhdGVHaXRIdWJBY3Rpb25zQ29ubmVjdG9yKHtcbiAgICBhcGlUb2tlbjogY29uZmlnLmdpdGh1YlRva2VuLFxuICAgIHdlYmhvb2tTZWNyZXQ6IGNvbmZpZy53ZWJob29rU2VjcmV0LFxuICB9KTtcbiAgXG4gIC8vIDQuIOWIm+W7uuWuoeaJueahpeaOpVxuICBjb25zdCBkZXBsb3ltZW50QXBwcm92YWxCcmlkZ2UgPSBjcmVhdGVEZXBsb3ltZW50QXBwcm92YWxCcmlkZ2UoY29ubmVjdG9yKTtcbiAgXG4gIC8vIDUuIOWIm+W7uuS6i+S7tuWkhOeQhuWZqFxuICBjb25zdCBldmVudEhhbmRsZXIgPSBjcmVhdGVHaXRIdWJBY3Rpb25zRXZlbnRIYW5kbGVyKFxuICAgIGFwcHJvdmFsRGF0YVNvdXJjZSxcbiAgICBpbmNpZGVudERhdGFTb3VyY2UsXG4gICAgd29ya2Zsb3dFdmVudEFkYXB0ZXIsXG4gICAge1xuICAgICAgdmVyYm9zZUxvZ2dpbmc6IGNvbmZpZy52ZXJib3NlTG9nZ2luZyxcbiAgICAgIGF1dG9DcmVhdGVBcHByb3ZhbDogdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVJbmNpZGVudDogdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVBdHRlbnRpb246IHRydWUsXG4gICAgfVxuICApO1xuICBcbiAgLy8gNi4g5Yib5bu6IE9wZXJhdG9yIOahpeaOpVxuICBjb25zdCBvcGVyYXRvckJyaWRnZSA9IGNyZWF0ZUdpdEh1YkFjdGlvbnNPcGVyYXRvckJyaWRnZShcbiAgICBpbmNpZGVudERhdGFTb3VyY2UsXG4gICAgYXBwcm92YWxEYXRhU291cmNlLFxuICAgIHdvcmtmbG93RXZlbnRBZGFwdGVyLFxuICAgIGRlcGxveW1lbnRBcHByb3ZhbEJyaWRnZVxuICApO1xuICBcbiAgcmV0dXJuIHtcbiAgICBjb25uZWN0b3IsXG4gICAgYXBwcm92YWxEYXRhU291cmNlLFxuICAgIGluY2lkZW50RGF0YVNvdXJjZSxcbiAgICBldmVudEhhbmRsZXIsXG4gICAgZGVwbG95bWVudEFwcHJvdmFsQnJpZGdlLFxuICAgIG9wZXJhdG9yQnJpZGdlLFxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBXZWJob29rIOWkhOeQhuWZqOWMheijheWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uiBXZWJob29rIOWkhOeQhuWZqFxuICogXG4gKiDnlKjms5XvvJpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGludGVncmF0aW9uID0gaW5pdGlhbGl6ZUdpdEh1YkFjdGlvbnNJbnRlZ3JhdGlvbih7IGdpdGh1YlRva2VuOiAnLi4uJyB9KTtcbiAqIGNvbnN0IHdlYmhvb2tIYW5kbGVyID0gY3JlYXRlV2ViaG9va0hhbmRsZXIoaW50ZWdyYXRpb24pO1xuICogXG4gKiAvLyDlnKggSFRUUCDmnI3liqHlmajkuK3kvb/nlKhcbiAqIGFwcC5wb3N0KCcvd2ViaG9va3MvZ2l0aHViJywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gKiAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdlYmhvb2tIYW5kbGVyKHJlcS5ib2R5LCByZXEuaGVhZGVyc1sneC1odWItc2lnbmF0dXJlLTI1NiddKTtcbiAqICAgcmVzLmpzb24ocmVzdWx0KTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXZWJob29rSGFuZGxlcihpbnRlZ3JhdGlvbjogR2l0SHViQWN0aW9uc0ludGVncmF0aW9uUmVzdWx0KSB7XG4gIHJldHVybiBhc3luYyAocGF5bG9hZDogYW55LCBzaWduYXR1cmU/OiBzdHJpbmcpOiBQcm9taXNlPHtcbiAgICBzdWNjZXNzOiBib29sZWFuO1xuICAgIGV2ZW50c1Byb2Nlc3NlZDogbnVtYmVyO1xuICAgIGFwcHJvdmFsc0NyZWF0ZWQ6IG51bWJlcjtcbiAgICBpbmNpZGVudHNDcmVhdGVkOiBudW1iZXI7XG4gICAgZXJyb3JzPzogQXJyYXk8eyBldmVudElkOiBzdHJpbmc7IGVycm9yOiBzdHJpbmcgfT47XG4gIH0+ID0+IHtcbiAgICB0cnkge1xuICAgICAgLy8gMS4gQ29ubmVjdG9yIOWkhOeQhiBXZWJob29r77yM6Kej5p6Q5LqL5Lu2XG4gICAgICBjb25zdCBldmVudHMgPSBhd2FpdCBpbnRlZ3JhdGlvbi5jb25uZWN0b3IuaGFuZGxlV2ViaG9vayhwYXlsb2FkLCBzaWduYXR1cmUpO1xuICAgICAgXG4gICAgICBpZiAoZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgZXZlbnRzUHJvY2Vzc2VkOiAwLFxuICAgICAgICAgIGFwcHJvdmFsc0NyZWF0ZWQ6IDAsXG4gICAgICAgICAgaW5jaWRlbnRzQ3JlYXRlZDogMCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gMi4gRXZlbnQgSGFuZGxlciDlpITnkIbkuovku7bvvIzlhpnlhaXmlbDmja7mupBcbiAgICAgIGNvbnN0IGhhbmRsZXJSZXN1bHQgPSBhd2FpdCBpbnRlZ3JhdGlvbi5ldmVudEhhbmRsZXIuaGFuZGxlRXZlbnRzKGV2ZW50cyk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGhhbmRsZXJSZXN1bHQuZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgZXZlbnRzUHJvY2Vzc2VkOiBoYW5kbGVyUmVzdWx0LnRvdGFsRXZlbnRzLFxuICAgICAgICBhcHByb3ZhbHNDcmVhdGVkOiBoYW5kbGVyUmVzdWx0LmFwcHJvdmFsc0NyZWF0ZWQsXG4gICAgICAgIGluY2lkZW50c0NyZWF0ZWQ6IGhhbmRsZXJSZXN1bHQuaW5jaWRlbnRzQ3JlYXRlZCxcbiAgICAgICAgZXJyb3JzOiBoYW5kbGVyUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwID8gaGFuZGxlclJlc3VsdC5lcnJvcnMgOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXZlbnRzUHJvY2Vzc2VkOiAwLFxuICAgICAgICBhcHByb3ZhbHNDcmVhdGVkOiAwLFxuICAgICAgICBpbmNpZGVudHNDcmVhdGVkOiAwLFxuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBldmVudElkOiAnd2ViaG9va19oYW5kbGVyJyxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfVxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDliqjkvZzlpITnkIblmajljIXoo4Xlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rliqjkvZzlpITnkIblmahcbiAqIFxuICog55So5rOV77yaXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBpbnRlZ3JhdGlvbiA9IGluaXRpYWxpemVHaXRIdWJBY3Rpb25zSW50ZWdyYXRpb24oeyBnaXRodWJUb2tlbjogJy4uLicgfSk7XG4gKiBjb25zdCBhY3Rpb25IYW5kbGVyID0gY3JlYXRlQWN0aW9uSGFuZGxlcihpbnRlZ3JhdGlvbik7XG4gKiBcbiAqIC8vIOWcqCBPcGVyYXRvciBBY3Rpb24gSGFuZGxlciDkuK3kvb/nlKhcbiAqIG9wZXJhdG9yQWN0aW9uSGFuZGxlci5vbignYXBwcm92ZScsIGFzeW5jIChzb3VyY2VJZCwgYWN0b3JJZCkgPT4ge1xuICogICByZXR1cm4gYXdhaXQgYWN0aW9uSGFuZGxlci5oYW5kbGVBcHByb3ZlKHNvdXJjZUlkLCBhY3RvcklkKTtcbiAqIH0pO1xuICogXG4gKiBvcGVyYXRvckFjdGlvbkhhbmRsZXIub24oJ3JlamVjdCcsIGFzeW5jIChzb3VyY2VJZCwgYWN0b3JJZCwgcmVhc29uKSA9PiB7XG4gKiAgIHJldHVybiBhd2FpdCBhY3Rpb25IYW5kbGVyLmhhbmRsZVJlamVjdChzb3VyY2VJZCwgYWN0b3JJZCwgcmVhc29uKTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBY3Rpb25IYW5kbGVyKGludGVncmF0aW9uOiBHaXRIdWJBY3Rpb25zSW50ZWdyYXRpb25SZXN1bHQpIHtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiDlpITnkIYgQXBwcm92ZSDliqjkvZxcbiAgICAgKi9cbiAgICBhc3luYyBoYW5kbGVBcHByb3ZlKFxuICAgICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICAgIGFjdG9ySWQ/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgIC8vIOajgOafpeaYr+WQpuaYryBHaXRIdWIgQWN0aW9ucyDmnaXmupBcbiAgICAgIGlmICghc291cmNlSWQuaW5jbHVkZXMoJy9kZXBsb3ltZW50cy8nKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdOb3QgYSBHaXRIdWIgQWN0aW9ucyBkZXBsb3ltZW50IHNvdXJjZUlkJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g6LCD55SoIE9wZXJhdG9yIEJyaWRnZVxuICAgICAgcmV0dXJuIGF3YWl0IGludGVncmF0aW9uLm9wZXJhdG9yQnJpZGdlLmhhbmRsZUFwcHJvdmVBY3Rpb24oc291cmNlSWQsIGFjdG9ySWQpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICog5aSE55CGIFJlamVjdCDliqjkvZxcbiAgICAgKi9cbiAgICBhc3luYyBoYW5kbGVSZWplY3QoXG4gICAgICBzb3VyY2VJZDogc3RyaW5nLFxuICAgICAgYWN0b3JJZD86IHN0cmluZyxcbiAgICAgIHJlYXNvbj86IHN0cmluZ1xuICAgICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgICAgLy8g5qOA5p+l5piv5ZCm5pivIEdpdEh1YiBBY3Rpb25zIOadpea6kFxuICAgICAgaWYgKCFzb3VyY2VJZC5pbmNsdWRlcygnL2RlcGxveW1lbnRzLycpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogJ05vdCBhIEdpdEh1YiBBY3Rpb25zIGRlcGxveW1lbnQgc291cmNlSWQnLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDosIPnlKggT3BlcmF0b3IgQnJpZGdlXG4gICAgICByZXR1cm4gYXdhaXQgaW50ZWdyYXRpb24ub3BlcmF0b3JCcmlkZ2UuaGFuZGxlUmVqZWN0QWN0aW9uKHNvdXJjZUlkLCBhY3RvcklkLCByZWFzb24pO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICog6I635Y+W5a6h5om554q25oCBXG4gICAgICovXG4gICAgYXN5bmMgZ2V0QXBwcm92YWxTdGF0dXMoc291cmNlSWQ6IHN0cmluZyk6IFByb21pc2U8e1xuICAgICAgc3RhdHVzOiAncGVuZGluZycgfCAnYXBwcm92ZWQnIHwgJ3JlamVjdGVkJyB8ICdjYW5jZWxsZWQnIHwgbnVsbDtcbiAgICAgIGFwcHJvdmFsSWQ/OiBzdHJpbmc7XG4gICAgfT4ge1xuICAgICAgLy8g6Kej5p6QIGFwcHJvdmFsSWRcbiAgICAgIGNvbnN0IG1hdGNoID0gc291cmNlSWQubWF0Y2goL2RlcGxveW1lbnRzXFwvKFxcZCspJC8pO1xuICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICByZXR1cm4geyBzdGF0dXM6IG51bGwgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgZGVwbG95bWVudElkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgIGNvbnN0IGFwcHJvdmFsSWQgPSBgZ2l0aHViX2RlcGxveW1lbnRfJHtkZXBsb3ltZW50SWR9YDtcbiAgICAgIFxuICAgICAgY29uc3QgYXBwcm92YWwgPSBhd2FpdCBpbnRlZ3JhdGlvbi5hcHByb3ZhbERhdGFTb3VyY2UuZ2V0QXBwcm92YWxCeUlkKGFwcHJvdmFsSWQpO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IGFwcHJvdmFsPy5zdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgYXBwcm92YWxJZCxcbiAgICAgIH07XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5a+85Ye6XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB7XG4gIEdpdEh1YkFjdGlvbnNBcHByb3ZhbERhdGFTb3VyY2UsXG4gIEdpdEh1YkFjdGlvbnNJbmNpZGVudERhdGFTb3VyY2UsXG4gIEdpdEh1YkFjdGlvbnNFdmVudEhhbmRsZXIsXG4gIEdpdEh1YkFjdGlvbnNPcGVyYXRvckJyaWRnZSxcbn0gZnJvbSAnLi9naXRodWJfYWN0aW9uc19pbnRlZ3JhdGlvbic7XG4iXX0=