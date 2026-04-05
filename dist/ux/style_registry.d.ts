/**
 * Style Registry - 风格管理层
 *
 * 职责：
 * 1. 注册风格
 * 2. 查询风格
 * 3. 启用/禁用风格
 * 4. 获取默认风格
 * 5. 支持后续 workspace/custom styles
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { OutputStyleDescriptor, OutputStyleId, StyleRegistrationResult, StyleRegistrySnapshot } from './types';
/**
 * 风格注册表配置
 */
export interface StyleRegistryConfig {
    /** 默认风格 ID */
    defaultStyleId?: OutputStyleId;
    /** 是否允许覆盖内置风格 */
    allowBuiltinOverride?: boolean;
    /** 是否启用自动保存 */
    enableAutoSave?: boolean;
    /** 保存路径 */
    savePath?: string;
}
export declare class StyleRegistry {
    private config;
    private styles;
    private defaultStyleId;
    constructor(config?: StyleRegistryConfig);
    /**
     * 注册风格
     */
    registerStyle(descriptor: Partial<OutputStyleDescriptor>): StyleRegistrationResult;
    /**
     * 注销风格
     */
    unregisterStyle(styleId: OutputStyleId): boolean;
    /**
     * 获取风格
     */
    getStyle(styleId: OutputStyleId): OutputStyleDescriptor | null;
    /**
     * 列出风格
     */
    listStyles(options?: {
        enabledOnly?: boolean;
        builtinOnly?: boolean;
        customOnly?: boolean;
    }): OutputStyleDescriptor[];
    /**
     * 设置默认风格
     */
    setDefaultStyle(styleId: OutputStyleId): boolean;
    /**
     * 获取默认风格
     */
    getDefaultStyle(): OutputStyleDescriptor;
    /**
     * 获取默认风格 ID
     */
    getDefaultStyleId(): OutputStyleId;
    /**
     * 启用风格
     */
    enableStyle(styleId: OutputStyleId): boolean;
    /**
     * 禁用风格
     */
    disableStyle(styleId: OutputStyleId): boolean;
    /**
     * 构建注册表快照
     */
    buildSnapshot(): StyleRegistrySnapshot;
    /**
     * 清空自定义风格
     */
    clearCustomStyles(): void;
    /**
     * 注册内置风格
     */
    private registerBuiltinStyles;
    /**
     * 加载持久化风格
     */
    private loadPersistedStyles;
    /**
     * 保存持久化风格
     */
    private savePersistedStyles;
}
/**
 * 创建风格注册表
 */
export declare function createStyleRegistry(config?: StyleRegistryConfig): StyleRegistry;
/**
 * 快速注册风格
 */
export declare function registerStyle(registry: StyleRegistry, descriptor: Partial<OutputStyleDescriptor>): StyleRegistrationResult;
/**
 * 快速查询风格
 */
export declare function getStyle(registry: StyleRegistry, styleId: OutputStyleId): OutputStyleDescriptor | null;
