"use strict";
/**
 * Suggestion Engine - 建议引擎
 *
 * 职责：
 * 1. 为每个 intervention item 生成建议动作与理由
 * 2. 输出推荐动作/备选动作/原因解释/风险提示/预期影响
 * 3. 这是 6D 的"引导性"核心，决定体验是生硬还是智能
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestionEngine = void 0;
exports.createSuggestionEngine = createSuggestionEngine;
exports.generateSuggestions = generateSuggestions;
exports.refineGuidedActions = refineGuidedActions;
// ============================================================================
// 建议引擎
// ============================================================================
class SuggestionEngine {
    constructor(config = {}) {
        this.config = {
            maxSuggestions: config.maxSuggestions ?? 5,
            minConfidence: config.minConfidence ?? 0.5,
        };
    }
    /**
     * 为介入项生成建议
     */
    generateSuggestions(intervention) {
        const suggestions = [];
        // 根据介入类型生成建议
        switch (intervention.interventionType) {
            case 'must_confirm':
                suggestions.push(...this.generateMustConfirmSuggestions(intervention));
                break;
            case 'should_review':
                suggestions.push(...this.generateShouldReviewSuggestions(intervention));
                break;
            case 'can_dismiss':
                suggestions.push(...this.generateCanDismissSuggestions(intervention));
                break;
            case 'can_snooze':
                suggestions.push(...this.generateCanSnoozeSuggestions(intervention));
                break;
            case 'should_escalate':
                suggestions.push(...this.generateShouldEscalateSuggestions(intervention));
                break;
        }
        // 限制数量
        return suggestions.slice(0, this.config.maxSuggestions);
    }
    /**
     * 优化引导动作
     */
    refineGuidedActions(actions, intervention) {
        // 根据介入严重级别调整风险级别
        if (intervention.severity === 'critical') {
            for (const action of actions) {
                if (action.riskLevel === 'low') {
                    action.riskLevel = 'medium';
                }
            }
        }
        // 确保至少有一个推荐动作
        if (!actions.some(a => a.recommended)) {
            if (actions.length > 0) {
                actions[0].recommended = true;
            }
        }
        // 添加预期结果（如果缺失）
        for (const action of actions) {
            if (!action.expectedOutcome) {
                action.expectedOutcome = this.generateExpectedOutcome(action, intervention);
            }
        }
        return actions;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 生成必须确认的建议
     */
    generateMustConfirmSuggestions(intervention) {
        const suggestions = [];
        const now = Date.now();
        suggestions.push({
            id: `suggestion_confirm_${intervention.id}`,
            interventionId: intervention.id,
            summary: 'Immediate action required',
            rationale: `This ${intervention.sourceType} requires your confirmation due to ${intervention.reason.toLowerCase()}`,
            recommendedActionId: intervention.suggestedActions.find(a => a.recommended)?.id,
            alternatives: intervention.suggestedActions.filter(a => !a.recommended).map(a => a.label),
            createdAt: now,
        });
        return suggestions;
    }
    /**
     * 生成应该审查的建议
     */
    generateShouldReviewSuggestions(intervention) {
        const suggestions = [];
        const now = Date.now();
        suggestions.push({
            id: `suggestion_review_${intervention.id}`,
            interventionId: intervention.id,
            summary: 'Review recommended',
            rationale: `This ${intervention.sourceType} should be reviewed to ensure proper handling`,
            recommendedActionId: intervention.suggestedActions.find(a => a.recommended)?.id,
            alternatives: ['Dismiss', 'Snooze', 'Escalate'],
            createdAt: now,
        });
        return suggestions;
    }
    /**
     * 生成可以驳回的建议
     */
    generateCanDismissSuggestions(intervention) {
        const suggestions = [];
        const now = Date.now();
        suggestions.push({
            id: `suggestion_dismiss_${intervention.id}`,
            interventionId: intervention.id,
            summary: 'Can be dismissed if expected',
            rationale: `This ${intervention.sourceType} can be dismissed if it is expected behavior`,
            recommendedActionId: 'dismiss',
            alternatives: ['Review', 'Take Action'],
            createdAt: now,
        });
        return suggestions;
    }
    /**
     * 生成可以延后的建议
     */
    generateCanSnoozeSuggestions(intervention) {
        const suggestions = [];
        const now = Date.now();
        suggestions.push({
            id: `suggestion_snooze_${intervention.id}`,
            interventionId: intervention.id,
            summary: 'Can be snoozed if not urgent',
            rationale: `This ${intervention.sourceType} can be snoozed if it does not require immediate attention`,
            recommendedActionId: 'snooze',
            alternatives: ['Review Now', 'Dismiss'],
            createdAt: now,
        });
        return suggestions;
    }
    /**
     * 生成应该升级的建议
     */
    generateShouldEscalateSuggestions(intervention) {
        const suggestions = [];
        const now = Date.now();
        suggestions.push({
            id: `suggestion_escalate_${intervention.id}`,
            interventionId: intervention.id,
            summary: 'Escalation recommended',
            rationale: `This ${intervention.sourceType} should be escalated due to severity: ${intervention.severity}`,
            recommendedActionId: 'escalate',
            alternatives: ['Handle Personally', 'Dismiss'],
            createdAt: now,
        });
        return suggestions;
    }
    /**
     * 生成预期结果
     */
    generateExpectedOutcome(action, intervention) {
        switch (action.actionType) {
            case 'approve':
                return 'Request will be approved and execution will continue';
            case 'reject':
                return 'Request will be rejected and related tasks may be cancelled';
            case 'retry_task':
                return 'Task will be retried and may complete successfully';
            case 'cancel_task':
                return 'Task will be cancelled and related workflows may be affected';
            case 'request_recovery':
                return 'System will attempt to recover the target';
            case 'ack_incident':
                return 'Incident will be acknowledged and assigned to you';
            case 'escalate':
                return 'Issue will be escalated to on-call engineer or manager';
            case 'pause_agent':
                return 'Agent will be paused and no new tasks will be assigned';
            case 'resume_agent':
                return 'Agent will be resumed and can accept new tasks';
            case 'inspect_agent':
            case 'inspect_task':
                return 'Detailed information will be provided for review';
            case 'dismiss':
                return 'Intervention will be dismissed and removed from queue';
            case 'snooze':
                return 'Intervention will be snoozed and reappear later';
            default:
                return 'Action will be executed';
        }
    }
}
exports.SuggestionEngine = SuggestionEngine;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建建议引擎
 */
