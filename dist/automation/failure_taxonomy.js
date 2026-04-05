"use strict";
/**
 * Failure Taxonomy - 失败分类法
 *
 * 职责：
 * 1. 定义统一失败分类
 * 2. 把 task / approval / MCP / skill / agent / runtime 失败映射到标准 category
 * 3. 给 audit 和 health 统一语言
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailureTaxonomy = void 0;
exports.createFailureTaxonomy = createFailureTaxonomy;
exports.classifyFailure = classifyFailure;
exports.buildFailureRecord = buildFailureRecord;
// ============================================================================
// 失败分类映射
// ============================================================================
/**
 * 错误模式到失败分类的映射
 */
const ERROR_PATTERN_MAP = [
    // Timeout
    { pattern: /timeout/i, category: 'timeout' },
    { pattern: /timed out/i, category: 'timeout' },
    { pattern: /deadline exceeded/i, category: 'timeout' },
    // Permission
    { pattern: /permission denied/i, category: 'permission' },
    { pattern: /access denied/i, category: 'permission' },
    { pattern: /unauthorized/i, category: 'permission' },
    { pattern: /forbidden/i, category: 'permission' },
    // Approval
    { pattern: /approval denied/i, category: 'approval' },
    { pattern: /approval rejected/i, category: 'approval' },
    { pattern: /approval timeout/i, category: 'approval' },
    // Resource
    { pattern: /resource unavailable/i, category: 'resource' },
    { pattern: /resource not found/i, category: 'resource' },
    { pattern: /connection refused/i, category: 'resource' },
    { pattern: /network error/i, category: 'resource' },
    // Validation
    { pattern: /validation failed/i, category: 'validation' },
    { pattern: /invalid input/i, category: 'validation' },
    { pattern: /schema error/i, category: 'validation' },
    // Dependency
    { pattern: /dependency.*not found/i, category: 'dependency' },
    { pattern: /module not found/i, category: 'dependency' },
    { pattern: /import error/i, category: 'dependency' },
    // Compatibility
    { pattern: /compatibility/i, category: 'compatibility' },
    { pattern: /version mismatch/i, category: 'compatibility' },
    { pattern: /unsupported/i, category: 'compatibility' },
    // Provider
    { pattern: /provider error/i, category: 'provider' },
    { pattern: /upstream error/i, category: 'provider' },
    { pattern: /external service/i, category: 'provider' },
    // Internal
    { pattern: /internal error/i, category: 'internal' },
    { pattern: /unexpected error/i, category: 'internal' },
    { pattern: /null pointer/i, category: 'internal' },
    { pattern: /undefined is not/i, category: 'internal' },
    // Policy
    { pattern: /policy violation/i, category: 'policy' },
    { pattern: /rule violation/i, category: 'policy' },
    { pattern: /quota exceeded/i, category: 'policy' },
];
// ============================================================================
// 失败分类器
// ============================================================================
class FailureTaxonomy {
    /**
     * 分类失败
     */
    classifyFailure(eventOrError) {
        const errorMessage = this.extractErrorMessage(eventOrError);
        // 尝试匹配错误模式
        for (const { pattern, category } of ERROR_PATTERN_MAP) {
            if (pattern.test(errorMessage)) {
                return category;
            }
        }
        // 默认返回 unknown
        return 'unknown';
    }
    /**
     * 规范化失败分类
     */
    normalizeFailureCategory(input) {
        const normalized = input.toLowerCase().trim();
        // 直接映射已知分类
        const knownCategories = [
            'timeout',
            'permission',
            'approval',
            'resource',
            'validation',
            'dependency',
            'compatibility',
            'provider',
            'internal',
            'policy',
            'unknown',
        ];
        for (const category of knownCategories) {
            if (normalized.includes(category)) {
                return category;
            }
        }
        // 尝试模式匹配
        return this.classifyFailure(input);
    }
    /**
     * 构建失败记录
     */
    buildFailureRecord(event, errorMessage, rootCause) {
        const category = this.classifyFailure(errorMessage);
        return {
            id: this.generateFailureId(),
            timestamp: event.timestamp || Date.now(),
            category,
            entityType: event.entityType || 'task',
            entityId: event.entityId || event.taskId || 'unknown',
            taskId: event.taskId,
            agentId: event.agentId,
            serverId: event.serverId,
            skillName: event.skillName,
            errorMessage,
            rootCause,
            recoveryCount: 0,
            metadata: event.metadata,
        };
    }
    /**
     * 获取失败分类描述
     */
    getCategoryDescription(category) {
        const descriptions = {
            timeout: 'Operation exceeded time limit',
            permission: 'Access or permission denied',
            approval: 'Approval rejected or timed out',
            resource: 'Resource unavailable or not found',
            validation: 'Input or schema validation failed',
            dependency: 'Missing or broken dependency',
            compatibility: 'Version or compatibility mismatch',
            provider: 'External provider or upstream error',
            internal: 'Internal system error',
            policy: 'Policy or quota violation',
            unknown: 'Unknown or uncategorized failure',
        };
        return descriptions[category];
    }
    /**
     * 获取失败分类建议操作
     */
    getSuggestedAction(category) {
        const actions = {
            timeout: 'Increase timeout or optimize operation',
            permission: 'Check permissions and access controls',
            approval: 'Review approval criteria or escalate',
            resource: 'Check resource availability and connectivity',
            validation: 'Fix input data or schema definition',
            dependency: 'Install or update missing dependencies',
            compatibility: 'Update to compatible versions',
            provider: 'Check provider status and fallback options',
            internal: 'Investigate system logs and restart if needed',
            policy: 'Review policy settings or request quota increase',
            unknown: 'Investigate error details and categorize',
        };
        return actions[category];
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 提取错误信息
     */
    extractErrorMessage(eventOrError) {
        if (typeof eventOrError === 'string') {
            return eventOrError;
        }
        if (eventOrError instanceof Error) {
            return eventOrError.message;
        }
        if (eventOrError.errorMessage) {
            return eventOrError.errorMessage;
        }
        if (eventOrError.error) {
            if (typeof eventOrError.error === 'string') {
                return eventOrError.error;
            }
            if (eventOrError.error.message) {
                return eventOrError.error.message;
            }
        }
        if (eventOrError.reason) {
            return eventOrError.reason;
        }
        return JSON.stringify(eventOrError);
    }
    /**
     * 生成失败 ID
     */
    generateFailureId() {
        return `failure_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
}
exports.FailureTaxonomy = FailureTaxonomy;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建失败分类器
 */
function createFailureTaxonomy() {
    return new FailureTaxonomy();
}
/**
 * 快速分类失败
 */
function classifyFailure(eventOrError) {
    const taxonomy = new FailureTaxonomy();
    return taxonomy.classifyFailure(eventOrError);
}
/**
 * 快速构建失败记录
 */
function buildFailureRecord(event, errorMessage, rootCause) {
    const taxonomy = new FailureTaxonomy();
    return taxonomy.buildFailureRecord(event, errorMessage, rootCause);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFpbHVyZV90YXhvbm9teS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hdXRvbWF0aW9uL2ZhaWx1cmVfdGF4b25vbXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQWtQSCxzREFFQztBQUtELDBDQUdDO0FBS0QsZ0RBT0M7QUFwUUQsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxNQUFNLGlCQUFpQixHQUdsQjtJQUNILFVBQVU7SUFDVixFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRTtJQUM1QyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRTtJQUM5QyxFQUFFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFO0lBRXRELGFBQWE7SUFDYixFQUFFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFO0lBQ3pELEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFDckQsRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFDcEQsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFFakQsV0FBVztJQUNYLEVBQUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7SUFDckQsRUFBRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtJQUN2RCxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBRXRELFdBQVc7SUFDWCxFQUFFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBQzFELEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7SUFDeEQsRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtJQUN4RCxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBRW5ELGFBQWE7SUFDYixFQUFFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFO0lBQ3pELEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFDckQsRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFFcEQsYUFBYTtJQUNiLEVBQUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFDN0QsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRTtJQUN4RCxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRTtJQUVwRCxnQkFBZ0I7SUFDaEIsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRTtJQUN4RCxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFO0lBQzNELEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFO0lBRXRELFdBQVc7SUFDWCxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBQ3BELEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7SUFDcEQsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtJQUV0RCxXQUFXO0lBQ1gsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtJQUNwRCxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBQ3RELEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO0lBQ2xELEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7SUFFdEQsU0FBUztJQUNULEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7SUFDcEQsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRTtJQUNsRCxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO0NBQ25ELENBQUM7QUFFRiwrRUFBK0U7QUFDL0UsUUFBUTtBQUNSLCtFQUErRTtBQUUvRSxNQUFhLGVBQWU7SUFDMUI7O09BRUc7SUFDSCxlQUFlLENBQUMsWUFBaUI7UUFDL0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTVELFdBQVc7UUFDWCxLQUFLLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN0RCxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyxRQUFRLENBQUM7WUFDbEIsQ0FBQztRQUNILENBQUM7UUFFRCxlQUFlO1FBQ2YsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsd0JBQXdCLENBQUMsS0FBYTtRQUNwQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFOUMsV0FBVztRQUNYLE1BQU0sZUFBZSxHQUE2QjtZQUNoRCxTQUFTO1lBQ1QsWUFBWTtZQUNaLFVBQVU7WUFDVixVQUFVO1lBQ1YsWUFBWTtZQUNaLFlBQVk7WUFDWixlQUFlO1lBQ2YsVUFBVTtZQUNWLFVBQVU7WUFDVixRQUFRO1lBQ1IsU0FBUztTQUNWLENBQUM7UUFFRixLQUFLLE1BQU0sUUFBUSxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3ZDLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxPQUFPLFFBQVEsQ0FBQztZQUNsQixDQUFDO1FBQ0gsQ0FBQztRQUVELFNBQVM7UUFDVCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsa0JBQWtCLENBQ2hCLEtBQXVCLEVBQ3ZCLFlBQW9CLEVBQ3BCLFNBQWtCO1FBRWxCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFcEQsT0FBTztZQUNMLEVBQUUsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7WUFDNUIsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUN4QyxRQUFRO1lBQ1IsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLElBQUksTUFBTTtZQUN0QyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLFNBQVM7WUFDckQsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO1lBQ3BCLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTztZQUN0QixRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7WUFDeEIsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTO1lBQzFCLFlBQVk7WUFDWixTQUFTO1lBQ1QsYUFBYSxFQUFFLENBQUM7WUFDaEIsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRO1NBQ3pCLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxzQkFBc0IsQ0FBQyxRQUFnQztRQUNyRCxNQUFNLFlBQVksR0FBMkM7WUFDM0QsT0FBTyxFQUFFLCtCQUErQjtZQUN4QyxVQUFVLEVBQUUsNkJBQTZCO1lBQ3pDLFFBQVEsRUFBRSxnQ0FBZ0M7WUFDMUMsUUFBUSxFQUFFLG1DQUFtQztZQUM3QyxVQUFVLEVBQUUsbUNBQW1DO1lBQy9DLFVBQVUsRUFBRSw4QkFBOEI7WUFDMUMsYUFBYSxFQUFFLG1DQUFtQztZQUNsRCxRQUFRLEVBQUUscUNBQXFDO1lBQy9DLFFBQVEsRUFBRSx1QkFBdUI7WUFDakMsTUFBTSxFQUFFLDJCQUEyQjtZQUNuQyxPQUFPLEVBQUUsa0NBQWtDO1NBQzVDLENBQUM7UUFFRixPQUFPLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxrQkFBa0IsQ0FBQyxRQUFnQztRQUNqRCxNQUFNLE9BQU8sR0FBMkM7WUFDdEQsT0FBTyxFQUFFLHdDQUF3QztZQUNqRCxVQUFVLEVBQUUsdUNBQXVDO1lBQ25ELFFBQVEsRUFBRSxzQ0FBc0M7WUFDaEQsUUFBUSxFQUFFLDhDQUE4QztZQUN4RCxVQUFVLEVBQUUscUNBQXFDO1lBQ2pELFVBQVUsRUFBRSx3Q0FBd0M7WUFDcEQsYUFBYSxFQUFFLCtCQUErQjtZQUM5QyxRQUFRLEVBQUUsNENBQTRDO1lBQ3RELFFBQVEsRUFBRSwrQ0FBK0M7WUFDekQsTUFBTSxFQUFFLGtEQUFrRDtZQUMxRCxPQUFPLEVBQUUsMENBQTBDO1NBQ3BELENBQUM7UUFFRixPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRUQsK0VBQStFO0lBQy9FLE9BQU87SUFDUCwrRUFBK0U7SUFFL0U7O09BRUc7SUFDSyxtQkFBbUIsQ0FBQyxZQUFpQjtRQUMzQyxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLE9BQU8sWUFBWSxDQUFDO1FBQ3RCLENBQUM7UUFFRCxJQUFJLFlBQVksWUFBWSxLQUFLLEVBQUUsQ0FBQztZQUNsQyxPQUFPLFlBQVksQ0FBQyxPQUFPLENBQUM7UUFDOUIsQ0FBQztRQUVELElBQUksWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzlCLE9BQU8sWUFBWSxDQUFDLFlBQVksQ0FBQztRQUNuQyxDQUFDO1FBRUQsSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdkIsSUFBSSxPQUFPLFlBQVksQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sWUFBWSxDQUFDLEtBQUssQ0FBQztZQUM1QixDQUFDO1lBQ0QsSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUMvQixPQUFPLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO1lBQ3BDLENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDeEIsT0FBTyxZQUFZLENBQUMsTUFBTSxDQUFDO1FBQzdCLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCO1FBQ3ZCLE9BQU8sV0FBVyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDM0UsQ0FBQztDQUNGO0FBaEtELDBDQWdLQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IscUJBQXFCO0lBQ25DLE9BQU8sSUFBSSxlQUFlLEVBQUUsQ0FBQztBQUMvQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixlQUFlLENBQUMsWUFBaUI7SUFDL0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUN2QyxPQUFPLFFBQVEsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQ2hDLEtBQVUsRUFDVixZQUFvQixFQUNwQixTQUFrQjtJQUVsQixNQUFNLFFBQVEsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBQ3ZDLE9BQU8sUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDckUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRmFpbHVyZSBUYXhvbm9teSAtIOWksei0peWIhuexu+azlVxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWumuS5iee7n+S4gOWksei0peWIhuexu1xuICogMi4g5oqKIHRhc2sgLyBhcHByb3ZhbCAvIE1DUCAvIHNraWxsIC8gYWdlbnQgLyBydW50aW1lIOWksei0peaYoOWwhOWIsOagh+WHhiBjYXRlZ29yeVxuICogMy4g57uZIGF1ZGl0IOWSjCBoZWFsdGgg57uf5LiA6K+t6KiAXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHsgVW5pZmllZEZhaWx1cmVDYXRlZ29yeSwgRmFpbHVyZVJlY29yZCwgQXVkaXRFdmVudCB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlpLHotKXliIbnsbvmmKDlsIRcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDplJnor6/mqKHlvI/liLDlpLHotKXliIbnsbvnmoTmmKDlsIRcbiAqL1xuY29uc3QgRVJST1JfUEFUVEVSTl9NQVA6IEFycmF5PHtcbiAgcGF0dGVybjogUmVnRXhwO1xuICBjYXRlZ29yeTogVW5pZmllZEZhaWx1cmVDYXRlZ29yeTtcbn0+ID0gW1xuICAvLyBUaW1lb3V0XG4gIHsgcGF0dGVybjogL3RpbWVvdXQvaSwgY2F0ZWdvcnk6ICd0aW1lb3V0JyB9LFxuICB7IHBhdHRlcm46IC90aW1lZCBvdXQvaSwgY2F0ZWdvcnk6ICd0aW1lb3V0JyB9LFxuICB7IHBhdHRlcm46IC9kZWFkbGluZSBleGNlZWRlZC9pLCBjYXRlZ29yeTogJ3RpbWVvdXQnIH0sXG4gIFxuICAvLyBQZXJtaXNzaW9uXG4gIHsgcGF0dGVybjogL3Blcm1pc3Npb24gZGVuaWVkL2ksIGNhdGVnb3J5OiAncGVybWlzc2lvbicgfSxcbiAgeyBwYXR0ZXJuOiAvYWNjZXNzIGRlbmllZC9pLCBjYXRlZ29yeTogJ3Blcm1pc3Npb24nIH0sXG4gIHsgcGF0dGVybjogL3VuYXV0aG9yaXplZC9pLCBjYXRlZ29yeTogJ3Blcm1pc3Npb24nIH0sXG4gIHsgcGF0dGVybjogL2ZvcmJpZGRlbi9pLCBjYXRlZ29yeTogJ3Blcm1pc3Npb24nIH0sXG4gIFxuICAvLyBBcHByb3ZhbFxuICB7IHBhdHRlcm46IC9hcHByb3ZhbCBkZW5pZWQvaSwgY2F0ZWdvcnk6ICdhcHByb3ZhbCcgfSxcbiAgeyBwYXR0ZXJuOiAvYXBwcm92YWwgcmVqZWN0ZWQvaSwgY2F0ZWdvcnk6ICdhcHByb3ZhbCcgfSxcbiAgeyBwYXR0ZXJuOiAvYXBwcm92YWwgdGltZW91dC9pLCBjYXRlZ29yeTogJ2FwcHJvdmFsJyB9LFxuICBcbiAgLy8gUmVzb3VyY2VcbiAgeyBwYXR0ZXJuOiAvcmVzb3VyY2UgdW5hdmFpbGFibGUvaSwgY2F0ZWdvcnk6ICdyZXNvdXJjZScgfSxcbiAgeyBwYXR0ZXJuOiAvcmVzb3VyY2Ugbm90IGZvdW5kL2ksIGNhdGVnb3J5OiAncmVzb3VyY2UnIH0sXG4gIHsgcGF0dGVybjogL2Nvbm5lY3Rpb24gcmVmdXNlZC9pLCBjYXRlZ29yeTogJ3Jlc291cmNlJyB9LFxuICB7IHBhdHRlcm46IC9uZXR3b3JrIGVycm9yL2ksIGNhdGVnb3J5OiAncmVzb3VyY2UnIH0sXG4gIFxuICAvLyBWYWxpZGF0aW9uXG4gIHsgcGF0dGVybjogL3ZhbGlkYXRpb24gZmFpbGVkL2ksIGNhdGVnb3J5OiAndmFsaWRhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAvaW52YWxpZCBpbnB1dC9pLCBjYXRlZ29yeTogJ3ZhbGlkYXRpb24nIH0sXG4gIHsgcGF0dGVybjogL3NjaGVtYSBlcnJvci9pLCBjYXRlZ29yeTogJ3ZhbGlkYXRpb24nIH0sXG4gIFxuICAvLyBEZXBlbmRlbmN5XG4gIHsgcGF0dGVybjogL2RlcGVuZGVuY3kuKm5vdCBmb3VuZC9pLCBjYXRlZ29yeTogJ2RlcGVuZGVuY3knIH0sXG4gIHsgcGF0dGVybjogL21vZHVsZSBub3QgZm91bmQvaSwgY2F0ZWdvcnk6ICdkZXBlbmRlbmN5JyB9LFxuICB7IHBhdHRlcm46IC9pbXBvcnQgZXJyb3IvaSwgY2F0ZWdvcnk6ICdkZXBlbmRlbmN5JyB9LFxuICBcbiAgLy8gQ29tcGF0aWJpbGl0eVxuICB7IHBhdHRlcm46IC9jb21wYXRpYmlsaXR5L2ksIGNhdGVnb3J5OiAnY29tcGF0aWJpbGl0eScgfSxcbiAgeyBwYXR0ZXJuOiAvdmVyc2lvbiBtaXNtYXRjaC9pLCBjYXRlZ29yeTogJ2NvbXBhdGliaWxpdHknIH0sXG4gIHsgcGF0dGVybjogL3Vuc3VwcG9ydGVkL2ksIGNhdGVnb3J5OiAnY29tcGF0aWJpbGl0eScgfSxcbiAgXG4gIC8vIFByb3ZpZGVyXG4gIHsgcGF0dGVybjogL3Byb3ZpZGVyIGVycm9yL2ksIGNhdGVnb3J5OiAncHJvdmlkZXInIH0sXG4gIHsgcGF0dGVybjogL3Vwc3RyZWFtIGVycm9yL2ksIGNhdGVnb3J5OiAncHJvdmlkZXInIH0sXG4gIHsgcGF0dGVybjogL2V4dGVybmFsIHNlcnZpY2UvaSwgY2F0ZWdvcnk6ICdwcm92aWRlcicgfSxcbiAgXG4gIC8vIEludGVybmFsXG4gIHsgcGF0dGVybjogL2ludGVybmFsIGVycm9yL2ksIGNhdGVnb3J5OiAnaW50ZXJuYWwnIH0sXG4gIHsgcGF0dGVybjogL3VuZXhwZWN0ZWQgZXJyb3IvaSwgY2F0ZWdvcnk6ICdpbnRlcm5hbCcgfSxcbiAgeyBwYXR0ZXJuOiAvbnVsbCBwb2ludGVyL2ksIGNhdGVnb3J5OiAnaW50ZXJuYWwnIH0sXG4gIHsgcGF0dGVybjogL3VuZGVmaW5lZCBpcyBub3QvaSwgY2F0ZWdvcnk6ICdpbnRlcm5hbCcgfSxcbiAgXG4gIC8vIFBvbGljeVxuICB7IHBhdHRlcm46IC9wb2xpY3kgdmlvbGF0aW9uL2ksIGNhdGVnb3J5OiAncG9saWN5JyB9LFxuICB7IHBhdHRlcm46IC9ydWxlIHZpb2xhdGlvbi9pLCBjYXRlZ29yeTogJ3BvbGljeScgfSxcbiAgeyBwYXR0ZXJuOiAvcXVvdGEgZXhjZWVkZWQvaSwgY2F0ZWdvcnk6ICdwb2xpY3knIH0sXG5dO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlpLHotKXliIbnsbvlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEZhaWx1cmVUYXhvbm9teSB7XG4gIC8qKlxuICAgKiDliIbnsbvlpLHotKVcbiAgICovXG4gIGNsYXNzaWZ5RmFpbHVyZShldmVudE9yRXJyb3I6IGFueSk6IFVuaWZpZWRGYWlsdXJlQ2F0ZWdvcnkge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IHRoaXMuZXh0cmFjdEVycm9yTWVzc2FnZShldmVudE9yRXJyb3IpO1xuICAgIFxuICAgIC8vIOWwneivleWMuemFjemUmeivr+aooeW8j1xuICAgIGZvciAoY29uc3QgeyBwYXR0ZXJuLCBjYXRlZ29yeSB9IG9mIEVSUk9SX1BBVFRFUk5fTUFQKSB7XG4gICAgICBpZiAocGF0dGVybi50ZXN0KGVycm9yTWVzc2FnZSkpIHtcbiAgICAgICAgcmV0dXJuIGNhdGVnb3J5O1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDpu5jorqTov5Tlm54gdW5rbm93blxuICAgIHJldHVybiAndW5rbm93bic7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop4TojIPljJblpLHotKXliIbnsbtcbiAgICovXG4gIG5vcm1hbGl6ZUZhaWx1cmVDYXRlZ29yeShpbnB1dDogc3RyaW5nKTogVW5pZmllZEZhaWx1cmVDYXRlZ29yeSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IGlucHV0LnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgIFxuICAgIC8vIOebtOaOpeaYoOWwhOW3suefpeWIhuexu1xuICAgIGNvbnN0IGtub3duQ2F0ZWdvcmllczogVW5pZmllZEZhaWx1cmVDYXRlZ29yeVtdID0gW1xuICAgICAgJ3RpbWVvdXQnLFxuICAgICAgJ3Blcm1pc3Npb24nLFxuICAgICAgJ2FwcHJvdmFsJyxcbiAgICAgICdyZXNvdXJjZScsXG4gICAgICAndmFsaWRhdGlvbicsXG4gICAgICAnZGVwZW5kZW5jeScsXG4gICAgICAnY29tcGF0aWJpbGl0eScsXG4gICAgICAncHJvdmlkZXInLFxuICAgICAgJ2ludGVybmFsJyxcbiAgICAgICdwb2xpY3knLFxuICAgICAgJ3Vua25vd24nLFxuICAgIF07XG4gICAgXG4gICAgZm9yIChjb25zdCBjYXRlZ29yeSBvZiBrbm93bkNhdGVnb3JpZXMpIHtcbiAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKGNhdGVnb3J5KSkge1xuICAgICAgICByZXR1cm4gY2F0ZWdvcnk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOWwneivleaooeW8j+WMuemFjVxuICAgIHJldHVybiB0aGlzLmNsYXNzaWZ5RmFpbHVyZShpbnB1dCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rlpLHotKXorrDlvZVcbiAgICovXG4gIGJ1aWxkRmFpbHVyZVJlY29yZChcbiAgICBldmVudDogQXVkaXRFdmVudCB8IGFueSxcbiAgICBlcnJvck1lc3NhZ2U6IHN0cmluZyxcbiAgICByb290Q2F1c2U/OiBzdHJpbmdcbiAgKTogRmFpbHVyZVJlY29yZCB7XG4gICAgY29uc3QgY2F0ZWdvcnkgPSB0aGlzLmNsYXNzaWZ5RmFpbHVyZShlcnJvck1lc3NhZ2UpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogdGhpcy5nZW5lcmF0ZUZhaWx1cmVJZCgpLFxuICAgICAgdGltZXN0YW1wOiBldmVudC50aW1lc3RhbXAgfHwgRGF0ZS5ub3coKSxcbiAgICAgIGNhdGVnb3J5LFxuICAgICAgZW50aXR5VHlwZTogZXZlbnQuZW50aXR5VHlwZSB8fCAndGFzaycsXG4gICAgICBlbnRpdHlJZDogZXZlbnQuZW50aXR5SWQgfHwgZXZlbnQudGFza0lkIHx8ICd1bmtub3duJyxcbiAgICAgIHRhc2tJZDogZXZlbnQudGFza0lkLFxuICAgICAgYWdlbnRJZDogZXZlbnQuYWdlbnRJZCxcbiAgICAgIHNlcnZlcklkOiBldmVudC5zZXJ2ZXJJZCxcbiAgICAgIHNraWxsTmFtZTogZXZlbnQuc2tpbGxOYW1lLFxuICAgICAgZXJyb3JNZXNzYWdlLFxuICAgICAgcm9vdENhdXNlLFxuICAgICAgcmVjb3ZlcnlDb3VudDogMCxcbiAgICAgIG1ldGFkYXRhOiBldmVudC5tZXRhZGF0YSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5aSx6LSl5YiG57G75o+P6L+wXG4gICAqL1xuICBnZXRDYXRlZ29yeURlc2NyaXB0aW9uKGNhdGVnb3J5OiBVbmlmaWVkRmFpbHVyZUNhdGVnb3J5KTogc3RyaW5nIHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbnM6IFJlY29yZDxVbmlmaWVkRmFpbHVyZUNhdGVnb3J5LCBzdHJpbmc+ID0ge1xuICAgICAgdGltZW91dDogJ09wZXJhdGlvbiBleGNlZWRlZCB0aW1lIGxpbWl0JyxcbiAgICAgIHBlcm1pc3Npb246ICdBY2Nlc3Mgb3IgcGVybWlzc2lvbiBkZW5pZWQnLFxuICAgICAgYXBwcm92YWw6ICdBcHByb3ZhbCByZWplY3RlZCBvciB0aW1lZCBvdXQnLFxuICAgICAgcmVzb3VyY2U6ICdSZXNvdXJjZSB1bmF2YWlsYWJsZSBvciBub3QgZm91bmQnLFxuICAgICAgdmFsaWRhdGlvbjogJ0lucHV0IG9yIHNjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZCcsXG4gICAgICBkZXBlbmRlbmN5OiAnTWlzc2luZyBvciBicm9rZW4gZGVwZW5kZW5jeScsXG4gICAgICBjb21wYXRpYmlsaXR5OiAnVmVyc2lvbiBvciBjb21wYXRpYmlsaXR5IG1pc21hdGNoJyxcbiAgICAgIHByb3ZpZGVyOiAnRXh0ZXJuYWwgcHJvdmlkZXIgb3IgdXBzdHJlYW0gZXJyb3InLFxuICAgICAgaW50ZXJuYWw6ICdJbnRlcm5hbCBzeXN0ZW0gZXJyb3InLFxuICAgICAgcG9saWN5OiAnUG9saWN5IG9yIHF1b3RhIHZpb2xhdGlvbicsXG4gICAgICB1bmtub3duOiAnVW5rbm93biBvciB1bmNhdGVnb3JpemVkIGZhaWx1cmUnLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIGRlc2NyaXB0aW9uc1tjYXRlZ29yeV07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blpLHotKXliIbnsbvlu7rorq7mk43kvZxcbiAgICovXG4gIGdldFN1Z2dlc3RlZEFjdGlvbihjYXRlZ29yeTogVW5pZmllZEZhaWx1cmVDYXRlZ29yeSk6IHN0cmluZyB7XG4gICAgY29uc3QgYWN0aW9uczogUmVjb3JkPFVuaWZpZWRGYWlsdXJlQ2F0ZWdvcnksIHN0cmluZz4gPSB7XG4gICAgICB0aW1lb3V0OiAnSW5jcmVhc2UgdGltZW91dCBvciBvcHRpbWl6ZSBvcGVyYXRpb24nLFxuICAgICAgcGVybWlzc2lvbjogJ0NoZWNrIHBlcm1pc3Npb25zIGFuZCBhY2Nlc3MgY29udHJvbHMnLFxuICAgICAgYXBwcm92YWw6ICdSZXZpZXcgYXBwcm92YWwgY3JpdGVyaWEgb3IgZXNjYWxhdGUnLFxuICAgICAgcmVzb3VyY2U6ICdDaGVjayByZXNvdXJjZSBhdmFpbGFiaWxpdHkgYW5kIGNvbm5lY3Rpdml0eScsXG4gICAgICB2YWxpZGF0aW9uOiAnRml4IGlucHV0IGRhdGEgb3Igc2NoZW1hIGRlZmluaXRpb24nLFxuICAgICAgZGVwZW5kZW5jeTogJ0luc3RhbGwgb3IgdXBkYXRlIG1pc3NpbmcgZGVwZW5kZW5jaWVzJyxcbiAgICAgIGNvbXBhdGliaWxpdHk6ICdVcGRhdGUgdG8gY29tcGF0aWJsZSB2ZXJzaW9ucycsXG4gICAgICBwcm92aWRlcjogJ0NoZWNrIHByb3ZpZGVyIHN0YXR1cyBhbmQgZmFsbGJhY2sgb3B0aW9ucycsXG4gICAgICBpbnRlcm5hbDogJ0ludmVzdGlnYXRlIHN5c3RlbSBsb2dzIGFuZCByZXN0YXJ0IGlmIG5lZWRlZCcsXG4gICAgICBwb2xpY3k6ICdSZXZpZXcgcG9saWN5IHNldHRpbmdzIG9yIHJlcXVlc3QgcXVvdGEgaW5jcmVhc2UnLFxuICAgICAgdW5rbm93bjogJ0ludmVzdGlnYXRlIGVycm9yIGRldGFpbHMgYW5kIGNhdGVnb3JpemUnLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIGFjdGlvbnNbY2F0ZWdvcnldO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W6ZSZ6K+v5L+h5oGvXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RFcnJvck1lc3NhZ2UoZXZlbnRPckVycm9yOiBhbnkpOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgZXZlbnRPckVycm9yID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGV2ZW50T3JFcnJvcjtcbiAgICB9XG4gICAgXG4gICAgaWYgKGV2ZW50T3JFcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICByZXR1cm4gZXZlbnRPckVycm9yLm1lc3NhZ2U7XG4gICAgfVxuICAgIFxuICAgIGlmIChldmVudE9yRXJyb3IuZXJyb3JNZXNzYWdlKSB7XG4gICAgICByZXR1cm4gZXZlbnRPckVycm9yLmVycm9yTWVzc2FnZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGV2ZW50T3JFcnJvci5lcnJvcikge1xuICAgICAgaWYgKHR5cGVvZiBldmVudE9yRXJyb3IuZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBldmVudE9yRXJyb3IuZXJyb3I7XG4gICAgICB9XG4gICAgICBpZiAoZXZlbnRPckVycm9yLmVycm9yLm1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50T3JFcnJvci5lcnJvci5tZXNzYWdlO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoZXZlbnRPckVycm9yLnJlYXNvbikge1xuICAgICAgcmV0dXJuIGV2ZW50T3JFcnJvci5yZWFzb247XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShldmVudE9yRXJyb3IpO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5aSx6LSlIElEXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlRmFpbHVyZUlkKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBmYWlsdXJlXyR7RGF0ZS5ub3coKX1fJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuWksei0peWIhuexu+WZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRmFpbHVyZVRheG9ub215KCk6IEZhaWx1cmVUYXhvbm9teSB7XG4gIHJldHVybiBuZXcgRmFpbHVyZVRheG9ub215KCk7XG59XG5cbi8qKlxuICog5b+r6YCf5YiG57G75aSx6LSlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc2lmeUZhaWx1cmUoZXZlbnRPckVycm9yOiBhbnkpOiBVbmlmaWVkRmFpbHVyZUNhdGVnb3J5IHtcbiAgY29uc3QgdGF4b25vbXkgPSBuZXcgRmFpbHVyZVRheG9ub215KCk7XG4gIHJldHVybiB0YXhvbm9teS5jbGFzc2lmeUZhaWx1cmUoZXZlbnRPckVycm9yKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mnoTlu7rlpLHotKXorrDlvZVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkRmFpbHVyZVJlY29yZChcbiAgZXZlbnQ6IGFueSxcbiAgZXJyb3JNZXNzYWdlOiBzdHJpbmcsXG4gIHJvb3RDYXVzZT86IHN0cmluZ1xuKTogRmFpbHVyZVJlY29yZCB7XG4gIGNvbnN0IHRheG9ub215ID0gbmV3IEZhaWx1cmVUYXhvbm9teSgpO1xuICByZXR1cm4gdGF4b25vbXkuYnVpbGRGYWlsdXJlUmVjb3JkKGV2ZW50LCBlcnJvck1lc3NhZ2UsIHJvb3RDYXVzZSk7XG59XG4iXX0=