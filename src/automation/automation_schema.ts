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

import type {
  AutomationConfigDocument,
  AutomationRule,
  AutomationCondition,
  AutomationAction,
  AutomationConfigError,
  ComparisonOperator,
  AutomationEventType,
  AutomationActionType,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

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
const VALID_EVENT_TYPES: AutomationEventType[] = [
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
const VALID_ACTION_TYPES: AutomationActionType[] = [
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
const VALID_OPERATORS: ComparisonOperator[] = [
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
export function validateAutomationDocument(
  doc: any
): SchemaValidationResult {
  const errors: AutomationConfigError[] = [];
  const warnings: string[] = [];
  
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
  } else if (!SUPPORTED_VERSIONS.includes(doc.version)) {
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
  } else if (!Array.isArray(doc.rules)) {
    errors.push({
      type: 'schema',
      path: 'rules',
      message: 'Rules must be an array',
    });
  } else {
    // 校验每个规则
    const ruleIds = new Set<string>();
    
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
    } else {
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
    } else {
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
export function normalizeAutomationDocument(
  doc: AutomationConfigDocument
): AutomationConfigDocument {
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
export function validateRuleShape(
  rule: any,
  index?: number
): {
  errors: AutomationConfigError[];
  warnings: string[];
} {
  const errors: AutomationConfigError[] = [];
  const warnings: string[] = [];
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
  } else if (typeof rule.id !== 'string') {
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
  } else if (!Array.isArray(rule.events)) {
    errors.push({
      type: 'schema',
      path: `${pathPrefix}.events`,
      ruleId: rule.id,
      message: 'Events must be an array',
    });
  } else if (rule.events.length === 0) {
    errors.push({
      type: 'validation',
      path: `${pathPrefix}.events`,
      ruleId: rule.id,
      message: 'Events array cannot be empty',
    });
  } else {
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
    } else {
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
  } else if (!Array.isArray(rule.actions)) {
    errors.push({
      type: 'schema',
      path: `${pathPrefix}.actions`,
      ruleId: rule.id,
      message: 'Actions must be an array',
    });
  } else if (rule.actions.length === 0) {
    errors.push({
      type: 'validation',
      path: `${pathPrefix}.actions`,
      ruleId: rule.id,
      message: 'Actions array cannot be empty',
    });
  } else {
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
export function validateConditionShape(
  condition: any,
  index: number,
  pathPrefix: string,
  ruleId?: string
): {
  errors: AutomationConfigError[];
  warnings: string[];
} {
  const errors: AutomationConfigError[] = [];
  const warnings: string[] = [];
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
  } else if (!['field', 'regex', 'threshold', 'custom'].includes(condition.type)) {
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
    } else if (typeof condition.field !== 'string') {
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
    } else if (!VALID_OPERATORS.includes(condition.operator)) {
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
    } else if (typeof condition.expression !== 'string') {
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
export function validateActionShape(
  action: any,
  index: number,
  pathPrefix: string,
  ruleId?: string
): {
  errors: AutomationConfigError[];
  warnings: string[];
} {
  const errors: AutomationConfigError[] = [];
  const warnings: string[] = [];
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
  } else if (!VALID_ACTION_TYPES.includes(action.type)) {
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
function normalizeRule(rule: AutomationRule): AutomationRule {
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
export function quickValidateConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  const result = validateAutomationDocument(config);
  
  if (!result.valid) {
    return {
      valid: false,
      error: result.errors[0]?.message || 'Unknown validation error',
    };
  }
  
  return { valid: true };
}
