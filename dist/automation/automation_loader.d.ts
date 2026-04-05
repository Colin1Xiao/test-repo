/**
 * Automation Loader - 自动化配置加载器
 *
 * 职责：
 * 1. 读取 hooks.yaml / automation.yaml
 * 2. 解析 YAML
 * 3. 调 schema 校验
 * 4. 转成 runtime rule 对象
 * 5. 支持默认规则 + workspace 规则合并
 * 6. 支持热加载
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AutomationRule, AutomationLoadResult, AutomationRuleSource, AutomationRuleSet, AutomationLoaderConfig, AutomationConfigError } from './types';
export declare class AutomationLoader {
    private config;
    private watchTimers;
    constructor(config?: AutomationLoaderConfig);
    /**
     * 加载自动化文件
     */
    loadAutomationFile(filePath: string, sourceType?: 'builtin' | 'workspace' | 'remote'): Promise<AutomationLoadResult>;
    /**
     * 加载工作区自动化
     */
    loadWorkspaceAutomation(workspaceRoot: string): Promise<AutomationLoadResult>;
    /**
     * 重新加载自动化
     */
    reloadAutomation(workspaceRoot: string): Promise<{
        success: boolean;
        rules: AutomationRule[];
        source: AutomationRuleSource;
        errors: AutomationConfigError[];
    }>;
    /**
     * 监视自动化文件变化
     */
    watchAutomationFiles(workspaceRoot: string, onChange: () => void): void;
    /**
     * 停止监视
     */
    stopWatching(): void;
    /**
     * 构建规则集
     */
    buildRuleSet(defaults: AutomationRule[], workspaceRules: AutomationRule[], overrideMode?: 'append' | 'override' | 'disable'): AutomationRuleSet;
}
/**
 * 创建自动化加载器
 */
export declare function createAutomationLoader(config?: AutomationLoaderConfig): AutomationLoader;
/**
 * 快速加载规则
 */
export declare function loadAutomationRules(filePath: string, sourceType?: 'builtin' | 'workspace' | 'remote'): Promise<AutomationRule[]>;
