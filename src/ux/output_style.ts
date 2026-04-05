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

import type {
  OutputStyleDescriptor,
  OutputStyleId,
  ContentSectionType,
  VerbosityLevel,
  OutputAudience,
} from './types';

// ============================================================================
// 预定义风格配置
// ============================================================================

/**
 * Minimal 风格 - 极短摘要
 * 
 * 适用场景：Telegram / mobile / remote / 低带宽
 */
export const MINIMAL_STYLE: OutputStyleDescriptor = {
  id: 'minimal',
  name: 'Minimal',
  description: '极短摘要，只保留关键信息',
  audience: 'remote',
  verbosity: 'minimal',
  sectionOrder: ['summary', 'actions', 'warnings'],
  includeTimestamps: false,
  includeMetadata: false,
  preferBullets: true,
  preferTables: false,
  languageHint: 'en',
  maxSummaryLength: 100,
  maxDetailsLength: 200,
  codeBlockStyle: 'inline',
  listStyle: 'bullet',
  tone: 'casual',
  suitableFor: ['telegram', 'sms', 'low-bandwidth', 'mobile'],
  isBuiltin: true,
  enabled: true,
};

/**
 * Audit 风格 - 审计/合规
 * 
 * 适用场景：compliance / security / ops / 审计追踪
 */
export const AUDIT_STYLE: OutputStyleDescriptor = {
  id: 'audit',
  name: 'Audit',
  description: '完整、可追溯、带时间戳和元数据',
  audience: 'compliance',
  verbosity: 'verbose',
  sectionOrder: ['summary', 'status', 'timeline', 'evidence', 'metrics', 'actions', 'metadata'],
  includeTimestamps: true,
  includeMetadata: true,
  preferBullets: false,
  preferTables: true,
  languageHint: 'en',
  maxSummaryLength: 500,
  maxDetailsLength: 5000,
  codeBlockStyle: 'fenced',
  listStyle: 'table',
  tone: 'formal',
  suitableFor: ['compliance', 'security', 'ops', 'audit', 'legal'],
  isBuiltin: true,
  enabled: true,
};

/**
 * Coding 风格 - 开发场景
 * 
 * 适用场景：development / code-review / diff
 */
export const CODING_STYLE: OutputStyleDescriptor = {
  id: 'coding',
  name: 'Coding',
  description: '代码优先、diff 友好、技术细节完整',
  audience: 'development',
  verbosity: 'detailed',
  sectionOrder: ['summary', 'status', 'artifacts', 'actions', 'warnings', 'evidence'],
  includeTimestamps: false,
  includeMetadata: false,
  preferBullets: true,
  preferTables: false,
  languageHint: 'en',
  maxSummaryLength: 200,
  maxDetailsLength: 2000,
  codeBlockStyle: 'diff',
  listStyle: 'bullet',
  tone: 'technical',
  suitableFor: ['development', 'code-review', 'debugging', 'engineering'],
  isBuiltin: true,
  enabled: true,
};

/**
 * Ops 风格 - 运维场景
 * 
 * 适用场景：operations / monitoring / incident
 */
export const OPS_STYLE: OutputStyleDescriptor = {
  id: 'ops',
  name: 'Ops',
  description: '指标优先、告警突出、动作建议紧随其后',
  audience: 'operations',
  verbosity: 'concise',
  sectionOrder: ['status', 'metrics', 'warnings', 'actions', 'summary'],
  includeTimestamps: true,
  includeMetadata: false,
  preferBullets: false,
  preferTables: true,
  languageHint: 'en',
  maxSummaryLength: 300,
  maxDetailsLength: 1500,
  codeBlockStyle: 'fenced',
  listStyle: 'table',
  tone: 'technical',
  suitableFor: ['operations', 'monitoring', 'incident', 'sre', 'oncall'],
  isBuiltin: true,
  enabled: true,
};

/**
 * Management 风格 - 管理层汇报
 * 
 * 适用场景：management / reporting / stakeholder
 */
