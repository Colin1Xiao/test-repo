"use strict";
/**
 * LSP Bridge - LSP 桥接层
 *
 * 职责：
 * 1. 判断是否可启用 LSP
 * 2. 路由到对应 LSP client
 * 3. 调用 definition / references / symbols 等方法
 * 4. 包装结果为统一类型
 * 5. 出错时自动降级
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
exports.LspBridge = void 0;
exports.createLspBridge = createLspBridge;
const path = __importStar(require("path"));
const lsp_client_pool_1 = require("./lsp_client_pool");
const parser_fallback_1 = require("./parser_fallback");
// ============================================================================
// LSP Bridge
// ============================================================================
class LspBridge {
    constructor(config = {}) {
        this.config = {
            languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
            timeoutMs: config.timeoutMs ?? 10000,
            autoFallback: config.autoFallback ?? true,
        };
        this.clientPool = new lsp_client_pool_1.LspClientPool();
        this.parserFallback = new parser_fallback_1.ParserFallback({ timeoutMs: this.config.timeoutMs });
    }
    /**
     * 检查 LSP 是否可用
     */
    async isLspAvailable(repoRoot, language) {
        try {
            const client = await this.clientPool.getOrCreateClient(repoRoot, language);
            return client.isRunning();
        }
        catch {
            return false;
        }
    }
    /**
     * 获取定义
     */
    async getDefinitions(filePath, position, repoRoot) {
        const startTime = Date.now();
        const language = this.getLanguage(filePath);
        try {
            // 尝试 LSP
            const client = await this.clientPool.getOrCreateClient(repoRoot, language);
            const lspResult = await Promise.race([
                client.findDefinition(filePath, position),
                this.timeoutPromise(this.config.timeoutMs),
            ]);
            if (lspResult && lspResult.length > 0) {
                return {
                    data: this.convertLspDefinitions(lspResult, filePath),
                    source: 'lsp',
                    confidence: 0.95,
                    durationMs: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            // LSP 失败，继续降级
        }
        // 降级到 parser
        if (this.config.autoFallback) {
            const fallbackResult = await this.parserFallback.findDefinition('unknown', // symbol name
            filePath, repoRoot);
            return {
                data: fallbackResult.data ? [fallbackResult.data] : [],
                source: fallbackResult.usedFallback,
                confidence: fallbackResult.usedFallback === 'parser' ? 0.7 : 0.5,
                fallbackReason: fallbackResult.reason,
                durationMs: Date.now() - startTime,
            };
        }
        return {
            data: [],
            source: 'lsp',
            confidence: 0,
            fallbackReason: 'LSP unavailable and fallback disabled',
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 获取引用
     */
    async getReferences(filePath, position, repoRoot, symbolName) {
        const startTime = Date.now();
        const language = this.getLanguage(filePath);
        try {
            // 尝试 LSP
            const client = await this.clientPool.getOrCreateClient(repoRoot, language);
            const lspResult = await Promise.race([
                client.findReferences(filePath, position),
                this.timeoutPromise(this.config.timeoutMs),
            ]);
            if (lspResult && lspResult.length > 0) {
                return {
                    data: this.convertLspReferences(lspResult, filePath),
                    source: 'lsp',
                    confidence: 0.9,
                    durationMs: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            // LSP 失败，继续降级
        }
        // 降级到 parser
        if (this.config.autoFallback && symbolName) {
            const fallbackResult = await this.parserFallback.findReferences({ name: symbolName, kind: 'function', file: filePath, line: position.line, language }, repoRoot);
            return {
                data: fallbackResult.data || [],
                source: fallbackResult.usedFallback,
                confidence: fallbackResult.usedFallback === 'parser' ? 0.7 : 0.5,
                fallbackReason: fallbackResult.reason,
                durationMs: Date.now() - startTime,
            };
        }
        return {
            data: [],
            source: 'lsp',
            confidence: 0,
            fallbackReason: 'LSP unavailable and fallback disabled',
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 获取文档符号
     */
    async getDocumentSymbols(filePath, repoRoot) {
        const startTime = Date.now();
        const language = this.getLanguage(filePath);
        try {
            // 尝试 LSP
            const client = await this.clientPool.getOrCreateClient(repoRoot, language);
            const lspResult = await Promise.race([
                client.getDocumentSymbols(filePath),
                this.timeoutPromise(this.config.timeoutMs),
            ]);
            if (lspResult && lspResult.length > 0) {
                return {
                    data: this.convertLspSymbols(lspResult, filePath),
                    source: 'lsp',
                    confidence: 0.9,
                    durationMs: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            // LSP 失败，降级到 parser
        }
        // 降级到 parser
        if (this.config.autoFallback) {
            const parseResult = await this.parserFallback.parseSymbols(filePath);
            return {
                data: parseResult.symbols,
                source: 'parser',
                confidence: 0.7,
                fallbackReason: 'LSP unavailable, using parser',
                durationMs: Date.now() - startTime,
            };
        }
        return {
            data: [],
            source: 'lsp',
            confidence: 0,
            fallbackReason: 'LSP unavailable and fallback disabled',
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 获取工作区符号
     */
    async getWorkspaceSymbols(query, repoRoot) {
        const startTime = Date.now();
        // 简化实现：LSP 工作区符号查询较复杂，暂时降级
        const fallbackResult = await this.parserFallback.findDefinition(query, '', repoRoot);
        return {
            data: fallbackResult.data ? [fallbackResult.data] : [],
            source: 'static_scan',
            confidence: 0.6,
            fallbackReason: 'Workspace symbols via static scan',
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 检查能力
     */
    hasCapability(repoRoot, language, capability) {
        // 简化实现
        const supportedCapabilities = {
            'TypeScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
            'JavaScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
            'Python': ['definition', 'references', 'documentSymbols'],
        };
        return supportedCapabilities[language]?.includes(capability) ?? false;
    }
    /**
     * 停止所有客户端
     */
    async stopAll() {
        await this.clientPool.stopAll();
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 转换 LSP 定义为内部类型
     */
    convertLspDefinitions(lspDefs, filePath) {
        return lspDefs.map(def => ({
            name: def.name || 'unknown',
            kind: this.mapLspSymbolKind(def.kind),
            file: def.uri ? this.uriToPath(def.uri) : filePath,
            line: def.range?.start?.line || 0,
            column: def.range?.start?.character || 0,
            language: this.getLanguage(filePath),
            confidence: 0.95,
        }));
    }
    /**
     * 转换 LSP 引用为内部类型
     */
    convertLspReferences(lspRefs, filePath) {
        return lspRefs.map(ref => ({
            symbol: {
                name: 'unknown',
                kind: 'function',
                file: filePath,
                line: 0,
                language: this.getLanguage(filePath),
            },
            location: {
                file: ref.uri ? this.uriToPath(ref.uri) : filePath,
                line: ref.range?.start?.line || 0,
            },
            referenceType: 'reference',
        }));
    }
    /**
     * 转换 LSP 符号为内部类型
     */
    convertLspSymbols(lspSymbols, filePath) {
        return lspSymbols.map(sym => ({
            name: sym.name || 'unknown',
            kind: this.mapLspSymbolKind(sym.kind),
            file: filePath,
            line: sym.location?.range?.start?.line || 0,
            language: this.getLanguage(filePath),
            confidence: 0.9,
        }));
    }
    /**
     * 映射 LSP 符号类型
     */
    mapLspSymbolKind(kind) {
        const kindMap = {
            1: 'file',
            2: 'module',
            3: 'namespace',
            4: 'package',
            5: 'class',
            6: 'method',
            7: 'property',
            8: 'field',
            9: 'constructor',
            10: 'enum',
            11: 'interface',
            12: 'function',
            13: 'variable',
            14: 'constant',
        };
        return kindMap[kind] || 'unknown';
    }
    /**
     * URI 转路径
     */
    uriToPath(uri) {
        if (uri.startsWith('file://')) {
            return uri.slice(7);
        }
        return uri;
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
     * 超时 Promise
     */
    timeoutPromise(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        });
    }
}
exports.LspBridge = LspBridge;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 LSP Bridge
 */
function createLspBridge(config) {
    return new LspBridge(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHNwX2JyaWRnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb2RlL2xzcF9icmlkZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNFlILDBDQUVDO0FBNVlELDJDQUE2QjtBQUU3Qix1REFBa0Q7QUFDbEQsdURBQW1EO0FBNEJuRCwrRUFBK0U7QUFDL0UsYUFBYTtBQUNiLCtFQUErRTtBQUUvRSxNQUFhLFNBQVM7SUFLcEIsWUFBWSxTQUEwQixFQUFFO1FBQ3RDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLFlBQVksRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDO1lBQ3JFLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUyxJQUFJLEtBQUs7WUFDcEMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLElBQUksSUFBSTtTQUMxQyxDQUFDO1FBRUYsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLCtCQUFhLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksZ0NBQWMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGNBQWMsQ0FBQyxRQUFnQixFQUFFLFFBQWdCO1FBQ3JELElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDM0UsT0FBTyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDNUIsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7SUFF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OztPQUVHO0lBQ0ssY0FBYyxDQUFDLEVBQVU7UUFDL0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUMvQixVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbkUsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5VkQsOEJBOFZDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixlQUFlLENBQUMsTUFBd0I7SUFDdEQsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMU1AgQnJpZGdlIC0gTFNQIOahpeaOpeWxglxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWIpOaWreaYr+WQpuWPr+WQr+eUqCBMU1BcbiAqIDIuIOi3r+eUseWIsOWvueW6lCBMU1AgY2xpZW50XG4gKiAzLiDosIPnlKggZGVmaW5pdGlvbiAvIHJlZmVyZW5jZXMgLyBzeW1ib2xzIOetieaWueazlVxuICogNC4g5YyF6KOF57uT5p6c5Li657uf5LiA57G75Z6LXG4gKiA1LiDlh7rplJnml7boh6rliqjpmY3nuqdcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgU3ltYm9sRGVmaW5pdGlvbiwgU3ltYm9sUmVmZXJlbmNlLCBMc3BRdWVyeVJlc3VsdCwgTHNwQ2FwYWJpbGl0eSwgTHNwQ2xpZW50Q29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBMc3BDbGllbnRQb29sIH0gZnJvbSAnLi9sc3BfY2xpZW50X3Bvb2wnO1xuaW1wb3J0IHsgUGFyc2VyRmFsbGJhY2sgfSBmcm9tICcuL3BhcnNlcl9mYWxsYmFjayc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIExTUCBCcmlkZ2Ug6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTHNwQnJpZGdlQ29uZmlnIHtcbiAgLyoqIOaUr+aMgeeahOiqnuiogCAqL1xuICBsYW5ndWFnZXM/OiBzdHJpbmdbXTtcbiAgXG4gIC8qKiBMU1Ag6LaF5pe25pe26Ze077yI5q+r56eS77yJICovXG4gIHRpbWVvdXRNcz86IG51bWJlcjtcbiAgXG4gIC8qKiDoh6rliqjpmY3nuqcgKi9cbiAgYXV0b0ZhbGxiYWNrPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDkvY3nva7kv6Hmga9cbiAqL1xuaW50ZXJmYWNlIFBvc2l0aW9uIHtcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTFNQIEJyaWRnZVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgTHNwQnJpZGdlIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPExzcEJyaWRnZUNvbmZpZz47XG4gIHByaXZhdGUgY2xpZW50UG9vbDogTHNwQ2xpZW50UG9vbDtcbiAgcHJpdmF0ZSBwYXJzZXJGYWxsYmFjazogUGFyc2VyRmFsbGJhY2s7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IExzcEJyaWRnZUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBsYW5ndWFnZXM6IGNvbmZpZy5sYW5ndWFnZXMgPz8gWydUeXBlU2NyaXB0JywgJ0phdmFTY3JpcHQnLCAnUHl0aG9uJ10sXG4gICAgICB0aW1lb3V0TXM6IGNvbmZpZy50aW1lb3V0TXMgPz8gMTAwMDAsXG4gICAgICBhdXRvRmFsbGJhY2s6IGNvbmZpZy5hdXRvRmFsbGJhY2sgPz8gdHJ1ZSxcbiAgICB9O1xuICAgIFxuICAgIHRoaXMuY2xpZW50UG9vbCA9IG5ldyBMc3BDbGllbnRQb29sKCk7XG4gICAgdGhpcy5wYXJzZXJGYWxsYmFjayA9IG5ldyBQYXJzZXJGYWxsYmFjayh7IHRpbWVvdXRNczogdGhpcy5jb25maWcudGltZW91dE1zIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+lIExTUCDmmK/lkKblj6/nlKhcbiAgICovXG4gIGFzeW5jIGlzTHNwQXZhaWxhYmxlKHJlcG9Sb290OiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY2xpZW50ID0gYXdhaXQgdGhpcy5jbGllbnRQb29sLmdldE9yQ3JlYXRlQ2xpZW50KHJlcG9Sb290LCBsYW5ndWFnZSk7XG4gICAgICByZXR1cm4gY2xpZW50LmlzUnVubmluZygpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluWumuS5iVxuICAgKi9cbiAgYXN5bmMgZ2V0RGVmaW5pdGlvbnMoXG4gICAgZmlsZVBhdGg6IHN0cmluZyxcbiAgICBwb3NpdGlvbjogUG9zaXRpb24sXG4gICAgcmVwb1Jvb3Q6IHN0cmluZ1xuICApOiBQcm9taXNlPExzcFF1ZXJ5UmVzdWx0PFN5bWJvbERlZmluaXRpb25bXT4+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGxhbmd1YWdlID0gdGhpcy5nZXRMYW5ndWFnZShmaWxlUGF0aCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWwneivlSBMU1BcbiAgICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHRoaXMuY2xpZW50UG9vbC5nZXRPckNyZWF0ZUNsaWVudChyZXBvUm9vdCwgbGFuZ3VhZ2UpO1xuICAgICAgY29uc3QgbHNwUmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcbiAgICAgICAgY2xpZW50LmZpbmREZWZpbml0aW9uKGZpbGVQYXRoLCBwb3NpdGlvbiksXG4gICAgICAgIHRoaXMudGltZW91dFByb21pc2UodGhpcy5jb25maWcudGltZW91dE1zKSxcbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAobHNwUmVzdWx0ICYmIGxzcFJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZGF0YTogdGhpcy5jb252ZXJ0THNwRGVmaW5pdGlvbnMobHNwUmVzdWx0LCBmaWxlUGF0aCksXG4gICAgICAgICAgc291cmNlOiAnbHNwJyxcbiAgICAgICAgICBjb25maWRlbmNlOiAwLjk1LFxuICAgICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIExTUCDlpLHotKXvvIznu6fnu63pmY3nuqdcbiAgICB9XG4gICAgXG4gICAgLy8g6ZmN57qn5YiwIHBhcnNlclxuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvRmFsbGJhY2spIHtcbiAgICAgIGNvbnN0IGZhbGxiYWNrUmVzdWx0ID0gYXdhaXQgdGhpcy5wYXJzZXJGYWxsYmFjay5maW5kRGVmaW5pdGlvbihcbiAgICAgICAgJ3Vua25vd24nLCAvLyBzeW1ib2wgbmFtZVxuICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgcmVwb1Jvb3RcbiAgICAgICk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IGZhbGxiYWNrUmVzdWx0LmRhdGEgPyBbZmFsbGJhY2tSZXN1bHQuZGF0YV0gOiBbXSxcbiAgICAgICAgc291cmNlOiBmYWxsYmFja1Jlc3VsdC51c2VkRmFsbGJhY2ssXG4gICAgICAgIGNvbmZpZGVuY2U6IGZhbGxiYWNrUmVzdWx0LnVzZWRGYWxsYmFjayA9PT0gJ3BhcnNlcicgPyAwLjcgOiAwLjUsXG4gICAgICAgIGZhbGxiYWNrUmVhc29uOiBmYWxsYmFja1Jlc3VsdC5yZWFzb24sXG4gICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogW10sXG4gICAgICBzb3VyY2U6ICdsc3AnLFxuICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgIGZhbGxiYWNrUmVhc29uOiAnTFNQIHVuYXZhaWxhYmxlIGFuZCBmYWxsYmFjayBkaXNhYmxlZCcsXG4gICAgICBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blvJXnlKhcbiAgICovXG4gIGFzeW5jIGdldFJlZmVyZW5jZXMoXG4gICAgZmlsZVBhdGg6IHN0cmluZyxcbiAgICBwb3NpdGlvbjogUG9zaXRpb24sXG4gICAgcmVwb1Jvb3Q6IHN0cmluZyxcbiAgICBzeW1ib2xOYW1lPzogc3RyaW5nXG4gICk6IFByb21pc2U8THNwUXVlcnlSZXN1bHQ8U3ltYm9sUmVmZXJlbmNlW10+PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBsYW5ndWFnZSA9IHRoaXMuZ2V0TGFuZ3VhZ2UoZmlsZVBhdGgpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyDlsJ3or5UgTFNQXG4gICAgICBjb25zdCBjbGllbnQgPSBhd2FpdCB0aGlzLmNsaWVudFBvb2wuZ2V0T3JDcmVhdGVDbGllbnQocmVwb1Jvb3QsIGxhbmd1YWdlKTtcbiAgICAgIGNvbnN0IGxzcFJlc3VsdCA9IGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICAgIGNsaWVudC5maW5kUmVmZXJlbmNlcyhmaWxlUGF0aCwgcG9zaXRpb24pLFxuICAgICAgICB0aGlzLnRpbWVvdXRQcm9taXNlKHRoaXMuY29uZmlnLnRpbWVvdXRNcyksXG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKGxzcFJlc3VsdCAmJiBsc3BSZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHRoaXMuY29udmVydExzcFJlZmVyZW5jZXMobHNwUmVzdWx0LCBmaWxlUGF0aCksXG4gICAgICAgICAgc291cmNlOiAnbHNwJyxcbiAgICAgICAgICBjb25maWRlbmNlOiAwLjksXG4gICAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTFNQIOWksei0pe+8jOe7p+e7remZjee6p1xuICAgIH1cbiAgICBcbiAgICAvLyDpmY3nuqfliLAgcGFyc2VyXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9GYWxsYmFjayAmJiBzeW1ib2xOYW1lKSB7XG4gICAgICBjb25zdCBmYWxsYmFja1Jlc3VsdCA9IGF3YWl0IHRoaXMucGFyc2VyRmFsbGJhY2suZmluZFJlZmVyZW5jZXMoXG4gICAgICAgIHsgbmFtZTogc3ltYm9sTmFtZSwga2luZDogJ2Z1bmN0aW9uJywgZmlsZTogZmlsZVBhdGgsIGxpbmU6IHBvc2l0aW9uLmxpbmUsIGxhbmd1YWdlIH0sXG4gICAgICAgIHJlcG9Sb290XG4gICAgICApO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRhOiBmYWxsYmFja1Jlc3VsdC5kYXRhIHx8IFtdLFxuICAgICAgICBzb3VyY2U6IGZhbGxiYWNrUmVzdWx0LnVzZWRGYWxsYmFjayxcbiAgICAgICAgY29uZmlkZW5jZTogZmFsbGJhY2tSZXN1bHQudXNlZEZhbGxiYWNrID09PSAncGFyc2VyJyA/IDAuNyA6IDAuNSxcbiAgICAgICAgZmFsbGJhY2tSZWFzb246IGZhbGxiYWNrUmVzdWx0LnJlYXNvbixcbiAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBbXSxcbiAgICAgIHNvdXJjZTogJ2xzcCcsXG4gICAgICBjb25maWRlbmNlOiAwLFxuICAgICAgZmFsbGJhY2tSZWFzb246ICdMU1AgdW5hdmFpbGFibGUgYW5kIGZhbGxiYWNrIGRpc2FibGVkJyxcbiAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluaWh+aho+espuWPt1xuICAgKi9cbiAgYXN5bmMgZ2V0RG9jdW1lbnRTeW1ib2xzKFxuICAgIGZpbGVQYXRoOiBzdHJpbmcsXG4gICAgcmVwb1Jvb3Q6IHN0cmluZ1xuICApOiBQcm9taXNlPExzcFF1ZXJ5UmVzdWx0PFN5bWJvbERlZmluaXRpb25bXT4+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGxhbmd1YWdlID0gdGhpcy5nZXRMYW5ndWFnZShmaWxlUGF0aCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWwneivlSBMU1BcbiAgICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHRoaXMuY2xpZW50UG9vbC5nZXRPckNyZWF0ZUNsaWVudChyZXBvUm9vdCwgbGFuZ3VhZ2UpO1xuICAgICAgY29uc3QgbHNwUmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcbiAgICAgICAgY2xpZW50LmdldERvY3VtZW50U3ltYm9scyhmaWxlUGF0aCksXG4gICAgICAgIHRoaXMudGltZW91dFByb21pc2UodGhpcy5jb25maWcudGltZW91dE1zKSxcbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAobHNwUmVzdWx0ICYmIGxzcFJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZGF0YTogdGhpcy5jb252ZXJ0THNwU3ltYm9scyhsc3BSZXN1bHQsIGZpbGVQYXRoKSxcbiAgICAgICAgICBzb3VyY2U6ICdsc3AnLFxuICAgICAgICAgIGNvbmZpZGVuY2U6IDAuOSxcbiAgICAgICAgICBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBMU1Ag5aSx6LSl77yM6ZmN57qn5YiwIHBhcnNlclxuICAgIH1cbiAgICBcbiAgICAvLyDpmY3nuqfliLAgcGFyc2VyXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9GYWxsYmFjaykge1xuICAgICAgY29uc3QgcGFyc2VSZXN1bHQgPSBhd2FpdCB0aGlzLnBhcnNlckZhbGxiYWNrLnBhcnNlU3ltYm9scyhmaWxlUGF0aCk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IHBhcnNlUmVzdWx0LnN5bWJvbHMsXG4gICAgICAgIHNvdXJjZTogJ3BhcnNlcicsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuNyxcbiAgICAgICAgZmFsbGJhY2tSZWFzb246ICdMU1AgdW5hdmFpbGFibGUsIHVzaW5nIHBhcnNlcicsXG4gICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogW10sXG4gICAgICBzb3VyY2U6ICdsc3AnLFxuICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgIGZhbGxiYWNrUmVhc29uOiAnTFNQIHVuYXZhaWxhYmxlIGFuZCBmYWxsYmFjayBkaXNhYmxlZCcsXG4gICAgICBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blt6XkvZzljLrnrKblj7dcbiAgICovXG4gIGFzeW5jIGdldFdvcmtzcGFjZVN5bWJvbHMoXG4gICAgcXVlcnk6IHN0cmluZyxcbiAgICByZXBvUm9vdDogc3RyaW5nXG4gICk6IFByb21pc2U8THNwUXVlcnlSZXN1bHQ8U3ltYm9sRGVmaW5pdGlvbltdPj4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g566A5YyW5a6e546w77yaTFNQIOW3peS9nOWMuuespuWPt+afpeivoui+g+Wkjeadgu+8jOaaguaXtumZjee6p1xuICAgIGNvbnN0IGZhbGxiYWNrUmVzdWx0ID0gYXdhaXQgdGhpcy5wYXJzZXJGYWxsYmFjay5maW5kRGVmaW5pdGlvbihxdWVyeSwgJycsIHJlcG9Sb290KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogZmFsbGJhY2tSZXN1bHQuZGF0YSA/IFtmYWxsYmFja1Jlc3VsdC5kYXRhXSA6IFtdLFxuICAgICAgc291cmNlOiAnc3RhdGljX3NjYW4nLFxuICAgICAgY29uZmlkZW5jZTogMC42LFxuICAgICAgZmFsbGJhY2tSZWFzb246ICdXb3Jrc3BhY2Ugc3ltYm9scyB2aWEgc3RhdGljIHNjYW4nLFxuICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l6IO95YqbXG4gICAqL1xuICBoYXNDYXBhYmlsaXR5KHJlcG9Sb290OiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcsIGNhcGFiaWxpdHk6IExzcENhcGFiaWxpdHkpOiBib29sZWFuIHtcbiAgICAvLyDnroDljJblrp7njrBcbiAgICBjb25zdCBzdXBwb3J0ZWRDYXBhYmlsaXRpZXM6IFJlY29yZDxzdHJpbmcsIExzcENhcGFiaWxpdHlbXT4gPSB7XG4gICAgICAnVHlwZVNjcmlwdCc6IFsnZGVmaW5pdGlvbicsICdyZWZlcmVuY2VzJywgJ2RvY3VtZW50U3ltYm9scycsICd3b3Jrc3BhY2VTeW1ib2xzJ10sXG4gICAgICAnSmF2YVNjcmlwdCc6IFsnZGVmaW5pdGlvbicsICdyZWZlcmVuY2VzJywgJ2RvY3VtZW50U3ltYm9scycsICd3b3Jrc3BhY2VTeW1ib2xzJ10sXG4gICAgICAnUHl0aG9uJzogWydkZWZpbml0aW9uJywgJ3JlZmVyZW5jZXMnLCAnZG9jdW1lbnRTeW1ib2xzJ10sXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gc3VwcG9ydGVkQ2FwYWJpbGl0aWVzW2xhbmd1YWdlXT8uaW5jbHVkZXMoY2FwYWJpbGl0eSkgPz8gZmFsc2U7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlgZzmraLmiYDmnInlrqLmiLfnq69cbiAgICovXG4gIGFzeW5jIHN0b3BBbGwoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5jbGllbnRQb29sLnN0b3BBbGwoKTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOi9rOaNoiBMU1Ag5a6a5LmJ5Li65YaF6YOo57G75Z6LXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRMc3BEZWZpbml0aW9ucyhsc3BEZWZzOiBhbnlbXSwgZmlsZVBhdGg6IHN0cmluZyk6IFN5bWJvbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIGxzcERlZnMubWFwKGRlZiA9PiAoe1xuICAgICAgbmFtZTogZGVmLm5hbWUgfHwgJ3Vua25vd24nLFxuICAgICAga2luZDogdGhpcy5tYXBMc3BTeW1ib2xLaW5kKGRlZi5raW5kKSBhcyBhbnksXG4gICAgICBmaWxlOiBkZWYudXJpID8gdGhpcy51cmlUb1BhdGgoZGVmLnVyaSkgOiBmaWxlUGF0aCxcbiAgICAgIGxpbmU6IGRlZi5yYW5nZT8uc3RhcnQ/LmxpbmUgfHwgMCxcbiAgICAgIGNvbHVtbjogZGVmLnJhbmdlPy5zdGFydD8uY2hhcmFjdGVyIHx8IDAsXG4gICAgICBsYW5ndWFnZTogdGhpcy5nZXRMYW5ndWFnZShmaWxlUGF0aCksXG4gICAgICBjb25maWRlbmNlOiAwLjk1LFxuICAgIH0pKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOi9rOaNoiBMU1Ag5byV55So5Li65YaF6YOo57G75Z6LXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRMc3BSZWZlcmVuY2VzKGxzcFJlZnM6IGFueVtdLCBmaWxlUGF0aDogc3RyaW5nKTogU3ltYm9sUmVmZXJlbmNlW10ge1xuICAgIHJldHVybiBsc3BSZWZzLm1hcChyZWYgPT4gKHtcbiAgICAgIHN5bWJvbDoge1xuICAgICAgICBuYW1lOiAndW5rbm93bicsXG4gICAgICAgIGtpbmQ6ICdmdW5jdGlvbicsXG4gICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICBsaW5lOiAwLFxuICAgICAgICBsYW5ndWFnZTogdGhpcy5nZXRMYW5ndWFnZShmaWxlUGF0aCksXG4gICAgICB9LFxuICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgZmlsZTogcmVmLnVyaSA/IHRoaXMudXJpVG9QYXRoKHJlZi51cmkpIDogZmlsZVBhdGgsXG4gICAgICAgIGxpbmU6IHJlZi5yYW5nZT8uc3RhcnQ/LmxpbmUgfHwgMCxcbiAgICAgIH0sXG4gICAgICByZWZlcmVuY2VUeXBlOiAncmVmZXJlbmNlJyxcbiAgICB9KSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDovazmjaIgTFNQIOespuWPt+S4uuWGhemDqOexu+Wei1xuICAgKi9cbiAgcHJpdmF0ZSBjb252ZXJ0THNwU3ltYm9scyhsc3BTeW1ib2xzOiBhbnlbXSwgZmlsZVBhdGg6IHN0cmluZyk6IFN5bWJvbERlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIGxzcFN5bWJvbHMubWFwKHN5bSA9PiAoe1xuICAgICAgbmFtZTogc3ltLm5hbWUgfHwgJ3Vua25vd24nLFxuICAgICAga2luZDogdGhpcy5tYXBMc3BTeW1ib2xLaW5kKHN5bS5raW5kKSBhcyBhbnksXG4gICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgIGxpbmU6IHN5bS5sb2NhdGlvbj8ucmFuZ2U/LnN0YXJ0Py5saW5lIHx8IDAsXG4gICAgICBsYW5ndWFnZTogdGhpcy5nZXRMYW5ndWFnZShmaWxlUGF0aCksXG4gICAgICBjb25maWRlbmNlOiAwLjksXG4gICAgfSkpO1xuICB9XG4gIFxuICAvKipcbiAgICog5pig5bCEIExTUCDnrKblj7fnsbvlnotcbiAgICovXG4gIHByaXZhdGUgbWFwTHNwU3ltYm9sS2luZChraW5kOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IGtpbmRNYXA6IFJlY29yZDxudW1iZXIsIHN0cmluZz4gPSB7XG4gICAgICAxOiAnZmlsZScsXG4gICAgICAyOiAnbW9kdWxlJyxcbiAgICAgIDM6ICduYW1lc3BhY2UnLFxuICAgICAgNDogJ3BhY2thZ2UnLFxuICAgICAgNTogJ2NsYXNzJyxcbiAgICAgIDY6ICdtZXRob2QnLFxuICAgICAgNzogJ3Byb3BlcnR5JyxcbiAgICAgIDg6ICdmaWVsZCcsXG4gICAgICA5OiAnY29uc3RydWN0b3InLFxuICAgICAgMTA6ICdlbnVtJyxcbiAgICAgIDExOiAnaW50ZXJmYWNlJyxcbiAgICAgIDEyOiAnZnVuY3Rpb24nLFxuICAgICAgMTM6ICd2YXJpYWJsZScsXG4gICAgICAxNDogJ2NvbnN0YW50JyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiBraW5kTWFwW2tpbmRdIHx8ICd1bmtub3duJztcbiAgfVxuICBcbiAgLyoqXG4gICAqIFVSSSDovazot6/lvoRcbiAgICovXG4gIHByaXZhdGUgdXJpVG9QYXRoKHVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAodXJpLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgcmV0dXJuIHVyaS5zbGljZSg3KTtcbiAgICB9XG4gICAgcmV0dXJuIHVyaTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluivreiogFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRMYW5ndWFnZShmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgc3dpdGNoIChleHQpIHtcbiAgICAgIGNhc2UgJy50cyc6XG4gICAgICBjYXNlICcudHN4JzpcbiAgICAgICAgcmV0dXJuICdUeXBlU2NyaXB0JztcbiAgICAgIGNhc2UgJy5qcyc6XG4gICAgICBjYXNlICcuanN4JzpcbiAgICAgICAgcmV0dXJuICdKYXZhU2NyaXB0JztcbiAgICAgIGNhc2UgJy5weSc6XG4gICAgICAgIHJldHVybiAnUHl0aG9uJztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAndW5rbm93bic7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6LaF5pe2IFByb21pc2VcbiAgICovXG4gIHByaXZhdGUgdGltZW91dFByb21pc2UobXM6IG51bWJlcik6IFByb21pc2U8bmV2ZXI+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKF8sIHJlamVjdCkgPT4ge1xuICAgICAgc2V0VGltZW91dCgoKSA9PiByZWplY3QobmV3IEVycm9yKGBUaW1lb3V0IGFmdGVyICR7bXN9bXNgKSksIG1zKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7ogTFNQIEJyaWRnZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTHNwQnJpZGdlKGNvbmZpZz86IExzcEJyaWRnZUNvbmZpZyk6IExzcEJyaWRnZSB7XG4gIHJldHVybiBuZXcgTHNwQnJpZGdlKGNvbmZpZyk7XG59XG4iXX0=