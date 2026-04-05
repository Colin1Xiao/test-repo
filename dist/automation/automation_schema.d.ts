/**
 * Automation Schema - 配置 Schema 定义与校验
 *
 * 职责：
 * 1. 定义 hooks.yaml / automation.yaml 的 schema
 * 2. 校验字段合法性
 * 3. 提供规范化输出
 * 4. 做兼容性与版本检查
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AutomationConfigDocument, AutomationConfigError } from './types';
/**
 * Schema 校验结果
 */
export interface SchemaValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误列表 */
    errors: AutomationConfigError[];
    /** 警告列表 */
    warnings: string[];
    /** 规范化的文档（如果有效） */
    normalized?: AutomationConfigDocument;
}
/**
 * 校验自动化配置文档
 */
export declare function validateAutomationDocument(doc: any): SchemaValidationResult;
/**
 * 规范化自动化配置文档
 */
export declare function normalizeAutomationDocument(doc: AutomationConfigDocument): AutomationConfigDocument;
/**
 * 校验规则形状
 */
export declare function validateRuleShape(rule: any, index?: number): {
    errors: AutomationConfigError[];
    warnings: string[];
};
/**
 * 校验条件形状
 */
export declare function validateConditionShape(condition: any, index: number, pathPrefix: string, ruleId?: string): {
    errors: AutomationConfigError[];
    warnings: string[];
};
/**
 * 校验动作形状
 */
export declare function validateActionShape(action: any, index: number, pathPrefix: string, ruleId?: string): {
    errors: AutomationConfigError[];
    warnings: string[];
};
/**
 * 快速校验配置
 */
export declare function quickValidateConfig(config: any): {
    valid: boolean;
    error?: string;
};
