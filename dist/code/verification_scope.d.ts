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
import type { VerificationPlan, ImpactReport, VerificationScopeConfig } from './types';
export declare class VerificationScopeAdvisor {
    private config;
    constructor(config?: VerificationScopeConfig);
    /**
     * 生成验证计划
     */
    advise(impactReport: ImpactReport): Promise<VerificationPlan>;
    /**
     * 确定验证范围
     */
    private determineScope;
    /**
     * 判断是否需要 Broad 验证
     */
    private shouldBroad;
    /**
     * 判断是否只需 Smoke 验证
     */
    private shouldSmoke;
    /**
     * 选择建议测试
     */
    private selectTests;
    /**
     * 生成额外检查
     */
    private generateExtraChecks;
    /**
     * 解释范围选择原因
     */
    private explainScope;
    /**
     * 解释 Smoke 范围
     */
    private explainSmoke;
    /**
     * 解释 Targeted 范围
     */
    private explainTargeted;
    /**
     * 解释 Broad 范围
     */
    private explainBroad;
    /**
     * 估计测试数量
     */
    private estimateTestCount;
}
/**
 * 创建验证范围建议器
 */
export declare function createVerificationScopeAdvisor(config?: VerificationScopeConfig): VerificationScopeAdvisor;
/**
 * 快速生成验证计划
 */
export declare function generateVerificationPlan(impactReport: ImpactReport): Promise<VerificationPlan>;
