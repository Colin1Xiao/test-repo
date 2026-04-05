"use strict";
/**
 * Incident Workflow - 事件工作流
 *
 * 职责：
 * 1. 定义 incident 的人工处理工作流
 * 2. 支持 ack / inspect / choose recovery option / request replay or recovery / escalate / resolve or keep open
 * 3. 关键是让 incident 处理成为有步骤、有上下文、有追踪的流程
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentWorkflowBuilder = void 0;
exports.createIncidentWorkflowBuilder = createIncidentWorkflowBuilder;
exports.buildIncidentWorkflow = buildIncidentWorkflow;
// ============================================================================
// 事件工作流构建器
// ============================================================================
class IncidentWorkflowBuilder {
    /**
     * 构建事件工作流
     */
    buildIncidentWorkflow(intervention, incidentId, incidentType) {
        const now = Date.now();
        const steps = [
            {
                id: 'step_ack',
                name: 'Acknowledge',
                description: 'Acknowledge the incident',
                completed: false,
            },
            {
                id: 'step_inspect',
                name: 'Inspect',
                description: 'Inspect incident details and logs',
                completed: false,
            },
            {
                id: 'step_recovery',
                name: 'Choose Recovery',
                description: 'Choose recovery option',
                completed: false,
            },
            {
                id: 'step_resolve',
                name: 'Resolve',
                description: 'Resolve or keep open',
                completed: false,
            },
        ];
        return {
            id: `incident_workflow_${incidentId}`,
            type: 'incident',
            currentStepId: 'step_ack',
            steps,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            incidentId,
            incidentType,
            summary: intervention.summary,
            severity: intervention.severity,
            acknowledged: false,
        };
    }
    /**
     * 更新工作流步骤
     */
    updateWorkflowStep(workflow, stepId, completed, result) {
        const updatedSteps = workflow.steps.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    completed,
                    completedAt: completed ? Date.now() : undefined,
                    result,
                };
            }
            return step;
        });
        // 确定当前步骤
        let currentStepId = workflow.currentStepId;
        let status = workflow.status;
        let acknowledged = workflow.acknowledged;
        let acknowledgedBy;
        let acknowledgedAt;
        if (completed) {
            const currentIndex = updatedSteps.findIndex(s => s.id === stepId);
            const nextStep = updatedSteps[currentIndex + 1];
            if (nextStep) {
                currentStepId = nextStep.id;
            }
            else {
                status = 'completed';
            }
            // 如果是确认步骤
            if (stepId === 'step_ack') {
                acknowledged = true;
                acknowledgedBy = 'operator'; // 简化实现
                acknowledgedAt = Date.now();
            }
        }
        return {
            ...workflow,
            steps: updatedSteps,
            currentStepId,
            status,
            acknowledged,
            acknowledgedBy,
            acknowledgedAt,
            updatedAt: Date.now(),
        };
    }
    /**
     * 生成事件引导动作
     */
    generateGuidedActions(workflow) {
        const actions = [];
        // 根据当前步骤生成动作
        if (workflow.currentStepId === 'step_ack') {
            actions.push({
                id: 'acknowledge',
                actionType: 'ack_incident',
                label: 'Acknowledge Incident',
                description: 'Acknowledge this incident and take ownership',
                recommended: true,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Incident will be assigned to you',
            });
        }
        if (workflow.currentStepId === 'step_inspect') {
            actions.push({
                id: 'view_details',
                actionType: 'view_details',
                label: 'View Details',
                description: 'View full incident details and logs',
                recommended: true,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Full incident details will be displayed',
            }, {
                id: 'view_logs',
                actionType: 'view_logs',
                label: 'View Logs',
                description: 'View related logs and metrics',
                recommended: false,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Related logs and metrics will be displayed',
            });
        }
        if (workflow.currentStepId === 'step_recovery') {
            actions.push({
                id: 'request_recovery',
                actionType: 'request_recovery',
                label: 'Request Recovery',
                description: 'Request automatic recovery',
                recommended: true,
                requiresConfirmation: true,
                riskLevel: 'low',
                expectedOutcome: 'System will attempt to recover automatically',
            }, {
                id: 'request_replay',
                actionType: 'request_replay',
                label: 'Request Replay',
                description: 'Request task replay',
                recommended: false,
                requiresConfirmation: true,
                riskLevel: 'medium',
                expectedOutcome: 'Affected tasks will be replayed',
            }, {
                id: 'manual_recovery',
                actionType: 'manual_recovery',
                label: 'Manual Recovery',
                description: 'Perform manual recovery steps',
                recommended: false,
                requiresConfirmation: true,
                riskLevel: 'high',
                expectedOutcome: 'Manual recovery steps will be guided',
            });
        }
        if (workflow.currentStepId === 'step_resolve') {
            actions.push({
                id: 'resolve',
                actionType: 'resolve_incident',
                label: 'Resolve',
                description: 'Mark incident as resolved',
                recommended: true,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Incident will be marked as resolved',
            }, {
                id: 'keep_open',
                actionType: 'keep_open',
                label: 'Keep Open',
                description: 'Keep incident open for further investigation',
                recommended: false,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Incident will remain open',
            }, {
                id: 'escalate',
                actionType: 'escalate',
                label: 'Escalate',
                description: 'Escalate to higher level support',
                recommended: false,
                requiresConfirmation: true,
                riskLevel: 'medium',
                expectedOutcome: 'Incident will be escalated',
            });
        }
        return actions;
    }
    /**
     * 生成事件恢复选项
     */
    generateRecoveryOptions(workflow) {
        const options = [
            {
                id: 'auto_recovery',
                name: 'Automatic Recovery',
                description: 'System will attempt automatic recovery',
                riskLevel: 'low',
                estimatedTime: '1-5 minutes',
                successRate: 0.8,
            },
            {
                id: 'task_replay',
                name: 'Task Replay',
                description: 'Replay affected tasks from last known good state',
                riskLevel: 'medium',
                estimatedTime: '5-15 minutes',
                successRate: 0.7,
            },
            {
                id: 'manual_recovery',
                name: 'Manual Recovery',
                description: 'Perform manual recovery steps with guidance',
                riskLevel: 'high',
                estimatedTime: '15-60 minutes',
                successRate: 0.9,
            },
        ];
        // 根据事件类型过滤选项
        if (workflow.incidentType === 'server_degraded') {
            return options;
        }
        if (workflow.incidentType === 'task_failure') {
            return options.filter(o => o.id !== 'auto_recovery');
        }
        return options;
    }
}
exports.IncidentWorkflowBuilder = IncidentWorkflowBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建事件工作流构建器
 */
