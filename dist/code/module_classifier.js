"use strict";
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
exports.ModuleClassifier = void 0;
exports.createModuleClassifier = createModuleClassifier;
exports.classifyPath = classifyPath;
exports.getCategoryDescription = getCategoryDescription;
const path = __importStar(require("path"));
// ============================================================================
// 分类规则定义
// ============================================================================
const CLASSIFICATION_RULES = [
    // App
    {
        category: 'app',
        pathPatterns: ['src', 'app', 'apps', 'packages', 'services', 'functions'],
        filePatterns: ['main.*', 'index.*', 'app.*'],
        confidence: 0.8,
        description: 'Application code',
    },
    // Lib
    {
        category: 'lib',
        pathPatterns: ['lib', 'libs', 'packages', 'modules', 'shared', 'common', 'utils', 'core'],
        filePatterns: [],
        confidence: 0.7,
        description: 'Library code',
    },
    // Tests
    {
        category: 'tests',
        pathPatterns: ['test', 'tests', '__tests__', 'spec', 'specs', 'testing'],
        filePatterns: ['*.test.*', '*.spec.*', '*.test.*', 'test-*. *'],
        confidence: 0.95,
        description: 'Test code',
    },
    // Infra
    {
        category: 'infra',
        pathPatterns: ['infra', 'infrastructure', 'deploy', 'deployment', 'k8s', 'kubernetes', 'docker', '.github', '.gitlab', 'terraform', 'ansible'],
        filePatterns: ['Dockerfile*', 'docker-compose.*', '*.tf', '*.yaml', '*.yml'],
        confidence: 0.85,
        description: 'Infrastructure code',
    },
    // Scripts
    {
        category: 'scripts',
        pathPatterns: ['scripts', 'bin', 'tools', 'task', 'tasks'],
        filePatterns: ['*.sh', '*.bash', '*.ps1', '*.bat'],
        confidence: 0.8,
        description: 'Scripts and tools',
    },
    // Docs
    {
        category: 'docs',
        pathPatterns: ['doc', 'docs', 'documentation', 'wiki', 'md', 'manual'],
        filePatterns: ['*.md', '*.rst', '*.txt', 'CHANGELOG*', 'HISTORY*'],
        confidence: 0.75,
        description: 'Documentation',
    },
    // Config
    {
        category: 'config',
        pathPatterns: ['config', 'configs', 'conf', 'settings', '.config'],
        filePatterns: ['*.config.*', '*.conf', '*.ini', '*.toml', '.env*', 'settings.*'],
        confidence: 0.85,
        description: 'Configuration files',
    },
];
// ============================================================================
// 模块分类器
// ============================================================================
class ModuleClassifier {
    constructor(config = {}) {
        this.config = {
            minConfidence: config.minConfidence ?? 0.5,
        };
    }
    /**
     * 分类路径
     */
    classify(filePath, repoRoot = '') {
        const relativePath = path.relative(repoRoot, filePath);
        const normalizedPath = relativePath.replace(/\\/g, '/');
        const fileName = path.basename(filePath);
        const dirName = path.dirname(normalizedPath);
        const matches = [];
        // 检查每个规则
        for (const rule of CLASSIFICATION_RULES) {
            const pathMatch = this.checkPathMatch(normalizedPath, dirName, rule);
            const fileMatch = this.checkFileMatch(fileName, rule);
            if (pathMatch || fileMatch) {
                matches.push({
                    path: filePath,
                    category: rule.category,
                    confidence: rule.confidence,
                    reasons: [
                        ...(pathMatch ? [pathMatch] : []),
                        ...(fileMatch ? [fileMatch] : []),
                    ],
                });
            }
        }
        // 返回最高置信度的匹配
        if (matches.length > 0) {
            matches.sort((a, b) => b.confidence - a.confidence);
            return matches[0];
        }
        // 无匹配 → unknown
        return {
            path: filePath,
            category: 'unknown',
            confidence: 0,
            reasons: ['No matching classification rule'],
        };
    }
    /**
     * 批量分类
     */
    classifyMany(paths, repoRoot = '') {
        return paths.map(p => this.classify(p, repoRoot));
    }
    /**
     * 分类目录
     */
    classifyDirectory(dirPath, repoRoot = '') {
        const dirName = path.basename(dirPath);
        const relativePath = path.relative(repoRoot, dirPath).replace(/\\/g, '/');
        // 检查路径模式
        for (const rule of CLASSIFICATION_RULES) {
            for (const pattern of rule.pathPatterns) {
                if (this.matchesPattern(dirName, pattern) || relativePath.includes(`/${pattern}/`)) {
                    return {
                        path: dirPath,
                        category: rule.category,
                        confidence: rule.confidence,
                        reasons: [`Directory name matches pattern: ${pattern}`],
                    };
                }
            }
        }
        return {
            path: dirPath,
            category: 'unknown',
            confidence: 0,
            reasons: ['No matching directory pattern'],
        };
    }
    /**
     * 构建重要路径分类
     */
    buildImportantPaths(paths, repoRoot) {
        const result = {
            app: [],
            lib: [],
            tests: [],
            infra: [],
            scripts: [],
            docs: [],
            configs: [],
        };
        for (const p of paths) {
            const classification = this.classify(p, repoRoot);
            switch (classification.category) {
                case 'app':
                    result.app.push(p);
                    break;
                case 'lib':
                    result.lib.push(p);
                    break;
                case 'tests':
                    result.tests.push(p);
                    break;
                case 'infra':
                    result.infra.push(p);
                    break;
                case 'scripts':
                    result.scripts.push(p);
                    break;
                case 'docs':
                    result.docs.push(p);
                    break;
                case 'config':
                    result.configs.push(p);
                    break;
            }
        }
        return result;
    }
    /**
     * 获取分类描述
     */
    getCategoryDescription(category) {
        const rule = CLASSIFICATION_RULES.find(r => r.category === category);
        return rule?.description || 'Unknown category';
    }
    /**
     * 获取所有分类
     */
    getAllCategories() {
        return CLASSIFICATION_RULES.map(r => r.category);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 检查路径匹配
     */
    checkPathMatch(normalizedPath, dirName, rule) {
        for (const pattern of rule.pathPatterns) {
            if (this.matchesPattern(dirName, pattern) || normalizedPath.includes(`/${pattern}/`)) {
                return `Path matches pattern: ${pattern}`;
            }
        }
        return null;
    }
    /**
     * 检查文件匹配
     */
    checkFileMatch(fileName, rule) {
        for (const pattern of rule.filePatterns) {
            if (this.matchesPattern(fileName, pattern)) {
                return `File matches pattern: ${pattern}`;
            }
        }
        return null;
    }
    /**
     * 检查模式匹配
     */
    matchesPattern(name, pattern) {
        // 精确匹配
        if (name === pattern)
            return true;
        // 通配符匹配 (*.xxx)
        if (pattern.startsWith('*')) {
            const extension = pattern.slice(1);
            return name.endsWith(extension);
        }
        // 前缀匹配 (test-*)
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return name.startsWith(prefix);
        }
        // 包含匹配
        if (name.toLowerCase().includes(pattern.toLowerCase())) {
            return true;
        }
        return false;
    }
}
exports.ModuleClassifier = ModuleClassifier;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建模块分类器
 */
