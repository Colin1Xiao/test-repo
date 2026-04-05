"use strict";
/**
 * Human Loop Service - 人机协同服务
 *
 * 职责：
 * 1. 统一编排入口
 * 2. 输入：dashboard snapshot + attention items + control surface actions + operator context
 * 3. 输出：intervention items + suggestions + workflow actions + confirmations + trail updates
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanLoopService = void 0;
exports.createHumanLoopService = createHumanLoopService;
exports.processDashboardSnapshot = processDashboardSnapshot;
const intervention_engine_1 = require("./intervention_engine");
const suggestion_engine_1 = require("./suggestion_engine");
const action_confirmation_1 = require("./action_confirmation");
const approval_workflow_1 = require("./approval_workflow");
const incident_workflow_1 = require("./incident_workflow");
const intervention_trail_1 = require("./intervention_trail");
// ============================================================================
// 人机协同服务
// ============================================================================
class HumanLoopService {
    constructor(config = {}) {
        // 当前状态
        this.interventions = new Map();
        this.suggestions = new Map();
        this.confirmations = new Map();
        this.workflows = new Map();
        this.config = {
            autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
            maxTrailEntries: config.maxTrailEntries ?? 1000,
            interventionTimeoutMs: config.interventionTimeoutMs ?? 24 * 60 * 60 * 1000, // 24 小时
        };
        this.interventionEngine = new intervention_engine_1.InterventionEngine({
            maxOpenInterventions: 50,
        });
        this.suggestionEngine = new suggestion_engine_1.SuggestionEngine({
            maxSuggestions: 5,
        });
        this.confirmationManager = new action_confirmation_1.ActionConfirmationManager({});
        this.approvalWorkflowBuilder = new approval_workflow_1.ApprovalWorkflowBuilder();
        this.incidentWorkflowBuilder = new incident_workflow_1.IncidentWorkflowBuilder();
        this.trailManager = (0, intervention_trail_1.createInterventionTrailManager)({
            maxEntries: this.config.maxTrailEntries,
        });
    }
    /**
     * 处理仪表盘快照
     */
    processDashboardSnapshot(dashboard) {
        const now = Date.now();
        // 生成介入项
        const newInterventions = this.interventionEngine.generateInterventionsFromDashboard(dashboard);
        // 记录介入创建
        for (const intervention of newInterventions) {
            if (!this.interventions.has(intervention.id)) {
                this.interventions.set(intervention.id, intervention);
                this.trailManager.recordCreation(intervention);
                // 生成建议
                const suggestions = this.suggestionEngine.generateSuggestions(intervention);
                for (const suggestion of suggestions) {
                    this.suggestions.set(suggestion.id, suggestion);
                }
                // 为审批事件创建工作流
                if (intervention.sourceType === 'approval') {
                    const workflow = (0, approval_workflow_1.buildApprovalWorkflow)(intervention, intervention.sourceId, 'approval', 'unknown');
                    this.workflows.set(workflow.id, workflow);
                }
                // 为事件创建工作流
                if (intervention.sourceType === 'ops') {
                    const workflow = (0, incident_workflow_1.buildIncidentWorkflow)(intervention, `incident_${intervention.sourceId}`, intervention.sourceType);
                    this.workflows.set(workflow.id, workflow);
                }
            }
        }
        // 构建快照
        return this.buildSnapshot(now);
    }
    /**
     * 处理控制面快照
     */
    processControlSurfaceSnapshot(controlSnapshot) {
        const now = Date.now();
        // 为可用动作创建确认
        for (const action of controlSnapshot.availableActions) {
            const guidedAction = {
                id: action.type,
                actionType: action.type,
                label: action.type,
                recommended: false,
                requiresConfirmation: true,
                riskLevel: 'medium',
                params: action,
            };
            const confirmation = (0, action_confirmation_1.createConfirmation)(guidedAction, action.targetId, action.targetType);
            if (confirmation) {
                this.confirmations.set(confirmation.actionId, confirmation);
            }
        }
        // 构建快照（需要 dashboard，这里简化）
        return this.buildSnapshot(now);
    }
    /**
     * 确认动作
     */
    confirmAction(actionId, actor) {
        const confirmation = this.confirmations.get(actionId);
        if (!confirmation) {
            return {
                success: false,
                error: 'Confirmation not found',
            };
        }
        confirmation.status = 'confirmed';
        // 记录追踪
        this.trailManager.recordAction(`action_${actionId}`, actor, 'action_confirmed', 'accepted');
        return {
            success: true,
            confirmation,
        };
    }
    /**
     * 拒绝动作
     */
    rejectAction(actionId, actor) {
        const confirmation = this.confirmations.get(actionId);
        if (!confirmation) {
            return {
                success: false,
                error: 'Confirmation not found',
            };
        }
        confirmation.status = 'rejected';
        // 记录追踪
        this.trailManager.recordAction(`action_${actionId}`, actor, 'action_rejected', 'rejected');
        return {
            success: true,
            confirmation,
        };
    }
    /**
     * 解决介入项
     */
    resolveIntervention(interventionId, actor, result, note) {
        const intervention = this.interventions.get(interventionId);
        if (!intervention) {
            return {
                success: false,
                error: 'Intervention not found',
            };
        }
        intervention.status = result;
        intervention.updatedAt = Date.now();
        // 记录追踪
        this.trailManager.recordResolution(interventionId, actor, result, note);
        return {
            success: true,
            intervention,
        };
    }
    /**
     * 获取介入项
     */
    getIntervention(interventionId) {
        return this.interventions.get(interventionId);
    }
    /**
     * 获取所有开放介入项
     */
    getOpenInterventions() {
        return Array.from(this.interventions.values())
            .filter(i => i.status === 'open' || i.status === 'acknowledged' || i.status === 'in_review');
    }
    /**
     * 获取建议
     */
    getSuggestions() {
        return Array.from(this.suggestions.values());
    }
    /**
     * 获取待确认动作
     */
    getPendingConfirmations() {
        return Array.from(this.confirmations.values())
            .filter(c => c.status === 'pending');
    }
    /**
     * 获取工作流
     */
    getWorkflows() {
        return Array.from(this.workflows.values());
    }
    /**
     * 获取追踪记录
     */
    getTrail(limit) {
        return this.trailManager.getRecentTrail(limit);
    }
    /**
     * 构建人机协同快照
     */
    buildSnapshot(now) {
        const openInterventions = this.getOpenInterventions();
        const pendingConfirmations = this.getPendingConfirmations();
        const suggestions = this.getSuggestions();
        const workflows = this.getWorkflows();
        const trail = this.getTrail(50);
        return {
            snapshotId: `humanloop_${now}`,
            createdAt: now,
            openInterventions,
            queuedConfirmations: pendingConfirmations,
            suggestions,
            workflows,
            trail,
            summary: {
                openCount: openInterventions.length,
                criticalCount: openInterventions.filter(i => i.severity === 'critical').length,
                pendingConfirmations: pendingConfirmations.length,
                escalatedCount: openInterventions.filter(i => i.status === 'escalated').length,
            },
        };
    }
}
exports.HumanLoopService = HumanLoopService;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建人机协同服务
 */
