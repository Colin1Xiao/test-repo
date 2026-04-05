"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchImpactAnalyzer = void 0;
exports.createPatchImpactAnalyzer = createPatchImpactAnalyzer;
exports.analyzePatchImpact = analyzePatchImpact;
const test_mapper_1 = require("./test_mapper");
// ============================================================================
// 补丁影响分析器
// ============================================================================
class PatchImpactAnalyzer {
    constructor(config = {}) {
        this.config = {
            includeSymbols: config.includeSymbols ?? true,
            includeTests: config.includeTests ?? true,
            highRiskPatterns: config.highRiskPatterns ?? [
                '/auth/',
                '/payment/',
                '/db/',
                '/api/',
                '/core/',
                '/shared/',
                '/lib/',
                'entrypoint',
                'main.',
                'app.',
            ],
            mediumRiskPatterns: config.mediumRiskPatterns ?? [
                '/src/',
                '/app/',
                '/services/',
                '/handlers/',
                '/controllers/',
            ],
        };
        this.testMapper = new test_mapper_1.TestMapper();
    }
    /**
     * 设置符号索引
     */
    setSymbolIndex(index) {
        this.symbolIndex = index;
        this.testMapper.setInventory(this.testInventory);
    }
    /**
     * 设置测试清单
     */
    setTestInventory(inventory) {
        this.testInventory = inventory;
        this.testMapper.setInventory(inventory);
    }
    /**
     * 分析影响
     */
    async analyze(changedFiles) {
        const evidence = [];
        const impactedSymbols = [];
        const impactedFiles = new Set();
        const affectedEntrypoints = [];
        const relatedTests = [];
        // 1. 文件变更证据
        for (const file of changedFiles) {
            evidence.push({
                type: 'file_change',
                description: `File changed: ${file}`,
                confidence: 1.0,
                source: 'patch',
            });
            impactedFiles.add(file);
        }
        // 2. 符号影响分析
        if (this.config.includeSymbols && this.symbolIndex) {
            const symbols = await this.findImpactedSymbols(changedFiles);
            impactedSymbols.push(...symbols);
            for (const symbol of symbols) {
                evidence.push({
                    type: 'symbol_change',
                    description: `Symbol affected: ${symbol.name} (${symbol.kind})`,
                    confidence: 0.8,
                    source: 'symbol_index',
                });
            }
        }
        // 3. 入口点影响分析
        const entrypoints = await this.findAffectedEntrypoints(changedFiles);
        affectedEntrypoints.push(...entrypoints);
        for (const entrypoint of entrypoints) {
            evidence.push({
                type: 'import_relation',
                description: `Entrypoint affected: ${entrypoint.path} (${entrypoint.type})`,
                confidence: 0.7,
                source: 'entrypoint_analysis',
            });
        }
        // 4. 测试映射
        if (this.config.includeTests && this.testInventory) {
            const tests = await this.findRelatedTests(changedFiles);
            relatedTests.push(...tests);
            for (const test of tests.slice(0, 5)) {
                evidence.push({
                    type: 'test_relation',
                    description: `Related test: ${test.file}`,
                    confidence: test.confidence,
                    source: 'test_mapping',
                });
            }
        }
        // 5. 风险评估
        const risk = this.assessRisk(changedFiles, impactedSymbols, entrypoints);
        const riskReasons = this.getRiskReasons(changedFiles, impactedSymbols, entrypoints);
        return {
            changedFiles,
            impactedSymbols,
            impactedFiles: Array.from(impactedFiles),
            affectedEntrypoints,
            relatedTests,
            risk,
            riskReasons,
            evidence,
        };
    }
    /**
     * 查找影响的符号
     */
    async findImpactedSymbols(changedFiles) {
        const symbols = [];
        if (!this.symbolIndex)
            return symbols;
        for (const file of changedFiles) {
            const fileSymbols = this.symbolIndex.byFile.get(file);
            if (fileSymbols) {
                symbols.push(...fileSymbols);
            }
            // 查找引用该文件的其他符号
            for (const [name, defs] of this.symbolIndex.byName.entries()) {
                for (const def of defs) {
                    if (def.file !== file) {
                        // 简化：假设所有导出符号都可能被引用
                        if (def.exported) {
                            symbols.push(def);
                        }
                    }
                }
            }
        }
        return symbols;
    }
    /**
     * 查找影响的入口点
     */
    async findAffectedEntrypoints(changedFiles) {
        const affected = [];
        // 简化实现：检查变更文件是否是入口点或在入口点附近
        for (const file of changedFiles) {
            // 检查是否是入口点文件
            const entrypointPatterns = ['main.', 'index.', 'app.', 'pages/', 'api/'];
            for (const pattern of entrypointPatterns) {
                if (file.includes(pattern)) {
                    affected.push({
                        path: file,
                        type: 'app',
                        confidence: 'primary',
                        description: `Affected entrypoint: ${file}`,
                    });
                }
            }
        }
        return affected;
    }
    /**
     * 查找相关测试
     */
    async findRelatedTests(changedFiles) {
        if (!this.testInventory)
            return [];
        return await this.testMapper.getAllRelatedTests(changedFiles);
    }
    /**
     * 评估风险
     */
    assessRisk(changedFiles, symbols, entrypoints) {
        // 高风险：入口点变更
        if (entrypoints.length > 0) {
            return 'high';
        }
        // 高风险：核心目录变更
        for (const file of changedFiles) {
            for (const pattern of this.config.highRiskPatterns) {
                if (file.includes(pattern)) {
                    return 'high';
                }
            }
        }
        // 高风险：导出符号变更
        const exportedSymbols = symbols.filter(s => s.exported);
        if (exportedSymbols.length > 3) {
            return 'high';
        }
        // 中风险：业务逻辑目录
        for (const file of changedFiles) {
            for (const pattern of this.config.mediumRiskPatterns) {
                if (file.includes(pattern)) {
                    return 'medium';
                }
            }
        }
        // 低风险：文档/配置/测试
        const docPatterns = ['.md', '.rst', 'README', 'CHANGELOG', 'docs/', 'config/'];
        for (const file of changedFiles) {
            for (const pattern of docPatterns) {
                if (file.includes(pattern)) {
                    return 'low';
                }
            }
        }
        // 默认中风险
        return 'medium';
    }
    /**
     * 获取风险原因
     */
    getRiskReasons(changedFiles, symbols, entrypoints) {
        const reasons = [];
        if (entrypoints.length > 0) {
            reasons.push(`Entrypoint affected: ${entrypoints[0].path}`);
        }
        for (const file of changedFiles) {
            for (const pattern of this.config.highRiskPatterns) {
                if (file.includes(pattern)) {
                    reasons.push(`High-risk directory: ${pattern}`);
                }
            }
        }
        const exportedSymbols = symbols.filter(s => s.exported);
        if (exportedSymbols.length > 0) {
            reasons.push(`${exportedSymbols.length} exported symbols affected`);
        }
        if (reasons.length === 0) {
            reasons.push('Standard business logic changes');
        }
        return reasons;
    }
}
exports.PatchImpactAnalyzer = PatchImpactAnalyzer;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建补丁影响分析器
 */
