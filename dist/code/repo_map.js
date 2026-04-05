"use strict";
/**
 * Repo Map - 仓库地图生成器
 *
 * 职责：
 * 1. 生成目录拓扑
 * 2. 标记核心模块
 * 3. 按分类归档
 * 4. 语言分布统计
 * 5. 重要配置文件识别
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
exports.RepoMapGenerator = void 0;
exports.createRepoMapGenerator = createRepoMapGenerator;
exports.generateRepoMap = generateRepoMap;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const module_classifier_1 = require("./module_classifier");
// ============================================================================
// 重要文件模式
// ============================================================================
const IMPORTANT_FILE_PATTERNS = [
    // Package manifests
    { pattern: 'package.json', type: 'package_manifest', description: 'Node.js package manifest' },
    { pattern: 'pyproject.toml', type: 'package_manifest', description: 'Python project configuration' },
    { pattern: 'Cargo.toml', type: 'package_manifest', description: 'Rust package manifest' },
    { pattern: 'go.mod', type: 'package_manifest', description: 'Go module definition' },
    { pattern: 'pom.xml', type: 'package_manifest', description: 'Maven project configuration' },
    { pattern: 'build.gradle', type: 'package_manifest', description: 'Gradle build configuration' },
    { pattern: 'Gemfile', type: 'package_manifest', description: 'Ruby dependencies' },
    { pattern: 'composer.json', type: 'package_manifest', description: 'PHP package manifest' },
    // Configs
    { pattern: 'tsconfig.json', type: 'config', description: 'TypeScript configuration' },
    { pattern: 'vite.config.ts', type: 'config', description: 'Vite configuration' },
    { pattern: 'vite.config.js', type: 'config', description: 'Vite configuration' },
    { pattern: 'next.config.js', type: 'config', description: 'Next.js configuration' },
    { pattern: 'webpack.config.js', type: 'config', description: 'Webpack configuration' },
    { pattern: 'jest.config.js', type: 'config', description: 'Jest configuration' },
    { pattern: 'eslint.config.*', type: 'config', description: 'ESLint configuration' },
    { pattern: '.eslintrc.*', type: 'config', description: 'ESLint configuration' },
    { pattern: 'prettier.config.*', type: 'config', description: 'Prettier configuration' },
    { pattern: 'babel.config.*', type: 'config', description: 'Babel configuration' },
    // Entrypoints
    { pattern: 'main.ts', type: 'entrypoint', description: 'TypeScript entry point' },
    { pattern: 'main.js', type: 'entrypoint', description: 'JavaScript entry point' },
    { pattern: 'main.py', type: 'entrypoint', description: 'Python entry point' },
    { pattern: 'index.ts', type: 'entrypoint', description: 'TypeScript index' },
    { pattern: 'index.js', type: 'entrypoint', description: 'JavaScript index' },
    { pattern: 'app.py', type: 'entrypoint', description: 'Python app entry' },
    { pattern: 'manage.py', type: 'entrypoint', description: 'Django management' },
    // Test configs
    { pattern: 'pytest.ini', type: 'test_config', description: 'pytest configuration' },
    { pattern: 'tox.ini', type: 'test_config', description: 'tox configuration' },
    { pattern: 'vitest.config.*', type: 'test_config', description: 'Vitest configuration' },
    // Build configs
    { pattern: 'Makefile', type: 'build_config', description: 'Make build configuration' },
    { pattern: 'CMakeLists.txt', type: 'build_config', description: 'CMake configuration' },
    // Env
    { pattern: '.env.example', type: 'env_example', description: 'Environment example' },
    { pattern: '.env.template', type: 'env_example', description: 'Environment template' },
    // Docs
    { pattern: 'README.md', type: 'readme', description: 'Project readme' },
    { pattern: 'README.rst', type: 'readme', description: 'Project readme' },
    { pattern: 'CHANGELOG.md', type: 'readme', description: 'Changelog' },
    { pattern: 'CONTRIBUTING.md', type: 'readme', description: 'Contributing guide' },
    // License
    { pattern: 'LICENSE', type: 'license', description: 'License file' },
    { pattern: 'LICENSE.md', type: 'license', description: 'License file' },
    { pattern: 'LICENSE.txt', type: 'license', description: 'License file' },
    // Gitignore
    { pattern: '.gitignore', type: 'gitignore', description: 'Git ignore patterns' },
];
// ============================================================================
// 仓库地图生成器
// ============================================================================
class RepoMapGenerator {
    constructor(config = {}) {
        this.config = {
            maxDepth: config.maxDepth ?? 3,
            excludeDirs: config.excludeDirs ?? [
                'node_modules',
                '__pycache__',
                '.git',
                '.svn',
                'vendor',
                'dist',
                'build',
                'coverage',
                '.next',
                '.nuxt',
                '.cache',
                'venv',
                '.venv',
                'env',
                '.env',
            ],
            excludeFiles: config.excludeFiles ?? [
                '*.log',
                '*.lock',
                '*.pyc',
                '*.pyo',
                '*.class',
                '*.o',
                '*.so',
                '*.dll',
                '*.exe',
                '*.bin',
            ],
            includeHidden: config.includeHidden ?? false,
        };
        this.classifier = new module_classifier_1.ModuleClassifier();
    }
    /**
     * 生成仓库地图
     */
    async generate(repoRoot) {
        // 扫描目录
        const topLevelDirs = await this.scanTopLevelDirectories(repoRoot);
        // 识别关键目录
        const keyDirectories = await this.identifyKeyDirectories(repoRoot, topLevelDirs);
        // 统计语言分布
        const languageDistribution = await this.analyzeLanguageDistribution(repoRoot);
        // 识别重要文件
        const importantFiles = await this.identifyImportantFiles(repoRoot);
        // 发现入口候选
        const entrypointCandidates = await this.discoverEntrypointCandidates(repoRoot);
        return {
            repoRoot,
            topLevelDirs,
            keyDirectories,
            languageDistribution,
            importantFiles,
            entrypointCandidates,
            generatedAt: Date.now(),
        };
    }
    /**
     * 扫描顶层目录
     */
    async scanTopLevelDirectories(repoRoot) {
        const entries = await fs.readdir(repoRoot, { withFileTypes: true });
        const dirs = [];
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (this.config.excludeDirs.includes(entry.name))
                continue;
            if (!this.config.includeHidden && entry.name.startsWith('.'))
                continue;
            const dirPath = path.join(repoRoot, entry.name);
            const classification = this.classifier.classifyDirectory(dirPath, repoRoot);
            const node = {
                name: entry.name,
                path: entry.name,
                category: classification.category !== 'unknown' ? classification.category : undefined,
                children: [],
                fileCount: 0,
            };
            // 统计文件数（第一层）
            try {
                const subEntries = await fs.readdir(dirPath, { withFileTypes: true });
                node.fileCount = subEntries.filter(e => e.isFile()).length;
            }
            catch {
                // 忽略错误
            }
            dirs.push(node);
        }
        // 按名称排序
        dirs.sort((a, b) => a.name.localeCompare(b.name));
        return dirs;
    }
    /**
     * 识别关键目录
     */
    async identifyKeyDirectories(repoRoot, topLevelDirs) {
        const keyDirs = [];
        // 关键目录模式
        const keyDirPatterns = [
            { patterns: ['src', 'app', 'apps'], category: 'app', importance: 'critical', description: 'Main application code' },
            { patterns: ['lib', 'libs', 'packages'], category: 'lib', importance: 'critical', description: 'Library code' },
            { patterns: ['test', 'tests', '__tests__', 'spec'], category: 'tests', importance: 'important', description: 'Test code' },
            { patterns: ['docs', 'doc', 'documentation'], category: 'docs', importance: 'normal', description: 'Documentation' },
            { patterns: ['scripts', 'bin', 'tools'], category: 'scripts', importance: 'normal', description: 'Scripts and tools' },
            { patterns: ['config', 'configs', '.github', '.gitlab'], category: 'infra', importance: 'important', description: 'Configuration and CI/CD' },
            { patterns: ['infra', 'deploy', 'k8s', 'docker'], category: 'infra', importance: 'important', description: 'Infrastructure code' },
        ];
        for (const dir of topLevelDirs) {
            for (const { patterns, category, importance, description } of keyDirPatterns) {
                if (patterns.includes(dir.name)) {
                    keyDirs.push({
                        path: dir.path,
                        category: category,
                        importance,
                        description,
                    });
                    break;
                }
            }
        }
        // 按重要性排序
        const importanceOrder = { critical: 0, important: 1, normal: 2 };
        keyDirs.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);
        return keyDirs;
    }
    /**
     * 分析语言分布
     */
    async analyzeLanguageDistribution(repoRoot) {
        const byExtension = {};
        const byLanguage = {};
        let totalFiles = 0;
        // 语言映射
        const languageMap = {
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.rs': 'Rust',
            '.go': 'Go',
            '.java': 'Java',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.c': 'C',
            '.cpp': 'C++',
            '.h': 'C/C++',
            '.hpp': 'C++',
            '.cs': 'C#',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.sh': 'Shell',
            '.bash': 'Shell',
            '.zsh': 'Shell',
            '.md': 'Markdown',
            '.rst': 'reStructuredText',
            '.json': 'JSON',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.toml': 'TOML',
            '.xml': 'XML',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'Less',
            '.sql': 'SQL',
        };
        await this.walkDirectory(repoRoot, async (filePath, stat) => {
            if (!stat.isFile())
                return;
            const ext = path.extname(filePath).toLowerCase();
            const relativePath = path.relative(repoRoot, filePath);
            // 检查是否排除
            if (this.shouldExclude(relativePath))
                return;
            totalFiles++;
            // 统计扩展名
            byExtension[ext] = (byExtension[ext] || 0) + 1;
            // 统计语言
            const language = languageMap[ext];
            if (language) {
                byLanguage[language] = (byLanguage[language] || 0) + 1;
            }
        });
        return {
            byLanguage,
            byExtension,
            totalFiles,
        };
    }
    /**
     * 识别重要文件
     */
    async identifyImportantFiles(repoRoot) {
        const importantFiles = [];
        for (const { pattern, type, description } of IMPORTANT_FILE_PATTERNS) {
            const filePath = path.join(repoRoot, pattern);
            try {
                await fs.access(filePath);
                importantFiles.push({
                    path: pattern,
                    type,
                    description,
                });
            }
            catch {
                // 文件不存在
            }
        }
        return importantFiles;
    }
    /**
     * 发现入口候选
     */
    async discoverEntrypointCandidates(repoRoot) {
        const candidates = [];
        // 入口文件模式
        const entrypointPatterns = [
            { pattern: 'src/main.ts', type: 'app', confidence: 'primary', description: 'TypeScript main entry' },
            { pattern: 'src/main.js', type: 'app', confidence: 'primary', description: 'JavaScript main entry' },
            { pattern: 'src/index.ts', type: 'library', confidence: 'primary', description: 'TypeScript index' },
            { pattern: 'src/index.js', type: 'library', confidence: 'primary', description: 'JavaScript index' },
            { pattern: 'src/app.ts', type: 'app', confidence: 'primary', description: 'TypeScript app' },
            { pattern: 'src/app.tsx', type: 'app', confidence: 'primary', description: 'React app' },
            { pattern: 'main.py', type: 'app', confidence: 'primary', description: 'Python main' },
            { pattern: 'app.py', type: 'app', confidence: 'primary', description: 'Python app (Flask/FastAPI)' },
            { pattern: 'manage.py', type: 'app', confidence: 'primary', description: 'Django management' },
            { pattern: 'pages/index.tsx', type: 'page', confidence: 'primary', description: 'Next.js home page' },
            { pattern: 'pages/index.js', type: 'page', confidence: 'primary', description: 'Next.js home page' },
            { pattern: 'app/page.tsx', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page' },
            { pattern: 'app/layout.tsx', type: 'config', confidence: 'secondary', description: 'Next.js 13+ layout' },
        ];
        for (const { pattern, type, confidence, description } of entrypointPatterns) {
            const filePath = path.join(repoRoot, pattern);
            try {
                await fs.access(filePath);
                candidates.push({
                    path: pattern,
                    type: type,
                    confidence,
                    description,
                });
            }
            catch {
                // 文件不存在
            }
        }
        return candidates;
    }
    /**
     * 遍历目录
     */
    async walkDirectory(dir, callback, depth = 0) {
        if (depth >= this.config.maxDepth)
            return;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(path.dirname(dir), fullPath);
                // 检查是否排除
                if (this.shouldExclude(relativePath))
                    continue;
                if (!this.config.includeHidden && entry.name.startsWith('.'))
                    continue;
                if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, callback, depth + 1);
                }
                else if (entry.isFile()) {
                    await callback(fullPath, entry);
                }
            }
        }
        catch {
            // 忽略权限错误等
        }
    }
    /**
     * 检查是否应该排除
     */
    shouldExclude(filePath) {
        // 检查排除目录
        for (const excludeDir of this.config.excludeDirs) {
            if (filePath.includes(excludeDir))
                return true;
        }
        // 检查排除文件
        for (const pattern of this.config.excludeFiles) {
            if (pattern.startsWith('*')) {
                if (filePath.endsWith(pattern.slice(1)))
                    return true;
            }
            else if (filePath.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
}
exports.RepoMapGenerator = RepoMapGenerator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建仓库地图生成器
 */
function createRepoMapGenerator(config) {
    return new RepoMapGenerator(config);
}
/**
 * 快速生成仓库地图
 */
async function generateRepoMap(repoRoot, config) {
    const generator = new RepoMapGenerator(config);
    return await generator.generate(repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwb19tYXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS9yZXBvX21hcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUErY0gsd0RBRUM7QUFLRCwwQ0FNQztBQTFkRCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBRTdCLDJEQUFxRTtBQXVCckUsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBTSx1QkFBdUIsR0FJeEI7SUFDSCxvQkFBb0I7SUFDcEIsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUU7SUFDOUYsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSw4QkFBOEIsRUFBRTtJQUNwRyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRTtJQUN6RixFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRTtJQUNwRixFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSw2QkFBNkIsRUFBRTtJQUM1RixFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSw0QkFBNEIsRUFBRTtJQUNoRyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRTtJQUNsRixFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxzQkFB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QUFsV0QsNENBa1dDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxNQUErQjtJQUNwRSxPQUFPLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGVBQWUsQ0FDbkMsUUFBZ0IsRUFDaEIsTUFBK0I7SUFFL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvQyxPQUFPLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXBvIE1hcCAtIOS7k+W6k+WcsOWbvueUn+aIkOWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOeUn+aIkOebruW9leaLk+aJkVxuICogMi4g5qCH6K6w5qC45b+D5qih5Z2XXG4gKiAzLiDmjInliIbnsbvlvZLmoaNcbiAqIDQuIOivreiogOWIhuW4g+e7n+iuoVxuICogNS4g6YeN6KaB6YWN572u5paH5Lu26K+G5YirXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IFJlcG9NYXAsIERpcmVjdG9yeU5vZGUsIEtleURpcmVjdG9yeSwgTGFuZ3VhZ2VEaXN0cmlidXRpb24sIEltcG9ydGFudEZpbGUsIEltcG9ydGFudEZpbGVUeXBlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBNb2R1bGVDbGFzc2lmaWVyLCBjbGFzc2lmeVBhdGggfSBmcm9tICcuL21vZHVsZV9jbGFzc2lmaWVyJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog55Sf5oiQ5Zmo6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVwb01hcEdlbmVyYXRvckNvbmZpZyB7XG4gIC8qKiDmnIDlpKfmt7HluqYgKi9cbiAgbWF4RGVwdGg/OiBudW1iZXI7XG4gIFxuICAvKiog5o6S6Zmk55qE55uu5b2VICovXG4gIGV4Y2x1ZGVEaXJzPzogc3RyaW5nW107XG4gIFxuICAvKiog5o6S6Zmk55qE5paH5Lu2ICovXG4gIGV4Y2x1ZGVGaWxlcz86IHN0cmluZ1tdO1xuICBcbiAgLyoqIOWMheWQq+makOiXj+aWh+S7tiAqL1xuICBpbmNsdWRlSGlkZGVuPzogYm9vbGVhbjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YeN6KaB5paH5Lu25qih5byPXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IElNUE9SVEFOVF9GSUxFX1BBVFRFUk5TOiBBcnJheTx7XG4gIHBhdHRlcm46IHN0cmluZztcbiAgdHlwZTogSW1wb3J0YW50RmlsZVR5cGU7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59PiA9IFtcbiAgLy8gUGFja2FnZSBtYW5pZmVzdHNcbiAgeyBwYXR0ZXJuOiAncGFja2FnZS5qc29uJywgdHlwZTogJ3BhY2thZ2VfbWFuaWZlc3QnLCBkZXNjcmlwdGlvbjogJ05vZGUuanMgcGFja2FnZSBtYW5pZmVzdCcgfSxcbiAgeyBwYXR0ZXJuOiAncHlwcm9qZWN0LnRvbWwnLCB0eXBlOiAncGFja2FnZV9tYW5pZmVzdCcsIGRlc2NyaXB0aW9uOiAnUHl0aG9uIHByb2plY3QgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAnQ2FyZ28udG9tbCcsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdSdXN0IHBhY2thZ2UgbWFuaWZlc3QnIH0sXG4gIHsgcGF0dGVybjogJ2dvLm1vZCcsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdHbyBtb2R1bGUgZGVmaW5pdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAncG9tLnhtbCcsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdNYXZlbiBwcm9qZWN0IGNvbmZpZ3VyYXRpb24nIH0sXG4gIHsgcGF0dGVybjogJ2J1aWxkLmdyYWRsZScsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdHcmFkbGUgYnVpbGQgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAnR2VtZmlsZScsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdSdWJ5IGRlcGVuZGVuY2llcycgfSxcbiAgeyBwYXR0ZXJuOiAnY29tcG9zZXIuanNvbicsIHR5cGU6ICdwYWNrYWdlX21hbmlmZXN0JywgZGVzY3JpcHRpb246ICdQSFAgcGFja2FnZSBtYW5pZmVzdCcgfSxcbiAgXG4gIC8vIENvbmZpZ3NcbiAgeyBwYXR0ZXJuOiAndHNjb25maWcuanNvbicsIHR5cGU6ICdjb25maWcnLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAndml0ZS5jb25maWcudHMnLCB0eXBlOiAnY29uZmlnJywgZGVzY3JpcHRpb246ICdWaXRlIGNvbmZpZ3VyYXRpb24nIH0sXG4gIHsgcGF0dGVybjogJ3ZpdGUuY29uZmlnLmpzJywgdHlwZTogJ2NvbmZpZycsIGRlc2NyaXB0aW9uOiAnVml0ZSBjb25maWd1cmF0aW9uJyB9LFxuICB7IHBhdHRlcm46ICduZXh0LmNvbmZpZy5qcycsIHR5cGU6ICdjb25maWcnLCBkZXNjcmlwdGlvbjogJ05leHQuanMgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAnd2VicGFjay5jb25maWcuanMnLCB0eXBlOiAnY29uZmlnJywgZGVzY3JpcHRpb246ICdXZWJwYWNrIGNvbmZpZ3VyYXRpb24nIH0sXG4gIHsgcGF0dGVybjogJ2plc3QuY29uZmlnLmpzJywgdHlwZTogJ2NvbmZpZycsIGRlc2NyaXB0aW9uOiAnSmVzdCBjb25maWd1cmF0aW9uJyB9LFxuICB7IHBhdHRlcm46ICdlc2xpbnQuY29uZmlnLionLCB0eXBlOiAnY29uZmlnJywgZGVzY3JpcHRpb246ICdFU0xpbnQgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAnLmVzbGludHJjLionLCB0eXBlOiAnY29uZmlnJywgZGVzY3JpcHRpb246ICdFU0xpbnQgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAncHJldHRpZXIuY29uZmlnLionLCB0eXBlOiAnY29uZmlnJywgZGVzY3JpcHRpb246ICdQcmV0dGllciBjb25maWd1cmF0aW9uJyB9LFxuICB7IHBhdHRlcm46ICdiYWJlbC5jb25maWcuKicsIHR5cGU6ICdjb25maWcnLCBkZXNjcmlwdGlvbjogJ0JhYmVsIGNvbmZpZ3VyYXRpb24nIH0sXG4gIFxuICAvLyBFbnRyeXBvaW50c1xuICB7IHBhdHRlcm46ICdtYWluLnRzJywgdHlwZTogJ2VudHJ5cG9pbnQnLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgZW50cnkgcG9pbnQnIH0sXG4gIHsgcGF0dGVybjogJ21haW4uanMnLCB0eXBlOiAnZW50cnlwb2ludCcsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBlbnRyeSBwb2ludCcgfSxcbiAgeyBwYXR0ZXJuOiAnbWFpbi5weScsIHR5cGU6ICdlbnRyeXBvaW50JywgZGVzY3JpcHRpb246ICdQeXRob24gZW50cnkgcG9pbnQnIH0sXG4gIHsgcGF0dGVybjogJ2luZGV4LnRzJywgdHlwZTogJ2VudHJ5cG9pbnQnLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgaW5kZXgnIH0sXG4gIHsgcGF0dGVybjogJ2luZGV4LmpzJywgdHlwZTogJ2VudHJ5cG9pbnQnLCBkZXNjcmlwdGlvbjogJ0phdmFTY3JpcHQgaW5kZXgnIH0sXG4gIHsgcGF0dGVybjogJ2FwcC5weScsIHR5cGU6ICdlbnRyeXBvaW50JywgZGVzY3JpcHRpb246ICdQeXRob24gYXBwIGVudHJ5JyB9LFxuICB7IHBhdHRlcm46ICdtYW5hZ2UucHknLCB0eXBlOiAnZW50cnlwb2ludCcsIGRlc2NyaXB0aW9uOiAnRGphbmdvIG1hbmFnZW1lbnQnIH0sXG4gIFxuICAvLyBUZXN0IGNvbmZpZ3NcbiAgeyBwYXR0ZXJuOiAncHl0ZXN0LmluaScsIHR5cGU6ICd0ZXN0X2NvbmZpZycsIGRlc2NyaXB0aW9uOiAncHl0ZXN0IGNvbmZpZ3VyYXRpb24nIH0sXG4gIHsgcGF0dGVybjogJ3RveC5pbmknLCB0eXBlOiAndGVzdF9jb25maWcnLCBkZXNjcmlwdGlvbjogJ3RveCBjb25maWd1cmF0aW9uJyB9LFxuICB7IHBhdHRlcm46ICd2aXRlc3QuY29uZmlnLionLCB0eXBlOiAndGVzdF9jb25maWcnLCBkZXNjcmlwdGlvbjogJ1ZpdGVzdCBjb25maWd1cmF0aW9uJyB9LFxuICBcbiAgLy8gQnVpbGQgY29uZmlnc1xuICB7IHBhdHRlcm46ICdNYWtlZmlsZScsIHR5cGU6ICdidWlsZF9jb25maWcnLCBkZXNjcmlwdGlvbjogJ01ha2UgYnVpbGQgY29uZmlndXJhdGlvbicgfSxcbiAgeyBwYXR0ZXJuOiAnQ01ha2VMaXN0cy50eHQnLCB0eXBlOiAnYnVpbGRfY29uZmlnJywgZGVzY3JpcHRpb246ICdDTWFrZSBjb25maWd1cmF0aW9uJyB9LFxuICBcbiAgLy8gRW52XG4gIHsgcGF0dGVybjogJy5lbnYuZXhhbXBsZScsIHR5cGU6ICdlbnZfZXhhbXBsZScsIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgZXhhbXBsZScgfSxcbiAgeyBwYXR0ZXJuOiAnLmVudi50ZW1wbGF0ZScsIHR5cGU6ICdlbnZfZXhhbXBsZScsIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgdGVtcGxhdGUnIH0sXG4gIFxuICAvLyBEb2NzXG4gIHsgcGF0dGVybjogJ1JFQURNRS5tZCcsIHR5cGU6ICdyZWFkbWUnLCBkZXNjcmlwdGlvbjogJ1Byb2plY3QgcmVhZG1lJyB9LFxuICB7IHBhdHRlcm46ICdSRUFETUUucnN0JywgdHlwZTogJ3JlYWRtZScsIGRlc2NyaXB0aW9uOiAnUHJvamVjdCByZWFkbWUnIH0sXG4gIHsgcGF0dGVybjogJ0NIQU5HRUxPRy5tZCcsIHR5cGU6ICdyZWFkbWUnLCBkZXNjcmlwdGlvbjogJ0NoYW5nZWxvZycgfSxcbiAgeyBwYXR0ZXJuOiAnQ09OVFJJQlVUSU5HLm1kJywgdHlwZTogJ3JlYWRtZScsIGRlc2NyaXB0aW9uOiAnQ29udHJpYnV0aW5nIGd1aWRlJyB9LFxuICBcbiAgLy8gTGljZW5zZVxuICB7IHBhdHRlcm46ICdMSUNFTlNFJywgdHlwZTogJ2xpY2Vuc2UnLCBkZXNjcmlwdGlvbjogJ0xpY2Vuc2UgZmlsZScgfSxcbiAgeyBwYXR0ZXJuOiAnTElDRU5TRS5tZCcsIHR5cGU6ICdsaWNlbnNlJywgZGVzY3JpcHRpb246ICdMaWNlbnNlIGZpbGUnIH0sXG4gIHsgcGF0dGVybjogJ0xJQ0VOU0UudHh0JywgdHlwZTogJ2xpY2Vuc2UnLCBkZXNjcmlwdGlvbjogJ0xpY2Vuc2UgZmlsZScgfSxcbiAgXG4gIC8vIEdpdGlnbm9yZVxuICB7IHBhdHRlcm46ICcuZ2l0aWdub3JlJywgdHlwZTogJ2dpdGlnbm9yZScsIGRlc2NyaXB0aW9uOiAnR2l0IGlnbm9yZSBwYXR0ZXJucycgfSxcbl07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS7k+W6k+WcsOWbvueUn+aIkOWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgUmVwb01hcEdlbmVyYXRvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxSZXBvTWFwR2VuZXJhdG9yQ29uZmlnPjtcbiAgcHJpdmF0ZSBjbGFzc2lmaWVyOiBNb2R1bGVDbGFzc2lmaWVyO1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBSZXBvTWFwR2VuZXJhdG9yQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIG1heERlcHRoOiBjb25maWcubWF4RGVwdGggPz8gMyxcbiAgICAgIGV4Y2x1ZGVEaXJzOiBjb25maWcuZXhjbHVkZURpcnMgPz8gW1xuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgICAgJ19fcHljYWNoZV9fJyxcbiAgICAgICAgJy5naXQnLFxuICAgICAgICAnLnN2bicsXG4gICAgICAgICd2ZW5kb3InLFxuICAgICAgICAnZGlzdCcsXG4gICAgICAgICdidWlsZCcsXG4gICAgICAgICdjb3ZlcmFnZScsXG4gICAgICAgICcubmV4dCcsXG4gICAgICAgICcubnV4dCcsXG4gICAgICAgICcuY2FjaGUnLFxuICAgICAgICAndmVudicsXG4gICAgICAgICcudmVudicsXG4gICAgICAgICdlbnYnLFxuICAgICAgICAnLmVudicsXG4gICAgICBdLFxuICAgICAgZXhjbHVkZUZpbGVzOiBjb25maWcuZXhjbHVkZUZpbGVzID8/IFtcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJyoubG9jaycsXG4gICAgICAgICcqLnB5YycsXG4gICAgICAgICcqLnB5bycsXG4gICAgICAgICcqLmNsYXNzJyxcbiAgICAgICAgJyoubycsXG4gICAgICAgICcqLnNvJyxcbiAgICAgICAgJyouZGxsJyxcbiAgICAgICAgJyouZXhlJyxcbiAgICAgICAgJyouYmluJyxcbiAgICAgIF0sXG4gICAgICBpbmNsdWRlSGlkZGVuOiBjb25maWcuaW5jbHVkZUhpZGRlbiA/PyBmYWxzZSxcbiAgICB9O1xuICAgIFxuICAgIHRoaXMuY2xhc3NpZmllciA9IG5ldyBNb2R1bGVDbGFzc2lmaWVyKCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDku5PlupPlnLDlm75cbiAgICovXG4gIGFzeW5jIGdlbmVyYXRlKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPFJlcG9NYXA+IHtcbiAgICAvLyDmiavmj4/nm67lvZVcbiAgICBjb25zdCB0b3BMZXZlbERpcnMgPSBhd2FpdCB0aGlzLnNjYW5Ub3BMZXZlbERpcmVjdG9yaWVzKHJlcG9Sb290KTtcbiAgICBcbiAgICAvLyDor4bliKvlhbPplK7nm67lvZVcbiAgICBjb25zdCBrZXlEaXJlY3RvcmllcyA9IGF3YWl0IHRoaXMuaWRlbnRpZnlLZXlEaXJlY3RvcmllcyhyZXBvUm9vdCwgdG9wTGV2ZWxEaXJzKTtcbiAgICBcbiAgICAvLyDnu5/orqHor63oqIDliIbluINcbiAgICBjb25zdCBsYW5ndWFnZURpc3RyaWJ1dGlvbiA9IGF3YWl0IHRoaXMuYW5hbHl6ZUxhbmd1YWdlRGlzdHJpYnV0aW9uKHJlcG9Sb290KTtcbiAgICBcbiAgICAvLyDor4bliKvph43opoHmlofku7ZcbiAgICBjb25zdCBpbXBvcnRhbnRGaWxlcyA9IGF3YWl0IHRoaXMuaWRlbnRpZnlJbXBvcnRhbnRGaWxlcyhyZXBvUm9vdCk7XG4gICAgXG4gICAgLy8g5Y+R546w5YWl5Y+j5YCZ6YCJXG4gICAgY29uc3QgZW50cnlwb2ludENhbmRpZGF0ZXMgPSBhd2FpdCB0aGlzLmRpc2NvdmVyRW50cnlwb2ludENhbmRpZGF0ZXMocmVwb1Jvb3QpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICByZXBvUm9vdCxcbiAgICAgIHRvcExldmVsRGlycyxcbiAgICAgIGtleURpcmVjdG9yaWVzLFxuICAgICAgbGFuZ3VhZ2VEaXN0cmlidXRpb24sXG4gICAgICBpbXBvcnRhbnRGaWxlcyxcbiAgICAgIGVudHJ5cG9pbnRDYW5kaWRhdGVzLFxuICAgICAgZ2VuZXJhdGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaJq+aPj+mhtuWxguebruW9lVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuVG9wTGV2ZWxEaXJlY3RvcmllcyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxEaXJlY3RvcnlOb2RlW10+IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihyZXBvUm9vdCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgIGNvbnN0IGRpcnM6IERpcmVjdG9yeU5vZGVbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgaWYgKCFlbnRyeS5pc0RpcmVjdG9yeSgpKSBjb250aW51ZTtcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5leGNsdWRlRGlycy5pbmNsdWRlcyhlbnRyeS5uYW1lKSkgY29udGludWU7XG4gICAgICBpZiAoIXRoaXMuY29uZmlnLmluY2x1ZGVIaWRkZW4gJiYgZW50cnkubmFtZS5zdGFydHNXaXRoKCcuJykpIGNvbnRpbnVlO1xuICAgICAgXG4gICAgICBjb25zdCBkaXJQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCBlbnRyeS5uYW1lKTtcbiAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uID0gdGhpcy5jbGFzc2lmaWVyLmNsYXNzaWZ5RGlyZWN0b3J5KGRpclBhdGgsIHJlcG9Sb290KTtcbiAgICAgIFxuICAgICAgY29uc3Qgbm9kZTogRGlyZWN0b3J5Tm9kZSA9IHtcbiAgICAgICAgbmFtZTogZW50cnkubmFtZSxcbiAgICAgICAgcGF0aDogZW50cnkubmFtZSxcbiAgICAgICAgY2F0ZWdvcnk6IGNsYXNzaWZpY2F0aW9uLmNhdGVnb3J5ICE9PSAndW5rbm93bicgPyBjbGFzc2lmaWNhdGlvbi5jYXRlZ29yeSA6IHVuZGVmaW5lZCxcbiAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICBmaWxlQ291bnQ6IDAsXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyDnu5/orqHmlofku7bmlbDvvIjnrKzkuIDlsYLvvIlcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN1YkVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpclBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgbm9kZS5maWxlQ291bnQgPSBzdWJFbnRyaWVzLmZpbHRlcihlID0+IGUuaXNGaWxlKCkpLmxlbmd0aDtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDlv73nlaXplJnor69cbiAgICAgIH1cbiAgICAgIFxuICAgICAgZGlycy5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmjInlkI3np7DmjpLluo9cbiAgICBkaXJzLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xuICAgIFxuICAgIHJldHVybiBkaXJzO1xuICB9XG4gIFxuICAvKipcbiAgICog6K+G5Yir5YWz6ZSu55uu5b2VXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGlkZW50aWZ5S2V5RGlyZWN0b3JpZXMoXG4gICAgcmVwb1Jvb3Q6IHN0cmluZyxcbiAgICB0b3BMZXZlbERpcnM6IERpcmVjdG9yeU5vZGVbXVxuICApOiBQcm9taXNlPEtleURpcmVjdG9yeVtdPiB7XG4gICAgY29uc3Qga2V5RGlyczogS2V5RGlyZWN0b3J5W10gPSBbXTtcbiAgICBcbiAgICAvLyDlhbPplK7nm67lvZXmqKHlvI9cbiAgICBjb25zdCBrZXlEaXJQYXR0ZXJuczogQXJyYXk8e1xuICAgICAgcGF0dGVybnM6IHN0cmluZ1tdO1xuICAgICAgY2F0ZWdvcnk6IHN0cmluZztcbiAgICAgIGltcG9ydGFuY2U6ICdjcml0aWNhbCcgfCAnaW1wb3J0YW50JyB8ICdub3JtYWwnO1xuICAgICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICB9PiA9IFtcbiAgICAgIHsgcGF0dGVybnM6IFsnc3JjJywgJ2FwcCcsICdhcHBzJ10sIGNhdGVnb3J5OiAnYXBwJywgaW1wb3J0YW5jZTogJ2NyaXRpY2FsJywgZGVzY3JpcHRpb246ICdNYWluIGFwcGxpY2F0aW9uIGNvZGUnIH0sXG4gICAgICB7IHBhdHRlcm5zOiBbJ2xpYicsICdsaWJzJywgJ3BhY2thZ2VzJ10sIGNhdGVnb3J5OiAnbGliJywgaW1wb3J0YW5jZTogJ2NyaXRpY2FsJywgZGVzY3JpcHRpb246ICdMaWJyYXJ5IGNvZGUnIH0sXG4gICAgICB7IHBhdHRlcm5zOiBbJ3Rlc3QnLCAndGVzdHMnLCAnX190ZXN0c19fJywgJ3NwZWMnXSwgY2F0ZWdvcnk6ICd0ZXN0cycsIGltcG9ydGFuY2U6ICdpbXBvcnRhbnQnLCBkZXNjcmlwdGlvbjogJ1Rlc3QgY29kZScgfSxcbiAgICAgIHsgcGF0dGVybnM6IFsnZG9jcycsICdkb2MnLCAnZG9jdW1lbnRhdGlvbiddLCBjYXRlZ29yeTogJ2RvY3MnLCBpbXBvcnRhbmNlOiAnbm9ybWFsJywgZGVzY3JpcHRpb246ICdEb2N1bWVudGF0aW9uJyB9LFxuICAgICAgeyBwYXR0ZXJuczogWydzY3JpcHRzJywgJ2JpbicsICd0b29scyddLCBjYXRlZ29yeTogJ3NjcmlwdHMnLCBpbXBvcnRhbmNlOiAnbm9ybWFsJywgZGVzY3JpcHRpb246ICdTY3JpcHRzIGFuZCB0b29scycgfSxcbiAgICAgIHsgcGF0dGVybnM6IFsnY29uZmlnJywgJ2NvbmZpZ3MnLCAnLmdpdGh1YicsICcuZ2l0bGFiJ10sIGNhdGVnb3J5OiAnaW5mcmEnLCBpbXBvcnRhbmNlOiAnaW1wb3J0YW50JywgZGVzY3JpcHRpb246ICdDb25maWd1cmF0aW9uIGFuZCBDSS9DRCcgfSxcbiAgICAgIHsgcGF0dGVybnM6IFsnaW5mcmEnLCAnZGVwbG95JywgJ2s4cycsICdkb2NrZXInXSwgY2F0ZWdvcnk6ICdpbmZyYScsIGltcG9ydGFuY2U6ICdpbXBvcnRhbnQnLCBkZXNjcmlwdGlvbjogJ0luZnJhc3RydWN0dXJlIGNvZGUnIH0sXG4gICAgXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGRpciBvZiB0b3BMZXZlbERpcnMpIHtcbiAgICAgIGZvciAoY29uc3QgeyBwYXR0ZXJucywgY2F0ZWdvcnksIGltcG9ydGFuY2UsIGRlc2NyaXB0aW9uIH0gb2Yga2V5RGlyUGF0dGVybnMpIHtcbiAgICAgICAgaWYgKHBhdHRlcm5zLmluY2x1ZGVzKGRpci5uYW1lKSkge1xuICAgICAgICAgIGtleURpcnMucHVzaCh7XG4gICAgICAgICAgICBwYXRoOiBkaXIucGF0aCxcbiAgICAgICAgICAgIGNhdGVnb3J5OiBjYXRlZ29yeSBhcyBhbnksXG4gICAgICAgICAgICBpbXBvcnRhbmNlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5oyJ6YeN6KaB5oCn5o6S5bqPXG4gICAgY29uc3QgaW1wb3J0YW5jZU9yZGVyID0geyBjcml0aWNhbDogMCwgaW1wb3J0YW50OiAxLCBub3JtYWw6IDIgfTtcbiAgICBrZXlEaXJzLnNvcnQoKGEsIGIpID0+IGltcG9ydGFuY2VPcmRlclthLmltcG9ydGFuY2VdIC0gaW1wb3J0YW5jZU9yZGVyW2IuaW1wb3J0YW5jZV0pO1xuICAgIFxuICAgIHJldHVybiBrZXlEaXJzO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5p6Q6K+t6KiA5YiG5biDXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGFuYWx5emVMYW5ndWFnZURpc3RyaWJ1dGlvbihyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxMYW5ndWFnZURpc3RyaWJ1dGlvbj4ge1xuICAgIGNvbnN0IGJ5RXh0ZW5zaW9uOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gICAgY29uc3QgYnlMYW5ndWFnZTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuICAgIGxldCB0b3RhbEZpbGVzID0gMDtcbiAgICBcbiAgICAvLyDor63oqIDmmKDlsIRcbiAgICBjb25zdCBsYW5ndWFnZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICcudHMnOiAnVHlwZVNjcmlwdCcsXG4gICAgICAnLnRzeCc6ICdUeXBlU2NyaXB0JyxcbiAgICAgICcuanMnOiAnSmF2YVNjcmlwdCcsXG4gICAgICAnLmpzeCc6ICdKYXZhU2NyaXB0JyxcbiAgICAgICcucHknOiAnUHl0aG9uJyxcbiAgICAgICcucnMnOiAnUnVzdCcsXG4gICAgICAnLmdvJzogJ0dvJyxcbiAgICAgICcuamF2YSc6ICdKYXZhJyxcbiAgICAgICcucmInOiAnUnVieScsXG4gICAgICAnLnBocCc6ICdQSFAnLFxuICAgICAgJy5jJzogJ0MnLFxuICAgICAgJy5jcHAnOiAnQysrJyxcbiAgICAgICcuaCc6ICdDL0MrKycsXG4gICAgICAnLmhwcCc6ICdDKysnLFxuICAgICAgJy5jcyc6ICdDIycsXG4gICAgICAnLnN3aWZ0JzogJ1N3aWZ0JyxcbiAgICAgICcua3QnOiAnS290bGluJyxcbiAgICAgICcuc2NhbGEnOiAnU2NhbGEnLFxuICAgICAgJy5zaCc6ICdTaGVsbCcsXG4gICAgICAnLmJhc2gnOiAnU2hlbGwnLFxuICAgICAgJy56c2gnOiAnU2hlbGwnLFxuICAgICAgJy5tZCc6ICdNYXJrZG93bicsXG4gICAgICAnLnJzdCc6ICdyZVN0cnVjdHVyZWRUZXh0JyxcbiAgICAgICcuanNvbic6ICdKU09OJyxcbiAgICAgICcueWFtbCc6ICdZQU1MJyxcbiAgICAgICcueW1sJzogJ1lBTUwnLFxuICAgICAgJy50b21sJzogJ1RPTUwnLFxuICAgICAgJy54bWwnOiAnWE1MJyxcbiAgICAgICcuaHRtbCc6ICdIVE1MJyxcbiAgICAgICcuY3NzJzogJ0NTUycsXG4gICAgICAnLnNjc3MnOiAnU0NTUycsXG4gICAgICAnLmxlc3MnOiAnTGVzcycsXG4gICAgICAnLnNxbCc6ICdTUUwnLFxuICAgIH07XG4gICAgXG4gICAgYXdhaXQgdGhpcy53YWxrRGlyZWN0b3J5KHJlcG9Sb290LCBhc3luYyAoZmlsZVBhdGgsIHN0YXQpID0+IHtcbiAgICAgIGlmICghc3RhdC5pc0ZpbGUoKSkgcmV0dXJuO1xuICAgICAgXG4gICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBwYXRoLnJlbGF0aXZlKHJlcG9Sb290LCBmaWxlUGF0aCk7XG4gICAgICBcbiAgICAgIC8vIOajgOafpeaYr+WQpuaOkumZpFxuICAgICAgaWYgKHRoaXMuc2hvdWxkRXhjbHVkZShyZWxhdGl2ZVBhdGgpKSByZXR1cm47XG4gICAgICBcbiAgICAgIHRvdGFsRmlsZXMrKztcbiAgICAgIFxuICAgICAgLy8g57uf6K6h5omp5bGV5ZCNXG4gICAgICBieUV4dGVuc2lvbltleHRdID0gKGJ5RXh0ZW5zaW9uW2V4dF0gfHwgMCkgKyAxO1xuICAgICAgXG4gICAgICAvLyDnu5/orqHor63oqIBcbiAgICAgIGNvbnN0IGxhbmd1YWdlID0gbGFuZ3VhZ2VNYXBbZXh0XTtcbiAgICAgIGlmIChsYW5ndWFnZSkge1xuICAgICAgICBieUxhbmd1YWdlW2xhbmd1YWdlXSA9IChieUxhbmd1YWdlW2xhbmd1YWdlXSB8fCAwKSArIDE7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGJ5TGFuZ3VhZ2UsXG4gICAgICBieUV4dGVuc2lvbixcbiAgICAgIHRvdGFsRmlsZXMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhuWIq+mHjeimgeaWh+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBpZGVudGlmeUltcG9ydGFudEZpbGVzKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPEltcG9ydGFudEZpbGVbXT4ge1xuICAgIGNvbnN0IGltcG9ydGFudEZpbGVzOiBJbXBvcnRhbnRGaWxlW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHsgcGF0dGVybiwgdHlwZSwgZGVzY3JpcHRpb24gfSBvZiBJTVBPUlRBTlRfRklMRV9QQVRURVJOUykge1xuICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsIHBhdHRlcm4pO1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5hY2Nlc3MoZmlsZVBhdGgpO1xuICAgICAgICBpbXBvcnRhbnRGaWxlcy5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBwYXR0ZXJuLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIOaWh+S7tuS4jeWtmOWcqFxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gaW1wb3J0YW50RmlsZXM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlj5HnjrDlhaXlj6PlgJnpgIlcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGlzY292ZXJFbnRyeXBvaW50Q2FuZGlkYXRlcyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xuICAgIGNvbnN0IGNhbmRpZGF0ZXM6IGFueVtdID0gW107XG4gICAgXG4gICAgLy8g5YWl5Y+j5paH5Lu25qih5byPXG4gICAgY29uc3QgZW50cnlwb2ludFBhdHRlcm5zOiBBcnJheTx7XG4gICAgICBwYXR0ZXJuOiBzdHJpbmc7XG4gICAgICB0eXBlOiBzdHJpbmc7XG4gICAgICBjb25maWRlbmNlOiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdwb3NzaWJsZSc7XG4gICAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIH0+ID0gW1xuICAgICAgeyBwYXR0ZXJuOiAnc3JjL21haW4udHMnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgbWFpbiBlbnRyeScgfSxcbiAgICAgIHsgcGF0dGVybjogJ3NyYy9tYWluLmpzJywgdHlwZTogJ2FwcCcsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhU2NyaXB0IG1haW4gZW50cnknIH0sXG4gICAgICB7IHBhdHRlcm46ICdzcmMvaW5kZXgudHMnLCB0eXBlOiAnbGlicmFyeScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IGluZGV4JyB9LFxuICAgICAgeyBwYXR0ZXJuOiAnc3JjL2luZGV4LmpzJywgdHlwZTogJ2xpYnJhcnknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBpbmRleCcgfSxcbiAgICAgIHsgcGF0dGVybjogJ3NyYy9hcHAudHMnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgYXBwJyB9LFxuICAgICAgeyBwYXR0ZXJuOiAnc3JjL2FwcC50c3gnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1JlYWN0IGFwcCcgfSxcbiAgICAgIHsgcGF0dGVybjogJ21haW4ucHknLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1B5dGhvbiBtYWluJyB9LFxuICAgICAgeyBwYXR0ZXJuOiAnYXBwLnB5JywgdHlwZTogJ2FwcCcsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdQeXRob24gYXBwIChGbGFzay9GYXN0QVBJKScgfSxcbiAgICAgIHsgcGF0dGVybjogJ21hbmFnZS5weScsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnRGphbmdvIG1hbmFnZW1lbnQnIH0sXG4gICAgICB7IHBhdHRlcm46ICdwYWdlcy9pbmRleC50c3gnLCB0eXBlOiAncGFnZScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIGhvbWUgcGFnZScgfSxcbiAgICAgIHsgcGF0dGVybjogJ3BhZ2VzL2luZGV4LmpzJywgdHlwZTogJ3BhZ2UnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnTmV4dC5qcyBob21lIHBhZ2UnIH0sXG4gICAgICB7IHBhdHRlcm46ICdhcHAvcGFnZS50c3gnLCB0eXBlOiAncGFnZScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIDEzKyBob21lIHBhZ2UnIH0sXG4gICAgICB7IHBhdHRlcm46ICdhcHAvbGF5b3V0LnRzeCcsIHR5cGU6ICdjb25maWcnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIDEzKyBsYXlvdXQnIH0sXG4gICAgXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHsgcGF0dGVybiwgdHlwZSwgY29uZmlkZW5jZSwgZGVzY3JpcHRpb24gfSBvZiBlbnRyeXBvaW50UGF0dGVybnMpIHtcbiAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCBwYXR0ZXJuKTtcbiAgICAgIFxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMuYWNjZXNzKGZpbGVQYXRoKTtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBwYXR0ZXJuLFxuICAgICAgICAgIHR5cGU6IHR5cGUgYXMgYW55LFxuICAgICAgICAgIGNvbmZpZGVuY2UsXG4gICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIOaWh+S7tuS4jeWtmOWcqFxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2FuZGlkYXRlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmBjeWOhuebruW9lVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB3YWxrRGlyZWN0b3J5KFxuICAgIGRpcjogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAoZmlsZVBhdGg6IHN0cmluZywgc3RhdDogZnMuU3RhdHMpID0+IFByb21pc2U8dm9pZD4sXG4gICAgZGVwdGg6IG51bWJlciA9IDBcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKGRlcHRoID49IHRoaXMuY29uZmlnLm1heERlcHRoKSByZXR1cm47XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShwYXRoLmRpcm5hbWUoZGlyKSwgZnVsbFBhdGgpO1xuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l5piv5ZCm5o6S6ZmkXG4gICAgICAgIGlmICh0aGlzLnNob3VsZEV4Y2x1ZGUocmVsYXRpdmVQYXRoKSkgY29udGludWU7XG4gICAgICAgIGlmICghdGhpcy5jb25maWcuaW5jbHVkZUhpZGRlbiAmJiBlbnRyeS5uYW1lLnN0YXJ0c1dpdGgoJy4nKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMud2Fsa0RpcmVjdG9yeShmdWxsUGF0aCwgY2FsbGJhY2ssIGRlcHRoICsgMSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICBhd2FpdCBjYWxsYmFjayhmdWxsUGF0aCwgZW50cnkgYXMgYW55KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8g5b+955Wl5p2D6ZmQ6ZSZ6K+v562JXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5bqU6K+l5o6S6ZmkXG4gICAqL1xuICBwcml2YXRlIHNob3VsZEV4Y2x1ZGUoZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIC8vIOajgOafpeaOkumZpOebruW9lVxuICAgIGZvciAoY29uc3QgZXhjbHVkZURpciBvZiB0aGlzLmNvbmZpZy5leGNsdWRlRGlycykge1xuICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKGV4Y2x1ZGVEaXIpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5o6S6Zmk5paH5Lu2XG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHRoaXMuY29uZmlnLmV4Y2x1ZGVGaWxlcykge1xuICAgICAgaWYgKHBhdHRlcm4uc3RhcnRzV2l0aCgnKicpKSB7XG4gICAgICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aChwYXR0ZXJuLnNsaWNlKDEpKSkgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKHBhdHRlcm4pKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu65LuT5bqT5Zyw5Zu+55Sf5oiQ5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBvTWFwR2VuZXJhdG9yKGNvbmZpZz86IFJlcG9NYXBHZW5lcmF0b3JDb25maWcpOiBSZXBvTWFwR2VuZXJhdG9yIHtcbiAgcmV0dXJuIG5ldyBSZXBvTWFwR2VuZXJhdG9yKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf55Sf5oiQ5LuT5bqT5Zyw5Zu+XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVJlcG9NYXAoXG4gIHJlcG9Sb290OiBzdHJpbmcsXG4gIGNvbmZpZz86IFJlcG9NYXBHZW5lcmF0b3JDb25maWdcbik6IFByb21pc2U8UmVwb01hcD4ge1xuICBjb25zdCBnZW5lcmF0b3IgPSBuZXcgUmVwb01hcEdlbmVyYXRvcihjb25maWcpO1xuICByZXR1cm4gYXdhaXQgZ2VuZXJhdG9yLmdlbmVyYXRlKHJlcG9Sb290KTtcbn1cbiJdfQ==