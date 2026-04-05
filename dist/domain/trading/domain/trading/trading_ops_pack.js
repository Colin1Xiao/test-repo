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