function createPatchImpactAnalyzer(config) {
    return new PatchImpactAnalyzer(config);
}
/**
 * 快速分析影响
 */
async function analyzePatchImpact(changedFiles, symbolIndex, testInventory) {
    const analyzer = new PatchImpactAnalyzer();
    if (symbolIndex)
        analyzer.setSymbolIndex(symbolIndex);
    if (testInventory)
        analyzer.setTestInventory(testInventory);
    return await analyzer.analyze(changedFiles);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0Y2hfaW1wYWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvZGUvcGF0Y2hfaW1wYWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7OztBQWtVSCw4REFFQztBQUtELGdEQVNDO0FBNVVELCtDQUEyQztBQXVCM0MsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0UsTUFBYSxtQkFBbUI7SUFNOUIsWUFBWSxTQUE0QixFQUFFO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxJQUFJO1lBQzdDLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxJQUFJLElBQUk7WUFDekMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixJQUFJO2dCQUMzQyxRQUFRO2dCQUNSLFdBQVc7Z0JBQ1gsTUFBTTtnQkFDTixPQUFPO2dCQUNQLFFBQVE7Z0JBQ1IsVUFBVTtnQkFDVixPQUFPO2dCQUNQLFlBQVk7Z0JBQ1osT0FBTztnQkFDUCxNQUFNO2FBQ1A7WUFDRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUk7Z0JBQy9DLE9BQU87Z0JBQ1AsT0FBTztnQkFDUCxZQUFZO2dCQUNaLFlBQVk7Z0JBQ1osZUFBZTthQUNoQjtTQUNGLENBQUM7UUFFRixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksd0JBQVUsRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWMsQ0FBQyxLQUFrQjtRQUMvQixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0JBQWdCLENBQUMsU0FBd0I7UUFDdkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxTQUFTLENBQUM7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QUNsRSxPQUFPLElBQUksbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUN0QyxZQUFzQixFQUN0QixXQUF5QixFQUN6QixhQUE2QjtJQUU3QixNQUFNLFFBQVEsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7SUFDM0MsSUFBSSxXQUFXO1FBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RCxJQUFJLGFBQWE7UUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDNUQsT0FBTyxNQUFNLFFBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDOUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGF0Y2ggSW1wYWN0IC0g6KGl5LiB5b2x5ZON5YiG5p6QXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5YiG5p6Q5Y+Y5pu05paH5Lu255qE5b2x5ZONXG4gKiAyLiDor4bliKvlvbHlk43nmoTnrKblj7dcbiAqIDMuIOivhuWIq+W9seWTjeeahOWFpeWPo+eCuVxuICogNC4g6K+E5Lyw6aOO6Zmp562J57qnXG4gKiA1LiDnlJ/miJDlvbHlk43or4Hmja5cbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgSW1wYWN0UmVwb3J0LCBJbXBhY3RFdmlkZW5jZSwgUmlza0xldmVsLCBUZXN0UmVmLCBFbnRyeXBvaW50LCBTeW1ib2xEZWZpbml0aW9uIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFRlc3RJbnZlbnRvcnkgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgU3ltYm9sSW5kZXggfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFRlc3RNYXBwZXIgfSBmcm9tICcuL3Rlc3RfbWFwcGVyJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5b2x5ZON5YiG5p6Q6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGF0Y2hJbXBhY3RDb25maWcge1xuICAvKiog5YyF5ZCr56ym5Y+35YiG5p6QICovXG4gIGluY2x1ZGVTeW1ib2xzPzogYm9vbGVhbjtcbiAgXG4gIC8qKiDljIXlkKvmtYvor5XmmKDlsIQgKi9cbiAgaW5jbHVkZVRlc3RzPzogYm9vbGVhbjtcbiAgXG4gIC8qKiDpq5jpo47pmannm67lvZXmqKHlvI8gKi9cbiAgaGlnaFJpc2tQYXR0ZXJucz86IHN0cmluZ1tdO1xuICBcbiAgLyoqIOS4remjjumZqeebruW9leaooeW8jyAqL1xuICBtZWRpdW1SaXNrUGF0dGVybnM/OiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6KGl5LiB5b2x5ZON5YiG5p6Q5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBQYXRjaEltcGFjdEFuYWx5emVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFBhdGNoSW1wYWN0Q29uZmlnPjtcbiAgcHJpdmF0ZSBzeW1ib2xJbmRleD86IFN5bWJvbEluZGV4O1xuICBwcml2YXRlIHRlc3RJbnZlbnRvcnk/OiBUZXN0SW52ZW50b3J5O1xuICBwcml2YXRlIHRlc3RNYXBwZXI6IFRlc3RNYXBwZXI7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFBhdGNoSW1wYWN0Q29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGluY2x1ZGVTeW1ib2xzOiBjb25maWcuaW5jbHVkZVN5bWJvbHMgPz8gdHJ1ZSxcbiAgICAgIGluY2x1ZGVUZXN0czogY29uZmlnLmluY2x1ZGVUZXN0cyA/PyB0cnVlLFxuICAgICAgaGlnaFJpc2tQYXR0ZXJuczogY29uZmlnLmhpZ2hSaXNrUGF0dGVybnMgPz8gW1xuICAgICAgICAnL2F1dGgvJyxcbiAgICAgICAgJy9wYXltZW50LycsXG4gICAgICAgICcvZGIvJyxcbiAgICAgICAgJy9hcGkvJyxcbiAgICAgICAgJy9jb3JlLycsXG4gICAgICAgICcvc2hhcmVkLycsXG4gICAgICAgICcvbGliLycsXG4gICAgICAgICdlbnRyeXBvaW50JyxcbiAgICAgICAgJ21haW4uJyxcbiAgICAgICAgJ2FwcC4nLFxuICAgICAgXSxcbiAgICAgIG1lZGl1bVJpc2tQYXR0ZXJuczogY29uZmlnLm1lZGl1bVJpc2tQYXR0ZXJucyA/PyBbXG4gICAgICAgICcvc3JjLycsXG4gICAgICAgICcvYXBwLycsXG4gICAgICAgICcvc2VydmljZXMvJyxcbiAgICAgICAgJy9oYW5kbGVycy8nLFxuICAgICAgICAnL2NvbnRyb2xsZXJzLycsXG4gICAgICBdLFxuICAgIH07XG4gICAgXG4gICAgdGhpcy50ZXN0TWFwcGVyID0gbmV3IFRlc3RNYXBwZXIoKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiuvue9ruespuWPt+e0ouW8lVxuICAgKi9cbiAgc2V0U3ltYm9sSW5kZXgoaW5kZXg6IFN5bWJvbEluZGV4KTogdm9pZCB7XG4gICAgdGhpcy5zeW1ib2xJbmRleCA9IGluZGV4O1xuICAgIHRoaXMudGVzdE1hcHBlci5zZXRJbnZlbnRvcnkodGhpcy50ZXN0SW52ZW50b3J5KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiuvue9rua1i+ivlea4heWNlVxuICAgKi9cbiAgc2V0VGVzdEludmVudG9yeShpbnZlbnRvcnk6IFRlc3RJbnZlbnRvcnkpOiB2b2lkIHtcbiAgICB0aGlzLnRlc3RJbnZlbnRvcnkgPSBpbnZlbnRvcnk7XG4gICAgdGhpcy50ZXN0TWFwcGVyLnNldEludmVudG9yeShpbnZlbnRvcnkpO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5p6Q5b2x5ZONXG4gICAqL1xuICBhc3luYyBhbmFseXplKGNoYW5nZWRGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPEltcGFjdFJlcG9ydD4ge1xuICAgIGNvbnN0IGV2aWRlbmNlOiBJbXBhY3RFdmlkZW5jZVtdID0gW107XG4gICAgY29uc3QgaW1wYWN0ZWRTeW1ib2xzOiBTeW1ib2xEZWZpbml0aW9uW10gPSBbXTtcbiAgICBjb25zdCBpbXBhY3RlZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYWZmZWN0ZWRFbnRyeXBvaW50czogRW50cnlwb2ludFtdID0gW107XG4gICAgY29uc3QgcmVsYXRlZFRlc3RzOiBUZXN0UmVmW10gPSBbXTtcbiAgICBcbiAgICAvLyAxLiDmlofku7blj5jmm7Tor4Hmja5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgY2hhbmdlZEZpbGVzKSB7XG4gICAgICBldmlkZW5jZS5wdXNoKHtcbiAgICAgICAgdHlwZTogJ2ZpbGVfY2hhbmdlJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBGaWxlIGNoYW5nZWQ6ICR7ZmlsZX1gLFxuICAgICAgICBjb25maWRlbmNlOiAxLjAsXG4gICAgICAgIHNvdXJjZTogJ3BhdGNoJyxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpbXBhY3RlZEZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gICAgXG4gICAgLy8gMi4g56ym5Y+35b2x5ZON5YiG5p6QXG4gICAgaWYgKHRoaXMuY29uZmlnLmluY2x1ZGVTeW1ib2xzICYmIHRoaXMuc3ltYm9sSW5kZXgpIHtcbiAgICAgIGNvbnN0IHN5bWJvbHMgPSBhd2FpdCB0aGlzLmZpbmRJbXBhY3RlZFN5bWJvbHMoY2hhbmdlZEZpbGVzKTtcbiAgICAgIGltcGFjdGVkU3ltYm9scy5wdXNoKC4uLnN5bWJvbHMpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzKSB7XG4gICAgICAgIGV2aWRlbmNlLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdzeW1ib2xfY2hhbmdlJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYFN5bWJvbCBhZmZlY3RlZDogJHtzeW1ib2wubmFtZX0gKCR7c3ltYm9sLmtpbmR9KWAsXG4gICAgICAgICAgY29uZmlkZW5jZTogMC44LFxuICAgICAgICAgIHNvdXJjZTogJ3N5bWJvbF9pbmRleCcsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyAzLiDlhaXlj6PngrnlvbHlk43liIbmnpBcbiAgICBjb25zdCBlbnRyeXBvaW50cyA9IGF3YWl0IHRoaXMuZmluZEFmZmVjdGVkRW50cnlwb2ludHMoY2hhbmdlZEZpbGVzKTtcbiAgICBhZmZlY3RlZEVudHJ5cG9pbnRzLnB1c2goLi4uZW50cnlwb2ludHMpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZW50cnlwb2ludCBvZiBlbnRyeXBvaW50cykge1xuICAgICAgZXZpZGVuY2UucHVzaCh7XG4gICAgICAgIHR5cGU6ICdpbXBvcnRfcmVsYXRpb24nLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEVudHJ5cG9pbnQgYWZmZWN0ZWQ6ICR7ZW50cnlwb2ludC5wYXRofSAoJHtlbnRyeXBvaW50LnR5cGV9KWAsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuNyxcbiAgICAgICAgc291cmNlOiAnZW50cnlwb2ludF9hbmFseXNpcycsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gNC4g5rWL6K+V5pig5bCEXG4gICAgaWYgKHRoaXMuY29uZmlnLmluY2x1ZGVUZXN0cyAmJiB0aGlzLnRlc3RJbnZlbnRvcnkpIHtcbiAgICAgIGNvbnN0IHRlc3RzID0gYXdhaXQgdGhpcy5maW5kUmVsYXRlZFRlc3RzKGNoYW5nZWRGaWxlcyk7XG4gICAgICByZWxhdGVkVGVzdHMucHVzaCguLi50ZXN0cyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGVzdCBvZiB0ZXN0cy5zbGljZSgwLCA1KSkge1xuICAgICAgICBldmlkZW5jZS5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAndGVzdF9yZWxhdGlvbicsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBSZWxhdGVkIHRlc3Q6ICR7dGVzdC5maWxlfWAsXG4gICAgICAgICAgY29uZmlkZW5jZTogdGVzdC5jb25maWRlbmNlLFxuICAgICAgICAgIHNvdXJjZTogJ3Rlc3RfbWFwcGluZycsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyA1LiDpo47pmanor4TkvLBcbiAgICBjb25zdCByaXNrID0gdGhpcy5hc3Nlc3NSaXNrKGNoYW5nZWRGaWxlcywgaW1wYWN0ZWRTeW1ib2xzLCBlbnRyeXBvaW50cyk7XG4gICAgY29uc3Qgcmlza1JlYXNvbnMgPSB0aGlzLmdldFJpc2tSZWFzb25zKGNoYW5nZWRGaWxlcywgaW1wYWN0ZWRTeW1ib2xzLCBlbnRyeXBvaW50cyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGNoYW5nZWRGaWxlcyxcbiAgICAgIGltcGFjdGVkU3ltYm9scyxcbiAgICAgIGltcGFjdGVkRmlsZXM6IEFycmF5LmZyb20oaW1wYWN0ZWRGaWxlcyksXG4gICAgICBhZmZlY3RlZEVudHJ5cG9pbnRzLFxuICAgICAgcmVsYXRlZFRlc3RzLFxuICAgICAgcmlzayxcbiAgICAgIHJpc2tSZWFzb25zLFxuICAgICAgZXZpZGVuY2UsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuW9seWTjeeahOespuWPt1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5kSW1wYWN0ZWRTeW1ib2xzKGNoYW5nZWRGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPFN5bWJvbERlZmluaXRpb25bXT4ge1xuICAgIGNvbnN0IHN5bWJvbHM6IFN5bWJvbERlZmluaXRpb25bXSA9IFtdO1xuICAgIFxuICAgIGlmICghdGhpcy5zeW1ib2xJbmRleCkgcmV0dXJuIHN5bWJvbHM7XG4gICAgXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNoYW5nZWRGaWxlcykge1xuICAgICAgY29uc3QgZmlsZVN5bWJvbHMgPSB0aGlzLnN5bWJvbEluZGV4LmJ5RmlsZS5nZXQoZmlsZSk7XG4gICAgICBpZiAoZmlsZVN5bWJvbHMpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKC4uLmZpbGVTeW1ib2xzKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5p+l5om+5byV55So6K+l5paH5Lu255qE5YW25LuW56ym5Y+3XG4gICAgICBmb3IgKGNvbnN0IFtuYW1lLCBkZWZzXSBvZiB0aGlzLnN5bWJvbEluZGV4LmJ5TmFtZS5lbnRyaWVzKCkpIHtcbiAgICAgICAgZm9yIChjb25zdCBkZWYgb2YgZGVmcykge1xuICAgICAgICAgIGlmIChkZWYuZmlsZSAhPT0gZmlsZSkge1xuICAgICAgICAgICAgLy8g566A5YyW77ya5YGH6K6+5omA5pyJ5a+85Ye656ym5Y+36YO95Y+v6IO96KKr5byV55SoXG4gICAgICAgICAgICBpZiAoZGVmLmV4cG9ydGVkKSB7XG4gICAgICAgICAgICAgIHN5bWJvbHMucHVzaChkZWYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3ltYm9scztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuW9seWTjeeahOWFpeWPo+eCuVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5kQWZmZWN0ZWRFbnRyeXBvaW50cyhjaGFuZ2VkRmlsZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxFbnRyeXBvaW50W10+IHtcbiAgICBjb25zdCBhZmZlY3RlZDogRW50cnlwb2ludFtdID0gW107XG4gICAgXG4gICAgLy8g566A5YyW5a6e546w77ya5qOA5p+l5Y+Y5pu05paH5Lu25piv5ZCm5piv5YWl5Y+j54K55oiW5Zyo5YWl5Y+j54K56ZmE6L+RXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNoYW5nZWRGaWxlcykge1xuICAgICAgLy8g5qOA5p+l5piv5ZCm5piv5YWl5Y+j54K55paH5Lu2XG4gICAgICBjb25zdCBlbnRyeXBvaW50UGF0dGVybnMgPSBbJ21haW4uJywgJ2luZGV4LicsICdhcHAuJywgJ3BhZ2VzLycsICdhcGkvJ107XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBlbnRyeXBvaW50UGF0dGVybnMpIHtcbiAgICAgICAgaWYgKGZpbGUuaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICBhZmZlY3RlZC5wdXNoKHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGUsXG4gICAgICAgICAgICB0eXBlOiAnYXBwJyxcbiAgICAgICAgICAgIGNvbmZpZGVuY2U6ICdwcmltYXJ5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQWZmZWN0ZWQgZW50cnlwb2ludDogJHtmaWxlfWAsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGFmZmVjdGVkO1xuICB9XG4gIFxuICAvKipcbiAgICog5p+l5om+55u45YWz5rWL6K+VXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmRSZWxhdGVkVGVzdHMoY2hhbmdlZEZpbGVzOiBzdHJpbmdbXSk6IFByb21pc2U8VGVzdFJlZltdPiB7XG4gICAgaWYgKCF0aGlzLnRlc3RJbnZlbnRvcnkpIHJldHVybiBbXTtcbiAgICBcbiAgICByZXR1cm4gYXdhaXQgdGhpcy50ZXN0TWFwcGVyLmdldEFsbFJlbGF0ZWRUZXN0cyhjaGFuZ2VkRmlsZXMpO1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw6aOO6ZmpXG4gICAqL1xuICBwcml2YXRlIGFzc2Vzc1Jpc2soXG4gICAgY2hhbmdlZEZpbGVzOiBzdHJpbmdbXSxcbiAgICBzeW1ib2xzOiBTeW1ib2xEZWZpbml0aW9uW10sXG4gICAgZW50cnlwb2ludHM6IEVudHJ5cG9pbnRbXVxuICApOiBSaXNrTGV2ZWwge1xuICAgIC8vIOmrmOmjjumZqe+8muWFpeWPo+eCueWPmOabtFxuICAgIGlmIChlbnRyeXBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gJ2hpZ2gnO1xuICAgIH1cbiAgICBcbiAgICAvLyDpq5jpo47pmanvvJrmoLjlv4Pnm67lvZXlj5jmm7RcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgY2hhbmdlZEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgdGhpcy5jb25maWcuaGlnaFJpc2tQYXR0ZXJucykge1xuICAgICAgICBpZiAoZmlsZS5pbmNsdWRlcyhwYXR0ZXJuKSkge1xuICAgICAgICAgIHJldHVybiAnaGlnaCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g6auY6aOO6Zmp77ya5a+85Ye656ym5Y+35Y+Y5pu0XG4gICAgY29uc3QgZXhwb3J0ZWRTeW1ib2xzID0gc3ltYm9scy5maWx0ZXIocyA9PiBzLmV4cG9ydGVkKTtcbiAgICBpZiAoZXhwb3J0ZWRTeW1ib2xzLmxlbmd0aCA+IDMpIHtcbiAgICAgIHJldHVybiAnaGlnaCc7XG4gICAgfVxuICAgIFxuICAgIC8vIOS4remjjumZqe+8muS4muWKoemAu+i+keebruW9lVxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBjaGFuZ2VkRmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiB0aGlzLmNvbmZpZy5tZWRpdW1SaXNrUGF0dGVybnMpIHtcbiAgICAgICAgaWYgKGZpbGUuaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICByZXR1cm4gJ21lZGl1bSc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5L2O6aOO6Zmp77ya5paH5qGjL+mFjee9ri/mtYvor5VcbiAgICBjb25zdCBkb2NQYXR0ZXJucyA9IFsnLm1kJywgJy5yc3QnLCAnUkVBRE1FJywgJ0NIQU5HRUxPRycsICdkb2NzLycsICdjb25maWcvJ107XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNoYW5nZWRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGRvY1BhdHRlcm5zKSB7XG4gICAgICAgIGlmIChmaWxlLmluY2x1ZGVzKHBhdHRlcm4pKSB7XG4gICAgICAgICAgcmV0dXJuICdsb3cnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOm7mOiupOS4remjjumZqVxuICAgIHJldHVybiAnbWVkaXVtJztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPlumjjumZqeWOn+WboFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRSaXNrUmVhc29ucyhcbiAgICBjaGFuZ2VkRmlsZXM6IHN0cmluZ1tdLFxuICAgIHN5bWJvbHM6IFN5bWJvbERlZmluaXRpb25bXSxcbiAgICBlbnRyeXBvaW50czogRW50cnlwb2ludFtdXG4gICk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCByZWFzb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmIChlbnRyeXBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICByZWFzb25zLnB1c2goYEVudHJ5cG9pbnQgYWZmZWN0ZWQ6ICR7ZW50cnlwb2ludHNbMF0ucGF0aH1gKTtcbiAgICB9XG4gICAgXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNoYW5nZWRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHRoaXMuY29uZmlnLmhpZ2hSaXNrUGF0dGVybnMpIHtcbiAgICAgICAgaWYgKGZpbGUuaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICByZWFzb25zLnB1c2goYEhpZ2gtcmlzayBkaXJlY3Rvcnk6ICR7cGF0dGVybn1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBleHBvcnRlZFN5bWJvbHMgPSBzeW1ib2xzLmZpbHRlcihzID0+IHMuZXhwb3J0ZWQpO1xuICAgIGlmIChleHBvcnRlZFN5bWJvbHMubGVuZ3RoID4gMCkge1xuICAgICAgcmVhc29ucy5wdXNoKGAke2V4cG9ydGVkU3ltYm9scy5sZW5ndGh9IGV4cG9ydGVkIHN5bWJvbHMgYWZmZWN0ZWRgKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHJlYXNvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZWFzb25zLnB1c2goJ1N0YW5kYXJkIGJ1c2luZXNzIGxvZ2ljIGNoYW5nZXMnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlYXNvbnM7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66KGl5LiB5b2x5ZON5YiG5p6Q5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXRjaEltcGFjdEFuYWx5emVyKGNvbmZpZz86IFBhdGNoSW1wYWN0Q29uZmlnKTogUGF0Y2hJbXBhY3RBbmFseXplciB7XG4gIHJldHVybiBuZXcgUGF0Y2hJbXBhY3RBbmFseXplcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+WIhuaekOW9seWTjVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZVBhdGNoSW1wYWN0KFxuICBjaGFuZ2VkRmlsZXM6IHN0cmluZ1tdLFxuICBzeW1ib2xJbmRleD86IFN5bWJvbEluZGV4LFxuICB0ZXN0SW52ZW50b3J5PzogVGVzdEludmVudG9yeVxuKTogUHJvbWlzZTxJbXBhY3RSZXBvcnQ+IHtcbiAgY29uc3QgYW5hbHl6ZXIgPSBuZXcgUGF0Y2hJbXBhY3RBbmFseXplcigpO1xuICBpZiAoc3ltYm9sSW5kZXgpIGFuYWx5emVyLnNldFN5bWJvbEluZGV4KHN5bWJvbEluZGV4KTtcbiAgaWYgKHRlc3RJbnZlbnRvcnkpIGFuYWx5emVyLnNldFRlc3RJbnZlbnRvcnkodGVzdEludmVudG9yeSk7XG4gIHJldHVybiBhd2FpdCBhbmFseXplci5hbmFseXplKGNoYW5nZWRGaWxlcyk7XG59XG4iXX0=