function createIncidentWorkflowBuilder() {
    return new IncidentWorkflowBuilder();
}
/**
 * 快速构建事件工作流
 */
function buildIncidentWorkflow(intervention, incidentId, incidentType) {
    const builder = new IncidentWorkflowBuilder();
    return builder.buildIncidentWorkflow(intervention, incidentId, incidentType);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jaWRlbnRfd29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvaW5jaWRlbnRfd29ya2Zsb3cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQTJVSCxzRUFFQztBQUtELHNEQU9DO0FBbFRELCtFQUErRTtBQUMvRSxXQUFXO0FBQ1gsK0VBQStFO0FBRS9FLE1BQWEsdUJBQXVCO0lBQ2xDOztPQUVHO0lBQ0gscUJBQXFCLENBQ25CLFlBQThCLEVBQzlCLFVBQWtCLEVBQ2xCLFlBQW9CO1FBRXBCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUV2QixNQUFNLEtBQUssR0FBbUI7WUFDNUI7Z0JBQ0UsRUFBRSxFQUFFLFVBQVU7Z0JBQ2QsSUFBSSxFQUFFLGFBQWE7Z0JBQ25CLFdBQVcsRUFBRSwwQkFBMEI7Z0JBQ3ZDLFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLGNBQWM7Z0JBQ2xCLElBQUksRUFBRSxTQUFTO2dCQUNmLFdBQVcsRUFBRSxtQ0FBbUM7Z0JBQ2hELFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLGVBQWU7Z0JBQ25CLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLFdBQVcsRUFBRSx3QkFBd0I7Z0JBQ3JDLFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLGNBQWM7Z0JBQ2xCLElBQUksRUFBRSxTQUFTO2dCQUNmLFdBQVcsRUFBRSxzQkFBc0I7Z0JBQ25DLFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1NBQ0YsQ0FBQztRQUVGLE9BQU87WUFDTCxFQUFFLEVBQUUscUJBQXFCLFVBQVUsRUFBRTtZQUNyQyxJQUFJLEVBQUUsVUFBVTtZQUNoQixhQUFhLEVBQUUsVUFBVTtZQUN6QixLQUFLO1lBQ0wsTUFBTSxFQUFFLFFBQVE7WUFDaEIsU0FBUyxFQUFFLEdB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SSx1QkFBdUIsRUFBRSxDQUFDO0lBQzlDLE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDL0UsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSW5jaWRlbnQgV29ya2Zsb3cgLSDkuovku7blt6XkvZzmtYFcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDlrprkuYkgaW5jaWRlbnQg55qE5Lq65bel5aSE55CG5bel5L2c5rWBXG4gKiAyLiDmlK/mjIEgYWNrIC8gaW5zcGVjdCAvIGNob29zZSByZWNvdmVyeSBvcHRpb24gLyByZXF1ZXN0IHJlcGxheSBvciByZWNvdmVyeSAvIGVzY2FsYXRlIC8gcmVzb2x2ZSBvciBrZWVwIG9wZW5cbiAqIDMuIOWFs+mUruaYr+iuqSBpbmNpZGVudCDlpITnkIbmiJDkuLrmnInmraXpqqTjgIHmnInkuIrkuIvmlofjgIHmnInov73ouKrnmoTmtYHnqItcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTA0XG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBJbnRlcnZlbnRpb25JdGVtLFxuICBHdWlkZWRBY3Rpb24sXG4gIFdvcmtmbG93U3RhdGUsXG4gIFdvcmtmbG93U3RlcCxcbn0gZnJvbSAnLi9oaXRsX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5LqL5Lu25bel5L2c5rWB54q25oCBXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5jaWRlbnRXb3JrZmxvd1N0YXRlIGV4dGVuZHMgV29ya2Zsb3dTdGF0ZSB7XG4gIC8qKiDkuovku7YgSUQgKi9cbiAgaW5jaWRlbnRJZDogc3RyaW5nO1xuICBcbiAgLyoqIOS6i+S7tuexu+WeiyAqL1xuICBpbmNpZGVudFR5cGU6IHN0cmluZztcbiAgXG4gIC8qKiDkuovku7bmkZjopoEgKi9cbiAgc3VtbWFyeTogc3RyaW5nO1xuICBcbiAgLyoqIOS4pemHjee6p+WIqyAqL1xuICBzZXZlcml0eTogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB8ICdjcml0aWNhbCc7XG4gIFxuICAvKiog5bey56Gu6K6kICovXG4gIGFja25vd2xlZGdlZDogYm9vbGVhbjtcbiAgXG4gIC8qKiDnoa7orqTogIXvvIjlj6/pgInvvIkgKi9cbiAgYWNrbm93bGVkZ2VkQnk/OiBzdHJpbmc7XG4gIFxuICAvKiog56Gu6K6k5pe26Ze077yI5Y+v6YCJ77yJICovXG4gIGFja25vd2xlZGdlZEF0PzogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkuovku7blt6XkvZzmtYHmnoTlu7rlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEluY2lkZW50V29ya2Zsb3dCdWlsZGVyIHtcbiAgLyoqXG4gICAqIOaehOW7uuS6i+S7tuW3peS9nOa1gVxuICAgKi9cbiAgYnVpbGRJbmNpZGVudFdvcmtmbG93KFxuICAgIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbSxcbiAgICBpbmNpZGVudElkOiBzdHJpbmcsXG4gICAgaW5jaWRlbnRUeXBlOiBzdHJpbmdcbiAgKTogSW5jaWRlbnRXb3JrZmxvd1N0YXRlIHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGNvbnN0IHN0ZXBzOiBXb3JrZmxvd1N0ZXBbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdzdGVwX2FjaycsXG4gICAgICAgIG5hbWU6ICdBY2tub3dsZWRnZScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWNrbm93bGVkZ2UgdGhlIGluY2lkZW50JyxcbiAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAnc3RlcF9pbnNwZWN0JyxcbiAgICAgICAgbmFtZTogJ0luc3BlY3QnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0luc3BlY3QgaW5jaWRlbnQgZGV0YWlscyBhbmQgbG9ncycsXG4gICAgICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogJ3N0ZXBfcmVjb3ZlcnknLFxuICAgICAgICBuYW1lOiAnQ2hvb3NlIFJlY292ZXJ5JyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDaG9vc2UgcmVjb3Zlcnkgb3B0aW9uJyxcbiAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAnc3RlcF9yZXNvbHZlJyxcbiAgICAgICAgbmFtZTogJ1Jlc29sdmUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1Jlc29sdmUgb3Iga2VlcCBvcGVuJyxcbiAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGBpbmNpZGVudF93b3JrZmxvd18ke2luY2lkZW50SWR9YCxcbiAgICAgIHR5cGU6ICdpbmNpZGVudCcsXG4gICAgICBjdXJyZW50U3RlcElkOiAnc3RlcF9hY2snLFxuICAgICAgc3RlcHMsXG4gICAgICBzdGF0dXM6ICdhY3RpdmUnLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICAgIGluY2lkZW50SWQsXG4gICAgICBpbmNpZGVudFR5cGUsXG4gICAgICBzdW1tYXJ5OiBpbnRlcnZlbnRpb24uc3VtbWFyeSxcbiAgICAgIHNldmVyaXR5OiBpbnRlcnZlbnRpb24uc2V2ZXJpdHksXG4gICAgICBhY2tub3dsZWRnZWQ6IGZhbHNlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmm7TmlrDlt6XkvZzmtYHmraXpqqRcbiAgICovXG4gIHVwZGF0ZVdvcmtmbG93U3RlcChcbiAgICB3b3JrZmxvdzogSW5jaWRlbnRXb3JrZmxvd1N0YXRlLFxuICAgIHN0ZXBJZDogc3RyaW5nLFxuICAgIGNvbXBsZXRlZDogYm9vbGVhbixcbiAgICByZXN1bHQ/OiBzdHJpbmdcbiAgKTogSW5jaWRlbnRXb3JrZmxvd1N0YXRlIHtcbiAgICBjb25zdCB1cGRhdGVkU3RlcHMgPSB3b3JrZmxvdy5zdGVwcy5tYXAoc3RlcCA9PiB7XG4gICAgICBpZiAoc3RlcC5pZCA9PT0gc3RlcElkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4uc3RlcCxcbiAgICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgICAgY29tcGxldGVkQXQ6IGNvbXBsZXRlZCA/IERhdGUubm93KCkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcmVzdWx0LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0ZXA7XG4gICAgfSk7XG4gICAgXG4gICAgLy8g56Gu5a6a5b2T5YmN5q2l6aqkXG4gICAgbGV0IGN1cnJlbnRTdGVwSWQgPSB3b3JrZmxvdy5jdXJyZW50U3RlcElkO1xuICAgIGxldCBzdGF0dXMgPSB3b3JrZmxvdy5zdGF0dXM7XG4gICAgbGV0IGFja25vd2xlZGdlZCA9IHdvcmtmbG93LmFja25vd2xlZGdlZDtcbiAgICBsZXQgYWNrbm93bGVkZ2VkQnk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBsZXQgYWNrbm93bGVkZ2VkQXQ6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgICBcbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICBjb25zdCBjdXJyZW50SW5kZXggPSB1cGRhdGVkU3RlcHMuZmluZEluZGV4KHMgPT4gcy5pZCA9PT0gc3RlcElkKTtcbiAgICAgIGNvbnN0IG5leHRTdGVwID0gdXBkYXRlZFN0ZXBzW2N1cnJlbnRJbmRleCArIDFdO1xuICAgICAgXG4gICAgICBpZiAobmV4dFN0ZXApIHtcbiAgICAgICAgY3VycmVudFN0ZXBJZCA9IG5leHRTdGVwLmlkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOWmguaenOaYr+ehruiupOatpemqpFxuICAgICAgaWYgKHN0ZXBJZCA9PT0gJ3N0ZXBfYWNrJykge1xuICAgICAgICBhY2tub3dsZWRnZWQgPSB0cnVlO1xuICAgICAgICBhY2tub3dsZWRnZWRCeSA9ICdvcGVyYXRvcic7IC8vIOeugOWMluWunueOsFxuICAgICAgICBhY2tub3dsZWRnZWRBdCA9IERhdGUubm93KCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi53b3JrZmxvdyxcbiAgICAgIHN0ZXBzOiB1cGRhdGVkU3RlcHMsXG4gICAgICBjdXJyZW50U3RlcElkLFxuICAgICAgc3RhdHVzLFxuICAgICAgYWNrbm93bGVkZ2VkLFxuICAgICAgYWNrbm93bGVkZ2VkQnksXG4gICAgICBhY2tub3dsZWRnZWRBdCxcbiAgICAgIHVwZGF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5LqL5Lu25byV5a+85Yqo5L2cXG4gICAqL1xuICBnZW5lcmF0ZUd1aWRlZEFjdGlvbnMod29ya2Zsb3c6IEluY2lkZW50V29ya2Zsb3dTdGF0ZSk6IEd1aWRlZEFjdGlvbltdIHtcbiAgICBjb25zdCBhY3Rpb25zOiBHdWlkZWRBY3Rpb25bXSA9IFtdO1xuICAgIFxuICAgIC8vIOagueaNruW9k+WJjeatpemqpOeUn+aIkOWKqOS9nFxuICAgIGlmICh3b3JrZmxvdy5jdXJyZW50U3RlcElkID09PSAnc3RlcF9hY2snKSB7XG4gICAgICBhY3Rpb25zLnB1c2goe1xuICAgICAgICBpZDogJ2Fja25vd2xlZGdlJyxcbiAgICAgICAgYWN0aW9uVHlwZTogJ2Fja19pbmNpZGVudCcsXG4gICAgICAgIGxhYmVsOiAnQWNrbm93bGVkZ2UgSW5jaWRlbnQnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Fja25vd2xlZGdlIHRoaXMgaW5jaWRlbnQgYW5kIHRha2Ugb3duZXJzaGlwJyxcbiAgICAgICAgcmVjb21tZW5kZWQ6IHRydWUsXG4gICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiBmYWxzZSxcbiAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnSW5jaWRlbnQgd2lsbCBiZSBhc3NpZ25lZCB0byB5b3UnLFxuICAgICAgfSBhcyBHdWlkZWRBY3Rpb24pO1xuICAgIH1cbiAgICBcbiAgICBpZiAod29ya2Zsb3cuY3VycmVudFN0ZXBJZCA9PT0gJ3N0ZXBfaW5zcGVjdCcpIHtcbiAgICAgIGFjdGlvbnMucHVzaChcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAndmlld19kZXRhaWxzJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAndmlld19kZXRhaWxzJyxcbiAgICAgICAgICBsYWJlbDogJ1ZpZXcgRGV0YWlscycsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdWaWV3IGZ1bGwgaW5jaWRlbnQgZGV0YWlscyBhbmQgbG9ncycsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnRnVsbCBpbmNpZGVudCBkZXRhaWxzIHdpbGwgYmUgZGlzcGxheWVkJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3ZpZXdfbG9ncycsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfbG9ncycsXG4gICAgICAgICAgbGFiZWw6ICdWaWV3IExvZ3MnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVmlldyByZWxhdGVkIGxvZ3MgYW5kIG1ldHJpY3MnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogZmFsc2UsXG4gICAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgICBleHBlY3RlZE91dGNvbWU6ICdSZWxhdGVkIGxvZ3MgYW5kIG1ldHJpY3Mgd2lsbCBiZSBkaXNwbGF5ZWQnLFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvblxuICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHdvcmtmbG93LmN1cnJlbnRTdGVwSWQgPT09ICdzdGVwX3JlY292ZXJ5Jykge1xuICAgICAgYWN0aW9ucy5wdXNoKFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3JlY292ZXJ5JyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZWNvdmVyeScsXG4gICAgICAgICAgbGFiZWw6ICdSZXF1ZXN0IFJlY292ZXJ5JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlcXVlc3QgYXV0b21hdGljIHJlY292ZXJ5JyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdsb3cnLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ1N5c3RlbSB3aWxsIGF0dGVtcHQgdG8gcmVjb3ZlciBhdXRvbWF0aWNhbGx5JyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3JlcXVlc3RfcmVwbGF5JyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZXBsYXknLFxuICAgICAgICAgIGxhYmVsOiAnUmVxdWVzdCBSZXBsYXknLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmVxdWVzdCB0YXNrIHJlcGxheScsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiB0cnVlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnQWZmZWN0ZWQgdGFza3Mgd2lsbCBiZSByZXBsYXllZCcsXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uLFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdtYW51YWxfcmVjb3ZlcnknLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdtYW51YWxfcmVjb3ZlcnknLFxuICAgICAgICAgIGxhYmVsOiAnTWFudWFsIFJlY292ZXJ5JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BlcmZvcm0gbWFudWFsIHJlY292ZXJ5IHN0ZXBzJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IHRydWUsXG4gICAgICAgICAgcmlza0xldmVsOiAnaGlnaCcsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnTWFudWFsIHJlY292ZXJ5IHN0ZXBzIHdpbGwgYmUgZ3VpZGVkJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb25cbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIGlmICh3b3JrZmxvdy5jdXJyZW50U3RlcElkID09PSAnc3RlcF9yZXNvbHZlJykge1xuICAgICAgYWN0aW9ucy5wdXNoKFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZXNvbHZlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVzb2x2ZV9pbmNpZGVudCcsXG4gICAgICAgICAgbGFiZWw6ICdSZXNvbHZlJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ01hcmsgaW5jaWRlbnQgYXMgcmVzb2x2ZWQnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiBmYWxzZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdsb3cnLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ0luY2lkZW50IHdpbGwgYmUgbWFya2VkIGFzIHJlc29sdmVkJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2tlZXBfb3BlbicsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2tlZXBfb3BlbicsXG4gICAgICAgICAgbGFiZWw6ICdLZWVwIE9wZW4nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBpbmNpZGVudCBvcGVuIGZvciBmdXJ0aGVyIGludmVzdGlnYXRpb24nLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogZmFsc2UsXG4gICAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgICBleHBlY3RlZE91dGNvbWU6ICdJbmNpZGVudCB3aWxsIHJlbWFpbiBvcGVuJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2VzY2FsYXRlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnZXNjYWxhdGUnLFxuICAgICAgICAgIGxhYmVsOiAnRXNjYWxhdGUnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXNjYWxhdGUgdG8gaGlnaGVyIGxldmVsIHN1cHBvcnQnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ0luY2lkZW50IHdpbGwgYmUgZXNjYWxhdGVkJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb25cbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhY3Rpb25zO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5LqL5Lu25oGi5aSN6YCJ6aG5XG4gICAqL1xuICBnZW5lcmF0ZVJlY292ZXJ5T3B0aW9ucyh3b3JrZmxvdzogSW5jaWRlbnRXb3JrZmxvd1N0YXRlKTogQXJyYXk8e1xuICAgIGlkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgcmlza0xldmVsOiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnO1xuICAgIGVzdGltYXRlZFRpbWU6IHN0cmluZztcbiAgICBzdWNjZXNzUmF0ZTogbnVtYmVyO1xuICB9PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdhdXRvX3JlY292ZXJ5JyxcbiAgICAgICAgbmFtZTogJ0F1dG9tYXRpYyBSZWNvdmVyeScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU3lzdGVtIHdpbGwgYXR0ZW1wdCBhdXRvbWF0aWMgcmVjb3ZlcnknLFxuICAgICAgICByaXNrTGV2ZWw6ICdsb3cnIGFzIGNvbnN0LFxuICAgICAgICBlc3RpbWF0ZWRUaW1lOiAnMS01IG1pbnV0ZXMnLFxuICAgICAgICBzdWNjZXNzUmF0ZTogMC44LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICd0YXNrX3JlcGxheScsXG4gICAgICAgIG5hbWU6ICdUYXNrIFJlcGxheScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUmVwbGF5IGFmZmVjdGVkIHRhc2tzIGZyb20gbGFzdCBrbm93biBnb29kIHN0YXRlJyxcbiAgICAgICAgcmlza0xldmVsOiAnbWVkaXVtJyBhcyBjb25zdCxcbiAgICAgICAgZXN0aW1hdGVkVGltZTogJzUtMTUgbWludXRlcycsXG4gICAgICAgIHN1Y2Nlc3NSYXRlOiAwLjcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogJ21hbnVhbF9yZWNvdmVyeScsXG4gICAgICAgIG5hbWU6ICdNYW51YWwgUmVjb3ZlcnknLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1BlcmZvcm0gbWFudWFsIHJlY292ZXJ5IHN0ZXBzIHdpdGggZ3VpZGFuY2UnLFxuICAgICAgICByaXNrTGV2ZWw6ICdoaWdoJyBhcyBjb25zdCxcbiAgICAgICAgZXN0aW1hdGVkVGltZTogJzE1LTYwIG1pbnV0ZXMnLFxuICAgICAgICBzdWNjZXNzUmF0ZTogMC45LFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIC8vIOagueaNruS6i+S7tuexu+Wei+i/h+a7pOmAiemhuVxuICAgIGlmICh3b3JrZmxvdy5pbmNpZGVudFR5cGUgPT09ICdzZXJ2ZXJfZGVncmFkZWQnKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9XG4gICAgXG4gICAgaWYgKHdvcmtmbG93LmluY2lkZW50VHlwZSA9PT0gJ3Rhc2tfZmFpbHVyZScpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmZpbHRlcihvID0+IG8uaWQgIT09ICdhdXRvX3JlY292ZXJ5Jyk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuS6i+S7tuW3peS9nOa1geaehOW7uuWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5jaWRlbnRXb3JrZmxvd0J1aWxkZXIoKTogSW5jaWRlbnRXb3JrZmxvd0J1aWxkZXIge1xuICByZXR1cm4gbmV3IEluY2lkZW50V29ya2Zsb3dCdWlsZGVyKCk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu65LqL5Lu25bel5L2c5rWBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEluY2lkZW50V29ya2Zsb3coXG4gIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbSxcbiAgaW5jaWRlbnRJZDogc3RyaW5nLFxuICBpbmNpZGVudFR5cGU6IHN0cmluZ1xuKTogSW5jaWRlbnRXb3JrZmxvd1N0YXRlIHtcbiAgY29uc3QgYnVpbGRlciA9IG5ldyBJbmNpZGVudFdvcmtmbG93QnVpbGRlcigpO1xuICByZXR1cm4gYnVpbGRlci5idWlsZEluY2lkZW50V29ya2Zsb3coaW50ZXJ2ZW50aW9uLCBpbmNpZGVudElkLCBpbmNpZGVudFR5cGUpO1xufVxuIl19