function createHumanLoopService(config) {
    return new HumanLoopService(config);
}
/**
 * 快速处理仪表盘快照
 */
function processDashboardSnapshot(dashboard, config) {
    const service = new HumanLoopService(config);
    return service.processDashboardSnapshot(dashboard);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHVtYW5fbG9vcF9zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V4L2h1bWFuX2xvb3Bfc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBeVZILHdEQUVDO0FBS0QsNERBTUM7QUEvVUQsK0RBRytCO0FBQy9CLDJEQUk2QjtBQUM3QiwrREFHK0I7QUFDL0IsMkRBRzZCO0FBQzdCLDJEQUc2QjtBQUM3Qiw2REFHOEI7QUFFOUIsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBYSxnQkFBZ0I7SUFlM0IsWUFBWSxTQUFpQyxFQUFFO1FBTi9DLE9BQU87UUFDQyxrQkFBYSxHQUFrQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3pELGdCQUFXLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7UUFDekQsa0JBQWEsR0FBb0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMzRCxjQUFTLEdBQStCLElBQUksR0FBRyxFQUFFLENBQUM7UUFHeEQsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxxQkFBcUIsSUFBSSxLQUFLO1lBQzVELGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLElBQUk7WUFDL0MscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksRUFBRSxRQUFRO1NBQ3JGLENBQUM7UUFFRixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSx3Q0FBa0IsQ0FBQztZQUMvQyxvQkFBb0IsRUFBRSxFQUFFO1NBQ0csQ0FBQyxDQUFDO1FBRS9CLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLG9DQUFnQixDQUFDO1lBQzNDLGNBQWMsRUFBRSxDQUFDO1NBQ1EsQ0FBQyxDQUFDO1FBRTdCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLCtDQUF5QixDQUFDLEVBQThCLENBQUMsQ0FBQztRQUN6RixJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSwyQ0FBdUIsRUFBRSxDQUFDO1FBQzdELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLDJDQUF1QixFQUFFLENBQUM7UUFDN0QsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFBLG1EQUE4QixFQUFDO1lBQ2pELFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWU7U0FDYixDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsd0JBQXdCLENBQUMsU0FBNEI7UUFDbkQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXZCLFFBQVE7UUFDUixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQ0FBa0MsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUUvRixTQUFTO1FBQ1QsS0FBSyxNQUFNLFlBQVksSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO1lBQzVDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDdEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBRS9DLE9BQU87Z0JBQ1AsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUM1RSxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRSxDQUFDO29CQUNyQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO2dCQUVELGFBQWE7Z0JBQ2IsSUFBSSxZQUFZLENBQUMsVUFBVSxLQUFLLFVBQVUsRUFBRSxDQUFDO29CQUMzQyxNQUFNLFFBQVEsR0FBRyxJQUFBLHlDQUFxQixFQUNwQyxZQUFZLEVBQ1osWUFBWSxDQUFDLFFBQVEsRUFDckIsVUFBVSxFQUNWLFNBQVMsQ0FDVixDQUFDO29CQUNGLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzVDLENBQUM7Z0JBRUQsV0FBVztnQkFDWCxJQUFJLFlBQVksQ0FBQyxVQUFVLEtBQUssS0FBSyxFQUFFLENBQUM7b0JBQ3RDLE1BQU0sUUFBUSxHQUFHLElBQUEseUNBQXFCLEVBQ3BDLFlBQVksRUFDWixZQUFZLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFDbkMsWUFBWSxDQUFDLFVBQVUsQ0FDeEIsQ0FBQztvQkFDRixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPO1FBQ1AsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRDs7T0FFRztJQUNILDZCQUE2QixDQUFDLGVBQXVDO1FBQ25FLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUV2QixZQUFZO1FBQ1osS0FBSyxNQUFNLE1BQU0sSUFBSSxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN0RCxNQUFNLFlBQVksR0FBRztnQkFDbkIsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2dCQUNmLFVBQVUsRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDdkIsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJO2dCQUNsQixXQUFXLEVBQUUsS0FBSztnQkFDbEIsb0JBQW9CLEVBQUUsSUFBSTtnQkFDMUIsU0FBUyxFQUFFLFFBQWlCO2dCQUM1QixNQUFNLEVBQUUsTUFBTTthQUNmLENBQUM7WUFFRixNQUFNLFlBQVksR0FBRyxJQUFBLHdDQUFrQixFQUNyQyxZQUFZLEVBQ1osTUFBTSxDQUFDLFFBQVEsRUFDZixNQUFNLENBQUMsVUFBVSxDQUNsQixDQUFDO1lBRUYsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDakIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUM5RCxDQUFDO1FBQ0gsQ0FBQztRQUVELDBCQUEwQjtRQUMxQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUNYLFFBQWdCLEVBQ2hCLEtBQWE7UUFFYixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV0RCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbEIsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsd0JBQXdCO2FBQ2hDLENBQUM7UUFDSixDQUFDO1FBRUQsWUFBWSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7UUFFbEMsT0FBTztRQUNQLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUM1QixVQUFVLFFBQVEsRUFBRSxFQUNwQixLQUFLLEVBQ0wsa0JBQWtCLEVBQ2xCLFVBQVUsQ0FDWCxDQUFDO1FBRUYsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsWUFBWTtTQUNiLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZLENBQ1YsUUFBZ0IsRUFDaEIsS0FBYTtRQUViLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXRELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssRUFBRSx3QkFBd0I7YUFDaEMsQ0FBQztRQUNKLENBQUM7UUFFRCxZQUFZLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQztRQUVqQyxPQUFPO1FBQ1AsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQzVCLFVBQVUsUUFBUSxFQUFFLEVBQ3BCLEtBQUssRUFDTCxpQkFBaUIsRUFDakIsVUFBVSxDQUNYLENBQUM7UUFFRixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixZQUFZO1NBQ2IsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILG1CQUFtQixDQUNqQixjQUFzQixFQUN0QixLQUFhLEVBQ2IsTUFBOEMsRUFDOUMsSUFBYTtRQUViLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRTVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssRUFBRSx3QkFBd0I7YUFDaEMsQ0FBQztRQUNKLENBQUM7UUFFRCxZQUFZLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUM3QixZQUFZLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUVwQyxPQUFPO1FBQ1AsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV4RSxPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixZQUFZO1NBQ2IsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILGVBQWUsQ0FBQyxjQUFzQjtRQUNwQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRDs7T0FFRztJQUNILG9CQUFvQjtRQUNsQixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQzthQUMzQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDO0lBQ2pHLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRDs7T0FFRztJQUNILHVCQUF1QjtRQUNyQixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQzthQUMzQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVk7UUFDVixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVEsQ0FBQyxLQUFjO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUFDLEdBQVc7UUFDdkIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUN0RCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQzVELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUMxQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVoQyxPQUFPO1lBQ0wsVUFBVSxFQUFFLGFBQWEsR0FBRyxFQUFFO1lBQzlCLFNBQVMsRUFBRSxHQUFHO1lBQ2QsaUJBQWlCO1lBQ2pCLG1CQUFtQixFQUFFLG9CQUFvQjtZQUN6QyxXQUFXO1lBQ1gsU0FBUztZQUNULEtBQUs7WUFDTCxPQUFPLEVBQUU7Z0JBQ1AsU0FBUyxFQUFFLGlCQUFpQixDQUFDLE1BQU07Z0JBQ25DLGFBQWEsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLFVBQVUsQ0FBQyxDQUFDLE1BQU07Z0JBQzlFLG9CQUFvQixFQUFFLG9CQUFvQixDQUFDLE1BQU07Z0JBQ2pELGNBQWMsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLE1BQU07YUFDL0U7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBM1JELDRDQTJSQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0Isc0JBQXNCLENBQUMsTUFBK0I7SUFDcEUsT0FBTyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHdCQUF3QixDQUN0QyxTQUE0QixFQUM1QixNQUErQjtJQUUvQixNQUFNLE9BQU8sR0FBRyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzdDLE9BQU8sT0FBTyxDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3JELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEh1bWFuIExvb3AgU2VydmljZSAtIOS6uuacuuWNj+WQjOacjeWKoVxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOe7n+S4gOe8luaOkuWFpeWPo1xuICogMi4g6L6T5YWl77yaZGFzaGJvYXJkIHNuYXBzaG90ICsgYXR0ZW50aW9uIGl0ZW1zICsgY29udHJvbCBzdXJmYWNlIGFjdGlvbnMgKyBvcGVyYXRvciBjb250ZXh0XG4gKiAzLiDovpPlh7rvvJppbnRlcnZlbnRpb24gaXRlbXMgKyBzdWdnZXN0aW9ucyArIHdvcmtmbG93IGFjdGlvbnMgKyBjb25maXJtYXRpb25zICsgdHJhaWwgdXBkYXRlc1xuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDRcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIERhc2hib2FyZFNuYXBzaG90LFxuICBBdHRlbnRpb25JdGVtLFxufSBmcm9tICcuL2Rhc2hib2FyZF90eXBlcyc7XG5pbXBvcnQgdHlwZSB7XG4gIENvbnRyb2xTdXJmYWNlU25hcHNob3QsXG4gIENvbnRyb2xBY3Rpb24sXG59IGZyb20gJy4vY29udHJvbF90eXBlcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEludGVydmVudGlvbkl0ZW0sXG4gIE9wZXJhdG9yU3VnZ2VzdGlvbixcbiAgQWN0aW9uQ29uZmlybWF0aW9uLFxuICBXb3JrZmxvd1N0YXRlLFxuICBJbnRlcnZlbnRpb25UcmFpbEVudHJ5LFxuICBIdW1hbkxvb3BTbmFwc2hvdCxcbiAgSW50ZXJ2ZW50aW9uRW5naW5lQ29uZmlnLFxuICBTdWdnZXN0aW9uRW5naW5lQ29uZmlnLFxuICBBY3Rpb25Db25maXJtYXRpb25Db25maWcsXG4gIEludGVydmVudGlvblRyYWlsQ29uZmlnLFxuICBIdW1hbkxvb3BTZXJ2aWNlQ29uZmlnLFxufSBmcm9tICcuL2hpdGxfdHlwZXMnO1xuaW1wb3J0IHtcbiAgSW50ZXJ2ZW50aW9uRW5naW5lLFxuICBnZW5lcmF0ZUludGVydmVudGlvbnMsXG59IGZyb20gJy4vaW50ZXJ2ZW50aW9uX2VuZ2luZSc7XG5pbXBvcnQge1xuICBTdWdnZXN0aW9uRW5naW5lLFxuICBnZW5lcmF0ZVN1Z2dlc3Rpb25zLFxuICByZWZpbmVHdWlkZWRBY3Rpb25zLFxufSBmcm9tICcuL3N1Z2dlc3Rpb25fZW5naW5lJztcbmltcG9ydCB7XG4gIEFjdGlvbkNvbmZpcm1hdGlvbk1hbmFnZXIsXG4gIGNyZWF0ZUNvbmZpcm1hdGlvbixcbn0gZnJvbSAnLi9hY3Rpb25fY29uZmlybWF0aW9uJztcbmltcG9ydCB7XG4gIEFwcHJvdmFsV29ya2Zsb3dCdWlsZGVyLFxuICBidWlsZEFwcHJvdmFsV29ya2Zsb3csXG59IGZyb20gJy4vYXBwcm92YWxfd29ya2Zsb3cnO1xuaW1wb3J0IHtcbiAgSW5jaWRlbnRXb3JrZmxvd0J1aWxkZXIsXG4gIGJ1aWxkSW5jaWRlbnRXb3JrZmxvdyxcbn0gZnJvbSAnLi9pbmNpZGVudF93b3JrZmxvdyc7XG5pbXBvcnQge1xuICBJbnRlcnZlbnRpb25UcmFpbE1hbmFnZXIsXG4gIGNyZWF0ZUludGVydmVudGlvblRyYWlsTWFuYWdlcixcbn0gZnJvbSAnLi9pbnRlcnZlbnRpb25fdHJhaWwnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkurrmnLrljY/lkIzmnI3liqFcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEh1bWFuTG9vcFNlcnZpY2Uge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8SHVtYW5Mb29wU2VydmljZUNvbmZpZz47XG4gIHByaXZhdGUgaW50ZXJ2ZW50aW9uRW5naW5lOiBJbnRlcnZlbnRpb25FbmdpbmU7XG4gIHByaXZhdGUgc3VnZ2VzdGlvbkVuZ2luZTogU3VnZ2VzdGlvbkVuZ2luZTtcbiAgcHJpdmF0ZSBjb25maXJtYXRpb25NYW5hZ2VyOiBBY3Rpb25Db25maXJtYXRpb25NYW5hZ2VyO1xuICBwcml2YXRlIGFwcHJvdmFsV29ya2Zsb3dCdWlsZGVyOiBBcHByb3ZhbFdvcmtmbG93QnVpbGRlcjtcbiAgcHJpdmF0ZSBpbmNpZGVudFdvcmtmbG93QnVpbGRlcjogSW5jaWRlbnRXb3JrZmxvd0J1aWxkZXI7XG4gIHByaXZhdGUgdHJhaWxNYW5hZ2VyOiBJbnRlcnZlbnRpb25UcmFpbE1hbmFnZXI7XG4gIFxuICAvLyDlvZPliY3nirbmgIFcbiAgcHJpdmF0ZSBpbnRlcnZlbnRpb25zOiBNYXA8c3RyaW5nLCBJbnRlcnZlbnRpb25JdGVtPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBzdWdnZXN0aW9uczogTWFwPHN0cmluZywgT3BlcmF0b3JTdWdnZXN0aW9uPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBjb25maXJtYXRpb25zOiBNYXA8c3RyaW5nLCBBY3Rpb25Db25maXJtYXRpb24+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHdvcmtmbG93czogTWFwPHN0cmluZywgV29ya2Zsb3dTdGF0ZT4gPSBuZXcgTWFwKCk7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEh1bWFuTG9vcFNlcnZpY2VDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYXV0b1JlZnJlc2hJbnRlcnZhbE1zOiBjb25maWcuYXV0b1JlZnJlc2hJbnRlcnZhbE1zID8/IDMwMDAwLFxuICAgICAgbWF4VHJhaWxFbnRyaWVzOiBjb25maWcubWF4VHJhaWxFbnRyaWVzID8/IDEwMDAsXG4gICAgICBpbnRlcnZlbnRpb25UaW1lb3V0TXM6IGNvbmZpZy5pbnRlcnZlbnRpb25UaW1lb3V0TXMgPz8gMjQgKiA2MCAqIDYwICogMTAwMCwgLy8gMjQg5bCP5pe2XG4gICAgfTtcbiAgICBcbiAgICB0aGlzLmludGVydmVudGlvbkVuZ2luZSA9IG5ldyBJbnRlcnZlbnRpb25FbmdpbmUoe1xuICAgICAgbWF4T3BlbkludGVydmVudGlvbnM6IDUwLFxuICAgIH0gYXMgSW50ZXJ2ZW50aW9uRW5naW5lQ29uZmlnKTtcbiAgICBcbiAgICB0aGlzLnN1Z2dlc3Rpb25FbmdpbmUgPSBuZXcgU3VnZ2VzdGlvbkVuZ2luZSh7XG4gICAgICBtYXhTdWdnZXN0aW9uczogNSxcbiAgICB9IGFzIFN1Z2dlc3Rpb25FbmdpbmVDb25maWcpO1xuICAgIFxuICAgIHRoaXMuY29uZmlybWF0aW9uTWFuYWdlciA9IG5ldyBBY3Rpb25Db25maXJtYXRpb25NYW5hZ2VyKHt9IGFzIEFjdGlvbkNvbmZpcm1hdGlvbkNvbmZpZyk7XG4gICAgdGhpcy5hcHByb3ZhbFdvcmtmbG93QnVpbGRlciA9IG5ldyBBcHByb3ZhbFdvcmtmbG93QnVpbGRlcigpO1xuICAgIHRoaXMuaW5jaWRlbnRXb3JrZmxvd0J1aWxkZXIgPSBuZXcgSW5jaWRlbnRXb3JrZmxvd0J1aWxkZXIoKTtcbiAgICB0aGlzLnRyYWlsTWFuYWdlciA9IGNyZWF0ZUludGVydmVudGlvblRyYWlsTWFuYWdlcih7XG4gICAgICBtYXhFbnRyaWVzOiB0aGlzLmNvbmZpZy5tYXhUcmFpbEVudHJpZXMsXG4gICAgfSBhcyBJbnRlcnZlbnRpb25UcmFpbENvbmZpZyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlpITnkIbku6rooajnm5jlv6vnhadcbiAgICovXG4gIHByb2Nlc3NEYXNoYm9hcmRTbmFwc2hvdChkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90KTogSHVtYW5Mb29wU25hcHNob3Qge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g55Sf5oiQ5LuL5YWl6aG5XG4gICAgY29uc3QgbmV3SW50ZXJ2ZW50aW9ucyA9IHRoaXMuaW50ZXJ2ZW50aW9uRW5naW5lLmdlbmVyYXRlSW50ZXJ2ZW50aW9uc0Zyb21EYXNoYm9hcmQoZGFzaGJvYXJkKTtcbiAgICBcbiAgICAvLyDorrDlvZXku4vlhaXliJvlu7pcbiAgICBmb3IgKGNvbnN0IGludGVydmVudGlvbiBvZiBuZXdJbnRlcnZlbnRpb25zKSB7XG4gICAgICBpZiAoIXRoaXMuaW50ZXJ2ZW50aW9ucy5oYXMoaW50ZXJ2ZW50aW9uLmlkKSkge1xuICAgICAgICB0aGlzLmludGVydmVudGlvbnMuc2V0KGludGVydmVudGlvbi5pZCwgaW50ZXJ2ZW50aW9uKTtcbiAgICAgICAgdGhpcy50cmFpbE1hbmFnZXIucmVjb3JkQ3JlYXRpb24oaW50ZXJ2ZW50aW9uKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOeUn+aIkOW7uuiurlxuICAgICAgICBjb25zdCBzdWdnZXN0aW9ucyA9IHRoaXMuc3VnZ2VzdGlvbkVuZ2luZS5nZW5lcmF0ZVN1Z2dlc3Rpb25zKGludGVydmVudGlvbik7XG4gICAgICAgIGZvciAoY29uc3Qgc3VnZ2VzdGlvbiBvZiBzdWdnZXN0aW9ucykge1xuICAgICAgICAgIHRoaXMuc3VnZ2VzdGlvbnMuc2V0KHN1Z2dlc3Rpb24uaWQsIHN1Z2dlc3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDkuLrlrqHmibnkuovku7bliJvlu7rlt6XkvZzmtYFcbiAgICAgICAgaWYgKGludGVydmVudGlvbi5zb3VyY2VUeXBlID09PSAnYXBwcm92YWwnKSB7XG4gICAgICAgICAgY29uc3Qgd29ya2Zsb3cgPSBidWlsZEFwcHJvdmFsV29ya2Zsb3coXG4gICAgICAgICAgICBpbnRlcnZlbnRpb24sXG4gICAgICAgICAgICBpbnRlcnZlbnRpb24uc291cmNlSWQsXG4gICAgICAgICAgICAnYXBwcm92YWwnLFxuICAgICAgICAgICAgJ3Vua25vd24nXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aGlzLndvcmtmbG93cy5zZXQod29ya2Zsb3cuaWQsIHdvcmtmbG93KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5Li65LqL5Lu25Yib5bu65bel5L2c5rWBXG4gICAgICAgIGlmIChpbnRlcnZlbnRpb24uc291cmNlVHlwZSA9PT0gJ29wcycpIHtcbiAgICAgICAgICBjb25zdCB3b3JrZmxvdyA9IGJ1aWxkSW5jaWRlbnRXb3JrZmxvdyhcbiAgICAgICAgICAgIGludGVydmVudGlvbixcbiAgICAgICAgICAgIGBpbmNpZGVudF8ke2ludGVydmVudGlvbi5zb3VyY2VJZH1gLFxuICAgICAgICAgICAgaW50ZXJ2ZW50aW9uLnNvdXJjZVR5cGVcbiAgICAgICAgICApO1xuICAgICAgICAgIHRoaXMud29ya2Zsb3dzLnNldCh3b3JrZmxvdy5pZCwgd29ya2Zsb3cpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaehOW7uuW/q+eFp1xuICAgIHJldHVybiB0aGlzLmJ1aWxkU25hcHNob3Qobm93KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWkhOeQhuaOp+WItumdouW/q+eFp1xuICAgKi9cbiAgcHJvY2Vzc0NvbnRyb2xTdXJmYWNlU25hcHNob3QoY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90KTogSHVtYW5Mb29wU25hcHNob3Qge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g5Li65Y+v55So5Yqo5L2c5Yib5bu656Gu6K6kXG4gICAgZm9yIChjb25zdCBhY3Rpb24gb2YgY29udHJvbFNuYXBzaG90LmF2YWlsYWJsZUFjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGd1aWRlZEFjdGlvbiA9IHtcbiAgICAgICAgaWQ6IGFjdGlvbi50eXBlLFxuICAgICAgICBhY3Rpb25UeXBlOiBhY3Rpb24udHlwZSxcbiAgICAgICAgbGFiZWw6IGFjdGlvbi50eXBlLFxuICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiB0cnVlLFxuICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nIGFzIGNvbnN0LFxuICAgICAgICBwYXJhbXM6IGFjdGlvbixcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbmZpcm1hdGlvbiA9IGNyZWF0ZUNvbmZpcm1hdGlvbihcbiAgICAgICAgZ3VpZGVkQWN0aW9uLFxuICAgICAgICBhY3Rpb24udGFyZ2V0SWQsXG4gICAgICAgIGFjdGlvbi50YXJnZXRUeXBlXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoY29uZmlybWF0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uZmlybWF0aW9ucy5zZXQoY29uZmlybWF0aW9uLmFjdGlvbklkLCBjb25maXJtYXRpb24pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmnoTlu7rlv6vnhafvvIjpnIDopoEgZGFzaGJvYXJk77yM6L+Z6YeM566A5YyW77yJXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRTbmFwc2hvdChub3cpO1xuICB9XG4gIFxuICAvKipcbiAgICog56Gu6K6k5Yqo5L2cXG4gICAqL1xuICBjb25maXJtQWN0aW9uKFxuICAgIGFjdGlvbklkOiBzdHJpbmcsXG4gICAgYWN0b3I6IHN0cmluZ1xuICApOiB7IHN1Y2Nlc3M6IGJvb2xlYW47IGNvbmZpcm1hdGlvbj86IEFjdGlvbkNvbmZpcm1hdGlvbjsgZXJyb3I/OiBzdHJpbmcgfSB7XG4gICAgY29uc3QgY29uZmlybWF0aW9uID0gdGhpcy5jb25maXJtYXRpb25zLmdldChhY3Rpb25JZCk7XG4gICAgXG4gICAgaWYgKCFjb25maXJtYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogJ0NvbmZpcm1hdGlvbiBub3QgZm91bmQnLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgY29uZmlybWF0aW9uLnN0YXR1cyA9ICdjb25maXJtZWQnO1xuICAgIFxuICAgIC8vIOiusOW9lei/vei4qlxuICAgIHRoaXMudHJhaWxNYW5hZ2VyLnJlY29yZEFjdGlvbihcbiAgICAgIGBhY3Rpb25fJHthY3Rpb25JZH1gLFxuICAgICAgYWN0b3IsXG4gICAgICAnYWN0aW9uX2NvbmZpcm1lZCcsXG4gICAgICAnYWNjZXB0ZWQnXG4gICAgKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGNvbmZpcm1hdGlvbixcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5ouS57ud5Yqo5L2cXG4gICAqL1xuICByZWplY3RBY3Rpb24oXG4gICAgYWN0aW9uSWQ6IHN0cmluZyxcbiAgICBhY3Rvcjogc3RyaW5nXG4gICk6IHsgc3VjY2VzczogYm9vbGVhbjsgY29uZmlybWF0aW9uPzogQWN0aW9uQ29uZmlybWF0aW9uOyBlcnJvcj86IHN0cmluZyB9IHtcbiAgICBjb25zdCBjb25maXJtYXRpb24gPSB0aGlzLmNvbmZpcm1hdGlvbnMuZ2V0KGFjdGlvbklkKTtcbiAgICBcbiAgICBpZiAoIWNvbmZpcm1hdGlvbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiAnQ29uZmlybWF0aW9uIG5vdCBmb3VuZCcsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBjb25maXJtYXRpb24uc3RhdHVzID0gJ3JlamVjdGVkJztcbiAgICBcbiAgICAvLyDorrDlvZXov73ouKpcbiAgICB0aGlzLnRyYWlsTWFuYWdlci5yZWNvcmRBY3Rpb24oXG4gICAgICBgYWN0aW9uXyR7YWN0aW9uSWR9YCxcbiAgICAgIGFjdG9yLFxuICAgICAgJ2FjdGlvbl9yZWplY3RlZCcsXG4gICAgICAncmVqZWN0ZWQnXG4gICAgKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGNvbmZpcm1hdGlvbixcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej5Yaz5LuL5YWl6aG5XG4gICAqL1xuICByZXNvbHZlSW50ZXJ2ZW50aW9uKFxuICAgIGludGVydmVudGlvbklkOiBzdHJpbmcsXG4gICAgYWN0b3I6IHN0cmluZyxcbiAgICByZXN1bHQ6ICdyZXNvbHZlZCcgfCAnZGlzbWlzc2VkJyB8ICdlc2NhbGF0ZWQnLFxuICAgIG5vdGU/OiBzdHJpbmdcbiAgKTogeyBzdWNjZXNzOiBib29sZWFuOyBpbnRlcnZlbnRpb24/OiBJbnRlcnZlbnRpb25JdGVtOyBlcnJvcj86IHN0cmluZyB9IHtcbiAgICBjb25zdCBpbnRlcnZlbnRpb24gPSB0aGlzLmludGVydmVudGlvbnMuZ2V0KGludGVydmVudGlvbklkKTtcbiAgICBcbiAgICBpZiAoIWludGVydmVudGlvbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiAnSW50ZXJ2ZW50aW9uIG5vdCBmb3VuZCcsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBpbnRlcnZlbnRpb24uc3RhdHVzID0gcmVzdWx0O1xuICAgIGludGVydmVudGlvbi51cGRhdGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIC8vIOiusOW9lei/vei4qlxuICAgIHRoaXMudHJhaWxNYW5hZ2VyLnJlY29yZFJlc29sdXRpb24oaW50ZXJ2ZW50aW9uSWQsIGFjdG9yLCByZXN1bHQsIG5vdGUpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgaW50ZXJ2ZW50aW9uLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bku4vlhaXpoblcbiAgICovXG4gIGdldEludGVydmVudGlvbihpbnRlcnZlbnRpb25JZDogc3RyaW5nKTogSW50ZXJ2ZW50aW9uSXRlbSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJ2ZW50aW9ucy5nZXQoaW50ZXJ2ZW50aW9uSWQpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5omA5pyJ5byA5pS+5LuL5YWl6aG5XG4gICAqL1xuICBnZXRPcGVuSW50ZXJ2ZW50aW9ucygpOiBJbnRlcnZlbnRpb25JdGVtW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuaW50ZXJ2ZW50aW9ucy52YWx1ZXMoKSlcbiAgICAgIC5maWx0ZXIoaSA9PiBpLnN0YXR1cyA9PT0gJ29wZW4nIHx8IGkuc3RhdHVzID09PSAnYWNrbm93bGVkZ2VkJyB8fCBpLnN0YXR1cyA9PT0gJ2luX3JldmlldycpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5bu66K6uXG4gICAqL1xuICBnZXRTdWdnZXN0aW9ucygpOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5zdWdnZXN0aW9ucy52YWx1ZXMoKSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blvoXnoa7orqTliqjkvZxcbiAgICovXG4gIGdldFBlbmRpbmdDb25maXJtYXRpb25zKCk6IEFjdGlvbkNvbmZpcm1hdGlvbltdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmNvbmZpcm1hdGlvbnMudmFsdWVzKCkpXG4gICAgICAuZmlsdGVyKGMgPT4gYy5zdGF0dXMgPT09ICdwZW5kaW5nJyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blt6XkvZzmtYFcbiAgICovXG4gIGdldFdvcmtmbG93cygpOiBXb3JrZmxvd1N0YXRlW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMud29ya2Zsb3dzLnZhbHVlcygpKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPlui/vei4quiusOW9lVxuICAgKi9cbiAgZ2V0VHJhaWwobGltaXQ/OiBudW1iZXIpOiBJbnRlcnZlbnRpb25UcmFpbEVudHJ5W10ge1xuICAgIHJldHVybiB0aGlzLnRyYWlsTWFuYWdlci5nZXRSZWNlbnRUcmFpbChsaW1pdCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rkurrmnLrljY/lkIzlv6vnhadcbiAgICovXG4gIGJ1aWxkU25hcHNob3Qobm93OiBudW1iZXIpOiBIdW1hbkxvb3BTbmFwc2hvdCB7XG4gICAgY29uc3Qgb3BlbkludGVydmVudGlvbnMgPSB0aGlzLmdldE9wZW5JbnRlcnZlbnRpb25zKCk7XG4gICAgY29uc3QgcGVuZGluZ0NvbmZpcm1hdGlvbnMgPSB0aGlzLmdldFBlbmRpbmdDb25maXJtYXRpb25zKCk7XG4gICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSB0aGlzLmdldFN1Z2dlc3Rpb25zKCk7XG4gICAgY29uc3Qgd29ya2Zsb3dzID0gdGhpcy5nZXRXb3JrZmxvd3MoKTtcbiAgICBjb25zdCB0cmFpbCA9IHRoaXMuZ2V0VHJhaWwoNTApO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzbmFwc2hvdElkOiBgaHVtYW5sb29wXyR7bm93fWAsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIG9wZW5JbnRlcnZlbnRpb25zLFxuICAgICAgcXVldWVkQ29uZmlybWF0aW9uczogcGVuZGluZ0NvbmZpcm1hdGlvbnMsXG4gICAgICBzdWdnZXN0aW9ucyxcbiAgICAgIHdvcmtmbG93cyxcbiAgICAgIHRyYWlsLFxuICAgICAgc3VtbWFyeToge1xuICAgICAgICBvcGVuQ291bnQ6IG9wZW5JbnRlcnZlbnRpb25zLmxlbmd0aCxcbiAgICAgICAgY3JpdGljYWxDb3VudDogb3BlbkludGVydmVudGlvbnMuZmlsdGVyKGkgPT4gaS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJykubGVuZ3RoLFxuICAgICAgICBwZW5kaW5nQ29uZmlybWF0aW9uczogcGVuZGluZ0NvbmZpcm1hdGlvbnMubGVuZ3RoLFxuICAgICAgICBlc2NhbGF0ZWRDb3VudDogb3BlbkludGVydmVudGlvbnMuZmlsdGVyKGkgPT4gaS5zdGF0dXMgPT09ICdlc2NhbGF0ZWQnKS5sZW5ndGgsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu65Lq65py65Y2P5ZCM5pyN5YqhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIdW1hbkxvb3BTZXJ2aWNlKGNvbmZpZz86IEh1bWFuTG9vcFNlcnZpY2VDb25maWcpOiBIdW1hbkxvb3BTZXJ2aWNlIHtcbiAgcmV0dXJuIG5ldyBIdW1hbkxvb3BTZXJ2aWNlKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5aSE55CG5Luq6KGo55uY5b+r54WnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzRGFzaGJvYXJkU25hcHNob3QoXG4gIGRhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3QsXG4gIGNvbmZpZz86IEh1bWFuTG9vcFNlcnZpY2VDb25maWdcbik6IEh1bWFuTG9vcFNuYXBzaG90IHtcbiAgY29uc3Qgc2VydmljZSA9IG5ldyBIdW1hbkxvb3BTZXJ2aWNlKGNvbmZpZyk7XG4gIHJldHVybiBzZXJ2aWNlLnByb2Nlc3NEYXNoYm9hcmRTbmFwc2hvdChkYXNoYm9hcmQpO1xufVxuIl19