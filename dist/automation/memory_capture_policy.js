"use strict";
/**
 * Memory Capture Policy - 记忆捕获策略
 *
 * 职责：
 * 1. 决定什么内容值得写入长期记忆
 * 2. 控制 capture 时机
 * 3. 生成结构化 memory entry 候选
 * 4. 避免把短期噪声灌进 memory
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCapturePolicyEvaluator = void 0;
exports.createMemoryCapturePolicyEvaluator = createMemoryCapturePolicyEvaluator;
exports.evaluateMemoryCapture = evaluateMemoryCapture;
exports.shouldCaptureMemory = shouldCaptureMemory;
// ============================================================================
// 记忆捕获策略评估器
// ============================================================================
class MemoryCapturePolicyEvaluator {
    constructor(config = {}) {
        // 低价值模式（用于过滤）
        this.lowValuePatterns = [
            /retry/i,
            /transient/i,
            /temporary/i,
            /timeout/i,
            /connection reset/i,
            /network error/i,
        ];
        this.config = {
            minValueScore: config.minValueScore ?? 0.6,
            captureTaskSummaries: config.captureTaskSummaries ?? true,
            capturePreferenceChanges: config.capturePreferenceChanges ?? true,
            captureRecoveryPatterns: config.captureRecoveryPatterns ?? true,
            filterLowValue: config.filterLowValue ?? true,
        };
    }
    /**
     * 评估是否应该捕获记忆
     */
    evaluateMemoryCapture(context) {
        // 构建候选记忆
        const candidate = this.buildMemoryCaptureCandidate(context);
        // 检查价值分数
        if (candidate.valueScore < this.config.minValueScore) {
            return {
                shouldCapture: false,
                valueScore: candidate.valueScore,
                reason: `Value score (${candidate.valueScore}) below threshold (${this.config.minValueScore})`,
            };
        }
        // 过滤低价值信息
        if (this.config.filterLowValue && this.isLowValue(candidate)) {
            return {
                shouldCapture: false,
                valueScore: candidate.valueScore,
                category: candidate.category,
                reason: 'Filtered as low value information',
            };
        }
        // 检查是否应该捕获
        const shouldCapture = this.shouldCaptureByCategory(candidate.category, context);
        return {
            shouldCapture,
            valueScore: candidate.valueScore,
            category: candidate.category,
            reason: shouldCapture ? 'High value memory candidate' : 'Category not enabled for capture',
            candidate: shouldCapture ? candidate : undefined,
        };
    }
    /**
     * 检查是否应该捕获记忆
     */
    shouldCaptureMemory(event, context) {
        const decision = this.evaluateMemoryCapture(context);
        return decision.shouldCapture;
    }
    /**
     * 构建记忆捕获候选
     */
    buildMemoryCaptureCandidate(context) {
        // 确定分类
        const category = this.classifyMemory(context);
        // 计算价值分数
        const valueScore = this.calculateValueScore(context, category);
        // 构建内容
        const content = this.buildMemoryContent(context, category);
        // 判断是否高价值
        const isHighValue = valueScore >= 0.8;
        // 判断是否一次性信息
        const isOneTimeInfo = context.isOneTimeEvent ?? this.isOneTimeInfo(context);
        return {
            content,
            category,
            valueScore,
            sourceEvent: context.eventType,
            relatedTaskId: context.taskId,
            relatedApprovalId: context.approvalId,
            metadata: context.metadata,
            isHighValue,
            isOneTimeInfo,
        };
    }
    /**
     * 对记忆候选进行分类
     */
    classifyMemory(context) {
        const eventType = context.eventType || '';
        const eventData = context.eventData || {};
        // 任务完成
        if (eventType?.includes('task.completed') && context.eventResult === 'success') {
            return 'task_summary';
        }
        // 偏好变化
        if (eventData.preference || eventType?.includes('preference')) {
            return 'preference';
        }
        // 约束/规则
        if (eventData.constraint || eventData.rule || eventType?.includes('constraint')) {
            return 'constraint';
        }
        // 策略变化
        if (eventData.strategy || eventType?.includes('strategy')) {
            return 'strategy';
        }
        // 恢复模式
        if (eventType?.includes('recovery') || eventData.recoveryPattern) {
            return 'recovery_pattern';
        }
        // 审批模式
        if (eventType?.includes('approval') || eventData.approvalPattern) {
            return 'approval_pattern';
        }
        // 工作区信息
        if (eventData.workspace || eventType?.includes('workspace')) {
            return 'workspace_info';
        }
        // 经验教训
        if (eventData.lesson || eventType?.includes('lesson')) {
            return 'lesson_learned';
        }
        // 默认分类
        return 'task_summary';
    }
    /**
     * 过滤低价值记忆
     */
    filterLowValueMemory(candidate) {
        return !this.isLowValue(candidate);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 计算价值分数
     */
    calculateValueScore(context, category) {
        let score = context.importanceScore || 0.5;
        // 成功完成的任务加分
        if (context.eventResult === 'success') {
            score += 0.1;
        }
        // 特定分类加分
        switch (category) {
            case 'preference':
            case 'constraint':
            case 'strategy':
                // 长期有效的信息加分
                score += 0.2;
                break;
            case 'recovery_pattern':
            case 'approval_pattern':
                // 模式信息加分
                score += 0.15;
                break;
            case 'lesson_learned':
                // 经验教训加分
                score += 0.15;
                break;
        }
        // 失败事件减分（除非是重要教训）
        if (context.eventResult === 'failure' && category !== 'lesson_learned') {
            score -= 0.1;
        }
        // 一次性事件减分
        if (context.isOneTimeEvent) {
            score -= 0.2;
        }
        // 限制在 0-1 范围
        return Math.max(0, Math.min(1, score));
    }
    /**
     * 构建记忆内容
     */
    buildMemoryContent(context, category) {
        const parts = [];
        // 内容摘要
        if (context.contentSummary) {
            parts.push(context.contentSummary);
        }
        // 分类特定内容
        switch (category) {
            case 'task_summary':
                if (context.taskId) {
                    parts.push(`Task: ${context.taskId}`);
                }
                if (context.eventResult) {
                    parts.push(`Result: ${context.eventResult}`);
                }
                break;
            case 'preference':
                if (context.eventData?.preference) {
                    parts.push(`Preference: ${JSON.stringify(context.eventData.preference)}`);
                }
                break;
            case 'constraint':
                if (context.eventData?.constraint) {
                    parts.push(`Constraint: ${JSON.stringify(context.eventData.constraint)}`);
                }
                break;
            case 'recovery_pattern':
                if (context.eventData?.recoveryPattern) {
                    parts.push(`Recovery Pattern: ${JSON.stringify(context.eventData.recoveryPattern)}`);
                }
                break;
            case 'approval_pattern':
                if (context.eventData?.approvalPattern) {
                    parts.push(`Approval Pattern: ${JSON.stringify(context.eventData.approvalPattern)}`);
                }
                break;
        }
        // 元数据
        if (context.metadata && Object.keys(context.metadata).length > 0) {
            parts.push(`Metadata: ${JSON.stringify(context.metadata)}`);
        }
        return parts.join(' | ');
    }
    /**
     * 检查是否应该按分类捕获
     */
    shouldCaptureByCategory(category, context) {
        switch (category) {
            case 'task_summary':
                return this.config.captureTaskSummaries;
            case 'preference':
                return this.config.capturePreferenceChanges;
            case 'recovery_pattern':
                return this.config.captureRecoveryPatterns;
            default:
                // 其他分类默认允许
                return true;
        }
    }
    /**
     * 检查是否是低价值信息
     */
    isLowValue(candidate) {
        // 检查内容是否包含低价值模式
        for (const pattern of this.lowValuePatterns) {
            if (pattern.test(candidate.content)) {
                return true;
            }
        }
        // 一次性信息通常是低价值
        if (candidate.isOneTimeInfo && !candidate.isHighValue) {
            return true;
        }
        // 价值分数过低
        if (candidate.valueScore < 0.4) {
            return true;
        }
        return false;
    }
    /**
     * 检查是否是一次性信息
     */
    isOneTimeInfo(context) {
        // 检查事件类型
        const eventType = context.eventType || '';
        // 临时错误通常是一次性的
        if (eventType.includes('timeout') ||
            eventType.includes('transient') ||
            eventType.includes('temporary')) {
            return true;
        }
        // 检查元数据
        if (context.metadata?.isOneTime) {
            return true;
        }
        return context.isOneTimeEvent ?? false;
    }
}
exports.MemoryCapturePolicyEvaluator = MemoryCapturePolicyEvaluator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建记忆捕获策略评估器
 */
