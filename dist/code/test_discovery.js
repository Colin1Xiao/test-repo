"use strict";
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
exports.TestDiscovery = void 0;
exports.createTestDiscovery = createTestDiscovery;
exports.discoverTests = discoverTests;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ============================================================================
// 测试模式定义
// ============================================================================
/**
 * TS/JS 测试模式
 */
const TS_JS_TEST_PATTERNS = [
    { pattern: /\.test\.ts$/, kind: 'unit' },
    { pattern: /\.spec\.ts$/, kind: 'unit' },
    { pattern: /\.test\.tsx$/, kind: 'unit' },
    { pattern: /\.spec\.tsx$/, kind: 'unit' },
    { pattern: /\.test\.js$/, kind: 'unit' },
    { pattern: /\.spec\.js$/, kind: 'unit' },
    { pattern: /\.test\.jsx$/, kind: 'unit' },
    { pattern: /\.spec\.jsx$/, kind: 'unit' },
];
/**
 * Python 测试模式
 */
const PYTHON_TEST_PATTERNS = [
    { pattern: /^test_.*\.py$/, kind: 'unit' },
    { pattern: /^.*_test\.py$/, kind: 'unit' },
    { pattern: /^conftest\.py$/, kind: 'unknown' },
];
/**
 * 测试目录模式
 */
