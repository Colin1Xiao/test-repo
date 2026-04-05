"use strict";
/**
 * Trading Ops Pack
 * Phase 2C-1 - 交易工程运维包统一装配入口
 *
 * 职责：
 * - 组装所有交易域模块
 * - 提供统一的初始化接口
 * - 导出交易域能力
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingOperatorViews = exports.TradingConnectorBridge = exports.TradingIncidentMapper = exports.TradingApprovalMapper = void 0;
exports.initializeTradingOpsPack = initializeTradingOpsPack;
exports.createReleaseRequestEvent = createReleaseRequestEvent;
exports.createSystemAlertEvent = createSystemAlertEvent;
exports.createDeploymentPendingEvent = createDeploymentPendingEvent;
const trading_approval_mapper_1 = require("./trading_approval_mapper");
const trading_incident_mapper_1 = require("./trading_incident_mapper");
const trading_connector_bridge_1 = require("./trading_connector_bridge");
const trading_operator_views_1 = require("./trading_operator_views");
// ============================================================================
// 集成初始化
// ============================================================================
function initializeTradingOpsPack(config = {}) {
    // 1. 创建审批映射器
    const approvalMapper = (0, trading_approval_mapper_1.createTradingApprovalMapper)({
        autoCreateApproval: config.autoCreateApproval ?? true,
        requireApprovalForRiskLevel: config.requireApprovalForRiskLevel,
        autoApproveTestnet: config.environment === 'testnet',
    });
    // 2. 创建事件映射器
    const incidentMapper = (0, trading_incident_mapper_1.createTradingIncidentMapper)({
        autoCreateIncident: config.autoCreateIncident ?? true,
        alertSeverityThreshold: config.alertSeverityThreshold,
    });
    // 3. 创建 Connector 桥接
    const connectorBridge = (0, trading_connector_bridge_1.createTradingConnectorBridge)({
        githubActionsIntegration: config.githubActionsIntegration,
        defaultEnvironment: config.environment,
    });
    // 4. 创建 Operator 视图
    const operatorViews = (0, trading_operator_views_1.createTradingOperatorViews)({
        defaultEnvironment: config.environment,
    });
    // 5. 创建统一事件处理器
    const processEvent = async (event) => {
        const result = {};
        // 处理审批
        const approvalResult = approvalMapper.adaptEvent(event);
        if (approvalResult.approval) {
            result.approval = approvalResult.approval;
        }
        if (approvalResult.autoApproved) {
            result.autoApproved = true;
        }
        // 处理事件
        const incidentResult = incidentMapper.adaptEvent(event);
        if (incidentResult.incident) {
            result.incident = incidentResult.incident;
        }
        if (incidentResult.ignored) {
            result.ignored = true;
        }
        return result;
    };
    return {
        approvalMapper,
        incidentMapper,
        connectorBridge,
        operatorViews,
        processEvent,
    };
}
// ============================================================================
// 便利函数
// ============================================================================
/**
 * 创建 Release Request 事件
 */
function createReleaseRequestEvent(strategyName, version, description, requestedBy, environment = 'mainnet', riskLevel = 'medium') {
    return {
        type: 'release_requested',
        timestamp: Date.now(),
        severity: riskLevel,
        source: {
            system: 'trading_ops',
            component: 'release_manager',
            environment,
        },
        actor: {
            userId: requestedBy,
            username: requestedBy,
        },
        metadata: {
            releaseId: `release_${Date.now()}`,
            strategyName,
            version,
            description,
            riskLevel,
            environment,
        },
    };
}
/**
 * 创建 System Alert 事件
 */
function createSystemAlertEvent(alertType, title, description, system, component, severity = 'medium', environment = 'mainnet') {
    return {
        type: 'system_alert',
        timestamp: Date.now(),
        severity,
        source: {
            system,
            component,
            environment,
        },
        actor: {
            userId: 'system',
            username: 'system',
        },
        metadata: {
            alertId: `alert_${Date.now()}`,
            alertType,
            title,
            description,
        },
    };
}
/**
 * 创建 Deployment Pending 事件
 */
