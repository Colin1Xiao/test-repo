/**
 * Skill Manifest - Skill Manifest 定义与解析
 *
 * 职责：
 * 1. 定义标准 manifest 结构
 * 2. 解析 JSON/YAML manifest
 * 3. 校验必填字段
 * 4. 做默认值填充与规范化
 * 5. 输出标准化 SkillManifest
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillManifest, SkillTrustLevel } from './types';
/**
 * Manifest 解析结果
 */
export interface ManifestParseResult {
    /** 是否成功 */
    success: boolean;
    /** Manifest（如果解析成功） */
    manifest?: SkillManifest;
    /** 错误信息（如果解析失败） */
    error?: string;
    /** 警告信息 */
    warnings?: string[];
}
/**
 * Manifest 验证结果
 */
export interface ManifestValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误列表 */
    errors: string[];
    /** 警告列表 */
    warnings: string[];
}
/**
 * 解析 Manifest
 */
export declare function parseManifest(input: string | Record<string, unknown>): ManifestParseResult;
/**
 * 验证 Manifest
 */
export declare function validateManifest(manifest: SkillManifest): ManifestValidationResult;
/**
 * 规范化 Manifest
 */
export declare function normalizeManifest(manifest: SkillManifest): SkillManifest;
/**
 * 获取 Manifest ID
 */
export declare function getManifestId(name: string, version: string): string;
/**
 * 检查 Skill 名称是否有效
 */
export declare function isValidSkillName(name: string): boolean;
/**
 * 检查版本是否有效（简单语义化版本检查）
 */
export declare function isValidSkillVersion(version: string): boolean;
/**
 * 检查信任级别是否有效
 */
export declare function isValidTrustLevel(level: string): level is SkillTrustLevel;
/**
 * 解析并验证 Manifest
 */
export declare function parseAndValidateManifest(input: string | Record<string, unknown>): ManifestParseResult & {
    validation?: ManifestValidationResult;
};
