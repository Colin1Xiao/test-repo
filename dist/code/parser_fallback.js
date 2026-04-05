"use strict";
/**
 * Parser Fallback - Parser 降级方案
 *
 * 职责：
 * 1. 当 LSP 不可用时提供降级方案
 * 2. 支持 parser / static_scan / grep 三层降级
 * 3. 保持返回类型统一
 * 4. 标记结果来源与置信度
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
exports.ParserFallback = void 0;
exports.createParserFallback = createParserFallback;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
n;
maxDepth ?  : number;
// ============================================================================
// Parser 降级器
// ============================================================================
class ParserFallback {
    constructor(config = {}) {
        this.config = {
            languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
            timeoutMs: config.timeoutMs ?? 5000,
            maxDepth: config.maxDepth ?? 10,
        };
    }
    /**
     * 查找定义（降级方案）
     */
    async findDefinition(symbolName, filePath, repoRoot) {
        const startTime = Date.now();
        try {
            // Layer 1: Parser（如果有 tree-sitter）
            const parserResult = await this.findDefinitionByParser(symbolName, filePath);
            if (parserResult) {
                return {
                    data: parserResult,
                    usedFallback: 'parser',
                    reason: 'Parser-based definition lookup',
                };
            }
            // Layer 2: Static Scan
            const staticResult = await this.findDefinitionByStaticScan(symbolName, repoRoot);
            if (staticResult) {
                return {
                    data: staticResult,
                    usedFallback: 'static_scan',
                    reason: 'Static scan definition lookup',
                };
            }
            // Layer 3: Grep
            const grepResult = await this.findDefinitionByGrep(symbolName, repoRoot);
            if (grepResult) {
                return {
                    data: grepResult,
                    usedFallback: 'grep',
                    reason: 'Grep-based definition lookup',
                };
            }
            return {
                data: null,
                usedFallback: 'grep',
                reason: 'No definition found in any fallback layer',
            };
        }
        catch (error) {
            return {
                data: null,
                usedFallback: 'grep',
                reason: `Fallback error: ${error instanceof Error ? error.message : String(error)}`,
                originalError: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * 查找引用（降级方案）
     */
    async findReferences(symbol, repoRoot) {
        try {
            // Layer 1: Parser
            const parserRefs = await this.findReferencesByParser(symbol, repoRoot);
            if (parserRefs.length > 0) {
                return {
                    data: parserRefs,
                    usedFallback: 'parser',
                    reason: 'Parser-based reference lookup',
                };
            }
            // Layer 2: Static Scan
            const staticRefs = await this.findReferencesByStaticScan(symbol, repoRoot);
            if (staticRefs.length > 0) {
                return {
                    data: staticRefs,
                    usedFallback: 'static_scan',
                    reason: 'Static scan reference lookup',
                };
            }
            // Layer 3: Grep
            const grepRefs = await this.findReferencesByGrep(symbol, repoRoot);
            return {
                data: grepRefs,
                usedFallback: 'grep',
                reason: 'Grep-based reference lookup',
            };
        }
        catch (error) {
            return {
                data: [],
                usedFallback: 'grep',
                reason: `Fallback error: ${error instanceof Error ? error.message : String(error)}`,
                originalError: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * 解析符号（Parser 层）
     */
    async parseSymbols(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const ext = path.extname(filePath).toLowerCase();
            // 简单实现：基于正则的符号提取
            // 实际应该使用 tree-sitter 等 parser
            return this.extractSymbolsByRegex(content, filePath, ext);
        }
        catch (error) {
            return { symbols: [], references: [] };
        }
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * Parser 层查找定义
     */
    async findDefinitionByParser(symbolName, filePath) {
        // 简化实现：使用 static scan 替代真正的 parser
        // 实际应该集成 tree-sitter
        return await this.findDefinitionByStaticScan(symbolName, path.dirname(filePath));
    }
    /**
     * Static Scan 查找定义
     */
    async findDefinitionByStaticScan(symbolName, repoRoot) {
        const files = await this.scanFiles(repoRoot);
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 检测符号定义
                const kind = this.detectSymbolKind(line, symbolName);
                if (kind) {
                    return {
                        name: symbolName,
                        kind,
                        file,
                        line: i + 1,
                        language: this.getLanguage(file),
                        exported: this.isExported(line),
                        confidence: 0.7,
                    };
                }
            }
        }
        return null;
    }
    /**
     * Grep 查找定义
     */
    async findDefinitionByGrep(symbolName, repoRoot) {
        // 简化实现：使用 fs 遍历替代 grep
        const files = await this.scanFiles(repoRoot);
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                // 简单匹配
                const pattern = new RegExp(`\\b${symbolName}\\b`, 'm');
                const match = content.match(pattern);
                if (match) {
                    const lines = content.split('\n');
                    let lineNum = 0;
                    let totalChars = 0;
                    for (let i = 0; i < lines.length; i++) {
                        totalChars += lines[i].length + 1;
                        if (totalChars >= match.index) {
                            lineNum = i + 1;
                            break;
                        }
                    }
                    return {
                        name: symbolName,
                        kind: 'function', // 默认
                        file,
                        line: lineNum,
                        language: this.getLanguage(file),
                        confidence: 0.5,
                    };
                }
            }
            catch {
                // 忽略错误
            }
        }
        return null;
    }
    /**
     * Parser 层查找引用
     */
    async findReferencesByParser(symbol, repoRoot) {
        // 简化实现
        return await this.findReferencesByStaticScan(symbol, repoRoot);
    }
    /**
     * Static Scan 查找引用
     */
    async findReferencesByStaticScan(symbol, repoRoot) {
        const references = [];
        const files = await this.scanFiles(repoRoot);
        for (const file of files) {
            if (file === symbol.file)
                continue;
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes(symbol.name)) {
                    references.push({
                        symbol,
                        location: {
                            file,
                            line: i + 1,
                        },
                        referenceType: 'reference',
                        context: this.getContext(lines, i),
                    });
                }
            }
        }
        return references.slice(0, 50);
    }
    /**
     * Grep 查找引用
     */
    async findReferencesByGrep(symbol, repoRoot) {
        // 简化实现：使用 fs 遍历
        const references = [];
        const files = await this.scanFiles(repoRoot);
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(symbol.name)) {
                        references.push({
                            symbol,
                            location: {
                                file,
                                line: i + 1,
                            },
                            referenceType: 'reference',
                            context: this.getContext(lines, i),
                        });
                    }
                }
            }
            catch {
                // 忽略错误
            }
        }
        return references.slice(0, 50);
    }
    /**
     * 扫描文件
     */
    async scanFiles(repoRoot) {
        const files = [];
        const walk = async (dir, depth = 0) => {
            if (depth >= this.config.maxDepth)
                return;
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    // 排除目录
                    if (entry.isDirectory()) {
                        if (['node_modules', '__pycache__', '.git', 'dist', 'build'].includes(entry.name)) {
                            continue;
                        }
                        await walk(fullPath, depth + 1);
                    }
                    else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch {
                // 忽略错误
            }
        };
        await walk(repoRoot);
        return files;
    }
    /**
     * 检测符号类型
     */
    detectSymbolKind(line, symbolName) {
        const trimmed = line.trim();
        // 函数
        if (trimmed.match(new RegExp(`(function|def)\\s+${symbolName}\\s*\\(`))) {
            return 'function';
        }
        // 类
        if (trimmed.match(new RegExp(`class\\s+${symbolName}`))) {
            return 'class';
        }
        // 变量
        if (trimmed.match(new RegExp(`(const|let|var)\\s+${symbolName}\\s*[:=]`))) {
            return 'variable';
        }
        return null;
    }
    /**
     * 检查是否导出
     */
    isExported(line) {
        return line.includes('export') || line.startsWith('def ') || line.startsWith('class ');
    }
    /**
     * 获取语言
     */
    getLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
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
                return 'unknown';
        }
    }
    /**
     * 获取上下文
     */
    getContext(lines, lineIndex, contextLines = 2) {
        const start = Math.max(0, lineIndex - contextLines);
        const end = Math.min(lines.length, lineIndex + contextLines + 1);
        return lines.slice(start, end).join('\n');
    }
}
exports.ParserFallback = ParserFallback;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 Parser 降级器
 */