function createSuggestionEngine(config) {
    return new SuggestionEngine(config);
}
/**
 * 快速生成建议
 */
function generateSuggestions(intervention, config) {
    const engine = new SuggestionEngine(config);
    return engine.generateSuggestions(intervention);
}
/**
 * 快速优化引导动作
 */
function refineGuidedActions(actions, intervention) {
    const engine = new SuggestionEngine();
    return engine.refineGuidedActions(actions, intervention);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VnZ2VzdGlvbl9lbmdpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvc3VnZ2VzdGlvbl9lbmdpbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQXFRSCx3REFFQztBQUtELGtEQU1DO0FBS0Qsa0RBTUM7QUFwUkQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0UsTUFBYSxnQkFBZ0I7SUFHM0IsWUFBWSxTQUFpQyxFQUFFO1FBQzdDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxDQUFDO1lBQzFDLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYSxJQUFJLEdBQUc7U0FDM0MsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILG1CQUFtQixDQUFDLFlBQThCO1FBQ2hELE1BQU0sV0FBVyxHQUF5QixFQUFFLENBQUM7UUFFN0MsYUFBYTtRQUNiLFFBQVEsWUFBWSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdEMsS0FBSyxjQUFjO2dCQUNqQixXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZFLE1BQU07WUFFUixLQUFLLGVBQWU7Z0JBQ2xCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDeEUsTUFBTTtZQUVSLEtBQUssYUFBYTtnQkFDaEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUN0RSxNQUFNO1lBRVIsS0FBSyxZQUFZO2dCQUNmLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsNEJBQTRCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFD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QztZQUVyRCxLQUFLLGNBQWM7Z0JBQ2pCLE9BQU8sbURBQW1ELENBQUM7WUFFN0QsS0FBSyxVQUFVO2dCQUNiLE9BQU8sd0RBQXdELENBQUM7WUFFbEUsS0FBSyxhQUFhO2dCQUNoQixPQUFPLHdEQUF3RCxDQUFDO1lBRWxFLEtBQUssY0FBYztnQkFDakIsT0FBTyxnREFBZ0QsQ0FBQztZQUUxRCxLQUFLLGVBQWUsQ0FBQztZQUNyQixLQUFLLGNBQWM7Z0JBQ2pCLE9BQU8sa0RBQWtELENBQUM7WUFFNUQsS0FBSyxTQUFTO2dCQUNaLE9BQU8sdURBQXVELENBQUM7WUFFakUsS0FBSyxRQUFRO2dCQUNYLE9BQU8saURBQWlELENBQUM7WUFFM0Q7Z0JBQ0UsT0FBTyx5QkFBeUIsQ0FBQztRQUNyQyxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBL09ELDRDQStPQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0Isc0JBQXNCLENBQUMsTUFBK0I7SUFDcEUsT0FBTyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxZQUE4QixFQUM5QixNQUErQjtJQUUvQixNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLE9BQU8sTUFBTSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxPQUF1QixFQUN2QixZQUE4QjtJQUU5QixNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUM7SUFDdEMsT0FBTyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzNELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFN1Z2dlc3Rpb24gRW5naW5lIC0g5bu66K6u5byV5pOOXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5Li65q+P5LiqIGludGVydmVudGlvbiBpdGVtIOeUn+aIkOW7uuiuruWKqOS9nOS4jueQhueUsVxuICogMi4g6L6T5Ye65o6o6I2Q5Yqo5L2cL+Wkh+mAieWKqOS9nC/ljp/lm6Dop6Pph4ov6aOO6Zmp5o+Q56S6L+mihOacn+W9seWTjVxuICogMy4g6L+Z5pivIDZEIOeahFwi5byV5a+85oCnXCLmoLjlv4PvvIzlhrPlrprkvZPpqozmmK/nlJ/noazov5jmmK/mmbrog71cbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTA0XG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBJbnRlcnZlbnRpb25JdGVtLFxuICBHdWlkZWRBY3Rpb24sXG4gIE9wZXJhdG9yU3VnZ2VzdGlvbixcbiAgU3VnZ2VzdGlvbkVuZ2luZUNvbmZpZyxcbn0gZnJvbSAnLi9oaXRsX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bu66K6u5byV5pOOXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0aW9uRW5naW5lIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFN1Z2dlc3Rpb25FbmdpbmVDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBTdWdnZXN0aW9uRW5naW5lQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIG1heFN1Z2dlc3Rpb25zOiBjb25maWcubWF4U3VnZ2VzdGlvbnMgPz8gNSxcbiAgICAgIG1pbkNvbmZpZGVuY2U6IGNvbmZpZy5taW5Db25maWRlbmNlID8/IDAuNSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5Li65LuL5YWl6aG555Sf5oiQ5bu66K6uXG4gICAqL1xuICBnZW5lcmF0ZVN1Z2dlc3Rpb25zKGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbSk6IE9wZXJhdG9yU3VnZ2VzdGlvbltdIHtcbiAgICBjb25zdCBzdWdnZXN0aW9uczogT3BlcmF0b3JTdWdnZXN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDmoLnmja7ku4vlhaXnsbvlnovnlJ/miJDlu7rorq5cbiAgICBzd2l0Y2ggKGludGVydmVudGlvbi5pbnRlcnZlbnRpb25UeXBlKSB7XG4gICAgICBjYXNlICdtdXN0X2NvbmZpcm0nOlxuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKC4uLnRoaXMuZ2VuZXJhdGVNdXN0Q29uZmlybVN1Z2dlc3Rpb25zKGludGVydmVudGlvbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnc2hvdWxkX3Jldmlldyc6XG4gICAgICAgIHN1Z2dlc3Rpb25zLnB1c2goLi4udGhpcy5nZW5lcmF0ZVNob3VsZFJldmlld1N1Z2dlc3Rpb25zKGludGVydmVudGlvbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnY2FuX2Rpc21pc3MnOlxuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKC4uLnRoaXMuZ2VuZXJhdGVDYW5EaXNtaXNzU3VnZ2VzdGlvbnMoaW50ZXJ2ZW50aW9uKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdjYW5fc25vb3plJzpcbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaCguLi50aGlzLmdlbmVyYXRlQ2FuU25vb3plU3VnZ2VzdGlvbnMoaW50ZXJ2ZW50aW9uKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdzaG91bGRfZXNjYWxhdGUnOlxuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKC4uLnRoaXMuZ2VuZXJhdGVTaG91bGRFc2NhbGF0ZVN1Z2dlc3Rpb25zKGludGVydmVudGlvbikpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgLy8g6ZmQ5Yi25pWw6YePXG4gICAgcmV0dXJuIHN1Z2dlc3Rpb25zLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heFN1Z2dlc3Rpb25zKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS8mOWMluW8leWvvOWKqOS9nFxuICAgKi9cbiAgcmVmaW5lR3VpZGVkQWN0aW9ucyhcbiAgICBhY3Rpb25zOiBHdWlkZWRBY3Rpb25bXSxcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogR3VpZGVkQWN0aW9uW10ge1xuICAgIC8vIOagueaNruS7i+WFpeS4pemHjee6p+WIq+iwg+aVtOmjjumZqee6p+WIq1xuICAgIGlmIChpbnRlcnZlbnRpb24uc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcpIHtcbiAgICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcbiAgICAgICAgaWYgKGFjdGlvbi5yaXNrTGV2ZWwgPT09ICdsb3cnKSB7XG4gICAgICAgICAgYWN0aW9uLnJpc2tMZXZlbCA9ICdtZWRpdW0nO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOehruS/neiHs+WwkeacieS4gOS4quaOqOiNkOWKqOS9nFxuICAgIGlmICghYWN0aW9ucy5zb21lKGEgPT4gYS5yZWNvbW1lbmRlZCkpIHtcbiAgICAgIGlmIChhY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYWN0aW9uc1swXS5yZWNvbW1lbmRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOa3u+WKoOmihOacn+e7k+aenO+8iOWmguaenOe8uuWkse+8iVxuICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcbiAgICAgIGlmICghYWN0aW9uLmV4cGVjdGVkT3V0Y29tZSkge1xuICAgICAgICBhY3Rpb24uZXhwZWN0ZWRPdXRjb21lID0gdGhpcy5nZW5lcmF0ZUV4cGVjdGVkT3V0Y29tZShhY3Rpb24sIGludGVydmVudGlvbik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhY3Rpb25zO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5b+F6aG756Gu6K6k55qE5bu66K6uXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlTXVzdENvbmZpcm1TdWdnZXN0aW9ucyhcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogT3BlcmF0b3JTdWdnZXN0aW9uW10ge1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgc3VnZ2VzdGlvbnMucHVzaCh7XG4gICAgICBpZDogYHN1Z2dlc3Rpb25fY29uZmlybV8ke2ludGVydmVudGlvbi5pZH1gLFxuICAgICAgaW50ZXJ2ZW50aW9uSWQ6IGludGVydmVudGlvbi5pZCxcbiAgICAgIHN1bW1hcnk6ICdJbW1lZGlhdGUgYWN0aW9uIHJlcXVpcmVkJyxcbiAgICAgIHJhdGlvbmFsZTogYFRoaXMgJHtpbnRlcnZlbnRpb24uc291cmNlVHlwZX0gcmVxdWlyZXMgeW91ciBjb25maXJtYXRpb24gZHVlIHRvICR7aW50ZXJ2ZW50aW9uLnJlYXNvbi50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICByZWNvbW1lbmRlZEFjdGlvbklkOiBpbnRlcnZlbnRpb24uc3VnZ2VzdGVkQWN0aW9ucy5maW5kKGEgPT4gYS5yZWNvbW1lbmRlZCk/LmlkLFxuICAgICAgYWx0ZXJuYXRpdmVzOiBpbnRlcnZlbnRpb24uc3VnZ2VzdGVkQWN0aW9ucy5maWx0ZXIoYSA9PiAhYS5yZWNvbW1lbmRlZCkubWFwKGEgPT4gYS5sYWJlbCksXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gc3VnZ2VzdGlvbnM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDlupTor6XlrqHmn6XnmoTlu7rorq5cbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVTaG91bGRSZXZpZXdTdWdnZXN0aW9ucyhcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogT3BlcmF0b3JTdWdnZXN0aW9uW10ge1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgc3VnZ2VzdGlvbnMucHVzaCh7XG4gICAgICBpZDogYHN1Z2dlc3Rpb25fcmV2aWV3XyR7aW50ZXJ2ZW50aW9uLmlkfWAsXG4gICAgICBpbnRlcnZlbnRpb25JZDogaW50ZXJ2ZW50aW9uLmlkLFxuICAgICAgc3VtbWFyeTogJ1JldmlldyByZWNvbW1lbmRlZCcsXG4gICAgICByYXRpb25hbGU6IGBUaGlzICR7aW50ZXJ2ZW50aW9uLnNvdXJjZVR5cGV9IHNob3VsZCBiZSByZXZpZXdlZCB0byBlbnN1cmUgcHJvcGVyIGhhbmRsaW5nYCxcbiAgICAgIHJlY29tbWVuZGVkQWN0aW9uSWQ6IGludGVydmVudGlvbi5zdWdnZXN0ZWRBY3Rpb25zLmZpbmQoYSA9PiBhLnJlY29tbWVuZGVkKT8uaWQsXG4gICAgICBhbHRlcm5hdGl2ZXM6IFsnRGlzbWlzcycsICdTbm9vemUnLCAnRXNjYWxhdGUnXSxcbiAgICAgIGNyZWF0ZWRBdDogbm93LFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOWPr+S7pemps+WbnueahOW7uuiurlxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUNhbkRpc21pc3NTdWdnZXN0aW9ucyhcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogT3BlcmF0b3JTdWdnZXN0aW9uW10ge1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgc3VnZ2VzdGlvbnMucHVzaCh7XG4gICAgICBpZDogYHN1Z2dlc3Rpb25fZGlzbWlzc18ke2ludGVydmVudGlvbi5pZH1gLFxuICAgICAgaW50ZXJ2ZW50aW9uSWQ6IGludGVydmVudGlvbi5pZCxcbiAgICAgIHN1bW1hcnk6ICdDYW4gYmUgZGlzbWlzc2VkIGlmIGV4cGVjdGVkJyxcbiAgICAgIHJhdGlvbmFsZTogYFRoaXMgJHtpbnRlcnZlbnRpb24uc291cmNlVHlwZX0gY2FuIGJlIGRpc21pc3NlZCBpZiBpdCBpcyBleHBlY3RlZCBiZWhhdmlvcmAsXG4gICAgICByZWNvbW1lbmRlZEFjdGlvbklkOiAnZGlzbWlzcycsXG4gICAgICBhbHRlcm5hdGl2ZXM6IFsnUmV2aWV3JywgJ1Rha2UgQWN0aW9uJ10sXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gc3VnZ2VzdGlvbnM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDlj6/ku6Xlu7blkI7nmoTlu7rorq5cbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVDYW5Tbm9vemVTdWdnZXN0aW9ucyhcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogT3BlcmF0b3JTdWdnZXN0aW9uW10ge1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgc3VnZ2VzdGlvbnMucHVzaCh7XG4gICAgICBpZDogYHN1Z2dlc3Rpb25fc25vb3plXyR7aW50ZXJ2ZW50aW9uLmlkfWAsXG4gICAgICBpbnRlcnZlbnRpb25JZDogaW50ZXJ2ZW50aW9uLmlkLFxuICAgICAgc3VtbWFyeTogJ0NhbiBiZSBzbm9vemVkIGlmIG5vdCB1cmdlbnQnLFxuICAgICAgcmF0aW9uYWxlOiBgVGhpcyAke2ludGVydmVudGlvbi5zb3VyY2VUeXBlfSBjYW4gYmUgc25vb3plZCBpZiBpdCBkb2VzIG5vdCByZXF1aXJlIGltbWVkaWF0ZSBhdHRlbnRpb25gLFxuICAgICAgcmVjb21tZW5kZWRBY3Rpb25JZDogJ3Nub296ZScsXG4gICAgICBhbHRlcm5hdGl2ZXM6IFsnUmV2aWV3IE5vdycsICdEaXNtaXNzJ10sXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gc3VnZ2VzdGlvbnM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDlupTor6XljYfnuqfnmoTlu7rorq5cbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVTaG91bGRFc2NhbGF0ZVN1Z2dlc3Rpb25zKFxuICAgIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbVxuICApOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSB7XG4gICAgY29uc3Qgc3VnZ2VzdGlvbnM6IE9wZXJhdG9yU3VnZ2VzdGlvbltdID0gW107XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICBzdWdnZXN0aW9ucy5wdXNoKHtcbiAgICAgIGlkOiBgc3VnZ2VzdGlvbl9lc2NhbGF0ZV8ke2ludGVydmVudGlvbi5pZH1gLFxuICAgICAgaW50ZXJ2ZW50aW9uSWQ6IGludGVydmVudGlvbi5pZCxcbiAgICAgIHN1bW1hcnk6ICdFc2NhbGF0aW9uIHJlY29tbWVuZGVkJyxcbiAgICAgIHJhdGlvbmFsZTogYFRoaXMgJHtpbnRlcnZlbnRpb24uc291cmNlVHlwZX0gc2hvdWxkIGJlIGVzY2FsYXRlZCBkdWUgdG8gc2V2ZXJpdHk6ICR7aW50ZXJ2ZW50aW9uLnNldmVyaXR5fWAsXG4gICAgICByZWNvbW1lbmRlZEFjdGlvbklkOiAnZXNjYWxhdGUnLFxuICAgICAgYWx0ZXJuYXRpdmVzOiBbJ0hhbmRsZSBQZXJzb25hbGx5JywgJ0Rpc21pc3MnXSxcbiAgICAgIGNyZWF0ZWRBdDogbm93LFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOmihOacn+e7k+aenFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUV4cGVjdGVkT3V0Y29tZShcbiAgICBhY3Rpb246IEd1aWRlZEFjdGlvbixcbiAgICBpbnRlcnZlbnRpb246IEludGVydmVudGlvbkl0ZW1cbiAgKTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKGFjdGlvbi5hY3Rpb25UeXBlKSB7XG4gICAgICBjYXNlICdhcHByb3ZlJzpcbiAgICAgICAgcmV0dXJuICdSZXF1ZXN0IHdpbGwgYmUgYXBwcm92ZWQgYW5kIGV4ZWN1dGlvbiB3aWxsIGNvbnRpbnVlJztcbiAgICAgIFxuICAgICAgY2FzZSAncmVqZWN0JzpcbiAgICAgICAgcmV0dXJuICdSZXF1ZXN0IHdpbGwgYmUgcmVqZWN0ZWQgYW5kIHJlbGF0ZWQgdGFza3MgbWF5IGJlIGNhbmNlbGxlZCc7XG4gICAgICBcbiAgICAgIGNhc2UgJ3JldHJ5X3Rhc2snOlxuICAgICAgICByZXR1cm4gJ1Rhc2sgd2lsbCBiZSByZXRyaWVkIGFuZCBtYXkgY29tcGxldGUgc3VjY2Vzc2Z1bGx5JztcbiAgICAgIFxuICAgICAgY2FzZSAnY2FuY2VsX3Rhc2snOlxuICAgICAgICByZXR1cm4gJ1Rhc2sgd2lsbCBiZSBjYW5jZWxsZWQgYW5kIHJlbGF0ZWQgd29ya2Zsb3dzIG1heSBiZSBhZmZlY3RlZCc7XG4gICAgICBcbiAgICAgIGNhc2UgJ3JlcXVlc3RfcmVjb3ZlcnknOlxuICAgICAgICByZXR1cm4gJ1N5c3RlbSB3aWxsIGF0dGVtcHQgdG8gcmVjb3ZlciB0aGUgdGFyZ2V0JztcbiAgICAgIFxuICAgICAgY2FzZSAnYWNrX2luY2lkZW50JzpcbiAgICAgICAgcmV0dXJuICdJbmNpZGVudCB3aWxsIGJlIGFja25vd2xlZGdlZCBhbmQgYXNzaWduZWQgdG8geW91JztcbiAgICAgIFxuICAgICAgY2FzZSAnZXNjYWxhdGUnOlxuICAgICAgICByZXR1cm4gJ0lzc3VlIHdpbGwgYmUgZXNjYWxhdGVkIHRvIG9uLWNhbGwgZW5naW5lZXIgb3IgbWFuYWdlcic7XG4gICAgICBcbiAgICAgIGNhc2UgJ3BhdXNlX2FnZW50JzpcbiAgICAgICAgcmV0dXJuICdBZ2VudCB3aWxsIGJlIHBhdXNlZCBhbmQgbm8gbmV3IHRhc2tzIHdpbGwgYmUgYXNzaWduZWQnO1xuICAgICAgXG4gICAgICBjYXNlICdyZXN1bWVfYWdlbnQnOlxuICAgICAgICByZXR1cm4gJ0FnZW50IHdpbGwgYmUgcmVzdW1lZCBhbmQgY2FuIGFjY2VwdCBuZXcgdGFza3MnO1xuICAgICAgXG4gICAgICBjYXNlICdpbnNwZWN0X2FnZW50JzpcbiAgICAgIGNhc2UgJ2luc3BlY3RfdGFzayc6XG4gICAgICAgIHJldHVybiAnRGV0YWlsZWQgaW5mb3JtYXRpb24gd2lsbCBiZSBwcm92aWRlZCBmb3IgcmV2aWV3JztcbiAgICAgIFxuICAgICAgY2FzZSAnZGlzbWlzcyc6XG4gICAgICAgIHJldHVybiAnSW50ZXJ2ZW50aW9uIHdpbGwgYmUgZGlzbWlzc2VkIGFuZCByZW1vdmVkIGZyb20gcXVldWUnO1xuICAgICAgXG4gICAgICBjYXNlICdzbm9vemUnOlxuICAgICAgICByZXR1cm4gJ0ludGVydmVudGlvbiB3aWxsIGJlIHNub296ZWQgYW5kIHJlYXBwZWFyIGxhdGVyJztcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICdBY3Rpb24gd2lsbCBiZSBleGVjdXRlZCc7XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuW7uuiuruW8leaTjlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3VnZ2VzdGlvbkVuZ2luZShjb25maWc/OiBTdWdnZXN0aW9uRW5naW5lQ29uZmlnKTogU3VnZ2VzdGlvbkVuZ2luZSB7XG4gIHJldHVybiBuZXcgU3VnZ2VzdGlvbkVuZ2luZShjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+eUn+aIkOW7uuiurlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVTdWdnZXN0aW9ucyhcbiAgaW50ZXJ2ZW50aW9uOiBJbnRlcnZlbnRpb25JdGVtLFxuICBjb25maWc/OiBTdWdnZXN0aW9uRW5naW5lQ29uZmlnXG4pOiBPcGVyYXRvclN1Z2dlc3Rpb25bXSB7XG4gIGNvbnN0IGVuZ2luZSA9IG5ldyBTdWdnZXN0aW9uRW5naW5lKGNvbmZpZyk7XG4gIHJldHVybiBlbmdpbmUuZ2VuZXJhdGVTdWdnZXN0aW9ucyhpbnRlcnZlbnRpb24pO1xufVxuXG4vKipcbiAqIOW/q+mAn+S8mOWMluW8leWvvOWKqOS9nFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVmaW5lR3VpZGVkQWN0aW9ucyhcbiAgYWN0aW9uczogR3VpZGVkQWN0aW9uW10sXG4gIGludGVydmVudGlvbjogSW50ZXJ2ZW50aW9uSXRlbVxuKTogR3VpZGVkQWN0aW9uW10ge1xuICBjb25zdCBlbmdpbmUgPSBuZXcgU3VnZ2VzdGlvbkVuZ2luZSgpO1xuICByZXR1cm4gZW5naW5lLnJlZmluZUd1aWRlZEFjdGlvbnMoYWN0aW9ucywgaW50ZXJ2ZW50aW9uKTtcbn1cbiJdfQ==