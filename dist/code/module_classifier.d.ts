/**
 * Module Classifier - 模块分类器
 *
 * 职责：
 * 1. 按路径/文件名分类目录
 * 2. 识别 app / lib / tests / infra / scripts / docs / config
 * 3. 输出分类置信度
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ModuleCategory, ModuleClassification, ImportantPaths } from './types';
/**
 * 分类器配置
 */
export interface ClassifierConfig {
    /** 最小置信度阈值 */
    minConfidence?: number;
}
export declare class ModuleClassifier {
    private config;
    constructor(config?: ClassifierConfig);
    /**
     * 分类路径
     */
    classify(filePath: string, repoRoot?: string): ModuleClassification;
    /**
     * 批量分类
     */
    classifyMany(paths: string[], repoRoot?: string): ModuleClassification[];
    /**
     * 分类目录
     */
    classifyDirectory(dirPath: string, repoRoot?: string): ModuleClassification;
    /**
     * 构建重要路径分类
     */
    buildImportantPaths(paths: string[], repoRoot: string): ImportantPaths;
    /**
     * 获取分类描述
     */
    getCategoryDescription(category: ModuleCategory): string;
    /**
     * 获取所有分类
     */
    getAllCategories(): ModuleCategory[];
    /**
     * 检查路径匹配
     */
    private checkPathMatch;
    /**
     * 检查文件匹配
     */
    private checkFileMatch;
    /**
     * 检查模式匹配
     */
    private matchesPattern;
}
/**
 * 创建模块分类器
 */
export declare function createModuleClassifier(config?: ClassifierConfig): ModuleClassifier;
/**
 * 快速分类路径
 */
export declare function classifyPath(filePath: string, repoRoot?: string): ModuleClassification;
/**
 * 获取分类描述
 */
export declare function getCategoryDescription(category: ModuleCategory): string;
