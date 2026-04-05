/**
 * Test Discovery - 测试发现器
 *
 * 职责：
 * 1. 发现 TS/JS 测试文件（*.test.*, *.spec.*）
 * 2. 发现 Python 测试文件（test_*, *_test）
 * 3. 识别测试类型（unit/integration/e2e/smoke）
 * 4. 识别测试框架（Jest/Vitest/pytest 等）
 * 5. 识别相关模块
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { TestInventory, TestDiscoveryConfig } from './types';
export declare class TestDiscovery {
    private config;
    constructor(config?: TestDiscoveryConfig);
    /**
     * 发现测试
     */
    discover(repoRoot: string): Promise<TestInventory>;
    /**
     * 扫描目录
     */
    private scanDirectory;
    /**
     * 扫描测试目录
     */
    private scanTestDirectory;
    /**
     * 获取测试文件引用
     */
    private getTestFileRef;
    /**
     * 获取测试目录类型
     */
    private getTestDirKind;
    /**
     * 检测框架
     */
    private detectFramework;
    /**
     * 提取相关模块
     */
    private extractRelatedModules;
    /**
     * 计算置信度
     */
    private calculateConfidence;
    /**
     * 获取语言
     */
    private getLanguage;
    /**
     * 检查是否应该排除
     */
    private shouldExclude;
    /**
     * 构建测试清单
     */
    private buildInventory;
}
/**
 * 创建测试发现器
 */
export declare function createTestDiscovery(config?: TestDiscoveryConfig): TestDiscovery;
/**
 * 快速发现测试
 */
export declare function discoverTests(repoRoot: string): Promise<TestInventory>;