const TEST_DIR_PATTERNS = [
    { pattern: /\/tests?\//i, kind: 'unit' },
    { pattern: /\/__tests__\//i, kind: 'unit' },
    { pattern: /\/__spec__\//i, kind: 'unit' },
    { pattern: /\/integration\//i, kind: 'integration' },
    { pattern: /\/e2e\//i, kind: 'e2e' },
    { pattern: /\/smoke\//i, kind: 'smoke' },
];
/**
 * 框架检测模式
 */
const FRAMEWORK_PATTERNS = [
    { pattern: /vitest/i, framework: 'Vitest' },
    { pattern: /jest/i, framework: 'Jest' },
    { pattern: /mocha/i, framework: 'Mocha' },
    { pattern: /ava/i, framework: 'Ava' },
    { pattern: /pytest/i, framework: 'pytest' },
    { pattern: /unittest/i, framework: 'unittest' },
    { pattern: /playwright/i, framework: 'Playwright' },
    { pattern: /cypress/i, framework: 'Cypress' },
];
// ============================================================================
// 测试发现器
// ============================================================================
class TestDiscovery {
    constructor(config = {}) {
        this.config = {
            includeDirs: config.includeDirs ?? [],
            excludeDirs: config.excludeDirs ?? [
                'node_modules',
                '__pycache__',
                '.git',
                'dist',
                'build',
                'coverage',
                '.next',
                'venv',
                '.venv',
            ],
            filePatterns: config.filePatterns ?? [],
        };
    }
    /**
     * 发现测试
     */
    async discover(repoRoot) {
        const tests = [];
        // 扫描文件
        await this.scanDirectory(repoRoot, repoRoot, tests);
        // 构建清单
        return this.buildInventory(repoRoot, tests);
    }
    /**
     * 扫描目录
     */
    async scanDirectory(dir, repoRoot, tests) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(repoRoot, fullPath);
                // 检查排除
                if (this.shouldExclude(relativePath))
                    continue;
                if (entry.isDirectory()) {
                    // 检查是否是测试目录
                    const dirKind = this.getTestDirKind(entry.name, relativePath);
                    if (dirKind) {
                        await this.scanTestDirectory(fullPath, repoRoot, dirKind, tests);
                    }
                    else {
                        await this.scanDirectory(fullPath, repoRoot, tests);
                    }
                }
                else if (entry.isFile()) {
                    // 检查是否是测试文件
                    const testRef = this.getTestFileRef(fullPath, relativePath);
                    if (testRef) {
                        tests.push(testRef);
                    }
                }
            }
        }
        catch {
            // 忽略错误
        }
    }
    /**
     * 扫描测试目录
     */
    async scanTestDirectory(dir, repoRoot, kind, tests) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile())
                    continue;
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(repoRoot, fullPath);
                if (this.shouldExclude(relativePath))
                    continue;
                // 检查是否是测试文件
                const ext = path.extname(entry.name).toLowerCase();
                if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
                    const testRef = this.getTestFileRef(fullPath, relativePath, kind);
                    if (testRef) {
                        tests.push(testRef);
                    }
                }
            }
        }
        catch {
            // 忽略错误
        }
    }
    /**
     * 获取测试文件引用
     */
    getTestFileRef(fullPath, relativePath, defaultKind) {
        const fileName = path.basename(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        // 检测语言
        const language = this.getLanguage(ext);
        if (!language)
            return null;
        // 检测测试模式
        let kind = defaultKind;
        const reasons = [];
        if (!kind) {
            const patterns = language === 'Python' ? PYTHON_TEST_PATTERNS : TS_JS_TEST_PATTERNS;
            for (const { pattern, kind: k } of patterns) {
                if (pattern.test(fileName)) {
                    kind = k;
                    reasons.push(`File name matches pattern: ${pattern.source}`);
                    break;
                }
            }
        }
        if (!kind)
            return null;
        // 检测框架
        const framework = this.detectFramework(fullPath, language);
        // 检测相关模块
        const relatedModules = this.extractRelatedModules(relativePath, kind);
        return {
            file: relativePath,
            framework,
            kind,
            language,
            relatedModules,
            confidence: this.calculateConfidence(reasons, framework),
            reasons: reasons.length > 0 ? reasons : ['Test file pattern match'],
        };
    }
    /**
     * 获取测试目录类型
     */
    getTestDirKind(dirName, relativePath) {
        for (const { pattern, kind } of TEST_DIR_PATTERNS) {
            if (pattern.test(relativePath) || pattern.test(dirName)) {
                return kind;
            }
        }
        return null;
    }
    /**
     * 检测框架
     */
    detectFramework(fullPath, language) {
        // 根据语言检测框架
        if (language === 'Python') {
            return 'pytest'; // 默认 pytest
        }
        // TS/JS 尝试读取 package.json
        if (language === 'TypeScript' || language === 'JavaScript') {
            const packageJsonPath = path.join(path.dirname(fullPath), 'package.json');
            // 简单检测：查找常见框架配置文件
            const dir = path.dirname(fullPath);
            if (fs.existsSync(path.join(dir, 'vitest.config.ts')))
                return 'Vitest';
            if (fs.existsSync(path.join(dir, 'vitest.config.js')))
                return 'Vitest';
            if (fs.existsSync(path.join(dir, 'jest.config.js')))
                return 'Jest';
            if (fs.existsSync(path.join(dir, 'jest.config.ts')))
                return 'Jest';
        }
        return undefined;
    }
    /**
     * 提取相关模块
     */
    extractRelatedModules(relativePath, kind) {
        const modules = [];
        // 从路径提取模块名
        const dirName = path.dirname(relativePath);
        const parts = dirName.split(path.sep);
        // 查找 src/app/lib 等目录
        const srcIndex = parts.findIndex(p => ['src', 'app', 'lib', 'packages'].includes(p));
        if (srcIndex !== -1) {
            const moduleParts = parts.slice(srcIndex + 1);
            if (moduleParts.length > 0) {
                modules.push(moduleParts.join('/'));
            }
        }
        return modules;
    }
    /**
     * 计算置信度
     */
    calculateConfidence(reasons, framework) {
        let confidence = 0.5;
        if (reasons.length > 0)
            confidence += 0.2;
        if (framework)
            confidence += 0.2;
        return Math.min(1.0, confidence);
    }
    /**
     * 获取语言
     */
    getLanguage(ext) {
        switch (ext) {
            case '.ts':
            case '.tsx':
                return 'TypeScript';
            case '.js':
            case '.jsx':
                return 'JavaScript';
            case '.py':
                return 'Python';
            default:
                return null;
        }
    }
    /**
     * 检查是否应该排除
     */
    shouldExclude(relativePath) {
        for (const dir of this.config.excludeDirs) {
            if (relativePath.includes(dir))
                return true;
        }
        return false;
    }
    /**
     * 构建测试清单
     */
    buildInventory(repoRoot, tests) {
        const byKind = {
            unit: [],
            integration: [],
            e2e: [],
            smoke: [],
            unknown: [],
        };
        const byFramework = {};
        const byLanguage = {};
        for (const test of tests) {
            byKind[test.kind].push(test);
            if (test.framework) {
                if (!byFramework[test.framework])
                    byFramework[test.framework] = [];
                byFramework[test.framework].push(test);
            }
            if (!byLanguage[test.language])
                byLanguage[test.language] = [];
            byLanguage[test.language].push(test);
        }
        return {
            repoRoot,
            tests,
            byKind,
            byFramework,
            byLanguage,
            stats: {
                total: tests.length,
                byKind: {
                    unit: byKind.unit.length,
                    integration: byKind.integration.length,
                    e2e: byKind.e2e.length,
                    smoke: byKind.smoke.length,
                    unknown: byKind.unknown.length,
                },
                byFramework: Object.fromEntries(Object.entries(byFramework).map(([k, v]) => [k, v.length])),
            },
            generatedAt: Date.now(),
        };
    }
}
exports.TestDiscovery = TestDiscovery;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建测试发现器
 */