function createParserFallback(config) {
    return new ParserFallback(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyX2ZhbGxiYWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvZGUvcGFyc2VyX2ZhbGxiYWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBcWNILG9EQUVDO0FBcmNELGdEQUFrQztBQUNsQywyQ0FBNkI7QUFpQmIsQ0FBQyxDQUFBO0FBQUUsUUFBUSxDQUFBLENBQUMsQ0FBQSxDQUFBLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFXckMsK0VBQStFO0FBQy9FLGFBQWE7QUFDYiwrRUFBK0U7QUFFL0UsTUFBYSxjQUFjO0lBR3pCLFlBQVksU0FBK0IsRUFBRTtRQUMzQyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQztZQUNyRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ25DLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxJQUFJLEVBQUU7U0FDaEMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxjQUFjLENBQ2xCLFVBQWtCLEVBQ2xCLFFBQWdCLEVBQ2hCLFFBQWdCO1FBRWhCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUU3QixJQUFJLENBQUM7WUFDSCxtQ0FBbUM7WUFDbkMsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzdFLElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ2pCLE9BQU87b0JBQ0wsSUFBSSxFQUFFLFlBQVk7b0JBQ2xCLFlBQVksRUFBRSxRQUFRO29CQUN0QixNQUFNLEVBQUUsZ0NBQWdDO2lCQUN6QyxDQUFDO1lBQ0osQ0FB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LEVBQUUsQ0FBQztZQUNaLEtBQUssS0FBSyxDQUFDO1lBQ1gsS0FBSyxNQUFNO2dCQUNULE9BQU8sWUFBWSxDQUFDO1lBQ3RCLEtBQUssS0FBSyxDQUFDO1lBQ1gsS0FBSyxNQUFNO2dCQUNULE9BQU8sWUFBWSxDQUFDO1lBQ3RCLEtBQUssS0FBSztnQkFDUixPQUFPLFFBQVEsQ0FBQztZQUNsQjtnQkFDRSxPQUFPLFNBQVMsQ0FBQztRQUNyQixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssVUFBVSxDQUFDLEtBQWUsRUFBRSxTQUFpQixFQUFFLGVBQXVCLENBQUM7UUFDN0UsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxHQUFHLFlBQVksQ0FBQyxDQUFDO1FBQ3BELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxTQUFTLEdBQUcsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQXpaRCx3Q0F5WkM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLE1BQTZCO0lBQ2hFLE9BQU8sSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGFyc2VyIEZhbGxiYWNrIC0gUGFyc2VyIOmZjee6p+aWueahiFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOW9kyBMU1Ag5LiN5Y+v55So5pe25o+Q5L6b6ZmN57qn5pa55qGIXG4gKiAyLiDmlK/mjIEgcGFyc2VyIC8gc3RhdGljX3NjYW4gLyBncmVwIOS4ieWxgumZjee6p1xuICogMy4g5L+d5oyB6L+U5Zue57G75Z6L57uf5LiAXG4gKiA0LiDmoIforrDnu5PmnpzmnaXmupDkuI7nva7kv6HluqZcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgU3ltYm9sRGVmaW5pdGlvbiwgU3ltYm9sUmVmZXJlbmNlLCBGYWxsYmFja1Jlc3VsdCwgU3ltYm9sS2luZCB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBQYXJzZXIg6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VyRmFsbGJhY2tDb25maWcge1xuICAvKiog5YyF5ZCr55qE6K+t6KiAICovXG4gIGxhbmd1YWdlcz86IHN0cmluZ1tdO1xuICBcbiAgLyoqIOi2heaXtuaXtumXtO+8iOavq+enku+8iSAqL1xuICB0aW1lb3V0TXM/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA5aSn5omr5o+P5rex5bqmICovXFxuICBtYXhEZXB0aD86IG51bWJlcjtcbn1cblxuLyoqXG4gKiDop6PmnpDnu5PmnpxcbiAqL1xuaW50ZXJmYWNlIFBhcnNlUmVzdWx0IHtcbiAgc3ltYm9sczogU3ltYm9sRGVmaW5pdGlvbltdO1xuICByZWZlcmVuY2VzOiBTeW1ib2xSZWZlcmVuY2VbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUGFyc2VyIOmZjee6p+WZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgUGFyc2VyRmFsbGJhY2sge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8UGFyc2VyRmFsbGJhY2tDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBQYXJzZXJGYWxsYmFja0NvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBsYW5ndWFnZXM6IGNvbmZpZy5sYW5ndWFnZXMgPz8gWydUeXBlU2NyaXB0JywgJ0phdmFTY3JpcHQnLCAnUHl0aG9uJ10sXG4gICAgICB0aW1lb3V0TXM6IGNvbmZpZy50aW1lb3V0TXMgPz8gNTAwMCxcbiAgICAgIG1heERlcHRoOiBjb25maWcubWF4RGVwdGggPz8gMTAsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuWumuS5ie+8iOmZjee6p+aWueahiO+8iVxuICAgKi9cbiAgYXN5bmMgZmluZERlZmluaXRpb24oXG4gICAgc3ltYm9sTmFtZTogc3RyaW5nLFxuICAgIGZpbGVQYXRoOiBzdHJpbmcsXG4gICAgcmVwb1Jvb3Q6IHN0cmluZ1xuICApOiBQcm9taXNlPEZhbGxiYWNrUmVzdWx0PFN5bWJvbERlZmluaXRpb24+PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gTGF5ZXIgMTogUGFyc2Vy77yI5aaC5p6c5pyJIHRyZWUtc2l0dGVy77yJXG4gICAgICBjb25zdCBwYXJzZXJSZXN1bHQgPSBhd2FpdCB0aGlzLmZpbmREZWZpbml0aW9uQnlQYXJzZXIoc3ltYm9sTmFtZSwgZmlsZVBhdGgpO1xuICAgICAgaWYgKHBhcnNlclJlc3VsdCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHBhcnNlclJlc3VsdCxcbiAgICAgICAgICB1c2VkRmFsbGJhY2s6ICdwYXJzZXInLFxuICAgICAgICAgIHJlYXNvbjogJ1BhcnNlci1iYXNlZCBkZWZpbml0aW9uIGxvb2t1cCcsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIExheWVyIDI6IFN0YXRpYyBTY2FuXG4gICAgICBjb25zdCBzdGF0aWNSZXN1bHQgPSBhd2FpdCB0aGlzLmZpbmREZWZpbml0aW9uQnlTdGF0aWNTY2FuKHN5bWJvbE5hbWUsIHJlcG9Sb290KTtcbiAgICAgIGlmIChzdGF0aWNSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiBzdGF0aWNSZXN1bHQsXG4gICAgICAgICAgdXNlZEZhbGxiYWNrOiAnc3RhdGljX3NjYW4nLFxuICAgICAgICAgIHJlYXNvbjogJ1N0YXRpYyBzY2FuIGRlZmluaXRpb24gbG9va3VwJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTGF5ZXIgMzogR3JlcFxuICAgICAgY29uc3QgZ3JlcFJlc3VsdCA9IGF3YWl0IHRoaXMuZmluZERlZmluaXRpb25CeUdyZXAoc3ltYm9sTmFtZSwgcmVwb1Jvb3QpO1xuICAgICAgaWYgKGdyZXBSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiBncmVwUmVzdWx0LFxuICAgICAgICAgIHVzZWRGYWxsYmFjazogJ2dyZXAnLFxuICAgICAgICAgIHJlYXNvbjogJ0dyZXAtYmFzZWQgZGVmaW5pdGlvbiBsb29rdXAnLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgICB1c2VkRmFsbGJhY2s6ICdncmVwJyxcbiAgICAgICAgcmVhc29uOiAnTm8gZGVmaW5pdGlvbiBmb3VuZCBpbiBhbnkgZmFsbGJhY2sgbGF5ZXInLFxuICAgICAgfTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgICB1c2VkRmFsbGJhY2s6ICdncmVwJyxcbiAgICAgICAgcmVhc29uOiBgRmFsbGJhY2sgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICAgIG9yaWdpbmFsRXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIH07XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5p+l5om+5byV55So77yI6ZmN57qn5pa55qGI77yJXG4gICAqL1xuICBhc3luYyBmaW5kUmVmZXJlbmNlcyhcbiAgICBzeW1ib2w6IFN5bWJvbERlZmluaXRpb24sXG4gICAgcmVwb1Jvb3Q6IHN0cmluZ1xuICApOiBQcm9taXNlPEZhbGxiYWNrUmVzdWx0PFN5bWJvbFJlZmVyZW5jZVtdPj4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBMYXllciAxOiBQYXJzZXJcbiAgICAgIGNvbnN0IHBhcnNlclJlZnMgPSBhd2FpdCB0aGlzLmZpbmRSZWZlcmVuY2VzQnlQYXJzZXIoc3ltYm9sLCByZXBvUm9vdCk7XG4gICAgICBpZiAocGFyc2VyUmVmcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZGF0YTogcGFyc2VyUmVmcyxcbiAgICAgICAgICB1c2VkRmFsbGJhY2s6ICdwYXJzZXInLFxuICAgICAgICAgIHJlYXNvbjogJ1BhcnNlci1iYXNlZCByZWZlcmVuY2UgbG9va3VwJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTGF5ZXIgMjogU3RhdGljIFNjYW5cbiAgICAgIGNvbnN0IHN0YXRpY1JlZnMgPSBhd2FpdCB0aGlzLmZpbmRSZWZlcmVuY2VzQnlTdGF0aWNTY2FuKHN5bWJvbCwgcmVwb1Jvb3QpO1xuICAgICAgaWYgKHN0YXRpY1JlZnMubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHN0YXRpY1JlZnMsXG4gICAgICAgICAgdXNlZEZhbGxiYWNrOiAnc3RhdGljX3NjYW4nLFxuICAgICAgICAgIHJlYXNvbjogJ1N0YXRpYyBzY2FuIHJlZmVyZW5jZSBsb29rdXAnLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBMYXllciAzOiBHcmVwXG4gICAgICBjb25zdCBncmVwUmVmcyA9IGF3YWl0IHRoaXMuZmluZFJlZmVyZW5jZXNCeUdyZXAoc3ltYm9sLCByZXBvUm9vdCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRhOiBncmVwUmVmcyxcbiAgICAgICAgdXNlZEZhbGxiYWNrOiAnZ3JlcCcsXG4gICAgICAgIHJlYXNvbjogJ0dyZXAtYmFzZWQgcmVmZXJlbmNlIGxvb2t1cCcsXG4gICAgICB9O1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IFtdLFxuICAgICAgICB1c2VkRmFsbGJhY2s6ICdncmVwJyxcbiAgICAgICAgcmVhc29uOiBgRmFsbGJhY2sgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICAgIG9yaWdpbmFsRXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIH07XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6Kej5p6Q56ym5Y+377yIUGFyc2VyIOWxgu+8iVxuICAgKi9cbiAgYXN5bmMgcGFyc2VTeW1ib2xzKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPFBhcnNlUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBcbiAgICAgIC8vIOeugOWNleWunueOsO+8muWfuuS6juato+WImeeahOespuWPt+aPkOWPllxuICAgICAgLy8g5a6e6ZmF5bqU6K+l5L2/55SoIHRyZWUtc2l0dGVyIOetiSBwYXJzZXJcbiAgICAgIHJldHVybiB0aGlzLmV4dHJhY3RTeW1ib2xzQnlSZWdleChjb250ZW50LCBmaWxlUGF0aCwgZXh0KTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4geyBzeW1ib2xzOiBbXSwgcmVmZXJlbmNlczogW10gfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiBQYXJzZXIg5bGC5p+l5om+5a6a5LmJXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmREZWZpbml0aW9uQnlQYXJzZXIoXG4gICAgc3ltYm9sTmFtZTogc3RyaW5nLFxuICAgIGZpbGVQYXRoOiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTeW1ib2xEZWZpbml0aW9uIHwgbnVsbD4ge1xuICAgIC8vIOeugOWMluWunueOsO+8muS9v+eUqCBzdGF0aWMgc2NhbiDmm7/ku6PnnJ/mraPnmoQgcGFyc2VyXG4gICAgLy8g5a6e6ZmF5bqU6K+l6ZuG5oiQIHRyZWUtc2l0dGVyXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZmluZERlZmluaXRpb25CeVN0YXRpY1NjYW4oc3ltYm9sTmFtZSwgcGF0aC5kaXJuYW1lKGZpbGVQYXRoKSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBTdGF0aWMgU2NhbiDmn6Xmib7lrprkuYlcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZmluZERlZmluaXRpb25CeVN0YXRpY1NjYW4oXG4gICAgc3ltYm9sTmFtZTogc3RyaW5nLFxuICAgIHJlcG9Sb290OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTeW1ib2xEZWZpbml0aW9uIHwgbnVsbD4ge1xuICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5zY2FuRmlsZXMocmVwb1Jvb3QpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGUsICd1dGYtOCcpO1xuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAgIFxuICAgICAgICAvLyDmo4DmtYvnrKblj7flrprkuYlcbiAgICAgICAgY29uc3Qga2luZCA9IHRoaXMuZGV0ZWN0U3ltYm9sS2luZChsaW5lLCBzeW1ib2xOYW1lKTtcbiAgICAgICAgaWYgKGtpbmQpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmFtZTogc3ltYm9sTmFtZSxcbiAgICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogaSArIDEsXG4gICAgICAgICAgICBsYW5ndWFnZTogdGhpcy5nZXRMYW5ndWFnZShmaWxlKSxcbiAgICAgICAgICAgIGV4cG9ydGVkOiB0aGlzLmlzRXhwb3J0ZWQobGluZSksXG4gICAgICAgICAgICBjb25maWRlbmNlOiAwLjcsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdyZXAg5p+l5om+5a6a5LmJXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmREZWZpbml0aW9uQnlHcmVwKFxuICAgIHN5bWJvbE5hbWU6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IFByb21pc2U8U3ltYm9sRGVmaW5pdGlvbiB8IG51bGw+IHtcbiAgICAvLyDnroDljJblrp7njrDvvJrkvb/nlKggZnMg6YGN5Y6G5pu/5LujIGdyZXBcbiAgICBjb25zdCBmaWxlcyA9IGF3YWl0IHRoaXMuc2NhbkZpbGVzKHJlcG9Sb290KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlLCAndXRmLTgnKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOeugOWNleWMuemFjVxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlZ0V4cChgXFxcXGIke3N5bWJvbE5hbWV9XFxcXGJgLCAnbScpO1xuICAgICAgICBjb25zdCBtYXRjaCA9IGNvbnRlbnQubWF0Y2gocGF0dGVybik7XG4gICAgICAgIFxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgIGxldCBsaW5lTnVtID0gMDtcbiAgICAgICAgICBsZXQgdG90YWxDaGFycyA9IDA7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdG90YWxDaGFycyArPSBsaW5lc1tpXS5sZW5ndGggKyAxO1xuICAgICAgICAgICAgaWYgKHRvdGFsQ2hhcnMgPj0gbWF0Y2guaW5kZXghKSB7XG4gICAgICAgICAgICAgIGxpbmVOdW0gPSBpICsgMTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuYW1lOiBzeW1ib2xOYW1lLFxuICAgICAgICAgICAga2luZDogJ2Z1bmN0aW9uJywgLy8g6buY6K6kXG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogbGluZU51bSxcbiAgICAgICAgICAgIGxhbmd1YWdlOiB0aGlzLmdldExhbmd1YWdlKGZpbGUpLFxuICAgICAgICAgICAgY29uZmlkZW5jZTogMC41LFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDlv73nlaXplJnor69cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBQYXJzZXIg5bGC5p+l5om+5byV55SoXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmRSZWZlcmVuY2VzQnlQYXJzZXIoXG4gICAgc3ltYm9sOiBTeW1ib2xEZWZpbml0aW9uLFxuICAgIHJlcG9Sb290OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTeW1ib2xSZWZlcmVuY2VbXT4ge1xuICAgIC8vIOeugOWMluWunueOsFxuICAgIHJldHVybiBhd2FpdCB0aGlzLmZpbmRSZWZlcmVuY2VzQnlTdGF0aWNTY2FuKHN5bWJvbCwgcmVwb1Jvb3QpO1xuICB9XG4gIFxuICAvKipcbiAgICogU3RhdGljIFNjYW4g5p+l5om+5byV55SoXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmRSZWZlcmVuY2VzQnlTdGF0aWNTY2FuKFxuICAgIHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbixcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IFByb21pc2U8U3ltYm9sUmVmZXJlbmNlW10+IHtcbiAgICBjb25zdCByZWZlcmVuY2VzOiBTeW1ib2xSZWZlcmVuY2VbXSA9IFtdO1xuICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5zY2FuRmlsZXMocmVwb1Jvb3QpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgaWYgKGZpbGUgPT09IHN5bWJvbC5maWxlKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGUsICd1dGYtOCcpO1xuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAgIFxuICAgICAgICBpZiAobGluZS5pbmNsdWRlcyhzeW1ib2wubmFtZSkpIHtcbiAgICAgICAgICByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgc3ltYm9sLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgbGluZTogaSArIDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVmZXJlbmNlVHlwZTogJ3JlZmVyZW5jZScsXG4gICAgICAgICAgICBjb250ZXh0OiB0aGlzLmdldENvbnRleHQobGluZXMsIGkpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZWZlcmVuY2VzLnNsaWNlKDAsIDUwKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdyZXAg5p+l5om+5byV55SoXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmRSZWZlcmVuY2VzQnlHcmVwKFxuICAgIHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbixcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IFByb21pc2U8U3ltYm9sUmVmZXJlbmNlW10+IHtcbiAgICAvLyDnroDljJblrp7njrDvvJrkvb/nlKggZnMg6YGN5Y6GXG4gICAgY29uc3QgcmVmZXJlbmNlczogU3ltYm9sUmVmZXJlbmNlW10gPSBbXTtcbiAgICBjb25zdCBmaWxlcyA9IGF3YWl0IHRoaXMuc2NhbkZpbGVzKHJlcG9Sb290KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlLCAndXRmLTgnKTtcbiAgICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAobGluZXNbaV0uaW5jbHVkZXMoc3ltYm9sLm5hbWUpKSB7XG4gICAgICAgICAgICByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgICBzeW1ib2wsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgICBsaW5lOiBpICsgMSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcmVmZXJlbmNlVHlwZTogJ3JlZmVyZW5jZScsXG4gICAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ2V0Q29udGV4dChsaW5lcywgaSksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDlv73nlaXplJnor69cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlZmVyZW5jZXMuc2xpY2UoMCwgNTApO1xuICB9XG4gIFxuICAvKipcbiAgICog5omr5o+P5paH5Lu2XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNjYW5GaWxlcyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGNvbnN0IHdhbGsgPSBhc3luYyAoZGlyOiBzdHJpbmcsIGRlcHRoOiBudW1iZXIgPSAwKSA9PiB7XG4gICAgICBpZiAoZGVwdGggPj0gdGhpcy5jb25maWcubWF4RGVwdGgpIHJldHVybjtcbiAgICAgIFxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOaOkumZpOebruW9lVxuICAgICAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICBpZiAoWydub2RlX21vZHVsZXMnLCAnX19weWNhY2hlX18nLCAnLmdpdCcsICdkaXN0JywgJ2J1aWxkJ10uaW5jbHVkZXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCB3YWxrKGZ1bGxQYXRoLCBkZXB0aCArIDEpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKFsnLnRzJywgJy50c3gnLCAnLmpzJywgJy5qc3gnLCAnLnB5J10uaW5jbHVkZXMoZXh0KSkge1xuICAgICAgICAgICAgICBmaWxlcy5wdXNoKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDlv73nlaXplJnor69cbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGF3YWl0IHdhbGsocmVwb1Jvb3QpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1i+espuWPt+exu+Wei1xuICAgKi9cbiAgcHJpdmF0ZSBkZXRlY3RTeW1ib2xLaW5kKGxpbmU6IHN0cmluZywgc3ltYm9sTmFtZTogc3RyaW5nKTogU3ltYm9sS2luZCB8IG51bGwge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBsaW5lLnRyaW0oKTtcbiAgICBcbiAgICAvLyDlh73mlbBcbiAgICBpZiAodHJpbW1lZC5tYXRjaChuZXcgUmVnRXhwKGAoZnVuY3Rpb258ZGVmKVxcXFxzKyR7c3ltYm9sTmFtZX1cXFxccypcXFxcKGApKSkge1xuICAgICAgcmV0dXJuICdmdW5jdGlvbic7XG4gICAgfVxuICAgIFxuICAgIC8vIOexu1xuICAgIGlmICh0cmltbWVkLm1hdGNoKG5ldyBSZWdFeHAoYGNsYXNzXFxcXHMrJHtzeW1ib2xOYW1lfWApKSkge1xuICAgICAgcmV0dXJuICdjbGFzcyc7XG4gICAgfVxuICAgIFxuICAgIC8vIOWPmOmHj1xuICAgIGlmICh0cmltbWVkLm1hdGNoKG5ldyBSZWdFeHAoYChjb25zdHxsZXR8dmFyKVxcXFxzKyR7c3ltYm9sTmFtZX1cXFxccypbOj1dYCkpKSB7XG4gICAgICByZXR1cm4gJ3ZhcmlhYmxlJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKblr7zlh7pcbiAgICovXG4gIHByaXZhdGUgaXNFeHBvcnRlZChsaW5lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gbGluZS5pbmNsdWRlcygnZXhwb3J0JykgfHwgbGluZS5zdGFydHNXaXRoKCdkZWYgJykgfHwgbGluZS5zdGFydHNXaXRoKCdjbGFzcyAnKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluivreiogFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRMYW5ndWFnZShmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgc3dpdGNoIChleHQpIHtcbiAgICAgIGNhc2UgJy50cyc6XG4gICAgICBjYXNlICcudHN4JzpcbiAgICAgICAgcmV0dXJuICdUeXBlU2NyaXB0JztcbiAgICAgIGNhc2UgJy5qcyc6XG4gICAgICBjYXNlICcuanN4JzpcbiAgICAgICAgcmV0dXJuICdKYXZhU2NyaXB0JztcbiAgICAgIGNhc2UgJy5weSc6XG4gICAgICAgIHJldHVybiAnUHl0aG9uJztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAndW5rbm93bic7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5LiK5LiL5paHXG4gICAqL1xuICBwcml2YXRlIGdldENvbnRleHQobGluZXM6IHN0cmluZ1tdLCBsaW5lSW5kZXg6IG51bWJlciwgY29udGV4dExpbmVzOiBudW1iZXIgPSAyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGFydCA9IE1hdGgubWF4KDAsIGxpbmVJbmRleCAtIGNvbnRleHRMaW5lcyk7XG4gICAgY29uc3QgZW5kID0gTWF0aC5taW4obGluZXMubGVuZ3RoLCBsaW5lSW5kZXggKyBjb250ZXh0TGluZXMgKyAxKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2Uoc3RhcnQsIGVuZCkuam9pbignXFxuJyk7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu6IFBhcnNlciDpmY3nuqflmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnNlckZhbGxiYWNrKGNvbmZpZz86IFBhcnNlckZhbGxiYWNrQ29uZmlnKTogUGFyc2VyRmFsbGJhY2sge1xuICByZXR1cm4gbmV3IFBhcnNlckZhbGxiYWNrKGNvbmZpZyk7XG59XG4iXX0=