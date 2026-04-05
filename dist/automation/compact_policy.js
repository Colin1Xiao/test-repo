"use strict";
/**
 * Compact Policy - 紧凑压缩策略
 *
 * 职责：
 * 1. 判定何时 compact
 * 2. 判定 compact 范围
 * 3. 生成 compact 摘要策略
 * 4. 与 session/task 生命周期事件挂钩
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompactPolicyEvaluator = void 0;
exports.createCompactPolicyEvaluator = createCompactPolicyEvaluator;
exports.evaluateCompactNeed = evaluateCompactNeed;
exports.shouldCompact = shouldCompact;
// ============================================================================
// 紧凑策略评估器
// ============================================================================
class CompactPolicyEvaluator {
    constructor(config = {}) {
        this.config = {
            maxMessageCount: config.maxMessageCount ?? 100,
            maxTaskGraphDepth: config.maxTaskGraphDepth ?? 10,
            maxSubagentResults: config.maxSubagentResults ?? 20,
            maxApprovalHistory: config.maxApprovalHistory ?? 50,
            maxContextSizeBytes: config.maxContextSizeBytes ?? 1024 * 1024, // 1MB
            defaultKeepLastN: config.defaultKeepLastN ?? 20,
            generateSummary: config.generateSummary ?? true,
            summaryLengthLimit: config.summaryLengthLimit ?? 1000,
        };
    }
    /**
     * 评估紧凑需求
     */
    evaluateCompactNeed(context) {
        // 检查各个触发条件
        const triggers = [];
        // 检查消息数量
        if ((context.messageCount || 0) > this.config.maxMessageCount) {
            triggers.push({
                trigger: 'context_too_large',
                priority: 8,
            });
        }
        // 检查任务图深度
        if ((context.taskGraphDepth || 0) > this.config.maxTaskGraphDepth) {
            triggers.push({
                trigger: 'task_graph_too_deep',
                priority: 7,
            });
        }
        // 检查子代理结果数量
        if ((context.subagentResultCount || 0) > this.config.maxSubagentResults) {
            triggers.push({
                trigger: 'subagent_results_too_many',
                priority: 6,
            });
        }
        // 检查审批历史数量
        if ((context.approvalHistoryCount || 0) > this.config.maxApprovalHistory) {
            triggers.push({
                trigger: 'approval_history_accumulated',
                priority: 5,
            });
        }
        // 检查上下文大小
        if ((context.contextSizeBytes || 0) > this.config.maxContextSizeBytes) {
            triggers.push({
                trigger: 'memory_pressure',
                priority: 9,
            });
        }
        // 检查会话结束
        if (context.sessionEnded) {
            triggers.push({
                trigger: 'session_end',
                priority: 10,
            });
        }
        // 没有触发条件
        if (triggers.length === 0) {
            return {
                shouldCompact: false,
            };
        }
        // 选择最高优先级的触发条件
        triggers.sort((a, b) => b.priority - a.priority);
        const highestTrigger = triggers[0];
        // 确定紧凑范围
        let scope = 'history';
        if (highestTrigger.trigger === 'session_end') {
            scope = 'session';
        }
        else if (highestTrigger.trigger === 'task_graph_too_deep') {
            scope = 'task';
        }
        else if (highestTrigger.trigger === 'approval_history_accumulated') {
            scope = 'approval';
        }
        // 构建紧凑策略
        const strategy = this.buildCompactStrategy(scope, context);
        return {
            shouldCompact: true,
            trigger: highestTrigger.trigger,
            priority: highestTrigger.priority,
            scope,
            reason: this.getTriggerReason(highestTrigger.trigger, context),
            strategy,
        };
    }
    /**
     * 检查是否应该紧凑
     */
    shouldCompact(event, context) {
        const decision = this.evaluateCompactNeed(context);
        return decision.shouldCompact;
    }
    /**
     * 构建紧凑计划
     */
    buildCompactPlan(context) {
        const decision = this.evaluateCompactNeed(context);
        if (!decision.shouldCompact || !decision.strategy) {
            throw new Error('Compact not needed');
        }
        // 估算压缩率
        const estimatedCompressionRatio = this.estimateCompressionRatio(context, decision.strategy);
        // 估算节省空间
        const estimatedSpaceSaved = context.contextSizeBytes
            ? Math.floor(context.contextSizeBytes * (1 - estimatedCompressionRatio))
            : undefined;
        return {
            scope: decision.scope || 'history',
            trigger: decision.trigger || 'policy_triggered',
            strategy: decision.strategy,
            estimatedCompressionRatio,
            estimatedSpaceSaved,
        };
    }
    /**
     * 生成紧凑摘要
     */
    summarizeForCompact(context) {
        const summaries = [];
        // 任务摘要
        if (context.taskId) {
            summaries.push(`Task: ${context.taskId}`);
        }
        // 会话摘要
        if (context.sessionId) {
            summaries.push(`Session: ${context.sessionId}`);
        }
        // 统计摘要
        const stats = [];
        if (context.messageCount) {
            stats.push(`${context.messageCount} messages`);
        }
        if (context.taskGraphDepth) {
            stats.push(`task depth: ${context.taskGraphDepth}`);
        }
        if (context.subagentResultCount) {
            stats.push(`${context.subagentResultCount} subagent results`);
        }
        if (context.approvalHistoryCount) {
            stats.push(`${context.approvalHistoryCount} approvals`);
        }
        if (stats.length > 0) {
            summaries.push(`Stats: ${stats.join(', ')}`);
        }
        return summaries.join(' | ');
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 构建紧凑策略
     */
    buildCompactStrategy(scope, context) {
        const strategy = {
            keepLastN: this.config.defaultKeepLastN,
            generateSummary: this.config.generateSummary,
            summaryLengthLimit: this.config.summaryLengthLimit,
        };
        // 根据范围调整策略
        switch (scope) {
            case 'session':
                // 会话结束：保留更多关键信息
                strategy.keepLastN = 30;
                strategy.preserveKeyEvents = true;
                strategy.compressAttachments = true;
                break;
            case 'task':
                // 任务压缩：保留任务链
                strategy.keepLastN = 15;
                strategy.preserveKeyEvents = true;
                break;
            case 'approval':
                // 审批压缩：保留审批决策
                strategy.keepLastN = 10;
                strategy.preserveKeyEvents = true;
                break;
            case 'history':
                // 历史压缩：标准策略
                break;
        }
        // 根据上下文大小调整
        if ((context.contextSizeBytes || 0) > this.config.maxContextSizeBytes * 0.8) {
            strategy.keepLastN = Math.floor((strategy.keepLastN || 20) * 0.5);
        }
        return strategy;
    }
    /**
     * 获取触发原因
     */
    getTriggerReason(trigger, context) {
        switch (trigger) {
            case 'context_too_large':
                return `Message count (${context.messageCount}) exceeds limit (${this.config.maxMessageCount})`;
            case 'task_graph_too_deep':
                return `Task graph depth (${context.taskGraphDepth}) exceeds limit (${this.config.maxTaskGraphDepth})`;
            case 'subagent_results_too_many':
                return `Subagent results (${context.subagentResultCount}) exceeds limit (${this.config.maxSubagentResults})`;
            case 'approval_history_accumulated':
                return `Approval history (${context.approvalHistoryCount}) exceeds limit (${this.config.maxApprovalHistory})`;
            case 'memory_pressure':
                return `Context size (${context.contextSizeBytes} bytes) exceeds limit (${this.config.maxContextSizeBytes} bytes)`;
            case 'session_end':
                return 'Session ended, compacting history';
            case 'policy_triggered':
                return 'Policy triggered compact';
            default:
                return 'Unknown trigger';
        }
    }
    /**
     * 估算压缩率
     */
    estimateCompressionRatio(context, strategy) {
        // 简化估算：基于 keepLastN 和是否生成摘要
        const keepRatio = (strategy.keepLastN || 20) / (context.messageCount || 20);
        const summaryRatio = strategy.generateSummary ? 0.1 : 0;
        return Math.min(keepRatio + summaryRatio, 0.9);
    }
}
exports.CompactPolicyEvaluator = CompactPolicyEvaluator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建紧凑策略评估器
 */