function createDeploymentPendingEvent(deploymentId, environment, requestedBy, riskLevel = 'high') {
    return {
        type: 'deployment_pending',
        timestamp: Date.now(),
        severity: riskLevel,
        source: {
            system: 'github_actions',
            component: 'deployment',
            environment: environment,
        },
        actor: {
            userId: requestedBy,
            username: requestedBy,
        },
        metadata: {
            deploymentId: String(deploymentId),
            githubDeploymentId: deploymentId,
            environment,
            environmentName: environment,
            riskLevel,
        },
    };
}
// ============================================================================
// 导出类型
// ============================================================================
__exportStar(require("./trading_types"), exports);
var trading_approval_mapper_2 = require("./trading_approval_mapper");
Object.defineProperty(exports, "TradingApprovalMapper", { enumerable: true, get: function () { return trading_approval_mapper_2.TradingApprovalMapper; } });
var trading_incident_mapper_2 = require("./trading_incident_mapper");
Object.defineProperty(exports, "TradingIncidentMapper", { enumerable: true, get: function () { return trading_incident_mapper_2.TradingIncidentMapper; } });
var trading_connector_bridge_2 = require("./trading_connector_bridge");
Object.defineProperty(exports, "TradingConnectorBridge", { enumerable: true, get: function () { return trading_connector_bridge_2.TradingConnectorBridge; } });
var trading_operator_views_2 = require("./trading_operator_views");
Object.defineProperty(exports, "TradingOperatorViews", { enumerable: true, get: function () { return trading_operator_views_2.TradingOperatorViews; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19vcHNfcGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9kb21haW4vdHJhZGluZy90cmFkaW5nX29wc19wYWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUErQkgsNERBMkRDO0FBU0QsOERBOEJDO0FBS0Qsd0RBNkJDO0FBS0Qsb0VBMkJDO0FBak1ELHVFQUF3RTtBQUN4RSx1RUFBd0U7QUFDeEUseUVBQTBFO0FBQzFFLHFFQUFzRTtBQXNCdEUsK0VBQStFO0FBQy9FLFFBQVE7QUFDUiwrRUFBK0U7QUFFL0UsU0FBZ0Isd0JBQXdCLENBQ3RDLFNBQStCLEVBQUU7SUFFakMsYUFBYTtJQUNiLE1BQU0sY0FBYyxHQUFHLElBQUEscURBQTJCLEVBQUM7UUFDakQsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLElBQUk7UUFDckQsMkJBQTJCLEVBQUUsTUFBTSxDQUFDLDJCQUEyQjtRQUMvRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsV0FBVyxLQUFLLFNBQVM7S0FDckQsQ0FBQyxDQUFDO0lBRUgsYUFBYTtJQUNiLE1BQU0sY0FBYyxHQUFHLElBQUEscURBQTJCLEVBQUM7UUFDakQsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLElBQUk7UUFDckQsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLHNCQUFzQjtLQUN0RCxDQUFDLENBQUM7SUFFSCxxQkFBcUI7SUFDckIsTUFBTSxlQUFlLEdBQUcsSUFBQSx1REFBNEIsRUFBQztRQUNuRCx3QkFBd0IsRUFBRSxNQUFNLENBQUMsd0JBQXdCO1FBQ3pELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxXQUFXO0tBQ3ZDLENBQUMsQ0FBQztJQUVILG9CQUFvQjtJQUNwQixNQUFNLGFBQWEsR0FBRyxJQUFBLG1EQUEwQixFQUFDO1FBQy9DLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxXQUFXO0tBQ3ZDLENBQUMsQ0FBQztJQUVILGVBQWU7SUFDZixNQUFNLFlBQVksR0FBRyxLQUFLLEVBQUUsS0FBbUIsRUFBRSxFQUFFO1FBQ2pELE1BQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQztRQUV2QixPQUFPO1FBQ1AsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4RCxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM1QixNQUFNLENBQUMsUUFBUSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUM7UUFDNUMsQ0FBQztRQUNELElBQUksY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hDLE1BQU0sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO1FBQzdCLENBQUM7UUFFRCxPQUFPO1FBQ1AsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4RCxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM1QixNQUFNLENBQUMsUUFBUSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUM7UUFDNUMsQ0FBQztRQUNELElBQUksY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDLENBQUM7SUFFRixPQUFPO1FBQ0wsY0FBYztRQUNkLGNBQWM7UUFDZCxlQUFlO1FBQ2YsYUFBYTtRQUNiLFlBQVk7S0FDYixDQUFDO0FBQ0osQ0FBQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQ3ZDLFlBQW9CLEVBQ3BCLE9BQWUsRUFDZixXQUFtQixFQUNuQixXQUFtQixFQUNuQixjQUFxQyxTQUFTLEVBQzlDLFlBQW9ELFFBQVE7SUFFNUQsT0FBTztRQUNMLElBQUksRUFBRSxtQkFBbUI7UUFDekIsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDckIsUUFBUSxFQUFFLFNBQVM7UUFDbkIsTUFBTSxFQUFFO1lBQ04sTUFBTSxFQUFFLGFBQWE7WUFDckIsU0FBUyxFQUFFLGlCQUFpQjtZQUM1QixXQUFXO1NBQ1o7UUFDRCxLQUFLLEVBQUU7WUFDTCxNQUFNLEVBQUUsV0FBVztZQUNuQixRQUFRLEVBQUUsV0FBVztTQUN0QjtRQUNELFFBQVEsRUFBRTtZQUNSLFNBQVMsRUFBRSxXQUFXLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNsQyxZQUFZO1lBQ1osT0FBTztZQUNQLFdBQVc7WUFDWCxTQUFTO1lBQ1QsV0FBVztTQUNaO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHNCQUFzQixDQUNwQyxTQUFpQixFQUNqQixLQUFhLEVBQ2IsV0FBbUIsRUFDbkIsTUFBYyxFQUNkLFNBQWlCLEVBQ2pCLFdBQW1ELFFBQVEsRUFDM0QsY0FBcUMsU0FBUztJQUU5QyxPQUFPO1FBQ0wsSUFBSSxFQUFFLGNBQWM7UUFDcEIsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDckIsUUFBUTtRQUNSLE1BQU0sRUFBRTtZQUNOLE1BQU07WUFDTixTQUFTO1lBQ1QsV0FBVztTQUNaO1FBQ0QsS0FBSyxFQUFFO1lBQ0wsTUFBTSxFQUFFLFFBQVE7WUFDaEIsUUFBUSxFQUFFLFFBQVE7U0FDbkI7UUFDRCxRQUFRLEVBQUU7WUFDUixPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDOUIsU0FBUztZQUNULEtBQUs7WUFDTCxXQUFXO1NBQ1o7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsNEJBQTRCLENBQzFDLFlBQW9CLEVBQ3BCLFdBQW1CLEVBQ25CLFdBQW1CLEVBQ25CLFlBQW9ELE1BQU07SUFFMUQsT0FBTztRQUNMLElBQUksRUFBRSxvQkFBb0I7UUFDMUIsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDckIsUUFBUSxFQUFFLFNBQVM7UUFDbkIsTUFBTSxFQUFFO1lBQ04sTUFBTSxFQUFFLGdCQUFnQjtZQUN4QixTQUFTLEVBQUUsWUFBWTtZQUN2QixXQUFXLEVBQUUsV0FBb0M7U0FDbEQ7UUFDRCxLQUFLLEVBQUU7WUFDTCxNQUFNLEVBQUUsV0FBVztZQUNuQixRQUFRLEVBQUUsV0FBVztTQUN0QjtRQUNELFFBQVEsRUFBRTtZQUNSLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDO1lBQ2xDLGtCQUFrQixFQUFFLFlBQVk7WUFDaEMsV0FBVztZQUNYLGVBQWUsRUFBRSxXQUFXO1lBQzVCLFNBQVM7U0FDVjtLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0Usa0RBQWdDO0FBQ2hDLHFFQUFrRTtBQUF6RCxnSUFBQSxxQkFBcUIsT0FBQTtBQUM5QixxRUFBa0U7QUFBekQsZ0lBQUEscUJBQXFCLE9BQUE7QUFDOUIsdUVBQW9FO0FBQTNELGtJQUFBLHNCQUFzQixPQUFBO0FBQy9CLG1FQUFnRTtBQUF2RCw4SEFBQSxvQkFBb0IsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVHJhZGluZyBPcHMgUGFja1xuICogUGhhc2UgMkMtMSAtIOS6pOaYk+W3peeoi+i/kOe7tOWMhee7n+S4gOijhemFjeWFpeWPo1xuICogXG4gKiDogYzotKPvvJpcbiAqIC0g57uE6KOF5omA5pyJ5Lqk5piT5Z+f5qih5Z2XXG4gKiAtIOaPkOS+m+e7n+S4gOeahOWIneWni+WMluaOpeWPo1xuICogLSDlr7zlh7rkuqTmmJPln5/og73liptcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVUcmFkaW5nQXBwcm92YWxNYXBwZXIgfSBmcm9tICcuL3RyYWRpbmdfYXBwcm92YWxfbWFwcGVyJztcbmltcG9ydCB7IGNyZWF0ZVRyYWRpbmdJbmNpZGVudE1hcHBlciB9IGZyb20gJy4vdHJhZGluZ19pbmNpZGVudF9tYXBwZXInO1xuaW1wb3J0IHsgY3JlYXRlVHJhZGluZ0Nvbm5lY3RvckJyaWRnZSB9IGZyb20gJy4vdHJhZGluZ19jb25uZWN0b3JfYnJpZGdlJztcbmltcG9ydCB7IGNyZWF0ZVRyYWRpbmdPcGVyYXRvclZpZXdzIH0gZnJvbSAnLi90cmFkaW5nX29wZXJhdG9yX3ZpZXdzJztcbmltcG9ydCB0eXBlIHsgVHJhZGluZ09wc1BhY2tDb25maWcsIFRyYWRpbmdFdmVudCB9IGZyb20gJy4vdHJhZGluZ190eXBlcyc7XG5pbXBvcnQgdHlwZSB7IE1hcHBlZFRyYWRpbmdBcHByb3ZhbCB9IGZyb20gJy4vdHJhZGluZ190eXBlcyc7XG5pbXBvcnQgdHlwZSB7IE1hcHBlZFRyYWRpbmdJbmNpZGVudCB9IGZyb20gJy4vdHJhZGluZ190eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmbhuaIkOe7k+aenFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWRpbmdPcHNQYWNrUmVzdWx0IHtcbiAgYXBwcm92YWxNYXBwZXI6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdBcHByb3ZhbE1hcHBlcj47XG4gIGluY2lkZW50TWFwcGVyOiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVUcmFkaW5nSW5jaWRlbnRNYXBwZXI+O1xuICBjb25uZWN0b3JCcmlkZ2U6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdDb25uZWN0b3JCcmlkZ2U+O1xuICBvcGVyYXRvclZpZXdzOiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVUcmFkaW5nT3BlcmF0b3JWaWV3cz47XG4gIHByb2Nlc3NFdmVudDogKGV2ZW50OiBUcmFkaW5nRXZlbnQpID0+IFByb21pc2U8e1xuICAgIGFwcHJvdmFsPzogTWFwcGVkVHJhZGluZ0FwcHJvdmFsO1xuICAgIGluY2lkZW50PzogTWFwcGVkVHJhZGluZ0luY2lkZW50O1xuICAgIGF1dG9BcHByb3ZlZD86IGJvb2xlYW47XG4gICAgaWdub3JlZD86IGJvb2xlYW47XG4gIH0+O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpm4bmiJDliJ3lp4vljJZcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVUcmFkaW5nT3BzUGFjayhcbiAgY29uZmlnOiBUcmFkaW5nT3BzUGFja0NvbmZpZyA9IHt9XG4pOiBUcmFkaW5nT3BzUGFja1Jlc3VsdCB7XG4gIC8vIDEuIOWIm+W7uuWuoeaJueaYoOWwhOWZqFxuICBjb25zdCBhcHByb3ZhbE1hcHBlciA9IGNyZWF0ZVRyYWRpbmdBcHByb3ZhbE1hcHBlcih7XG4gICAgYXV0b0NyZWF0ZUFwcHJvdmFsOiBjb25maWcuYXV0b0NyZWF0ZUFwcHJvdmFsID8/IHRydWUsXG4gICAgcmVxdWlyZUFwcHJvdmFsRm9yUmlza0xldmVsOiBjb25maWcucmVxdWlyZUFwcHJvdmFsRm9yUmlza0xldmVsLFxuICAgIGF1dG9BcHByb3ZlVGVzdG5ldDogY29uZmlnLmVudmlyb25tZW50ID09PSAndGVzdG5ldCcsXG4gIH0pO1xuXG4gIC8vIDIuIOWIm+W7uuS6i+S7tuaYoOWwhOWZqFxuICBjb25zdCBpbmNpZGVudE1hcHBlciA9IGNyZWF0ZVRyYWRpbmdJbmNpZGVudE1hcHBlcih7XG4gICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgYWxlcnRTZXZlcml0eVRocmVzaG9sZDogY29uZmlnLmFsZXJ0U2V2ZXJpdHlUaHJlc2hvbGQsXG4gIH0pO1xuXG4gIC8vIDMuIOWIm+W7uiBDb25uZWN0b3Ig5qGl5o6lXG4gIGNvbnN0IGNvbm5lY3RvckJyaWRnZSA9IGNyZWF0ZVRyYWRpbmdDb25uZWN0b3JCcmlkZ2Uoe1xuICAgIGdpdGh1YkFjdGlvbnNJbnRlZ3JhdGlvbjogY29uZmlnLmdpdGh1YkFjdGlvbnNJbnRlZ3JhdGlvbixcbiAgICBkZWZhdWx0RW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgfSk7XG5cbiAgLy8gNC4g5Yib5bu6IE9wZXJhdG9yIOinhuWbvlxuICBjb25zdCBvcGVyYXRvclZpZXdzID0gY3JlYXRlVHJhZGluZ09wZXJhdG9yVmlld3Moe1xuICAgIGRlZmF1bHRFbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50LFxuICB9KTtcblxuICAvLyA1LiDliJvlu7rnu5/kuIDkuovku7blpITnkIblmahcbiAgY29uc3QgcHJvY2Vzc0V2ZW50ID0gYXN5bmMgKGV2ZW50OiBUcmFkaW5nRXZlbnQpID0+IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgLy8g5aSE55CG5a6h5om5XG4gICAgY29uc3QgYXBwcm92YWxSZXN1bHQgPSBhcHByb3ZhbE1hcHBlci5hZGFwdEV2ZW50KGV2ZW50KTtcbiAgICBpZiAoYXBwcm92YWxSZXN1bHQuYXBwcm92YWwpIHtcbiAgICAgIHJlc3VsdC5hcHByb3ZhbCA9IGFwcHJvdmFsUmVzdWx0LmFwcHJvdmFsO1xuICAgIH1cbiAgICBpZiAoYXBwcm92YWxSZXN1bHQuYXV0b0FwcHJvdmVkKSB7XG4gICAgICByZXN1bHQuYXV0b0FwcHJvdmVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDlpITnkIbkuovku7ZcbiAgICBjb25zdCBpbmNpZGVudFJlc3VsdCA9IGluY2lkZW50TWFwcGVyLmFkYXB0RXZlbnQoZXZlbnQpO1xuICAgIGlmIChpbmNpZGVudFJlc3VsdC5pbmNpZGVudCkge1xuICAgICAgcmVzdWx0LmluY2lkZW50ID0gaW5jaWRlbnRSZXN1bHQuaW5jaWRlbnQ7XG4gICAgfVxuICAgIGlmIChpbmNpZGVudFJlc3VsdC5pZ25vcmVkKSB7XG4gICAgICByZXN1bHQuaWdub3JlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGFwcHJvdmFsTWFwcGVyLFxuICAgIGluY2lkZW50TWFwcGVyLFxuICAgIGNvbm5lY3RvckJyaWRnZSxcbiAgICBvcGVyYXRvclZpZXdzLFxuICAgIHByb2Nlc3NFdmVudCxcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5Yip5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu6IFJlbGVhc2UgUmVxdWVzdCDkuovku7ZcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlbGVhc2VSZXF1ZXN0RXZlbnQoXG4gIHN0cmF0ZWd5TmFtZTogc3RyaW5nLFxuICB2ZXJzaW9uOiBzdHJpbmcsXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmcsXG4gIHJlcXVlc3RlZEJ5OiBzdHJpbmcsXG4gIGVudmlyb25tZW50OiAndGVzdG5ldCcgfCAnbWFpbm5ldCcgPSAnbWFpbm5ldCcsXG4gIHJpc2tMZXZlbDogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB8ICdjcml0aWNhbCcgPSAnbWVkaXVtJ1xuKTogVHJhZGluZ0V2ZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAncmVsZWFzZV9yZXF1ZXN0ZWQnLFxuICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICBzZXZlcml0eTogcmlza0xldmVsLFxuICAgIHNvdXJjZToge1xuICAgICAgc3lzdGVtOiAndHJhZGluZ19vcHMnLFxuICAgICAgY29tcG9uZW50OiAncmVsZWFzZV9tYW5hZ2VyJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0sXG4gICAgYWN0b3I6IHtcbiAgICAgIHVzZXJJZDogcmVxdWVzdGVkQnksXG4gICAgICB1c2VybmFtZTogcmVxdWVzdGVkQnksXG4gICAgfSxcbiAgICBtZXRhZGF0YToge1xuICAgICAgcmVsZWFzZUlkOiBgcmVsZWFzZV8ke0RhdGUubm93KCl9YCxcbiAgICAgIHN0cmF0ZWd5TmFtZSxcbiAgICAgIHZlcnNpb24sXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICAgIHJpc2tMZXZlbCxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICog5Yib5bu6IFN5c3RlbSBBbGVydCDkuovku7ZcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN5c3RlbUFsZXJ0RXZlbnQoXG4gIGFsZXJ0VHlwZTogc3RyaW5nLFxuICB0aXRsZTogc3RyaW5nLFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBzeXN0ZW06IHN0cmluZyxcbiAgY29tcG9uZW50OiBzdHJpbmcsXG4gIHNldmVyaXR5OiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJyA9ICdtZWRpdW0nLFxuICBlbnZpcm9ubWVudDogJ3Rlc3RuZXQnIHwgJ21haW5uZXQnID0gJ21haW5uZXQnXG4pOiBUcmFkaW5nRXZlbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdzeXN0ZW1fYWxlcnQnLFxuICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICBzZXZlcml0eSxcbiAgICBzb3VyY2U6IHtcbiAgICAgIHN5c3RlbSxcbiAgICAgIGNvbXBvbmVudCxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0sXG4gICAgYWN0b3I6IHtcbiAgICAgIHVzZXJJZDogJ3N5c3RlbScsXG4gICAgICB1c2VybmFtZTogJ3N5c3RlbScsXG4gICAgfSxcbiAgICBtZXRhZGF0YToge1xuICAgICAgYWxlcnRJZDogYGFsZXJ0XyR7RGF0ZS5ub3coKX1gLFxuICAgICAgYWxlcnRUeXBlLFxuICAgICAgdGl0bGUsXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIOWIm+W7uiBEZXBsb3ltZW50IFBlbmRpbmcg5LqL5Lu2XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZXBsb3ltZW50UGVuZGluZ0V2ZW50KFxuICBkZXBsb3ltZW50SWQ6IG51bWJlcixcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgcmVxdWVzdGVkQnk6IHN0cmluZyxcbiAgcmlza0xldmVsOiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJyA9ICdoaWdoJ1xuKTogVHJhZGluZ0V2ZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnZGVwbG95bWVudF9wZW5kaW5nJyxcbiAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgc2V2ZXJpdHk6IHJpc2tMZXZlbCxcbiAgICBzb3VyY2U6IHtcbiAgICAgIHN5c3RlbTogJ2dpdGh1Yl9hY3Rpb25zJyxcbiAgICAgIGNvbXBvbmVudDogJ2RlcGxveW1lbnQnLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50IGFzICd0ZXN0bmV0JyB8ICdtYWlubmV0JyxcbiAgICB9LFxuICAgIGFjdG9yOiB7XG4gICAgICB1c2VySWQ6IHJlcXVlc3RlZEJ5LFxuICAgICAgdXNlcm5hbWU6IHJlcXVlc3RlZEJ5LFxuICAgIH0sXG4gICAgbWV0YWRhdGE6IHtcbiAgICAgIGRlcGxveW1lbnRJZDogU3RyaW5nKGRlcGxveW1lbnRJZCksXG4gICAgICBnaXRodWJEZXBsb3ltZW50SWQ6IGRlcGxveW1lbnRJZCxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgZW52aXJvbm1lbnROYW1lOiBlbnZpcm9ubWVudCxcbiAgICAgIHJpc2tMZXZlbCxcbiAgICB9LFxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlr7zlh7rnsbvlnotcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0ICogZnJvbSAnLi90cmFkaW5nX3R5cGVzJztcbmV4cG9ydCB7IFRyYWRpbmdBcHByb3ZhbE1hcHBlciB9IGZyb20gJy4vdHJhZGluZ19hcHByb3ZhbF9tYXBwZXInO1xuZXhwb3J0IHsgVHJhZGluZ0luY2lkZW50TWFwcGVyIH0gZnJvbSAnLi90cmFkaW5nX2luY2lkZW50X21hcHBlcic7XG5leHBvcnQgeyBUcmFkaW5nQ29ubmVjdG9yQnJpZGdlIH0gZnJvbSAnLi90cmFkaW5nX2Nvbm5lY3Rvcl9icmlkZ2UnO1xuZXhwb3J0IHsgVHJhZGluZ09wZXJhdG9yVmlld3MgfSBmcm9tICcuL3RyYWRpbmdfb3BlcmF0b3Jfdmlld3MnO1xuIl19