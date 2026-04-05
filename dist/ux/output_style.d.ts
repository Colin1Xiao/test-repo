/**
 * Output Style - 输出风格定义层
 *
 * 职责：
 * 1. 定义风格描述对象
 * 2. 定义风格继承或默认值
 * 3. 规范不同风格的偏好
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { OutputStyleDescriptor, OutputStyleId, OutputAudience } from './types';
/**
 * Minimal 风格 - 极短摘要
 *
 * 适用场景：Telegram / mobile / remote / 低带宽
 */
export declare const MINIMAL_STYLE: OutputStyleDescriptor;
/**
 * Audit 风格 - 审计/合规
 *
 * 适用场景：compliance / security / ops / 审计追踪
 */
export declare const AUDIT_STYLE: OutputStyleDescriptor;
/**
 * Coding 风格 - 开发场景
 *
 * 适用场景：development / code-review / diff
 */
export declare const CODING_STYLE: OutputStyleDescriptor;
/**
 * Ops 风格 - 运维场景
 *
 * 适用场景：operations / monitoring / incident
 */
export declare const OPS_STYLE: OutputStyleDescriptor;
/**
 * Management 风格 - 管理层汇报
 *
 * 适用场景：management / reporting / stakeholder
 */
export declare const MANAGEMENT_STYLE: OutputStyleDescriptor;
/**
 * Zh PM 风格 - 中文产品经理
 *
 * 适用场景：product / chinese-speaking / structured
 */
export declare const ZH_PM_STYLE: OutputStyleDescriptor;
/**
 * 所有内置风格
 */
export declare const BUILTIN_STYLES: OutputStyleDescriptor[];
/**
 * 内置风格映射
 */
export declare const BUILTIN_STYLE_MAP: Record<OutputStyleId, OutputStyleDescriptor>;
/**
 * 定义风格
 */
export declare function defineStyle(descriptor: Partial<OutputStyleDescriptor>): OutputStyleDescriptor;
/**
 * 规范化风格
 */
export declare function normalizeStyle(descriptor: Partial<OutputStyleDescriptor>): OutputStyleDescriptor;
/**
 * 校验风格
 */
export declare function validateStyle(descriptor: Partial<OutputStyleDescriptor>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * 获取内置风格
 */
export declare function getBuiltinStyles(): OutputStyleDescriptor[];
/**
 * 获取内置风格映射
 */
export declare function getBuiltinStyleMap(): Record<OutputStyleId, OutputStyleDescriptor>;
/**
 * 根据受众推荐风格
 */
export declare function recommendStyleForAudience(audience: OutputAudience): OutputStyleId;
/**
 * 根据场景推荐风格
 */
export declare function recommendStyleForScenario(scenario: string): OutputStyleId;
/**
 * 快速创建风格
 */
export declare function createStyle(id: OutputStyleId, name: string, overrides?: Partial<OutputStyleDescriptor>): OutputStyleDescriptor;
/**
 * 快速校验并创建风格
 */
export declare function createValidatedStyle(descriptor: Partial<OutputStyleDescriptor>): {
    style?: OutputStyleDescriptor;
    errors: string[];
    warnings: string[];
};
