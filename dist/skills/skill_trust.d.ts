/**
 * Skill Trust - Skill 信任评估
 *
 * 职责：
 * 1. 定义 trust level 语义
 * 2. 计算 package 的 trust posture
 * 3. 区分 source trust 与 package trust
 * 4. 输出统一 trust decision 基础对象
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillPackageDescriptor, SkillTrustLevel, SkillSourceType, SkillTrustSummary } from './types';
/**
 * 信任评估器
 */
export declare class SkillTrustEvaluator {
    /**
     * 评估信任级别
     */
    evaluateTrust(pkg: SkillPackageDescriptor, sourceType?: SkillSourceType): SkillTrustSummary;
    /**
     * 确定信任级别
     */
    private determineTrustLevel;
    /**
     * 收集信任信号
     */
    private collectTrustSignals;
    /**
     * 生成警告
     */
    private generateWarnings;
    /**
     * 检查是否是可信级别
     */
    isTrustedLevel(trustLevel: SkillTrustLevel): boolean;
    /**
     * 检查是否需要审批
     */
    requiresApproval(trustLevel: SkillTrustLevel, source: SkillSourceType): boolean;
    /**
     * 检查 skill 是否可信
     */
    isTrusted(pkg: SkillPackageDescriptor): boolean;
    /**
     * 获取信任摘要
     */
    getTrustSummary(pkg: SkillPackageDescriptor): SkillTrustSummary;
}
/**
 * 创建信任评估器
 */
export declare function createSkillTrustEvaluator(): SkillTrustEvaluator;
/**
 * 快速评估信任
 */
export declare function evaluateSkillTrust(pkg: SkillPackageDescriptor): SkillTrustSummary;
/**
 * 快速检查是否可信
 */
export declare function isSkillTrusted(pkg: SkillPackageDescriptor): boolean;
/**
 * 快速检查是否需要审批
 */
export declare function doesSkillRequireApproval(pkg: SkillPackageDescriptor): boolean;
