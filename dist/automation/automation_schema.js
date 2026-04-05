"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAutomationDocument = validateAutomationDocument;
exports.normalizeAutomationDocument = normalizeAutomationDocument;
exports.validateRuleShape = validateRuleShape;
exports.validateConditionShape = validateConditionShape;
exports.validateActionShape = validateActionShape;
exports.quickValidateConfig = quickValidateConfig;
// ============================================================================
// 常量定义
// ============================================================================
/**
 * 支持的配置版本
 */
const SUPPORTED_VERSIONS = [1];
/**
 * 有效的事件类型
 */
const VALID_EVENT_TYPES = [
    'task.created',
    'task.started',
    'task.completed',
    'task.failed',
    'task.timeout',
    'approval.requested',
    'approval.resolved',
    'server.degraded',
    'server.unavailable',
    'budget.exceeded',
    'skill.loaded',
    'skill.blocked',
];
/**
 * 有效的动作类型
 */
const VALID_ACTION_TYPES = [
    'notify',
    'retry',
    'escalate',
    'log',
    'cancel',
    'pause',
    'custom',
];
/**
 * 有效的比较操作符
 */
const VALID_OPERATORS = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'in',
    'exists',
    'regex',
    'startswith',
    'endswith',
];
// ============================================================================
// Schema 校验
// ============================================================================
/**
 * 校验自动化配置文档
 */
function validateAutomationDocument(doc) {
    const errors = [];
    const warnings = [];
    // 检查是否是对象
    if (!doc || typeof doc !== 'object') {
        errors.push({
            type: 'schema',
            message: 'Configuration must be an object',
        });
        return { valid: false, errors, warnings };
    }
    // 校验版本
    if (doc.version === undefined) {
        errors.push({
            type: 'schema',
            path: 'version',
            message: 'Version is required',
        });
    }
    else if (!SUPPORTED_VERSIONS.includes(doc.version)) {
        errors.push({
            type: 'schema',
            path: 'version',
            message: `Unsupported version: ${doc.version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
        });
    }
    // 校验规则列表
    if (!doc.rules) {
        errors.push({
            type: 'schema',
            path: 'rules',
            message: 'Rules array is required',
        });
    }
    else if (!Array.isArray(doc.rules)) {
        errors.push({
            type: 'schema',
            path: 'rules',
            message: 'Rules must be an array',
        });
    }
    else {
        // 校验每个规则
        const ruleIds = new Set();
        for (let i = 0; i < doc.rules.length; i++) {
            const rule = doc.rules[i];
            const ruleResult = validateRuleShape(rule, i);
            errors.push(...ruleResult.errors);
            warnings.push(...ruleResult.warnings);
            // 检查 ID 唯一性
            if (rule.id) {
                if (ruleIds.has(rule.id)) {
                    errors.push({
                        type: 'validation',
                        path: `rules[${i}].id`,
                        ruleId: rule.id,
                        message: `Duplicate rule ID: ${rule.id}`,
                    });
                }
                ruleIds.add(rule.id);
            }
        }
    }
    // 校验 extends（可选）
    if (doc.extends !== undefined && typeof doc.extends !== 'string') {
        errors.push({
            type: 'schema',
            path: 'extends',
            message: 'Extends must be a string',
        });
    }
    // 校验 workspace（可选）
    if (doc.workspace !== undefined) {
        if (typeof doc.workspace !== 'object') {
            errors.push({
                type: 'schema',
                path: 'workspace',
                message: 'Workspace must be an object',
            });
        }
        else {
            if (doc.workspace.root !== undefined && typeof doc.workspace.root !== 'string') {
                errors.push({
                    type: 'schema',
                    path: 'workspace.root',
                    message: 'Workspace root must be a string',
                });
            }
            if (doc.workspace.overrideDefaults !== undefined && typeof doc.workspace.overrideDefaults !== 'boolean') {
                errors.push({
                    type: 'schema',
                    path: 'workspace.overrideDefaults',
                    message: 'Workspace overrideDefaults must be a boolean',
                });
            }
        }
    }
    // 校验 defaults（可选）
    if (doc.defaults !== undefined) {
        if (typeof doc.defaults !== 'object') {
            errors.push({
                type: 'schema',
                path: 'defaults',
                message: 'Defaults must be an object',
            });
        }
        else {
            if (doc.defaults.enabled !== undefined && typeof doc.defaults.enabled !== 'boolean') {
                errors.push({
                    type: 'schema',
                    path: 'defaults.enabled',
                    message: 'Defaults enabled must be a boolean',
                });
            }
            if (doc.defaults.cooldownMs !== undefined && typeof doc.defaults.cooldownMs !== 'number') {
                errors.push({
                    type: 'schema',
                    path: 'defaults.cooldownMs',
                    message: 'Defaults cooldownMs must be a number',
                });
            }
            if (doc.defaults.maxTriggerCount !== undefined && typeof doc.defaults.maxTriggerCount !== 'number') {
                errors.push({
                    type: 'schema',
                    path: 'defaults.maxTriggerCount',
                    message: 'Defaults maxTriggerCount must be a number',
                });
            }
        }
    }
    const valid = errors.length === 0;
    return {
        valid,
        errors,
        warnings,
        normalized: valid ? normalizeAutomationDocument(doc) : undefined,
    };
}
/**
 * 规范化自动化配置文档
 */
function normalizeAutomationDocument(doc) {
    return {
        version: doc.version,
        rules: doc.rules.map(normalizeRule),
        extends: doc.extends,
        workspace: doc.workspace,
        defaults: {
            enabled: doc.defaults?.enabled ?? true,
            cooldownMs: doc.defaults?.cooldownMs ?? 60000,
            maxTriggerCount: doc.defaults?.maxTriggerCount,
        },
    };
}
// ============================================================================
// 规则校验
// ============================================================================
/**
 * 校验规则形状
 */
function validateRuleShape(rule, index) {
    const errors = [];
    const warnings = [];
    const pathPrefix = index !== undefined ? `rules[${index}]` : 'rule';
    // 检查是否是对象
    if (!rule || typeof rule !== 'object') {
        errors.push({
            type: 'schema',
            path: pathPrefix,
            message: 'Rule must be an object',
        });
        return { errors, warnings };
    }
    // 校验 ID
    if (!rule.id) {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.id`,
            message: 'Rule ID is required',
        });
    }
    else if (typeof rule.id !== 'string') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.id`,
            message: 'Rule ID must be a string',
        });
    }
    // 校验名称（可选）
    if (rule.name !== undefined && typeof rule.name !== 'string') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.name`,
            message: 'Rule name must be a string',
        });
    }
    // 校验事件列表
    if (!rule.events) {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.events`,
            ruleId: rule.id,
            message: 'Events array is required',
        });
    }
    else if (!Array.isArray(rule.events)) {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.events`,
            ruleId: rule.id,
            message: 'Events must be an array',
        });
    }
    else if (rule.events.length === 0) {
        errors.push({
            type: 'validation',
            path: `${pathPrefix}.events`,
            ruleId: rule.id,
            message: 'Events array cannot be empty',
        });
    }
    else {
        // 校验每个事件类型
        for (let i = 0; i < rule.events.length; i++) {
            const event = rule.events[i];
            if (!VALID_EVENT_TYPES.includes(event)) {
                errors.push({
                    type: 'validation',
                    path: `${pathPrefix}.events[${i}]`,
                    ruleId: rule.id,
                    message: `Invalid event type: ${event}`,
                });
            }
        }
    }
    // 校验条件列表（可选）
    if (rule.conditions !== undefined) {
        if (!Array.isArray(rule.conditions)) {
            errors.push({
                type: 'schema',
                path: `${pathPrefix}.conditions`,
                ruleId: rule.id,
                message: 'Conditions must be an array',
            });
        }
        else {
            // 校验每个条件
            for (let i = 0; i < rule.conditions.length; i++) {
                const condition = rule.conditions[i];
                const conditionResult = validateConditionShape(condition, i, pathPrefix, rule.id);
                errors.push(...conditionResult.errors);
                warnings.push(...conditionResult.warnings);
            }
        }
    }
    // 校验动作列表
    if (!rule.actions) {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.actions`,
            ruleId: rule.id,
            message: 'Actions array is required',
        });
    }
    else if (!Array.isArray(rule.actions)) {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.actions`,
            ruleId: rule.id,
            message: 'Actions must be an array',
        });
    }
    else if (rule.actions.length === 0) {
        errors.push({
            type: 'validation',
            path: `${pathPrefix}.actions`,
            ruleId: rule.id,
            message: 'Actions array cannot be empty',
        });
    }
    else {
        // 校验每个动作
        for (let i = 0; i < rule.actions.length; i++) {
            const action = rule.actions[i];
            const actionResult = validateActionShape(action, i, pathPrefix, rule.id);
            errors.push(...actionResult.errors);
            warnings.push(...actionResult.warnings);
        }
    }
    // 校验 enabled（可选）
    if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.enabled`,
            ruleId: rule.id,
            message: 'Enabled must be a boolean',
        });
    }
    // 校验 priority（可选）
    if (rule.priority !== undefined && typeof rule.priority !== 'number') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.priority`,
            ruleId: rule.id,
            message: 'Priority must be a number',
        });
    }
    // 校验 stopOnMatch（可选）
    if (rule.stopOnMatch !== undefined && typeof rule.stopOnMatch !== 'boolean') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.stopOnMatch`,
            ruleId: rule.id,
            message: 'StopOnMatch must be a boolean',
        });
    }
    // 校验 cooldownMs（可选）
    if (rule.cooldownMs !== undefined && typeof rule.cooldownMs !== 'number') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.cooldownMs`,
            ruleId: rule.id,
            message: 'CooldownMs must be a number',
        });
    }
    // 校验 maxTriggerCount（可选）
    if (rule.maxTriggerCount !== undefined && typeof rule.maxTriggerCount !== 'number') {
        errors.push({
            type: 'schema',
            path: `${pathPrefix}.maxTriggerCount`,
            ruleId: rule.id,
            message: 'MaxTriggerCount must be a number',
        });
    }
    return { errors, warnings };
}
// ============================================================================
// 条件校验
// ============================================================================
/**
 * 校验条件形状
 */
