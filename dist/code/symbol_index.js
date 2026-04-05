"use strict";
/**
 * Symbol Index - 符号索引
 *
 * 职责：
 * 1. 扫描 TS/JS + Python 文件
 * 2. 提取函数、类、方法、接口、类型、变量
 * 3. 建立 name -> definitions[] 索引
 * 4. 建立 file -> symbols[] 索引
 * 5. 记录语言、位置、导出性、签名摘要
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
exports.SymbolIndexer = void 0;
exports.createSymbolIndexer = createSymbolIndexer;
exports.buildSymbolIndex = buildSymbolIndex;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ============================================================================
// 符号提取器
// ============================================================================
class SymbolIndexer {
    constructor(config = {}) {
        this.config = {
            languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
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
            excludeFiles: config.excludeFiles ?? [
                '*.d.ts',
                '*.min.js',
                '*.bundle.js',
            ],
            maxDepth: config.maxDepth ?? 10,
        };
    }
    /**
     * 构建符号索引
     */
    async buildIndex(repoRoot) {
        const index = {
            repoRoot,
            byName: new Map(),
            byFile: new Map(),
            byKind: new Map(),
            byLanguage: new Map(),
            exported: [],
            indexedAt: Date.now(),
            stats: {
                totalSymbols: 0,
                byKind: {},
                byLanguage: {},
                byFile: {},
            },
        };
        // 扫描文件
        const files = await this.scanFiles(repoRoot);
        // 提取符号
        for (const file of files) {
            const result = await this.extractSymbols(file, repoRoot);
            for (const symbol of result.symbols) {
                this.addSymbolToIndex(index, symbol);
            }
        }
        // 计算统计
        this.calculateStats(index);
        return index;
    }
    /**
     * 扫描文件
     */
    async scanFiles(repoRoot) {
        const files = [];
        await this.walkDirectory(repoRoot, async (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            // 检查语言
            if (!this.isSupportedLanguage(ext))
                return;
            // 检查排除
            if (this.shouldExclude(filePath))
                return;
            files.push(filePath);
        });
        return files;
    }
    /**
     * 提取符号
     */
    async extractSymbols(filePath, repoRoot) {
        const ext = path.extname(filePath).toLowerCase();
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            switch (ext) {
                case '.ts':
                case '.tsx':
                    return this.extractTypeScriptSymbols(filePath, content, repoRoot);
                case '.js':
                case '.jsx':
                    return this.extractJavaScriptSymbols(filePath, content, repoRoot);
                case '.py':
                    return this.extractPythonSymbols(filePath, content, repoRoot);
                default:
                    return { symbols: [], errors: [] };
            }
        }
        catch (error) {
            return {
                symbols: [],
                errors: [`Failed to read ${filePath}: ${error}`],
            };
        }
    }
    /**
     * 提取 TypeScript 符号
     */
    extractTypeScriptSymbols(filePath, content, repoRoot) {
        const symbols = [];
        const errors = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            // 函数声明
            const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
            if (funcMatch) {
                symbols.push(this.createSymbol({
                    name: funcMatch[1],
                    kind: 'function',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    exported: line.includes('export'),
                    signature: this.extractFunctionSignature(line),
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
            // 类声明
            const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
            if (classMatch) {
                symbols.push(this.createSymbol({
                    name: classMatch[1],
                    kind: 'class',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    exported: line.includes('export'),
                    signature: this.extractClassSignature(line),
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
            // 接口声明
            const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                symbols.push(this.createSymbol({
                    name: interfaceMatch[1],
                    kind: 'interface',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    exported: line.includes('export'),
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
            // 类型声明
            const typeMatch = line.match(/^(?:export\s+)?type\s+(\w+)/);
            if (typeMatch) {
                symbols.push(this.createSymbol({
                    name: typeMatch[1],
                    kind: 'type',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    exported: line.includes('export'),
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
            // 常量/变量声明
            const varMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/);
            if (varMatch) {
                symbols.push(this.createSymbol({
                    name: varMatch[1],
                    kind: 'variable',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    exported: line.includes('export'),
                    signature: this.extractVariableSignature(line),
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
            // 类方法
            const methodMatch = line.match(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
            if (methodMatch && !line.trim().startsWith('function')) {
                symbols.push(this.createSymbol({
                    name: methodMatch[1],
                    kind: 'method',
                    file: filePath,
                    line: lineNum,
                    language: 'TypeScript',
                    scope: 'class',
                    evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
                }));
            }
        }
        return { symbols, errors };
    }
    /**
     * 提取 JavaScript 符号
     */
    extractJavaScriptSymbols(filePath, content, repoRoot) {
        // JavaScript 提取逻辑与 TypeScript 类似，但更简单
        return this.extractTypeScriptSymbols(filePath, content, repoRoot);
    }
    /**
     * 提取 Python 符号
     */
    extractPythonSymbols(filePath, content, repoRoot) {
        const symbols = [];
        const errors = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmedLine = line.trim();
            // 跳过注释和空行
            if (trimmedLine.startsWith('#') || !trimmedLine)
                continue;
            // 函数定义
            const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\(/);
            if (funcMatch) {
                symbols.push(this.createSymbol({
                    name: funcMatch[1],
                    kind: 'function',
                    file: filePath,
                    line: lineNum,
                    language: 'Python',
                    exported: !funcMatch[1].startsWith('_'),
                    signature: this.extractFunctionSignature(trimmedLine),
                    evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
                }));
            }
            // 类定义
            const classMatch = trimmedLine.match(/^class\s+(\w+)/);
            if (classMatch) {
                symbols.push(this.createSymbol({
                    name: classMatch[1],
                    kind: 'class',
                    file: filePath,
                    line: lineNum,
                    language: 'Python',
                    exported: !classMatch[1].startsWith('_'),
                    signature: this.extractClassSignature(trimmedLine),
                    evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
                }));
            }
            // 模块级变量
            const varMatch = trimmedLine.match(/^(\w+)\s*=/);
            if (varMatch && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t')) {
                symbols.push(this.createSymbol({
                    name: varMatch[1],
                    kind: 'variable',
                    file: filePath,
                    line: lineNum,
                    language: 'Python',
                    exported: !varMatch[1].startsWith('_'),
                    evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
                }));
            }
            // 导入
            const importMatch = trimmedLine.match(/^(?:from\s+\S+\s+)?import\s+(.+)/);
            if (importMatch) {
                const imports = importMatch[1].split(',').map(s => s.trim());
                for (const imp of imports) {
                    const nameMatch = imp.match(/(\w+)(?:\s+as\s+\w+)?/);
                    if (nameMatch) {
                        symbols.push(this.createSymbol({
                            name: nameMatch[1],
                            kind: 'module',
                            file: filePath,
                            line: lineNum,
                            language: 'Python',
                            evidence: { type: 'import', content: trimmedLine, detectedAt: Date.now() },
                        }));
                    }
                }
            }
        }
        return { symbols, errors };
    }
    /**
     * 添加符号到索引
     */
    addSymbolToIndex(index, symbol) {
        // byName
        if (!index.byName.has(symbol.name)) {
            index.byName.set(symbol.name, []);
        }
        index.byName.get(symbol.name).push(symbol);
        // byFile
        if (!index.byFile.has(symbol.file)) {
            index.byFile.set(symbol.file, []);
        }
        index.byFile.get(symbol.file).push(symbol);
        // byKind
        if (!index.byKind.has(symbol.kind)) {
            index.byKind.set(symbol.kind, []);
        }
        index.byKind.get(symbol.kind).push(symbol);
        // byLanguage
        if (!index.byLanguage.has(symbol.language)) {
            index.byLanguage.set(symbol.language, []);
        }
        index.byLanguage.get(symbol.language).push(symbol);
        // exported
        if (symbol.exported) {
            index.exported.push(symbol);
        }
    }
    /**
     * 计算统计
     */
    calculateStats(index) {
        index.stats.totalSymbols = index.exported.length +
            Array.from(index.byKind.values()).reduce((sum, arr) => sum + arr.length, 0) - index.exported.length;
        for (const [kind, symbols] of index.byKind.entries()) {
            index.stats.byKind[kind] = symbols.length;
        }
        for (const [language, symbols] of index.byLanguage.entries()) {
            index.stats.byLanguage[language] = symbols.length;
        }
        for (const [file, symbols] of index.byFile.entries()) {
            index.stats.byFile[file] = symbols.length;
        }
    }
    /**
     * 创建符号
     */
    createSymbol(symbol) {
        return {
            name: '',
            kind: 'function',
            file: '',
            line: 0,
            language: 'unknown',
            ...symbol,
        };
    }
    /**
     * 提取函数签名
     */
    extractFunctionSignature(line) {
        const match = line.match(/(?:function|def)\s+\w+\s*\([^)]*\)/);
        return match ? match[0] : line.slice(0, 100);
    }
    /**
     * 提取类签名
     */
    extractClassSignature(line) {
        const match = line.match(/class\s+\w+(?:\s+extends\s+\w+)?/);
        return match ? match[0] : line.slice(0, 100);
    }
    /**
     * 提取变量签名
     */
    extractVariableSignature(line) {
        const match = line.match(/(?:const|let|var)\s+\w+\s*[:=]/);
        return match ? match[0] : line.slice(0, 50);
    }
    /**
     * 检查是否支持的语言
     */
    isSupportedLanguage(ext) {
        const supported = ['.ts', '.tsx', '.js', '.jsx', '.py'];
        return supported.includes(ext);
    }
    /**
     * 检查是否应该排除
     */
    shouldExclude(filePath) {
        // 检查排除目录
        for (const dir of this.config.excludeDirs) {
            if (filePath.includes(dir))
                return true;
        }
        // 检查排除文件
        for (const pattern of this.config.excludeFiles) {
            if (pattern.startsWith('*')) {
                if (filePath.endsWith(pattern.slice(1)))
                    return true;
            }
        }
        return false;
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
                if (this.shouldExclude(fullPath))
                    continue;
                if (entry.isFile()) {
                    await callback(fullPath);
                }
                else if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, callback, depth + 1);
                }
            }
        }
        catch {
            // 忽略错误
        }
    }
}
exports.SymbolIndexer = SymbolIndexer;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建符号索引器
 */
function createSymbolIndexer(config) {
    return new SymbolIndexer(config);
}
/**
 * 快速构建符号索引
 */
async function buildSymbolIndex(repoRoot) {
    const indexer = new SymbolIndexer();
    return await indexer.buildIndex(repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9sX2luZGV4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvZGUvc3ltYm9sX2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFnQkgsa0RBRUM7QUFLRCw0Q0FHQztBQTdnQkQsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQWdDN0IsK0VBQStFO0FBQy9FLFFBQVE7QUFDUiwrRUFBK0U7QUFFL0UsTUFBYSxhQUFhO0lBR3hCLFlBQVksU0FBOEIsRUFBRTtRQUMxQyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQztZQUNyRSxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsSUFBSTtnQkFDakMsY0FBYztnQkFDZCxhQUFhO2dCQUNiLE1BQU07Z0JBQ04sTUFBTTtnQkFDTixPQUFPO2dCQUNQLFVBQVU7Z0JBQ1YsT0FBTztnQkFDUCxNQUFNO2dCQUNOLE9BQU87YUFDUjtZQUNELFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxJQUFJO2dCQUNuQyxRQUFRO2dCQUNSLFVBQVU7Z0JBQ1YsYUFBYTthQUNkO1lBQ0QsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLElBQUksRUFBRTtTQUNoQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxRQUFnQjtRQUMvQixNQUFNLEtBQUssR0FBZ0I7WUFDekIsUUFBUTtZQUNSLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNqQixNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7WUFDakIsTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1lBQ2pCLFVBQVUsRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNyQixRQUFRLEVBQUUsRUFBRTtZQUNa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LENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUNELEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFNUMsU0FBUztRQUNULElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNuQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFDRCxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTVDLFNBQVM7UUFDVCxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbkMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0QsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUU1QyxhQUFhO1FBQ2IsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzNDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFD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QUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUM7b0JBQUUsU0FBUztnQkFFM0MsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztvQkFDbkIsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzNCLENBQUM7cUJBQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztvQkFDL0IsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUMxRCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxPQUFPO1FBQ1QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXJkRCxzQ0FxZEM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLE1BQTRCO0lBQzlELE9BQU8sSUFBSSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGdCQUFnQixDQUFDLFFBQWdCO0lBQ3JELE1BQU0sT0FBTyxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7SUFDcEMsT0FBTyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDNUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU3ltYm9sIEluZGV4IC0g56ym5Y+357Si5byVXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5omr5o+PIFRTL0pTICsgUHl0aG9uIOaWh+S7tlxuICogMi4g5o+Q5Y+W5Ye95pWw44CB57G744CB5pa55rOV44CB5o6l5Y+j44CB57G75Z6L44CB5Y+Y6YePXG4gKiAzLiDlu7rnq4sgbmFtZSAtPiBkZWZpbml0aW9uc1tdIOe0ouW8lVxuICogNC4g5bu656uLIGZpbGUgLT4gc3ltYm9sc1tdIOe0ouW8lVxuICogNS4g6K6w5b2V6K+t6KiA44CB5L2N572u44CB5a+85Ye65oCn44CB562+5ZCN5pGY6KaBXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IFN5bWJvbERlZmluaXRpb24sIFN5bWJvbEluZGV4LCBTeW1ib2xLaW5kLCBTeW1ib2xFdmlkZW5jZSB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDntKLlvJXlmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW1ib2xJbmRleGVyQ29uZmlnIHtcbiAgLyoqIOWMheWQq+eahOivreiogCAqL1xuICBsYW5ndWFnZXM/OiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDmjpLpmaTnmoTnm67lvZUgKi9cbiAgZXhjbHVkZURpcnM/OiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDmjpLpmaTnmoTmlofku7YgKi9cbiAgZXhjbHVkZUZpbGVzPzogc3RyaW5nW107XG4gIFxuICAvKiog5pyA5aSn5rex5bqmICovXG4gIG1heERlcHRoPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIOespuWPt+aPkOWPlue7k+aenFxuICovXG5pbnRlcmZhY2UgRXh0cmFjdFJlc3VsdCB7XG4gIHN5bWJvbHM6IFN5bWJvbERlZmluaXRpb25bXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g56ym5Y+35o+Q5Y+W5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBTeW1ib2xJbmRleGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFN5bWJvbEluZGV4ZXJDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBTeW1ib2xJbmRleGVyQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGxhbmd1YWdlczogY29uZmlnLmxhbmd1YWdlcyA/PyBbJ1R5cGVTY3JpcHQnLCAnSmF2YVNjcmlwdCcsICdQeXRob24nXSxcbiAgICAgIGV4Y2x1ZGVEaXJzOiBjb25maWcuZXhjbHVkZURpcnMgPz8gW1xuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgICAgJ19fcHljYWNoZV9fJyxcbiAgICAgICAgJy5naXQnLFxuICAgICAgICAnZGlzdCcsXG4gICAgICAgICdidWlsZCcsXG4gICAgICAgICdjb3ZlcmFnZScsXG4gICAgICAgICcubmV4dCcsXG4gICAgICAgICd2ZW52JyxcbiAgICAgICAgJy52ZW52JyxcbiAgICAgIF0sXG4gICAgICBleGNsdWRlRmlsZXM6IGNvbmZpZy5leGNsdWRlRmlsZXMgPz8gW1xuICAgICAgICAnKi5kLnRzJyxcbiAgICAgICAgJyoubWluLmpzJyxcbiAgICAgICAgJyouYnVuZGxlLmpzJyxcbiAgICAgIF0sXG4gICAgICBtYXhEZXB0aDogY29uZmlnLm1heERlcHRoID8/IDEwLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rnrKblj7fntKLlvJVcbiAgICovXG4gIGFzeW5jIGJ1aWxkSW5kZXgocmVwb1Jvb3Q6IHN0cmluZyk6IFByb21pc2U8U3ltYm9sSW5kZXg+IHtcbiAgICBjb25zdCBpbmRleDogU3ltYm9sSW5kZXggPSB7XG4gICAgICByZXBvUm9vdCxcbiAgICAgIGJ5TmFtZTogbmV3IE1hcCgpLFxuICAgICAgYnlGaWxlOiBuZXcgTWFwKCksXG4gICAgICBieUtpbmQ6IG5ldyBNYXAoKSxcbiAgICAgIGJ5TGFuZ3VhZ2U6IG5ldyBNYXAoKSxcbiAgICAgIGV4cG9ydGVkOiBbXSxcbiAgICAgIGluZGV4ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHRvdGFsU3ltYm9sczogMCxcbiAgICAgICAgYnlLaW5kOiB7fSBhcyBhbnksXG4gICAgICAgIGJ5TGFuZ3VhZ2U6IHt9LFxuICAgICAgICBieUZpbGU6IHt9LFxuICAgICAgfSxcbiAgICB9O1xuICAgIFxuICAgIC8vIOaJq+aPj+aWh+S7tlxuICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5zY2FuRmlsZXMocmVwb1Jvb3QpO1xuICAgIFxuICAgIC8vIOaPkOWPluespuWPt1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leHRyYWN0U3ltYm9scyhmaWxlLCByZXBvUm9vdCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3Qgc3ltYm9sIG9mIHJlc3VsdC5zeW1ib2xzKSB7XG4gICAgICAgIHRoaXMuYWRkU3ltYm9sVG9JbmRleChpbmRleCwgc3ltYm9sKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g6K6h566X57uf6K6hXG4gICAgdGhpcy5jYWxjdWxhdGVTdGF0cyhpbmRleCk7XG4gICAgXG4gICAgcmV0dXJuIGluZGV4O1xuICB9XG4gIFxuICAvKipcbiAgICog5omr5o+P5paH5Lu2XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNjYW5GaWxlcyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGF3YWl0IHRoaXMud2Fsa0RpcmVjdG9yeShyZXBvUm9vdCwgYXN5bmMgKGZpbGVQYXRoKSA9PiB7XG4gICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBcbiAgICAgIC8vIOajgOafpeivreiogFxuICAgICAgaWYgKCF0aGlzLmlzU3VwcG9ydGVkTGFuZ3VhZ2UoZXh0KSkgcmV0dXJuO1xuICAgICAgXG4gICAgICAvLyDmo4Dmn6XmjpLpmaRcbiAgICAgIGlmICh0aGlzLnNob3VsZEV4Y2x1ZGUoZmlsZVBhdGgpKSByZXR1cm47XG4gICAgICBcbiAgICAgIGZpbGVzLnB1c2goZmlsZVBhdGgpO1xuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBmaWxlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaPkOWPluespuWPt1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleHRyYWN0U3ltYm9scyhmaWxlUGF0aDogc3RyaW5nLCByZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxFeHRyYWN0UmVzdWx0PiB7XG4gICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKS50b0xvd2VyQ2FzZSgpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgXG4gICAgICBzd2l0Y2ggKGV4dCkge1xuICAgICAgICBjYXNlICcudHMnOlxuICAgICAgICBjYXNlICcudHN4JzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5leHRyYWN0VHlwZVNjcmlwdFN5bWJvbHMoZmlsZVBhdGgsIGNvbnRlbnQsIHJlcG9Sb290KTtcbiAgICAgICAgY2FzZSAnLmpzJzpcbiAgICAgICAgY2FzZSAnLmpzeCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXh0cmFjdEphdmFTY3JpcHRTeW1ib2xzKGZpbGVQYXRoLCBjb250ZW50LCByZXBvUm9vdCk7XG4gICAgICAgIGNhc2UgJy5weSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXh0cmFjdFB5dGhvblN5bWJvbHMoZmlsZVBhdGgsIGNvbnRlbnQsIHJlcG9Sb290KTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4geyBzeW1ib2xzOiBbXSwgZXJyb3JzOiBbXSB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzeW1ib2xzOiBbXSxcbiAgICAgICAgZXJyb3JzOiBbYEZhaWxlZCB0byByZWFkICR7ZmlsZVBhdGh9OiAke2Vycm9yfWBdLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5YgVHlwZVNjcmlwdCDnrKblj7dcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFR5cGVTY3JpcHRTeW1ib2xzKFxuICAgIGZpbGVQYXRoOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIHJlcG9Sb290OiBzdHJpbmdcbiAgKTogRXh0cmFjdFJlc3VsdCB7XG4gICAgY29uc3Qgc3ltYm9sczogU3ltYm9sRGVmaW5pdGlvbltdID0gW107XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgY29uc3QgbGluZU51bSA9IGkgKyAxO1xuICAgICAgXG4gICAgICAvLyDlh73mlbDlo7DmmI5cbiAgICAgIGNvbnN0IGZ1bmNNYXRjaCA9IGxpbmUubWF0Y2goL14oPzpleHBvcnRcXHMrKT8oPzphc3luY1xccyspP2Z1bmN0aW9uXFxzKyhcXHcrKVxccypcXCgvKTtcbiAgICAgIGlmIChmdW5jTWF0Y2gpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlU3ltYm9sKHtcbiAgICAgICAgICBuYW1lOiBmdW5jTWF0Y2hbMV0sXG4gICAgICAgICAga2luZDogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgICAgICBsaW5lOiBsaW5lTnVtLFxuICAgICAgICAgIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcsXG4gICAgICAgICAgZXhwb3J0ZWQ6IGxpbmUuaW5jbHVkZXMoJ2V4cG9ydCcpLFxuICAgICAgICAgIHNpZ25hdHVyZTogdGhpcy5leHRyYWN0RnVuY3Rpb25TaWduYXR1cmUobGluZSksXG4gICAgICAgICAgZXZpZGVuY2U6IHsgdHlwZTogJ3N0YXRpY19zY2FuJywgY29udGVudDogbGluZS50cmltKCksIGRldGVjdGVkQXQ6IERhdGUubm93KCkgfSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDnsbvlo7DmmI5cbiAgICAgIGNvbnN0IGNsYXNzTWF0Y2ggPSBsaW5lLm1hdGNoKC9eKD86ZXhwb3J0XFxzKyk/Y2xhc3NcXHMrKFxcdyspLyk7XG4gICAgICBpZiAoY2xhc3NNYXRjaCkge1xuICAgICAgICBzeW1ib2xzLnB1c2godGhpcy5jcmVhdGVTeW1ib2woe1xuICAgICAgICAgIG5hbWU6IGNsYXNzTWF0Y2hbMV0sXG4gICAgICAgICAga2luZDogJ2NsYXNzJyxcbiAgICAgICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgICAgICBsaW5lOiBsaW5lTnVtLFxuICAgICAgICAgIGxhbmd1YWdlOiAnVHlwZVNjcmlwdCcsXG4gICAgICAgICAgZXhwb3J0ZWQ6IGxpbmUuaW5jbHVkZXMoJ2V4cG9ydCcpLFxuICAgICAgICAgIHNpZ25hdHVyZTogdGhpcy5leHRyYWN0Q2xhc3NTaWduYXR1cmUobGluZSksXG4gICAgICAgICAgZXZpZGVuY2U6IHsgdHlwZTogJ3N0YXRpY19zY2FuJywgY29udGVudDogbGluZS50cmltKCksIGRldGVjdGVkQXQ6IERhdGUubm93KCkgfSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmjqXlj6Plo7DmmI5cbiAgICAgIGNvbnN0IGludGVyZmFjZU1hdGNoID0gbGluZS5tYXRjaCgvXig/OmV4cG9ydFxccyspP2ludGVyZmFjZVxccysoXFx3KykvKTtcbiAgICAgIGlmIChpbnRlcmZhY2VNYXRjaCkge1xuICAgICAgICBzeW1ib2xzLnB1c2godGhpcy5jcmVhdGVTeW1ib2woe1xuICAgICAgICAgIG5hbWU6IGludGVyZmFjZU1hdGNoWzFdLFxuICAgICAgICAgIGtpbmQ6ICdpbnRlcmZhY2UnLFxuICAgICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICAgIGxpbmU6IGxpbmVOdW0sXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyxcbiAgICAgICAgICBleHBvcnRlZDogbGluZS5pbmNsdWRlcygnZXhwb3J0JyksXG4gICAgICAgICAgZXZpZGVuY2U6IHsgdHlwZTogJ3N0YXRpY19zY2FuJywgY29udGVudDogbGluZS50cmltKCksIGRldGVjdGVkQXQ6IERhdGUubm93KCkgfSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDnsbvlnovlo7DmmI5cbiAgICAgIGNvbnN0IHR5cGVNYXRjaCA9IGxpbmUubWF0Y2goL14oPzpleHBvcnRcXHMrKT90eXBlXFxzKyhcXHcrKS8pO1xuICAgICAgaWYgKHR5cGVNYXRjaCkge1xuICAgICAgICBzeW1ib2xzLnB1c2godGhpcy5jcmVhdGVTeW1ib2woe1xuICAgICAgICAgIG5hbWU6IHR5cGVNYXRjaFsxXSxcbiAgICAgICAgICBraW5kOiAndHlwZScsXG4gICAgICAgICAgZmlsZTogZmlsZVBhdGgsXG4gICAgICAgICAgbGluZTogbGluZU51bSxcbiAgICAgICAgICBsYW5ndWFnZTogJ1R5cGVTY3JpcHQnLFxuICAgICAgICAgIGV4cG9ydGVkOiBsaW5lLmluY2x1ZGVzKCdleHBvcnQnKSxcbiAgICAgICAgICBldmlkZW5jZTogeyB0eXBlOiAnc3RhdGljX3NjYW4nLCBjb250ZW50OiBsaW5lLnRyaW0oKSwgZGV0ZWN0ZWRBdDogRGF0ZS5ub3coKSB9LFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOW4uOmHjy/lj5jph4/lo7DmmI5cbiAgICAgIGNvbnN0IHZhck1hdGNoID0gbGluZS5tYXRjaCgvXig/OmV4cG9ydFxccyspPyg/OmNvbnN0fGxldHx2YXIpXFxzKyhcXHcrKVxccypbOj1dLyk7XG4gICAgICBpZiAodmFyTWF0Y2gpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlU3ltYm9sKHtcbiAgICAgICAgICBuYW1lOiB2YXJNYXRjaFsxXSxcbiAgICAgICAgICBraW5kOiAndmFyaWFibGUnLFxuICAgICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICAgIGxpbmU6IGxpbmVOdW0sXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyxcbiAgICAgICAgICBleHBvcnRlZDogbGluZS5pbmNsdWRlcygnZXhwb3J0JyksXG4gICAgICAgICAgc2lnbmF0dXJlOiB0aGlzLmV4dHJhY3RWYXJpYWJsZVNpZ25hdHVyZShsaW5lKSxcbiAgICAgICAgICBldmlkZW5jZTogeyB0eXBlOiAnc3RhdGljX3NjYW4nLCBjb250ZW50OiBsaW5lLnRyaW0oKSwgZGV0ZWN0ZWRBdDogRGF0ZS5ub3coKSB9LFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOexu+aWueazlVxuICAgICAgY29uc3QgbWV0aG9kTWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKyg/OmFzeW5jXFxzKyk/KFxcdyspXFxzKlxcKFteKV0qXFwpXFxzKls6e10vKTtcbiAgICAgIGlmIChtZXRob2RNYXRjaCAmJiAhbGluZS50cmltKCkuc3RhcnRzV2l0aCgnZnVuY3Rpb24nKSkge1xuICAgICAgICBzeW1ib2xzLnB1c2godGhpcy5jcmVhdGVTeW1ib2woe1xuICAgICAgICAgIG5hbWU6IG1ldGhvZE1hdGNoWzFdLFxuICAgICAgICAgIGtpbmQ6ICdtZXRob2QnLFxuICAgICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICAgIGxpbmU6IGxpbmVOdW0sXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdUeXBlU2NyaXB0JyxcbiAgICAgICAgICBzY29wZTogJ2NsYXNzJyxcbiAgICAgICAgICBldmlkZW5jZTogeyB0eXBlOiAnc3RhdGljX3NjYW4nLCBjb250ZW50OiBsaW5lLnRyaW0oKSwgZGV0ZWN0ZWRBdDogRGF0ZS5ub3coKSB9LFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IHN5bWJvbHMsIGVycm9ycyB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+WIEphdmFTY3JpcHQg56ym5Y+3XG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RKYXZhU2NyaXB0U3ltYm9scyhcbiAgICBmaWxlUGF0aDogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IEV4dHJhY3RSZXN1bHQge1xuICAgIC8vIEphdmFTY3JpcHQg5o+Q5Y+W6YC76L6R5LiOIFR5cGVTY3JpcHQg57G75Ly877yM5L2G5pu0566A5Y2VXG4gICAgcmV0dXJuIHRoaXMuZXh0cmFjdFR5cGVTY3JpcHRTeW1ib2xzKGZpbGVQYXRoLCBjb250ZW50LCByZXBvUm9vdCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5YgUHl0aG9uIOespuWPt1xuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0UHl0aG9uU3ltYm9scyhcbiAgICBmaWxlUGF0aDogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IEV4dHJhY3RSZXN1bHQge1xuICAgIGNvbnN0IHN5bWJvbHM6IFN5bWJvbERlZmluaXRpb25bXSA9IFtdO1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGNvbnN0IGxpbmVOdW0gPSBpICsgMTtcbiAgICAgIGNvbnN0IHRyaW1tZWRMaW5lID0gbGluZS50cmltKCk7XG4gICAgICBcbiAgICAgIC8vIOi3s+i/h+azqOmHiuWSjOepuuihjFxuICAgICAgaWYgKHRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAhdHJpbW1lZExpbmUpIGNvbnRpbnVlO1xuICAgICAgXG4gICAgICAvLyDlh73mlbDlrprkuYlcbiAgICAgIGNvbnN0IGZ1bmNNYXRjaCA9IHRyaW1tZWRMaW5lLm1hdGNoKC9eZGVmXFxzKyhcXHcrKVxccypcXCgvKTtcbiAgICAgIGlmIChmdW5jTWF0Y2gpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlU3ltYm9sKHtcbiAgICAgICAgICBuYW1lOiBmdW5jTWF0Y2hbMV0sXG4gICAgICAgICAga2luZDogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgICAgICBsaW5lOiBsaW5lTnVtLFxuICAgICAgICAgIGxhbmd1YWdlOiAnUHl0aG9uJyxcbiAgICAgICAgICBleHBvcnRlZDogIWZ1bmNNYXRjaFsxXS5zdGFydHNXaXRoKCdfJyksXG4gICAgICAgICAgc2lnbmF0dXJlOiB0aGlzLmV4dHJhY3RGdW5jdGlvblNpZ25hdHVyZSh0cmltbWVkTGluZSksXG4gICAgICAgICAgZXZpZGVuY2U6IHsgdHlwZTogJ3N0YXRpY19zY2FuJywgY29udGVudDogdHJpbW1lZExpbmUsIGRldGVjdGVkQXQ6IERhdGUubm93KCkgfSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDnsbvlrprkuYlcbiAgICAgIGNvbnN0IGNsYXNzTWF0Y2ggPSB0cmltbWVkTGluZS5tYXRjaCgvXmNsYXNzXFxzKyhcXHcrKS8pO1xuICAgICAgaWYgKGNsYXNzTWF0Y2gpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlU3ltYm9sKHtcbiAgICAgICAgICBuYW1lOiBjbGFzc01hdGNoWzFdLFxuICAgICAgICAgIGtpbmQ6ICdjbGFzcycsXG4gICAgICAgICAgZmlsZTogZmlsZVBhdGgsXG4gICAgICAgICAgbGluZTogbGluZU51bSxcbiAgICAgICAgICBsYW5ndWFnZTogJ1B5dGhvbicsXG4gICAgICAgICAgZXhwb3J0ZWQ6ICFjbGFzc01hdGNoWzFdLnN0YXJ0c1dpdGgoJ18nKSxcbiAgICAgICAgICBzaWduYXR1cmU6IHRoaXMuZXh0cmFjdENsYXNzU2lnbmF0dXJlKHRyaW1tZWRMaW5lKSxcbiAgICAgICAgICBldmlkZW5jZTogeyB0eXBlOiAnc3RhdGljX3NjYW4nLCBjb250ZW50OiB0cmltbWVkTGluZSwgZGV0ZWN0ZWRBdDogRGF0ZS5ub3coKSB9LFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaooeWdl+e6p+WPmOmHj1xuICAgICAgY29uc3QgdmFyTWF0Y2ggPSB0cmltbWVkTGluZS5tYXRjaCgvXihcXHcrKVxccyo9Lyk7XG4gICAgICBpZiAodmFyTWF0Y2ggJiYgIXRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJyAnKSAmJiAhdHJpbW1lZExpbmUuc3RhcnRzV2l0aCgnXFx0JykpIHtcbiAgICAgICAgc3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlU3ltYm9sKHtcbiAgICAgICAgICBuYW1lOiB2YXJNYXRjaFsxXSxcbiAgICAgICAgICBraW5kOiAndmFyaWFibGUnLFxuICAgICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICAgIGxpbmU6IGxpbmVOdW0sXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdQeXRob24nLFxuICAgICAgICAgIGV4cG9ydGVkOiAhdmFyTWF0Y2hbMV0uc3RhcnRzV2l0aCgnXycpLFxuICAgICAgICAgIGV2aWRlbmNlOiB7IHR5cGU6ICdzdGF0aWNfc2NhbicsIGNvbnRlbnQ6IHRyaW1tZWRMaW5lLCBkZXRlY3RlZEF0OiBEYXRlLm5vdygpIH0sXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5a+85YWlXG4gICAgICBjb25zdCBpbXBvcnRNYXRjaCA9IHRyaW1tZWRMaW5lLm1hdGNoKC9eKD86ZnJvbVxccytcXFMrXFxzKyk/aW1wb3J0XFxzKyguKykvKTtcbiAgICAgIGlmIChpbXBvcnRNYXRjaCkge1xuICAgICAgICBjb25zdCBpbXBvcnRzID0gaW1wb3J0TWF0Y2hbMV0uc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgICAgIGZvciAoY29uc3QgaW1wIG9mIGltcG9ydHMpIHtcbiAgICAgICAgICBjb25zdCBuYW1lTWF0Y2ggPSBpbXAubWF0Y2goLyhcXHcrKSg/Olxccythc1xccytcXHcrKT8vKTtcbiAgICAgICAgICBpZiAobmFtZU1hdGNoKSB7XG4gICAgICAgICAgICBzeW1ib2xzLnB1c2godGhpcy5jcmVhdGVTeW1ib2woe1xuICAgICAgICAgICAgICBuYW1lOiBuYW1lTWF0Y2hbMV0sXG4gICAgICAgICAgICAgIGtpbmQ6ICdtb2R1bGUnLFxuICAgICAgICAgICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgICAgICAgICAgbGluZTogbGluZU51bSxcbiAgICAgICAgICAgICAgbGFuZ3VhZ2U6ICdQeXRob24nLFxuICAgICAgICAgICAgICBldmlkZW5jZTogeyB0eXBlOiAnaW1wb3J0JywgY29udGVudDogdHJpbW1lZExpbmUsIGRldGVjdGVkQXQ6IERhdGUubm93KCkgfSxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgc3ltYm9scywgZXJyb3JzIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmt7vliqDnrKblj7fliLDntKLlvJVcbiAgICovXG4gIHByaXZhdGUgYWRkU3ltYm9sVG9JbmRleChpbmRleDogU3ltYm9sSW5kZXgsIHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbik6IHZvaWQge1xuICAgIC8vIGJ5TmFtZVxuICAgIGlmICghaW5kZXguYnlOYW1lLmhhcyhzeW1ib2wubmFtZSkpIHtcbiAgICAgIGluZGV4LmJ5TmFtZS5zZXQoc3ltYm9sLm5hbWUsIFtdKTtcbiAgICB9XG4gICAgaW5kZXguYnlOYW1lLmdldChzeW1ib2wubmFtZSkhLnB1c2goc3ltYm9sKTtcbiAgICBcbiAgICAvLyBieUZpbGVcbiAgICBpZiAoIWluZGV4LmJ5RmlsZS5oYXMoc3ltYm9sLmZpbGUpKSB7XG4gICAgICBpbmRleC5ieUZpbGUuc2V0KHN5bWJvbC5maWxlLCBbXSk7XG4gICAgfVxuICAgIGluZGV4LmJ5RmlsZS5nZXQoc3ltYm9sLmZpbGUpIS5wdXNoKHN5bWJvbCk7XG4gICAgXG4gICAgLy8gYnlLaW5kXG4gICAgaWYgKCFpbmRleC5ieUtpbmQuaGFzKHN5bWJvbC5raW5kKSkge1xuICAgICAgaW5kZXguYnlLaW5kLnNldChzeW1ib2wua2luZCwgW10pO1xuICAgIH1cbiAgICBpbmRleC5ieUtpbmQuZ2V0KHN5bWJvbC5raW5kKSEucHVzaChzeW1ib2wpO1xuICAgIFxuICAgIC8vIGJ5TGFuZ3VhZ2VcbiAgICBpZiAoIWluZGV4LmJ5TGFuZ3VhZ2UuaGFzKHN5bWJvbC5sYW5ndWFnZSkpIHtcbiAgICAgIGluZGV4LmJ5TGFuZ3VhZ2Uuc2V0KHN5bWJvbC5sYW5ndWFnZSwgW10pO1xuICAgIH1cbiAgICBpbmRleC5ieUxhbmd1YWdlLmdldChzeW1ib2wubGFuZ3VhZ2UpIS5wdXNoKHN5bWJvbCk7XG4gICAgXG4gICAgLy8gZXhwb3J0ZWRcbiAgICBpZiAoc3ltYm9sLmV4cG9ydGVkKSB7XG4gICAgICBpbmRleC5leHBvcnRlZC5wdXNoKHN5bWJvbCk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6K6h566X57uf6K6hXG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGF0ZVN0YXRzKGluZGV4OiBTeW1ib2xJbmRleCk6IHZvaWQge1xuICAgIGluZGV4LnN0YXRzLnRvdGFsU3ltYm9scyA9IGluZGV4LmV4cG9ydGVkLmxlbmd0aCArIFxuICAgICAgQXJyYXkuZnJvbShpbmRleC5ieUtpbmQudmFsdWVzKCkpLnJlZHVjZSgoc3VtLCBhcnIpID0+IHN1bSArIGFyci5sZW5ndGgsIDApIC0gaW5kZXguZXhwb3J0ZWQubGVuZ3RoO1xuICAgIFxuICAgIGZvciAoY29uc3QgW2tpbmQsIHN5bWJvbHNdIG9mIGluZGV4LmJ5S2luZC5lbnRyaWVzKCkpIHtcbiAgICAgIGluZGV4LnN0YXRzLmJ5S2luZFtraW5kXSA9IHN5bWJvbHMubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICBmb3IgKGNvbnN0IFtsYW5ndWFnZSwgc3ltYm9sc10gb2YgaW5kZXguYnlMYW5ndWFnZS5lbnRyaWVzKCkpIHtcbiAgICAgIGluZGV4LnN0YXRzLmJ5TGFuZ3VhZ2VbbGFuZ3VhZ2VdID0gc3ltYm9scy5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIGZvciAoY29uc3QgW2ZpbGUsIHN5bWJvbHNdIG9mIGluZGV4LmJ5RmlsZS5lbnRyaWVzKCkpIHtcbiAgICAgIGluZGV4LnN0YXRzLmJ5RmlsZVtmaWxlXSA9IHN5bWJvbHMubGVuZ3RoO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuespuWPt1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTeW1ib2woc3ltYm9sOiBQYXJ0aWFsPFN5bWJvbERlZmluaXRpb24+KTogU3ltYm9sRGVmaW5pdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICcnLFxuICAgICAga2luZDogJ2Z1bmN0aW9uJyxcbiAgICAgIGZpbGU6ICcnLFxuICAgICAgbGluZTogMCxcbiAgICAgIGxhbmd1YWdlOiAndW5rbm93bicsXG4gICAgICAuLi5zeW1ib2wsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaPkOWPluWHveaVsOetvuWQjVxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0RnVuY3Rpb25TaWduYXR1cmUobGluZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/OmZ1bmN0aW9ufGRlZilcXHMrXFx3K1xccypcXChbXildKlxcKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzBdIDogbGluZS5zbGljZSgwLCAxMDApO1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W57G7562+5ZCNXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RDbGFzc1NpZ25hdHVyZShsaW5lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvY2xhc3NcXHMrXFx3Kyg/OlxccytleHRlbmRzXFxzK1xcdyspPy8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzBdIDogbGluZS5zbGljZSgwLCAxMDApO1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W5Y+Y6YeP562+5ZCNXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RWYXJpYWJsZVNpZ25hdHVyZShsaW5lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD86Y29uc3R8bGV0fHZhcilcXHMrXFx3K1xccypbOj1dLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMF0gOiBsaW5lLnNsaWNlKDAsIDUwKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpeaYr+WQpuaUr+aMgeeahOivreiogFxuICAgKi9cbiAgcHJpdmF0ZSBpc1N1cHBvcnRlZExhbmd1YWdlKGV4dDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3Qgc3VwcG9ydGVkID0gWycudHMnLCAnLnRzeCcsICcuanMnLCAnLmpzeCcsICcucHknXTtcbiAgICByZXR1cm4gc3VwcG9ydGVkLmluY2x1ZGVzKGV4dCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKblupTor6XmjpLpmaRcbiAgICovXG4gIHByaXZhdGUgc2hvdWxkRXhjbHVkZShmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8g5qOA5p+l5o6S6Zmk55uu5b2VXG4gICAgZm9yIChjb25zdCBkaXIgb2YgdGhpcy5jb25maWcuZXhjbHVkZURpcnMpIHtcbiAgICAgIGlmIChmaWxlUGF0aC5pbmNsdWRlcyhkaXIpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5o6S6Zmk5paH5Lu2XG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHRoaXMuY29uZmlnLmV4Y2x1ZGVGaWxlcykge1xuICAgICAgaWYgKHBhdHRlcm4uc3RhcnRzV2l0aCgnKicpKSB7XG4gICAgICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aChwYXR0ZXJuLnNsaWNlKDEpKSkgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmBjeWOhuebruW9lVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB3YWxrRGlyZWN0b3J5KFxuICAgIGRpcjogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAoZmlsZVBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPixcbiAgICBkZXB0aDogbnVtYmVyID0gMFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoZGVwdGggPj0gdGhpcy5jb25maWcubWF4RGVwdGgpIHJldHVybjtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMuc2hvdWxkRXhjbHVkZShmdWxsUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgaWYgKGVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgICAgYXdhaXQgY2FsbGJhY2soZnVsbFBhdGgpO1xuICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLndhbGtEaXJlY3RvcnkoZnVsbFBhdGgsIGNhbGxiYWNrLCBkZXB0aCArIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor69cbiAgICB9XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu656ym5Y+357Si5byV5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTeW1ib2xJbmRleGVyKGNvbmZpZz86IFN5bWJvbEluZGV4ZXJDb25maWcpOiBTeW1ib2xJbmRleGVyIHtcbiAgcmV0dXJuIG5ldyBTeW1ib2xJbmRleGVyKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu656ym5Y+357Si5byVXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidWlsZFN5bWJvbEluZGV4KHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPFN5bWJvbEluZGV4PiB7XG4gIGNvbnN0IGluZGV4ZXIgPSBuZXcgU3ltYm9sSW5kZXhlcigpO1xuICByZXR1cm4gYXdhaXQgaW5kZXhlci5idWlsZEluZGV4KHJlcG9Sb290KTtcbn1cbiJdfQ==