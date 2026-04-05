"use strict";
/**
 * Verification Scope - 验证范围建议器
 *
 * 职责：
 * 1. 根据影响报告生成验证范围建议
 * 2. 输出 smoke / targeted / broad 三档
 * 3. 给出范围原因
 * 4. 推荐测试文件
 * 5. 建议额外检查
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationScopeAdvisor = void 0;
exports.createVerificationScopeAdvisor = createVerificationScopeAdvisor;
exports.generateVerificationPlan = generateVerificationPlan;
// ============================================================================
// 验证范围建议器
// ============================================================================
class VerificationScopeAdvisor {
    constructor(config = {}) {
        this.config = {
            riskThresholds: config.riskThresholds ?? {
                low: 0.3,
                medium: 0.6,
                high: 0.9,
            },
            maxSuggestedTests: config.maxSuggestedTests ?? 30,
        };
    }
    /**
     * 生成验证计划
     */
    async advise(impactReport) {
        // 确定验证范围
        const scope = this.determineScope(impactReport);
        // 选择建议测试
        const suggestedTests = this.selectTests(impactReport.relatedTests, scope);
        // 生成额外检查
        const extraChecks = this.generateExtraChecks(impactReport);
        // 生成范围原因
        const whyThisScope = this.explainScope(scope, impactReport);
        // 计算预计测试数量
        const estimatedTestCount = this.estimateTestCount(suggestedTests, extraChecks);
        return {
            scope,
            suggestedTests,
            extraChecks,
            whyThisScope,
            risk: impactReport.risk,
            estimatedTestCount,
        };
    }
    /**
     * 确定验证范围
     */
    determineScope(impactReport) {
        const { risk, changedFiles, affectedEntrypoints, impactedSymbols, relatedTests } = impactReport;
        // Broad 范围条件
        if (this.shouldBroad(impactReport)) {
            return 'broad';
        }
        // Smoke 范围条件
        if (this.shouldSmoke(impactReport)) {
            return 'smoke';
        }
        // 默认 Targeted
        return 'targeted';
    }
    /**
     * 判断是否需要 Broad 验证
     */
    shouldBroad(impactReport) {
        const { risk, affectedEntrypoints, impactedSymbols, relatedTests } = impactReport;
        // 高风险
        if (risk === 'high') {
            return true;
        }
        // 入口点受影响
        if (affectedEntrypoints.length > 0) {
            return true;
        }
        // 大量导出符号受影响
        const exportedSymbols = impactedSymbols.filter(s => s.exported);
        if (exportedSymbols.length > 5) {
            return true;
        }
        // 相关测试很分散
        if (relatedTests.length > 20) {
            return true;
        }
        // 核心模块变更
        const corePatterns = ['/core/', '/shared/', '/lib/', '/auth/', '/payment/', '/db/'];
        for (const file of impactReport.changedFiles) {
            for (const pattern of corePatterns) {
                if (file.includes(pattern)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * 判断是否只需 Smoke 验证
     */
    shouldSmoke(impactReport) {
        const { changedFiles, relatedTests } = impactReport;
        // 只变更文档
        const docPatterns = ['.md', '.rst', 'README', 'CHANGELOG', 'CONTRIBUTING', 'docs/'];
        const allDocs = changedFiles.every(file => docPatterns.some(pattern => file.includes(pattern)));
        if (allDocs) {
            return true;
        }
        // 只变更配置
        const configPatterns = ['.json', '.yaml', '.yml', '.toml', '.ini', 'config/'];
        const allConfig = changedFiles.every(file => configPatterns.some(pattern => file.includes(pattern)));
        if (allConfig) {
            return true;
        }
        // 只变更测试文件
        const testPatterns = ['.test.', '.spec.', 'test_', '_test', '/tests/', '/__tests__/'];
        const allTests = changedFiles.every(file => testPatterns.some(pattern => file.includes(pattern)));
        if (allTests) {
            return true;
        }
        // 没有相关测试
        if (relatedTests.length === 0) {
            return true;
        }
        return false;
    }
    /**
     * 选择建议测试
     */
    selectTests(tests, scope) {
        // 按置信度排序
        const sorted = [...tests].sort((a, b) => b.confidence - a.confidence);
        // 按范围限制数量
        const limits = {
            smoke: 5,
            targeted: 15,
            broad: this.config.maxSuggestedTests,
        };
        return sorted.slice(0, limits[scope]);
    }
    /**
     * 生成额外检查
     */
    generateExtraChecks(impactReport) {
        const checks = [];
        // 入口点变更 → 检查启动
        if (impactReport.affectedEntrypoints.length > 0) {
            checks.push('Verify application startup');
            checks.push('Run smoke tests on main entrypoints');
        }
        // API 变更 → 检查接口
        const apiChanges = impactReport.changedFiles.filter(f => f.includes('/api/'));
        if (apiChanges.length > 0) {
            checks.push('Verify API contract compatibility');
            checks.push('Run integration tests for affected endpoints');
        }
        // 数据库变更 → 检查迁移
        const dbChanges = impactReport.changedFiles.filter(f => f.includes('/db/') || f.includes('/migration/'));
        if (dbChanges.length > 0) {
            checks.push('Verify database migrations');
            checks.push('Run data integrity checks');
        }
        // 认证变更 → 安全检查
        const authChanges = impactReport.changedFiles.filter(f => f.includes('/auth/') || f.includes('/security/'));
        if (authChanges.length > 0) {
            checks.push('Run security tests');
            checks.push('Verify authentication flows');
        }
        // 大量符号变更 → 检查回归
        if (impactReport.impactedSymbols.length > 10) {
            checks.push('Run regression tests');
            checks.push('Check for breaking changes');
        }
        return checks;
    }
    /**
     * 解释范围选择原因
     */
    explainScope(scope, impactReport) {
        switch (scope) {
            case 'smoke':
                return this.explainSmoke(impactReport);
            case 'targeted':
                return this.explainTargeted(impactReport);
            case 'broad':
                return this.explainBroad(impactReport);
        }
    }
    /**
     * 解释 Smoke 范围
     */
    explainSmoke(impactReport) {
        const reasons = [];
        if (impactReport.changedFiles.every(f => f.includes('.md') || f.includes('docs/'))) {
            reasons.push('Changes are documentation-only');
        }
        if (impactReport.changedFiles.every(f => f.includes('.json') || f.includes('.yaml') || f.includes('config/'))) {
            reasons.push('Changes are configuration-only');
        }
        if (impactReport.relatedTests.length === 0) {
            reasons.push('No related tests found');
        }
        if (impactReport.risk === 'low') {
            reasons.push('Low risk assessment');
        }
        return reasons.length > 0
            ? `Smoke verification recommended: ${reasons.join('; ')}`
            : 'Minimal changes detected, smoke verification sufficient';
    }
    /**
     * 解释 Targeted 范围
     */
    explainTargeted(impactReport) {
        const reasons = [];
        reasons.push(`${impactReport.changedFiles.length} file(s) changed`);
        if (impactReport.relatedTests.length > 0) {
            reasons.push(`${impactReport.relatedTests.length} related test(s) identified`);
        }
        if (impactReport.impactedSymbols.length > 0) {
            reasons.push(`${impactReport.impactedSymbols.length} symbol(s) affected`);
        }
        reasons.push('Business logic changes require targeted verification');
        return `Targeted verification recommended: ${reasons.join('; ')}`;
    }
    /**
     * 解释 Broad 范围
     */
    explainBroad(impactReport) {
        const reasons = [];
        if (impactReport.risk === 'high') {
            reasons.push('High risk assessment');
        }
        if (impactReport.affectedEntrypoints.length > 0) {
            reasons.push(`${impactReport.affectedEntrypoints.length} entrypoint(s) affected`);
        }
        const exportedSymbols = impactReport.impactedSymbols.filter(s => s.exported);
        if (exportedSymbols.length > 0) {
            reasons.push(`${exportedSymbols.length} exported symbol(s) affected`);
        }
        if (impactReport.relatedTests.length > 20) {
            reasons.push('Wide test impact detected');
        }
        const corePatterns = ['/core/', '/shared/', '/lib/'];
        const coreChanges = impactReport.changedFiles.filter(f => corePatterns.some(p => f.includes(p)));
        if (coreChanges.length > 0) {
            reasons.push('Core module changes detected');
        }
        return `Broad verification required: ${reasons.join('; ')}`;
    }
    /**
     * 估计测试数量
     */
    estimateTestCount(tests, extraChecks) {
        return tests.length + extraChecks.length;
    }
}
exports.VerificationScopeAdvisor = VerificationScopeAdvisor;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建验证范围建议器
 */
function createVerificationScopeAdvisor(config) {
    return new VerificationScopeAdvisor(config);
}
/**
 * 快速生成验证计划
 */
async function generateVerificationPlan(impactReport) {
    const advisor = new VerificationScopeAdvisor();
    return await advisor.advise(impactReport);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVyaWZpY2F0aW9uX3Njb3BlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvZGUvdmVyaWZpY2F0aW9uX3Njb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7OztBQXdVSCx3RUFJQztBQUtELDREQUtDO0FBbFZELCtFQUErRTtBQUMvRSxVQUFVO0FBQ1YsK0VBQStFO0FBRS9FLE1BQWEsd0JBQXdCO0lBR25DLFlBQVksU0FBa0MsRUFBRTtRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osY0FBYyxFQUFFLE1BQU0sQ0FBQyxjQUFjLElBQUk7Z0JBQ3ZDLEdBQUcsRUFBRSxHQUFHO2dCQUNSLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxHQUFHO2FBQ1Y7WUFDRCxpQkFBaUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCLElBQUksRUFBRTtTQUNsRCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUEwQjtRQUNyQyxTQUFTO1FBQ1QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVoRCxTQUFTO1FBQ1QsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTFFLFNBQVM7UUFDVCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFM0QsU0FBUztRQUNULE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRTVELFdBQVc7UUFDWCxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFL0UsT0FBTztZQUNMLEtBQUs7WUFDTCxjQUFj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SSxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUN2RCxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUN0QyxDQUFDO1FBQ0YsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsT0FBTyxnQ0FBZ0MsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO0lBQzlELENBQUM7SUFFRDs7T0FFRztJQUNLLGlCQUFpQixDQUFDLEtBQWdCLEVBQUUsV0FBcUI7UUFDL0QsT0FBTyxLQUFLLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDM0MsQ0FBQztDQUNGO0FBdlRELDREQXVUQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IsOEJBQThCLENBQzVDLE1BQWdDO0lBRWhDLE9BQU8sSUFBSSx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsd0JBQXdCLENBQzVDLFlBQTBCO0lBRTFCLE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQXdCLEVBQUUsQ0FBQztJQUMvQyxPQUFPLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBWZXJpZmljYXRpb24gU2NvcGUgLSDpqozor4HojIPlm7Tlu7rorq7lmahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDmoLnmja7lvbHlk43miqXlkYrnlJ/miJDpqozor4HojIPlm7Tlu7rorq5cbiAqIDIuIOi+k+WHuiBzbW9rZSAvIHRhcmdldGVkIC8gYnJvYWQg5LiJ5qGjXG4gKiAzLiDnu5nlh7rojIPlm7Tljp/lm6BcbiAqIDQuIOaOqOiNkOa1i+ivleaWh+S7tlxuICogNS4g5bu66K6u6aKd5aSW5qOA5p+lXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHsgVmVyaWZpY2F0aW9uUGxhbiwgVmVyaWZpY2F0aW9uU2NvcGUsIFJpc2tMZXZlbCwgVGVzdFJlZiwgSW1wYWN0UmVwb3J0LCBWZXJpZmljYXRpb25TY29wZUNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpqozor4HojIPlm7Tlu7rorq7lmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFZlcmlmaWNhdGlvblNjb3BlQWR2aXNvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxWZXJpZmljYXRpb25TY29wZUNvbmZpZz47XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFZlcmlmaWNhdGlvblNjb3BlQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHJpc2tUaHJlc2hvbGRzOiBjb25maWcucmlza1RocmVzaG9sZHMgPz8ge1xuICAgICAgICBsb3c6IDAuMyxcbiAgICAgICAgbWVkaXVtOiAwLjYsXG4gICAgICAgIGhpZ2g6IDAuOSxcbiAgICAgIH0sXG4gICAgICBtYXhTdWdnZXN0ZWRUZXN0czogY29uZmlnLm1heFN1Z2dlc3RlZFRlc3RzID8/IDMwLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDpqozor4HorqHliJJcbiAgICovXG4gIGFzeW5jIGFkdmlzZShpbXBhY3RSZXBvcnQ6IEltcGFjdFJlcG9ydCk6IFByb21pc2U8VmVyaWZpY2F0aW9uUGxhbj4ge1xuICAgIC8vIOehruWumumqjOivgeiMg+WbtFxuICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXRlcm1pbmVTY29wZShpbXBhY3RSZXBvcnQpO1xuICAgIFxuICAgIC8vIOmAieaLqeW7uuiurua1i+ivlVxuICAgIGNvbnN0IHN1Z2dlc3RlZFRlc3RzID0gdGhpcy5zZWxlY3RUZXN0cyhpbXBhY3RSZXBvcnQucmVsYXRlZFRlc3RzLCBzY29wZSk7XG4gICAgXG4gICAgLy8g55Sf5oiQ6aKd5aSW5qOA5p+lXG4gICAgY29uc3QgZXh0cmFDaGVja3MgPSB0aGlzLmdlbmVyYXRlRXh0cmFDaGVja3MoaW1wYWN0UmVwb3J0KTtcbiAgICBcbiAgICAvLyDnlJ/miJDojIPlm7Tljp/lm6BcbiAgICBjb25zdCB3aHlUaGlzU2NvcGUgPSB0aGlzLmV4cGxhaW5TY29wZShzY29wZSwgaW1wYWN0UmVwb3J0KTtcbiAgICBcbiAgICAvLyDorqHnrpfpooTorqHmtYvor5XmlbDph49cbiAgICBjb25zdCBlc3RpbWF0ZWRUZXN0Q291bnQgPSB0aGlzLmVzdGltYXRlVGVzdENvdW50KHN1Z2dlc3RlZFRlc3RzLCBleHRyYUNoZWNrcyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHNjb3BlLFxuICAgICAgc3VnZ2VzdGVkVGVzdHMsXG4gICAgICBleHRyYUNoZWNrcyxcbiAgICAgIHdoeVRoaXNTY29wZSxcbiAgICAgIHJpc2s6IGltcGFjdFJlcG9ydC5yaXNrLFxuICAgICAgZXN0aW1hdGVkVGVzdENvdW50LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnoa7lrprpqozor4HojIPlm7RcbiAgICovXG4gIHByaXZhdGUgZGV0ZXJtaW5lU2NvcGUoaW1wYWN0UmVwb3J0OiBJbXBhY3RSZXBvcnQpOiBWZXJpZmljYXRpb25TY29wZSB7XG4gICAgY29uc3QgeyByaXNrLCBjaGFuZ2VkRmlsZXMsIGFmZmVjdGVkRW50cnlwb2ludHMsIGltcGFjdGVkU3ltYm9scywgcmVsYXRlZFRlc3RzIH0gPSBpbXBhY3RSZXBvcnQ7XG4gICAgXG4gICAgLy8gQnJvYWQg6IyD5Zu05p2h5Lu2XG4gICAgaWYgKHRoaXMuc2hvdWxkQnJvYWQoaW1wYWN0UmVwb3J0KSkge1xuICAgICAgcmV0dXJuICdicm9hZCc7XG4gICAgfVxuICAgIFxuICAgIC8vIFNtb2tlIOiMg+WbtOadoeS7tlxuICAgIGlmICh0aGlzLnNob3VsZFNtb2tlKGltcGFjdFJlcG9ydCkpIHtcbiAgICAgIHJldHVybiAnc21va2UnO1xuICAgIH1cbiAgICBcbiAgICAvLyDpu5jorqQgVGFyZ2V0ZWRcbiAgICByZXR1cm4gJ3RhcmdldGVkJztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIpOaWreaYr+WQpumcgOimgSBCcm9hZCDpqozor4FcbiAgICovXG4gIHByaXZhdGUgc2hvdWxkQnJvYWQoaW1wYWN0UmVwb3J0OiBJbXBhY3RSZXBvcnQpOiBib29sZWFuIHtcbiAgICBjb25zdCB7IHJpc2ssIGFmZmVjdGVkRW50cnlwb2ludHMsIGltcGFjdGVkU3ltYm9scywgcmVsYXRlZFRlc3RzIH0gPSBpbXBhY3RSZXBvcnQ7XG4gICAgXG4gICAgLy8g6auY6aOO6ZmpXG4gICAgaWYgKHJpc2sgPT09ICdoaWdoJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIC8vIOWFpeWPo+eCueWPl+W9seWTjVxuICAgIGlmIChhZmZlY3RlZEVudHJ5cG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyDlpKfph4/lr7zlh7rnrKblj7flj5flvbHlk41cbiAgICBjb25zdCBleHBvcnRlZFN5bWJvbHMgPSBpbXBhY3RlZFN5bWJvbHMuZmlsdGVyKHMgPT4gcy5leHBvcnRlZCk7XG4gICAgaWYgKGV4cG9ydGVkU3ltYm9scy5sZW5ndGggPiA1KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g55u45YWz5rWL6K+V5b6I5YiG5pWjXG4gICAgaWYgKHJlbGF0ZWRUZXN0cy5sZW5ndGggPiAyMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIC8vIOaguOW/g+aooeWdl+WPmOabtFxuICAgIGNvbnN0IGNvcmVQYXR0ZXJucyA9IFsnL2NvcmUvJywgJy9zaGFyZWQvJywgJy9saWIvJywgJy9hdXRoLycsICcvcGF5bWVudC8nLCAnL2RiLyddO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBpbXBhY3RSZXBvcnQuY2hhbmdlZEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgY29yZVBhdHRlcm5zKSB7XG4gICAgICAgIGlmIChmaWxlLmluY2x1ZGVzKHBhdHRlcm4pKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvKipcbiAgICog5Yik5pat5piv5ZCm5Y+q6ZyAIFNtb2tlIOmqjOivgVxuICAgKi9cbiAgcHJpdmF0ZSBzaG91bGRTbW9rZShpbXBhY3RSZXBvcnQ6IEltcGFjdFJlcG9ydCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHsgY2hhbmdlZEZpbGVzLCByZWxhdGVkVGVzdHMgfSA9IGltcGFjdFJlcG9ydDtcbiAgICBcbiAgICAvLyDlj6rlj5jmm7TmlofmoaNcbiAgICBjb25zdCBkb2NQYXR0ZXJucyA9IFsnLm1kJywgJy5yc3QnLCAnUkVBRE1FJywgJ0NIQU5HRUxPRycsICdDT05UUklCVVRJTkcnLCAnZG9jcy8nXTtcbiAgICBjb25zdCBhbGxEb2NzID0gY2hhbmdlZEZpbGVzLmV2ZXJ5KGZpbGUgPT5cbiAgICAgIGRvY1BhdHRlcm5zLnNvbWUocGF0dGVybiA9PiBmaWxlLmluY2x1ZGVzKHBhdHRlcm4pKVxuICAgICk7XG4gICAgaWYgKGFsbERvY3MpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyDlj6rlj5jmm7TphY3nva5cbiAgICBjb25zdCBjb25maWdQYXR0ZXJucyA9IFsnLmpzb24nLCAnLnlhbWwnLCAnLnltbCcsICcudG9tbCcsICcuaW5pJywgJ2NvbmZpZy8nXTtcbiAgICBjb25zdCBhbGxDb25maWcgPSBjaGFuZ2VkRmlsZXMuZXZlcnkoZmlsZSA9PlxuICAgICAgY29uZmlnUGF0dGVybnMuc29tZShwYXR0ZXJuID0+IGZpbGUuaW5jbHVkZXMocGF0dGVybikpXG4gICAgKTtcbiAgICBpZiAoYWxsQ29uZmlnKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5Y+q5Y+Y5pu05rWL6K+V5paH5Lu2XG4gICAgY29uc3QgdGVzdFBhdHRlcm5zID0gWycudGVzdC4nLCAnLnNwZWMuJywgJ3Rlc3RfJywgJ190ZXN0JywgJy90ZXN0cy8nLCAnL19fdGVzdHNfXy8nXTtcbiAgICBjb25zdCBhbGxUZXN0cyA9IGNoYW5nZWRGaWxlcy5ldmVyeShmaWxlID0+XG4gICAgICB0ZXN0UGF0dGVybnMuc29tZShwYXR0ZXJuID0+IGZpbGUuaW5jbHVkZXMocGF0dGVybikpXG4gICAgKTtcbiAgICBpZiAoYWxsVGVzdHMpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyDmsqHmnInnm7jlhbPmtYvor5VcbiAgICBpZiAocmVsYXRlZFRlc3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmAieaLqeW7uuiurua1i+ivlVxuICAgKi9cbiAgcHJpdmF0ZSBzZWxlY3RUZXN0cyh0ZXN0czogVGVzdFJlZltdLCBzY29wZTogVmVyaWZpY2F0aW9uU2NvcGUpOiBUZXN0UmVmW10ge1xuICAgIC8vIOaMiee9ruS/oeW6puaOkuW6j1xuICAgIGNvbnN0IHNvcnRlZCA9IFsuLi50ZXN0c10uc29ydCgoYSwgYikgPT4gYi5jb25maWRlbmNlIC0gYS5jb25maWRlbmNlKTtcbiAgICBcbiAgICAvLyDmjInojIPlm7TpmZDliLbmlbDph49cbiAgICBjb25zdCBsaW1pdHM6IFJlY29yZDxWZXJpZmljYXRpb25TY29wZSwgbnVtYmVyPiA9IHtcbiAgICAgIHNtb2tlOiA1LFxuICAgICAgdGFyZ2V0ZWQ6IDE1LFxuICAgICAgYnJvYWQ6IHRoaXMuY29uZmlnLm1heFN1Z2dlc3RlZFRlc3RzLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHNvcnRlZC5zbGljZSgwLCBsaW1pdHNbc2NvcGVdKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOmineWkluajgOafpVxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUV4dHJhQ2hlY2tzKGltcGFjdFJlcG9ydDogSW1wYWN0UmVwb3J0KTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGNoZWNrczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDlhaXlj6Pngrnlj5jmm7Qg4oaSIOajgOafpeWQr+WKqFxuICAgIGlmIChpbXBhY3RSZXBvcnQuYWZmZWN0ZWRFbnRyeXBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBjaGVja3MucHVzaCgnVmVyaWZ5IGFwcGxpY2F0aW9uIHN0YXJ0dXAnKTtcbiAgICAgIGNoZWNrcy5wdXNoKCdSdW4gc21va2UgdGVzdHMgb24gbWFpbiBlbnRyeXBvaW50cycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBBUEkg5Y+Y5pu0IOKGkiDmo4Dmn6XmjqXlj6NcbiAgICBjb25zdCBhcGlDaGFuZ2VzID0gaW1wYWN0UmVwb3J0LmNoYW5nZWRGaWxlcy5maWx0ZXIoZiA9PiBmLmluY2x1ZGVzKCcvYXBpLycpKTtcbiAgICBpZiAoYXBpQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjaGVja3MucHVzaCgnVmVyaWZ5IEFQSSBjb250cmFjdCBjb21wYXRpYmlsaXR5Jyk7XG4gICAgICBjaGVja3MucHVzaCgnUnVuIGludGVncmF0aW9uIHRlc3RzIGZvciBhZmZlY3RlZCBlbmRwb2ludHMnKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5pWw5o2u5bqT5Y+Y5pu0IOKGkiDmo4Dmn6Xov4Hnp7tcbiAgICBjb25zdCBkYkNoYW5nZXMgPSBpbXBhY3RSZXBvcnQuY2hhbmdlZEZpbGVzLmZpbHRlcihmID0+IFxuICAgICAgZi5pbmNsdWRlcygnL2RiLycpIHx8IGYuaW5jbHVkZXMoJy9taWdyYXRpb24vJylcbiAgICApO1xuICAgIGlmIChkYkNoYW5nZXMubGVuZ3RoID4gMCkge1xuICAgICAgY2hlY2tzLnB1c2goJ1ZlcmlmeSBkYXRhYmFzZSBtaWdyYXRpb25zJyk7XG4gICAgICBjaGVja3MucHVzaCgnUnVuIGRhdGEgaW50ZWdyaXR5IGNoZWNrcycpO1xuICAgIH1cbiAgICBcbiAgICAvLyDorqTor4Hlj5jmm7Qg4oaSIOWuieWFqOajgOafpVxuICAgIGNvbnN0IGF1dGhDaGFuZ2VzID0gaW1wYWN0UmVwb3J0LmNoYW5nZWRGaWxlcy5maWx0ZXIoZiA9PiBcbiAgICAgIGYuaW5jbHVkZXMoJy9hdXRoLycpIHx8IGYuaW5jbHVkZXMoJy9zZWN1cml0eS8nKVxuICAgICk7XG4gICAgaWYgKGF1dGhDaGFuZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNoZWNrcy5wdXNoKCdSdW4gc2VjdXJpdHkgdGVzdHMnKTtcbiAgICAgIGNoZWNrcy5wdXNoKCdWZXJpZnkgYXV0aGVudGljYXRpb24gZmxvd3MnKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5aSn6YeP56ym5Y+35Y+Y5pu0IOKGkiDmo4Dmn6Xlm57lvZJcbiAgICBpZiAoaW1wYWN0UmVwb3J0LmltcGFjdGVkU3ltYm9scy5sZW5ndGggPiAxMCkge1xuICAgICAgY2hlY2tzLnB1c2goJ1J1biByZWdyZXNzaW9uIHRlc3RzJyk7XG4gICAgICBjaGVja3MucHVzaCgnQ2hlY2sgZm9yIGJyZWFraW5nIGNoYW5nZXMnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNoZWNrcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+mHiuiMg+WbtOmAieaLqeWOn+WboFxuICAgKi9cbiAgcHJpdmF0ZSBleHBsYWluU2NvcGUoc2NvcGU6IFZlcmlmaWNhdGlvblNjb3BlLCBpbXBhY3RSZXBvcnQ6IEltcGFjdFJlcG9ydCk6IHN0cmluZyB7XG4gICAgc3dpdGNoIChzY29wZSkge1xuICAgICAgY2FzZSAnc21va2UnOlxuICAgICAgICByZXR1cm4gdGhpcy5leHBsYWluU21va2UoaW1wYWN0UmVwb3J0KTtcbiAgICAgIGNhc2UgJ3RhcmdldGVkJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZXhwbGFpblRhcmdldGVkKGltcGFjdFJlcG9ydCk7XG4gICAgICBjYXNlICdicm9hZCc6XG4gICAgICAgIHJldHVybiB0aGlzLmV4cGxhaW5Ccm9hZChpbXBhY3RSZXBvcnQpO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+mHiiBTbW9rZSDojIPlm7RcbiAgICovXG4gIHByaXZhdGUgZXhwbGFpblNtb2tlKGltcGFjdFJlcG9ydDogSW1wYWN0UmVwb3J0KTogc3RyaW5nIHtcbiAgICBjb25zdCByZWFzb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmIChpbXBhY3RSZXBvcnQuY2hhbmdlZEZpbGVzLmV2ZXJ5KGYgPT4gZi5pbmNsdWRlcygnLm1kJykgfHwgZi5pbmNsdWRlcygnZG9jcy8nKSkpIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnQ2hhbmdlcyBhcmUgZG9jdW1lbnRhdGlvbi1vbmx5Jyk7XG4gICAgfVxuICAgIFxuICAgIGlmIChpbXBhY3RSZXBvcnQuY2hhbmdlZEZpbGVzLmV2ZXJ5KGYgPT4gXG4gICAgICBmLmluY2x1ZGVzKCcuanNvbicpIHx8IGYuaW5jbHVkZXMoJy55YW1sJykgfHwgZi5pbmNsdWRlcygnY29uZmlnLycpXG4gICAgKSkge1xuICAgICAgcmVhc29ucy5wdXNoKCdDaGFuZ2VzIGFyZSBjb25maWd1cmF0aW9uLW9ubHknKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGltcGFjdFJlcG9ydC5yZWxhdGVkVGVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZWFzb25zLnB1c2goJ05vIHJlbGF0ZWQgdGVzdHMgZm91bmQnKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGltcGFjdFJlcG9ydC5yaXNrID09PSAnbG93Jykge1xuICAgICAgcmVhc29ucy5wdXNoKCdMb3cgcmlzayBhc3Nlc3NtZW50Jyk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZWFzb25zLmxlbmd0aCA+IDAgXG4gICAgICA/IGBTbW9rZSB2ZXJpZmljYXRpb24gcmVjb21tZW5kZWQ6ICR7cmVhc29ucy5qb2luKCc7ICcpfWBcbiAgICAgIDogJ01pbmltYWwgY2hhbmdlcyBkZXRlY3RlZCwgc21va2UgdmVyaWZpY2F0aW9uIHN1ZmZpY2llbnQnO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej6YeKIFRhcmdldGVkIOiMg+WbtFxuICAgKi9cbiAgcHJpdmF0ZSBleHBsYWluVGFyZ2V0ZWQoaW1wYWN0UmVwb3J0OiBJbXBhY3RSZXBvcnQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgcmVhc29ucy5wdXNoKGAke2ltcGFjdFJlcG9ydC5jaGFuZ2VkRmlsZXMubGVuZ3RofSBmaWxlKHMpIGNoYW5nZWRgKTtcbiAgICBcbiAgICBpZiAoaW1wYWN0UmVwb3J0LnJlbGF0ZWRUZXN0cy5sZW5ndGggPiAwKSB7XG4gICAgICByZWFzb25zLnB1c2goYCR7aW1wYWN0UmVwb3J0LnJlbGF0ZWRUZXN0cy5sZW5ndGh9IHJlbGF0ZWQgdGVzdChzKSBpZGVudGlmaWVkYCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChpbXBhY3RSZXBvcnQuaW1wYWN0ZWRTeW1ib2xzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlYXNvbnMucHVzaChgJHtpbXBhY3RSZXBvcnQuaW1wYWN0ZWRTeW1ib2xzLmxlbmd0aH0gc3ltYm9sKHMpIGFmZmVjdGVkYCk7XG4gICAgfVxuICAgIFxuICAgIHJlYXNvbnMucHVzaCgnQnVzaW5lc3MgbG9naWMgY2hhbmdlcyByZXF1aXJlIHRhcmdldGVkIHZlcmlmaWNhdGlvbicpO1xuICAgIFxuICAgIHJldHVybiBgVGFyZ2V0ZWQgdmVyaWZpY2F0aW9uIHJlY29tbWVuZGVkOiAke3JlYXNvbnMuam9pbignOyAnKX1gO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej6YeKIEJyb2FkIOiMg+WbtFxuICAgKi9cbiAgcHJpdmF0ZSBleHBsYWluQnJvYWQoaW1wYWN0UmVwb3J0OiBJbXBhY3RSZXBvcnQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgaWYgKGltcGFjdFJlcG9ydC5yaXNrID09PSAnaGlnaCcpIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnSGlnaCByaXNrIGFzc2Vzc21lbnQnKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGltcGFjdFJlcG9ydC5hZmZlY3RlZEVudHJ5cG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlYXNvbnMucHVzaChgJHtpbXBhY3RSZXBvcnQuYWZmZWN0ZWRFbnRyeXBvaW50cy5sZW5ndGh9IGVudHJ5cG9pbnQocykgYWZmZWN0ZWRgKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZXhwb3J0ZWRTeW1ib2xzID0gaW1wYWN0UmVwb3J0LmltcGFjdGVkU3ltYm9scy5maWx0ZXIocyA9PiBzLmV4cG9ydGVkKTtcbiAgICBpZiAoZXhwb3J0ZWRTeW1ib2xzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlYXNvbnMucHVzaChgJHtleHBvcnRlZFN5bWJvbHMubGVuZ3RofSBleHBvcnRlZCBzeW1ib2wocykgYWZmZWN0ZWRgKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGltcGFjdFJlcG9ydC5yZWxhdGVkVGVzdHMubGVuZ3RoID4gMjApIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnV2lkZSB0ZXN0IGltcGFjdCBkZXRlY3RlZCcpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjb3JlUGF0dGVybnMgPSBbJy9jb3JlLycsICcvc2hhcmVkLycsICcvbGliLyddO1xuICAgIGNvbnN0IGNvcmVDaGFuZ2VzID0gaW1wYWN0UmVwb3J0LmNoYW5nZWRGaWxlcy5maWx0ZXIoZiA9PiBcbiAgICAgIGNvcmVQYXR0ZXJucy5zb21lKHAgPT4gZi5pbmNsdWRlcyhwKSlcbiAgICApO1xuICAgIGlmIChjb3JlQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gICAgICByZWFzb25zLnB1c2goJ0NvcmUgbW9kdWxlIGNoYW5nZXMgZGV0ZWN0ZWQnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGBCcm9hZCB2ZXJpZmljYXRpb24gcmVxdWlyZWQ6ICR7cmVhc29ucy5qb2luKCc7ICcpfWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDkvLDorqHmtYvor5XmlbDph49cbiAgICovXG4gIHByaXZhdGUgZXN0aW1hdGVUZXN0Q291bnQodGVzdHM6IFRlc3RSZWZbXSwgZXh0cmFDaGVja3M6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGVzdHMubGVuZ3RoICsgZXh0cmFDaGVja3MubGVuZ3RoO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uumqjOivgeiMg+WbtOW7uuiuruWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmVyaWZpY2F0aW9uU2NvcGVBZHZpc29yKFxuICBjb25maWc/OiBWZXJpZmljYXRpb25TY29wZUNvbmZpZ1xuKTogVmVyaWZpY2F0aW9uU2NvcGVBZHZpc29yIHtcbiAgcmV0dXJuIG5ldyBWZXJpZmljYXRpb25TY29wZUFkdmlzb3IoY29uZmlnKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/nlJ/miJDpqozor4HorqHliJJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlVmVyaWZpY2F0aW9uUGxhbihcbiAgaW1wYWN0UmVwb3J0OiBJbXBhY3RSZXBvcnRcbik6IFByb21pc2U8VmVyaWZpY2F0aW9uUGxhbj4ge1xuICBjb25zdCBhZHZpc29yID0gbmV3IFZlcmlmaWNhdGlvblNjb3BlQWR2aXNvcigpO1xuICByZXR1cm4gYXdhaXQgYWR2aXNvci5hZHZpc2UoaW1wYWN0UmVwb3J0KTtcbn1cbiJdfQ==