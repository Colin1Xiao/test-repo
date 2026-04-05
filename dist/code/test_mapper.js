"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestMapper = void 0;
exports.createTestMapper = createTestMapper;
exports.mapFileToTests = mapFileToTests;
const path = __importStar(require("path"));
// ============================================================================
// 测试映射器
// ============================================================================
class TestMapper {
    constructor(config = {}) {
        this.config = {
            maxTests: config.maxTests ?? 20,
            minConfidence: config.minConfidence ?? 0.3,
        };
    }
    /**
     * 设置测试清单
     */
    setInventory(inventory) {
        this.inventory = inventory;
    }
    /**
     * 映射源文件到测试
     */
    async mapFile(sourceFile) {
        if (!this.inventory) {
            return {
                sourceFile,
                tests: [],
                strength: 'weak',
                reasons: ['No test inventory available'],
            };
        }
        const result = this.findRelatedTests(sourceFile);
        return {
            sourceFile,
            tests: result.tests.slice(0, this.config.maxTests),
            strength: result.strength,
            reasons: result.reasons,
        };
    }
    /**
     * 映射符号到测试
     */
    async mapSymbol(symbol) {
        if (!this.inventory) {
            return {
                sourceFile: symbol.file,
                tests: [],
                strength: 'weak',
                reasons: ['No test inventory available'],
            };
        }
        // 基于文件映射
        const fileMapping = await this.mapFile(symbol.file);
        // 基于符号名查找
        const symbolTests = this.findTestsBySymbolName(symbol);
        // 合并结果
        const allTests = this.mergeTests([...fileMapping.tests, ...symbolTests]);
        return {
            sourceFile: symbol.file,
            tests: allTests.slice(0, this.config.maxTests),
            strength: fileMapping.strength,
            reasons: [...fileMapping.reasons, ...symbolTests.map(t => `Symbol name match: ${t.file}`)],
        };
    }
    /**
     * 映射多个文件
     */
    async mapFiles(sourceFiles) {
        return await Promise.all(sourceFiles.map(f => this.mapFile(f)));
    }
    /**
     * 获取所有相关测试
     */
    async getAllRelatedTests(sourceFiles) {
        const mappings = await this.mapFiles(sourceFiles);
        const allTests = mappings.flatMap(m => m.tests);
        return this.deduplicateTests(allTests);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 查找相关测试
     */
    findRelatedTests(sourceFile) {
        const tests = [];
        const reasons = [];
        let strength = 'weak';
        if (!this.inventory) {
            return { tests, strength, reasons };
        }
        const sourceBaseName = path.basename(sourceFile, path.extname(sourceFile));
        const sourceDir = path.dirname(sourceFile);
        // 强映射：同名测试文件
        const strongTests = this.findByNameMatch(sourceBaseName, sourceDir);
        if (strongTests.length > 0) {
            tests.push(...strongTests);
            reasons.push(`Strong match: same name tests found`);
            strength = 'strong';
        }
        // 中映射：同目录测试
        const mediumTests = this.findByDirectory(sourceDir);
        if (mediumTests.length > 0) {
            tests.push(...mediumTests);
            reasons.push(`Medium match: same directory tests found`);
            if (strength !== 'strong')
                strength = 'medium';
        }
        // 中映射：同模块测试
        const moduleTests = this.findByModule(sourceFile);
        if (moduleTests.length > 0) {
            tests.push(...moduleTests);
            reasons.push(`Medium match: same module tests found`);
            if (strength !== 'strong')
                strength = 'medium';
        }
        // 弱映射：所有测试（作为 fallback）
        if (tests.length === 0) {
            const weakTests = this.inventory.tests.slice(0, 5);
            tests.push(...weakTests);
            reasons.push(`Weak match: general tests`);
            strength = 'weak';
        }
        return { tests, strength, reasons };
    }
    /**
     * 按名称匹配查找测试
     */
    findByNameMatch(sourceBaseName, sourceDir) {
        const matches = [];
        if (!this.inventory)
            return matches;
        // 查找 foo.ts -> foo.test.ts / test_foo.py
        for (const test of this.inventory.tests) {
            const testBaseName = path.basename(test.file, path.extname(test.file));
            // 去掉 .test / .spec / _test 等后缀
            const cleanName = testBaseName
                .replace(/\.test$/, '')
                .replace(/\.spec$/, '')
                .replace(/^test_/, '')
                .replace(/_test$/, '');
            if (cleanName === sourceBaseName) {
                matches.push(test);
            }
        }
        return matches;
    }
    /**
     * 按目录查找测试
     */
    findByDirectory(sourceDir) {
        const matches = [];
        if (!this.inventory)
            return matches;
        for (const test of this.inventory.tests) {
            const testDir = path.dirname(test.file);
            // 同目录或子目录
            if (testDir === sourceDir || testDir.startsWith(sourceDir + '/')) {
                matches.push(test);
            }
        }
        return matches;
    }
    /**
     * 按模块查找测试
     */
    findByModule(sourceFile) {
        const matches = [];
        if (!this.inventory)
            return matches;
        const sourceModule = this.extractModule(sourceFile);
        for (const test of this.inventory.tests) {
            if (test.relatedModules?.includes(sourceModule)) {
                matches.push(test);
            }
        }
        return matches;
    }
    /**
     * 按符号名查找测试
     */
    findTestsBySymbolName(symbol) {
        const matches = [];
        if (!this.inventory)
            return matches;
        // 在测试内容中查找符号名（简化实现：基于文件名）
        const symbolBaseName = symbol.name.toLowerCase();
        for (const test of this.inventory.tests) {
            const testBaseName = path.basename(test.file).toLowerCase();
            if (testBaseName.includes(symbolBaseName)) {
                matches.push(test);
            }
        }
        return matches;
    }
    /**
     * 提取模块名
     */
    extractModule(filePath) {
        const parts = filePath.split(path.sep);
        const srcIndex = parts.findIndex(p => ['src', 'app', 'lib', 'packages'].includes(p));
        if (srcIndex !== -1 && srcIndex < parts.length - 1) {
            return parts.slice(srcIndex + 1, -1).join('/');
        }
        return '';
    }
    /**
     * 合并测试
     */
    mergeTests(tests) {
        return this.deduplicateTests(tests);
    }
    /**
     * 去重测试
     */
    deduplicateTests(tests) {
        const seen = new Set();
        const unique = [];
        for (const test of tests) {
            if (!seen.has(test.file)) {
                seen.add(test.file);
                unique.push(test);
            }
        }
        return unique;
    }
}
exports.TestMapper = TestMapper;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建测试映射器
 */
function createTestMapper(config) {
    return new TestMapper(config);
}
/**
 * 快速映射文件
 */
async function mapFileToTests(inventory, sourceFile) {
    const mapper = new TestMapper();
    mapper.setInventory(inventory);
    return await mapper.mapFile(sourceFile);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdF9tYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS90ZXN0X21hcHBlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXlTSCw0Q0FFQztBQUtELHdDQU9DO0FBclRELDJDQUE2QjtBQWdCN0IsK0VBQStFO0FBQy9FLFFBQVE7QUFDUiwrRUFBK0U7QUFFL0UsTUFBYSxVQUFVO0lBSXJCLFlBQVksU0FBMkIsRUFBRTtRQUN2QyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLElBQUksRUFBRTtZQUMvQixhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsSUFBSSxHQUFHO1NBQzNDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZLENBQUMsU0FBd0I7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFrQjtRQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3BCLE9BQU87Z0JBQ0wsVUFBVTtnQkFDVixLQUFLLEVBQUUsRUFBRTtnQkFDVCxRQUFRLEVBQUUsTUFBTTtnQkFDaEIsT0FBTyxFQUFFLENBQUMsNkJBQTZCLENBQUM7YUFDekMsQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFakQsT0FBTztZQUNMLFVBQVU7WUFDVixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBQ2xELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtZQUN6QixPQUFP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Q0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEIsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUExUUQsZ0NBMFFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxNQUF5QjtJQUN4RCxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRDs7R0FFRztBQUNJLEtBQUssVUFBVSxjQUFjLENBQ2xDLFNBQXdCLEVBQ3hCLFVBQWtCO0lBRWxCLE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7SUFDaEMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMvQixPQUFPLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMxQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUZXN0IE1hcHBlciAtIOa1i+ivleaYoOWwhOWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWwhua6kOaWh+S7tuaYoOWwhOWIsOebuOWFs+a1i+ivlVxuICogMi4g5bCG56ym5Y+35pig5bCE5Yiw55u45YWz5rWL6K+VXG4gKiAzLiDmlK/mjIHlvLov5LitL+W8seaYoOWwhFxuICogNC4g6L+U5Zue5pig5bCE5YiG5pWw5ZKM5Y6f5ZugXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IFRlc3RSZWYsIFRlc3RNYXBwaW5nLCBUZXN0SW52ZW50b3J5LCBUZXN0TWFwcGVyQ29uZmlnLCBTeW1ib2xEZWZpbml0aW9uIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOaYoOWwhOe7k+aenFxuICovXG5pbnRlcmZhY2UgTWFwcGluZ1Jlc3VsdCB7XG4gIHRlc3RzOiBUZXN0UmVmW107XG4gIHN0cmVuZ3RoOiAnc3Ryb25nJyB8ICdtZWRpdW0nIHwgJ3dlYWsnO1xuICByZWFzb25zOiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5rWL6K+V5pig5bCE5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBUZXN0TWFwcGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFRlc3RNYXBwZXJDb25maWc+O1xuICBwcml2YXRlIGludmVudG9yeT86IFRlc3RJbnZlbnRvcnk7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFRlc3RNYXBwZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgbWF4VGVzdHM6IGNvbmZpZy5tYXhUZXN0cyA/PyAyMCxcbiAgICAgIG1pbkNvbmZpZGVuY2U6IGNvbmZpZy5taW5Db25maWRlbmNlID8/IDAuMyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K6+572u5rWL6K+V5riF5Y2VXG4gICAqL1xuICBzZXRJbnZlbnRvcnkoaW52ZW50b3J5OiBUZXN0SW52ZW50b3J5KTogdm9pZCB7XG4gICAgdGhpcy5pbnZlbnRvcnkgPSBpbnZlbnRvcnk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmmKDlsITmupDmlofku7bliLDmtYvor5VcbiAgICovXG4gIGFzeW5jIG1hcEZpbGUoc291cmNlRmlsZTogc3RyaW5nKTogUHJvbWlzZTxUZXN0TWFwcGluZz4ge1xuICAgIGlmICghdGhpcy5pbnZlbnRvcnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgIHRlc3RzOiBbXSxcbiAgICAgICAgc3RyZW5ndGg6ICd3ZWFrJyxcbiAgICAgICAgcmVhc29uczogWydObyB0ZXN0IGludmVudG9yeSBhdmFpbGFibGUnXSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZmluZFJlbGF0ZWRUZXN0cyhzb3VyY2VGaWxlKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlRmlsZSxcbiAgICAgIHRlc3RzOiByZXN1bHQudGVzdHMuc2xpY2UoMCwgdGhpcy5jb25maWcubWF4VGVzdHMpLFxuICAgICAgc3RyZW5ndGg6IHJlc3VsdC5zdHJlbmd0aCxcbiAgICAgIHJlYXNvbnM6IHJlc3VsdC5yZWFzb25zLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmmKDlsITnrKblj7fliLDmtYvor5VcbiAgICovXG4gIGFzeW5jIG1hcFN5bWJvbChzeW1ib2w6IFN5bWJvbERlZmluaXRpb24pOiBQcm9taXNlPFRlc3RNYXBwaW5nPiB7XG4gICAgaWYgKCF0aGlzLmludmVudG9yeSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlRmlsZTogc3ltYm9sLmZpbGUsXG4gICAgICAgIHRlc3RzOiBbXSxcbiAgICAgICAgc3RyZW5ndGg6ICd3ZWFrJyxcbiAgICAgICAgcmVhc29uczogWydObyB0ZXN0IGludmVudG9yeSBhdmFpbGFibGUnXSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOWfuuS6juaWh+S7tuaYoOWwhFxuICAgIGNvbnN0IGZpbGVNYXBwaW5nID0gYXdhaXQgdGhpcy5tYXBGaWxlKHN5bWJvbC5maWxlKTtcbiAgICBcbiAgICAvLyDln7rkuo7nrKblj7flkI3mn6Xmib5cbiAgICBjb25zdCBzeW1ib2xUZXN0cyA9IHRoaXMuZmluZFRlc3RzQnlTeW1ib2xOYW1lKHN5bWJvbCk7XG4gICAgXG4gICAgLy8g5ZCI5bm257uT5p6cXG4gICAgY29uc3QgYWxsVGVzdHMgPSB0aGlzLm1lcmdlVGVzdHMoWy4uLmZpbGVNYXBwaW5nLnRlc3RzLCAuLi5zeW1ib2xUZXN0c10pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VGaWxlOiBzeW1ib2wuZmlsZSxcbiAgICAgIHRlc3RzOiBhbGxUZXN0cy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhUZXN0cyksXG4gICAgICBzdHJlbmd0aDogZmlsZU1hcHBpbmcuc3RyZW5ndGgsXG4gICAgICByZWFzb25zOiBbLi4uZmlsZU1hcHBpbmcucmVhc29ucywgLi4uc3ltYm9sVGVzdHMubWFwKHQgPT4gYFN5bWJvbCBuYW1lIG1hdGNoOiAke3QuZmlsZX1gKV0sXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaYoOWwhOWkmuS4quaWh+S7tlxuICAgKi9cbiAgYXN5bmMgbWFwRmlsZXMoc291cmNlRmlsZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxUZXN0TWFwcGluZ1tdPiB7XG4gICAgcmV0dXJuIGF3YWl0IFByb21pc2UuYWxsKHNvdXJjZUZpbGVzLm1hcChmID0+IHRoaXMubWFwRmlsZShmKSkpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5omA5pyJ55u45YWz5rWL6K+VXG4gICAqL1xuICBhc3luYyBnZXRBbGxSZWxhdGVkVGVzdHMoc291cmNlRmlsZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxUZXN0UmVmW10+IHtcbiAgICBjb25zdCBtYXBwaW5ncyA9IGF3YWl0IHRoaXMubWFwRmlsZXMoc291cmNlRmlsZXMpO1xuICAgIGNvbnN0IGFsbFRlc3RzID0gbWFwcGluZ3MuZmxhdE1hcChtID0+IG0udGVzdHMpO1xuICAgIHJldHVybiB0aGlzLmRlZHVwbGljYXRlVGVzdHMoYWxsVGVzdHMpO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog5p+l5om+55u45YWz5rWL6K+VXG4gICAqL1xuICBwcml2YXRlIGZpbmRSZWxhdGVkVGVzdHMoc291cmNlRmlsZTogc3RyaW5nKTogTWFwcGluZ1Jlc3VsdCB7XG4gICAgY29uc3QgdGVzdHM6IFRlc3RSZWZbXSA9IFtdO1xuICAgIGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHN0cmVuZ3RoOiAnc3Ryb25nJyB8ICdtZWRpdW0nIHwgJ3dlYWsnID0gJ3dlYWsnO1xuICAgIFxuICAgIGlmICghdGhpcy5pbnZlbnRvcnkpIHtcbiAgICAgIHJldHVybiB7IHRlc3RzLCBzdHJlbmd0aCwgcmVhc29ucyB9O1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBzb3VyY2VCYXNlTmFtZSA9IHBhdGguYmFzZW5hbWUoc291cmNlRmlsZSwgcGF0aC5leHRuYW1lKHNvdXJjZUZpbGUpKTtcbiAgICBjb25zdCBzb3VyY2VEaXIgPSBwYXRoLmRpcm5hbWUoc291cmNlRmlsZSk7XG4gICAgXG4gICAgLy8g5by65pig5bCE77ya5ZCM5ZCN5rWL6K+V5paH5Lu2XG4gICAgY29uc3Qgc3Ryb25nVGVzdHMgPSB0aGlzLmZpbmRCeU5hbWVNYXRjaChzb3VyY2VCYXNlTmFtZSwgc291cmNlRGlyKTtcbiAgICBpZiAoc3Ryb25nVGVzdHMubGVuZ3RoID4gMCkge1xuICAgICAgdGVzdHMucHVzaCguLi5zdHJvbmdUZXN0cyk7XG4gICAgICByZWFzb25zLnB1c2goYFN0cm9uZyBtYXRjaDogc2FtZSBuYW1lIHRlc3RzIGZvdW5kYCk7XG4gICAgICBzdHJlbmd0aCA9ICdzdHJvbmcnO1xuICAgIH1cbiAgICBcbiAgICAvLyDkuK3mmKDlsITvvJrlkIznm67lvZXmtYvor5VcbiAgICBjb25zdCBtZWRpdW1UZXN0cyA9IHRoaXMuZmluZEJ5RGlyZWN0b3J5KHNvdXJjZURpcik7XG4gICAgaWYgKG1lZGl1bVRlc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRlc3RzLnB1c2goLi4ubWVkaXVtVGVzdHMpO1xuICAgICAgcmVhc29ucy5wdXNoKGBNZWRpdW0gbWF0Y2g6IHNhbWUgZGlyZWN0b3J5IHRlc3RzIGZvdW5kYCk7XG4gICAgICBpZiAoc3RyZW5ndGggIT09ICdzdHJvbmcnKSBzdHJlbmd0aCA9ICdtZWRpdW0nO1xuICAgIH1cbiAgICBcbiAgICAvLyDkuK3mmKDlsITvvJrlkIzmqKHlnZfmtYvor5VcbiAgICBjb25zdCBtb2R1bGVUZXN0cyA9IHRoaXMuZmluZEJ5TW9kdWxlKHNvdXJjZUZpbGUpO1xuICAgIGlmIChtb2R1bGVUZXN0cy5sZW5ndGggPiAwKSB7XG4gICAgICB0ZXN0cy5wdXNoKC4uLm1vZHVsZVRlc3RzKTtcbiAgICAgIHJlYXNvbnMucHVzaChgTWVkaXVtIG1hdGNoOiBzYW1lIG1vZHVsZSB0ZXN0cyBmb3VuZGApO1xuICAgICAgaWYgKHN0cmVuZ3RoICE9PSAnc3Ryb25nJykgc3RyZW5ndGggPSAnbWVkaXVtJztcbiAgICB9XG4gICAgXG4gICAgLy8g5byx5pig5bCE77ya5omA5pyJ5rWL6K+V77yI5L2c5Li6IGZhbGxiYWNr77yJXG4gICAgaWYgKHRlc3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3Qgd2Vha1Rlc3RzID0gdGhpcy5pbnZlbnRvcnkudGVzdHMuc2xpY2UoMCwgNSk7XG4gICAgICB0ZXN0cy5wdXNoKC4uLndlYWtUZXN0cyk7XG4gICAgICByZWFzb25zLnB1c2goYFdlYWsgbWF0Y2g6IGdlbmVyYWwgdGVzdHNgKTtcbiAgICAgIHN0cmVuZ3RoID0gJ3dlYWsnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyB0ZXN0cywgc3RyZW5ndGgsIHJlYXNvbnMgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaMieWQjeensOWMuemFjeafpeaJvua1i+ivlVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kQnlOYW1lTWF0Y2goc291cmNlQmFzZU5hbWU6IHN0cmluZywgc291cmNlRGlyOiBzdHJpbmcpOiBUZXN0UmVmW10ge1xuICAgIGNvbnN0IG1hdGNoZXM6IFRlc3RSZWZbXSA9IFtdO1xuICAgIFxuICAgIGlmICghdGhpcy5pbnZlbnRvcnkpIHJldHVybiBtYXRjaGVzO1xuICAgIFxuICAgIC8vIOafpeaJviBmb28udHMgLT4gZm9vLnRlc3QudHMgLyB0ZXN0X2Zvby5weVxuICAgIGZvciAoY29uc3QgdGVzdCBvZiB0aGlzLmludmVudG9yeS50ZXN0cykge1xuICAgICAgY29uc3QgdGVzdEJhc2VOYW1lID0gcGF0aC5iYXNlbmFtZSh0ZXN0LmZpbGUsIHBhdGguZXh0bmFtZSh0ZXN0LmZpbGUpKTtcbiAgICAgIFxuICAgICAgLy8g5Y675o6JIC50ZXN0IC8gLnNwZWMgLyBfdGVzdCDnrYnlkI7nvIBcbiAgICAgIGNvbnN0IGNsZWFuTmFtZSA9IHRlc3RCYXNlTmFtZVxuICAgICAgICAucmVwbGFjZSgvXFwudGVzdCQvLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL1xcLnNwZWMkLywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9edGVzdF8vLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL190ZXN0JC8sICcnKTtcbiAgICAgIFxuICAgICAgaWYgKGNsZWFuTmFtZSA9PT0gc291cmNlQmFzZU5hbWUpIHtcbiAgICAgICAgbWF0Y2hlcy5wdXNoKHRlc3QpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbWF0Y2hlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaMieebruW9leafpeaJvua1i+ivlVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kQnlEaXJlY3Rvcnkoc291cmNlRGlyOiBzdHJpbmcpOiBUZXN0UmVmW10ge1xuICAgIGNvbnN0IG1hdGNoZXM6IFRlc3RSZWZbXSA9IFtdO1xuICAgIFxuICAgIGlmICghdGhpcy5pbnZlbnRvcnkpIHJldHVybiBtYXRjaGVzO1xuICAgIFxuICAgIGZvciAoY29uc3QgdGVzdCBvZiB0aGlzLmludmVudG9yeS50ZXN0cykge1xuICAgICAgY29uc3QgdGVzdERpciA9IHBhdGguZGlybmFtZSh0ZXN0LmZpbGUpO1xuICAgICAgXG4gICAgICAvLyDlkIznm67lvZXmiJblrZDnm67lvZVcbiAgICAgIGlmICh0ZXN0RGlyID09PSBzb3VyY2VEaXIgfHwgdGVzdERpci5zdGFydHNXaXRoKHNvdXJjZURpciArICcvJykpIHtcbiAgICAgICAgbWF0Y2hlcy5wdXNoKHRlc3QpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbWF0Y2hlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaMieaooeWdl+afpeaJvua1i+ivlVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kQnlNb2R1bGUoc291cmNlRmlsZTogc3RyaW5nKTogVGVzdFJlZltdIHtcbiAgICBjb25zdCBtYXRjaGVzOiBUZXN0UmVmW10gPSBbXTtcbiAgICBcbiAgICBpZiAoIXRoaXMuaW52ZW50b3J5KSByZXR1cm4gbWF0Y2hlcztcbiAgICBcbiAgICBjb25zdCBzb3VyY2VNb2R1bGUgPSB0aGlzLmV4dHJhY3RNb2R1bGUoc291cmNlRmlsZSk7XG4gICAgXG4gICAgZm9yIChjb25zdCB0ZXN0IG9mIHRoaXMuaW52ZW50b3J5LnRlc3RzKSB7XG4gICAgICBpZiAodGVzdC5yZWxhdGVkTW9kdWxlcz8uaW5jbHVkZXMoc291cmNlTW9kdWxlKSkge1xuICAgICAgICBtYXRjaGVzLnB1c2godGVzdCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBtYXRjaGVzO1xuICB9XG4gIFxuICAvKipcbiAgICog5oyJ56ym5Y+35ZCN5p+l5om+5rWL6K+VXG4gICAqL1xuICBwcml2YXRlIGZpbmRUZXN0c0J5U3ltYm9sTmFtZShzeW1ib2w6IFN5bWJvbERlZmluaXRpb24pOiBUZXN0UmVmW10ge1xuICAgIGNvbnN0IG1hdGNoZXM6IFRlc3RSZWZbXSA9IFtdO1xuICAgIFxuICAgIGlmICghdGhpcy5pbnZlbnRvcnkpIHJldHVybiBtYXRjaGVzO1xuICAgIFxuICAgIC8vIOWcqOa1i+ivleWGheWuueS4reafpeaJvuespuWPt+WQje+8iOeugOWMluWunueOsO+8muWfuuS6juaWh+S7tuWQje+8iVxuICAgIGNvbnN0IHN5bWJvbEJhc2VOYW1lID0gc3ltYm9sLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHRlc3Qgb2YgdGhpcy5pbnZlbnRvcnkudGVzdHMpIHtcbiAgICAgIGNvbnN0IHRlc3RCYXNlTmFtZSA9IHBhdGguYmFzZW5hbWUodGVzdC5maWxlKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgXG4gICAgICBpZiAodGVzdEJhc2VOYW1lLmluY2x1ZGVzKHN5bWJvbEJhc2VOYW1lKSkge1xuICAgICAgICBtYXRjaGVzLnB1c2godGVzdCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBtYXRjaGVzO1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W5qih5Z2X5ZCNXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RNb2R1bGUoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcGFydHMgPSBmaWxlUGF0aC5zcGxpdChwYXRoLnNlcCk7XG4gICAgY29uc3Qgc3JjSW5kZXggPSBwYXJ0cy5maW5kSW5kZXgocCA9PiBbJ3NyYycsICdhcHAnLCAnbGliJywgJ3BhY2thZ2VzJ10uaW5jbHVkZXMocCkpO1xuICAgIFxuICAgIGlmIChzcmNJbmRleCAhPT0gLTEgJiYgc3JjSW5kZXggPCBwYXJ0cy5sZW5ndGggLSAxKSB7XG4gICAgICByZXR1cm4gcGFydHMuc2xpY2Uoc3JjSW5kZXggKyAxLCAtMSkuam9pbignLycpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlkIjlubbmtYvor5VcbiAgICovXG4gIHByaXZhdGUgbWVyZ2VUZXN0cyh0ZXN0czogVGVzdFJlZltdKTogVGVzdFJlZltdIHtcbiAgICByZXR1cm4gdGhpcy5kZWR1cGxpY2F0ZVRlc3RzKHRlc3RzKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWOu+mHjea1i+ivlVxuICAgKi9cbiAgcHJpdmF0ZSBkZWR1cGxpY2F0ZVRlc3RzKHRlc3RzOiBUZXN0UmVmW10pOiBUZXN0UmVmW10ge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB1bmlxdWU6IFRlc3RSZWZbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgdGVzdCBvZiB0ZXN0cykge1xuICAgICAgaWYgKCFzZWVuLmhhcyh0ZXN0LmZpbGUpKSB7XG4gICAgICAgIHNlZW4uYWRkKHRlc3QuZmlsZSk7XG4gICAgICAgIHVuaXF1ZS5wdXNoKHRlc3QpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdW5pcXVlO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uua1i+ivleaYoOWwhOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGVzdE1hcHBlcihjb25maWc/OiBUZXN0TWFwcGVyQ29uZmlnKTogVGVzdE1hcHBlciB7XG4gIHJldHVybiBuZXcgVGVzdE1hcHBlcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+aYoOWwhOaWh+S7tlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFwRmlsZVRvVGVzdHMoXG4gIGludmVudG9yeTogVGVzdEludmVudG9yeSxcbiAgc291cmNlRmlsZTogc3RyaW5nXG4pOiBQcm9taXNlPFRlc3RNYXBwaW5nPiB7XG4gIGNvbnN0IG1hcHBlciA9IG5ldyBUZXN0TWFwcGVyKCk7XG4gIG1hcHBlci5zZXRJbnZlbnRvcnkoaW52ZW50b3J5KTtcbiAgcmV0dXJuIGF3YWl0IG1hcHBlci5tYXBGaWxlKHNvdXJjZUZpbGUpO1xufVxuIl19