function createTestDiscovery(config) {
    return new TestDiscovery(config);
}
/**
 * 快速发现测试
 */
async function discoverTests(repoRoot) {
    const discovery = new TestDiscovery();
    return await discovery.discover(repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdF9kaXNjb3ZlcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS90ZXN0X2Rpc2NvdmVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1WEgsa0RBRUM7QUFLRCxzQ0FHQztBQS9YRCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBRzdCLCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsTUFBTSxtQkFBbUIsR0FBRztJQUMxQixFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLE1BQWtCLEVBQUU7SUFDcEQsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxNQUFrQixFQUFFO0lBQ3BELEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsTUFBa0IsRUFBRTtJQUNyRCxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLE1BQWtCLEVBQUU7SUFDckQsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxNQUFrQixFQUFFO0lBQ3BELEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsTUFBa0IsRUFBRTtJQUNwRCxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLE1BQWtCLEVBQUU7SUFDckQsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxNQUFrQixFQUFFO0NBQ3RELENBQUM7QUFFRjs7R0FFRztBQUNILE1BQU0sb0JBQW9CLEdBQUc7SUFDM0IsRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxNQUFrQixFQUFFO0lBQ3RELEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsTUFBa0IsRUFBRTtJQUN0RCxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxJ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RSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUMzRDthQUNGO1lBQ0QsV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQS9TRCxzQ0ErU0M7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLE1BQTRCO0lBQzlELE9BQU8sSUFBSSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGFBQWEsQ0FBQyxRQUFnQjtJQUNsRCxNQUFNLFNBQVMsR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO0lBQ3RDLE9BQU8sTUFBTSxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzVDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRlc3QgRGlzY292ZXJ5IC0g5rWL6K+V5Y+R546w5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5Y+R546wIFRTL0pTIOa1i+ivleaWh+S7tu+8iCoudGVzdC4qLCAqLnNwZWMuKu+8iVxuICogMi4g5Y+R546wIFB5dGhvbiDmtYvor5Xmlofku7bvvIh0ZXN0XyosICpfdGVzdO+8iVxuICogMy4g6K+G5Yir5rWL6K+V57G75Z6L77yIdW5pdC9pbnRlZ3JhdGlvbi9lMmUvc21va2XvvIlcbiAqIDQuIOivhuWIq+a1i+ivleahhuaetu+8iEplc3QvVml0ZXN0L3B5dGVzdCDnrYnvvIlcbiAqIDUuIOivhuWIq+ebuOWFs+aooeWdl1xuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBUZXN0UmVmLCBUZXN0SW52ZW50b3J5LCBUZXN0S2luZCwgVGVzdERpc2NvdmVyeUNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmtYvor5XmqKHlvI/lrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBUUy9KUyDmtYvor5XmqKHlvI9cbiAqL1xuY29uc3QgVFNfSlNfVEVTVF9QQVRURVJOUyA9IFtcbiAgeyBwYXR0ZXJuOiAvXFwudGVzdFxcLnRzJC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuICB7IHBhdHRlcm46IC9cXC5zcGVjXFwudHMkLywga2luZDogJ3VuaXQnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcLnRlc3RcXC50c3gkLywga2luZDogJ3VuaXQnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcLnNwZWNcXC50c3gkLywga2luZDogJ3VuaXQnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcLnRlc3RcXC5qcyQvLCBraW5kOiAndW5pdCcgYXMgVGVzdEtpbmQgfSxcbiAgeyBwYXR0ZXJuOiAvXFwuc3BlY1xcLmpzJC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuICB7IHBhdHRlcm46IC9cXC50ZXN0XFwuanN4JC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuICB7IHBhdHRlcm46IC9cXC5zcGVjXFwuanN4JC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuXTtcblxuLyoqXG4gKiBQeXRob24g5rWL6K+V5qih5byPXG4gKi9cbmNvbnN0IFBZVEhPTl9URVNUX1BBVFRFUk5TID0gW1xuICB7IHBhdHRlcm46IC9edGVzdF8uKlxcLnB5JC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuICB7IHBhdHRlcm46IC9eLipfdGVzdFxcLnB5JC8sIGtpbmQ6ICd1bml0JyBhcyBUZXN0S2luZCB9LFxuICB7IHBhdHRlcm46IC9eY29uZnRlc3RcXC5weSQvLCBraW5kOiAndW5rbm93bicgYXMgVGVzdEtpbmQgfSxcbl07XG5cbi8qKlxuICog5rWL6K+V55uu5b2V5qih5byPXG4gKi9cbmNvbnN0IFRFU1RfRElSX1BBVFRFUk5TID0gW1xuICB7IHBhdHRlcm46IC9cXC90ZXN0cz9cXC8vaSwga2luZDogJ3VuaXQnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcL19fdGVzdHNfX1xcLy9pLCBraW5kOiAndW5pdCcgYXMgVGVzdEtpbmQgfSxcbiAgeyBwYXR0ZXJuOiAvXFwvX19zcGVjX19cXC8vaSwga2luZDogJ3VuaXQnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcL2ludGVncmF0aW9uXFwvL2ksIGtpbmQ6ICdpbnRlZ3JhdGlvbicgYXMgVGVzdEtpbmQgfSxcbiAgeyBwYXR0ZXJuOiAvXFwvZTJlXFwvL2ksIGtpbmQ6ICdlMmUnIGFzIFRlc3RLaW5kIH0sXG4gIHsgcGF0dGVybjogL1xcL3Ntb2tlXFwvL2ksIGtpbmQ6ICdzbW9rZScgYXMgVGVzdEtpbmQgfSxcbl07XG5cbi8qKlxuICog5qGG5p625qOA5rWL5qih5byPXG4gKi9cbmNvbnN0IEZSQU1FV09SS19QQVRURVJOUyA9IFtcbiAgeyBwYXR0ZXJuOiAvdml0ZXN0L2ksIGZyYW1ld29yazogJ1ZpdGVzdCcgfSxcbiAgeyBwYXR0ZXJuOiAvamVzdC9pLCBmcmFtZXdvcms6ICdKZXN0JyB9LFxuICB7IHBhdHRlcm46IC9tb2NoYS9pLCBmcmFtZXdvcms6ICdNb2NoYScgfSxcbiAgeyBwYXR0ZXJuOiAvYXZhL2ksIGZyYW1ld29yazogJ0F2YScgfSxcbiAgeyBwYXR0ZXJuOiAvcHl0ZXN0L2ksIGZyYW1ld29yazogJ3B5dGVzdCcgfSxcbiAgeyBwYXR0ZXJuOiAvdW5pdHRlc3QvaSwgZnJhbWV3b3JrOiAndW5pdHRlc3QnIH0sXG4gIHsgcGF0dGVybjogL3BsYXl3cmlnaHQvaSwgZnJhbWV3b3JrOiAnUGxheXdyaWdodCcgfSxcbiAgeyBwYXR0ZXJuOiAvY3lwcmVzcy9pLCBmcmFtZXdvcms6ICdDeXByZXNzJyB9LFxuXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5rWL6K+V5Y+R546w5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBUZXN0RGlzY292ZXJ5IHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFRlc3REaXNjb3ZlcnlDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBUZXN0RGlzY292ZXJ5Q29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGluY2x1ZGVEaXJzOiBjb25maWcuaW5jbHVkZURpcnMgPz8gW10sXG4gICAgICBleGNsdWRlRGlyczogY29uZmlnLmV4Y2x1ZGVEaXJzID8/IFtcbiAgICAgICAgJ25vZGVfbW9kdWxlcycsXG4gICAgICAgICdfX3B5Y2FjaGVfXycsXG4gICAgICAgICcuZ2l0JyxcbiAgICAgICAgJ2Rpc3QnLFxuICAgICAgICAnYnVpbGQnLFxuICAgICAgICAnY292ZXJhZ2UnLFxuICAgICAgICAnLm5leHQnLFxuICAgICAgICAndmVudicsXG4gICAgICAgICcudmVudicsXG4gICAgICBdLFxuICAgICAgZmlsZVBhdHRlcm5zOiBjb25maWcuZmlsZVBhdHRlcm5zID8/IFtdLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlj5HnjrDmtYvor5VcbiAgICovXG4gIGFzeW5jIGRpc2NvdmVyKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPFRlc3RJbnZlbnRvcnk+IHtcbiAgICBjb25zdCB0ZXN0czogVGVzdFJlZltdID0gW107XG4gICAgXG4gICAgLy8g5omr5o+P5paH5Lu2XG4gICAgYXdhaXQgdGhpcy5zY2FuRGlyZWN0b3J5KHJlcG9Sb290LCByZXBvUm9vdCwgdGVzdHMpO1xuICAgIFxuICAgIC8vIOaehOW7uua4heWNlVxuICAgIHJldHVybiB0aGlzLmJ1aWxkSW52ZW50b3J5KHJlcG9Sb290LCB0ZXN0cyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmiavmj4/nm67lvZVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgc2NhbkRpcmVjdG9yeShcbiAgICBkaXI6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nLFxuICAgIHRlc3RzOiBUZXN0UmVmW11cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShyZXBvUm9vdCwgZnVsbFBhdGgpO1xuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l5o6S6ZmkXG4gICAgICAgIGlmICh0aGlzLnNob3VsZEV4Y2x1ZGUocmVsYXRpdmVQYXRoKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIC8vIOajgOafpeaYr+WQpuaYr+a1i+ivleebruW9lVxuICAgICAgICAgIGNvbnN0IGRpcktpbmQgPSB0aGlzLmdldFRlc3REaXJLaW5kKGVudHJ5Lm5hbWUsIHJlbGF0aXZlUGF0aCk7XG4gICAgICAgICAgaWYgKGRpcktpbmQpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2NhblRlc3REaXJlY3RvcnkoZnVsbFBhdGgsIHJlcG9Sb290LCBkaXJLaW5kLCB0ZXN0cyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2NhbkRpcmVjdG9yeShmdWxsUGF0aCwgcmVwb1Jvb3QsIHRlc3RzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAvLyDmo4Dmn6XmmK/lkKbmmK/mtYvor5Xmlofku7ZcbiAgICAgICAgICBjb25zdCB0ZXN0UmVmID0gdGhpcy5nZXRUZXN0RmlsZVJlZihmdWxsUGF0aCwgcmVsYXRpdmVQYXRoKTtcbiAgICAgICAgICBpZiAodGVzdFJlZikge1xuICAgICAgICAgICAgdGVzdHMucHVzaCh0ZXN0UmVmKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIOW/veeVpemUmeivr1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOaJq+aPj+a1i+ivleebruW9lVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuVGVzdERpcmVjdG9yeShcbiAgICBkaXI6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nLFxuICAgIGtpbmQ6IFRlc3RLaW5kLFxuICAgIHRlc3RzOiBUZXN0UmVmW11cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgaWYgKCFlbnRyeS5pc0ZpbGUoKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBwYXRoLnJlbGF0aXZlKHJlcG9Sb290LCBmdWxsUGF0aCk7XG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5zaG91bGRFeGNsdWRlKHJlbGF0aXZlUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l5piv5ZCm5piv5rWL6K+V5paH5Lu2XG4gICAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiAoWycudHMnLCAnLnRzeCcsICcuanMnLCAnLmpzeCcsICcucHknXS5pbmNsdWRlcyhleHQpKSB7XG4gICAgICAgICAgY29uc3QgdGVzdFJlZiA9IHRoaXMuZ2V0VGVzdEZpbGVSZWYoZnVsbFBhdGgsIHJlbGF0aXZlUGF0aCwga2luZCk7XG4gICAgICAgICAgaWYgKHRlc3RSZWYpIHtcbiAgICAgICAgICAgIHRlc3RzLnB1c2godGVzdFJlZik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor69cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bmtYvor5Xmlofku7blvJXnlKhcbiAgICovXG4gIHByaXZhdGUgZ2V0VGVzdEZpbGVSZWYoXG4gICAgZnVsbFBhdGg6IHN0cmluZyxcbiAgICByZWxhdGl2ZVBhdGg6IHN0cmluZyxcbiAgICBkZWZhdWx0S2luZD86IFRlc3RLaW5kXG4gICk6IFRlc3RSZWYgfCBudWxsIHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZnVsbFBhdGgpO1xuICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmdWxsUGF0aCkudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICAvLyDmo4DmtYvor63oqIBcbiAgICBjb25zdCBsYW5ndWFnZSA9IHRoaXMuZ2V0TGFuZ3VhZ2UoZXh0KTtcbiAgICBpZiAoIWxhbmd1YWdlKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyDmo4DmtYvmtYvor5XmqKHlvI9cbiAgICBsZXQga2luZDogVGVzdEtpbmQgfCB1bmRlZmluZWQgPSBkZWZhdWx0S2luZDtcbiAgICBjb25zdCByZWFzb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmICgha2luZCkge1xuICAgICAgY29uc3QgcGF0dGVybnMgPSBsYW5ndWFnZSA9PT0gJ1B5dGhvbicgPyBQWVRIT05fVEVTVF9QQVRURVJOUyA6IFRTX0pTX1RFU1RfUEFUVEVSTlM7XG4gICAgICBmb3IgKGNvbnN0IHsgcGF0dGVybiwga2luZDogayB9IG9mIHBhdHRlcm5zKSB7XG4gICAgICAgIGlmIChwYXR0ZXJuLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICAgICAga2luZCA9IGs7XG4gICAgICAgICAgcmVhc29ucy5wdXNoKGBGaWxlIG5hbWUgbWF0Y2hlcyBwYXR0ZXJuOiAke3BhdHRlcm4uc291cmNlfWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICgha2luZCkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgLy8g5qOA5rWL5qGG5p62XG4gICAgY29uc3QgZnJhbWV3b3JrID0gdGhpcy5kZXRlY3RGcmFtZXdvcmsoZnVsbFBhdGgsIGxhbmd1YWdlKTtcbiAgICBcbiAgICAvLyDmo4DmtYvnm7jlhbPmqKHlnZdcbiAgICBjb25zdCByZWxhdGVkTW9kdWxlcyA9IHRoaXMuZXh0cmFjdFJlbGF0ZWRNb2R1bGVzKHJlbGF0aXZlUGF0aCwga2luZCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGZpbGU6IHJlbGF0aXZlUGF0aCxcbiAgICAgIGZyYW1ld29yayxcbiAgICAgIGtpbmQsXG4gICAgICBsYW5ndWFnZSxcbiAgICAgIHJlbGF0ZWRNb2R1bGVzLFxuICAgICAgY29uZmlkZW5jZTogdGhpcy5jYWxjdWxhdGVDb25maWRlbmNlKHJlYXNvbnMsIGZyYW1ld29yayksXG4gICAgICByZWFzb25zOiByZWFzb25zLmxlbmd0aCA+IDAgPyByZWFzb25zIDogWydUZXN0IGZpbGUgcGF0dGVybiBtYXRjaCddLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bmtYvor5Xnm67lvZXnsbvlnotcbiAgICovXG4gIHByaXZhdGUgZ2V0VGVzdERpcktpbmQoZGlyTmFtZTogc3RyaW5nLCByZWxhdGl2ZVBhdGg6IHN0cmluZyk6IFRlc3RLaW5kIHwgbnVsbCB7XG4gICAgZm9yIChjb25zdCB7IHBhdHRlcm4sIGtpbmQgfSBvZiBURVNUX0RJUl9QQVRURVJOUykge1xuICAgICAgaWYgKHBhdHRlcm4udGVzdChyZWxhdGl2ZVBhdGgpIHx8IHBhdHRlcm4udGVzdChkaXJOYW1lKSkge1xuICAgICAgICByZXR1cm4ga2luZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYvmoYbmnrZcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0RnJhbWV3b3JrKGZ1bGxQYXRoOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIC8vIOagueaNruivreiogOajgOa1i+ahhuaetlxuICAgIGlmIChsYW5ndWFnZSA9PT0gJ1B5dGhvbicpIHtcbiAgICAgIHJldHVybiAncHl0ZXN0JzsgLy8g6buY6K6kIHB5dGVzdFxuICAgIH1cbiAgICBcbiAgICAvLyBUUy9KUyDlsJ3or5Xor7vlj5YgcGFja2FnZS5qc29uXG4gICAgaWYgKGxhbmd1YWdlID09PSAnVHlwZVNjcmlwdCcgfHwgbGFuZ3VhZ2UgPT09ICdKYXZhU2NyaXB0Jykge1xuICAgICAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZShmdWxsUGF0aCksICdwYWNrYWdlLmpzb24nKTtcbiAgICAgIFxuICAgICAgLy8g566A5Y2V5qOA5rWL77ya5p+l5om+5bi46KeB5qGG5p626YWN572u5paH5Lu2XG4gICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUoZnVsbFBhdGgpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGRpciwgJ3ZpdGVzdC5jb25maWcudHMnKSkpIHJldHVybiAnVml0ZXN0JztcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkaXIsICd2aXRlc3QuY29uZmlnLmpzJykpKSByZXR1cm4gJ1ZpdGVzdCc7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCAnamVzdC5jb25maWcuanMnKSkpIHJldHVybiAnSmVzdCc7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCAnamVzdC5jb25maWcudHMnKSkpIHJldHVybiAnSmVzdCc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5bnm7jlhbPmqKHlnZdcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFJlbGF0ZWRNb2R1bGVzKHJlbGF0aXZlUGF0aDogc3RyaW5nLCBraW5kOiBUZXN0S2luZCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBtb2R1bGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOS7jui3r+W+hOaPkOWPluaooeWdl+WQjVxuICAgIGNvbnN0IGRpck5hbWUgPSBwYXRoLmRpcm5hbWUocmVsYXRpdmVQYXRoKTtcbiAgICBjb25zdCBwYXJ0cyA9IGRpck5hbWUuc3BsaXQocGF0aC5zZXApO1xuICAgIFxuICAgIC8vIOafpeaJviBzcmMvYXBwL2xpYiDnrYnnm67lvZVcbiAgICBjb25zdCBzcmNJbmRleCA9IHBhcnRzLmZpbmRJbmRleChwID0+IFsnc3JjJywgJ2FwcCcsICdsaWInLCAncGFja2FnZXMnXS5pbmNsdWRlcyhwKSk7XG4gICAgaWYgKHNyY0luZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3QgbW9kdWxlUGFydHMgPSBwYXJ0cy5zbGljZShzcmNJbmRleCArIDEpO1xuICAgICAgaWYgKG1vZHVsZVBhcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbW9kdWxlcy5wdXNoKG1vZHVsZVBhcnRzLmpvaW4oJy8nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBtb2R1bGVzO1xuICB9XG4gIFxuICAvKipcbiAgICog6K6h566X572u5L+h5bqmXG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGF0ZUNvbmZpZGVuY2UocmVhc29uczogc3RyaW5nW10sIGZyYW1ld29yaz86IHN0cmluZyk6IG51bWJlciB7XG4gICAgbGV0IGNvbmZpZGVuY2UgPSAwLjU7XG4gICAgXG4gICAgaWYgKHJlYXNvbnMubGVuZ3RoID4gMCkgY29uZmlkZW5jZSArPSAwLjI7XG4gICAgaWYgKGZyYW1ld29yaykgY29uZmlkZW5jZSArPSAwLjI7XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKDEuMCwgY29uZmlkZW5jZSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bor63oqIBcbiAgICovXG4gIHByaXZhdGUgZ2V0TGFuZ3VhZ2UoZXh0OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBzd2l0Y2ggKGV4dCkge1xuICAgICAgY2FzZSAnLnRzJzpcbiAgICAgIGNhc2UgJy50c3gnOlxuICAgICAgICByZXR1cm4gJ1R5cGVTY3JpcHQnO1xuICAgICAgY2FzZSAnLmpzJzpcbiAgICAgIGNhc2UgJy5qc3gnOlxuICAgICAgICByZXR1cm4gJ0phdmFTY3JpcHQnO1xuICAgICAgY2FzZSAnLnB5JzpcbiAgICAgICAgcmV0dXJuICdQeXRob24nO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5bqU6K+l5o6S6ZmkXG4gICAqL1xuICBwcml2YXRlIHNob3VsZEV4Y2x1ZGUocmVsYXRpdmVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGNvbnN0IGRpciBvZiB0aGlzLmNvbmZpZy5leGNsdWRlRGlycykge1xuICAgICAgaWYgKHJlbGF0aXZlUGF0aC5pbmNsdWRlcyhkaXIpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65rWL6K+V5riF5Y2VXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkSW52ZW50b3J5KHJlcG9Sb290OiBzdHJpbmcsIHRlc3RzOiBUZXN0UmVmW10pOiBUZXN0SW52ZW50b3J5IHtcbiAgICBjb25zdCBieUtpbmQ6IFJlY29yZDxUZXN0S2luZCwgVGVzdFJlZltdPiA9IHtcbiAgICAgIHVuaXQ6IFtdLFxuICAgICAgaW50ZWdyYXRpb246IFtdLFxuICAgICAgZTJlOiBbXSxcbiAgICAgIHNtb2tlOiBbXSxcbiAgICAgIHVua25vd246IFtdLFxuICAgIH07XG4gICAgXG4gICAgY29uc3QgYnlGcmFtZXdvcms6IFJlY29yZDxzdHJpbmcsIFRlc3RSZWZbXT4gPSB7fTtcbiAgICBjb25zdCBieUxhbmd1YWdlOiBSZWNvcmQ8c3RyaW5nLCBUZXN0UmVmW10+ID0ge307XG4gICAgXG4gICAgZm9yIChjb25zdCB0ZXN0IG9mIHRlc3RzKSB7XG4gICAgICBieUtpbmRbdGVzdC5raW5kXS5wdXNoKHRlc3QpO1xuICAgICAgXG4gICAgICBpZiAodGVzdC5mcmFtZXdvcmspIHtcbiAgICAgICAgaWYgKCFieUZyYW1ld29ya1t0ZXN0LmZyYW1ld29ya10pIGJ5RnJhbWV3b3JrW3Rlc3QuZnJhbWV3b3JrXSA9IFtdO1xuICAgICAgICBieUZyYW1ld29ya1t0ZXN0LmZyYW1ld29ya10ucHVzaCh0ZXN0KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFieUxhbmd1YWdlW3Rlc3QubGFuZ3VhZ2VdKSBieUxhbmd1YWdlW3Rlc3QubGFuZ3VhZ2VdID0gW107XG4gICAgICBieUxhbmd1YWdlW3Rlc3QubGFuZ3VhZ2VdLnB1c2godGVzdCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICByZXBvUm9vdCxcbiAgICAgIHRlc3RzLFxuICAgICAgYnlLaW5kLFxuICAgICAgYnlGcmFtZXdvcmssXG4gICAgICBieUxhbmd1YWdlLFxuICAgICAgc3RhdHM6IHtcbiAgICAgICAgdG90YWw6IHRlc3RzLmxlbmd0aCxcbiAgICAgICAgYnlLaW5kOiB7XG4gICAgICAgICAgdW5pdDogYnlLaW5kLnVuaXQubGVuZ3RoLFxuICAgICAgICAgIGludGVncmF0aW9uOiBieUtpbmQuaW50ZWdyYXRpb24ubGVuZ3RoLFxuICAgICAgICAgIGUyZTogYnlLaW5kLmUyZS5sZW5ndGgsXG4gICAgICAgICAgc21va2U6IGJ5S2luZC5zbW9rZS5sZW5ndGgsXG4gICAgICAgICAgdW5rbm93bjogYnlLaW5kLnVua25vd24ubGVuZ3RoLFxuICAgICAgICB9LFxuICAgICAgICBieUZyYW1ld29yazogT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGJ5RnJhbWV3b3JrKS5tYXAoKFtrLCB2XSkgPT4gW2ssIHYubGVuZ3RoXSlcbiAgICAgICAgKSxcbiAgICAgIH0sXG4gICAgICBnZW5lcmF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uua1i+ivleWPkeeOsOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGVzdERpc2NvdmVyeShjb25maWc/OiBUZXN0RGlzY292ZXJ5Q29uZmlnKTogVGVzdERpc2NvdmVyeSB7XG4gIHJldHVybiBuZXcgVGVzdERpc2NvdmVyeShjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+WPkeeOsOa1i+ivlVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGlzY292ZXJUZXN0cyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxUZXN0SW52ZW50b3J5PiB7XG4gIGNvbnN0IGRpc2NvdmVyeSA9IG5ldyBUZXN0RGlzY292ZXJ5KCk7XG4gIHJldHVybiBhd2FpdCBkaXNjb3ZlcnkuZGlzY292ZXIocmVwb1Jvb3QpO1xufVxuIl19