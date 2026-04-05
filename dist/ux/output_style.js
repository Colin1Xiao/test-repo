"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_STYLE_MAP = exports.BUILTIN_STYLES = exports.ZH_PM_STYLE = exports.MANAGEMENT_STYLE = exports.OPS_STYLE = exports.CODING_STYLE = exports.AUDIT_STYLE = exports.MINIMAL_STYLE = void 0;
exports.defineStyle = defineStyle;
exports.normalizeStyle = normalizeStyle;
exports.validateStyle = validateStyle;
exports.getBuiltinStyles = getBuiltinStyles;
exports.getBuiltinStyleMap = getBuiltinStyleMap;
exports.recommendStyleForAudience = recommendStyleForAudience;
exports.recommendStyleForScenario = recommendStyleForScenario;
exports.createStyle = createStyle;
exports.createValidatedStyle = createValidatedStyle;
// ============================================================================
// 预定义风格配置
// ============================================================================
/**
 * Minimal 风格 - 极短摘要
 *
 * 适用场景：Telegram / mobile / remote / 低带宽
 */
exports.MINIMAL_STYLE = {
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
exports.AUDIT_STYLE = {
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
exports.CODING_STYLE = {
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
exports.OPS_STYLE = {
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
exports.MANAGEMENT_STYLE = {
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
exports.ZH_PM_STYLE = {
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
exports.BUILTIN_STYLES = [
    exports.MINIMAL_STYLE,
    exports.AUDIT_STYLE,
    exports.CODING_STYLE,
    exports.OPS_STYLE,
    exports.MANAGEMENT_STYLE,
    exports.ZH_PM_STYLE,
];
/**
 * 内置风格映射
 */
exports.BUILTIN_STYLE_MAP = {
    minimal: exports.MINIMAL_STYLE,
    audit: exports.AUDIT_STYLE,
    coding: exports.CODING_STYLE,
    ops: exports.OPS_STYLE,
    management: exports.MANAGEMENT_STYLE,
    zh_pm: exports.ZH_PM_STYLE,
};
// ============================================================================
// 风格定义函数
// ============================================================================
/**
 * 定义风格
 */
function defineStyle(descriptor) {
    if (!descriptor.id) {
        throw new Error('Style ID is required');
    }
    return {
        ...descriptor,
        isBuiltin: false,
        enabled: descriptor.enabled ?? true,
    };
}
/**
 * 规范化风格
 */
function normalizeStyle(descriptor) {
    // 查找是否有同 ID 的内置风格作为基准
    const builtin = exports.BUILTIN_STYLE_MAP[descriptor.id];
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
function validateStyle(descriptor) {
    const errors = [];
    const warnings = [];
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
    const validSections = [
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
function getBuiltinStyles() {
    return [...exports.BUILTIN_STYLES];
}
/**
 * 获取内置风格映射
 */
function getBuiltinStyleMap() {
    return { ...exports.BUILTIN_STYLE_MAP };
}
/**
 * 根据受众推荐风格
 */
function recommendStyleForAudience(audience) {
    const recommendations = {
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
function recommendStyleForScenario(scenario) {
    const scenarioMap = {
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
function createStyle(id, name, overrides) {
    return normalizeStyle({
        id,
        name,
        ...overrides,
    });
}
/**
 * 快速校验并创建风格
 */
function createValidatedStyle(descriptor) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X3N0eWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V4L291dHB1dF9zdHlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBbU5ILGtDQVVDO0FBS0Qsd0NBa0NDO0FBS0Qsc0NBNERDO0FBS0QsNENBRUM7QUFLRCxnREFFQztBQUtELDhEQVdDO0FBS0QsOERBNkJDO0FBU0Qsa0NBVUM7QUFLRCxvREFxQkM7QUF4YUQsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0U7Ozs7R0FJRztBQUNVLFFBQUEsYUFBYSxHQUEwQjtJQUNsRCxFQUFFLEVBQUUsU0FBUztJQUNiLElBQUksRUFBRSxTQUFTO0lBQ2YsV0FBVyxFQUFFLGNBQWM7SUFDM0IsUUFBUSxFQUFFLFFBQVE7SUFDbEIsU0FBUyxFQUFFLFNBQVM7SUFDcEIsWUFBWSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUM7SUFDaEQsaUJBQWlCLEVBQUUsS0FBSztJQUN4QixlQUFlLEVBQUUsS0FBSztJQUN0QixhQUFhLEVBQUUsSUFBSTtJQUNuQixZQUFZLEVBQUUsS0FBSztJQUNuQixZQUFZLEVBQUUsSUFBSTtJQUNsQixnQkFBZ0IsRUFBRSxHQUFHO0lBQ3JCLGdCQUFnQixFQUFFLEdBQUc7SUFDckIsY0FBYyxFQUFFLFFBQVE7SUFDeEIsU0FBUyxFQUFFLFFBQVE7SUFDbkIsSUFBSSxFQUFFLFFBQVE7SUFDZCxXQUFXLEVBQUUsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUM7SUFDM0QsU0FBUyxFQUFFLElBQUk7SUFDZixPQUFPLEVBQUUsSUFBSTtDQUNkLENBQUM7QUFFRjs7OztHQUlHO0FBQ1UsUUFBQSxXQUFXLEdBQTBCO0lBQ2hELEVBQUUsRUFBRSxPQUFPO0lBQ1gsSUFBSSxFQUFFLE9BQU87SUFDYixXQUFXLEVBQUUsaUJBQWlCO0lBQzlCLFFBQVEsRUFBRSxZQUFZO0lBQ3RCLFNBQVMsRUFBRSxTQUFTO0lBQ3BCLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQztJQUM3RixpQkFBaUIsRUFBRSxJQUFJO0lBQ3ZCLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLGFBQWEsRUFBRSxLQUFLO0lBQ3BCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLGdCQUFnQixFQUFFLEdBQUc7SUFDckIsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixjQUFjLEVBQUUsUUFBUTtJQUN4QixTQUFTLEVBQUUsT0FBTztJQUNsQixJQUFJLEVBQUUsUUFBUTtJQUNkLFdBQVcsRUFBRSxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDaEUsU0FBUyxFQUFFLElBQUk7SUFDZixPQUFPLEVBQUUsSUFBSTtDQUNkLENBQUM7QUFFRjs7OztHQUlHO0FBQ1UsUUFBQSxZQUFZLEdBQTBCO0lBQ2pELEVBQUUsRUFBRSxRQUFRO0lBQ1osSUFBSSxFQUFFLFFBQVE7SUFDZCxXQUFXLEVBQUUscUJBQXFCO0lBQ2xDLFFBQVEsRUFBRSxhQUFhO0lBQ3ZCLFNBQVMsRUFBRSxVQUFVO0lBQ3JCLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDO0lBQ25GLGlCQUFpQixFQUFFLEtBQUs7SUFDeEIsZUFBZSxFQUFFLEtBQUs7SUFDdEIsYUFBYSxFQUFFLElBQUk7SUFDbkIsWUFBWSxFQUFFLEtBQUs7SUFDbkIsWUFBWSxFQUFFLElBQUk7SUFDbEIsZ0JBQWdCLEVBQUUsR0FBRztJQUNyQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLGNBQWMsRUFBRSxNQUFNO0lBQ3RCLFNBQVMsRUFBRSxRQUFRO0lBQ25CLElBQUksRUFBRSxXQUFXO0lBQ2pCLFdBQVcsRUFBRSxDQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQztJQUN2RSxTQUFTLEVBQUUsSUFBSTtJQUNmLE9BQU8sRUFBRSxJQUFJO0NBQ2QsQ0FBQztBQUVGOzs7O0dBSUc7QUFDVSxRQUFBLFNBQVMsR0FBMEI7SUFDOUMsRUFBRSxFQUFFLEtBQUs7SUFDVCxJQUFJLEVBQUUsS0FBSztJQUNYLFdBQVcsRUFBRSxvQkFBb0I7SUFDakMsUUFBUSxFQUFFLFlBQVk7SUFDdEIsU0FBUyxFQUFFLFNBQVM7SUFDcEIsWUFBWSxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztJQUNyRSxpQkFBaUIsRUFBRSxJQUFJO0lBQ3ZCLGVBQWUsRUFBRSxLQUFLO0lBQ3RCLGFBQWEsRUFBRSxLQUFLO0lBQ3BCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLGdCQUFnQixFQUFFLEdBQUc7SUFDckIsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixjQUFjLEVBQUUsUUFBUTtJQUN4QixTQUFTLEVBQUUsT0FBTztJQUNsQixJQUFJLEVBQUUsV0FBVztJQUNqQixXQUFXLEVBQUUsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDO0lBQ3RFLFNBQVMsRUFBRSxJQUFJO0lBQ2YsT0FBTyxFQUFFLElBQUk7Q0FDZCxDQUFDO0FBRUY7Ozs7R0FJRztBQUNVLFFBQUEsZ0JBQWdCLEdBQTBCO0lBQ3JELEVBQUUsRUFBRSxZQUFZO0lBQ2hCLElBQUksRUFBRSxZQUFZO0lBQ2xCLFdBQVcsRUFBRSx5QkFBeUI7SUFDdEMsUUFBUSxFQUFFLFlBQVk7SUFDdEIsU0FBUyxFQUFFLFNBQVM7SUFDcEIsWUFBWSxFQUFFLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsVUFBVSxDQUFDO0lBQzdFLGlCQUFpQixFQUFFLEtBQUs7SUFDeEIsZUFBZSxFQUFFLEtBQUs7SUFDdEIsYUFBYSxFQUFFLElBQUk7SUFDbkIsWUFBWSxFQUFFLEtBQUs7SUFDbkIsWUFBWSxFQUFFLElBQUk7SUFDbEIsZ0JBQWdCLEVBQUUsR0FBRztJQUNyQixnQkFBZ0IsRUFBRSxHQUFHO0lBQ3JCLGNBQWMsRUFBRSxRQUFRO0lBQ3hCLFNBQVMsRUFBRSxRQUFRO0lBQ25CLElBQUksRUFBRSxRQUFRO0lBQ2QsV0FBVyxFQUFFLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsV0FBVyxDQUFDO0lBQ3BFLFNBQVMsRUFBRSxJQUFJO0lBQ2YsT0FBTyxFQUFFLElBQUk7Q0FDZCxDQUFDO0FBRUY7Ozs7R0FJRztBQUNVLFFBQUEsV0FBVyxHQUEwQjtJQUNoRCxFQUFFLEVBQUUsT0FBTztJQUNYLElBQUksRUFBRSxNQUFNO0lBQ1osV0FBVyxFQUFFLHNCQUFzQjtJQUNuQyxRQUFRLEVBQUUsU0FBUztJQUNuQixTQUFTLEVBQUUsUUFBUTtJQUNuQixZQUFZLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDO0lBQ3pGLGlCQUFpQixFQUFFLEtBQUs7SUFDeEIsZUFBZSxFQUFFLElBQUk7SUFDckIsYUFBYSxFQUFFLEtBQUs7SUFDcEIsWUFBWSxFQUFFLEtBQUs7SUFDbkIsWUFBWSxFQUFFLElBQUk7SUFDbEIsZ0JBQWdCLEVBQUUsR0FBRztJQUNyQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLGNBQWMsRUFBRSxRQUFRO0lBQ3hCLFNBQVMsRUFBRSxVQUFVO0lBQ3JCLElBQUksRUFBRSxRQUFRO0lBQ2QsV0FBVyxFQUFFLENBQUMsU0FBUyxFQUFFLGtCQUFrQixFQUFFLFlBQVksRUFBRSxVQUFVLENBQUM7SUFDdEUsU0FBUyxFQUFFLElBQUk7SUFDZixPQUFPLEVBQUUsSUFBSTtDQUNkLENBQUM7QUFFRiwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRTs7R0FFRztBQUNVLFFBQUEsY0FBYyxHQUE0QjtJQUNyRCxxQkFBYTtJQUNiLG1CQUFXO0lBQ1gsb0JBQVk7SUFDWixpQkFBUztJQUNULHdCQUFnQjtJQUNoQixtQkFBVztDQUNaLENBQUM7QUFFRjs7R0FFRztBQUNVLFFBQUEsaUJBQWlCLEdBQWlEO0lBQzdFLE9BQU8sRUFBRSxxQkFBYTtJQUN0QixLQUFLLEVBQUUsbUJBQVc7SUFDbEIsTUFBTSxFQUFFLG9CQUFZO0lBQ3BCLEdBQUcsRUFBRSxpQkFBUztJQUNkLFVBQVUsRUFBRSx3QkFBZ0I7SUFDNUIsS0FBSyxFQUFFLG1CQUFXO0NBQ25CLENBQUM7QUFFRiwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxVQUEwQztJQUNwRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsT0FBTztRQUNMLEdBQUcsVUFBVTtRQUNiLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTyxJQUFJLElBQUk7S0FDWCxDQUFDO0FBQzdCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxVQUEwQztJQUN2RSxzQkFBc0I7SUFDdEIsTUFBTSxPQUFPLEdBQUcseUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQW1CLENBQUMsQ0FBQztJQUVsRSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ1osV0FBVztRQUNYLE9BQU87WUFDTCxHQUFHLE9BQU87WUFDVixHQUFHLFVBQVU7U0FDZCxDQUFDO0lBQ0osQ0FBQztJQUVELFlBQVk7SUFDWixPQUFPO1FBQ0wsRUFBRSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksUUFBUTtRQUM3QixJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUksSUFBSSxjQUFjO1FBQ3ZDLFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVyxJQUFJLHFCQUFxQjtRQUM1RCxRQUFRLEVBQUUsVUFBVSxDQUFDLFFBQVEsSUFBSSxRQUFRO1FBQ3pDLFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUyxJQUFJLFFBQVE7UUFDM0MsWUFBWSxFQUFFLFVBQVUsQ0FBQyxZQUFZLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO1FBQy9ELGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsSUFBSSxLQUFLO1FBQ3hELGVBQWUsRUFBRSxVQUFVLENBQUMsZUFBZSxJQUFJLEtBQUs7UUFDcEQsYUFBYSxFQUFFLFVBQVUsQ0FBQyxhQUFhLElBQUksSUFBSTtRQUMvQyxZQUFZLEVBQUUsVUFBVSxDQUFDLFlBQVksSUFBSSxLQUFLO1FBQzlDLFlBQVksRUFBRSxVQUFVLENBQUMsWUFBWSxJQUFJLElBQUk7UUFDN0MsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixJQUFJLEdBQUc7UUFDcEQsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixJQUFJLElBQUk7UUFDckQsY0FBYyxFQUFFLFVBQVUsQ0FBQyxjQUFjLElBQUksUUFBUTtRQUNyRCxTQUFTLEVBQUUsVUFBVSxDQUFDLFNBQVMsSUFBSSxRQUFRO1FBQzNDLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSSxJQUFJLFFBQVE7UUFDakMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXLElBQUksRUFBRTtRQUN6QyxTQUFTLEVBQUUsS0FBSztRQUNoQixPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU8sSUFBSSxJQUFJO0tBQ3BDLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixhQUFhLENBQUMsVUFBMEM7SUFLdEUsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUU5QixTQUFTO0lBQ1QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDckIsTUFBTSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxTQUFTO0lBQ1QsSUFBSSxVQUFVLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQ3BILE1BQU0sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFRCxJQUFJLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ3BGLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCxJQUFJLFVBQVUsQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1FBQ25HLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLFVBQVUsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRCxJQUFJLFVBQVUsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQzVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFRCxPQUFPO0lBQ1AsSUFBSSxVQUFVLENBQUMsZ0JBQWdCLElBQUksVUFBVSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDL0QsSUFBSSxVQUFVLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDOUQsUUFBUSxDQUFDLElBQUksQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7SUFDSCxDQUFDO0lBRUQsa0JBQWtCO0lBQ2xCLE1BQU0sYUFBYSxHQUF5QjtRQUMxQyxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsVUFBVTtRQUN0RCxTQUFTLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxVQUFVO0tBQ2xFLENBQUM7SUFFRixJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUM1QixLQUFLLE1BQU0sT0FBTyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM5QyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNyQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xELENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU87UUFDTCxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO1FBQzFCLE1BQU07UUFDTixRQUFRO0tBQ1QsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGdCQUFnQjtJQUM5QixPQUFPLENBQUMsR0FBRyxzQkFBYyxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCO0lBQ2hDLE9BQU8sRUFBRSxHQUFHLHlCQUFpQixFQUFFLENBQUM7QUFDbEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQUMsUUFBd0I7SUFDaEUsTUFBTSxlQUFlLEdBQTBDO1FBQzdELE1BQU0sRUFBRSxTQUFTO1FBQ2pCLFVBQVUsRUFBRSxPQUFPO1FBQ25CLFdBQVcsRUFBRSxRQUFRO1FBQ3JCLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLE9BQU8sRUFBRSxPQUFPO0tBQ2pCLENBQUM7SUFFRixPQUFPLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxTQUFTLENBQUM7QUFDaEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQUMsUUFBZ0I7SUFDeEQsTUFBTSxXQUFXLEdBQWtDO1FBQ2pELFFBQVEsRUFBRSxTQUFTO1FBQ25CLEdBQUcsRUFBRSxTQUFTO1FBQ2QsTUFBTSxFQUFFLFNBQVM7UUFDakIsVUFBVSxFQUFFLE9BQU87UUFDbkIsUUFBUSxFQUFFLE9BQU87UUFDakIsS0FBSyxFQUFFLE9BQU87UUFDZCxXQUFXLEVBQUUsUUFBUTtRQUNyQixVQUFVLEVBQUUsUUFBUTtRQUNwQixTQUFTLEVBQUUsUUFBUTtRQUNuQixVQUFVLEVBQUUsS0FBSztRQUNqQixVQUFVLEVBQUUsS0FBSztRQUNqQixRQUFRLEVBQUUsS0FBSztRQUNmLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLFNBQVMsRUFBRSxZQUFZO1FBQ3ZCLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFFBQVEsRUFBRSxPQUFPO0tBQ2xCLENBQUM7SUFFRixNQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUVsRCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1FBQ3pELElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDckMsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixXQUFXLENBQ3pCLEVBQWlCLEVBQ2pCLElBQVksRUFDWixTQUEwQztJQUUxQyxPQUFPLGNBQWMsQ0FBQztRQUNwQixFQUFFO1FBQ0YsSUFBSTtRQUNKLEdBQUcsU0FBUztLQUNiLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUNsQyxVQUEwQztJQU0xQyxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QixPQUFPO1lBQ0wsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNO1lBQ3pCLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUTtTQUM5QixDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU87UUFDTCxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVUsQ0FBQztRQUNqQyxNQUFNLEVBQUUsRUFBRTtRQUNWLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUTtLQUM5QixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3V0cHV0IFN0eWxlIC0g6L6T5Ye66aOO5qC85a6a5LmJ5bGCXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5a6a5LmJ6aOO5qC85o+P6L+w5a+56LGhXG4gKiAyLiDlrprkuYnpo47moLznu6fmib/miJbpu5jorqTlgLxcbiAqIDMuIOinhOiMg+S4jeWQjOmjjuagvOeahOWBj+WlvVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE91dHB1dFN0eWxlRGVzY3JpcHRvcixcbiAgT3V0cHV0U3R5bGVJZCxcbiAgQ29udGVudFNlY3Rpb25UeXBlLFxuICBWZXJib3NpdHlMZXZlbCxcbiAgT3V0cHV0QXVkaWVuY2UsXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpooTlrprkuYnpo47moLzphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBNaW5pbWFsIOmjjuagvCAtIOaegeefreaRmOimgVxuICogXG4gKiDpgILnlKjlnLrmma/vvJpUZWxlZ3JhbSAvIG1vYmlsZSAvIHJlbW90ZSAvIOS9juW4puWuvVxuICovXG5leHBvcnQgY29uc3QgTUlOSU1BTF9TVFlMRTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yID0ge1xuICBpZDogJ21pbmltYWwnLFxuICBuYW1lOiAnTWluaW1hbCcsXG4gIGRlc2NyaXB0aW9uOiAn5p6B55+t5pGY6KaB77yM5Y+q5L+d55WZ5YWz6ZSu5L+h5oGvJyxcbiAgYXVkaWVuY2U6ICdyZW1vdGUnLFxuICB2ZXJib3NpdHk6ICdtaW5pbWFsJyxcbiAgc2VjdGlvbk9yZGVyOiBbJ3N1bW1hcnknLCAnYWN0aW9ucycsICd3YXJuaW5ncyddLFxuICBpbmNsdWRlVGltZXN0YW1wczogZmFsc2UsXG4gIGluY2x1ZGVNZXRhZGF0YTogZmFsc2UsXG4gIHByZWZlckJ1bGxldHM6IHRydWUsXG4gIHByZWZlclRhYmxlczogZmFsc2UsXG4gIGxhbmd1YWdlSGludDogJ2VuJyxcbiAgbWF4U3VtbWFyeUxlbmd0aDogMTAwLFxuICBtYXhEZXRhaWxzTGVuZ3RoOiAyMDAsXG4gIGNvZGVCbG9ja1N0eWxlOiAnaW5saW5lJyxcbiAgbGlzdFN0eWxlOiAnYnVsbGV0JyxcbiAgdG9uZTogJ2Nhc3VhbCcsXG4gIHN1aXRhYmxlRm9yOiBbJ3RlbGVncmFtJywgJ3NtcycsICdsb3ctYmFuZHdpZHRoJywgJ21vYmlsZSddLFxuICBpc0J1aWx0aW46IHRydWUsXG4gIGVuYWJsZWQ6IHRydWUsXG59O1xuXG4vKipcbiAqIEF1ZGl0IOmjjuagvCAtIOWuoeiuoS/lkIjop4RcbiAqIFxuICog6YCC55So5Zy65pmv77yaY29tcGxpYW5jZSAvIHNlY3VyaXR5IC8gb3BzIC8g5a6h6K6h6L+96LiqXG4gKi9cbmV4cG9ydCBjb25zdCBBVURJVF9TVFlMRTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yID0ge1xuICBpZDogJ2F1ZGl0JyxcbiAgbmFtZTogJ0F1ZGl0JyxcbiAgZGVzY3JpcHRpb246ICflrozmlbTjgIHlj6/ov73muq/jgIHluKbml7bpl7TmiLPlkozlhYPmlbDmja4nLFxuICBhdWRpZW5jZTogJ2NvbXBsaWFuY2UnLFxuICB2ZXJib3NpdHk6ICd2ZXJib3NlJyxcbiAgc2VjdGlvbk9yZGVyOiBbJ3N1bW1hcnknLCAnc3RhdHVzJywgJ3RpbWVsaW5lJywgJ2V2aWRlbmNlJywgJ21ldHJpY3MnLCAnYWN0aW9ucycsICdtZXRhZGF0YSddLFxuICBpbmNsdWRlVGltZXN0YW1wczogdHJ1ZSxcbiAgaW5jbHVkZU1ldGFkYXRhOiB0cnVlLFxuICBwcmVmZXJCdWxsZXRzOiBmYWxzZSxcbiAgcHJlZmVyVGFibGVzOiB0cnVlLFxuICBsYW5ndWFnZUhpbnQ6ICdlbicsXG4gIG1heFN1bW1hcnlMZW5ndGg6IDUwMCxcbiAgbWF4RGV0YWlsc0xlbmd0aDogNTAwMCxcbiAgY29kZUJsb2NrU3R5bGU6ICdmZW5jZWQnLFxuICBsaXN0U3R5bGU6ICd0YWJsZScsXG4gIHRvbmU6ICdmb3JtYWwnLFxuICBzdWl0YWJsZUZvcjogWydjb21wbGlhbmNlJywgJ3NlY3VyaXR5JywgJ29wcycsICdhdWRpdCcsICdsZWdhbCddLFxuICBpc0J1aWx0aW46IHRydWUsXG4gIGVuYWJsZWQ6IHRydWUsXG59O1xuXG4vKipcbiAqIENvZGluZyDpo47moLwgLSDlvIDlj5HlnLrmma9cbiAqIFxuICog6YCC55So5Zy65pmv77yaZGV2ZWxvcG1lbnQgLyBjb2RlLXJldmlldyAvIGRpZmZcbiAqL1xuZXhwb3J0IGNvbnN0IENPRElOR19TVFlMRTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yID0ge1xuICBpZDogJ2NvZGluZycsXG4gIG5hbWU6ICdDb2RpbmcnLFxuICBkZXNjcmlwdGlvbjogJ+S7o+eggeS8mOWFiOOAgWRpZmYg5Y+L5aW944CB5oqA5pyv57uG6IqC5a6M5pW0JyxcbiAgYXVkaWVuY2U6ICdkZXZlbG9wbWVudCcsXG4gIHZlcmJvc2l0eTogJ2RldGFpbGVkJyxcbiAgc2VjdGlvbk9yZGVyOiBbJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2FydGlmYWN0cycsICdhY3Rpb25zJywgJ3dhcm5pbmdzJywgJ2V2aWRlbmNlJ10sXG4gIGluY2x1ZGVUaW1lc3RhbXBzOiBmYWxzZSxcbiAgaW5jbHVkZU1ldGFkYXRhOiBmYWxzZSxcbiAgcHJlZmVyQnVsbGV0czogdHJ1ZSxcbiAgcHJlZmVyVGFibGVzOiBmYWxzZSxcbiAgbGFuZ3VhZ2VIaW50OiAnZW4nLFxuICBtYXhTdW1tYXJ5TGVuZ3RoOiAyMDAsXG4gIG1heERldGFpbHNMZW5ndGg6IDIwMDAsXG4gIGNvZGVCbG9ja1N0eWxlOiAnZGlmZicsXG4gIGxpc3RTdHlsZTogJ2J1bGxldCcsXG4gIHRvbmU6ICd0ZWNobmljYWwnLFxuICBzdWl0YWJsZUZvcjogWydkZXZlbG9wbWVudCcsICdjb2RlLXJldmlldycsICdkZWJ1Z2dpbmcnLCAnZW5naW5lZXJpbmcnXSxcbiAgaXNCdWlsdGluOiB0cnVlLFxuICBlbmFibGVkOiB0cnVlLFxufTtcblxuLyoqXG4gKiBPcHMg6aOO5qC8IC0g6L+Q57u05Zy65pmvXG4gKiBcbiAqIOmAgueUqOWcuuaZr++8mm9wZXJhdGlvbnMgLyBtb25pdG9yaW5nIC8gaW5jaWRlbnRcbiAqL1xuZXhwb3J0IGNvbnN0IE9QU19TVFlMRTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yID0ge1xuICBpZDogJ29wcycsXG4gIG5hbWU6ICdPcHMnLFxuICBkZXNjcmlwdGlvbjogJ+aMh+agh+S8mOWFiOOAgeWRiuitpueqgeWHuuOAgeWKqOS9nOW7uuiurue0p+maj+WFtuWQjicsXG4gIGF1ZGllbmNlOiAnb3BlcmF0aW9ucycsXG4gIHZlcmJvc2l0eTogJ2NvbmNpc2UnLFxuICBzZWN0aW9uT3JkZXI6IFsnc3RhdHVzJywgJ21ldHJpY3MnLCAnd2FybmluZ3MnLCAnYWN0aW9ucycsICdzdW1tYXJ5J10sXG4gIGluY2x1ZGVUaW1lc3RhbXBzOiB0cnVlLFxuICBpbmNsdWRlTWV0YWRhdGE6IGZhbHNlLFxuICBwcmVmZXJCdWxsZXRzOiBmYWxzZSxcbiAgcHJlZmVyVGFibGVzOiB0cnVlLFxuICBsYW5ndWFnZUhpbnQ6ICdlbicsXG4gIG1heFN1bW1hcnlMZW5ndGg6IDMwMCxcbiAgbWF4RGV0YWlsc0xlbmd0aDogMTUwMCxcbiAgY29kZUJsb2NrU3R5bGU6ICdmZW5jZWQnLFxuICBsaXN0U3R5bGU6ICd0YWJsZScsXG4gIHRvbmU6ICd0ZWNobmljYWwnLFxuICBzdWl0YWJsZUZvcjogWydvcGVyYXRpb25zJywgJ21vbml0b3JpbmcnLCAnaW5jaWRlbnQnLCAnc3JlJywgJ29uY2FsbCddLFxuICBpc0J1aWx0aW46IHRydWUsXG4gIGVuYWJsZWQ6IHRydWUsXG59O1xuXG4vKipcbiAqIE1hbmFnZW1lbnQg6aOO5qC8IC0g566h55CG5bGC5rGH5oqlXG4gKiBcbiAqIOmAgueUqOWcuuaZr++8mm1hbmFnZW1lbnQgLyByZXBvcnRpbmcgLyBzdGFrZWhvbGRlclxuICovXG5leHBvcnQgY29uc3QgTUFOQUdFTUVOVF9TVFlMRTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yID0ge1xuICBpZDogJ21hbmFnZW1lbnQnLFxuICBuYW1lOiAnTWFuYWdlbWVudCcsXG4gIGRlc2NyaXB0aW9uOiAn5pGY6KaB5LyY5YWI44CB6aOO6ZmpL+i/m+WxlS/lu7rorq7kuInmrrXlvI/jgIHljovnvKnmioDmnK/nu4boioInLFxuICBhdWRpZW5jZTogJ21hbmFnZW1lbnQnLFxuICB2ZXJib3NpdHk6ICdjb25jaXNlJyxcbiAgc2VjdGlvbk9yZGVyOiBbJ3N1bW1hcnknLCAnc3RhdHVzJywgJ21ldHJpY3MnLCAncmVjb21tZW5kYXRpb25zJywgJ3dhcm5pbmdzJ10sXG4gIGluY2x1ZGVUaW1lc3RhbXBzOiBmYWxzZSxcbiAgaW5jbHVkZU1ldGFkYXRhOiBmYWxzZSxcbiAgcHJlZmVyQnVsbGV0czogdHJ1ZSxcbiAgcHJlZmVyVGFibGVzOiBmYWxzZSxcbiAgbGFuZ3VhZ2VIaW50OiAnZW4nLFxuICBtYXhTdW1tYXJ5TGVuZ3RoOiAyMDAsXG4gIG1heERldGFpbHNMZW5ndGg6IDgwMCxcbiAgY29kZUJsb2NrU3R5bGU6ICdpbmxpbmUnLFxuICBsaXN0U3R5bGU6ICdidWxsZXQnLFxuICB0b25lOiAnZm9ybWFsJyxcbiAgc3VpdGFibGVGb3I6IFsnbWFuYWdlbWVudCcsICdyZXBvcnRpbmcnLCAnc3Rha2Vob2xkZXInLCAnZXhlY3V0aXZlJ10sXG4gIGlzQnVpbHRpbjogdHJ1ZSxcbiAgZW5hYmxlZDogdHJ1ZSxcbn07XG5cbi8qKlxuICogWmggUE0g6aOO5qC8IC0g5Lit5paH5Lqn5ZOB57uP55CGXG4gKiBcbiAqIOmAgueUqOWcuuaZr++8mnByb2R1Y3QgLyBjaGluZXNlLXNwZWFraW5nIC8gc3RydWN0dXJlZFxuICovXG5leHBvcnQgY29uc3QgWkhfUE1fU1RZTEU6IE91dHB1dFN0eWxlRGVzY3JpcHRvciA9IHtcbiAgaWQ6ICd6aF9wbScsXG4gIG5hbWU6ICfkuK3mlofkuqflk4EnLFxuICBkZXNjcmlwdGlvbjogJ+S4reaWh+ihqOi+vuOAgeW8uue7k+aehOOAgee7k+iuui/lvbHlk40v5LiL5LiA5q2l5riF5pmwJyxcbiAgYXVkaWVuY2U6ICdwcm9kdWN0JyxcbiAgdmVyYm9zaXR5OiAnbm9ybWFsJyxcbiAgc2VjdGlvbk9yZGVyOiBbJ3N1bW1hcnknLCAnc3RhdHVzJywgJ3JlY29tbWVuZGF0aW9ucycsICdhY3Rpb25zJywgJ3dhcm5pbmdzJywgJ2V2aWRlbmNlJ10sXG4gIGluY2x1ZGVUaW1lc3RhbXBzOiBmYWxzZSxcbiAgaW5jbHVkZU1ldGFkYXRhOiB0cnVlLFxuICBwcmVmZXJCdWxsZXRzOiBmYWxzZSxcbiAgcHJlZmVyVGFibGVzOiBmYWxzZSxcbiAgbGFuZ3VhZ2VIaW50OiAnemgnLFxuICBtYXhTdW1tYXJ5TGVuZ3RoOiAzMDAsXG4gIG1heERldGFpbHNMZW5ndGg6IDE1MDAsXG4gIGNvZGVCbG9ja1N0eWxlOiAnZmVuY2VkJyxcbiAgbGlzdFN0eWxlOiAnbnVtYmVyZWQnLFxuICB0b25lOiAnY2FzdWFsJyxcbiAgc3VpdGFibGVGb3I6IFsncHJvZHVjdCcsICdjaGluZXNlLXNwZWFraW5nJywgJ3N0cnVjdHVyZWQnLCAncGxhbm5pbmcnXSxcbiAgaXNCdWlsdGluOiB0cnVlLFxuICBlbmFibGVkOiB0cnVlLFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5YaF572u6aOO5qC85YiX6KGoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5omA5pyJ5YaF572u6aOO5qC8XG4gKi9cbmV4cG9ydCBjb25zdCBCVUlMVElOX1NUWUxFUzogT3V0cHV0U3R5bGVEZXNjcmlwdG9yW10gPSBbXG4gIE1JTklNQUxfU1RZTEUsXG4gIEFVRElUX1NUWUxFLFxuICBDT0RJTkdfU1RZTEUsXG4gIE9QU19TVFlMRSxcbiAgTUFOQUdFTUVOVF9TVFlMRSxcbiAgWkhfUE1fU1RZTEUsXG5dO1xuXG4vKipcbiAqIOWGhee9rumjjuagvOaYoOWwhFxuICovXG5leHBvcnQgY29uc3QgQlVJTFRJTl9TVFlMRV9NQVA6IFJlY29yZDxPdXRwdXRTdHlsZUlkLCBPdXRwdXRTdHlsZURlc2NyaXB0b3I+ID0ge1xuICBtaW5pbWFsOiBNSU5JTUFMX1NUWUxFLFxuICBhdWRpdDogQVVESVRfU1RZTEUsXG4gIGNvZGluZzogQ09ESU5HX1NUWUxFLFxuICBvcHM6IE9QU19TVFlMRSxcbiAgbWFuYWdlbWVudDogTUFOQUdFTUVOVF9TVFlMRSxcbiAgemhfcG06IFpIX1BNX1NUWUxFLFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6aOO5qC85a6a5LmJ5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5a6a5LmJ6aOO5qC8XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZpbmVTdHlsZShkZXNjcmlwdG9yOiBQYXJ0aWFsPE91dHB1dFN0eWxlRGVzY3JpcHRvcj4pOiBPdXRwdXRTdHlsZURlc2NyaXB0b3Ige1xuICBpZiAoIWRlc2NyaXB0b3IuaWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0eWxlIElEIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgLi4uZGVzY3JpcHRvcixcbiAgICBpc0J1aWx0aW46IGZhbHNlLFxuICAgIGVuYWJsZWQ6IGRlc2NyaXB0b3IuZW5hYmxlZCA/PyB0cnVlLFxuICB9IGFzIE91dHB1dFN0eWxlRGVzY3JpcHRvcjtcbn1cblxuLyoqXG4gKiDop4TojIPljJbpo47moLxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVN0eWxlKGRlc2NyaXB0b3I6IFBhcnRpYWw8T3V0cHV0U3R5bGVEZXNjcmlwdG9yPik6IE91dHB1dFN0eWxlRGVzY3JpcHRvciB7XG4gIC8vIOafpeaJvuaYr+WQpuacieWQjCBJRCDnmoTlhoXnva7po47moLzkvZzkuLrln7rlh4ZcbiAgY29uc3QgYnVpbHRpbiA9IEJVSUxUSU5fU1RZTEVfTUFQW2Rlc2NyaXB0b3IuaWQgYXMgT3V0cHV0U3R5bGVJZF07XG4gIFxuICBpZiAoYnVpbHRpbikge1xuICAgIC8vIOWfuuS6juWGhee9rumjjuagvOaJqeWxlVxuICAgIHJldHVybiB7XG4gICAgICAuLi5idWlsdGluLFxuICAgICAgLi4uZGVzY3JpcHRvcixcbiAgICB9O1xuICB9XG4gIFxuICAvLyDmlrDpo47moLzvvIzlupTnlKjpu5jorqTlgLxcbiAgcmV0dXJuIHtcbiAgICBpZDogZGVzY3JpcHRvci5pZCB8fCAnY3VzdG9tJyxcbiAgICBuYW1lOiBkZXNjcmlwdG9yLm5hbWUgfHwgJ0N1c3RvbSBTdHlsZScsXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0b3IuZGVzY3JpcHRpb24gfHwgJ0N1c3RvbSBvdXRwdXQgc3R5bGUnLFxuICAgIGF1ZGllbmNlOiBkZXNjcmlwdG9yLmF1ZGllbmNlIHx8ICdyZW1vdGUnLFxuICAgIHZlcmJvc2l0eTogZGVzY3JpcHRvci52ZXJib3NpdHkgfHwgJ25vcm1hbCcsXG4gICAgc2VjdGlvbk9yZGVyOiBkZXNjcmlwdG9yLnNlY3Rpb25PcmRlciB8fCBbJ3N1bW1hcnknLCAnYWN0aW9ucyddLFxuICAgIGluY2x1ZGVUaW1lc3RhbXBzOiBkZXNjcmlwdG9yLmluY2x1ZGVUaW1lc3RhbXBzID8/IGZhbHNlLFxuICAgIGluY2x1ZGVNZXRhZGF0YTogZGVzY3JpcHRvci5pbmNsdWRlTWV0YWRhdGEgPz8gZmFsc2UsXG4gICAgcHJlZmVyQnVsbGV0czogZGVzY3JpcHRvci5wcmVmZXJCdWxsZXRzID8/IHRydWUsXG4gICAgcHJlZmVyVGFibGVzOiBkZXNjcmlwdG9yLnByZWZlclRhYmxlcyA/PyBmYWxzZSxcbiAgICBsYW5ndWFnZUhpbnQ6IGRlc2NyaXB0b3IubGFuZ3VhZ2VIaW50IHx8ICdlbicsXG4gICAgbWF4U3VtbWFyeUxlbmd0aDogZGVzY3JpcHRvci5tYXhTdW1tYXJ5TGVuZ3RoIHx8IDMwMCxcbiAgICBtYXhEZXRhaWxzTGVuZ3RoOiBkZXNjcmlwdG9yLm1heERldGFpbHNMZW5ndGggfHwgMTUwMCxcbiAgICBjb2RlQmxvY2tTdHlsZTogZGVzY3JpcHRvci5jb2RlQmxvY2tTdHlsZSB8fCAnZmVuY2VkJyxcbiAgICBsaXN0U3R5bGU6IGRlc2NyaXB0b3IubGlzdFN0eWxlIHx8ICdidWxsZXQnLFxuICAgIHRvbmU6IGRlc2NyaXB0b3IudG9uZSB8fCAnY2FzdWFsJyxcbiAgICBzdWl0YWJsZUZvcjogZGVzY3JpcHRvci5zdWl0YWJsZUZvciB8fCBbXSxcbiAgICBpc0J1aWx0aW46IGZhbHNlLFxuICAgIGVuYWJsZWQ6IGRlc2NyaXB0b3IuZW5hYmxlZCA/PyB0cnVlLFxuICB9O1xufVxuXG4vKipcbiAqIOagoemqjOmjjuagvFxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVTdHlsZShkZXNjcmlwdG9yOiBQYXJ0aWFsPE91dHB1dFN0eWxlRGVzY3JpcHRvcj4pOiB7XG4gIHZhbGlkOiBib29sZWFuO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgXG4gIC8vIOW/hemcgOWtl+auteajgOafpVxuICBpZiAoIWRlc2NyaXB0b3IuaWQpIHtcbiAgICBlcnJvcnMucHVzaCgnU3R5bGUgSUQgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBcbiAgaWYgKCFkZXNjcmlwdG9yLm5hbWUpIHtcbiAgICBlcnJvcnMucHVzaCgnU3R5bGUgbmFtZSBpcyByZXF1aXJlZCcpO1xuICB9XG4gIFxuICAvLyDlrZfmrrXnsbvlnovmo4Dmn6VcbiAgaWYgKGRlc2NyaXB0b3IudmVyYm9zaXR5ICYmICFbJ21pbmltYWwnLCAnY29uY2lzZScsICdub3JtYWwnLCAnZGV0YWlsZWQnLCAndmVyYm9zZSddLmluY2x1ZGVzKGRlc2NyaXB0b3IudmVyYm9zaXR5KSkge1xuICAgIGVycm9ycy5wdXNoKGBJbnZhbGlkIHZlcmJvc2l0eTogJHtkZXNjcmlwdG9yLnZlcmJvc2l0eX1gKTtcbiAgfVxuICBcbiAgaWYgKGRlc2NyaXB0b3IudG9uZSAmJiAhWydmb3JtYWwnLCAnY2FzdWFsJywgJ3RlY2huaWNhbCddLmluY2x1ZGVzKGRlc2NyaXB0b3IudG9uZSkpIHtcbiAgICBlcnJvcnMucHVzaChgSW52YWxpZCB0b25lOiAke2Rlc2NyaXB0b3IudG9uZX1gKTtcbiAgfVxuICBcbiAgaWYgKGRlc2NyaXB0b3IuY29kZUJsb2NrU3R5bGUgJiYgIVsnaW5saW5lJywgJ2ZlbmNlZCcsICdkaWZmJ10uaW5jbHVkZXMoZGVzY3JpcHRvci5jb2RlQmxvY2tTdHlsZSkpIHtcbiAgICBlcnJvcnMucHVzaChgSW52YWxpZCBjb2RlQmxvY2tTdHlsZTogJHtkZXNjcmlwdG9yLmNvZGVCbG9ja1N0eWxlfWApO1xuICB9XG4gIFxuICBpZiAoZGVzY3JpcHRvci5saXN0U3R5bGUgJiYgIVsnYnVsbGV0JywgJ251bWJlcmVkJywgJ3RhYmxlJ10uaW5jbHVkZXMoZGVzY3JpcHRvci5saXN0U3R5bGUpKSB7XG4gICAgZXJyb3JzLnB1c2goYEludmFsaWQgbGlzdFN0eWxlOiAke2Rlc2NyaXB0b3IubGlzdFN0eWxlfWApO1xuICB9XG4gIFxuICAvLyDpgLvovpHmo4Dmn6VcbiAgaWYgKGRlc2NyaXB0b3IubWF4U3VtbWFyeUxlbmd0aCAmJiBkZXNjcmlwdG9yLm1heERldGFpbHNMZW5ndGgpIHtcbiAgICBpZiAoZGVzY3JpcHRvci5tYXhTdW1tYXJ5TGVuZ3RoID4gZGVzY3JpcHRvci5tYXhEZXRhaWxzTGVuZ3RoKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCdtYXhTdW1tYXJ5TGVuZ3RoIHNob3VsZCBub3QgZXhjZWVkIG1heERldGFpbHNMZW5ndGgnKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIHNlY3Rpb25PcmRlciDmo4Dmn6VcbiAgY29uc3QgdmFsaWRTZWN0aW9uczogQ29udGVudFNlY3Rpb25UeXBlW10gPSBbXG4gICAgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2FjdGlvbnMnLCAnd2FybmluZ3MnLCAnZXZpZGVuY2UnLFxuICAgICdtZXRyaWNzJywgJ3RpbWVsaW5lJywgJ2FydGlmYWN0cycsICdyZWNvbW1lbmRhdGlvbnMnLCAnbWV0YWRhdGEnXG4gIF07XG4gIFxuICBpZiAoZGVzY3JpcHRvci5zZWN0aW9uT3JkZXIpIHtcbiAgICBmb3IgKGNvbnN0IHNlY3Rpb24gb2YgZGVzY3JpcHRvci5zZWN0aW9uT3JkZXIpIHtcbiAgICAgIGlmICghdmFsaWRTZWN0aW9ucy5pbmNsdWRlcyhzZWN0aW9uKSkge1xuICAgICAgICBlcnJvcnMucHVzaChgSW52YWxpZCBzZWN0aW9uIHR5cGU6ICR7c2VjdGlvbn1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzLFxuICB9O1xufVxuXG4vKipcbiAqIOiOt+WPluWGhee9rumjjuagvFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnVpbHRpblN0eWxlcygpOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JbXSB7XG4gIHJldHVybiBbLi4uQlVJTFRJTl9TVFlMRVNdO1xufVxuXG4vKipcbiAqIOiOt+WPluWGhee9rumjjuagvOaYoOWwhFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnVpbHRpblN0eWxlTWFwKCk6IFJlY29yZDxPdXRwdXRTdHlsZUlkLCBPdXRwdXRTdHlsZURlc2NyaXB0b3I+IHtcbiAgcmV0dXJuIHsgLi4uQlVJTFRJTl9TVFlMRV9NQVAgfTtcbn1cblxuLyoqXG4gKiDmoLnmja7lj5fkvJfmjqjojZDpo47moLxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY29tbWVuZFN0eWxlRm9yQXVkaWVuY2UoYXVkaWVuY2U6IE91dHB1dEF1ZGllbmNlKTogT3V0cHV0U3R5bGVJZCB7XG4gIGNvbnN0IHJlY29tbWVuZGF0aW9uczogUmVjb3JkPE91dHB1dEF1ZGllbmNlLCBPdXRwdXRTdHlsZUlkPiA9IHtcbiAgICByZW1vdGU6ICdtaW5pbWFsJyxcbiAgICBjb21wbGlhbmNlOiAnYXVkaXQnLFxuICAgIGRldmVsb3BtZW50OiAnY29kaW5nJyxcbiAgICBvcGVyYXRpb25zOiAnb3BzJyxcbiAgICBtYW5hZ2VtZW50OiAnbWFuYWdlbWVudCcsXG4gICAgcHJvZHVjdDogJ3poX3BtJyxcbiAgfTtcbiAgXG4gIHJldHVybiByZWNvbW1lbmRhdGlvbnNbYXVkaWVuY2VdIHx8ICdtaW5pbWFsJztcbn1cblxuLyoqXG4gKiDmoLnmja7lnLrmma/mjqjojZDpo47moLxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY29tbWVuZFN0eWxlRm9yU2NlbmFyaW8oc2NlbmFyaW86IHN0cmluZyk6IE91dHB1dFN0eWxlSWQge1xuICBjb25zdCBzY2VuYXJpb01hcDogUmVjb3JkPHN0cmluZywgT3V0cHV0U3R5bGVJZD4gPSB7XG4gICAgdGVsZWdyYW06ICdtaW5pbWFsJyxcbiAgICBzbXM6ICdtaW5pbWFsJyxcbiAgICBtb2JpbGU6ICdtaW5pbWFsJyxcbiAgICBjb21wbGlhbmNlOiAnYXVkaXQnLFxuICAgIHNlY3VyaXR5OiAnYXVkaXQnLFxuICAgIGF1ZGl0OiAnYXVkaXQnLFxuICAgIGRldmVsb3BtZW50OiAnY29kaW5nJyxcbiAgICBjb2RlUmV2aWV3OiAnY29kaW5nJyxcbiAgICBkZWJ1Z2dpbmc6ICdjb2RpbmcnLFxuICAgIG9wZXJhdGlvbnM6ICdvcHMnLFxuICAgIG1vbml0b3Jpbmc6ICdvcHMnLFxuICAgIGluY2lkZW50OiAnb3BzJyxcbiAgICBtYW5hZ2VtZW50OiAnbWFuYWdlbWVudCcsXG4gICAgcmVwb3J0aW5nOiAnbWFuYWdlbWVudCcsXG4gICAgcHJvZHVjdDogJ3poX3BtJyxcbiAgICBwbGFubmluZzogJ3poX3BtJyxcbiAgfTtcbiAgXG4gIGNvbnN0IG5vcm1hbGl6ZWRTY2VuYXJpbyA9IHNjZW5hcmlvLnRvTG93ZXJDYXNlKCk7XG4gIFxuICBmb3IgKGNvbnN0IFtrZXksIHN0eWxlSWRdIG9mIE9iamVjdC5lbnRyaWVzKHNjZW5hcmlvTWFwKSkge1xuICAgIGlmIChub3JtYWxpemVkU2NlbmFyaW8uaW5jbHVkZXMoa2V5KSkge1xuICAgICAgcmV0dXJuIHN0eWxlSWQ7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gJ21pbmltYWwnO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDlv6vpgJ/liJvlu7rpo47moLxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlKFxuICBpZDogT3V0cHV0U3R5bGVJZCxcbiAgbmFtZTogc3RyaW5nLFxuICBvdmVycmlkZXM/OiBQYXJ0aWFsPE91dHB1dFN0eWxlRGVzY3JpcHRvcj5cbik6IE91dHB1dFN0eWxlRGVzY3JpcHRvciB7XG4gIHJldHVybiBub3JtYWxpemVTdHlsZSh7XG4gICAgaWQsXG4gICAgbmFtZSxcbiAgICAuLi5vdmVycmlkZXMsXG4gIH0pO1xufVxuXG4vKipcbiAqIOW/q+mAn+agoemqjOW5tuWIm+W7uumjjuagvFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmFsaWRhdGVkU3R5bGUoXG4gIGRlc2NyaXB0b3I6IFBhcnRpYWw8T3V0cHV0U3R5bGVEZXNjcmlwdG9yPlxuKToge1xuICBzdHlsZT86IE91dHB1dFN0eWxlRGVzY3JpcHRvcjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xufSB7XG4gIGNvbnN0IHZhbGlkYXRpb24gPSB2YWxpZGF0ZVN0eWxlKGRlc2NyaXB0b3IpO1xuICBcbiAgaWYgKCF2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yczogdmFsaWRhdGlvbi5lcnJvcnMsXG4gICAgICB3YXJuaW5nczogdmFsaWRhdGlvbi53YXJuaW5ncyxcbiAgICB9O1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIHN0eWxlOiBub3JtYWxpemVTdHlsZShkZXNjcmlwdG9yKSxcbiAgICBlcnJvcnM6IFtdLFxuICAgIHdhcm5pbmdzOiB2YWxpZGF0aW9uLndhcm5pbmdzLFxuICB9O1xufVxuIl19