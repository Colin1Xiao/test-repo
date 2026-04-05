"use strict";
/**
 * Approval Workflow - 审批工作流
 *
 * 职责：
 * 1. 做 guided approvals，不只是 approve/reject 按钮
 * 2. 支持审批摘要/风险说明/建议结论/升级审批/请求更多上下文/暂缓处理/批量审批策略
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalWorkflowBuilder = void 0;
exports.createApprovalWorkflowBuilder = createApprovalWorkflowBuilder;
exports.buildApprovalWorkflow = buildApprovalWorkflow;
// ============================================================================
// 审批工作流构建器
// ============================================================================
class ApprovalWorkflowBuilder {
    /**
     * 构建审批工作流
     */
    buildApprovalWorkflow(intervention, approvalId, approvalType, requester) {
        const now = Date.now();
        const steps = [
            {
                id: 'step_review',
                name: 'Review Request',
                description: 'Review the approval request details',
                completed: false,
            },
            {
                id: 'step_assess_risk',
                name: 'Assess Risk',
                description: 'Assess the risk and impact of this request',
                completed: false,
            },
            {
                id: 'step_decide',
                name: 'Make Decision',
                description: 'Approve, reject, or request more context',
                completed: false,
            },
        ];
        return {
            id: `approval_workflow_${approvalId}`,
            type: 'approval',
            currentStepId: 'step_review',
            steps,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            approvalId,
            approvalType,
            requester,
            summary: intervention.summary,
            riskSummary: this.generateRiskSummary(intervention),
            recommendedDecision: this.getRecommendedDecision(intervention),
            escalateTo: intervention.escalateTo,
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
        if (completed) {
            const currentIndex = updatedSteps.findIndex(s => s.id === stepId);
            const nextStep = updatedSteps[currentIndex + 1];
            if (nextStep) {
                currentStepId = nextStep.id;
            }
            else {
                status = 'completed';
            }
        }
        return {
            ...workflow,
            steps: updatedSteps,
            currentStepId,
            status,
            updatedAt: Date.now(),
        };
    }
    /**
     * 生成审批引导动作
     */
    generateGuidedActions(workflow) {
        const actions = [];
        // 根据当前步骤生成动作
        if (workflow.currentStepId === 'step_review') {
            actions.push({
                id: 'view_details',
                actionType: 'view_details',
                label: 'View Details',
                description: 'View full approval request details',
                recommended: true,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Full request details will be displayed',
            }, {
                id: 'request_context',
                actionType: 'request_context',
                label: 'Request More Context',
                description: 'Request additional information from requester',
                recommended: false,
                requiresConfirmation: false,
                riskLevel: 'low',
                expectedOutcome: 'Requester will be notified to provide more information',
            });
        }
        if (workflow.currentStepId === 'step_assess_risk' || workflow.currentStepId === 'step_decide') {
            actions.push({
                id: 'approve',
                actionType: 'approve',
                label: 'Approve',
                description: 'Approve this request',
                recommended: workflow.recommendedDecision === 'approve',
                requiresConfirmation: true,
                riskLevel: 'low',
                expectedOutcome: 'Request will be approved and execution will continue',
            }, {
                id: 'reject',
                actionType: 'reject',
                label: 'Reject',
                description: 'Reject this request',
                recommended: workflow.recommendedDecision === 'reject',
                requiresConfirmation: true,
                riskLevel: 'medium',
                expectedOutcome: 'Request will be rejected and related tasks may be cancelled',
            }, {
                id: 'escalate',
                actionType: 'escalate',
                label: 'Escalate',
                description: 'Escalate to higher authority',
                recommended: false,
                requiresConfirmation: true,
                riskLevel: 'medium',
                expectedOutcome: 'Request will be escalated for higher-level review',
            });
        }
        return actions;
    }
    /**
     * 生成批量审批策略
     */
    generateBatchApprovalStrategy(interventions) {
        if (interventions.length === 0) {
            return {
                canBatch: false,
                batchSize: 0,
                strategy: 'review_individual',
                reasoning: 'No interventions to batch',
            };
        }
        // 检查是否可以批量处理
        const allSameType = interventions.every(i => i.sourceType === interventions[0].sourceType);
        const allLowRisk = interventions.every(i => i.severity === 'low' || i.severity === 'medium');
        if (allSameType && allLowRisk && interventions.length <= 10) {
            return {
                canBatch: true,
                batchSize: interventions.length,
                strategy: 'approve_all',
                reasoning: 'All interventions are same type and low risk, can be batch approved',
            };
        }
        return {
            canBatch: false,
            batchSize: 0,
            strategy: 'review_individual',
            reasoning: 'Interventions have mixed types or high risk, require individual review',
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 生成风险摘要
     */
    generateRiskSummary(intervention) {
        const riskMap = {
            low: 'Low risk: This approval has minimal impact.',
            medium: 'Medium risk: This approval may affect related tasks.',
            high: 'High risk: This approval may have significant impact.',
            critical: 'Critical risk: This approval requires careful consideration.',
        };
        return riskMap[intervention.severity] || 'Unknown risk level.';
    }
    /**
     * 获取推荐决策
     */
    getRecommendedDecision(intervention) {
        // 根据严重级别和原因生成推荐
        if (intervention.severity === 'critical') {
            return 'request_context';
        }
        if (intervention.reason.includes('timeout') || intervention.reason.includes('pending')) {
            return 'approve';
        }
        return 'request_context';
    }
}
exports.ApprovalWorkflowBuilder = ApprovalWorkflowBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建审批工作流构建器
 */
function createApprovalWorkflowBuilder() {
    return new ApprovalWorkflowBuilder();
}
/**
 * 快速构建审批工作流
 */
function buildApprovalWorkflow(intervention, approvalId, approvalType, requester) {
    const builder = new ApprovalWorkflowBuilder();
    return builder.buildApprovalWorkflow(intervention, approvalId, approvalType, requester);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwcm92YWxfd29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvYXBwcm92YWxfd29ya2Zsb3cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7R0FTRzs7O0FBcVNILHNFQUVDO0FBS0Qsc0RBUUM7QUE1UUQsK0VBQStFO0FBQy9FLFdBQVc7QUFDWCwrRUFBK0U7QUFFL0UsTUFBYSx1QkFBdUI7SUFDbEM7O09BRUc7SUFDSCxxQkFBcUIsQ0FDbkIsWUFBOEIsRUFDOUIsVUFBa0IsRUFDbEIsWUFBb0IsRUFDcEIsU0FBaUI7UUFFakIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXZCLE1BQU0sS0FBSyxHQUFtQjtZQUM1QjtnQkFDRSxFQUFFLEVBQUUsYUFBYTtnQkFDakIsSUFBSSxFQUFFLGdCQUFnQjtnQkFDdEIsV0FBVyxFQUFFLHFDQUFxQztnQkFDbEQsU0FBUyxFQUFFLEtBQUs7YUFDakI7WUFDRDtnQkFDRSxFQUFFLEVBQUUsa0JBQWtCO2dCQUN0QixJQUFJLEVBQUUsYUFBYTtnQkFDbkIsV0FBVyxFQUFFLDRDQUE0QztnQkFDekQsU0FBUyxFQUFFLEtBQUs7YUFDakI7WUFDRDtnQkFDRSxFQUFFLEVBQUUsYUFBYTtnQkFDakIsSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLFdBQVcsRUFBRSwwQ0FBMEM7Z0JBQ3ZELFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1NBQ0YsQ0FBQztRQUVGLE9BQU87WUFDTCxFQUFFLEVBQUUscUJBQXFCLFVBQVUsRUFBRTtZQUNyQyxJQUFJLEVBQUUsVUFBVTtZQUNoQixhQUFhLEVBQUUsYUFBYTtZQUM1QixLQUFLO1lBQ0wsTUFBTSxFQUFFLFFBQVE7WUFDaEIsU0FBUyxFQUFFLEdBQUc7WUFDZCxTQUFTLEVBQUUsR0FBRztZQUNkLFVBQVU7WUFDVixZQUFZO1lBQ1osU0FBUztZQUNULE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTztZ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Q0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3ZGLE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFFRCxPQUFPLGlCQUFpQixDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQWhQRCwwREFnUEM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLDZCQUE2QjtJQUMzQyxPQUFPLElBQUksdUJBQXVCLEVBQUUsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixxQkFBcUIsQ0FDbkMsWUFBOEIsRUFDOUIsVUFBa0IsRUFDbEIsWUFBb0IsRUFDcEIsU0FBaUI7SUFFakIsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBdUIsRUFBRSxDQUFDO0lBQzlDLE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzFGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFwcHJvdmFsIFdvcmtmbG93IC0g5a6h5om55bel5L2c5rWBXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5YGaIGd1aWRlZCBhcHByb3ZhbHPvvIzkuI3lj6rmmK8gYXBwcm92ZS9yZWplY3Qg5oyJ6ZKuXG4gKiAyLiDmlK/mjIHlrqHmibnmkZjopoEv6aOO6Zmp6K+05piOL+W7uuiurue7k+iuui/ljYfnuqflrqHmibkv6K+35rGC5pu05aSa5LiK5LiL5paHL+aague8k+WkhOeQhi/mibnph4/lrqHmibnnrZbnlaVcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTA0XG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBJbnRlcnZlbnRpb25JdGVtLFxuICBHdWlkZWRBY3Rpb24sXG4gIFdvcmtmbG93U3RhdGUsXG4gIFdvcmtmbG93U3RlcCxcbiAgT3BlcmF0b3JTdWdnZXN0aW9uLFxufSBmcm9tICcuL2hpdGxfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDlrqHmibnlt6XkvZzmtYHnirbmgIFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcHByb3ZhbFdvcmtmbG93U3RhdGUgZXh0ZW5kcyBXb3JrZmxvd1N0YXRlIHtcbiAgLyoqIOWuoeaJuSBJRCAqL1xuICBhcHByb3ZhbElkOiBzdHJpbmc7XG4gIFxuICAvKiog5a6h5om557G75Z6LICovXG4gIGFwcHJvdmFsVHlwZTogc3RyaW5nO1xuICBcbiAgLyoqIOivt+axguiAhSAqL1xuICByZXF1ZXN0ZXI6IHN0cmluZztcbiAgXG4gIC8qKiDlrqHmibnmkZjopoEgKi9cbiAgc3VtbWFyeTogc3RyaW5nO1xuICBcbiAgLyoqIOmjjumZqeivtOaYjiAqL1xuICByaXNrU3VtbWFyeTogc3RyaW5nO1xuICBcbiAgLyoqIOW7uuiurue7k+iuuiAqL1xuICByZWNvbW1lbmRlZERlY2lzaW9uOiAnYXBwcm92ZScgfCAncmVqZWN0JyB8ICdyZXF1ZXN0X2NvbnRleHQnO1xuICBcbiAgLyoqIOWNh+e6p+ebruagh++8iOWPr+mAie+8iSAqL1xuICBlc2NhbGF0ZVRvPzogc3RyaW5nO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlrqHmibnlt6XkvZzmtYHmnoTlu7rlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEFwcHJvdmFsV29ya2Zsb3dCdWlsZGVyIHtcbiAgLyoqXG4gICAqIOaehOW7uuWuoeaJueW3peS9nOa1gVxuICAgKi9cbiAgYnVpbGRBcHByb3ZhbFdvcmtmbG93KFxuICAgIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbSxcbiAgICBhcHByb3ZhbElkOiBzdHJpbmcsXG4gICAgYXBwcm92YWxUeXBlOiBzdHJpbmcsXG4gICAgcmVxdWVzdGVyOiBzdHJpbmdcbiAgKTogQXBwcm92YWxXb3JrZmxvd1N0YXRlIHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGNvbnN0IHN0ZXBzOiBXb3JrZmxvd1N0ZXBbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdzdGVwX3JldmlldycsXG4gICAgICAgIG5hbWU6ICdSZXZpZXcgUmVxdWVzdCcsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUmV2aWV3IHRoZSBhcHByb3ZhbCByZXF1ZXN0IGRldGFpbHMnLFxuICAgICAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdzdGVwX2Fzc2Vzc19yaXNrJyxcbiAgICAgICAgbmFtZTogJ0Fzc2VzcyBSaXNrJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBc3Nlc3MgdGhlIHJpc2sgYW5kIGltcGFjdCBvZiB0aGlzIHJlcXVlc3QnLFxuICAgICAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdzdGVwX2RlY2lkZScsXG4gICAgICAgIG5hbWU6ICdNYWtlIERlY2lzaW9uJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBcHByb3ZlLCByZWplY3QsIG9yIHJlcXVlc3QgbW9yZSBjb250ZXh0JyxcbiAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGBhcHByb3ZhbF93b3JrZmxvd18ke2FwcHJvdmFsSWR9YCxcbiAgICAgIHR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICBjdXJyZW50U3RlcElkOiAnc3RlcF9yZXZpZXcnLFxuICAgICAgc3RlcHMsXG4gICAgICBzdGF0dXM6ICdhY3RpdmUnLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICAgIGFwcHJvdmFsSWQsXG4gICAgICBhcHByb3ZhbFR5cGUsXG4gICAgICByZXF1ZXN0ZXIsXG4gICAgICBzdW1tYXJ5OiBpbnRlcnZlbnRpb24uc3VtbWFyeSxcbiAgICAgIHJpc2tTdW1tYXJ5OiB0aGlzLmdlbmVyYXRlUmlza1N1bW1hcnkoaW50ZXJ2ZW50aW9uKSxcbiAgICAgIHJlY29tbWVuZGVkRGVjaXNpb246IHRoaXMuZ2V0UmVjb21tZW5kZWREZWNpc2lvbihpbnRlcnZlbnRpb24pLFxuICAgICAgZXNjYWxhdGVUbzogaW50ZXJ2ZW50aW9uLmVzY2FsYXRlVG8sXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOabtOaWsOW3peS9nOa1geatpemqpFxuICAgKi9cbiAgdXBkYXRlV29ya2Zsb3dTdGVwKFxuICAgIHdvcmtmbG93OiBBcHByb3ZhbFdvcmtmbG93U3RhdGUsXG4gICAgc3RlcElkOiBzdHJpbmcsXG4gICAgY29tcGxldGVkOiBib29sZWFuLFxuICAgIHJlc3VsdD86IHN0cmluZ1xuICApOiBBcHByb3ZhbFdvcmtmbG93U3RhdGUge1xuICAgIGNvbnN0IHVwZGF0ZWRTdGVwcyA9IHdvcmtmbG93LnN0ZXBzLm1hcChzdGVwID0+IHtcbiAgICAgIGlmIChzdGVwLmlkID09PSBzdGVwSWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5zdGVwLFxuICAgICAgICAgIGNvbXBsZXRlZCxcbiAgICAgICAgICBjb21wbGV0ZWRBdDogY29tcGxldGVkID8gRGF0ZS5ub3coKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICByZXN1bHQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RlcDtcbiAgICB9KTtcbiAgICBcbiAgICAvLyDnoa7lrprlvZPliY3mraXpqqRcbiAgICBsZXQgY3VycmVudFN0ZXBJZCA9IHdvcmtmbG93LmN1cnJlbnRTdGVwSWQ7XG4gICAgbGV0IHN0YXR1cyA9IHdvcmtmbG93LnN0YXR1cztcbiAgICBcbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICBjb25zdCBjdXJyZW50SW5kZXggPSB1cGRhdGVkU3RlcHMuZmluZEluZGV4KHMgPT4gcy5pZCA9PT0gc3RlcElkKTtcbiAgICAgIGNvbnN0IG5leHRTdGVwID0gdXBkYXRlZFN0ZXBzW2N1cnJlbnRJbmRleCArIDFdO1xuICAgICAgXG4gICAgICBpZiAobmV4dFN0ZXApIHtcbiAgICAgICAgY3VycmVudFN0ZXBJZCA9IG5leHRTdGVwLmlkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi53b3JrZmxvdyxcbiAgICAgIHN0ZXBzOiB1cGRhdGVkU3RlcHMsXG4gICAgICBjdXJyZW50U3RlcElkLFxuICAgICAgc3RhdHVzLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDlrqHmibnlvJXlr7zliqjkvZxcbiAgICovXG4gIGdlbmVyYXRlR3VpZGVkQWN0aW9ucyh3b3JrZmxvdzogQXBwcm92YWxXb3JrZmxvd1N0YXRlKTogR3VpZGVkQWN0aW9uW10ge1xuICAgIGNvbnN0IGFjdGlvbnM6IEd1aWRlZEFjdGlvbltdID0gW107XG4gICAgXG4gICAgLy8g5qC55o2u5b2T5YmN5q2l6aqk55Sf5oiQ5Yqo5L2cXG4gICAgaWYgKHdvcmtmbG93LmN1cnJlbnRTdGVwSWQgPT09ICdzdGVwX3JldmlldycpIHtcbiAgICAgIGFjdGlvbnMucHVzaChcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAndmlld19kZXRhaWxzJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAndmlld19kZXRhaWxzJyxcbiAgICAgICAgICBsYWJlbDogJ1ZpZXcgRGV0YWlscycsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdWaWV3IGZ1bGwgYXBwcm92YWwgcmVxdWVzdCBkZXRhaWxzJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogZmFsc2UsXG4gICAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgICBleHBlY3RlZE91dGNvbWU6ICdGdWxsIHJlcXVlc3QgZGV0YWlscyB3aWxsIGJlIGRpc3BsYXllZCcsXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uLFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X2NvbnRleHQnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZXF1ZXN0X2NvbnRleHQnLFxuICAgICAgICAgIGxhYmVsOiAnUmVxdWVzdCBNb3JlIENvbnRleHQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmVxdWVzdCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGZyb20gcmVxdWVzdGVyJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnUmVxdWVzdGVyIHdpbGwgYmUgbm90aWZpZWQgdG8gcHJvdmlkZSBtb3JlIGluZm9ybWF0aW9uJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb25cbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIGlmICh3b3JrZmxvdy5jdXJyZW50U3RlcElkID09PSAnc3RlcF9hc3Nlc3NfcmlzaycgfHwgd29ya2Zsb3cuY3VycmVudFN0ZXBJZCA9PT0gJ3N0ZXBfZGVjaWRlJykge1xuICAgICAgYWN0aW9ucy5wdXNoKFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdhcHByb3ZlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnYXBwcm92ZScsXG4gICAgICAgICAgbGFiZWw6ICdBcHByb3ZlJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FwcHJvdmUgdGhpcyByZXF1ZXN0JyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogd29ya2Zsb3cucmVjb21tZW5kZWREZWNpc2lvbiA9PT0gJ2FwcHJvdmUnLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiB0cnVlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnUmVxdWVzdCB3aWxsIGJlIGFwcHJvdmVkIGFuZCBleGVjdXRpb24gd2lsbCBjb250aW51ZScsXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uLFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZWplY3QnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZWplY3QnLFxuICAgICAgICAgIGxhYmVsOiAnUmVqZWN0JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlamVjdCB0aGlzIHJlcXVlc3QnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiB3b3JrZmxvdy5yZWNvbW1lbmRlZERlY2lzaW9uID09PSAncmVqZWN0JyxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ1JlcXVlc3Qgd2lsbCBiZSByZWplY3RlZCBhbmQgcmVsYXRlZCB0YXNrcyBtYXkgYmUgY2FuY2VsbGVkJyxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2VzY2FsYXRlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnZXNjYWxhdGUnLFxuICAgICAgICAgIGxhYmVsOiAnRXNjYWxhdGUnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXNjYWxhdGUgdG8gaGlnaGVyIGF1dGhvcml0eScsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiB0cnVlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnUmVxdWVzdCB3aWxsIGJlIGVzY2FsYXRlZCBmb3IgaGlnaGVyLWxldmVsIHJldmlldycsXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uXG4gICAgICApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYWN0aW9ucztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOaJuemHj+WuoeaJueetlueVpVxuICAgKi9cbiAgZ2VuZXJhdGVCYXRjaEFwcHJvdmFsU3RyYXRlZ3koXG4gICAgaW50ZXJ2ZW50aW9uczogSW50ZXJ2ZW50aW9uSXRlbVtdXG4gICk6IHtcbiAgICBjYW5CYXRjaDogYm9vbGVhbjtcbiAgICBiYXRjaFNpemU6IG51bWJlcjtcbiAgICBzdHJhdGVneTogJ2FwcHJvdmVfYWxsJyB8ICdyZWplY3RfYWxsJyB8ICdyZXZpZXdfaW5kaXZpZHVhbCc7XG4gICAgcmVhc29uaW5nOiBzdHJpbmc7XG4gIH0ge1xuICAgIGlmIChpbnRlcnZlbnRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2FuQmF0Y2g6IGZhbHNlLFxuICAgICAgICBiYXRjaFNpemU6IDAsXG4gICAgICAgIHN0cmF0ZWd5OiAncmV2aWV3X2luZGl2aWR1YWwnLFxuICAgICAgICByZWFzb25pbmc6ICdObyBpbnRlcnZlbnRpb25zIHRvIGJhdGNoJyxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuWPr+S7peaJuemHj+WkhOeQhlxuICAgIGNvbnN0IGFsbFNhbWVUeXBlID0gaW50ZXJ2ZW50aW9ucy5ldmVyeShpID0+IGkuc291cmNlVHlwZSA9PT0gaW50ZXJ2ZW50aW9uc1swXS5zb3VyY2VUeXBlKTtcbiAgICBjb25zdCBhbGxMb3dSaXNrID0gaW50ZXJ2ZW50aW9ucy5ldmVyeShpID0+IGkuc2V2ZXJpdHkgPT09ICdsb3cnIHx8IGkuc2V2ZXJpdHkgPT09ICdtZWRpdW0nKTtcbiAgICBcbiAgICBpZiAoYWxsU2FtZVR5cGUgJiYgYWxsTG93UmlzayAmJiBpbnRlcnZlbnRpb25zLmxlbmd0aCA8PSAxMCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2FuQmF0Y2g6IHRydWUsXG4gICAgICAgIGJhdGNoU2l6ZTogaW50ZXJ2ZW50aW9ucy5sZW5ndGgsXG4gICAgICAgIHN0cmF0ZWd5OiAnYXBwcm92ZV9hbGwnLFxuICAgICAgICByZWFzb25pbmc6ICdBbGwgaW50ZXJ2ZW50aW9ucyBhcmUgc2FtZSB0eXBlIGFuZCBsb3cgcmlzaywgY2FuIGJlIGJhdGNoIGFwcHJvdmVkJyxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBjYW5CYXRjaDogZmFsc2UsXG4gICAgICBiYXRjaFNpemU6IDAsXG4gICAgICBzdHJhdGVneTogJ3Jldmlld19pbmRpdmlkdWFsJyxcbiAgICAgIHJlYXNvbmluZzogJ0ludGVydmVudGlvbnMgaGF2ZSBtaXhlZCB0eXBlcyBvciBoaWdoIHJpc2ssIHJlcXVpcmUgaW5kaXZpZHVhbCByZXZpZXcnLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDpo47pmanmkZjopoFcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVSaXNrU3VtbWFyeShpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW0pOiBzdHJpbmcge1xuICAgIGNvbnN0IHJpc2tNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICBsb3c6ICdMb3cgcmlzazogVGhpcyBhcHByb3ZhbCBoYXMgbWluaW1hbCBpbXBhY3QuJyxcbiAgICAgIG1lZGl1bTogJ01lZGl1bSByaXNrOiBUaGlzIGFwcHJvdmFsIG1heSBhZmZlY3QgcmVsYXRlZCB0YXNrcy4nLFxuICAgICAgaGlnaDogJ0hpZ2ggcmlzazogVGhpcyBhcHByb3ZhbCBtYXkgaGF2ZSBzaWduaWZpY2FudCBpbXBhY3QuJyxcbiAgICAgIGNyaXRpY2FsOiAnQ3JpdGljYWwgcmlzazogVGhpcyBhcHByb3ZhbCByZXF1aXJlcyBjYXJlZnVsIGNvbnNpZGVyYXRpb24uJyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiByaXNrTWFwW2ludGVydmVudGlvbi5zZXZlcml0eV0gfHwgJ1Vua25vd24gcmlzayBsZXZlbC4nO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5o6o6I2Q5Yaz562WXG4gICAqL1xuICBwcml2YXRlIGdldFJlY29tbWVuZGVkRGVjaXNpb24oaW50ZXJ2ZW50aW9uOiBJbnRlcnZlbnRpb25JdGVtKTogJ2FwcHJvdmUnIHwgJ3JlamVjdCcgfCAncmVxdWVzdF9jb250ZXh0JyB7XG4gICAgLy8g5qC55o2u5Lil6YeN57qn5Yir5ZKM5Y6f5Zug55Sf5oiQ5o6o6I2QXG4gICAgaWYgKGludGVydmVudGlvbi5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJykge1xuICAgICAgcmV0dXJuICdyZXF1ZXN0X2NvbnRleHQnO1xuICAgIH1cbiAgICBcbiAgICBpZiAoaW50ZXJ2ZW50aW9uLnJlYXNvbi5pbmNsdWRlcygndGltZW91dCcpIHx8IGludGVydmVudGlvbi5yZWFzb24uaW5jbHVkZXMoJ3BlbmRpbmcnKSkge1xuICAgICAgcmV0dXJuICdhcHByb3ZlJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuICdyZXF1ZXN0X2NvbnRleHQnO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuWuoeaJueW3peS9nOa1geaehOW7uuWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXBwcm92YWxXb3JrZmxvd0J1aWxkZXIoKTogQXBwcm92YWxXb3JrZmxvd0J1aWxkZXIge1xuICByZXR1cm4gbmV3IEFwcHJvdmFsV29ya2Zsb3dCdWlsZGVyKCk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu65a6h5om55bel5L2c5rWBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEFwcHJvdmFsV29ya2Zsb3coXG4gIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbSxcbiAgYXBwcm92YWxJZDogc3RyaW5nLFxuICBhcHByb3ZhbFR5cGU6IHN0cmluZyxcbiAgcmVxdWVzdGVyOiBzdHJpbmdcbik6IEFwcHJvdmFsV29ya2Zsb3dTdGF0ZSB7XG4gIGNvbnN0IGJ1aWxkZXIgPSBuZXcgQXBwcm92YWxXb3JrZmxvd0J1aWxkZXIoKTtcbiAgcmV0dXJuIGJ1aWxkZXIuYnVpbGRBcHByb3ZhbFdvcmtmbG93KGludGVydmVudGlvbiwgYXBwcm92YWxJZCwgYXBwcm92YWxUeXBlLCByZXF1ZXN0ZXIpO1xufVxuIl19