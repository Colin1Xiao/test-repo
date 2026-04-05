"use strict";
/**
 * Jenkins Integration
 * Phase 2B-3A - Jenkins 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 Jenkins 相关组件
 * - 提供统一的初始化接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeJenkinsIntegration = initializeJenkinsIntegration;
exports.createJenkinsWebhookHandler = createJenkinsWebhookHandler;
exports.createJenkinsActionHandler = createJenkinsActionHandler;
const jenkins_connector_1 = require("./jenkins_connector");
const jenkins_event_adapter_1 = require("./jenkins_event_adapter");
const jenkins_operator_bridge_1 = require("./jenkins_operator_bridge");
const jenkins_build_approval_bridge_1 = require("./jenkins_build_approval_bridge");
// ============================================================================
// 集成初始化
// ============================================================================
function initializeJenkinsIntegration(config) {
    // 1. 创建 Connector
    const connector = (0, jenkins_connector_1.createJenkinsConnector)({
        baseUrl: config.jenkinsBaseUrl,
        username: config.jenkinsUsername,
        token: config.jenkinsToken,
        webhookSecret: config.webhookSecret,
    });
    // 2. 创建事件适配器
    const eventAdapter = (0, jenkins_event_adapter_1.createJenkinsEventAdapter)({
        autoCreateIncident: true,
        autoCreateApproval: true,
        autoCreateAttention: true,
        ignoreJobs: config.ignoreJobs,
        requireApprovalForJobs: config.requireApprovalForJobs,
    });
    // 3. 创建审批桥接
    const approvalBridge = (0, jenkins_build_approval_bridge_1.createJenkinsBuildApprovalBridge)(connector, {
        autoApproveJobs: config.autoApproveJobs,
    });
    // 4. 创建 Operator 桥接 (需要数据源，暂时占位)
    // @ts-ignore - 简化实现
    const operatorBridge = (0, jenkins_operator_bridge_1.createJenkinsOperatorBridge)(null, // incidentDataSource
    null, // approvalDataSource
    eventAdapter, connector);
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
function createJenkinsWebhookHandler(integration) {
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
                    const result = await integration.operatorBridge.handleJenkinsEvent(event);
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
function createJenkinsActionHandler(integration) {
    return {
        async handleApprove(sourceId, actorId) {
            // 检查格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
            if (!sourceId.startsWith('jenkins_input:')) {
                return {
                    success: false,
                    message: 'Not a Jenkins input sourceId',
                };
            }
            return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
        },
        async handleReject(sourceId, actorId, reason) {
            // 检查格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
            if (!sourceId.startsWith('jenkins_input:')) {
                return {
                    success: false,
                    message: 'Not a Jenkins input sourceId',
                };
            }
            return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
        },
        async handleRerun(sourceId) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVua2luc19pbnRlZ3JhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25uZWN0b3JzL2plbmtpbnMvamVua2luc19pbnRlZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRzs7QUF5Q0gsb0VBd0NDO0FBTUQsa0VBZ0VDO0FBTUQsZ0VBK0NDO0FBMU1ELDJEQUE2RDtBQUM3RCxtRUFBb0U7QUFDcEUsdUVBQXdFO0FBQ3hFLG1GQUFtRjtBQWdDbkYsK0VBQStFO0FBQy9FLFFBQVE7QUFDUiwrRUFBK0U7QUFFL0UsU0FBZ0IsNEJBQTRCLENBQzFDLE1BQWdDO0lBRWhDLGtCQUFrQjtJQUNsQixNQUFNLFNBQVMsR0FBRyxJQUFBLDBDQUFzQixFQUFDO1FBQ3ZDLE9BQU8sRUFBRSxNQUFNLENBQUMsY0FBYztRQUM5QixRQUFRLEVBQUUsTUFBTSxDQUFDLGVBQWU7UUFDaEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxZQUFZO1FBQzFCLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYTtLQUNwQyxDQUFDLENBQUM7SUFFSCxhQUFhO0lBQ2IsTUFBTSxZQUFZLEdBQUcsSUFBQSxpREFBeUIsRUFBQztRQUM3QyxrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7UUFDN0Isc0JBQXNCLEVBQUUsTUFBTSxDQUFDLHNCQUFzQjtLQUN0RCxDQUFDLENBQUM7SUFFSCxZQUFZO0lBQ1osTUFBTSxjQUFjLEdBQUcsSUFBQSxnRUFBZ0MsRUFBQyxTQUFTLEVBQUU7UUFDakUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlO0tBQ3hDLENBQUMsQ0FBQztJQUVILGlDQUFpQztJQUNqQyxvQkFBb0I7SUFDcEIsTUFBTSxjQUFjLEdBQUcsSUFBQSxxREFBMkIsRUFDaEQsSUFBSSxFQUFFLHFCQUFx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QUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztnQkFDM0MsT0FBTztvQkFDTCxPQUFPLEVBQUUsS0FBSztvQkFDZCxPQUFPLEVBQUUsOEJBQThCO2lCQUN4QyxDQUFDO1lBQ0osQ0FBQztZQUVELE9BQU8sTUFBTSxXQUFXLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRixDQUFDO1FBRUQsS0FBSyxDQUFDLFlBQVksQ0FDaEIsUUFBZ0IsRUFDaEIsT0FBZ0IsRUFDaEIsTUFBZTtZQUVmLHVEQUF1RDtZQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLE9BQU87b0JBQ0wsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsT0FBTyxFQUFFLDhCQUE4QjtpQkFDeEMsQ0FBQztZQUNKLENBQUM7WUFFRCxPQUFPLE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3hGLENBQUM7UUFFRCxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQWdCO1lBQ2hDLDZDQUE2QztZQUM3QyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLE9BQU87b0JBQ0wsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsT0FBTyxFQUFFLDhCQUE4QjtpQkFDeEMsQ0FBQztZQUNKLENBQUM7WUFFRCxPQUFPLE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RSxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEplbmtpbnMgSW50ZWdyYXRpb25cbiAqIFBoYXNlIDJCLTNBIC0gSmVua2lucyDkuI4gT3BlcmF0b3Ig5Li76ZO+6Lev6ZuG5oiQXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDnu4Too4XmiYDmnIkgSmVua2lucyDnm7jlhbPnu4Tku7ZcbiAqIC0g5o+Q5L6b57uf5LiA55qE5Yid5aeL5YyW5o6l5Y+jXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlSmVua2luc0Nvbm5lY3RvciB9IGZyb20gJy4vamVua2luc19jb25uZWN0b3InO1xuaW1wb3J0IHsgY3JlYXRlSmVua2luc0V2ZW50QWRhcHRlciB9IGZyb20gJy4vamVua2luc19ldmVudF9hZGFwdGVyJztcbmltcG9ydCB7IGNyZWF0ZUplbmtpbnNPcGVyYXRvckJyaWRnZSB9IGZyb20gJy4vamVua2luc19vcGVyYXRvcl9icmlkZ2UnO1xuaW1wb3J0IHsgY3JlYXRlSmVua2luc0J1aWxkQXBwcm92YWxCcmlkZ2UgfSBmcm9tICcuL2plbmtpbnNfYnVpbGRfYXBwcm92YWxfYnJpZGdlJztcbmltcG9ydCB0eXBlIHsgSmVua2luc0Nvbm5lY3RvciB9IGZyb20gJy4vamVua2luc19jb25uZWN0b3InO1xuaW1wb3J0IHR5cGUgeyBKZW5raW5zRXZlbnRBZGFwdGVyIH0gZnJvbSAnLi9qZW5raW5zX2V2ZW50X2FkYXB0ZXInO1xuaW1wb3J0IHR5cGUgeyBKZW5raW5zT3BlcmF0b3JCcmlkZ2UgfSBmcm9tICcuL2plbmtpbnNfb3BlcmF0b3JfYnJpZGdlJztcbmltcG9ydCB0eXBlIHsgSmVua2luc0J1aWxkQXBwcm92YWxCcmlkZ2UgfSBmcm9tICcuL2plbmtpbnNfYnVpbGRfYXBwcm92YWxfYnJpZGdlJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6ZuG5oiQ6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgSmVua2luc0ludGVncmF0aW9uQ29uZmlnIHtcbiAgamVua2luc0Jhc2VVcmw6IHN0cmluZztcbiAgamVua2luc1VzZXJuYW1lPzogc3RyaW5nO1xuICBqZW5raW5zVG9rZW4/OiBzdHJpbmc7XG4gIHdlYmhvb2tTZWNyZXQ/OiBzdHJpbmc7XG4gIGF1dG9BcHByb3ZlSm9icz86IHN0cmluZ1tdO1xuICBpZ25vcmVKb2JzPzogc3RyaW5nW107XG4gIHJlcXVpcmVBcHByb3ZhbEZvckpvYnM/OiBzdHJpbmdbXTtcbiAgdmVyYm9zZUxvZ2dpbmc/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpm4bmiJDnu5Pmnpxcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBKZW5raW5zSW50ZWdyYXRpb25SZXN1bHQge1xuICBjb25uZWN0b3I6IEplbmtpbnNDb25uZWN0b3I7XG4gIGV2ZW50QWRhcHRlcjogSmVua2luc0V2ZW50QWRhcHRlcjtcbiAgb3BlcmF0b3JCcmlkZ2U6IEplbmtpbnNPcGVyYXRvckJyaWRnZTtcbiAgYXBwcm92YWxCcmlkZ2U6IEplbmtpbnNCdWlsZEFwcHJvdmFsQnJpZGdlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpm4bmiJDliJ3lp4vljJZcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVKZW5raW5zSW50ZWdyYXRpb24oXG4gIGNvbmZpZzogSmVua2luc0ludGVncmF0aW9uQ29uZmlnXG4pOiBKZW5raW5zSW50ZWdyYXRpb25SZXN1bHQge1xuICAvLyAxLiDliJvlu7ogQ29ubmVjdG9yXG4gIGNvbnN0IGNvbm5lY3RvciA9IGNyZWF0ZUplbmtpbnNDb25uZWN0b3Ioe1xuICAgIGJhc2VVcmw6IGNvbmZpZy5qZW5raW5zQmFzZVVybCxcbiAgICB1c2VybmFtZTogY29uZmlnLmplbmtpbnNVc2VybmFtZSxcbiAgICB0b2tlbjogY29uZmlnLmplbmtpbnNUb2tlbixcbiAgICB3ZWJob29rU2VjcmV0OiBjb25maWcud2ViaG9va1NlY3JldCxcbiAgfSk7XG5cbiAgLy8gMi4g5Yib5bu65LqL5Lu26YCC6YWN5ZmoXG4gIGNvbnN0IGV2ZW50QWRhcHRlciA9IGNyZWF0ZUplbmtpbnNFdmVudEFkYXB0ZXIoe1xuICAgIGF1dG9DcmVhdGVJbmNpZGVudDogdHJ1ZSxcbiAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IHRydWUsXG4gICAgYXV0b0NyZWF0ZUF0dGVudGlvbjogdHJ1ZSxcbiAgICBpZ25vcmVKb2JzOiBjb25maWcuaWdub3JlSm9icyxcbiAgICByZXF1aXJlQXBwcm92YWxGb3JKb2JzOiBjb25maWcucmVxdWlyZUFwcHJvdmFsRm9ySm9icyxcbiAgfSk7XG5cbiAgLy8gMy4g5Yib5bu65a6h5om55qGl5o6lXG4gIGNvbnN0IGFwcHJvdmFsQnJpZGdlID0gY3JlYXRlSmVua2luc0J1aWxkQXBwcm92YWxCcmlkZ2UoY29ubmVjdG9yLCB7XG4gICAgYXV0b0FwcHJvdmVKb2JzOiBjb25maWcuYXV0b0FwcHJvdmVKb2JzLFxuICB9KTtcblxuICAvLyA0LiDliJvlu7ogT3BlcmF0b3Ig5qGl5o6lICjpnIDopoHmlbDmja7mupDvvIzmmoLml7bljaDkvY0pXG4gIC8vIEB0cy1pZ25vcmUgLSDnroDljJblrp7njrBcbiAgY29uc3Qgb3BlcmF0b3JCcmlkZ2UgPSBjcmVhdGVKZW5raW5zT3BlcmF0b3JCcmlkZ2UoXG4gICAgbnVsbCwgLy8gaW5jaWRlbnREYXRhU291cmNlXG4gICAgbnVsbCwgLy8gYXBwcm92YWxEYXRhU291cmNlXG4gICAgZXZlbnRBZGFwdGVyLFxuICAgIGNvbm5lY3RvclxuICApO1xuXG4gIHJldHVybiB7XG4gICAgY29ubmVjdG9yLFxuICAgIGV2ZW50QWRhcHRlcixcbiAgICBvcGVyYXRvckJyaWRnZSxcbiAgICBhcHByb3ZhbEJyaWRnZSxcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gV2ViaG9vayDlpITnkIblmajljIXoo4Xlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUplbmtpbnNXZWJob29rSGFuZGxlcihcbiAgaW50ZWdyYXRpb246IEplbmtpbnNJbnRlZ3JhdGlvblJlc3VsdFxuKSB7XG4gIHJldHVybiBhc3luYyAocGF5bG9hZDogYW55KTogUHJvbWlzZTx7XG4gICAgc3VjY2VzczogYm9vbGVhbjtcbiAgICBldmVudHNQcm9jZXNzZWQ6IG51bWJlcjtcbiAgICBpbmNpZGVudHNDcmVhdGVkOiBudW1iZXI7XG4gICAgYXBwcm92YWxzQ3JlYXRlZDogbnVtYmVyO1xuICAgIGVycm9ycz86IEFycmF5PHsgZXZlbnRJZDogc3RyaW5nOyBlcnJvcjogc3RyaW5nIH0+O1xuICB9PiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIDEuIENvbm5lY3RvciDlpITnkIYgV2ViaG9va++8jOino+aekOS6i+S7tlxuICAgICAgY29uc3QgZXZlbnRzID0gYXdhaXQgaW50ZWdyYXRpb24uY29ubmVjdG9yLmhhbmRsZVdlYmhvb2socGF5bG9hZCk7XG5cbiAgICAgIGlmIChldmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBldmVudHNQcm9jZXNzZWQ6IDAsXG4gICAgICAgICAgaW5jaWRlbnRzQ3JlYXRlZDogMCxcbiAgICAgICAgICBhcHByb3ZhbHNDcmVhdGVkOiAwLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICAvLyAyLiDlpITnkIbmr4/kuKrkuovku7ZcbiAgICAgIGxldCBpbmNpZGVudHNDcmVhdGVkID0gMDtcbiAgICAgIGxldCBhcHByb3ZhbHNDcmVhdGVkID0gMDtcbiAgICAgIGNvbnN0IGVycm9yczogQXJyYXk8eyBldmVudElkOiBzdHJpbmc7IGVycm9yOiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnRlZ3JhdGlvbi5vcGVyYXRvckJyaWRnZS5oYW5kbGVKZW5raW5zRXZlbnQoZXZlbnQpO1xuXG4gICAgICAgICAgaWYgKHJlc3VsdC5pbmNpZGVudENyZWF0ZWQpIGluY2lkZW50c0NyZWF0ZWQrKztcbiAgICAgICAgICBpZiAocmVzdWx0LmFwcHJvdmFsQ3JlYXRlZCkgYXBwcm92YWxzQ3JlYXRlZCsrO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgIGV2ZW50SWQ6IGAke2V2ZW50LnR5cGV9XyR7RGF0ZS5ub3coKX1gLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgICBldmVudHNQcm9jZXNzZWQ6IGV2ZW50cy5sZW5ndGgsXG4gICAgICAgIGluY2lkZW50c0NyZWF0ZWQsXG4gICAgICAgIGFwcHJvdmFsc0NyZWF0ZWQsXG4gICAgICAgIGVycm9yczogZXJyb3JzLmxlbmd0aCA+IDAgPyBlcnJvcnMgOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXZlbnRzUHJvY2Vzc2VkOiAwLFxuICAgICAgICBpbmNpZGVudHNDcmVhdGVkOiAwLFxuICAgICAgICBhcHByb3ZhbHNDcmVhdGVkOiAwLFxuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBldmVudElkOiAnd2ViaG9va19oYW5kbGVyJyxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfVxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDliqjkvZzlpITnkIblmajljIXoo4Xlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUplbmtpbnNBY3Rpb25IYW5kbGVyKFxuICBpbnRlZ3JhdGlvbjogSmVua2luc0ludGVncmF0aW9uUmVzdWx0XG4pIHtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyBoYW5kbGVBcHByb3ZlKFxuICAgICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICAgIGFjdG9ySWQ/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgIC8vIOajgOafpeagvOW8j++8mmplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+XG4gICAgICBpZiAoIXNvdXJjZUlkLnN0YXJ0c1dpdGgoJ2plbmtpbnNfaW5wdXQ6JykpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlOiAnTm90IGEgSmVua2lucyBpbnB1dCBzb3VyY2VJZCcsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhd2FpdCBpbnRlZ3JhdGlvbi5vcGVyYXRvckJyaWRnZS5oYW5kbGVBcHByb3ZlQWN0aW9uKHNvdXJjZUlkLCBhY3RvcklkKTtcbiAgICB9LFxuXG4gICAgYXN5bmMgaGFuZGxlUmVqZWN0KFxuICAgICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICAgIGFjdG9ySWQ/OiBzdHJpbmcsXG4gICAgICByZWFzb24/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgIC8vIOajgOafpeagvOW8j++8mmplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+XG4gICAgICBpZiAoIXNvdXJjZUlkLnN0YXJ0c1dpdGgoJ2plbmtpbnNfaW5wdXQ6JykpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlOiAnTm90IGEgSmVua2lucyBpbnB1dCBzb3VyY2VJZCcsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhd2FpdCBpbnRlZ3JhdGlvbi5vcGVyYXRvckJyaWRnZS5oYW5kbGVSZWplY3RBY3Rpb24oc291cmNlSWQsIGFjdG9ySWQsIHJlYXNvbik7XG4gICAgfSxcblxuICAgIGFzeW5jIGhhbmRsZVJlcnVuKHNvdXJjZUlkOiBzdHJpbmcpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgIC8vIOajgOafpeagvOW8j++8mmplbmtpbnNfYnVpbGQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj5cbiAgICAgIGlmICghc291cmNlSWQuc3RhcnRzV2l0aCgnamVua2luc19idWlsZDonKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdOb3QgYSBKZW5raW5zIGJ1aWxkIHNvdXJjZUlkJyxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGF3YWl0IGludGVncmF0aW9uLm9wZXJhdG9yQnJpZGdlLmhhbmRsZVJlcnVuQWN0aW9uKHNvdXJjZUlkKTtcbiAgICB9LFxuICB9O1xufVxuIl19