function validateConditionShape(condition, index, pathPrefix, ruleId) {
    const errors = [];
    const warnings = [];
    const path = `${pathPrefix}.conditions[${index}]`;
    // 检查是否是对象
    if (!condition || typeof condition !== 'object') {
        errors.push({
            type: 'schema',
            path,
            ruleId,
            message: 'Condition must be an object',
        });
        return { errors, warnings };
    }
    // 校验类型
    if (!condition.type) {
        errors.push({
            type: 'schema',
            path: `${path}.type`,
            ruleId,
            message: 'Condition type is required',
        });
    }
    else if (!['field', 'regex', 'threshold', 'custom'].includes(condition.type)) {
        errors.push({
            type: 'validation',
            path: `${path}.type`,
            ruleId,
            message: `Invalid condition type: ${condition.type}`,
        });
    }
    // 校验字段路径（field/regex/threshold 类型需要）
    if (['field', 'regex', 'threshold'].includes(condition.type)) {
        if (!condition.field) {
            errors.push({
                type: 'schema',
                path: `${path}.field`,
                ruleId,
                message: 'Field is required for field/regex/threshold conditions',
            });
        }
        else if (typeof condition.field !== 'string') {
            errors.push({
                type: 'schema',
                path: `${path}.field`,
                ruleId,
                message: 'Field must be a string',
            });
        }
    }
    // 校验操作符（field 类型需要）
    if (condition.type === 'field') {
        if (!condition.operator) {
            errors.push({
                type: 'schema',
                path: `${path}.operator`,
                ruleId,
                message: 'Operator is required for field conditions',
            });
        }
        else if (!VALID_OPERATORS.includes(condition.operator)) {
            errors.push({
                type: 'validation',
                path: `${path}.operator`,
                ruleId,
                message: `Invalid operator: ${condition.operator}`,
            });
        }
    }
    // 校验值（field/regex/threshold 类型需要）
    if (['field', 'regex', 'threshold'].includes(condition.type)) {
        if (condition.value === undefined) {
            errors.push({
                type: 'schema',
                path: `${path}.value`,
                ruleId,
                message: 'Value is required for field/regex/threshold conditions',
            });
        }
    }
    // 校验表达式（custom 类型需要）
    if (condition.type === 'custom') {
        if (!condition.expression) {
            errors.push({
                type: 'schema',
                path: `${path}.expression`,
                ruleId,
                message: 'Expression is required for custom conditions',
            });
        }
        else if (typeof condition.expression !== 'string') {
            errors.push({
                type: 'schema',
                path: `${path}.expression`,
                ruleId,
                message: 'Expression must be a string',
            });
        }
    }
    return { errors, warnings };
}
// ============================================================================
// 动作校验
// ============================================================================
/**
 * 校验动作形状
 */