function createMemoryCapturePolicyEvaluator(config) {
    return new MemoryCapturePolicyEvaluator(config);
}
/**
 * 快速评估记忆捕获
 */
function evaluateMemoryCapture(context, config) {
    const evaluator = new MemoryCapturePolicyEvaluator(config);
    return evaluator.evaluateMemoryCapture(context);
}
/**
 * 快速检查是否应该捕获记忆
 */
function shouldCaptureMemory(event, context, config) {
    const evaluator = new MemoryCapturePolicyEvaluator(config);
    return evaluator.shouldCaptureMemory(event, context);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVtb3J5X2NhcHR1cmVfcG9saWN5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F1dG9tYXRpb24vbWVtb3J5X2NhcHR1cmVfcG9saWN5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7O0FBK1lILGdGQUlDO0FBS0Qsc0RBTUM7QUFLRCxrREFPQztBQTFYRCwrRUFBK0U7QUFDL0UsWUFBWTtBQUNaLCtFQUErRTtBQUUvRSxNQUFhLDRCQUE0QjtJQWF2QyxZQUFZLFNBQThCLEVBQUU7UUFWNUMsY0FBYztRQUNOLHFCQUFnQixHQUFHO1lBQ3pCLFFBQVE7WUFDUixZQUFZO1lBQ1osWUFBWTtZQUNaLFVBQVU7WUFDVixtQkFBbUI7WUFDbkIsZ0JBQWdCO1NBQ2pCLENBQUM7UUFHQSxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osYUFBYSxFQUFFLE1BQU0sQ0FBQyxhQUFhLElBQUksR0FBRztZQUMxQyxvQkFBb0IsRUFBRSxNQUFNLENBQUMsb0JBQW9CLElBQUksSUFBSTtZQUN6RCx3QkFBd0IsRUFBRSxNQUFNLENBQUMsd0JBQXdCLElBQUksSUFBSTtZQUNqRSx1QkFBdUIsRUFBRSxNQUFNLENBQUMsdUJBQXVCLElBQUksSUFBSTtZQUMvRCxjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxJQUFJO1NBQzlDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxxQkFBcUIsQ0FBQyxPQUE2QjtRQUNqRCxTQUFTO1FBQ1QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVELFNBQVM7UUFDVCxJQUFJLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNyRCxPQUFPO2dCQUNMLGFBQWEsRUFBRSxLQUFLO2dCQUNwQixVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVU7Z0JBQ2hDLE1BQU0s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LHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxLQUFhLEVBQ2IsT0FBNkIsRUFDN0IsTUFBNEI7SUFFNUIsTUFBTSxTQUFTLEdBQUcsSUFBSSw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRCxPQUFPLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdkQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTWVtb3J5IENhcHR1cmUgUG9saWN5IC0g6K6w5b+G5o2V6I63562W55WlXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5Yaz5a6a5LuA5LmI5YaF5a655YC85b6X5YaZ5YWl6ZW/5pyf6K6w5b+GXG4gKiAyLiDmjqfliLYgY2FwdHVyZSDml7bmnLpcbiAqIDMuIOeUn+aIkOe7k+aehOWMliBtZW1vcnkgZW50cnkg5YCZ6YCJXG4gKiA0LiDpgb/lhY3miornn63mnJ/lmarlo7DngYzov5sgbWVtb3J5XG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgTWVtb3J5Q2FwdHVyZURlY2lzaW9uLFxuICBNZW1vcnlDYXB0dXJlQ2FuZGlkYXRlLFxuICBNZW1vcnlDYXRlZ29yeSxcbiAgTWVtb3J5Q2FwdHVyZUNvbmZpZyxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOiusOW/huaNleiOt+S4iuS4i+aWh1xuICovXG5leHBvcnQgaW50ZXJmYWNlIE1lbW9yeUNhcHR1cmVDb250ZXh0IHtcbiAgLyoqIOS6i+S7tuexu+WeiyAqL1xuICBldmVudFR5cGU/OiBzdHJpbmc7XG4gIFxuICAvKiog5Lu75YqhIElEICovXG4gIHRhc2tJZD86IHN0cmluZztcbiAgXG4gIC8qKiDlrqHmibkgSUQgKi9cbiAgYXBwcm92YWxJZD86IHN0cmluZztcbiAgXG4gIC8qKiDkvJror50gSUQgKi9cbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBcbiAgLyoqIOS6i+S7tue7k+aenCAqL1xuICBldmVudFJlc3VsdD86ICdzdWNjZXNzJyB8ICdmYWlsdXJlJyB8ICdwZW5kaW5nJztcbiAgXG4gIC8qKiDkuovku7bmlbDmja4gKi9cbiAgZXZlbnREYXRhPzogUmVjb3JkPHN0cmluZywgYW55PjtcbiAgXG4gIC8qKiDlhoXlrrnmkZjopoEgKi9cbiAgY29udGVudFN1bW1hcnk/OiBzdHJpbmc7XG4gIFxuICAvKiog6YeN6KaB5oCn5YiG5pWw77yIMC0x77yJICovXG4gIGltcG9ydGFuY2VTY29yZT86IG51bWJlcjtcbiAgXG4gIC8qKiDmmK/lkKbkuIDmrKHmgKfkuovku7YgKi9cbiAgaXNPbmVUaW1lRXZlbnQ/OiBib29sZWFuO1xuICBcbiAgLyoqIOWFg+aVsOaNriAqL1xuICBtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIGFueT47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOiusOW/huaNleiOt+etlueVpeivhOS8sOWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxNZW1vcnlDYXB0dXJlQ29uZmlnPjtcbiAgXG4gIC8vIOS9juS7t+WAvOaooeW8j++8iOeUqOS6jui/h+a7pO+8iVxuICBwcml2YXRlIGxvd1ZhbHVlUGF0dGVybnMgPSBbXG4gICAgL3JldHJ5L2ksXG4gICAgL3RyYW5zaWVudC9pLFxuICAgIC90ZW1wb3JhcnkvaSxcbiAgICAvdGltZW91dC9pLFxuICAgIC9jb25uZWN0aW9uIHJlc2V0L2ksXG4gICAgL25ldHdvcmsgZXJyb3IvaSxcbiAgXTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogTWVtb3J5Q2FwdHVyZUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtaW5WYWx1ZVNjb3JlOiBjb25maWcubWluVmFsdWVTY29yZSA/PyAwLjYsXG4gICAgICBjYXB0dXJlVGFza1N1bW1hcmllczogY29uZmlnLmNhcHR1cmVUYXNrU3VtbWFyaWVzID8/IHRydWUsXG4gICAgICBjYXB0dXJlUHJlZmVyZW5jZUNoYW5nZXM6IGNvbmZpZy5jYXB0dXJlUHJlZmVyZW5jZUNoYW5nZXMgPz8gdHJ1ZSxcbiAgICAgIGNhcHR1cmVSZWNvdmVyeVBhdHRlcm5zOiBjb25maWcuY2FwdHVyZVJlY292ZXJ5UGF0dGVybnMgPz8gdHJ1ZSxcbiAgICAgIGZpbHRlckxvd1ZhbHVlOiBjb25maWcuZmlsdGVyTG93VmFsdWUgPz8gdHJ1ZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw5piv5ZCm5bqU6K+l5o2V6I636K6w5b+GXG4gICAqL1xuICBldmFsdWF0ZU1lbW9yeUNhcHR1cmUoY29udGV4dDogTWVtb3J5Q2FwdHVyZUNvbnRleHQpOiBNZW1vcnlDYXB0dXJlRGVjaXNpb24ge1xuICAgIC8vIOaehOW7uuWAmemAieiusOW/hlxuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHRoaXMuYnVpbGRNZW1vcnlDYXB0dXJlQ2FuZGlkYXRlKGNvbnRleHQpO1xuICAgIFxuICAgIC8vIOajgOafpeS7t+WAvOWIhuaVsFxuICAgIGlmIChjYW5kaWRhdGUudmFsdWVTY29yZSA8IHRoaXMuY29uZmlnLm1pblZhbHVlU2NvcmUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNob3VsZENhcHR1cmU6IGZhbHNlLFxuICAgICAgICB2YWx1ZVNjb3JlOiBjYW5kaWRhdGUudmFsdWVTY29yZSxcbiAgICAgICAgcmVhc29uOiBgVmFsdWUgc2NvcmUgKCR7Y2FuZGlkYXRlLnZhbHVlU2NvcmV9KSBiZWxvdyB0aHJlc2hvbGQgKCR7dGhpcy5jb25maWcubWluVmFsdWVTY29yZX0pYCxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOi/h+a7pOS9juS7t+WAvOS/oeaBr1xuICAgIGlmICh0aGlzLmNvbmZpZy5maWx0ZXJMb3dWYWx1ZSAmJiB0aGlzLmlzTG93VmFsdWUoY2FuZGlkYXRlKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2hvdWxkQ2FwdHVyZTogZmFsc2UsXG4gICAgICAgIHZhbHVlU2NvcmU6IGNhbmRpZGF0ZS52YWx1ZVNjb3JlLFxuICAgICAgICBjYXRlZ29yeTogY2FuZGlkYXRlLmNhdGVnb3J5LFxuICAgICAgICByZWFzb246ICdGaWx0ZXJlZCBhcyBsb3cgdmFsdWUgaW5mb3JtYXRpb24nLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5bqU6K+l5o2V6I63XG4gICAgY29uc3Qgc2hvdWxkQ2FwdHVyZSA9IHRoaXMuc2hvdWxkQ2FwdHVyZUJ5Q2F0ZWdvcnkoY2FuZGlkYXRlLmNhdGVnb3J5LCBjb250ZXh0KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc2hvdWxkQ2FwdHVyZSxcbiAgICAgIHZhbHVlU2NvcmU6IGNhbmRpZGF0ZS52YWx1ZVNjb3JlLFxuICAgICAgY2F0ZWdvcnk6IGNhbmRpZGF0ZS5jYXRlZ29yeSxcbiAgICAgIHJlYXNvbjogc2hvdWxkQ2FwdHVyZSA/ICdIaWdoIHZhbHVlIG1lbW9yeSBjYW5kaWRhdGUnIDogJ0NhdGVnb3J5IG5vdCBlbmFibGVkIGZvciBjYXB0dXJlJyxcbiAgICAgIGNhbmRpZGF0ZTogc2hvdWxkQ2FwdHVyZSA/IGNhbmRpZGF0ZSA6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5bqU6K+l5o2V6I636K6w5b+GXG4gICAqL1xuICBzaG91bGRDYXB0dXJlTWVtb3J5KGV2ZW50OiBzdHJpbmcsIGNvbnRleHQ6IE1lbW9yeUNhcHR1cmVDb250ZXh0KTogYm9vbGVhbiB7XG4gICAgY29uc3QgZGVjaXNpb24gPSB0aGlzLmV2YWx1YXRlTWVtb3J5Q2FwdHVyZShjb250ZXh0KTtcbiAgICByZXR1cm4gZGVjaXNpb24uc2hvdWxkQ2FwdHVyZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuiusOW/huaNleiOt+WAmemAiVxuICAgKi9cbiAgYnVpbGRNZW1vcnlDYXB0dXJlQ2FuZGlkYXRlKGNvbnRleHQ6IE1lbW9yeUNhcHR1cmVDb250ZXh0KTogTWVtb3J5Q2FwdHVyZUNhbmRpZGF0ZSB7XG4gICAgLy8g56Gu5a6a5YiG57G7XG4gICAgY29uc3QgY2F0ZWdvcnkgPSB0aGlzLmNsYXNzaWZ5TWVtb3J5KGNvbnRleHQpO1xuICAgIFxuICAgIC8vIOiuoeeul+S7t+WAvOWIhuaVsFxuICAgIGNvbnN0IHZhbHVlU2NvcmUgPSB0aGlzLmNhbGN1bGF0ZVZhbHVlU2NvcmUoY29udGV4dCwgY2F0ZWdvcnkpO1xuICAgIFxuICAgIC8vIOaehOW7uuWGheWuuVxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmJ1aWxkTWVtb3J5Q29udGVudChjb250ZXh0LCBjYXRlZ29yeSk7XG4gICAgXG4gICAgLy8g5Yik5pat5piv5ZCm6auY5Lu35YC8XG4gICAgY29uc3QgaXNIaWdoVmFsdWUgPSB2YWx1ZVNjb3JlID49IDAuODtcbiAgICBcbiAgICAvLyDliKTmlq3mmK/lkKbkuIDmrKHmgKfkv6Hmga9cbiAgICBjb25zdCBpc09uZVRpbWVJbmZvID0gY29udGV4dC5pc09uZVRpbWVFdmVudCA/PyB0aGlzLmlzT25lVGltZUluZm8oY29udGV4dCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnQsXG4gICAgICBjYXRlZ29yeSxcbiAgICAgIHZhbHVlU2NvcmUsXG4gICAgICBzb3VyY2VFdmVudDogY29udGV4dC5ldmVudFR5cGUsXG4gICAgICByZWxhdGVkVGFza0lkOiBjb250ZXh0LnRhc2tJZCxcbiAgICAgIHJlbGF0ZWRBcHByb3ZhbElkOiBjb250ZXh0LmFwcHJvdmFsSWQsXG4gICAgICBtZXRhZGF0YTogY29udGV4dC5tZXRhZGF0YSxcbiAgICAgIGlzSGlnaFZhbHVlLFxuICAgICAgaXNPbmVUaW1lSW5mbyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5a+56K6w5b+G5YCZ6YCJ6L+b6KGM5YiG57G7XG4gICAqL1xuICBjbGFzc2lmeU1lbW9yeShjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dCk6IE1lbW9yeUNhdGVnb3J5IHtcbiAgICBjb25zdCBldmVudFR5cGUgPSBjb250ZXh0LmV2ZW50VHlwZSB8fCAnJztcbiAgICBjb25zdCBldmVudERhdGEgPSBjb250ZXh0LmV2ZW50RGF0YSB8fCB7fTtcbiAgICBcbiAgICAvLyDku7vliqHlrozmiJBcbiAgICBpZiAoZXZlbnRUeXBlPy5pbmNsdWRlcygndGFzay5jb21wbGV0ZWQnKSAmJiBjb250ZXh0LmV2ZW50UmVzdWx0ID09PSAnc3VjY2VzcycpIHtcbiAgICAgIHJldHVybiAndGFza19zdW1tYXJ5JztcbiAgICB9XG4gICAgXG4gICAgLy8g5YGP5aW95Y+Y5YyWXG4gICAgaWYgKGV2ZW50RGF0YS5wcmVmZXJlbmNlIHx8IGV2ZW50VHlwZT8uaW5jbHVkZXMoJ3ByZWZlcmVuY2UnKSkge1xuICAgICAgcmV0dXJuICdwcmVmZXJlbmNlJztcbiAgICB9XG4gICAgXG4gICAgLy8g57qm5p2fL+inhOWImVxuICAgIGlmIChldmVudERhdGEuY29uc3RyYWludCB8fCBldmVudERhdGEucnVsZSB8fCBldmVudFR5cGU/LmluY2x1ZGVzKCdjb25zdHJhaW50JykpIHtcbiAgICAgIHJldHVybiAnY29uc3RyYWludCc7XG4gICAgfVxuICAgIFxuICAgIC8vIOetlueVpeWPmOWMllxuICAgIGlmIChldmVudERhdGEuc3RyYXRlZ3kgfHwgZXZlbnRUeXBlPy5pbmNsdWRlcygnc3RyYXRlZ3knKSkge1xuICAgICAgcmV0dXJuICdzdHJhdGVneSc7XG4gICAgfVxuICAgIFxuICAgIC8vIOaBouWkjeaooeW8j1xuICAgIGlmIChldmVudFR5cGU/LmluY2x1ZGVzKCdyZWNvdmVyeScpIHx8IGV2ZW50RGF0YS5yZWNvdmVyeVBhdHRlcm4pIHtcbiAgICAgIHJldHVybiAncmVjb3ZlcnlfcGF0dGVybic7XG4gICAgfVxuICAgIFxuICAgIC8vIOWuoeaJueaooeW8j1xuICAgIGlmIChldmVudFR5cGU/LmluY2x1ZGVzKCdhcHByb3ZhbCcpIHx8IGV2ZW50RGF0YS5hcHByb3ZhbFBhdHRlcm4pIHtcbiAgICAgIHJldHVybiAnYXBwcm92YWxfcGF0dGVybic7XG4gICAgfVxuICAgIFxuICAgIC8vIOW3peS9nOWMuuS/oeaBr1xuICAgIGlmIChldmVudERhdGEud29ya3NwYWNlIHx8IGV2ZW50VHlwZT8uaW5jbHVkZXMoJ3dvcmtzcGFjZScpKSB7XG4gICAgICByZXR1cm4gJ3dvcmtzcGFjZV9pbmZvJztcbiAgICB9XG4gICAgXG4gICAgLy8g57uP6aqM5pWZ6K6tXG4gICAgaWYgKGV2ZW50RGF0YS5sZXNzb24gfHwgZXZlbnRUeXBlPy5pbmNsdWRlcygnbGVzc29uJykpIHtcbiAgICAgIHJldHVybiAnbGVzc29uX2xlYXJuZWQnO1xuICAgIH1cbiAgICBcbiAgICAvLyDpu5jorqTliIbnsbtcbiAgICByZXR1cm4gJ3Rhc2tfc3VtbWFyeSc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDov4fmu6TkvY7ku7flgLzorrDlv4ZcbiAgICovXG4gIGZpbHRlckxvd1ZhbHVlTWVtb3J5KGNhbmRpZGF0ZTogTWVtb3J5Q2FwdHVyZUNhbmRpZGF0ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhdGhpcy5pc0xvd1ZhbHVlKGNhbmRpZGF0ZSk7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpfku7flgLzliIbmlbBcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlVmFsdWVTY29yZShcbiAgICBjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dCxcbiAgICBjYXRlZ29yeTogTWVtb3J5Q2F0ZWdvcnlcbiAgKTogbnVtYmVyIHtcbiAgICBsZXQgc2NvcmUgPSBjb250ZXh0LmltcG9ydGFuY2VTY29yZSB8fCAwLjU7XG4gICAgXG4gICAgLy8g5oiQ5Yqf5a6M5oiQ55qE5Lu75Yqh5Yqg5YiGXG4gICAgaWYgKGNvbnRleHQuZXZlbnRSZXN1bHQgPT09ICdzdWNjZXNzJykge1xuICAgICAgc2NvcmUgKz0gMC4xO1xuICAgIH1cbiAgICBcbiAgICAvLyDnibnlrprliIbnsbvliqDliIZcbiAgICBzd2l0Y2ggKGNhdGVnb3J5KSB7XG4gICAgICBjYXNlICdwcmVmZXJlbmNlJzpcbiAgICAgIGNhc2UgJ2NvbnN0cmFpbnQnOlxuICAgICAgY2FzZSAnc3RyYXRlZ3knOlxuICAgICAgICAvLyDplb/mnJ/mnInmlYjnmoTkv6Hmga/liqDliIZcbiAgICAgICAgc2NvcmUgKz0gMC4yO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAncmVjb3ZlcnlfcGF0dGVybic6XG4gICAgICBjYXNlICdhcHByb3ZhbF9wYXR0ZXJuJzpcbiAgICAgICAgLy8g5qih5byP5L+h5oGv5Yqg5YiGXG4gICAgICAgIHNjb3JlICs9IDAuMTU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdsZXNzb25fbGVhcm5lZCc6XG4gICAgICAgIC8vIOe7j+mqjOaVmeiureWKoOWIhlxuICAgICAgICBzY29yZSArPSAwLjE1O1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgLy8g5aSx6LSl5LqL5Lu25YeP5YiG77yI6Zmk6Z2e5piv6YeN6KaB5pWZ6K6t77yJXG4gICAgaWYgKGNvbnRleHQuZXZlbnRSZXN1bHQgPT09ICdmYWlsdXJlJyAmJiBjYXRlZ29yeSAhPT0gJ2xlc3Nvbl9sZWFybmVkJykge1xuICAgICAgc2NvcmUgLT0gMC4xO1xuICAgIH1cbiAgICBcbiAgICAvLyDkuIDmrKHmgKfkuovku7blh4/liIZcbiAgICBpZiAoY29udGV4dC5pc09uZVRpbWVFdmVudCkge1xuICAgICAgc2NvcmUgLT0gMC4yO1xuICAgIH1cbiAgICBcbiAgICAvLyDpmZDliLblnKggMC0xIOiMg+WbtFxuICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCBzY29yZSkpO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66K6w5b+G5YaF5a65XG4gICAqL1xuICBwcml2YXRlIGJ1aWxkTWVtb3J5Q29udGVudChcbiAgICBjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dCxcbiAgICBjYXRlZ29yeTogTWVtb3J5Q2F0ZWdvcnlcbiAgKTogc3RyaW5nIHtcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDlhoXlrrnmkZjopoFcbiAgICBpZiAoY29udGV4dC5jb250ZW50U3VtbWFyeSkge1xuICAgICAgcGFydHMucHVzaChjb250ZXh0LmNvbnRlbnRTdW1tYXJ5KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5YiG57G754m55a6a5YaF5a65XG4gICAgc3dpdGNoIChjYXRlZ29yeSkge1xuICAgICAgY2FzZSAndGFza19zdW1tYXJ5JzpcbiAgICAgICAgaWYgKGNvbnRleHQudGFza0lkKSB7XG4gICAgICAgICAgcGFydHMucHVzaChgVGFzazogJHtjb250ZXh0LnRhc2tJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGV4dC5ldmVudFJlc3VsdCkge1xuICAgICAgICAgIHBhcnRzLnB1c2goYFJlc3VsdDogJHtjb250ZXh0LmV2ZW50UmVzdWx0fWApO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdwcmVmZXJlbmNlJzpcbiAgICAgICAgaWYgKGNvbnRleHQuZXZlbnREYXRhPy5wcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcGFydHMucHVzaChgUHJlZmVyZW5jZTogJHtKU09OLnN0cmluZ2lmeShjb250ZXh0LmV2ZW50RGF0YS5wcmVmZXJlbmNlKX1gKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnY29uc3RyYWludCc6XG4gICAgICAgIGlmIChjb250ZXh0LmV2ZW50RGF0YT8uY29uc3RyYWludCkge1xuICAgICAgICAgIHBhcnRzLnB1c2goYENvbnN0cmFpbnQ6ICR7SlNPTi5zdHJpbmdpZnkoY29udGV4dC5ldmVudERhdGEuY29uc3RyYWludCl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBcbiAgICAgIGNhc2UgJ3JlY292ZXJ5X3BhdHRlcm4nOlxuICAgICAgICBpZiAoY29udGV4dC5ldmVudERhdGE/LnJlY292ZXJ5UGF0dGVybikge1xuICAgICAgICAgIHBhcnRzLnB1c2goYFJlY292ZXJ5IFBhdHRlcm46ICR7SlNPTi5zdHJpbmdpZnkoY29udGV4dC5ldmVudERhdGEucmVjb3ZlcnlQYXR0ZXJuKX1gKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnYXBwcm92YWxfcGF0dGVybic6XG4gICAgICAgIGlmIChjb250ZXh0LmV2ZW50RGF0YT8uYXBwcm92YWxQYXR0ZXJuKSB7XG4gICAgICAgICAgcGFydHMucHVzaChgQXBwcm92YWwgUGF0dGVybjogJHtKU09OLnN0cmluZ2lmeShjb250ZXh0LmV2ZW50RGF0YS5hcHByb3ZhbFBhdHRlcm4pfWApO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBcbiAgICAvLyDlhYPmlbDmja5cbiAgICBpZiAoY29udGV4dC5tZXRhZGF0YSAmJiBPYmplY3Qua2V5cyhjb250ZXh0Lm1ldGFkYXRhKS5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJ0cy5wdXNoKGBNZXRhZGF0YTogJHtKU09OLnN0cmluZ2lmeShjb250ZXh0Lm1ldGFkYXRhKX1gKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJyB8ICcpO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5bqU6K+l5oyJ5YiG57G75o2V6I63XG4gICAqL1xuICBwcml2YXRlIHNob3VsZENhcHR1cmVCeUNhdGVnb3J5KFxuICAgIGNhdGVnb3J5OiBNZW1vcnlDYXRlZ29yeSxcbiAgICBjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dFxuICApOiBib29sZWFuIHtcbiAgICBzd2l0Y2ggKGNhdGVnb3J5KSB7XG4gICAgICBjYXNlICd0YXNrX3N1bW1hcnknOlxuICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuY2FwdHVyZVRhc2tTdW1tYXJpZXM7XG4gICAgICBcbiAgICAgIGNhc2UgJ3ByZWZlcmVuY2UnOlxuICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuY2FwdHVyZVByZWZlcmVuY2VDaGFuZ2VzO1xuICAgICAgXG4gICAgICBjYXNlICdyZWNvdmVyeV9wYXR0ZXJuJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmNhcHR1cmVSZWNvdmVyeVBhdHRlcm5zO1xuICAgICAgXG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyDlhbbku5bliIbnsbvpu5jorqTlhYHorrhcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5piv5L2O5Lu35YC85L+h5oGvXG4gICAqL1xuICBwcml2YXRlIGlzTG93VmFsdWUoY2FuZGlkYXRlOiBNZW1vcnlDYXB0dXJlQ2FuZGlkYXRlKTogYm9vbGVhbiB7XG4gICAgLy8g5qOA5p+l5YaF5a655piv5ZCm5YyF5ZCr5L2O5Lu35YC85qih5byPXG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHRoaXMubG93VmFsdWVQYXR0ZXJucykge1xuICAgICAgaWYgKHBhdHRlcm4udGVzdChjYW5kaWRhdGUuY29udGVudCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOS4gOasoeaAp+S/oeaBr+mAmuW4uOaYr+S9juS7t+WAvFxuICAgIGlmIChjYW5kaWRhdGUuaXNPbmVUaW1lSW5mbyAmJiAhY2FuZGlkYXRlLmlzSGlnaFZhbHVlKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5Lu35YC85YiG5pWw6L+H5L2OXG4gICAgaWYgKGNhbmRpZGF0ZS52YWx1ZVNjb3JlIDwgMC40KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5piv5LiA5qyh5oCn5L+h5oGvXG4gICAqL1xuICBwcml2YXRlIGlzT25lVGltZUluZm8oY29udGV4dDogTWVtb3J5Q2FwdHVyZUNvbnRleHQpOiBib29sZWFuIHtcbiAgICAvLyDmo4Dmn6Xkuovku7bnsbvlnotcbiAgICBjb25zdCBldmVudFR5cGUgPSBjb250ZXh0LmV2ZW50VHlwZSB8fCAnJztcbiAgICBcbiAgICAvLyDkuLTml7bplJnor6/pgJrluLjmmK/kuIDmrKHmgKfnmoRcbiAgICBpZiAoZXZlbnRUeXBlLmluY2x1ZGVzKCd0aW1lb3V0JykgfHxcbiAgICAgICAgZXZlbnRUeXBlLmluY2x1ZGVzKCd0cmFuc2llbnQnKSB8fFxuICAgICAgICBldmVudFR5cGUuaW5jbHVkZXMoJ3RlbXBvcmFyeScpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5YWD5pWw5o2uXG4gICAgaWYgKGNvbnRleHQubWV0YWRhdGE/LmlzT25lVGltZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb250ZXh0LmlzT25lVGltZUV2ZW50ID8/IGZhbHNlO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuiusOW/huaNleiOt+etlueVpeivhOS8sOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvcihcbiAgY29uZmlnPzogTWVtb3J5Q2FwdHVyZUNvbmZpZ1xuKTogTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvciB7XG4gIHJldHVybiBuZXcgTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ivhOS8sOiusOW/huaNleiOt1xuICovXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVNZW1vcnlDYXB0dXJlKFxuICBjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dCxcbiAgY29uZmlnPzogTWVtb3J5Q2FwdHVyZUNvbmZpZ1xuKTogTWVtb3J5Q2FwdHVyZURlY2lzaW9uIHtcbiAgY29uc3QgZXZhbHVhdG9yID0gbmV3IE1lbW9yeUNhcHR1cmVQb2xpY3lFdmFsdWF0b3IoY29uZmlnKTtcbiAgcmV0dXJuIGV2YWx1YXRvci5ldmFsdWF0ZU1lbW9yeUNhcHR1cmUoY29udGV4dCk7XG59XG5cbi8qKlxuICog5b+r6YCf5qOA5p+l5piv5ZCm5bqU6K+l5o2V6I636K6w5b+GXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDYXB0dXJlTWVtb3J5KFxuICBldmVudDogc3RyaW5nLFxuICBjb250ZXh0OiBNZW1vcnlDYXB0dXJlQ29udGV4dCxcbiAgY29uZmlnPzogTWVtb3J5Q2FwdHVyZUNvbmZpZ1xuKTogYm9vbGVhbiB7XG4gIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBNZW1vcnlDYXB0dXJlUG9saWN5RXZhbHVhdG9yKGNvbmZpZyk7XG4gIHJldHVybiBldmFsdWF0b3Iuc2hvdWxkQ2FwdHVyZU1lbW9yeShldmVudCwgY29udGV4dCk7XG59XG4iXX0=