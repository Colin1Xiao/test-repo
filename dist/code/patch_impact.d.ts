/**
 * Patch Impact - 补丁影响分析
 *
 * 职责：
 * 1. 分析变更文件的影响
 * 2. 识别影响的符号
 * 3. 识别影响的入口点
 * 4. 评估风险等级
 * 5. 生成影响证据
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ImpactReport } from './types';
import type { TestInventory } from './types';
import type { SymbolIndex } from './types';
/**
 * 影响分析配置
 */
export interface PatchImpactConfig {
    /** 包含符号分析 */
    includeSymbols?: boolean;
    /** 包含测试映射 */
    includeTests?: boolean;
    /** 高风险目录模式 */
    highRiskPatterns?: string[];
    /** 中风险目录模式 */
    mediumRiskPatterns?: string[];
}
export declare class PatchImpactAnalyzer {
    private config;
    private symbolIndex?;
    private testInventory?;
    private testMapper;
    constructor(config?: PatchImpactConfig);
    /**
     * 设置符号索引
     */
    setSymbolIndex(index: SymbolIndex): void;
    /**
     * 设置测试清单
     */
    setTestInventory(inventory: TestInventory): void;
    /**
     * 分析影响
     */
    analyze(changedFiles: string[]): Promise<ImpactReport>;
    /**
     * 查找影响的符号
     */
    private findImpactedSymbols;
    /**
     * 查找影响的入口点
     */
    private findAffectedEntrypoints;
    /**
     * 查找相关测试
     */
    private findRelatedTests;
    /**
     * 评估风险
     */
    private assessRisk;
    /**
     * 获取风险原因
     */
    private getRiskReasons;
}
/**
 * 创建补丁影响分析器
 */
export declare function createPatchImpactAnalyzer(config?: PatchImpactConfig): PatchImpactAnalyzer;
/**
 * 快速分析影响
 */
export declare function analyzePatchImpact(changedFiles: string[], symbolIndex?: SymbolIndex, testInventory?: TestInventory): Promise<ImpactReport>;