function validateActionShape(action, index, pathPrefix, ruleId) {
    const errors = [];
    const warnings = [];
    const path = `${pathPrefix}.actions[${index}]`;
    // 检查是否是对象
    if (!action || typeof action !== 'object') {
        errors.push({
            type: 'schema',
            path,
            ruleId,
            message: 'Action must be an object',
        });
        return { errors, warnings };
    }
    // 校验类型
    if (!action.type) {
        errors.push({
            type: 'schema',
            path: `${path}.type`,
            ruleId,
            message: 'Action type is required',
        });
    }
    else if (!VALID_ACTION_TYPES.includes(action.type)) {
        errors.push({
            type: 'validation',
            path: `${path}.type`,
            ruleId,
            message: `Invalid action type: ${action.type}`,
        });
    }
    // 校验 target（notify/escalate 类型需要）
    if (['notify', 'escalate'].includes(action.type)) {
        if (!action.target) {
            warnings.push(`Action ${action.type} at ${path} missing target, will use default`);
        }
    }
    // 校验 params（可选）
    if (action.params !== undefined && typeof action.params !== 'object') {
        errors.push({
            type: 'schema',
            path: `${path}.params`,
            ruleId,
            message: 'Params must be an object',
        });
    }
    return { errors, warnings };
}
// ============================================================================
// 规则规范化
// ============================================================================
/**
 * 规范化规则
 */
function normalizeRule(rule) {
    return {
        ...rule,
        enabled: rule.enabled ?? true,
        priority: rule.priority ?? 0,
        stopOnMatch: rule.stopOnMatch ?? false,
        cooldownMs: rule.cooldownMs ?? 60000,
        conditions: rule.conditions || [],
    };
}
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 快速校验配置
 */