export const MANAGEMENT_STYLE: OutputStyleDescriptor = {
  id: 'management',
  name: 'Management',
  description: '摘要优先、风险/进展/建议三段式、压缩技术细节',
  audience: 'management',
  verbosity: 'concise',
  sectionOrder: ['summary', 'status', 'metrics', 'recommendations', 'warnings'],
  includeTimestamps: false,
  includeMetadata: false,
  preferBullets: true,
  preferTables: false,
  languageHint: 'en',
  maxSummaryLength: 200,
  maxDetailsLength: 800,
  codeBlockStyle: 'inline',
  listStyle: 'bullet',
  tone: 'formal',
  suitableFor: ['management', 'reporting', 'stakeholder', 'executive'],
  isBuiltin: true,
  enabled: true,
};

/**
 * Zh PM 风格 - 中文产品经理
 * 
 * 适用场景：product / chinese-speaking / structured
 */
export const ZH_PM_STYLE: OutputStyleDescriptor = {
  id: 'zh_pm',
  name: '中文产品',
  description: '中文表达、强结构、结论/影响/下一步清晰',
  audience: 'product',
  verbosity: 'normal',
  sectionOrder: ['summary', 'status', 'recommendations', 'actions', 'warnings', 'evidence'],
  includeTimestamps: false,
  includeMetadata: true,
  preferBullets: false,
  preferTables: false,
  languageHint: 'zh',
  maxSummaryLength: 300,
  maxDetailsLength: 1500,
  codeBlockStyle: 'fenced',
  listStyle: 'numbered',
  tone: 'casual',
  suitableFor: ['product', 'chinese-speaking', 'structured', 'planning'],
  isBuiltin: true,
  enabled: true,
};

// ============================================================================
// 内置风格列表
// ============================================================================

/**
 * 所有内置风格
 */
export const BUILTIN_STYLES: OutputStyleDescriptor[] = [
  MINIMAL_STYLE,
  AUDIT_STYLE,
  CODING_STYLE,
  OPS_STYLE,
  MANAGEMENT_STYLE,
  ZH_PM_STYLE,
];

/**
 * 内置风格映射
 */
export const BUILTIN_STYLE_MAP: Record<OutputStyleId, OutputStyleDescriptor> = {
  minimal: MINIMAL_STYLE,
  audit: AUDIT_STYLE,
  coding: CODING_STYLE,
  ops: OPS_STYLE,
  management: MANAGEMENT_STYLE,
  zh_pm: ZH_PM_STYLE,
};

// ============================================================================
// 风格定义函数
// ============================================================================

/**
 * 定义风格
 */
export function defineStyle(descriptor: Partial<OutputStyleDescriptor>): OutputStyleDescriptor {
  if (!descriptor.id) {
    throw new Error('Style ID is required');
  }
  
  return {
    ...descriptor,
    isBuiltin: false,
    enabled: descriptor.enabled ?? true,
  } as OutputStyleDescriptor;
}

/**
 * 规范化风格
 */
export function normalizeStyle(descriptor: Partial<OutputStyleDescriptor>): OutputStyleDescriptor {
  // 查找是否有同 ID 的内置风格作为基准
  const builtin = BUILTIN_STYLE_MAP[descriptor.id as OutputStyleId];
  
  if (builtin) {
    // 基于内置风格扩展
    return {
      ...builtin,
      ...descriptor,
    };
  }
  
  // 新风格，应用默认值
  return {
    id: descriptor.id || 'custom',
    name: descriptor.name || 'Custom Style',
    description: descriptor.description || 'Custom output style',
    audience: descriptor.audience || 'remote',
    verbosity: descriptor.verbosity || 'normal',
    sectionOrder: descriptor.sectionOrder || ['summary', 'actions'],
    includeTimestamps: descriptor.includeTimestamps ?? false,
    includeMetadata: descriptor.includeMetadata ?? false,
    preferBullets: descriptor.preferBullets ?? true,
    preferTables: descriptor.preferTables ?? false,
    languageHint: descriptor.languageHint || 'en',
    maxSummaryLength: descriptor.maxSummaryLength || 300,
    maxDetailsLength: descriptor.maxDetailsLength || 1500,
    codeBlockStyle: descriptor.codeBlockStyle || 'fenced',
    listStyle: descriptor.listStyle || 'bullet',
    tone: descriptor.tone || 'casual',
    suitableFor: descriptor.suitableFor || [],
    isBuiltin: false,
    enabled: descriptor.enabled ?? true,
  };
}

