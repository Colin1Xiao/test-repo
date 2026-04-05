/**
 * Test Mapper - 测试映射器
 *
 * 职责：
 * 1. 将源文件映射到相关测试
 * 2. 将符号映射到相关测试
 * 3. 支持强/中/弱映射
 * 4. 返回映射分数和原因
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { TestRef, TestMapping, TestInventory, TestMapperConfig, SymbolDefinition } from './types';
export declare class TestMapper {
    private config;
    private inventory?;
    constructor(config?: TestMapperConfig);
    /**
     * 设置测试清单
     */
    setInventory(inventory: TestInventory): void;
    /**
     * 映射源文件到测试
     */
    mapFile(sourceFile: string): Promise<TestMapping>;
    /**
     * 映射符号到测试
     */
    mapSymbol(symbol: SymbolDefinition): Promise<TestMapping>;
    /**
     * 映射多个文件
     */
    mapFiles(sourceFiles: string[]): Promise<TestMapping[]>;
    /**
     * 获取所有相关测试
     */
    getAllRelatedTests(sourceFiles: string[]): Promise<TestRef[]>;
    /**
     * 查找相关测试
     */
    private findRelatedTests;
    /**
     * 按名称匹配查找测试
     */
    private findByNameMatch;
    /**
     * 按目录查找测试
     */
    private findByDirectory;
    /**
     * 按模块查找测试
     */
    private findByModule;
    /**
     * 按符号名查找测试
     */
    private findTestsBySymbolName;
    /**
     * 提取模块名
     */
    private extractModule;
    /**
     * 合并测试
     */
    private mergeTests;
    /**
     * 去重测试
     */
    private deduplicateTests;
}
/**
 * 创建测试映射器
 */
export declare function createTestMapper(config?: TestMapperConfig): TestMapper;
/**
 * 快速映射文件
 */
export declare function mapFileToTests(inventory: TestInventory, sourceFile: string): Promise<TestMapping>;