function createModuleClassifier(config) {
    return new ModuleClassifier(config);
}
/**
 * 快速分类路径
 */
function classifyPath(filePath, repoRoot) {
    const classifier = new ModuleClassifier();
    return classifier.classify(filePath, repoRoot);
}
/**
 * 获取分类描述
 */
function getCategoryDescription(category) {
    const classifier = new ModuleClassifier();
    return classifier.getCategoryDescription(category);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlX2NsYXNzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS9tb2R1bGVfY2xhc3NpZmllci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNFVILHdEQUVDO0FBS0Qsb0NBR0M7QUFLRCx3REFHQztBQTVWRCwyQ0FBNkI7QUFtQzdCLCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FLE1BQU0sb0JBQW9CLEdBQXlCO0lBQ2pELE1BQU07SUFDTjtRQUNFLFFBQVEsRUFBRSxLQUFLO1FBQ2YsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7UUFDekUsWUFBWSxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUM7UUFDNUMsVUFBVSxFQUFFLEdBQUc7UUFDZixXQUFXLEVBQUUsa0JBQWtCO0tBQ2hDO0lBRUQsTUFBTTtJQUNOO1FBQ0UsUUFBUSxFQUFFLEtBQUs7UUFDZixZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQ3pGLFlBQVksRUFBRSxFQUFFO1FBQ2hCLFVBQVUsRUFBRSxHQUFHO1FBQ2YsV0FBVyxFQUFFLGNBQWM7S0FDNUI7SUFFRCxRQUFRO0lBQ1I7UUFDRSxRQUFRLEVBQUUsT0FBTztRQUNqQixZQUFZLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQztRQUN4RSxZQUFZLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7UUFDL0QsVUFB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bEMsQ0FBQztRQUVELGdCQUFnQjtRQUNoQixJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMxQixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsT0FBTztRQUNQLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3ZELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBck5ELDRDQXFOQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0Isc0JBQXNCLENBQUMsTUFBeUI7SUFDOUQsT0FBTyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLFlBQVksQ0FBQyxRQUFnQixFQUFFLFFBQWlCO0lBQzlELE1BQU0sVUFBVSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztJQUMxQyxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHNCQUFzQixDQUFDLFFBQXdCO0lBQzdELE1BQU0sVUFBVSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztJQUMxQyxPQUFPLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNb2R1bGUgQ2xhc3NpZmllciAtIOaooeWdl+WIhuexu+WZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOaMiei3r+W+hC/mlofku7blkI3liIbnsbvnm67lvZVcbiAqIDIuIOivhuWIqyBhcHAgLyBsaWIgLyB0ZXN0cyAvIGluZnJhIC8gc2NyaXB0cyAvIGRvY3MgLyBjb25maWdcbiAqIDMuIOi+k+WHuuWIhuexu+e9ruS/oeW6plxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBNb2R1bGVDYXRlZ29yeSwgTW9kdWxlQ2xhc3NpZmljYXRpb24sIEltcG9ydGFudFBhdGhzIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIhuexu+WZqOmFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzaWZpZXJDb25maWcge1xuICAvKiog5pyA5bCP572u5L+h5bqm6ZiI5YC8ICovXG4gIG1pbkNvbmZpZGVuY2U/OiBudW1iZXI7XG59XG5cbi8qKlxuICog5YiG57G76KeE5YiZXG4gKi9cbmludGVyZmFjZSBDbGFzc2lmaWNhdGlvblJ1bGUge1xuICAvKiog5YiG57G7ICovXG4gIGNhdGVnb3J5OiBNb2R1bGVDYXRlZ29yeTtcbiAgXG4gIC8qKiDot6/lvoTmqKHlvI8gKi9cbiAgcGF0aFBhdHRlcm5zOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDmlofku7bmqKHlvI8gKi9cbiAgZmlsZVBhdHRlcm5zOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDnva7kv6HluqYgKi9cbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICBcbiAgLyoqIOaPj+i/sCAqL1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDliIbnsbvop4TliJnlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgQ0xBU1NJRklDQVRJT05fUlVMRVM6IENsYXNzaWZpY2F0aW9uUnVsZVtdID0gW1xuICAvLyBBcHBcbiAge1xuICAgIGNhdGVnb3J5OiAnYXBwJyxcbiAgICBwYXRoUGF0dGVybnM6IFsnc3JjJywgJ2FwcCcsICdhcHBzJywgJ3BhY2thZ2VzJywgJ3NlcnZpY2VzJywgJ2Z1bmN0aW9ucyddLFxuICAgIGZpbGVQYXR0ZXJuczogWydtYWluLionLCAnaW5kZXguKicsICdhcHAuKiddLFxuICAgIGNvbmZpZGVuY2U6IDAuOCxcbiAgICBkZXNjcmlwdGlvbjogJ0FwcGxpY2F0aW9uIGNvZGUnLFxuICB9LFxuICBcbiAgLy8gTGliXG4gIHtcbiAgICBjYXRlZ29yeTogJ2xpYicsXG4gICAgcGF0aFBhdHRlcm5zOiBbJ2xpYicsICdsaWJzJywgJ3BhY2thZ2VzJywgJ21vZHVsZXMnLCAnc2hhcmVkJywgJ2NvbW1vbicsICd1dGlscycsICdjb3JlJ10sXG4gICAgZmlsZVBhdHRlcm5zOiBbXSxcbiAgICBjb25maWRlbmNlOiAwLjcsXG4gICAgZGVzY3JpcHRpb246ICdMaWJyYXJ5IGNvZGUnLFxuICB9LFxuICBcbiAgLy8gVGVzdHNcbiAge1xuICAgIGNhdGVnb3J5OiAndGVzdHMnLFxuICAgIHBhdGhQYXR0ZXJuczogWyd0ZXN0JywgJ3Rlc3RzJywgJ19fdGVzdHNfXycsICdzcGVjJywgJ3NwZWNzJywgJ3Rlc3RpbmcnXSxcbiAgICBmaWxlUGF0dGVybnM6IFsnKi50ZXN0LionLCAnKi5zcGVjLionLCAnKi50ZXN0LionLCAndGVzdC0qLiAqJ10sXG4gICAgY29uZmlkZW5jZTogMC45NSxcbiAgICBkZXNjcmlwdGlvbjogJ1Rlc3QgY29kZScsXG4gIH0sXG4gIFxuICAvLyBJbmZyYVxuICB7XG4gICAgY2F0ZWdvcnk6ICdpbmZyYScsXG4gICAgcGF0aFBhdHRlcm5zOiBbJ2luZnJhJywgJ2luZnJhc3RydWN0dXJlJywgJ2RlcGxveScsICdkZXBsb3ltZW50JywgJ2s4cycsICdrdWJlcm5ldGVzJywgJ2RvY2tlcicsICcuZ2l0aHViJywgJy5naXRsYWInLCAndGVycmFmb3JtJywgJ2Fuc2libGUnXSxcbiAgICBmaWxlUGF0dGVybnM6IFsnRG9ja2VyZmlsZSonLCAnZG9ja2VyLWNvbXBvc2UuKicsICcqLnRmJywgJyoueWFtbCcsICcqLnltbCddLFxuICAgIGNvbmZpZGVuY2U6IDAuODUsXG4gICAgZGVzY3JpcHRpb246ICdJbmZyYXN0cnVjdHVyZSBjb2RlJyxcbiAgfSxcbiAgXG4gIC8vIFNjcmlwdHNcbiAge1xuICAgIGNhdGVnb3J5OiAnc2NyaXB0cycsXG4gICAgcGF0aFBhdHRlcm5zOiBbJ3NjcmlwdHMnLCAnYmluJywgJ3Rvb2xzJywgJ3Rhc2snLCAndGFza3MnXSxcbiAgICBmaWxlUGF0dGVybnM6IFsnKi5zaCcsICcqLmJhc2gnLCAnKi5wczEnLCAnKi5iYXQnXSxcbiAgICBjb25maWRlbmNlOiAwLjgsXG4gICAgZGVzY3JpcHRpb246ICdTY3JpcHRzIGFuZCB0b29scycsXG4gIH0sXG4gIFxuICAvLyBEb2NzXG4gIHtcbiAgICBjYXRlZ29yeTogJ2RvY3MnLFxuICAgIHBhdGhQYXR0ZXJuczogWydkb2MnLCAnZG9jcycsICdkb2N1bWVudGF0aW9uJywgJ3dpa2knLCAnbWQnLCAnbWFudWFsJ10sXG4gICAgZmlsZVBhdHRlcm5zOiBbJyoubWQnLCAnKi5yc3QnLCAnKi50eHQnLCAnQ0hBTkdFTE9HKicsICdISVNUT1JZKiddLFxuICAgIGNvbmZpZGVuY2U6IDAuNzUsXG4gICAgZGVzY3JpcHRpb246ICdEb2N1bWVudGF0aW9uJyxcbiAgfSxcbiAgXG4gIC8vIENvbmZpZ1xuICB7XG4gICAgY2F0ZWdvcnk6ICdjb25maWcnLFxuICAgIHBhdGhQYXR0ZXJuczogWydjb25maWcnLCAnY29uZmlncycsICdjb25mJywgJ3NldHRpbmdzJywgJy5jb25maWcnXSxcbiAgICBmaWxlUGF0dGVybnM6IFsnKi5jb25maWcuKicsICcqLmNvbmYnLCAnKi5pbmknLCAnKi50b21sJywgJy5lbnYqJywgJ3NldHRpbmdzLionXSxcbiAgICBjb25maWRlbmNlOiAwLjg1LFxuICAgIGRlc2NyaXB0aW9uOiAnQ29uZmlndXJhdGlvbiBmaWxlcycsXG4gIH0sXG5dO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmqKHlnZfliIbnsbvlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIE1vZHVsZUNsYXNzaWZpZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q2xhc3NpZmllckNvbmZpZz47XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IENsYXNzaWZpZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgbWluQ29uZmlkZW5jZTogY29uZmlnLm1pbkNvbmZpZGVuY2UgPz8gMC41LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliIbnsbvot6/lvoRcbiAgICovXG4gIGNsYXNzaWZ5KGZpbGVQYXRoOiBzdHJpbmcsIHJlcG9Sb290OiBzdHJpbmcgPSAnJyk6IE1vZHVsZUNsYXNzaWZpY2F0aW9uIHtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBwYXRoLnJlbGF0aXZlKHJlcG9Sb290LCBmaWxlUGF0aCk7XG4gICAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSByZWxhdGl2ZVBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgY29uc3QgZGlyTmFtZSA9IHBhdGguZGlybmFtZShub3JtYWxpemVkUGF0aCk7XG4gICAgXG4gICAgY29uc3QgbWF0Y2hlczogTW9kdWxlQ2xhc3NpZmljYXRpb25bXSA9IFtdO1xuICAgIFxuICAgIC8vIOajgOafpeavj+S4quinhOWImVxuICAgIGZvciAoY29uc3QgcnVsZSBvZiBDTEFTU0lGSUNBVElPTl9SVUxFUykge1xuICAgICAgY29uc3QgcGF0aE1hdGNoID0gdGhpcy5jaGVja1BhdGhNYXRjaChub3JtYWxpemVkUGF0aCwgZGlyTmFtZSwgcnVsZSk7XG4gICAgICBjb25zdCBmaWxlTWF0Y2ggPSB0aGlzLmNoZWNrRmlsZU1hdGNoKGZpbGVOYW1lLCBydWxlKTtcbiAgICAgIFxuICAgICAgaWYgKHBhdGhNYXRjaCB8fCBmaWxlTWF0Y2gpIHtcbiAgICAgICAgbWF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICBjYXRlZ29yeTogcnVsZS5jYXRlZ29yeSxcbiAgICAgICAgICBjb25maWRlbmNlOiBydWxlLmNvbmZpZGVuY2UsXG4gICAgICAgICAgcmVhc29uczogW1xuICAgICAgICAgICAgLi4uKHBhdGhNYXRjaCA/IFtwYXRoTWF0Y2hdIDogW10pLFxuICAgICAgICAgICAgLi4uKGZpbGVNYXRjaCA/IFtmaWxlTWF0Y2hdIDogW10pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDov5Tlm57mnIDpq5jnva7kv6HluqbnmoTljLnphY1cbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBtYXRjaGVzLnNvcnQoKGEsIGIpID0+IGIuY29uZmlkZW5jZSAtIGEuY29uZmlkZW5jZSk7XG4gICAgICByZXR1cm4gbWF0Y2hlc1swXTtcbiAgICB9XG4gICAgXG4gICAgLy8g5peg5Yy56YWNIOKGkiB1bmtub3duXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhdGg6IGZpbGVQYXRoLFxuICAgICAgY2F0ZWdvcnk6ICd1bmtub3duJyxcbiAgICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgICByZWFzb25zOiBbJ05vIG1hdGNoaW5nIGNsYXNzaWZpY2F0aW9uIHJ1bGUnXSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5om56YeP5YiG57G7XG4gICAqL1xuICBjbGFzc2lmeU1hbnkocGF0aHM6IHN0cmluZ1tdLCByZXBvUm9vdDogc3RyaW5nID0gJycpOiBNb2R1bGVDbGFzc2lmaWNhdGlvbltdIHtcbiAgICByZXR1cm4gcGF0aHMubWFwKHAgPT4gdGhpcy5jbGFzc2lmeShwLCByZXBvUm9vdCkpO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG57G755uu5b2VXG4gICAqL1xuICBjbGFzc2lmeURpcmVjdG9yeShkaXJQYXRoOiBzdHJpbmcsIHJlcG9Sb290OiBzdHJpbmcgPSAnJyk6IE1vZHVsZUNsYXNzaWZpY2F0aW9uIHtcbiAgICBjb25zdCBkaXJOYW1lID0gcGF0aC5iYXNlbmFtZShkaXJQYXRoKTtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBwYXRoLnJlbGF0aXZlKHJlcG9Sb290LCBkaXJQYXRoKS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgXG4gICAgLy8g5qOA5p+l6Lev5b6E5qih5byPXG4gICAgZm9yIChjb25zdCBydWxlIG9mIENMQVNTSUZJQ0FUSU9OX1JVTEVTKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcnVsZS5wYXRoUGF0dGVybnMpIHtcbiAgICAgICAgaWYgKHRoaXMubWF0Y2hlc1BhdHRlcm4oZGlyTmFtZSwgcGF0dGVybikgfHwgcmVsYXRpdmVQYXRoLmluY2x1ZGVzKGAvJHtwYXR0ZXJufS9gKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBkaXJQYXRoLFxuICAgICAgICAgICAgY2F0ZWdvcnk6IHJ1bGUuY2F0ZWdvcnksXG4gICAgICAgICAgICBjb25maWRlbmNlOiBydWxlLmNvbmZpZGVuY2UsXG4gICAgICAgICAgICByZWFzb25zOiBbYERpcmVjdG9yeSBuYW1lIG1hdGNoZXMgcGF0dGVybjogJHtwYXR0ZXJufWBdLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhdGg6IGRpclBhdGgsXG4gICAgICBjYXRlZ29yeTogJ3Vua25vd24nLFxuICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgIHJlYXNvbnM6IFsnTm8gbWF0Y2hpbmcgZGlyZWN0b3J5IHBhdHRlcm4nXSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66YeN6KaB6Lev5b6E5YiG57G7XG4gICAqL1xuICBidWlsZEltcG9ydGFudFBhdGhzKFxuICAgIHBhdGhzOiBzdHJpbmdbXSxcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IEltcG9ydGFudFBhdGhzIHtcbiAgICBjb25zdCByZXN1bHQ6IEltcG9ydGFudFBhdGhzID0ge1xuICAgICAgYXBwOiBbXSxcbiAgICAgIGxpYjogW10sXG4gICAgICB0ZXN0czogW10sXG4gICAgICBpbmZyYTogW10sXG4gICAgICBzY3JpcHRzOiBbXSxcbiAgICAgIGRvY3M6IFtdLFxuICAgICAgY29uZmlnczogW10sXG4gICAgfTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHAgb2YgcGF0aHMpIHtcbiAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uID0gdGhpcy5jbGFzc2lmeShwLCByZXBvUm9vdCk7XG4gICAgICBcbiAgICAgIHN3aXRjaCAoY2xhc3NpZmljYXRpb24uY2F0ZWdvcnkpIHtcbiAgICAgICAgY2FzZSAnYXBwJzpcbiAgICAgICAgICByZXN1bHQuYXBwLnB1c2gocCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2xpYic6XG4gICAgICAgICAgcmVzdWx0LmxpYi5wdXNoKHApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0ZXN0cyc6XG4gICAgICAgICAgcmVzdWx0LnRlc3RzLnB1c2gocCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2luZnJhJzpcbiAgICAgICAgICByZXN1bHQuaW5mcmEucHVzaChwKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2NyaXB0cyc6XG4gICAgICAgICAgcmVzdWx0LnNjcmlwdHMucHVzaChwKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZG9jcyc6XG4gICAgICAgICAgcmVzdWx0LmRvY3MucHVzaChwKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY29uZmlnJzpcbiAgICAgICAgICByZXN1bHQuY29uZmlncy5wdXNoKHApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5YiG57G75o+P6L+wXG4gICAqL1xuICBnZXRDYXRlZ29yeURlc2NyaXB0aW9uKGNhdGVnb3J5OiBNb2R1bGVDYXRlZ29yeSk6IHN0cmluZyB7XG4gICAgY29uc3QgcnVsZSA9IENMQVNTSUZJQ0FUSU9OX1JVTEVTLmZpbmQociA9PiByLmNhdGVnb3J5ID09PSBjYXRlZ29yeSk7XG4gICAgcmV0dXJuIHJ1bGU/LmRlc2NyaXB0aW9uIHx8ICdVbmtub3duIGNhdGVnb3J5JztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluaJgOacieWIhuexu1xuICAgKi9cbiAgZ2V0QWxsQ2F0ZWdvcmllcygpOiBNb2R1bGVDYXRlZ29yeVtdIHtcbiAgICByZXR1cm4gQ0xBU1NJRklDQVRJT05fUlVMRVMubWFwKHIgPT4gci5jYXRlZ29yeSk7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6Xot6/lvoTljLnphY1cbiAgICovXG4gIHByaXZhdGUgY2hlY2tQYXRoTWF0Y2goXG4gICAgbm9ybWFsaXplZFBhdGg6IHN0cmluZyxcbiAgICBkaXJOYW1lOiBzdHJpbmcsXG4gICAgcnVsZTogQ2xhc3NpZmljYXRpb25SdWxlXG4gICk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBydWxlLnBhdGhQYXR0ZXJucykge1xuICAgICAgaWYgKHRoaXMubWF0Y2hlc1BhdHRlcm4oZGlyTmFtZSwgcGF0dGVybikgfHwgbm9ybWFsaXplZFBhdGguaW5jbHVkZXMoYC8ke3BhdHRlcm59L2ApKSB7XG4gICAgICAgIHJldHVybiBgUGF0aCBtYXRjaGVzIHBhdHRlcm46ICR7cGF0dGVybn1gO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpeaWh+S7tuWMuemFjVxuICAgKi9cbiAgcHJpdmF0ZSBjaGVja0ZpbGVNYXRjaChcbiAgICBmaWxlTmFtZTogc3RyaW5nLFxuICAgIHJ1bGU6IENsYXNzaWZpY2F0aW9uUnVsZVxuICApOiBzdHJpbmcgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcnVsZS5maWxlUGF0dGVybnMpIHtcbiAgICAgIGlmICh0aGlzLm1hdGNoZXNQYXR0ZXJuKGZpbGVOYW1lLCBwYXR0ZXJuKSkge1xuICAgICAgICByZXR1cm4gYEZpbGUgbWF0Y2hlcyBwYXR0ZXJuOiAke3BhdHRlcm59YDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmqKHlvI/ljLnphY1cbiAgICovXG4gIHByaXZhdGUgbWF0Y2hlc1BhdHRlcm4obmFtZTogc3RyaW5nLCBwYXR0ZXJuOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyDnsr7noa7ljLnphY1cbiAgICBpZiAobmFtZSA9PT0gcGF0dGVybikgcmV0dXJuIHRydWU7XG4gICAgXG4gICAgLy8g6YCa6YWN56ym5Yy56YWNICgqLnh4eClcbiAgICBpZiAocGF0dGVybi5zdGFydHNXaXRoKCcqJykpIHtcbiAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdHRlcm4uc2xpY2UoMSk7XG4gICAgICByZXR1cm4gbmFtZS5lbmRzV2l0aChleHRlbnNpb24pO1xuICAgIH1cbiAgICBcbiAgICAvLyDliY3nvIDljLnphY0gKHRlc3QtKilcbiAgICBpZiAocGF0dGVybi5lbmRzV2l0aCgnKicpKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnNsaWNlKDAsIC0xKTtcbiAgICAgIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgocHJlZml4KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5YyF5ZCr5Yy56YWNXG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuaooeWdl+WIhuexu+WZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW9kdWxlQ2xhc3NpZmllcihjb25maWc/OiBDbGFzc2lmaWVyQ29uZmlnKTogTW9kdWxlQ2xhc3NpZmllciB7XG4gIHJldHVybiBuZXcgTW9kdWxlQ2xhc3NpZmllcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+WIhuexu+i3r+W+hFxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NpZnlQYXRoKGZpbGVQYXRoOiBzdHJpbmcsIHJlcG9Sb290Pzogc3RyaW5nKTogTW9kdWxlQ2xhc3NpZmljYXRpb24ge1xuICBjb25zdCBjbGFzc2lmaWVyID0gbmV3IE1vZHVsZUNsYXNzaWZpZXIoKTtcbiAgcmV0dXJuIGNsYXNzaWZpZXIuY2xhc3NpZnkoZmlsZVBhdGgsIHJlcG9Sb290KTtcbn1cblxuLyoqXG4gKiDojrflj5bliIbnsbvmj4/ov7BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldENhdGVnb3J5RGVzY3JpcHRpb24oY2F0ZWdvcnk6IE1vZHVsZUNhdGVnb3J5KTogc3RyaW5nIHtcbiAgY29uc3QgY2xhc3NpZmllciA9IG5ldyBNb2R1bGVDbGFzc2lmaWVyKCk7XG4gIHJldHVybiBjbGFzc2lmaWVyLmdldENhdGVnb3J5RGVzY3JpcHRpb24oY2F0ZWdvcnkpO1xufVxuIl19