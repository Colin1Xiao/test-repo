/**
 * Skill Source - Skill 来源管理
 *
 * 职责：
 * 1. 统一表达 builtin / workspace / external source
 * 2. 解析 source metadata
 * 3. 区分"可直接用"和"需下载/导入"的来源
 * 4. 为 installer 提供标准 source descriptor
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillSourceDescriptor, SkillSourceType } from './types';
/**
 * 来源解析结果
 */
export interface SourceResolveResult {
    /** 是否成功 */
    success: boolean;
    /** 来源描述符（如果解析成功） */
    source?: SkillSourceDescriptor;
    /** 错误信息（如果解析失败） */
    error?: string;
}
/**
 * 解析来源
 */
export declare function resolveSource(input: string): SourceResolveResult;
/**
 * 规范化来源
 */
export declare function normalizeSource(source: SkillSourceDescriptor): SkillSourceDescriptor;
/**
 * 检查是否是 builtin 来源
 */
export declare function isBuiltinSource(source: SkillSourceDescriptor): boolean;
/**
 * 检查是否是 workspace 来源
 */
export declare function isWorkspaceSource(source: SkillSourceDescriptor): boolean;
/**
 * 检查是否是 external 来源
 */
export declare function isExternalSource(source: SkillSourceDescriptor): boolean;
/**
 * 检查是否是 builtin 来源路径
 */
export declare function isBuiltinSourcePath(path: string): boolean;
/**
 * 检查是否是 workspace 来源路径
 */
export declare function isWorkspaceSourcePath(path: string): boolean;
/**
 * 检查是否是 external 来源路径
 */
export declare function isExternalSourcePath(path: string): boolean;
/**
 * 获取来源类型
 */
export declare function getSourceType(path: string): SkillSourceType;
/**
 * 检查来源是否可用
 */
export declare function isSourceAvailable(source: SkillSourceDescriptor): Promise<boolean>;
/**
 * 创建 builtin 来源
 */
export declare function createBuiltinSource(skillName: string): SkillSourceDescriptor;
/**
 * 创建 workspace 来源
 */
export declare function createWorkspaceSource(skillName: string, basePath?: string): SkillSourceDescriptor;
/**
 * 创建 external 来源
 */
export declare function createExternalSource(location: string): SkillSourceDescriptor;