/**
 * 校验风格
 */
export function validateStyle(descriptor: Partial<OutputStyleDescriptor>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 必需字段检查
  if (!descriptor.id) {
    errors.push('Style ID is required');
  }
  
  if (!descriptor.name) {
    errors.push('Style name is required');
  }
  
  // 字段类型检查
  if (descriptor.verbosity && !['minimal', 'concise', 'normal', 'detailed', 'verbose'].includes(descriptor.verbosity)) {
    errors.push(`Invalid verbosity: ${descriptor.verbosity}`);
  }
  
  if (descriptor.tone && !['formal', 'casual', 'technical'].includes(descriptor.tone)) {
    errors.push(`Invalid tone: ${descriptor.tone}`);
  }
  
  if (descriptor.codeBlockStyle && !['inline', 'fenced', 'diff'].includes(descriptor.codeBlockStyle)) {
    errors.push(`Invalid codeBlockStyle: ${descriptor.codeBlockStyle}`);
  }
  
  if (descriptor.listStyle && !['bullet', 'numbered', 'table'].includes(descriptor.listStyle)) {
    errors.push(`Invalid listStyle: ${descriptor.listStyle}`);
  }
  
  // 逻辑检查
  if (descriptor.maxSummaryLength && descriptor.maxDetailsLength) {
    if (descriptor.maxSummaryLength > descriptor.maxDetailsLength) {
      warnings.push('maxSummaryLength should not exceed maxDetailsLength');
    }
  }
  
  // sectionOrder 检查
  const validSections: ContentSectionType[] = [
    'summary', 'status', 'actions', 'warnings', 'evidence',
    'metrics', 'timeline', 'artifacts', 'recommendations', 'metadata'
  ];
  
  if (descriptor.sectionOrder) {
    for (const section of descriptor.sectionOrder) {
      if (!validSections.includes(section)) {
        errors.push(`Invalid section type: ${section}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 获取内置风格
 */
export function getBuiltinStyles(): OutputStyleDescriptor[] {
  return [...BUILTIN_STYLES];
}

/**
 * 获取内置风格映射
 */
export function getBuiltinStyleMap(): Record<OutputStyleId, OutputStyleDescriptor> {
  return { ...BUILTIN_STYLE_MAP };
}

/**
 * 根据受众推荐风格
 */
export function recommendStyleForAudience(audience: OutputAudience): OutputStyleId {
  const recommendations: Record<OutputAudience, OutputStyleId> = {
    remote: 'minimal',
    compliance: 'audit',
    development: 'coding',
    operations: 'ops',
    management: 'management',
    product: 'zh_pm',
  };
  
  return recommendations[audience] || 'minimal';
}

/**
 * 根据场景推荐风格
 */
export function recommendStyleForScenario(scenario: string): OutputStyleId {
  const scenarioMap: Record<string, OutputStyleId> = {
    telegram: 'minimal',
    sms: 'minimal',
    mobile: 'minimal',
    compliance: 'audit',
    security: 'audit',
    audit: 'audit',
    development: 'coding',
    codeReview: 'coding',
    debugging: 'coding',
    operations: 'ops',
    monitoring: 'ops',
    incident: 'ops',
    management: 'management',
    reporting: 'management',
    product: 'zh_pm',
    planning: 'zh_pm',
  };
  
  const normalizedScenario = scenario.toLowerCase();
  
  for (const [key, styleId] of Object.entries(scenarioMap)) {
    if (normalizedScenario.includes(key)) {
      return styleId;
    }
  }
  
  return 'minimal';
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 快速创建风格
 */
export function createStyle(
  id: OutputStyleId,
  name: string,
  overrides?: Partial<OutputStyleDescriptor>
): OutputStyleDescriptor {
  return normalizeStyle({
    id,
    name,
    ...overrides,
  });
}

/**
 * 快速校验并创建风格
 */
export function createValidatedStyle(
  descriptor: Partial<OutputStyleDescriptor>
): {
  style?: OutputStyleDescriptor;
  errors: string[];
  warnings: string[];
} {
  const validation = validateStyle(descriptor);
  
  if (!validation.valid) {
    return {
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
  
  return {
    style: normalizeStyle(descriptor),
    errors: [],
    warnings: validation.warnings,
  };
}
