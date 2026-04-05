/**
 * Automation Registry - 自动化规则注册表
 *
 * 职责：
 * 1. 管理当前已加载规则集
 * 2. 保存来源信息
 * 3. 支持按 source / workspace / enabled 查询
 * 4. 支持替换快照而非增量污染
 * 5. 为 5A rule engine 提供当前有效规则
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AutomationRule, AutomationRuleSet, AutomationRegistrySnapshot, AutomationRuleSource } from './types';
/**
 * 注册表配置
 */
export interface RegistryConfig {
    /** 是否允许空规则集 */
    allowEmptyRuleset?: boolean;
    /** 保留上一个快照用于回滚 */
    keepPreviousSnapshot?: boolean;
}
export declare class AutomationRegistry {
    private config;
    private currentRules;
    private sourceTracking;
    private previousSnapshot;
    private currentSnapshot;
    constructor(config?: RegistryConfig);
    /**
     * 设置活动规则
     */
    setActiveRules(ruleSet: AutomationRuleSet, sourceInfo: AutomationRuleSource, mergeMode?: 'replace' | 'merge'): void;
    /**
     * 获取活动规则
     */
    getActiveRules(): Array<AutomationRule & {
        source: string;
    }>;
    /**
     * 按来源获取规则
     */
    getRulesBySource(sourcePath: string): Array<AutomationRule & {
        source: string;
    }>;
    /**
     * 移除来源的规则
     */
    removeRulesBySource(sourcePath: string): boolean;
    /**
     * 启用规则
     */
    enableRule(ruleId: string): boolean;
    /**
     * 禁用规则
     */
    disableRule(ruleId: string): boolean;
    /**
     * 回滚到上一个快照
     */
    rollbackToPrevious(): boolean;
    /**
     * 构建注册表快照
     */
    buildSnapshot(): AutomationRegistrySnapshot;
    /**
     * 获取当前快照
     */
    getCurrentSnapshot(): AutomationRegistrySnapshot | null;
    /**
     * 获取上一个快照
     */
    getPreviousSnapshot(): AutomationRegistrySnapshot | null;
    /**
     * 获取注册表统计
     */
    getStats(): {
        totalRules: number;
        enabledRules: number;
        disabledRules: number;
        bySource: Record<string, number>;
    };
    /**
     * 清空注册表
     */
    clear(): void;
}
/**
 * 创建自动化注册表
 */
export declare function createAutomationRegistry(config?: RegistryConfig): AutomationRegistry;
