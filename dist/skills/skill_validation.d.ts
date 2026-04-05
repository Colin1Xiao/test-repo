/**
 * Skill Validation - Skill 验证
 *
 * 职责：
 * 1. 校验 manifest 完整性
 * 2. 校验 source metadata
 * 3. 校验 checksum / publisher / signature 的预留位
 * 4. 校验 package compatibility
 * 5. 输出结构化 validation result
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillPackageDescriptor, SkillValidationResult, SkillTrustSignal, SkillCompatibilityIssue, SkillSecurityWarning, SkillSourceDescriptor } from './types';
/**
 * 验证器配置
 */
export interface ValidatorConfig {
    /** 运行时版本 */
    runtimeVersion?: string;
    /** 可用的 Agent 列表 */
    availableAgents?: string[];
    /** 严格模式 */
    strictMode?: boolean;
}
export declare class SkillValidator {
    private config;
    constructor(config?: ValidatorConfig);
    /**
     * 验证 Skill Package
     */
    validateSkillPackage(pkg: SkillPackageDescriptor): Promise<SkillValidationResult>;
    /**
     * 验证来源
     */
    validateSource(source: SkillSourceDescriptor): Promise<{
        valid: boolean;
        errors: string[];
        trustSignals: SkillTrustSignal[];
    }>;
    /**
     * 验证兼容性
     */
    validateCompatibility(pkg: SkillPackageDescriptor): {
        valid: boolean;
        issues: SkillCompatibilityIssue[];
    };
    /**
     * 收集安全警告
     */
    collectSecurityWarnings(pkg: SkillPackageDescriptor): SkillSecurityWarning[];
    /**
     * 严格模式检查
     */
    performStrictChecks(pkg: SkillPackageDescriptor): {
        errors: string[];
        warnings: string[];
    };
    /**
     * 构建验证报告
     */
    buildValidationReport(pkg: SkillPackageDescriptor): Promise<{
        packageId: string;
        result: SkillValidationResult;
        summary: {
            isValid: boolean;
            errorCount: number;
            warningCount: number;
            compatibilityIssueCount: number;
            securityWarningCount: number;
        };
    }>;
    /**
     * 比较版本号
     */
    private compareVersions;
}
/**
 * 创建 Skill 验证器
 */
export declare function createSkillValidator(config?: ValidatorConfig): SkillValidator;
/**
 * 快速验证 Skill
 */
export declare function validateSkill(pkg: SkillPackageDescriptor, config?: ValidatorConfig): Promise<SkillValidationResult>;