function quickValidateConfig(config) {
    const result = validateAutomationDocument(config);
    if (!result.valid) {
        return {
            valid: false,
            error: result.errors[0]?.message || 'Unknown validation error',
        };
    }
    return { valid: true };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b21hdGlvbl9zY2hlbWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXV0b21hdGlvbi9hdXRvbWF0aW9uX3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7O0FBbUdILGdFQWlKQztBQUtELGtFQWNDO0FBU0QsOENBeUxDO0FBU0Qsd0RBK0dDO0FBU0Qsa0RBMkRDO0FBMkJELGtEQWNDO0FBNW9CRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUvQjs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQTBCO0lBQy9DLGNBQWM7SUFDZCxjQUFjO0lBQ2QsZ0JBQWdCO0lBQ2hCLGFBQWE7SUFDYixjQUFjO0lBQ2Qsb0JBQW9CO0lBQ3BCLG1CQUFtQjtJQUNuQixpQkFBaUI7SUFDakIsb0JBQW9CO0lBQ3BCLGlCQUFpQjtJQUNqQixjQUFjO0lBQ2QsZUFBZTtDQUNoQixDQUFDO0FBRUY7O0dBRUc7QUFDSCxNQUFNLGtCQUFrQixHQUEyQjtJQUNqRCxRQUFRO0lBQ1IsT0FBTztJQUNQLFVBQVU7SUFDVixLQUFLO0lBQ0wsUUFBUTtJQUNSLE9BQU87SUFDUCxRQUFRO0NBQ1QsQ0FBQztBQUVGOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQXlCO0lBQzVDLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLEtBQUs7SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLFVBQVU7SUFDVixJQUFJO0lBQ0osUUFBUTtJQUNSLE9BQU87SUFDUCxZQUFZO0lBQ1osVUFBVTtDQUNYLENBQUM7QUFFRiwrRUFBK0U7QUFDL0UsWUFBWTtBQUNaLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLDBCQUEwQixDQUN4QyxHQUFRO0lBRVIsTUFBTSxNQUFNLEdBQTRCLEVBQUUsQ0FBQztJQUMzQyxN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S0FBSztRQUNwQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFO0tBQ2xDLENBQUM7QUFDSixDQUFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxNQUFXO0lBSTdDLE1BQU0sTUFBTSxHQUFHLDBCQUEwQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWxELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbEIsT0FBTztZQUNMLEtBQUssRUFBRSxLQUFLO1lBQ1osS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxJQUFJLDBCQUEwQjtTQUMvRCxDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDekIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXV0b21hdGlvbiBTY2hlbWEgLSDphY3nva4gU2NoZW1hIOWumuS5ieS4juagoemqjFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWumuS5iSBob29rcy55YW1sIC8gYXV0b21hdGlvbi55YW1sIOeahCBzY2hlbWFcbiAqIDIuIOagoemqjOWtl+auteWQiOazleaAp1xuICogMy4g5o+Q5L6b6KeE6IyD5YyW6L6T5Ye6XG4gKiA0LiDlgZrlhbzlrrnmgKfkuI7niYjmnKzmo4Dmn6VcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBBdXRvbWF0aW9uQ29uZmlnRG9jdW1lbnQsXG4gIEF1dG9tYXRpb25SdWxlLFxuICBBdXRvbWF0aW9uQ29uZGl0aW9uLFxuICBBdXRvbWF0aW9uQWN0aW9uLFxuICBBdXRvbWF0aW9uQ29uZmlnRXJyb3IsXG4gIENvbXBhcmlzb25PcGVyYXRvcixcbiAgQXV0b21hdGlvbkV2ZW50VHlwZSxcbiAgQXV0b21hdGlvbkFjdGlvblR5cGUsXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBTY2hlbWEg5qCh6aqM57uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2NoZW1hVmFsaWRhdGlvblJlc3VsdCB7XG4gIC8qKiDmmK/lkKbmnInmlYggKi9cbiAgdmFsaWQ6IGJvb2xlYW47XG4gIFxuICAvKiog6ZSZ6K+v5YiX6KGoICovXG4gIGVycm9yczogQXV0b21hdGlvbkNvbmZpZ0Vycm9yW107XG4gIFxuICAvKiog6K2m5ZGK5YiX6KGoICovXG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDop4TojIPljJbnmoTmlofmoaPvvIjlpoLmnpzmnInmlYjvvIkgKi9cbiAgbm9ybWFsaXplZD86IEF1dG9tYXRpb25Db25maWdEb2N1bWVudDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bi46YeP5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5pSv5oyB55qE6YWN572u54mI5pysXG4gKi9cbmNvbnN0IFNVUFBPUlRFRF9WRVJTSU9OUyA9IFsxXTtcblxuLyoqXG4gKiDmnInmlYjnmoTkuovku7bnsbvlnotcbiAqL1xuY29uc3QgVkFMSURfRVZFTlRfVFlQRVM6IEF1dG9tYXRpb25FdmVudFR5cGVbXSA9IFtcbiAgJ3Rhc2suY3JlYXRlZCcsXG4gICd0YXNrLnN0YXJ0ZWQnLFxuICAndGFzay5jb21wbGV0ZWQnLFxuICAndGFzay5mYWlsZWQnLFxuICAndGFzay50aW1lb3V0JyxcbiAgJ2FwcHJvdmFsLnJlcXVlc3RlZCcsXG4gICdhcHByb3ZhbC5yZXNvbHZlZCcsXG4gICdzZXJ2ZXIuZGVncmFkZWQnLFxuICAnc2VydmVyLnVuYXZhaWxhYmxlJyxcbiAgJ2J1ZGdldC5leGNlZWRlZCcsXG4gICdza2lsbC5sb2FkZWQnLFxuICAnc2tpbGwuYmxvY2tlZCcsXG5dO1xuXG4vKipcbiAqIOacieaViOeahOWKqOS9nOexu+Wei1xuICovXG5jb25zdCBWQUxJRF9BQ1RJT05fVFlQRVM6IEF1dG9tYXRpb25BY3Rpb25UeXBlW10gPSBbXG4gICdub3RpZnknLFxuICAncmV0cnknLFxuICAnZXNjYWxhdGUnLFxuICAnbG9nJyxcbiAgJ2NhbmNlbCcsXG4gICdwYXVzZScsXG4gICdjdXN0b20nLFxuXTtcblxuLyoqXG4gKiDmnInmlYjnmoTmr5TovoPmk43kvZznrKZcbiAqL1xuY29uc3QgVkFMSURfT1BFUkFUT1JTOiBDb21wYXJpc29uT3BlcmF0b3JbXSA9IFtcbiAgJ2VxJyxcbiAgJ25lJyxcbiAgJ2d0JyxcbiAgJ2d0ZScsXG4gICdsdCcsXG4gICdsdGUnLFxuICAnY29udGFpbnMnLFxuICAnaW4nLFxuICAnZXhpc3RzJyxcbiAgJ3JlZ2V4JyxcbiAgJ3N0YXJ0c3dpdGgnLFxuICAnZW5kc3dpdGgnLFxuXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2NoZW1hIOagoemqjFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOagoemqjOiHquWKqOWMlumFjee9ruaWh+aho1xuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVBdXRvbWF0aW9uRG9jdW1lbnQoXG4gIGRvYzogYW55XG4pOiBTY2hlbWFWYWxpZGF0aW9uUmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBBdXRvbWF0aW9uQ29uZmlnRXJyb3JbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgXG4gIC8vIOajgOafpeaYr+WQpuaYr+WvueixoVxuICBpZiAoIWRvYyB8fCB0eXBlb2YgZG9jICE9PSAnb2JqZWN0Jykge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgbWVzc2FnZTogJ0NvbmZpZ3VyYXRpb24gbXVzdCBiZSBhbiBvYmplY3QnLFxuICAgIH0pO1xuICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG4gIFxuICAvLyDmoKHpqozniYjmnKxcbiAgaWYgKGRvYy52ZXJzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6ICd2ZXJzaW9uJyxcbiAgICAgIG1lc3NhZ2U6ICdWZXJzaW9uIGlzIHJlcXVpcmVkJyxcbiAgICB9KTtcbiAgfSBlbHNlIGlmICghU1VQUE9SVEVEX1ZFUlNJT05TLmluY2x1ZGVzKGRvYy52ZXJzaW9uKSkge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgcGF0aDogJ3ZlcnNpb24nLFxuICAgICAgbWVzc2FnZTogYFVuc3VwcG9ydGVkIHZlcnNpb246ICR7ZG9jLnZlcnNpb259LiBTdXBwb3J0ZWQgdmVyc2lvbnM6ICR7U1VQUE9SVEVEX1ZFUlNJT05TLmpvaW4oJywgJyl9YCxcbiAgICB9KTtcbiAgfVxuICBcbiAgLy8g5qCh6aqM6KeE5YiZ5YiX6KGoXG4gIGlmICghZG9jLnJ1bGVzKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiAncnVsZXMnLFxuICAgICAgbWVzc2FnZTogJ1J1bGVzIGFycmF5IGlzIHJlcXVpcmVkJyxcbiAgICB9KTtcbiAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkb2MucnVsZXMpKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiAncnVsZXMnLFxuICAgICAgbWVzc2FnZTogJ1J1bGVzIG11c3QgYmUgYW4gYXJyYXknLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIC8vIOagoemqjOavj+S4quinhOWImVxuICAgIGNvbnN0IHJ1bGVJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5ydWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcnVsZSA9IGRvYy5ydWxlc1tpXTtcbiAgICAgIGNvbnN0IHJ1bGVSZXN1bHQgPSB2YWxpZGF0ZVJ1bGVTaGFwZShydWxlLCBpKTtcbiAgICAgIFxuICAgICAgZXJyb3JzLnB1c2goLi4ucnVsZVJlc3VsdC5lcnJvcnMpO1xuICAgICAgd2FybmluZ3MucHVzaCguLi5ydWxlUmVzdWx0Lndhcm5pbmdzKTtcbiAgICAgIFxuICAgICAgLy8g5qOA5p+lIElEIOWUr+S4gOaAp1xuICAgICAgaWYgKHJ1bGUuaWQpIHtcbiAgICAgICAgaWYgKHJ1bGVJZHMuaGFzKHJ1bGUuaWQpKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ3ZhbGlkYXRpb24nLFxuICAgICAgICAgICAgcGF0aDogYHJ1bGVzWyR7aX1dLmlkYCxcbiAgICAgICAgICAgIHJ1bGVJZDogcnVsZS5pZCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBEdXBsaWNhdGUgcnVsZSBJRDogJHtydWxlLmlkfWAsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcnVsZUlkcy5hZGQocnVsZS5pZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqowgZXh0ZW5kc++8iOWPr+mAie+8iVxuICBpZiAoZG9jLmV4dGVuZHMgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZG9jLmV4dGVuZHMgIT09ICdzdHJpbmcnKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiAnZXh0ZW5kcycsXG4gICAgICBtZXNzYWdlOiAnRXh0ZW5kcyBtdXN0IGJlIGEgc3RyaW5nJyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLy8g5qCh6aqMIHdvcmtzcGFjZe+8iOWPr+mAie+8iVxuICBpZiAoZG9jLndvcmtzcGFjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBkb2Mud29ya3NwYWNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgICAgcGF0aDogJ3dvcmtzcGFjZScsXG4gICAgICAgIG1lc3NhZ2U6ICdXb3Jrc3BhY2UgbXVzdCBiZSBhbiBvYmplY3QnLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChkb2Mud29ya3NwYWNlLnJvb3QgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZG9jLndvcmtzcGFjZS5yb290ICE9PSAnc3RyaW5nJykge1xuICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgICAgcGF0aDogJ3dvcmtzcGFjZS5yb290JyxcbiAgICAgICAgICBtZXNzYWdlOiAnV29ya3NwYWNlIHJvb3QgbXVzdCBiZSBhIHN0cmluZycsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGRvYy53b3Jrc3BhY2Uub3ZlcnJpZGVEZWZhdWx0cyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBkb2Mud29ya3NwYWNlLm92ZXJyaWRlRGVmYXVsdHMgIT09ICdib29sZWFuJykge1xuICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgICAgcGF0aDogJ3dvcmtzcGFjZS5vdmVycmlkZURlZmF1bHRzJyxcbiAgICAgICAgICBtZXNzYWdlOiAnV29ya3NwYWNlIG92ZXJyaWRlRGVmYXVsdHMgbXVzdCBiZSBhIGJvb2xlYW4nLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8vIOagoemqjCBkZWZhdWx0c++8iOWPr+mAie+8iVxuICBpZiAoZG9jLmRlZmF1bHRzICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodHlwZW9mIGRvYy5kZWZhdWx0cyAhPT0gJ29iamVjdCcpIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgIHBhdGg6ICdkZWZhdWx0cycsXG4gICAgICAgIG1lc3NhZ2U6ICdEZWZhdWx0cyBtdXN0IGJlIGFuIG9iamVjdCcsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGRvYy5kZWZhdWx0cy5lbmFibGVkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGRvYy5kZWZhdWx0cy5lbmFibGVkICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgICAgIHBhdGg6ICdkZWZhdWx0cy5lbmFibGVkJyxcbiAgICAgICAgICBtZXNzYWdlOiAnRGVmYXVsdHMgZW5hYmxlZCBtdXN0IGJlIGEgYm9vbGVhbicsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGRvYy5kZWZhdWx0cy5jb29sZG93bk1zICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGRvYy5kZWZhdWx0cy5jb29sZG93bk1zICE9PSAnbnVtYmVyJykge1xuICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgICAgcGF0aDogJ2RlZmF1bHRzLmNvb2xkb3duTXMnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdEZWZhdWx0cyBjb29sZG93bk1zIG11c3QgYmUgYSBudW1iZXInLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChkb2MuZGVmYXVsdHMubWF4VHJpZ2dlckNvdW50ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGRvYy5kZWZhdWx0cy5tYXhUcmlnZ2VyQ291bnQgIT09ICdudW1iZXInKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgICAgICBwYXRoOiAnZGVmYXVsdHMubWF4VHJpZ2dlckNvdW50JyxcbiAgICAgICAgICBtZXNzYWdlOiAnRGVmYXVsdHMgbWF4VHJpZ2dlckNvdW50IG11c3QgYmUgYSBudW1iZXInLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIGNvbnN0IHZhbGlkID0gZXJyb3JzLmxlbmd0aCA9PT0gMDtcbiAgXG4gIHJldHVybiB7XG4gICAgdmFsaWQsXG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzLFxuICAgIG5vcm1hbGl6ZWQ6IHZhbGlkID8gbm9ybWFsaXplQXV0b21hdGlvbkRvY3VtZW50KGRvYykgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbi8qKlxuICog6KeE6IyD5YyW6Ieq5Yqo5YyW6YWN572u5paH5qGjXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVBdXRvbWF0aW9uRG9jdW1lbnQoXG4gIGRvYzogQXV0b21hdGlvbkNvbmZpZ0RvY3VtZW50XG4pOiBBdXRvbWF0aW9uQ29uZmlnRG9jdW1lbnQge1xuICByZXR1cm4ge1xuICAgIHZlcnNpb246IGRvYy52ZXJzaW9uLFxuICAgIHJ1bGVzOiBkb2MucnVsZXMubWFwKG5vcm1hbGl6ZVJ1bGUpLFxuICAgIGV4dGVuZHM6IGRvYy5leHRlbmRzLFxuICAgIHdvcmtzcGFjZTogZG9jLndvcmtzcGFjZSxcbiAgICBkZWZhdWx0czoge1xuICAgICAgZW5hYmxlZDogZG9jLmRlZmF1bHRzPy5lbmFibGVkID8/IHRydWUsXG4gICAgICBjb29sZG93bk1zOiBkb2MuZGVmYXVsdHM/LmNvb2xkb3duTXMgPz8gNjAwMDAsXG4gICAgICBtYXhUcmlnZ2VyQ291bnQ6IGRvYy5kZWZhdWx0cz8ubWF4VHJpZ2dlckNvdW50LFxuICAgIH0sXG4gIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOinhOWImeagoemqjFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOagoemqjOinhOWImeW9oueKtlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVSdWxlU2hhcGUoXG4gIHJ1bGU6IGFueSxcbiAgaW5kZXg/OiBudW1iZXJcbik6IHtcbiAgZXJyb3JzOiBBdXRvbWF0aW9uQ29uZmlnRXJyb3JbXTtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xufSB7XG4gIGNvbnN0IGVycm9yczogQXV0b21hdGlvbkNvbmZpZ0Vycm9yW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBhdGhQcmVmaXggPSBpbmRleCAhPT0gdW5kZWZpbmVkID8gYHJ1bGVzWyR7aW5kZXh9XWAgOiAncnVsZSc7XG4gIFxuICAvLyDmo4Dmn6XmmK/lkKbmmK/lr7nosaFcbiAgaWYgKCFydWxlIHx8IHR5cGVvZiBydWxlICE9PSAnb2JqZWN0Jykge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgcGF0aDogcGF0aFByZWZpeCxcbiAgICAgIG1lc3NhZ2U6ICdSdWxlIG11c3QgYmUgYW4gb2JqZWN0JyxcbiAgICB9KTtcbiAgICByZXR1cm4geyBlcnJvcnMsIHdhcm5pbmdzIH07XG4gIH1cbiAgXG4gIC8vIOagoemqjCBJRFxuICBpZiAoIXJ1bGUuaWQpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmlkYCxcbiAgICAgIG1lc3NhZ2U6ICdSdWxlIElEIGlzIHJlcXVpcmVkJyxcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgcnVsZS5pZCAhPT0gJ3N0cmluZycpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmlkYCxcbiAgICAgIG1lc3NhZ2U6ICdSdWxlIElEIG11c3QgYmUgYSBzdHJpbmcnLFxuICAgIH0pO1xuICB9XG4gIFxuICAvLyDmoKHpqozlkI3np7DvvIjlj6/pgInvvIlcbiAgaWYgKHJ1bGUubmFtZSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBydWxlLm5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5uYW1lYCxcbiAgICAgIG1lc3NhZ2U6ICdSdWxlIG5hbWUgbXVzdCBiZSBhIHN0cmluZycsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIOagoemqjOS6i+S7tuWIl+ihqFxuICBpZiAoIXJ1bGUuZXZlbnRzKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5ldmVudHNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0V2ZW50cyBhcnJheSBpcyByZXF1aXJlZCcsXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkocnVsZS5ldmVudHMpKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5ldmVudHNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0V2ZW50cyBtdXN0IGJlIGFuIGFycmF5JyxcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChydWxlLmV2ZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAndmFsaWRhdGlvbicsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5ldmVudHNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0V2ZW50cyBhcnJheSBjYW5ub3QgYmUgZW1wdHknLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIC8vIOagoemqjOavj+S4quS6i+S7tuexu+Wei1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcnVsZS5ldmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGV2ZW50ID0gcnVsZS5ldmVudHNbaV07XG4gICAgICBpZiAoIVZBTElEX0VWRU5UX1RZUEVTLmluY2x1ZGVzKGV2ZW50KSkge1xuICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3ZhbGlkYXRpb24nLFxuICAgICAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmV2ZW50c1ske2l9XWAsXG4gICAgICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgICAgIG1lc3NhZ2U6IGBJbnZhbGlkIGV2ZW50IHR5cGU6ICR7ZXZlbnR9YCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqozmnaHku7bliJfooajvvIjlj6/pgInvvIlcbiAgaWYgKHJ1bGUuY29uZGl0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHJ1bGUuY29uZGl0aW9ucykpIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmNvbmRpdGlvbnNgLFxuICAgICAgICBydWxlSWQ6IHJ1bGUuaWQsXG4gICAgICAgIG1lc3NhZ2U6ICdDb25kaXRpb25zIG11c3QgYmUgYW4gYXJyYXknLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIOagoemqjOavj+S4quadoeS7tlxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBydWxlLmNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY29uZGl0aW9uID0gcnVsZS5jb25kaXRpb25zW2ldO1xuICAgICAgICBjb25zdCBjb25kaXRpb25SZXN1bHQgPSB2YWxpZGF0ZUNvbmRpdGlvblNoYXBlKGNvbmRpdGlvbiwgaSwgcGF0aFByZWZpeCwgcnVsZS5pZCk7XG4gICAgICAgIGVycm9ycy5wdXNoKC4uLmNvbmRpdGlvblJlc3VsdC5lcnJvcnMpO1xuICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLmNvbmRpdGlvblJlc3VsdC53YXJuaW5ncyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqozliqjkvZzliJfooahcbiAgaWYgKCFydWxlLmFjdGlvbnMpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmFjdGlvbnNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0FjdGlvbnMgYXJyYXkgaXMgcmVxdWlyZWQnLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KHJ1bGUuYWN0aW9ucykpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmFjdGlvbnNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0FjdGlvbnMgbXVzdCBiZSBhbiBhcnJheScsXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAocnVsZS5hY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICd2YWxpZGF0aW9uJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LmFjdGlvbnNgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ0FjdGlvbnMgYXJyYXkgY2Fubm90IGJlIGVtcHR5JyxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyDmoKHpqozmr4/kuKrliqjkvZxcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJ1bGUuYWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgYWN0aW9uID0gcnVsZS5hY3Rpb25zW2ldO1xuICAgICAgY29uc3QgYWN0aW9uUmVzdWx0ID0gdmFsaWRhdGVBY3Rpb25TaGFwZShhY3Rpb24sIGksIHBhdGhQcmVmaXgsIHJ1bGUuaWQpO1xuICAgICAgZXJyb3JzLnB1c2goLi4uYWN0aW9uUmVzdWx0LmVycm9ycyk7XG4gICAgICB3YXJuaW5ncy5wdXNoKC4uLmFjdGlvblJlc3VsdC53YXJuaW5ncyk7XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqowgZW5hYmxlZO+8iOWPr+mAie+8iVxuICBpZiAocnVsZS5lbmFibGVkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJ1bGUuZW5hYmxlZCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5lbmFibGVkYCxcbiAgICAgIHJ1bGVJZDogcnVsZS5pZCxcbiAgICAgIG1lc3NhZ2U6ICdFbmFibGVkIG11c3QgYmUgYSBib29sZWFuJyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLy8g5qCh6aqMIHByaW9yaXR577yI5Y+v6YCJ77yJXG4gIGlmIChydWxlLnByaW9yaXR5ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJ1bGUucHJpb3JpdHkgIT09ICdudW1iZXInKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5wcmlvcml0eWAsXG4gICAgICBydWxlSWQ6IHJ1bGUuaWQsXG4gICAgICBtZXNzYWdlOiAnUHJpb3JpdHkgbXVzdCBiZSBhIG51bWJlcicsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIOagoemqjCBzdG9wT25NYXRjaO+8iOWPr+mAie+8iVxuICBpZiAocnVsZS5zdG9wT25NYXRjaCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBydWxlLnN0b3BPbk1hdGNoICE9PSAnYm9vbGVhbicpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGhQcmVmaXh9LnN0b3BPbk1hdGNoYCxcbiAgICAgIHJ1bGVJZDogcnVsZS5pZCxcbiAgICAgIG1lc3NhZ2U6ICdTdG9wT25NYXRjaCBtdXN0IGJlIGEgYm9vbGVhbicsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIOagoemqjCBjb29sZG93bk1z77yI5Y+v6YCJ77yJXG4gIGlmIChydWxlLmNvb2xkb3duTXMgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcnVsZS5jb29sZG93bk1zICE9PSAnbnVtYmVyJykge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgcGF0aDogYCR7cGF0aFByZWZpeH0uY29vbGRvd25Nc2AsXG4gICAgICBydWxlSWQ6IHJ1bGUuaWQsXG4gICAgICBtZXNzYWdlOiAnQ29vbGRvd25NcyBtdXN0IGJlIGEgbnVtYmVyJyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLy8g5qCh6aqMIG1heFRyaWdnZXJDb3VudO+8iOWPr+mAie+8iVxuICBpZiAocnVsZS5tYXhUcmlnZ2VyQ291bnQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcnVsZS5tYXhUcmlnZ2VyQ291bnQgIT09ICdudW1iZXInKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRoUHJlZml4fS5tYXhUcmlnZ2VyQ291bnRgLFxuICAgICAgcnVsZUlkOiBydWxlLmlkLFxuICAgICAgbWVzc2FnZTogJ01heFRyaWdnZXJDb3VudCBtdXN0IGJlIGEgbnVtYmVyJyxcbiAgICB9KTtcbiAgfVxuICBcbiAgcmV0dXJuIHsgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmnaHku7bmoKHpqoxcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmoKHpqozmnaHku7blvaLnirZcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQ29uZGl0aW9uU2hhcGUoXG4gIGNvbmRpdGlvbjogYW55LFxuICBpbmRleDogbnVtYmVyLFxuICBwYXRoUHJlZml4OiBzdHJpbmcsXG4gIHJ1bGVJZD86IHN0cmluZ1xuKToge1xuICBlcnJvcnM6IEF1dG9tYXRpb25Db25maWdFcnJvcltdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59IHtcbiAgY29uc3QgZXJyb3JzOiBBdXRvbWF0aW9uQ29uZmlnRXJyb3JbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGF0aCA9IGAke3BhdGhQcmVmaXh9LmNvbmRpdGlvbnNbJHtpbmRleH1dYDtcbiAgXG4gIC8vIOajgOafpeaYr+WQpuaYr+WvueixoVxuICBpZiAoIWNvbmRpdGlvbiB8fCB0eXBlb2YgY29uZGl0aW9uICE9PSAnb2JqZWN0Jykge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgcGF0aCxcbiAgICAgIHJ1bGVJZCxcbiAgICAgIG1lc3NhZ2U6ICdDb25kaXRpb24gbXVzdCBiZSBhbiBvYmplY3QnLFxuICAgIH0pO1xuICAgIHJldHVybiB7IGVycm9ycywgd2FybmluZ3MgfTtcbiAgfVxuICBcbiAgLy8g5qCh6aqM57G75Z6LXG4gIGlmICghY29uZGl0aW9uLnR5cGUpIHtcbiAgICBlcnJvcnMucHVzaCh7XG4gICAgICB0eXBlOiAnc2NoZW1hJyxcbiAgICAgIHBhdGg6IGAke3BhdGh9LnR5cGVgLFxuICAgICAgcnVsZUlkLFxuICAgICAgbWVzc2FnZTogJ0NvbmRpdGlvbiB0eXBlIGlzIHJlcXVpcmVkJyxcbiAgICB9KTtcbiAgfSBlbHNlIGlmICghWydmaWVsZCcsICdyZWdleCcsICd0aHJlc2hvbGQnLCAnY3VzdG9tJ10uaW5jbHVkZXMoY29uZGl0aW9uLnR5cGUpKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3ZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogYCR7cGF0aH0udHlwZWAsXG4gICAgICBydWxlSWQsXG4gICAgICBtZXNzYWdlOiBgSW52YWxpZCBjb25kaXRpb24gdHlwZTogJHtjb25kaXRpb24udHlwZX1gLFxuICAgIH0pO1xuICB9XG4gIFxuICAvLyDmoKHpqozlrZfmrrXot6/lvoTvvIhmaWVsZC9yZWdleC90aHJlc2hvbGQg57G75Z6L6ZyA6KaB77yJXG4gIGlmIChbJ2ZpZWxkJywgJ3JlZ2V4JywgJ3RocmVzaG9sZCddLmluY2x1ZGVzKGNvbmRpdGlvbi50eXBlKSkge1xuICAgIGlmICghY29uZGl0aW9uLmZpZWxkKSB7XG4gICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgICBwYXRoOiBgJHtwYXRofS5maWVsZGAsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZTogJ0ZpZWxkIGlzIHJlcXVpcmVkIGZvciBmaWVsZC9yZWdleC90aHJlc2hvbGQgY29uZGl0aW9ucycsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25kaXRpb24uZmllbGQgIT09ICdzdHJpbmcnKSB7XG4gICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgICBwYXRoOiBgJHtwYXRofS5maWVsZGAsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZTogJ0ZpZWxkIG11c3QgYmUgYSBzdHJpbmcnLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqozmk43kvZznrKbvvIhmaWVsZCDnsbvlnovpnIDopoHvvIlcbiAgaWYgKGNvbmRpdGlvbi50eXBlID09PSAnZmllbGQnKSB7XG4gICAgaWYgKCFjb25kaXRpb24ub3BlcmF0b3IpIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgIHBhdGg6IGAke3BhdGh9Lm9wZXJhdG9yYCxcbiAgICAgICAgcnVsZUlkLFxuICAgICAgICBtZXNzYWdlOiAnT3BlcmF0b3IgaXMgcmVxdWlyZWQgZm9yIGZpZWxkIGNvbmRpdGlvbnMnLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICghVkFMSURfT1BFUkFUT1JTLmluY2x1ZGVzKGNvbmRpdGlvbi5vcGVyYXRvcikpIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3ZhbGlkYXRpb24nLFxuICAgICAgICBwYXRoOiBgJHtwYXRofS5vcGVyYXRvcmAsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZTogYEludmFsaWQgb3BlcmF0b3I6ICR7Y29uZGl0aW9uLm9wZXJhdG9yfWAsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIOagoemqjOWAvO+8iGZpZWxkL3JlZ2V4L3RocmVzaG9sZCDnsbvlnovpnIDopoHvvIlcbiAgaWYgKFsnZmllbGQnLCAncmVnZXgnLCAndGhyZXNob2xkJ10uaW5jbHVkZXMoY29uZGl0aW9uLnR5cGUpKSB7XG4gICAgaWYgKGNvbmRpdGlvbi52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgICBwYXRoOiBgJHtwYXRofS52YWx1ZWAsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZTogJ1ZhbHVlIGlzIHJlcXVpcmVkIGZvciBmaWVsZC9yZWdleC90aHJlc2hvbGQgY29uZGl0aW9ucycsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIOagoemqjOihqOi+vuW8j++8iGN1c3RvbSDnsbvlnovpnIDopoHvvIlcbiAgaWYgKGNvbmRpdGlvbi50eXBlID09PSAnY3VzdG9tJykge1xuICAgIGlmICghY29uZGl0aW9uLmV4cHJlc3Npb24pIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgIHBhdGg6IGAke3BhdGh9LmV4cHJlc3Npb25gLFxuICAgICAgICBydWxlSWQsXG4gICAgICAgIG1lc3NhZ2U6ICdFeHByZXNzaW9uIGlzIHJlcXVpcmVkIGZvciBjdXN0b20gY29uZGl0aW9ucycsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25kaXRpb24uZXhwcmVzc2lvbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICAgIHBhdGg6IGAke3BhdGh9LmV4cHJlc3Npb25gLFxuICAgICAgICBydWxlSWQsXG4gICAgICAgIG1lc3NhZ2U6ICdFeHByZXNzaW9uIG11c3QgYmUgYSBzdHJpbmcnLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4geyBlcnJvcnMsIHdhcm5pbmdzIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOWKqOS9nOagoemqjFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOagoemqjOWKqOS9nOW9oueKtlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVBY3Rpb25TaGFwZShcbiAgYWN0aW9uOiBhbnksXG4gIGluZGV4OiBudW1iZXIsXG4gIHBhdGhQcmVmaXg6IHN0cmluZyxcbiAgcnVsZUlkPzogc3RyaW5nXG4pOiB7XG4gIGVycm9yczogQXV0b21hdGlvbkNvbmZpZ0Vycm9yW107XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn0ge1xuICBjb25zdCBlcnJvcnM6IEF1dG9tYXRpb25Db25maWdFcnJvcltdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBwYXRoID0gYCR7cGF0aFByZWZpeH0uYWN0aW9uc1ske2luZGV4fV1gO1xuICBcbiAgLy8g5qOA5p+l5piv5ZCm5piv5a+56LGhXG4gIGlmICghYWN0aW9uIHx8IHR5cGVvZiBhY3Rpb24gIT09ICdvYmplY3QnKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoLFxuICAgICAgcnVsZUlkLFxuICAgICAgbWVzc2FnZTogJ0FjdGlvbiBtdXN0IGJlIGFuIG9iamVjdCcsXG4gICAgfSk7XG4gICAgcmV0dXJuIHsgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG4gIFxuICAvLyDmoKHpqoznsbvlnotcbiAgaWYgKCFhY3Rpb24udHlwZSkge1xuICAgIGVycm9ycy5wdXNoKHtcbiAgICAgIHR5cGU6ICdzY2hlbWEnLFxuICAgICAgcGF0aDogYCR7cGF0aH0udHlwZWAsXG4gICAgICBydWxlSWQsXG4gICAgICBtZXNzYWdlOiAnQWN0aW9uIHR5cGUgaXMgcmVxdWlyZWQnLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKCFWQUxJRF9BQ1RJT05fVFlQRVMuaW5jbHVkZXMoYWN0aW9uLnR5cGUpKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3ZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogYCR7cGF0aH0udHlwZWAsXG4gICAgICBydWxlSWQsXG4gICAgICBtZXNzYWdlOiBgSW52YWxpZCBhY3Rpb24gdHlwZTogJHthY3Rpb24udHlwZX1gLFxuICAgIH0pO1xuICB9XG4gIFxuICAvLyDmoKHpqowgdGFyZ2V077yIbm90aWZ5L2VzY2FsYXRlIOexu+Wei+mcgOimge+8iVxuICBpZiAoWydub3RpZnknLCAnZXNjYWxhdGUnXS5pbmNsdWRlcyhhY3Rpb24udHlwZSkpIHtcbiAgICBpZiAoIWFjdGlvbi50YXJnZXQpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYEFjdGlvbiAke2FjdGlvbi50eXBlfSBhdCAke3BhdGh9IG1pc3NpbmcgdGFyZ2V0LCB3aWxsIHVzZSBkZWZhdWx0YCk7XG4gICAgfVxuICB9XG4gIFxuICAvLyDmoKHpqowgcGFyYW1z77yI5Y+v6YCJ77yJXG4gIGlmIChhY3Rpb24ucGFyYW1zICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGFjdGlvbi5wYXJhbXMgIT09ICdvYmplY3QnKSB7XG4gICAgZXJyb3JzLnB1c2goe1xuICAgICAgdHlwZTogJ3NjaGVtYScsXG4gICAgICBwYXRoOiBgJHtwYXRofS5wYXJhbXNgLFxuICAgICAgcnVsZUlkLFxuICAgICAgbWVzc2FnZTogJ1BhcmFtcyBtdXN0IGJlIGFuIG9iamVjdCcsXG4gICAgfSk7XG4gIH1cbiAgXG4gIHJldHVybiB7IGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6KeE5YiZ6KeE6IyD5YyWXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog6KeE6IyD5YyW6KeE5YiZXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVJ1bGUocnVsZTogQXV0b21hdGlvblJ1bGUpOiBBdXRvbWF0aW9uUnVsZSB7XG4gIHJldHVybiB7XG4gICAgLi4ucnVsZSxcbiAgICBlbmFibGVkOiBydWxlLmVuYWJsZWQgPz8gdHJ1ZSxcbiAgICBwcmlvcml0eTogcnVsZS5wcmlvcml0eSA/PyAwLFxuICAgIHN0b3BPbk1hdGNoOiBydWxlLnN0b3BPbk1hdGNoID8/IGZhbHNlLFxuICAgIGNvb2xkb3duTXM6IHJ1bGUuY29vbGRvd25NcyA/PyA2MDAwMCxcbiAgICBjb25kaXRpb25zOiBydWxlLmNvbmRpdGlvbnMgfHwgW10sXG4gIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOW/q+mAn+agoemqjOmFjee9rlxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVpY2tWYWxpZGF0ZUNvbmZpZyhjb25maWc6IGFueSk6IHtcbiAgdmFsaWQ6IGJvb2xlYW47XG4gIGVycm9yPzogc3RyaW5nO1xufSB7XG4gIGNvbnN0IHJlc3VsdCA9IHZhbGlkYXRlQXV0b21hdGlvbkRvY3VtZW50KGNvbmZpZyk7XG4gIFxuICBpZiAoIXJlc3VsdC52YWxpZCkge1xuICAgIHJldHVybiB7XG4gICAgICB2YWxpZDogZmFsc2UsXG4gICAgICBlcnJvcjogcmVzdWx0LmVycm9yc1swXT8ubWVzc2FnZSB8fCAnVW5rbm93biB2YWxpZGF0aW9uIGVycm9yJyxcbiAgICB9O1xuICB9XG4gIFxuICByZXR1cm4geyB2YWxpZDogdHJ1ZSB9O1xufVxuIl19