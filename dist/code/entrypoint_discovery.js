"use strict";
/**
 * Entrypoint Discovery - 入口点发现器
 *
 * 职责：
 * 1. 发现应用入口
 * 2. 发现 CLI 入口
 * 3. 发现服务器入口
 * 4. 发现 Worker 入口
 * 5. 发现页面入口（Next.js 等）
 * 6. 置信度分级（primary/secondary/possible）
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
exports.EntrypointDiscovery = void 0;
exports.createEntrypointDiscovery = createEntrypointDiscovery;
exports.discoverEntrypoints = discoverEntrypoints;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ============================================================================
// 入口点模式定义
// ============================================================================
const ENTRYPOINT_PATTERNS = [
    // === TypeScript / JavaScript ===
    // Main entries
    { pattern: 'src/main.ts', type: 'app', confidence: 'primary', description: 'TypeScript main entry', language: 'TypeScript' },
    { pattern: 'src/main.js', type: 'app', confidence: 'primary', description: 'JavaScript main entry', language: 'JavaScript' },
    { pattern: 'src/main.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React main entry', language: 'TypeScript' },
    { pattern: 'main.ts', type: 'app', confidence: 'secondary', description: 'TypeScript main entry (root)', language: 'TypeScript' },
    { pattern: 'main.js', type: 'app', confidence: 'secondary', description: 'JavaScript main entry (root)', language: 'JavaScript' },
    // Index entries
    { pattern: 'src/index.ts', type: 'library', confidence: 'primary', description: 'TypeScript library index', language: 'TypeScript' },
    { pattern: 'src/index.js', type: 'library', confidence: 'primary', description: 'JavaScript library index', language: 'JavaScript' },
    { pattern: 'src/index.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React index', language: 'TypeScript' },
    { pattern: 'index.ts', type: 'library', confidence: 'secondary', description: 'TypeScript index (root)', language: 'TypeScript' },
    { pattern: 'index.js', type: 'library', confidence: 'secondary', description: 'JavaScript index (root)', language: 'JavaScript' },
    // App entries
    { pattern: 'src/app.ts', type: 'app', confidence: 'primary', description: 'TypeScript app entry', language: 'TypeScript' },
    { pattern: 'src/app.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React app', language: 'TypeScript' },
    { pattern: 'src/app.js', type: 'app', confidence: 'secondary', description: 'JavaScript app entry', language: 'JavaScript' },
    { pattern: 'app.ts', type: 'app', confidence: 'secondary', description: 'TypeScript app (root)', language: 'TypeScript' },
    { pattern: 'app.js', type: 'app', confidence: 'secondary', description: 'JavaScript app (root)', language: 'JavaScript' },
    // Server entries
    { pattern: 'src/server.ts', type: 'server', confidence: 'primary', description: 'TypeScript server entry', language: 'TypeScript' },
    { pattern: 'src/server.js', type: 'server', confidence: 'primary', description: 'JavaScript server entry', language: 'JavaScript' },
    { pattern: 'server.ts', type: 'server', confidence: 'secondary', description: 'TypeScript server (root)', language: 'TypeScript' },
    { pattern: 'server.js', type: 'server', confidence: 'secondary', description: 'JavaScript server (root)', language: 'JavaScript' },
    // CLI entries
    { pattern: 'src/cli.ts', type: 'cli', confidence: 'primary', description: 'TypeScript CLI entry', language: 'TypeScript' },
    { pattern: 'src/cli.js', type: 'cli', confidence: 'primary', description: 'JavaScript CLI entry', language: 'JavaScript' },
    { pattern: 'bin/cli.js', type: 'cli', confidence: 'primary', description: 'Node.js CLI binary', language: 'JavaScript' },
    { pattern: 'bin/www', type: 'server', confidence: 'primary', description: 'Node.js www binary', language: 'JavaScript' },
    // Next.js pages
    { pattern: 'pages/index.tsx', type: 'page', confidence: 'primary', description: 'Next.js home page', language: 'TypeScript', framework: 'Next.js' },
    { pattern: 'pages/index.js', type: 'page', confidence: 'primary', description: 'Next.js home page', language: 'JavaScript', framework: 'Next.js' },
    { pattern: 'pages/_app.tsx', type: 'config', confidence: 'secondary', description: 'Next.js app wrapper', language: 'TypeScript', framework: 'Next.js' },
    { pattern: 'pages/_app.js', type: 'config', confidence: 'secondary', description: 'Next.js app wrapper', language: 'JavaScript', framework: 'Next.js' },
    { pattern: 'pages/api/[...].ts', type: 'api', confidence: 'primary', description: 'Next.js API route', language: 'TypeScript', framework: 'Next.js' },
    { pattern: 'pages/api/[...].js', type: 'api', confidence: 'primary', description: 'Next.js API route', language: 'JavaScript', framework: 'Next.js' },
    // Next.js 13+ app router
    { pattern: 'app/page.tsx', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page', language: 'TypeScript', framework: 'Next.js' },
    { pattern: 'app/page.js', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page', language: 'JavaScript', framework: 'Next.js' },
    { pattern: 'app/layout.tsx', type: 'config', confidence: 'primary', description: 'Next.js 13+ root layout', language: 'TypeScript', framework: 'Next.js' },
    { pattern: 'app/layout.js', type: 'config', confidence: 'primary', description: 'Next.js 13+ root layout', language: 'JavaScript', framework: 'Next.js' },
    // Worker entries
    { pattern: 'src/worker.ts', type: 'worker', confidence: 'primary', description: 'TypeScript worker entry', language: 'TypeScript' },
    { pattern: 'src/worker.js', type: 'worker', confidence: 'primary', description: 'JavaScript worker entry', language: 'JavaScript' },
    { pattern: 'worker.ts', type: 'worker', confidence: 'secondary', description: 'TypeScript worker (root)', language: 'TypeScript' },
    // === Python ===
    // Main entries
    { pattern: 'main.py', type: 'app', confidence: 'primary', description: 'Python main entry', language: 'Python' },
    { pattern: 'src/main.py', type: 'app', confidence: 'primary', description: 'Python main entry (src)', language: 'Python' },
    // App entries
    { pattern: 'app.py', type: 'app', confidence: 'primary', description: 'Python app (Flask/FastAPI)', language: 'Python' },
    { pattern: 'src/app.py', type: 'app', confidence: 'primary', description: 'Python app (src)', language: 'Python' },
    // Django
    { pattern: 'manage.py', type: 'app', confidence: 'primary', description: 'Django management', language: 'Python', framework: 'Django' },
    { pattern: 'wsgi.py', type: 'server', confidence: 'secondary', description: 'WSGI entry', language: 'Python' },
    { pattern: 'asgi.py', type: 'server', confidence: 'secondary', description: 'ASGI entry', language: 'Python' },
    // CLI
    { pattern: 'cli.py', type: 'cli', confidence: 'primary', description: 'Python CLI entry', language: 'Python' },
    { pattern: 'src/cli.py', type: 'cli', confidence: 'primary', description: 'Python CLI entry (src)', language: 'Python' },
    // === Rust ===
    { pattern: 'src/main.rs', type: 'app', confidence: 'primary', description: 'Rust main entry', language: 'Rust' },
    { pattern: 'src/lib.rs', type: 'library', confidence: 'primary', description: 'Rust library entry', language: 'Rust' },
    { pattern: 'src/bin/[...].rs', type: 'cli', confidence: 'primary', description: 'Rust binary', language: 'Rust' },
    // === Go ===
    { pattern: 'main.go', type: 'app', confidence: 'primary', description: 'Go main entry', language: 'Go' },
    { pattern: 'cmd/[...]/main.go', type: 'app', confidence: 'primary', description: 'Go cmd entry', language: 'Go' },
    // === Java ===
    { pattern: 'src/main/java/[...]/Application.java', type: 'app', confidence: 'primary', description: 'Spring Boot application', language: 'Java', framework: 'Spring Boot' },
    { pattern: 'src/main/java/[...]/Main.java', type: 'app', confidence: 'secondary', description: 'Java main class', language: 'Java' },
];
// ============================================================================
// 入口点发现器
// ============================================================================
class EntrypointDiscovery {
    constructor(config = {}) {
        this.config = {
            includeSubdirs: config.includeSubdirs ?? true,
            maxDepth: config.maxDepth ?? 3,
        };
    }
    /**
     * 发现入口点
     */
    async discover(repoRoot) {
        const entrypoints = [];
        // 1. 基于模式匹配发现
        const patternMatches = await this.discoverByPatterns(repoRoot);
        entrypoints.push(...patternMatches);
        // 2. 基于 package.json bin 发现
        const packageBinEntries = await this.discoverPackageBin(repoRoot);
        entrypoints.push(...packageBinEntries);
        // 3. 基于 pyproject.toml 发现
        const pyprojectEntries = await this.discoverPyprojectEntrypoints(repoRoot);
        entrypoints.push(...pyprojectEntries);
        // 4. 基于 Cargo.toml 发现
        const cargoEntries = await this.discoverCargoEntrypoints(repoRoot);
        entrypoints.push(...cargoEntries);
        // 去重并排序
        const unique = this.deduplicate(entrypoints);
        unique.sort((a, b) => {
            // 按置信度排序
            const confidenceOrder = { primary: 0, secondary: 1, possible: 2 };
            return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
        });
        return unique;
    }
    /**
     * 基于模式匹配发现
     */
    async discoverByPatterns(repoRoot) {
        const entrypoints = [];
        for (const { pattern, type, confidence, description, language, framework } of ENTRYPOINT_PATTERNS) {
            // 处理通配符模式
            if (pattern.includes('[...]')) {
                // 通配符模式，需要扫描目录
                const matches = await this.discoverWildcardPatterns(repoRoot, pattern);
                for (const match of matches) {
                    entrypoints.push({
                        path: match,
                        type,
                        confidence,
                        description: description.replace('[...]', path.basename(match)),
                        language,
                    });
                }
            }
            else {
                // 精确模式
                const filePath = path.join(repoRoot, pattern);
                try {
                    await fs.access(filePath);
                    entrypoints.push({
                        path: pattern,
                        type,
                        confidence,
                        description,
                        language,
                        ...(framework ? { description: `${description} (${framework})` } : {}),
                    });
                }
                catch {
                    // 文件不存在
                }
            }
        }
        return entrypoints;
    }
    /**
     * 发现通配符模式匹配
     */
    async discoverWildcardPatterns(repoRoot, pattern) {
        const matches = [];
        const basePattern = pattern.replace(/\[...\]/g, '*');
        // 简单实现：扫描常见目录
        const searchDirs = ['src', 'cmd', 'bin', 'app', ''];
        for (const dir of searchDirs) {
            const searchPath = dir ? path.join(repoRoot, dir) : repoRoot;
            try {
                const entries = await fs.readdir(searchPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile() && this.matchesPattern(entry.name, basePattern)) {
                        const relativePath = dir ? path.join(dir, entry.name) : entry.name;
                        matches.push(relativePath);
                    }
                }
            }
            catch {
                // 目录不存在
            }
        }
        return matches.slice(0, 5); // 限制返回数量
    }
    /**
     * 基于 package.json bin 发现
     */
    async discoverPackageBin(repoRoot) {
        const entrypoints = [];
        try {
            const packageJsonPath = path.join(repoRoot, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);
            // bin 字段可以是字符串或对象
            if (typeof packageJson.bin === 'string') {
                entrypoints.push({
                    path: packageJson.bin,
                    type: 'cli',
                    confidence: 'primary',
                    description: `CLI binary: ${path.basename(packageJson.bin)}`,
                    language: 'JavaScript',
                });
            }
            else if (typeof packageJson.bin === 'object') {
                for (const [name, binPath] of Object.entries(packageJson.bin)) {
                    entrypoints.push({
                        path: binPath,
                        type: 'cli',
                        confidence: 'primary',
                        description: `CLI binary: ${name}`,
                        language: 'JavaScript',
                    });
                }
            }
        }
        catch {
            // package.json 不存在或解析失败
        }
        return entrypoints;
    }
    /**
     * 基于 pyproject.toml 发现
     */
    async discoverPyprojectEntrypoints(repoRoot) {
        const entrypoints = [];
        try {
            const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
            const content = await fs.readFile(pyprojectPath, 'utf-8');
            // 检测 Poetry scripts
            const scriptsMatch = content.match(/\[tool\.poetry\.scripts\]([\s\S]*?)(?=\[|$)/);
            if (scriptsMatch) {
                const scripts = scriptsMatch[1];
                const scriptLines = scripts.split('\n').filter(line => line.includes('='));
                for (const line of scriptLines) {
                    const [name, path] = line.split('=').map(s => s.trim().replace(/["']/g, ''));
                    if (path) {
                        entrypoints.push({
                            path: path.split(':')[0], // 去掉函数名部分
                            type: 'cli',
                            confidence: 'primary',
                            description: `Python CLI: ${name}`,
                            language: 'Python',
                        });
                    }
                }
            }
            // 检测 console_scripts
            const consoleScriptsMatch = content.match(/console_scripts\s*=\s*\[([\s\S]*?)\]/);
            if (consoleScriptsMatch) {
                const scripts = consoleScriptsMatch[1];
                const scriptLines = scripts.split(',').map(s => s.trim().replace(/["']/g, ''));
                for (const script of scriptLines) {
                    if (script.includes('=')) {
                        const [name, path] = script.split('=').map(s => s.trim());
                        entrypoints.push({
                            path: path.split(':')[0],
                            type: 'cli',
                            confidence: 'primary',
                            description: `Python CLI: ${name}`,
                            language: 'Python',
                        });
                    }
                }
            }
        }
        catch {
            // pyproject.toml 不存在
        }
        return entrypoints;
    }
    /**
     * 基于 Cargo.toml 发现
     */
    async discoverCargoEntrypoints(repoRoot) {
        const entrypoints = [];
        try {
            const cargoPath = path.join(repoRoot, 'Cargo.toml');
            const content = await fs.readFile(cargoPath, 'utf-8');
            // 检测 [[bin]]
            const binMatches = content.match(/\[\[bin\]\]([\s\S]*?)(?=\[\[|$)/g);
            if (binMatches) {
                for (const match of binMatches) {
                    const nameMatch = match.match(/name\s*=\s*["']([^"']+)["']/);
                    const pathMatch = match.match(/path\s*=\s*["']([^"']+)["']/);
                    if (pathMatch) {
                        entrypoints.push({
                            path: pathMatch[1],
                            type: 'cli',
                            confidence: 'primary',
                            description: `Rust binary: ${nameMatch ? nameMatch[1] : path.basename(pathMatch[1])}`,
                            language: 'Rust',
                        });
                    }
                }
            }
        }
        catch {
            // Cargo.toml 不存在
        }
        return entrypoints;
    }
    /**
     * 去重
     */
    deduplicate(entrypoints) {
        const seen = new Set();
        const unique = [];
        for (const entrypoint of entrypoints) {
            if (!seen.has(entrypoint.path)) {
                seen.add(entrypoint.path);
                unique.push(entrypoint);
            }
        }
        return unique;
    }
    /**
     * 检查模式匹配
     */
    matchesPattern(filename, pattern) {
        // 简单通配符匹配
        if (pattern === '*')
            return true;
        if (pattern.startsWith('*'))
            return filename.endsWith(pattern.slice(1));
        if (pattern.endsWith('*'))
            return filename.startsWith(pattern.slice(0, -1));
        return filename === pattern;
    }
}
exports.EntrypointDiscovery = EntrypointDiscovery;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建入口点发现器
 */
function createEntrypointDiscovery(config) {
    return new EntrypointDiscovery(config);
}
/**
 * 快速发现入口点
 */
async function discoverEntrypoints(repoRoot, config) {
    const discovery = new EntrypointDiscovery(config);
    return await discovery.discover(repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50cnlwb2ludF9kaXNjb3ZlcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS9lbnRyeXBvaW50X2Rpc2NvdmVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc2FILDhEQUVDO0FBS0Qsa0RBTUM7QUFqYkQsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQXlDN0IsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0UsTUFBTSxtQkFBbUIsR0FBd0I7SUFDL0Msa0NBQWtDO0lBRWxDLGVBQWU7SUFDZixFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFO0lBQzVILEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLHVCQUF1QixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFDNUgsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsNkJBQTZCLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRTtJQUNuSSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFO0lBQ2pJLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLDhCQUE4QixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7SUFFakks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TSxTQUFTLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRCxPQUFPLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFbnRyeXBvaW50IERpc2NvdmVyeSAtIOWFpeWPo+eCueWPkeeOsOWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWPkeeOsOW6lOeUqOWFpeWPo1xuICogMi4g5Y+R546wIENMSSDlhaXlj6NcbiAqIDMuIOWPkeeOsOacjeWKoeWZqOWFpeWPo1xuICogNC4g5Y+R546wIFdvcmtlciDlhaXlj6NcbiAqIDUuIOWPkeeOsOmhtemdouWFpeWPo++8iE5leHQuanMg562J77yJXG4gKiA2LiDnva7kv6HluqbliIbnuqfvvIhwcmltYXJ5L3NlY29uZGFyeS9wb3NzaWJsZe+8iVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBFbnRyeXBvaW50LCBFbnRyeXBvaW50VHlwZSB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDlj5HnjrDlmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbnRyeXBvaW50RGlzY292ZXJ5Q29uZmlnIHtcbiAgLyoqIOWMheWQq+WtkOebruW9lSAqL1xuICBpbmNsdWRlU3ViZGlycz86IGJvb2xlYW47XG4gIFxuICAvKiog5pyA5aSn5rex5bqmICovXG4gIG1heERlcHRoPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIOWFpeWPo+eCueaooeW8j1xuICovXG5pbnRlcmZhY2UgRW50cnlwb2ludFBhdHRlcm4ge1xuICAvKiog5paH5Lu25qih5byPICovXG4gIHBhdHRlcm46IHN0cmluZztcbiAgXG4gIC8qKiDlhaXlj6PnsbvlnosgKi9cbiAgdHlwZTogRW50cnlwb2ludFR5cGU7XG4gIFxuICAvKiog572u5L+h5bqmICovXG4gIGNvbmZpZGVuY2U6ICdwcmltYXJ5JyB8ICdzZWNvbmRhcnknIHwgJ3Bvc3NpYmxlJztcbiAgXG4gIC8qKiDmj4/ov7AgKi9cbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgXG4gIC8qKiDor63oqIAgKi9cbiAgbGFuZ3VhZ2U/OiBzdHJpbmc7XG4gIFxuICAvKiog5qGG5p62ICovXG4gIGZyYW1ld29yaz86IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5YWl5Y+j54K55qih5byP5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IEVOVFJZUE9JTlRfUEFUVEVSTlM6IEVudHJ5cG9pbnRQYXR0ZXJuW10gPSBbXG4gIC8vID09PSBUeXBlU2NyaXB0IC8gSmF2YVNjcmlwdCA9PT1cbiAgXG4gIC8vIE1haW4gZW50cmllc1xuICB7IHBhdHRlcm46ICdzcmMvbWFpbi50cycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnVHlwZVNjcmlwdCBtYWluIGVudHJ5JywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvbWFpbi5qcycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBtYWluIGVudHJ5JywgbGFuZ3VhZ2U6ICdKYXZhU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvbWFpbi50c3gnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgUmVhY3QgbWFpbiBlbnRyeScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnbWFpbi50cycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IG1haW4gZW50cnkgKHJvb3QpJywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdtYWluLmpzJywgdHlwZTogJ2FwcCcsIGNvbmZpZGVuY2U6ICdzZWNvbmRhcnknLCBkZXNjcmlwdGlvbjogJ0phdmFTY3JpcHQgbWFpbiBlbnRyeSAocm9vdCknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIFxuICAvLyBJbmRleCBlbnRyaWVzXG4gIHsgcGF0dGVybjogJ3NyYy9pbmRleC50cycsIHR5cGU6ICdsaWJyYXJ5JywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgbGlicmFyeSBpbmRleCcsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnc3JjL2luZGV4LmpzJywgdHlwZTogJ2xpYnJhcnknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBsaWJyYXJ5IGluZGV4JywgbGFuZ3VhZ2U6ICdKYXZhU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvaW5kZXgudHN4JywgdHlwZTogJ2FwcCcsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IFJlYWN0IGluZGV4JywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdpbmRleC50cycsIHR5cGU6ICdsaWJyYXJ5JywgY29uZmlkZW5jZTogJ3NlY29uZGFyeScsIGRlc2NyaXB0aW9uOiAnVHlwZVNjcmlwdCBpbmRleCAocm9vdCknLCBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ2luZGV4LmpzJywgdHlwZTogJ2xpYnJhcnknLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhU2NyaXB0IGluZGV4IChyb290KScsIGxhbmd1YWdlOiAnSmF2YVNjcmlwdCcgfSxcbiAgXG4gIC8vIEFwcCBlbnRyaWVzXG4gIHsgcGF0dGVybjogJ3NyYy9hcHAudHMnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgYXBwIGVudHJ5JywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvYXBwLnRzeCcsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnVHlwZVNjcmlwdCBSZWFjdCBhcHAnLCBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ3NyYy9hcHAuanMnLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3NlY29uZGFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBhcHAgZW50cnknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ2FwcC50cycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IGFwcCAocm9vdCknLCBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ2FwcC5qcycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhU2NyaXB0IGFwcCAocm9vdCknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIFxuICAvLyBTZXJ2ZXIgZW50cmllc1xuICB7IHBhdHRlcm46ICdzcmMvc2VydmVyLnRzJywgdHlwZTogJ3NlcnZlcicsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IHNlcnZlciBlbnRyeScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnc3JjL3NlcnZlci5qcycsIHR5cGU6ICdzZXJ2ZXInLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBzZXJ2ZXIgZW50cnknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ3NlcnZlci50cycsIHR5cGU6ICdzZXJ2ZXInLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IHNlcnZlciAocm9vdCknLCBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ3NlcnZlci5qcycsIHR5cGU6ICdzZXJ2ZXInLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhU2NyaXB0IHNlcnZlciAocm9vdCknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIFxuICAvLyBDTEkgZW50cmllc1xuICB7IHBhdHRlcm46ICdzcmMvY2xpLnRzJywgdHlwZTogJ2NsaScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdUeXBlU2NyaXB0IENMSSBlbnRyeScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnc3JjL2NsaS5qcycsIHR5cGU6ICdjbGknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnSmF2YVNjcmlwdCBDTEkgZW50cnknLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnIH0sXG4gIHsgcGF0dGVybjogJ2Jpbi9jbGkuanMnLCB0eXBlOiAnY2xpJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ05vZGUuanMgQ0xJIGJpbmFyeScsIGxhbmd1YWdlOiAnSmF2YVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnYmluL3d3dycsIHR5cGU6ICdzZXJ2ZXInLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnTm9kZS5qcyB3d3cgYmluYXJ5JywgbGFuZ3VhZ2U6ICdKYXZhU2NyaXB0JyB9LFxuICBcbiAgLy8gTmV4dC5qcyBwYWdlc1xuICB7IHBhdHRlcm46ICdwYWdlcy9pbmRleC50c3gnLCB0eXBlOiAncGFnZScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIGhvbWUgcGFnZScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcsIGZyYW1ld29yazogJ05leHQuanMnIH0sXG4gIHsgcGF0dGVybjogJ3BhZ2VzL2luZGV4LmpzJywgdHlwZTogJ3BhZ2UnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnTmV4dC5qcyBob21lIHBhZ2UnLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnLCBmcmFtZXdvcms6ICdOZXh0LmpzJyB9LFxuICB7IHBhdHRlcm46ICdwYWdlcy9fYXBwLnRzeCcsIHR5cGU6ICdjb25maWcnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIGFwcCB3cmFwcGVyJywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JywgZnJhbWV3b3JrOiAnTmV4dC5qcycgfSxcbiAgeyBwYXR0ZXJuOiAncGFnZXMvX2FwcC5qcycsIHR5cGU6ICdjb25maWcnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIGFwcCB3cmFwcGVyJywgbGFuZ3VhZ2U6ICdKYXZhU2NyaXB0JywgZnJhbWV3b3JrOiAnTmV4dC5qcycgfSxcbiAgeyBwYXR0ZXJuOiAncGFnZXMvYXBpL1suLi5dLnRzJywgdHlwZTogJ2FwaScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIEFQSSByb3V0ZScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcsIGZyYW1ld29yazogJ05leHQuanMnIH0sXG4gIHsgcGF0dGVybjogJ3BhZ2VzL2FwaS9bLi4uXS5qcycsIHR5cGU6ICdhcGknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnTmV4dC5qcyBBUEkgcm91dGUnLCBsYW5ndWFnZTogJ0phdmFTY3JpcHQnLCBmcmFtZXdvcms6ICdOZXh0LmpzJyB9LFxuICBcbiAgLy8gTmV4dC5qcyAxMysgYXBwIHJvdXRlclxuICB7IHBhdHRlcm46ICdhcHAvcGFnZS50c3gnLCB0eXBlOiAncGFnZScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIDEzKyBob21lIHBhZ2UnLCBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnLCBmcmFtZXdvcms6ICdOZXh0LmpzJyB9LFxuICB7IHBhdHRlcm46ICdhcHAvcGFnZS5qcycsIHR5cGU6ICdwYWdlJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ05leHQuanMgMTMrIGhvbWUgcGFnZScsIGxhbmd1YWdlOiAnSmF2YVNjcmlwdCcsIGZyYW1ld29yazogJ05leHQuanMnIH0sXG4gIHsgcGF0dGVybjogJ2FwcC9sYXlvdXQudHN4JywgdHlwZTogJ2NvbmZpZycsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdOZXh0LmpzIDEzKyByb290IGxheW91dCcsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcsIGZyYW1ld29yazogJ05leHQuanMnIH0sXG4gIHsgcGF0dGVybjogJ2FwcC9sYXlvdXQuanMnLCB0eXBlOiAnY29uZmlnJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ05leHQuanMgMTMrIHJvb3QgbGF5b3V0JywgbGFuZ3VhZ2U6ICdKYXZhU2NyaXB0JywgZnJhbWV3b3JrOiAnTmV4dC5qcycgfSxcbiAgXG4gIC8vIFdvcmtlciBlbnRyaWVzXG4gIHsgcGF0dGVybjogJ3NyYy93b3JrZXIudHMnLCB0eXBlOiAnd29ya2VyJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgd29ya2VyIGVudHJ5JywgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvd29ya2VyLmpzJywgdHlwZTogJ3dvcmtlcicsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhU2NyaXB0IHdvcmtlciBlbnRyeScsIGxhbmd1YWdlOiAnSmF2YVNjcmlwdCcgfSxcbiAgeyBwYXR0ZXJuOiAnd29ya2VyLnRzJywgdHlwZTogJ3dvcmtlcicsIGNvbmZpZGVuY2U6ICdzZWNvbmRhcnknLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgd29ya2VyIChyb290KScsIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcgfSxcbiAgXG4gIC8vID09PSBQeXRob24gPT09XG4gIFxuICAvLyBNYWluIGVudHJpZXNcbiAgeyBwYXR0ZXJuOiAnbWFpbi5weScsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnUHl0aG9uIG1haW4gZW50cnknLCBsYW5ndWFnZTogJ1B5dGhvbicgfSxcbiAgeyBwYXR0ZXJuOiAnc3JjL21haW4ucHknLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1B5dGhvbiBtYWluIGVudHJ5IChzcmMpJywgbGFuZ3VhZ2U6ICdQeXRob24nIH0sXG4gIFxuICAvLyBBcHAgZW50cmllc1xuICB7IHBhdHRlcm46ICdhcHAucHknLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1B5dGhvbiBhcHAgKEZsYXNrL0Zhc3RBUEkpJywgbGFuZ3VhZ2U6ICdQeXRob24nIH0sXG4gIHsgcGF0dGVybjogJ3NyYy9hcHAucHknLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1B5dGhvbiBhcHAgKHNyYyknLCBsYW5ndWFnZTogJ1B5dGhvbicgfSxcbiAgXG4gIC8vIERqYW5nb1xuICB7IHBhdHRlcm46ICdtYW5hZ2UucHknLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ0RqYW5nbyBtYW5hZ2VtZW50JywgbGFuZ3VhZ2U6ICdQeXRob24nLCBmcmFtZXdvcms6ICdEamFuZ28nIH0sXG4gIHsgcGF0dGVybjogJ3dzZ2kucHknLCB0eXBlOiAnc2VydmVyJywgY29uZmlkZW5jZTogJ3NlY29uZGFyeScsIGRlc2NyaXB0aW9uOiAnV1NHSSBlbnRyeScsIGxhbmd1YWdlOiAnUHl0aG9uJyB9LFxuICB7IHBhdHRlcm46ICdhc2dpLnB5JywgdHlwZTogJ3NlcnZlcicsIGNvbmZpZGVuY2U6ICdzZWNvbmRhcnknLCBkZXNjcmlwdGlvbjogJ0FTR0kgZW50cnknLCBsYW5ndWFnZTogJ1B5dGhvbicgfSxcbiAgXG4gIC8vIENMSVxuICB7IHBhdHRlcm46ICdjbGkucHknLCB0eXBlOiAnY2xpJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ1B5dGhvbiBDTEkgZW50cnknLCBsYW5ndWFnZTogJ1B5dGhvbicgfSxcbiAgeyBwYXR0ZXJuOiAnc3JjL2NsaS5weScsIHR5cGU6ICdjbGknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnUHl0aG9uIENMSSBlbnRyeSAoc3JjKScsIGxhbmd1YWdlOiAnUHl0aG9uJyB9LFxuICBcbiAgLy8gPT09IFJ1c3QgPT09XG4gIFxuICB7IHBhdHRlcm46ICdzcmMvbWFpbi5ycycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnUnVzdCBtYWluIGVudHJ5JywgbGFuZ3VhZ2U6ICdSdXN0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvbGliLnJzJywgdHlwZTogJ2xpYnJhcnknLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnUnVzdCBsaWJyYXJ5IGVudHJ5JywgbGFuZ3VhZ2U6ICdSdXN0JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvYmluL1suLi5dLnJzJywgdHlwZTogJ2NsaScsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdSdXN0IGJpbmFyeScsIGxhbmd1YWdlOiAnUnVzdCcgfSxcbiAgXG4gIC8vID09PSBHbyA9PT1cbiAgXG4gIHsgcGF0dGVybjogJ21haW4uZ28nLCB0eXBlOiAnYXBwJywgY29uZmlkZW5jZTogJ3ByaW1hcnknLCBkZXNjcmlwdGlvbjogJ0dvIG1haW4gZW50cnknLCBsYW5ndWFnZTogJ0dvJyB9LFxuICB7IHBhdHRlcm46ICdjbWQvWy4uLl0vbWFpbi5nbycsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAncHJpbWFyeScsIGRlc2NyaXB0aW9uOiAnR28gY21kIGVudHJ5JywgbGFuZ3VhZ2U6ICdHbycgfSxcbiAgXG4gIC8vID09PSBKYXZhID09PVxuICBcbiAgeyBwYXR0ZXJuOiAnc3JjL21haW4vamF2YS9bLi4uXS9BcHBsaWNhdGlvbi5qYXZhJywgdHlwZTogJ2FwcCcsIGNvbmZpZGVuY2U6ICdwcmltYXJ5JywgZGVzY3JpcHRpb246ICdTcHJpbmcgQm9vdCBhcHBsaWNhdGlvbicsIGxhbmd1YWdlOiAnSmF2YScsIGZyYW1ld29yazogJ1NwcmluZyBCb290JyB9LFxuICB7IHBhdHRlcm46ICdzcmMvbWFpbi9qYXZhL1suLi5dL01haW4uamF2YScsIHR5cGU6ICdhcHAnLCBjb25maWRlbmNlOiAnc2Vjb25kYXJ5JywgZGVzY3JpcHRpb246ICdKYXZhIG1haW4gY2xhc3MnLCBsYW5ndWFnZTogJ0phdmEnIH0sXG5dO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlhaXlj6Pngrnlj5HnjrDlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEVudHJ5cG9pbnREaXNjb3Zlcnkge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8RW50cnlwb2ludERpc2NvdmVyeUNvbmZpZz47XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEVudHJ5cG9pbnREaXNjb3ZlcnlDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgaW5jbHVkZVN1YmRpcnM6IGNvbmZpZy5pbmNsdWRlU3ViZGlycyA/PyB0cnVlLFxuICAgICAgbWF4RGVwdGg6IGNvbmZpZy5tYXhEZXB0aCA/PyAzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlj5HnjrDlhaXlj6PngrlcbiAgICovXG4gIGFzeW5jIGRpc2NvdmVyKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPEVudHJ5cG9pbnRbXT4ge1xuICAgIGNvbnN0IGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W10gPSBbXTtcbiAgICBcbiAgICAvLyAxLiDln7rkuo7mqKHlvI/ljLnphY3lj5HnjrBcbiAgICBjb25zdCBwYXR0ZXJuTWF0Y2hlcyA9IGF3YWl0IHRoaXMuZGlzY292ZXJCeVBhdHRlcm5zKHJlcG9Sb290KTtcbiAgICBlbnRyeXBvaW50cy5wdXNoKC4uLnBhdHRlcm5NYXRjaGVzKTtcbiAgICBcbiAgICAvLyAyLiDln7rkuo4gcGFja2FnZS5qc29uIGJpbiDlj5HnjrBcbiAgICBjb25zdCBwYWNrYWdlQmluRW50cmllcyA9IGF3YWl0IHRoaXMuZGlzY292ZXJQYWNrYWdlQmluKHJlcG9Sb290KTtcbiAgICBlbnRyeXBvaW50cy5wdXNoKC4uLnBhY2thZ2VCaW5FbnRyaWVzKTtcbiAgICBcbiAgICAvLyAzLiDln7rkuo4gcHlwcm9qZWN0LnRvbWwg5Y+R546wXG4gICAgY29uc3QgcHlwcm9qZWN0RW50cmllcyA9IGF3YWl0IHRoaXMuZGlzY292ZXJQeXByb2plY3RFbnRyeXBvaW50cyhyZXBvUm9vdCk7XG4gICAgZW50cnlwb2ludHMucHVzaCguLi5weXByb2plY3RFbnRyaWVzKTtcbiAgICBcbiAgICAvLyA0LiDln7rkuo4gQ2FyZ28udG9tbCDlj5HnjrBcbiAgICBjb25zdCBjYXJnb0VudHJpZXMgPSBhd2FpdCB0aGlzLmRpc2NvdmVyQ2FyZ29FbnRyeXBvaW50cyhyZXBvUm9vdCk7XG4gICAgZW50cnlwb2ludHMucHVzaCguLi5jYXJnb0VudHJpZXMpO1xuICAgIFxuICAgIC8vIOWOu+mHjeW5tuaOkuW6j1xuICAgIGNvbnN0IHVuaXF1ZSA9IHRoaXMuZGVkdXBsaWNhdGUoZW50cnlwb2ludHMpO1xuICAgIHVuaXF1ZS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAvLyDmjInnva7kv6HluqbmjpLluo9cbiAgICAgIGNvbnN0IGNvbmZpZGVuY2VPcmRlciA9IHsgcHJpbWFyeTogMCwgc2Vjb25kYXJ5OiAxLCBwb3NzaWJsZTogMiB9O1xuICAgICAgcmV0dXJuIGNvbmZpZGVuY2VPcmRlclthLmNvbmZpZGVuY2VdIC0gY29uZmlkZW5jZU9yZGVyW2IuY29uZmlkZW5jZV07XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHVuaXF1ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWfuuS6juaooeW8j+WMuemFjeWPkeeOsFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkaXNjb3ZlckJ5UGF0dGVybnMocmVwb1Jvb3Q6IHN0cmluZyk6IFByb21pc2U8RW50cnlwb2ludFtdPiB7XG4gICAgY29uc3QgZW50cnlwb2ludHM6IEVudHJ5cG9pbnRbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgeyBwYXR0ZXJuLCB0eXBlLCBjb25maWRlbmNlLCBkZXNjcmlwdGlvbiwgbGFuZ3VhZ2UsIGZyYW1ld29yayB9IG9mIEVOVFJZUE9JTlRfUEFUVEVSTlMpIHtcbiAgICAgIC8vIOWkhOeQhumAmumFjeespuaooeW8j1xuICAgICAgaWYgKHBhdHRlcm4uaW5jbHVkZXMoJ1suLi5dJykpIHtcbiAgICAgICAgLy8g6YCa6YWN56ym5qih5byP77yM6ZyA6KaB5omr5o+P55uu5b2VXG4gICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCB0aGlzLmRpc2NvdmVyV2lsZGNhcmRQYXR0ZXJucyhyZXBvUm9vdCwgcGF0dGVybik7XG4gICAgICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuICAgICAgICAgIGVudHJ5cG9pbnRzLnB1c2goe1xuICAgICAgICAgICAgcGF0aDogbWF0Y2gsXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgY29uZmlkZW5jZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbi5yZXBsYWNlKCdbLi4uXScsIHBhdGguYmFzZW5hbWUobWF0Y2gpKSxcbiAgICAgICAgICAgIGxhbmd1YWdlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyDnsr7noa7mqKHlvI9cbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsIHBhdHRlcm4pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGZzLmFjY2VzcyhmaWxlUGF0aCk7XG4gICAgICAgICAgZW50cnlwb2ludHMucHVzaCh7XG4gICAgICAgICAgICBwYXRoOiBwYXR0ZXJuLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGNvbmZpZGVuY2UsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgIGxhbmd1YWdlLFxuICAgICAgICAgICAgLi4uKGZyYW1ld29yayA/IHsgZGVzY3JpcHRpb246IGAke2Rlc2NyaXB0aW9ufSAoJHtmcmFtZXdvcmt9KWAgfSA6IHt9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8g5paH5Lu25LiN5a2Y5ZyoXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGVudHJ5cG9pbnRzO1xuICB9XG4gIFxuICAvKipcbiAgICog5Y+R546w6YCa6YWN56ym5qih5byP5Yy56YWNXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRpc2NvdmVyV2lsZGNhcmRQYXR0ZXJucyhcbiAgICByZXBvUm9vdDogc3RyaW5nLFxuICAgIHBhdHRlcm46IHN0cmluZ1xuICApOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgbWF0Y2hlczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBiYXNlUGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvXFxbLi4uXFxdL2csICcqJyk7XG4gICAgXG4gICAgLy8g566A5Y2V5a6e546w77ya5omr5o+P5bi46KeB55uu5b2VXG4gICAgY29uc3Qgc2VhcmNoRGlycyA9IFsnc3JjJywgJ2NtZCcsICdiaW4nLCAnYXBwJywgJyddO1xuICAgIFxuICAgIGZvciAoY29uc3QgZGlyIG9mIHNlYXJjaERpcnMpIHtcbiAgICAgIGNvbnN0IHNlYXJjaFBhdGggPSBkaXIgPyBwYXRoLmpvaW4ocmVwb1Jvb3QsIGRpcikgOiByZXBvUm9vdDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKHNlYXJjaFBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgaWYgKGVudHJ5LmlzRmlsZSgpICYmIHRoaXMubWF0Y2hlc1BhdHRlcm4oZW50cnkubmFtZSwgYmFzZVBhdHRlcm4pKSB7XG4gICAgICAgICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBkaXIgPyBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKSA6IGVudHJ5Lm5hbWU7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2gocmVsYXRpdmVQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDnm67lvZXkuI3lrZjlnKhcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG1hdGNoZXMuc2xpY2UoMCwgNSk7IC8vIOmZkOWItui/lOWbnuaVsOmHj1xuICB9XG4gIFxuICAvKipcbiAgICog5Z+65LqOIHBhY2thZ2UuanNvbiBiaW4g5Y+R546wXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRpc2NvdmVyUGFja2FnZUJpbihyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxFbnRyeXBvaW50W10+IHtcbiAgICBjb25zdCBlbnRyeXBvaW50czogRW50cnlwb2ludFtdID0gW107XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ3BhY2thZ2UuanNvbicpO1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHBhY2thZ2VKc29uUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICBcbiAgICAgIC8vIGJpbiDlrZfmrrXlj6/ku6XmmK/lrZfnrKbkuLLmiJblr7nosaFcbiAgICAgIGlmICh0eXBlb2YgcGFja2FnZUpzb24uYmluID09PSAnc3RyaW5nJykge1xuICAgICAgICBlbnRyeXBvaW50cy5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBwYWNrYWdlSnNvbi5iaW4sXG4gICAgICAgICAgdHlwZTogJ2NsaScsXG4gICAgICAgICAgY29uZmlkZW5jZTogJ3ByaW1hcnknLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQ0xJIGJpbmFyeTogJHtwYXRoLmJhc2VuYW1lKHBhY2thZ2VKc29uLmJpbil9YCxcbiAgICAgICAgICBsYW5ndWFnZTogJ0phdmFTY3JpcHQnLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHBhY2thZ2VKc29uLmJpbiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZm9yIChjb25zdCBbbmFtZSwgYmluUGF0aF0gb2YgT2JqZWN0LmVudHJpZXMocGFja2FnZUpzb24uYmluKSkge1xuICAgICAgICAgIGVudHJ5cG9pbnRzLnB1c2goe1xuICAgICAgICAgICAgcGF0aDogYmluUGF0aCBhcyBzdHJpbmcsXG4gICAgICAgICAgICB0eXBlOiAnY2xpJyxcbiAgICAgICAgICAgIGNvbmZpZGVuY2U6ICdwcmltYXJ5JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQ0xJIGJpbmFyeTogJHtuYW1lfWAsXG4gICAgICAgICAgICBsYW5ndWFnZTogJ0phdmFTY3JpcHQnLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBwYWNrYWdlLmpzb24g5LiN5a2Y5Zyo5oiW6Kej5p6Q5aSx6LSlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiBlbnRyeXBvaW50cztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWfuuS6jiBweXByb2plY3QudG9tbCDlj5HnjrBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGlzY292ZXJQeXByb2plY3RFbnRyeXBvaW50cyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxFbnRyeXBvaW50W10+IHtcbiAgICBjb25zdCBlbnRyeXBvaW50czogRW50cnlwb2ludFtdID0gW107XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHB5cHJvamVjdFBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsICdweXByb2plY3QudG9tbCcpO1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHB5cHJvamVjdFBhdGgsICd1dGYtOCcpO1xuICAgICAgXG4gICAgICAvLyDmo4DmtYsgUG9ldHJ5IHNjcmlwdHNcbiAgICAgIGNvbnN0IHNjcmlwdHNNYXRjaCA9IGNvbnRlbnQubWF0Y2goL1xcW3Rvb2xcXC5wb2V0cnlcXC5zY3JpcHRzXFxdKFtcXHNcXFNdKj8pKD89XFxbfCQpLyk7XG4gICAgICBpZiAoc2NyaXB0c01hdGNoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSBzY3JpcHRzTWF0Y2hbMV07XG4gICAgICAgIGNvbnN0IHNjcmlwdExpbmVzID0gc2NyaXB0cy5zcGxpdCgnXFxuJykuZmlsdGVyKGxpbmUgPT4gbGluZS5pbmNsdWRlcygnPScpKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIHNjcmlwdExpbmVzKSB7XG4gICAgICAgICAgY29uc3QgW25hbWUsIHBhdGhdID0gbGluZS5zcGxpdCgnPScpLm1hcChzID0+IHMudHJpbSgpLnJlcGxhY2UoL1tcIiddL2csICcnKSk7XG4gICAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgIGVudHJ5cG9pbnRzLnB1c2goe1xuICAgICAgICAgICAgICBwYXRoOiBwYXRoLnNwbGl0KCc6JylbMF0sIC8vIOWOu+aOieWHveaVsOWQjemDqOWIhlxuICAgICAgICAgICAgICB0eXBlOiAnY2xpJyxcbiAgICAgICAgICAgICAgY29uZmlkZW5jZTogJ3ByaW1hcnknLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFB5dGhvbiBDTEk6ICR7bmFtZX1gLFxuICAgICAgICAgICAgICBsYW5ndWFnZTogJ1B5dGhvbicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5rWLIGNvbnNvbGVfc2NyaXB0c1xuICAgICAgY29uc3QgY29uc29sZVNjcmlwdHNNYXRjaCA9IGNvbnRlbnQubWF0Y2goL2NvbnNvbGVfc2NyaXB0c1xccyo9XFxzKlxcWyhbXFxzXFxTXSo/KVxcXS8pO1xuICAgICAgaWYgKGNvbnNvbGVTY3JpcHRzTWF0Y2gpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0cyA9IGNvbnNvbGVTY3JpcHRzTWF0Y2hbMV07XG4gICAgICAgIGNvbnN0IHNjcmlwdExpbmVzID0gc2NyaXB0cy5zcGxpdCgnLCcpLm1hcChzID0+IHMudHJpbSgpLnJlcGxhY2UoL1tcIiddL2csICcnKSk7XG4gICAgICAgIGZvciAoY29uc3Qgc2NyaXB0IG9mIHNjcmlwdExpbmVzKSB7XG4gICAgICAgICAgaWYgKHNjcmlwdC5pbmNsdWRlcygnPScpKSB7XG4gICAgICAgICAgICBjb25zdCBbbmFtZSwgcGF0aF0gPSBzY3JpcHQuc3BsaXQoJz0nKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgICAgICAgICBlbnRyeXBvaW50cy5wdXNoKHtcbiAgICAgICAgICAgICAgcGF0aDogcGF0aC5zcGxpdCgnOicpWzBdLFxuICAgICAgICAgICAgICB0eXBlOiAnY2xpJyxcbiAgICAgICAgICAgICAgY29uZmlkZW5jZTogJ3ByaW1hcnknLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFB5dGhvbiBDTEk6ICR7bmFtZX1gLFxuICAgICAgICAgICAgICBsYW5ndWFnZTogJ1B5dGhvbicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIHB5cHJvamVjdC50b21sIOS4jeWtmOWcqFxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZW50cnlwb2ludHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDln7rkuo4gQ2FyZ28udG9tbCDlj5HnjrBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGlzY292ZXJDYXJnb0VudHJ5cG9pbnRzKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPEVudHJ5cG9pbnRbXT4ge1xuICAgIGNvbnN0IGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W10gPSBbXTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgY2FyZ29QYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAnQ2FyZ28udG9tbCcpO1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGNhcmdvUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBcbiAgICAgIC8vIOajgOa1iyBbW2Jpbl1dXG4gICAgICBjb25zdCBiaW5NYXRjaGVzID0gY29udGVudC5tYXRjaCgvXFxbXFxbYmluXFxdXFxdKFtcXHNcXFNdKj8pKD89XFxbXFxbfCQpL2cpO1xuICAgICAgaWYgKGJpbk1hdGNoZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBiaW5NYXRjaGVzKSB7XG4gICAgICAgICAgY29uc3QgbmFtZU1hdGNoID0gbWF0Y2gubWF0Y2goL25hbWVcXHMqPVxccypbXCInXShbXlwiJ10rKVtcIiddLyk7XG4gICAgICAgICAgY29uc3QgcGF0aE1hdGNoID0gbWF0Y2gubWF0Y2goL3BhdGhcXHMqPVxccypbXCInXShbXlwiJ10rKVtcIiddLyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHBhdGhNYXRjaCkge1xuICAgICAgICAgICAgZW50cnlwb2ludHMucHVzaCh7XG4gICAgICAgICAgICAgIHBhdGg6IHBhdGhNYXRjaFsxXSxcbiAgICAgICAgICAgICAgdHlwZTogJ2NsaScsXG4gICAgICAgICAgICAgIGNvbmZpZGVuY2U6ICdwcmltYXJ5JyxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBSdXN0IGJpbmFyeTogJHtuYW1lTWF0Y2ggPyBuYW1lTWF0Y2hbMV0gOiBwYXRoLmJhc2VuYW1lKHBhdGhNYXRjaFsxXSl9YCxcbiAgICAgICAgICAgICAgbGFuZ3VhZ2U6ICdSdXN0JyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gQ2FyZ28udG9tbCDkuI3lrZjlnKhcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGVudHJ5cG9pbnRzO1xuICB9XG4gIFxuICAvKipcbiAgICog5Y676YeNXG4gICAqL1xuICBwcml2YXRlIGRlZHVwbGljYXRlKGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W10pOiBFbnRyeXBvaW50W10ge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB1bmlxdWU6IEVudHJ5cG9pbnRbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgZW50cnlwb2ludCBvZiBlbnRyeXBvaW50cykge1xuICAgICAgaWYgKCFzZWVuLmhhcyhlbnRyeXBvaW50LnBhdGgpKSB7XG4gICAgICAgIHNlZW4uYWRkKGVudHJ5cG9pbnQucGF0aCk7XG4gICAgICAgIHVuaXF1ZS5wdXNoKGVudHJ5cG9pbnQpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdW5pcXVlO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5qih5byP5Yy56YWNXG4gICAqL1xuICBwcml2YXRlIG1hdGNoZXNQYXR0ZXJuKGZpbGVuYW1lOiBzdHJpbmcsIHBhdHRlcm46IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIC8vIOeugOWNlemAmumFjeespuWMuemFjVxuICAgIGlmIChwYXR0ZXJuID09PSAnKicpIHJldHVybiB0cnVlO1xuICAgIGlmIChwYXR0ZXJuLnN0YXJ0c1dpdGgoJyonKSkgcmV0dXJuIGZpbGVuYW1lLmVuZHNXaXRoKHBhdHRlcm4uc2xpY2UoMSkpO1xuICAgIGlmIChwYXR0ZXJuLmVuZHNXaXRoKCcqJykpIHJldHVybiBmaWxlbmFtZS5zdGFydHNXaXRoKHBhdHRlcm4uc2xpY2UoMCwgLTEpKTtcbiAgICByZXR1cm4gZmlsZW5hbWUgPT09IHBhdHRlcm47XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu65YWl5Y+j54K55Y+R546w5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbnRyeXBvaW50RGlzY292ZXJ5KGNvbmZpZz86IEVudHJ5cG9pbnREaXNjb3ZlcnlDb25maWcpOiBFbnRyeXBvaW50RGlzY292ZXJ5IHtcbiAgcmV0dXJuIG5ldyBFbnRyeXBvaW50RGlzY292ZXJ5KGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5Y+R546w5YWl5Y+j54K5XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkaXNjb3ZlckVudHJ5cG9pbnRzKFxuICByZXBvUm9vdDogc3RyaW5nLFxuICBjb25maWc/OiBFbnRyeXBvaW50RGlzY292ZXJ5Q29uZmlnXG4pOiBQcm9taXNlPEVudHJ5cG9pbnRbXT4ge1xuICBjb25zdCBkaXNjb3ZlcnkgPSBuZXcgRW50cnlwb2ludERpc2NvdmVyeShjb25maWcpO1xuICByZXR1cm4gYXdhaXQgZGlzY292ZXJ5LmRpc2NvdmVyKHJlcG9Sb290KTtcbn1cbiJdfQ==