function createCompactPolicyEvaluator(config) {
    return new CompactPolicyEvaluator(config);
}
/**
 * 快速评估紧凑需求
 */
function evaluateCompactNeed(context, config) {
    const evaluator = new CompactPolicyEvaluator(config);
    return evaluator.evaluateCompactNeed(context);
}
/**
 * 快速检查是否应该紧凑
 */
function shouldCompact(event, context, config) {
    const evaluator = new CompactPolicyEvaluator(config);
    return evaluator.shouldCompact(event, context);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGFjdF9wb2xpY3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXV0b21hdGlvbi9jb21wYWN0X3BvbGljeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7OztBQTRXSCxvRUFFQztBQUtELGtEQU1DO0FBS0Qsc0NBT0M7QUEzVEQsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0UsTUFBYSxzQkFBc0I7SUFHakMsWUFBWSxTQUE4QixFQUFFO1FBQzFDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsSUFBSSxHQUFHO1lBQzlDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxFQUFFO1lBQ2pELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxFQUFFO1lBQ25ELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxFQUFFO1lBQ25ELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxtQkFBbUIsSUFBSSxJQUFJLEdBQUcsSUFBSSxFQUFFLE1BQU07WUFDdEUsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixJQUFJLEVBQUU7WUFDL0MsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksSUFBSTtZQUMvQyxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtTQUN0RCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CLENBQUMsT0FBdUI7UUFDekMsV0FBVztRQUNYLE1BQU0sUUFBUSxHQUF5RCxFQUFFLENBQUM7UUFFMUUsU0FBUztRQUNULElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUQsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDWixPQUFPLEVBQUUsbUJB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ZSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV4RCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUFyUkQsd0RBcVJDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQiw0QkFBNEIsQ0FBQyxNQUE0QjtJQUN2RSxPQUFPLElBQUksc0JBQXNCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQ2pDLE9BQXVCLEVBQ3ZCLE1BQTRCO0lBRTVCLE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQXNCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckQsT0FBTyxTQUFTLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsYUFBYSxDQUMzQixLQUFhLEVBQ2IsT0FBdUIsRUFDdkIsTUFBNEI7SUFFNUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyRCxPQUFPLFNBQVMsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbXBhY3QgUG9saWN5IC0g57Sn5YeR5Y6L57yp562W55WlXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5Yik5a6a5L2V5pe2IGNvbXBhY3RcbiAqIDIuIOWIpOWumiBjb21wYWN0IOiMg+WbtFxuICogMy4g55Sf5oiQIGNvbXBhY3Qg5pGY6KaB562W55WlXG4gKiA0LiDkuI4gc2Vzc2lvbi90YXNrIOeUn+WRveWRqOacn+S6i+S7tuaMgumSqVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIENvbXBhY3REZWNpc2lvbixcbiAgQ29tcGFjdFRyaWdnZXIsXG4gIENvbXBhY3RTdHJhdGVneSxcbiAgQ29tcGFjdFBsYW4sXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDntKflh5Hor4TkvLDkuIrkuIvmlodcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb21wYWN0Q29udGV4dCB7XG4gIC8qKiDkvJror50gSUQgKi9cbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBcbiAgLyoqIOS7u+WKoSBJRCAqL1xuICB0YXNrSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiog5raI5oGvL+S6i+S7tuaVsOmHjyAqL1xuICBtZXNzYWdlQ291bnQ/OiBudW1iZXI7XG4gIFxuICAvKiog5Lu75Yqh5Zu+5rex5bqmICovXG4gIHRhc2tHcmFwaERlcHRoPzogbnVtYmVyO1xuICBcbiAgLyoqIOWtkOS7o+eQhue7k+aenOaVsOmHjyAqL1xuICBzdWJhZ2VudFJlc3VsdENvdW50PzogbnVtYmVyO1xuICBcbiAgLyoqIOWuoeaJueWOhuWPsuaVsOmHjyAqL1xuICBhcHByb3ZhbEhpc3RvcnlDb3VudD86IG51bWJlcjtcbiAgXG4gIC8qKiDkuIrkuIvmloflpKflsI/vvIjlrZfoioLvvIkgKi9cbiAgY29udGV4dFNpemVCeXRlcz86IG51bWJlcjtcbiAgXG4gIC8qKiDkvJror53mmK/lkKbnu5PmnZ8gKi9cbiAgc2Vzc2lvbkVuZGVkPzogYm9vbGVhbjtcbiAgXG4gIC8qKiDlhYPmlbDmja4gKi9cbiAgbWV0YWRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xufVxuXG4vKipcbiAqIOe0p+WHkeetlueVpemFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBhY3RQb2xpY3lDb25maWcge1xuICAvKiog5pyA5aSn5raI5oGv5pWw6ZiI5YC8ICovXG4gIG1heE1lc3NhZ2VDb3VudD86IG51bWJlcjtcbiAgXG4gIC8qKiDmnIDlpKfku7vliqHlm77mt7HluqYgKi9cbiAgbWF4VGFza0dyYXBoRGVwdGg/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA5aSn5a2Q5Luj55CG57uT5p6c5pWwICovXG4gIG1heFN1YmFnZW50UmVzdWx0cz86IG51bWJlcjtcbiAgXG4gIC8qKiDmnIDlpKflrqHmibnljoblj7LmlbAgKi9cbiAgbWF4QXBwcm92YWxIaXN0b3J5PzogbnVtYmVyO1xuICBcbiAgLyoqIOacgOWkp+S4iuS4i+aWh+Wkp+Wwj++8iOWtl+iKgu+8iSAqL1xuICBtYXhDb250ZXh0U2l6ZUJ5dGVzPzogbnVtYmVyO1xuICBcbiAgLyoqIOm7mOiupOS/neeVmea2iOaBr+aVsCAqL1xuICBkZWZhdWx0S2VlcExhc3ROPzogbnVtYmVyO1xuICBcbiAgLyoqIOaYr+WQpueUn+aIkOaRmOimgSAqL1xuICBnZW5lcmF0ZVN1bW1hcnk/OiBib29sZWFuO1xuICBcbiAgLyoqIOaRmOimgemVv+W6pumZkOWItiAqL1xuICBzdW1tYXJ5TGVuZ3RoTGltaXQ/OiBudW1iZXI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOe0p+WHkeetlueVpeivhOS8sOWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQ29tcGFjdFBvbGljeUV2YWx1YXRvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxDb21wYWN0UG9saWN5Q29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQ29tcGFjdFBvbGljeUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhNZXNzYWdlQ291bnQ6IGNvbmZpZy5tYXhNZXNzYWdlQ291bnQgPz8gMTAwLFxuICAgICAgbWF4VGFza0dyYXBoRGVwdGg6IGNvbmZpZy5tYXhUYXNrR3JhcGhEZXB0aCA/PyAxMCxcbiAgICAgIG1heFN1YmFnZW50UmVzdWx0czogY29uZmlnLm1heFN1YmFnZW50UmVzdWx0cyA/PyAyMCxcbiAgICAgIG1heEFwcHJvdmFsSGlzdG9yeTogY29uZmlnLm1heEFwcHJvdmFsSGlzdG9yeSA/PyA1MCxcbiAgICAgIG1heENvbnRleHRTaXplQnl0ZXM6IGNvbmZpZy5tYXhDb250ZXh0U2l6ZUJ5dGVzID8/IDEwMjQgKiAxMDI0LCAvLyAxTUJcbiAgICAgIGRlZmF1bHRLZWVwTGFzdE46IGNvbmZpZy5kZWZhdWx0S2VlcExhc3ROID8/IDIwLFxuICAgICAgZ2VuZXJhdGVTdW1tYXJ5OiBjb25maWcuZ2VuZXJhdGVTdW1tYXJ5ID8/IHRydWUsXG4gICAgICBzdW1tYXJ5TGVuZ3RoTGltaXQ6IGNvbmZpZy5zdW1tYXJ5TGVuZ3RoTGltaXQgPz8gMTAwMCxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw57Sn5YeR6ZyA5rGCXG4gICAqL1xuICBldmFsdWF0ZUNvbXBhY3ROZWVkKGNvbnRleHQ6IENvbXBhY3RDb250ZXh0KTogQ29tcGFjdERlY2lzaW9uIHtcbiAgICAvLyDmo4Dmn6XlkITkuKrop6blj5HmnaHku7ZcbiAgICBjb25zdCB0cmlnZ2VyczogQXJyYXk8eyB0cmlnZ2VyOiBDb21wYWN0VHJpZ2dlcjsgcHJpb3JpdHk6IG51bWJlciB9PiA9IFtdO1xuICAgIFxuICAgIC8vIOajgOafpea2iOaBr+aVsOmHj1xuICAgIGlmICgoY29udGV4dC5tZXNzYWdlQ291bnQgfHwgMCkgPiB0aGlzLmNvbmZpZy5tYXhNZXNzYWdlQ291bnQpIHtcbiAgICAgIHRyaWdnZXJzLnB1c2goe1xuICAgICAgICB0cmlnZ2VyOiAnY29udGV4dF90b29fbGFyZ2UnLFxuICAgICAgICBwcmlvcml0eTogOCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6Xku7vliqHlm77mt7HluqZcbiAgICBpZiAoKGNvbnRleHQudGFza0dyYXBoRGVwdGggfHwgMCkgPiB0aGlzLmNvbmZpZy5tYXhUYXNrR3JhcGhEZXB0aCkge1xuICAgICAgdHJpZ2dlcnMucHVzaCh7XG4gICAgICAgIHRyaWdnZXI6ICd0YXNrX2dyYXBoX3Rvb19kZWVwJyxcbiAgICAgICAgcHJpb3JpdHk6IDcsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5a2Q5Luj55CG57uT5p6c5pWw6YePXG4gICAgaWYgKChjb250ZXh0LnN1YmFnZW50UmVzdWx0Q291bnQgfHwgMCkgPiB0aGlzLmNvbmZpZy5tYXhTdWJhZ2VudFJlc3VsdHMpIHtcbiAgICAgIHRyaWdnZXJzLnB1c2goe1xuICAgICAgICB0cmlnZ2VyOiAnc3ViYWdlbnRfcmVzdWx0c190b29fbWFueScsXG4gICAgICAgIHByaW9yaXR5OiA2LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeWuoeaJueWOhuWPsuaVsOmHj1xuICAgIGlmICgoY29udGV4dC5hcHByb3ZhbEhpc3RvcnlDb3VudCB8fCAwKSA+IHRoaXMuY29uZmlnLm1heEFwcHJvdmFsSGlzdG9yeSkge1xuICAgICAgdHJpZ2dlcnMucHVzaCh7XG4gICAgICAgIHRyaWdnZXI6ICdhcHByb3ZhbF9oaXN0b3J5X2FjY3VtdWxhdGVkJyxcbiAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5LiK5LiL5paH5aSn5bCPXG4gICAgaWYgKChjb250ZXh0LmNvbnRleHRTaXplQnl0ZXMgfHwgMCkgPiB0aGlzLmNvbmZpZy5tYXhDb250ZXh0U2l6ZUJ5dGVzKSB7XG4gICAgICB0cmlnZ2Vycy5wdXNoKHtcbiAgICAgICAgdHJpZ2dlcjogJ21lbW9yeV9wcmVzc3VyZScsXG4gICAgICAgIHByaW9yaXR5OiA5LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeS8muivnee7k+adn1xuICAgIGlmIChjb250ZXh0LnNlc3Npb25FbmRlZCkge1xuICAgICAgdHJpZ2dlcnMucHVzaCh7XG4gICAgICAgIHRyaWdnZXI6ICdzZXNzaW9uX2VuZCcsXG4gICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDmsqHmnInop6blj5HmnaHku7ZcbiAgICBpZiAodHJpZ2dlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzaG91bGRDb21wYWN0OiBmYWxzZSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOmAieaLqeacgOmrmOS8mOWFiOe6p+eahOinpuWPkeadoeS7tlxuICAgIHRyaWdnZXJzLnNvcnQoKGEsIGIpID0+IGIucHJpb3JpdHkgLSBhLnByaW9yaXR5KTtcbiAgICBjb25zdCBoaWdoZXN0VHJpZ2dlciA9IHRyaWdnZXJzWzBdO1xuICAgIFxuICAgIC8vIOehruWumue0p+WHkeiMg+WbtFxuICAgIGxldCBzY29wZTogJ3Nlc3Npb24nIHwgJ3Rhc2snIHwgJ2FwcHJvdmFsJyB8ICdoaXN0b3J5JyA9ICdoaXN0b3J5JztcbiAgICBcbiAgICBpZiAoaGlnaGVzdFRyaWdnZXIudHJpZ2dlciA9PT0gJ3Nlc3Npb25fZW5kJykge1xuICAgICAgc2NvcGUgPSAnc2Vzc2lvbic7XG4gICAgfSBlbHNlIGlmIChoaWdoZXN0VHJpZ2dlci50cmlnZ2VyID09PSAndGFza19ncmFwaF90b29fZGVlcCcpIHtcbiAgICAgIHNjb3BlID0gJ3Rhc2snO1xuICAgIH0gZWxzZSBpZiAoaGlnaGVzdFRyaWdnZXIudHJpZ2dlciA9PT0gJ2FwcHJvdmFsX2hpc3RvcnlfYWNjdW11bGF0ZWQnKSB7XG4gICAgICBzY29wZSA9ICdhcHByb3ZhbCc7XG4gICAgfVxuICAgIFxuICAgIC8vIOaehOW7uue0p+WHkeetlueVpVxuICAgIGNvbnN0IHN0cmF0ZWd5ID0gdGhpcy5idWlsZENvbXBhY3RTdHJhdGVneShzY29wZSwgY29udGV4dCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHNob3VsZENvbXBhY3Q6IHRydWUsXG4gICAgICB0cmlnZ2VyOiBoaWdoZXN0VHJpZ2dlci50cmlnZ2VyLFxuICAgICAgcHJpb3JpdHk6IGhpZ2hlc3RUcmlnZ2VyLnByaW9yaXR5LFxuICAgICAgc2NvcGUsXG4gICAgICByZWFzb246IHRoaXMuZ2V0VHJpZ2dlclJlYXNvbihoaWdoZXN0VHJpZ2dlci50cmlnZ2VyLCBjb250ZXh0KSxcbiAgICAgIHN0cmF0ZWd5LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKblupTor6XntKflh5FcbiAgICovXG4gIHNob3VsZENvbXBhY3QoZXZlbnQ6IHN0cmluZywgY29udGV4dDogQ29tcGFjdENvbnRleHQpOiBib29sZWFuIHtcbiAgICBjb25zdCBkZWNpc2lvbiA9IHRoaXMuZXZhbHVhdGVDb21wYWN0TmVlZChjb250ZXh0KTtcbiAgICByZXR1cm4gZGVjaXNpb24uc2hvdWxkQ29tcGFjdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uue0p+WHkeiuoeWIklxuICAgKi9cbiAgYnVpbGRDb21wYWN0UGxhbihjb250ZXh0OiBDb21wYWN0Q29udGV4dCk6IENvbXBhY3RQbGFuIHtcbiAgICBjb25zdCBkZWNpc2lvbiA9IHRoaXMuZXZhbHVhdGVDb21wYWN0TmVlZChjb250ZXh0KTtcbiAgICBcbiAgICBpZiAoIWRlY2lzaW9uLnNob3VsZENvbXBhY3QgfHwgIWRlY2lzaW9uLnN0cmF0ZWd5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBhY3Qgbm90IG5lZWRlZCcpO1xuICAgIH1cbiAgICBcbiAgICAvLyDkvLDnrpfljovnvKnnjodcbiAgICBjb25zdCBlc3RpbWF0ZWRDb21wcmVzc2lvblJhdGlvID0gdGhpcy5lc3RpbWF0ZUNvbXByZXNzaW9uUmF0aW8oY29udGV4dCwgZGVjaXNpb24uc3RyYXRlZ3kpO1xuICAgIFxuICAgIC8vIOS8sOeul+iKguecgeepuumXtFxuICAgIGNvbnN0IGVzdGltYXRlZFNwYWNlU2F2ZWQgPSBjb250ZXh0LmNvbnRleHRTaXplQnl0ZXNcbiAgICAgID8gTWF0aC5mbG9vcihjb250ZXh0LmNvbnRleHRTaXplQnl0ZXMgKiAoMSAtIGVzdGltYXRlZENvbXByZXNzaW9uUmF0aW8pKVxuICAgICAgOiB1bmRlZmluZWQ7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHNjb3BlOiBkZWNpc2lvbi5zY29wZSB8fCAnaGlzdG9yeScsXG4gICAgICB0cmlnZ2VyOiBkZWNpc2lvbi50cmlnZ2VyIHx8ICdwb2xpY3lfdHJpZ2dlcmVkJyxcbiAgICAgIHN0cmF0ZWd5OiBkZWNpc2lvbi5zdHJhdGVneSxcbiAgICAgIGVzdGltYXRlZENvbXByZXNzaW9uUmF0aW8sXG4gICAgICBlc3RpbWF0ZWRTcGFjZVNhdmVkLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDntKflh5HmkZjopoFcbiAgICovXG4gIHN1bW1hcml6ZUZvckNvbXBhY3QoY29udGV4dDogQ29tcGFjdENvbnRleHQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN1bW1hcmllczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDku7vliqHmkZjopoFcbiAgICBpZiAoY29udGV4dC50YXNrSWQpIHtcbiAgICAgIHN1bW1hcmllcy5wdXNoKGBUYXNrOiAke2NvbnRleHQudGFza0lkfWApO1xuICAgIH1cbiAgICBcbiAgICAvLyDkvJror53mkZjopoFcbiAgICBpZiAoY29udGV4dC5zZXNzaW9uSWQpIHtcbiAgICAgIHN1bW1hcmllcy5wdXNoKGBTZXNzaW9uOiAke2NvbnRleHQuc2Vzc2lvbklkfWApO1xuICAgIH1cbiAgICBcbiAgICAvLyDnu5/orqHmkZjopoFcbiAgICBjb25zdCBzdGF0czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoY29udGV4dC5tZXNzYWdlQ291bnQpIHtcbiAgICAgIHN0YXRzLnB1c2goYCR7Y29udGV4dC5tZXNzYWdlQ291bnR9IG1lc3NhZ2VzYCk7XG4gICAgfVxuICAgIGlmIChjb250ZXh0LnRhc2tHcmFwaERlcHRoKSB7XG4gICAgICBzdGF0cy5wdXNoKGB0YXNrIGRlcHRoOiAke2NvbnRleHQudGFza0dyYXBoRGVwdGh9YCk7XG4gICAgfVxuICAgIGlmIChjb250ZXh0LnN1YmFnZW50UmVzdWx0Q291bnQpIHtcbiAgICAgIHN0YXRzLnB1c2goYCR7Y29udGV4dC5zdWJhZ2VudFJlc3VsdENvdW50fSBzdWJhZ2VudCByZXN1bHRzYCk7XG4gICAgfVxuICAgIGlmIChjb250ZXh0LmFwcHJvdmFsSGlzdG9yeUNvdW50KSB7XG4gICAgICBzdGF0cy5wdXNoKGAke2NvbnRleHQuYXBwcm92YWxIaXN0b3J5Q291bnR9IGFwcHJvdmFsc2ApO1xuICAgIH1cbiAgICBcbiAgICBpZiAoc3RhdHMubGVuZ3RoID4gMCkge1xuICAgICAgc3VtbWFyaWVzLnB1c2goYFN0YXRzOiAke3N0YXRzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdW1tYXJpZXMuam9pbignIHwgJyk7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rntKflh5HnrZbnlaVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRDb21wYWN0U3RyYXRlZ3koXG4gICAgc2NvcGU6ICdzZXNzaW9uJyB8ICd0YXNrJyB8ICdhcHByb3ZhbCcgfCAnaGlzdG9yeScsXG4gICAgY29udGV4dDogQ29tcGFjdENvbnRleHRcbiAgKTogQ29tcGFjdFN0cmF0ZWd5IHtcbiAgICBjb25zdCBzdHJhdGVneTogQ29tcGFjdFN0cmF0ZWd5ID0ge1xuICAgICAga2VlcExhc3ROOiB0aGlzLmNvbmZpZy5kZWZhdWx0S2VlcExhc3ROLFxuICAgICAgZ2VuZXJhdGVTdW1tYXJ5OiB0aGlzLmNvbmZpZy5nZW5lcmF0ZVN1bW1hcnksXG4gICAgICBzdW1tYXJ5TGVuZ3RoTGltaXQ6IHRoaXMuY29uZmlnLnN1bW1hcnlMZW5ndGhMaW1pdCxcbiAgICB9O1xuICAgIFxuICAgIC8vIOagueaNruiMg+WbtOiwg+aVtOetlueVpVxuICAgIHN3aXRjaCAoc2NvcGUpIHtcbiAgICAgIGNhc2UgJ3Nlc3Npb24nOlxuICAgICAgICAvLyDkvJror53nu5PmnZ/vvJrkv53nlZnmm7TlpJrlhbPplK7kv6Hmga9cbiAgICAgICAgc3RyYXRlZ3kua2VlcExhc3ROID0gMzA7XG4gICAgICAgIHN0cmF0ZWd5LnByZXNlcnZlS2V5RXZlbnRzID0gdHJ1ZTtcbiAgICAgICAgc3RyYXRlZ3kuY29tcHJlc3NBdHRhY2htZW50cyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICd0YXNrJzpcbiAgICAgICAgLy8g5Lu75Yqh5Y6L57yp77ya5L+d55WZ5Lu75Yqh6ZO+XG4gICAgICAgIHN0cmF0ZWd5LmtlZXBMYXN0TiA9IDE1O1xuICAgICAgICBzdHJhdGVneS5wcmVzZXJ2ZUtleUV2ZW50cyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdhcHByb3ZhbCc6XG4gICAgICAgIC8vIOWuoeaJueWOi+e8qe+8muS/neeVmeWuoeaJueWGs+etllxuICAgICAgICBzdHJhdGVneS5rZWVwTGFzdE4gPSAxMDtcbiAgICAgICAgc3RyYXRlZ3kucHJlc2VydmVLZXlFdmVudHMgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnaGlzdG9yeSc6XG4gICAgICAgIC8vIOWOhuWPsuWOi+e8qe+8muagh+WHhuetlueVpVxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u5LiK5LiL5paH5aSn5bCP6LCD5pW0XG4gICAgaWYgKChjb250ZXh0LmNvbnRleHRTaXplQnl0ZXMgfHwgMCkgPiB0aGlzLmNvbmZpZy5tYXhDb250ZXh0U2l6ZUJ5dGVzICogMC44KSB7XG4gICAgICBzdHJhdGVneS5rZWVwTGFzdE4gPSBNYXRoLmZsb29yKChzdHJhdGVneS5rZWVwTGFzdE4gfHwgMjApICogMC41KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cmF0ZWd5O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6Kem5Y+R5Y6f5ZugXG4gICAqL1xuICBwcml2YXRlIGdldFRyaWdnZXJSZWFzb24oXG4gICAgdHJpZ2dlcjogQ29tcGFjdFRyaWdnZXIsXG4gICAgY29udGV4dDogQ29tcGFjdENvbnRleHRcbiAgKTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKHRyaWdnZXIpIHtcbiAgICAgIGNhc2UgJ2NvbnRleHRfdG9vX2xhcmdlJzpcbiAgICAgICAgcmV0dXJuIGBNZXNzYWdlIGNvdW50ICgke2NvbnRleHQubWVzc2FnZUNvdW50fSkgZXhjZWVkcyBsaW1pdCAoJHt0aGlzLmNvbmZpZy5tYXhNZXNzYWdlQ291bnR9KWA7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Rhc2tfZ3JhcGhfdG9vX2RlZXAnOlxuICAgICAgICByZXR1cm4gYFRhc2sgZ3JhcGggZGVwdGggKCR7Y29udGV4dC50YXNrR3JhcGhEZXB0aH0pIGV4Y2VlZHMgbGltaXQgKCR7dGhpcy5jb25maWcubWF4VGFza0dyYXBoRGVwdGh9KWA7XG4gICAgICBcbiAgICAgIGNhc2UgJ3N1YmFnZW50X3Jlc3VsdHNfdG9vX21hbnknOlxuICAgICAgICByZXR1cm4gYFN1YmFnZW50IHJlc3VsdHMgKCR7Y29udGV4dC5zdWJhZ2VudFJlc3VsdENvdW50fSkgZXhjZWVkcyBsaW1pdCAoJHt0aGlzLmNvbmZpZy5tYXhTdWJhZ2VudFJlc3VsdHN9KWA7XG4gICAgICBcbiAgICAgIGNhc2UgJ2FwcHJvdmFsX2hpc3RvcnlfYWNjdW11bGF0ZWQnOlxuICAgICAgICByZXR1cm4gYEFwcHJvdmFsIGhpc3RvcnkgKCR7Y29udGV4dC5hcHByb3ZhbEhpc3RvcnlDb3VudH0pIGV4Y2VlZHMgbGltaXQgKCR7dGhpcy5jb25maWcubWF4QXBwcm92YWxIaXN0b3J5fSlgO1xuICAgICAgXG4gICAgICBjYXNlICdtZW1vcnlfcHJlc3N1cmUnOlxuICAgICAgICByZXR1cm4gYENvbnRleHQgc2l6ZSAoJHtjb250ZXh0LmNvbnRleHRTaXplQnl0ZXN9IGJ5dGVzKSBleGNlZWRzIGxpbWl0ICgke3RoaXMuY29uZmlnLm1heENvbnRleHRTaXplQnl0ZXN9IGJ5dGVzKWA7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Nlc3Npb25fZW5kJzpcbiAgICAgICAgcmV0dXJuICdTZXNzaW9uIGVuZGVkLCBjb21wYWN0aW5nIGhpc3RvcnknO1xuICAgICAgXG4gICAgICBjYXNlICdwb2xpY3lfdHJpZ2dlcmVkJzpcbiAgICAgICAgcmV0dXJuICdQb2xpY3kgdHJpZ2dlcmVkIGNvbXBhY3QnO1xuICAgICAgXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJ1Vua25vd24gdHJpZ2dlcic7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5Lyw566X5Y6L57yp546HXG4gICAqL1xuICBwcml2YXRlIGVzdGltYXRlQ29tcHJlc3Npb25SYXRpbyhcbiAgICBjb250ZXh0OiBDb21wYWN0Q29udGV4dCxcbiAgICBzdHJhdGVneTogQ29tcGFjdFN0cmF0ZWd5XG4gICk6IG51bWJlciB7XG4gICAgLy8g566A5YyW5Lyw566X77ya5Z+65LqOIGtlZXBMYXN0TiDlkozmmK/lkKbnlJ/miJDmkZjopoFcbiAgICBjb25zdCBrZWVwUmF0aW8gPSAoc3RyYXRlZ3kua2VlcExhc3ROIHx8IDIwKSAvIChjb250ZXh0Lm1lc3NhZ2VDb3VudCB8fCAyMCk7XG4gICAgY29uc3Qgc3VtbWFyeVJhdGlvID0gc3RyYXRlZ3kuZ2VuZXJhdGVTdW1tYXJ5ID8gMC4xIDogMDtcbiAgICBcbiAgICByZXR1cm4gTWF0aC5taW4oa2VlcFJhdGlvICsgc3VtbWFyeVJhdGlvLCAwLjkpO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uue0p+WHkeetlueVpeivhOS8sOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGFjdFBvbGljeUV2YWx1YXRvcihjb25maWc/OiBDb21wYWN0UG9saWN5Q29uZmlnKTogQ29tcGFjdFBvbGljeUV2YWx1YXRvciB7XG4gIHJldHVybiBuZXcgQ29tcGFjdFBvbGljeUV2YWx1YXRvcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ivhOS8sOe0p+WHkemcgOaxglxuICovXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVDb21wYWN0TmVlZChcbiAgY29udGV4dDogQ29tcGFjdENvbnRleHQsXG4gIGNvbmZpZz86IENvbXBhY3RQb2xpY3lDb25maWdcbik6IENvbXBhY3REZWNpc2lvbiB7XG4gIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBDb21wYWN0UG9saWN5RXZhbHVhdG9yKGNvbmZpZyk7XG4gIHJldHVybiBldmFsdWF0b3IuZXZhbHVhdGVDb21wYWN0TmVlZChjb250ZXh0KTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mo4Dmn6XmmK/lkKblupTor6XntKflh5FcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENvbXBhY3QoXG4gIGV2ZW50OiBzdHJpbmcsXG4gIGNvbnRleHQ6IENvbXBhY3RDb250ZXh0LFxuICBjb25maWc/OiBDb21wYWN0UG9saWN5Q29uZmlnXG4pOiBib29sZWFuIHtcbiAgY29uc3QgZXZhbHVhdG9yID0gbmV3IENvbXBhY3RQb2xpY3lFdmFsdWF0b3IoY29uZmlnKTtcbiAgcmV0dXJuIGV2YWx1YXRvci5zaG91bGRDb21wYWN0KGV2ZW50LCBjb250ZXh0KTtcbn1cbiJdfQ==