/**
 * UX Types - UX 输出层核心类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 6A: Output Styles / Response Modes
 */
/**
 * 输出风格 ID
 */
export type OutputStyleId = 'minimal' | 'audit' | 'coding' | 'ops' | 'management' | 'zh_pm' | string;
/**
 * 输出受众
 */
export type OutputAudience = 'remote' | 'compliance' | 'development' | 'operations' | 'management' | 'product';
/**
 * 详细程度
 */
export type VerbosityLevel = 'minimal' | 'concise' | 'normal' | 'detailed' | 'verbose';
/**
 * 语言提示
 */
export type LanguageHint = 'en' | 'zh' | 'auto';
/**
 * 内容分段
 */
export interface ContentSection {
    /** 分段类型 */
    type: ContentSectionType;
    /** 分段标题 */
    title?: string;
    /** 分段内容 */
    content: string | string[] | Record<string, any>;
    /** 重要性 */
    importance?: 'low' | 'medium' | 'high' | 'critical';
    /** 是否可折叠 */
    collapsible?: boolean;
    /** 默认展开 */
    defaultExpanded?: boolean;
}
/**
 * 内容分段类型
 */
export type ContentSectionType = 'summary' | 'status' | 'actions' | 'warnings' | 'evidence' | 'metrics' | 'timeline' | 'artifacts' | 'recommendations' | 'metadata';
/**
 * 格式化块
 */
export interface FormattedBlock {
    /** 块类型 */
    type: 'text' | 'list' | 'table' | 'code' | 'quote' | 'divider';
    /** 块内容 */
    content: string;
    /** 块样式类（可选） */
    styleClass?: string;
    /** 元数据（可选） */
    metadata?: Record<string, any>;
}
/**
 * 输出风格描述符
 */
export interface OutputStyleDescriptor {
    /** 风格 ID */
    id: OutputStyleId;
    /** 风格名称 */
    name: string;
    /** 风格描述 */
    description: string;
    /** 目标受众 */
    audience: OutputAudience;
    /** 详细程度 */
    verbosity: VerbosityLevel;
    /** 分段顺序（控制显示顺序） */
    sectionOrder: ContentSectionType[];
    /** 包含时间戳 */
    includeTimestamps: boolean;
    /** 包含元数据 */
    includeMetadata: boolean;
    /** 偏好列表（而非表格） */
    preferBullets: boolean;
    /** 偏好表格（而非列表） */
    preferTables: boolean;
    /** 语言提示 */
    languageHint?: LanguageHint;
    /** 最大摘要长度 */
    maxSummaryLength?: number;
    /** 最大详情长度 */
    maxDetailsLength?: number;
    /** 代码块风格 */
    codeBlockStyle?: 'inline' | 'fenced' | 'diff';
    /** 列表风格 */
    listStyle?: 'bullet' | 'numbered' | 'table';
    /** 语气 */
    tone?: 'formal' | 'casual' | 'technical';
    /** 适用场景 */
    suitableFor?: string[];
    /** 是否内置 */
    isBuiltin?: boolean;
    /** 是否启用 */
    enabled?: boolean;
}
/**
 * 结构化响应内容
 */
export interface StructuredResponseContent {
    /** 摘要 */
    summary?: string;
    /** 状态 */
    status?: string;
    /** 行动项 */
    actions?: Array<{
        action: string;
        priority?: 'high' | 'medium' | 'low';
        target?: string;
    }>;
    /** 警告 */
    warnings?: Array<{
        warning: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
    }>;
    /** 证据/依据 */
    evidence?: Array<{
        type: string;
        description: string;
        reference?: string;
    }>;
    /** 指标 */
    metrics?: Record<string, number | string>;
    /** 时间线 */
    timeline?: Array<{
        timestamp: number;
        event: string;
        status?: string;
    }>;
    /** 产物/附件 */
    artifacts?: Array<{
        type: string;
        name: string;
        reference?: string;
    }>;
    /** 建议 */
    recommendations?: string[];
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 风格渲染选项
 */
export interface StyleRenderOptions {
    /** 覆盖风格设置 */
    styleOverrides?: Partial<OutputStyleDescriptor>;
    /** 强制包含的分段 */
    forceIncludeSections?: ContentSectionType[];
    /** 强制排除的分段 */
    forceExcludeSections?: ContentSectionType[];
    /** 最大宽度（字符数） */
    maxWidth?: number;
    /** 颜色支持 */
    colorSupport?: 'none' | 'ansi' | 'truecolor';
    /** 超链接支持 */
    hyperlinkSupport?: boolean;
}
/**
 * 响应格式化请求
 */
export interface ResponseFormatRequest {
    /** 结构化内容 */
    content: StructuredResponseContent;
    /** 风格 ID */
    styleId: OutputStyleId;
    /** 渲染选项 */
    options?: StyleRenderOptions;
}
/**
 * 格式化结果
 */
export interface ResponseFormatResult {
    /** 格式化文本 */
    text: string;
    /** 格式化分段 */
    sections: FormattedBlock[];
    /** 使用的风格 ID */
    styleId: OutputStyleId;
    /** 元数据 */
    metadata: {
        /** 渲染时间 */
        renderedAt: number;
        /** 内容哈希 */
        contentHash?: string;
        /** 风格版本 */
        styleVersion?: string;
    };
}
/**
 * 风格注册结果
 */
export interface StyleRegistrationResult {
    /** 是否成功 */
    success: boolean;
    /** 风格 ID */
    styleId: OutputStyleId;
    /** 错误信息（如果失败） */
    error?: string;
    /** 警告信息 */
    warnings?: string[];
}
/**
 * 风格注册表快照
 */
export interface StyleRegistrySnapshot {
    /** 快照 ID */
    snapshotId: string;
    /** 创建时间 */
    createdAt: number;
    /** 总风格数 */
    totalStyles: number;
    /** 启用风格数 */
    enabledStyles: number;
    /** 默认风格 ID */
    defaultStyleId: OutputStyleId;
    /** 风格列表 */
    styles: OutputStyleDescriptor[];
}
