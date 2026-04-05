"use strict";
/**
 * Call Graph - 调用关系图
 *
 * 职责：
 * 1. 构建文件级依赖边
 * 2. 构建符号级直接调用边
 * 3. 构建 import 边
 * 4. 构建继承边
 * 5. 输出轻量级调用图
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
exports.CallGraphBuilder = void 0;
exports.createCallGraphBuilder = createCallGraphBuilder;
exports.buildCallGraph = buildCallGraph;
const reference_search_1 = require("./reference_search");
// ============================================================================
// 调用图构建器
// ============================================================================
class CallGraphBuilder {
    constructor() {
        this.referenceSearch = new reference_search_1.ReferenceSearch();
    }
    /**
     * 设置索引
     */
    setIndex(index) {
        this.index = index;
        this.referenceSearch.setIndex(index);
    }
    /**
     * 构建调用图
     */
    async build(symbol) {
        if (!this.index) {
            return {
                callers: [],
                callees: [],
                fileDependencies: [],
                depth: 0,
            };
        }
        // 构建文件依赖
        const fileDeps = await this.buildFileDependencies();
        if (!symbol) {
            return {
                callers: [],
                callees: [],
                fileDependencies: fileDeps,
                depth: 0,
            };
        }
        // 查找引用（调用者）
        const refs = await this.referenceSearch.findReferences(symbol);
        const callers = this.extractCallers(refs.references);
        // 查找被调用者（函数体内的调用）
        const callees = await this.findCallees(symbol);
        return {
            callers,
            callees,
            fileDependencies: fileDeps,
            depth: 1, // 第一版只做直接调用
        };
    }
    /**
     * 构建文件依赖关系
     */
    async buildFileDependencies() {
        const relations = [];
        if (!this.index)
            return relations;
        // 按文件分组符号
        const fileSymbols = new Map();
        for (const [file, symbols] of this.index.byFile.entries()) {
            fileSymbols.set(file, symbols);
        }
        // 查找 import 关系
        for (const [file, symbols] of fileSymbols.entries()) {
            const content = await this.readFile(file);
            if (!content)
                continue;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // import ... from '...'
                const importMatch = line.match(/import\s+.*?\s+from\s+['"](.+?)['"]/);
                if (importMatch) {
                    const importPath = importMatch[1];
                    const resolvedPath = this.resolveImportPath(file, importPath);
                    if (resolvedPath) {
                        const importedSymbols = this.extractImportedSymbols(line);
                        relations.push({
                            from: file,
                            to: resolvedPath,
                            relation: 'imports',
                            symbols: importedSymbols,
                        });
                    }
                }
            }
        }
        return relations;
    }
    /**
     * 查找被调用者
     */
    async findCallees(symbol) {
        const callees = [];
        // 读取符号定义的文件内容
        const content = await this.readFile(symbol.file);
        if (!content)
            return callees;
        const lines = content.split('\n');
        // 获取符号体范围
        const startLine = symbol.line - 1;
        const endLine = symbol.endLine || startLine + 20; // 默认 20 行
        for (let i = startLine; i < Math.min(endLine, lines.length); i++) {
            const line = lines[i];
            // 查找函数调用
            const callMatches = line.matchAll(/\b(\w+)\s*\(/g);
            for (const match of callMatches) {
                const calledName = match[1];
                // 跳过关键字
                if (['if', 'for', 'while', 'switch', 'return', 'function', 'def', 'class'].includes(calledName)) {
                    continue;
                }
                // 在索引中查找
                const definitions = this.index?.byName.get(calledName);
                if (definitions) {
                    callees.push(...definitions);
                }
            }
        }
        // 去重
        const unique = Array.from(new Set(callees.map(s => `${s.file}:${s.line}`)))
            .map(key => callees.find(s => `${s.file}:${s.line}` === key))
            .filter((s) => s !== undefined);
        return unique;
    }
    /**
     * 提取调用者
     */
    extractCallers(references) {
        const callers = [];
        for (const ref of references) {
            if (ref.referenceType === 'call' || ref.referenceType === 'import') {
                // 在引用位置查找调用者符号
                const fileSymbols = this.index?.byFile.get(ref.location.file);
                if (fileSymbols) {
                    // 查找包含引用位置的符号
                    const caller = fileSymbols.find(s => s.line <= ref.location.line &&
                        (s.endLine || s.line + 20) >= ref.location.line);
                    if (caller && caller !== ref.symbol) {
                        callers.push(caller);
                    }
                }
            }
        }
        return callers;
    }
    /**
     * 解析导入路径
     */
    resolveImportPath(fromFile, importPath) {
        // 相对路径
        if (importPath.startsWith('.')) {
            const fromDir = importPath.dirname(fromFile);
            const resolved = importPath.join(fromDir, importPath);
            return resolved;
        }
        // 绝对路径（包名）- 简化处理
        // 实际应该查找 node_modules 或 site-packages
        return null;
    }
    /**
     * 提取导入的符号
     */
    extractImportedSymbols(importLine) {
        const symbols = [];
        // import { a, b, c } from ...
        const namedMatch = importLine.match(/import\s+{([^}]+)}\s+from/);
        if (namedMatch) {
            symbols.push(...namedMatch[1].split(',').map(s => s.trim()));
        }
        // import a from ...
        const defaultMatch = importLine.match(/import\s+(\w+)\s+from/);
        if (defaultMatch) {
            symbols.push(defaultMatch[1]);
        }
        return symbols;
    }
    /**
     * 读取文件
     */
    async readFile(filePath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            return await fs.readFile(filePath, 'utf-8');
        }
        catch {
            return null;
        }
    }
}
exports.CallGraphBuilder = CallGraphBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建调用图构建器
 */
function createCallGraphBuilder() {
    return new CallGraphBuilder();
}
/**
 * 快速构建调用图
 */
async function buildCallGraph(index, symbol) {
    const builder = new CallGraphBuilder();
    builder.setIndex(index);
    return await builder.build(symbol);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbF9ncmFwaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb2RlL2NhbGxfZ3JhcGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBd1JILHdEQUVDO0FBS0Qsd0NBT0M7QUFuU0QseURBQXFEO0FBd0NyRCwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRSxNQUFhLGdCQUFnQjtJQUkzQjtRQUNFLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7SUFDL0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsUUFBUSxDQUFDLEtBQWtCO1FBQ3pCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBeUI7UUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixPQUFPO2dCQUNMLE9BQU8sRUFBRSxFQUFFO2dCQUNYLE9BQU8sRUFBRSxFQUFFO2dCQUNYLGdCQUFnQixFQUFFLEVBQUU7Z0JBQ3BCLEtBQUssRUFBRSxDQUFDO2FBQ1QsQ0FBQztRQUNKLENBQUM7UUFFRCxTQUFTO1FBQ1QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUVwRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPO2dCQUNMLE9BQU8sRUFBRSxFQUFFO2dCQUNYLE9BQU8sRUFBRSxFQUFFO2dCQUNYLGdCQUFnQixFQUFFLFFBQVE7Z0JBQzFCLEtBQUssRUFBRSxDQUFDO2FBQ1QsQ0FBQztRQUNKLENBQUM7UUFFRCxZQUFZO1FBQ1osTUFBTSxJQUFJLEdBQUcs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SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBZ0I7UUFDckMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUFFLEdBQUcsd0RBQWEsYUFBYSxHQUFDLENBQUM7WUFDdkMsT0FBTyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFoT0QsNENBZ09DO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixzQkFBc0I7SUFDcEMsT0FBTyxJQUFJLGdCQUFnQixFQUFFLENBQUM7QUFDaEMsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGNBQWMsQ0FDbEMsS0FBa0IsRUFDbEIsTUFBeUI7SUFFekIsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3ZDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDeEIsT0FBTyxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDckMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FsbCBHcmFwaCAtIOiwg+eUqOWFs+ezu+WbvlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOaehOW7uuaWh+S7tue6p+S+nei1lui+uVxuICogMi4g5p6E5bu656ym5Y+357qn55u05o6l6LCD55So6L65XG4gKiAzLiDmnoTlu7ogaW1wb3J0IOi+uVxuICogNC4g5p6E5bu657un5om/6L65XG4gKiA1LiDovpPlh7rovbvph4/nuqfosIPnlKjlm75cbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBTeW1ib2xEZWZpbml0aW9uLCBTeW1ib2xSZWxhdGlvbiwgUmVsYXRpb25UeXBlLCBTeW1ib2xJbmRleCwgU3ltYm9sUmVmZXJlbmNlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBSZWZlcmVuY2VTZWFyY2ggfSBmcm9tICcuL3JlZmVyZW5jZV9zZWFyY2gnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmlofku7blhbPns7tcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGaWxlUmVsYXRpb24ge1xuICAvKiog5rqQ5paH5Lu2ICovXG4gIGZyb206IHN0cmluZztcbiAgXG4gIC8qKiDnm67moIfmlofku7YgKi9cbiAgdG86IHN0cmluZztcbiAgXG4gIC8qKiDlhbPns7vnsbvlnosgKi9cbiAgcmVsYXRpb246ICdpbXBvcnRzJyB8ICdkZXBlbmRzX29uJztcbiAgXG4gIC8qKiDlr7zlhaXnmoTnrKblj7cgKi9cbiAgc3ltYm9scz86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIOiwg+eUqOWbvuaRmOimgVxuICovXG5leHBvcnQgaW50ZXJmYWNlIENhbGxHcmFwaFN1bW1hcnkge1xuICAvKiog6LCD55So6ICFICovXG4gIGNhbGxlcnM6IFN5bWJvbERlZmluaXRpb25bXTtcbiAgXG4gIC8qKiDooqvosIPnlKjogIUgKi9cbiAgY2FsbGVlczogU3ltYm9sRGVmaW5pdGlvbltdO1xuICBcbiAgLyoqIOaWh+S7tuS+nei1liAqL1xuICBmaWxlRGVwZW5kZW5jaWVzOiBGaWxlUmVsYXRpb25bXTtcbiAgXG4gIC8qKiDosIPnlKjmt7HluqYgKi9cbiAgZGVwdGg6IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6LCD55So5Zu+5p6E5bu65ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBDYWxsR3JhcGhCdWlsZGVyIHtcbiAgcHJpdmF0ZSBpbmRleD86IFN5bWJvbEluZGV4O1xuICBwcml2YXRlIHJlZmVyZW5jZVNlYXJjaDogUmVmZXJlbmNlU2VhcmNoO1xuICBcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5yZWZlcmVuY2VTZWFyY2ggPSBuZXcgUmVmZXJlbmNlU2VhcmNoKCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorr7nva7ntKLlvJVcbiAgICovXG4gIHNldEluZGV4KGluZGV4OiBTeW1ib2xJbmRleCk6IHZvaWQge1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICB0aGlzLnJlZmVyZW5jZVNlYXJjaC5zZXRJbmRleChpbmRleCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rosIPnlKjlm75cbiAgICovXG4gIGFzeW5jIGJ1aWxkKHN5bWJvbD86IFN5bWJvbERlZmluaXRpb24pOiBQcm9taXNlPENhbGxHcmFwaFN1bW1hcnk+IHtcbiAgICBpZiAoIXRoaXMuaW5kZXgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNhbGxlcnM6IFtdLFxuICAgICAgICBjYWxsZWVzOiBbXSxcbiAgICAgICAgZmlsZURlcGVuZGVuY2llczogW10sXG4gICAgICAgIGRlcHRoOiAwLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5p6E5bu65paH5Lu25L6d6LWWXG4gICAgY29uc3QgZmlsZURlcHMgPSBhd2FpdCB0aGlzLmJ1aWxkRmlsZURlcGVuZGVuY2llcygpO1xuICAgIFxuICAgIGlmICghc3ltYm9sKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjYWxsZXJzOiBbXSxcbiAgICAgICAgY2FsbGVlczogW10sXG4gICAgICAgIGZpbGVEZXBlbmRlbmNpZXM6IGZpbGVEZXBzLFxuICAgICAgICBkZXB0aDogMCxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOafpeaJvuW8leeUqO+8iOiwg+eUqOiAhe+8iVxuICAgIGNvbnN0IHJlZnMgPSBhd2FpdCB0aGlzLnJlZmVyZW5jZVNlYXJjaC5maW5kUmVmZXJlbmNlcyhzeW1ib2wpO1xuICAgIGNvbnN0IGNhbGxlcnMgPSB0aGlzLmV4dHJhY3RDYWxsZXJzKHJlZnMucmVmZXJlbmNlcyk7XG4gICAgXG4gICAgLy8g5p+l5om+6KKr6LCD55So6ICF77yI5Ye95pWw5L2T5YaF55qE6LCD55So77yJXG4gICAgY29uc3QgY2FsbGVlcyA9IGF3YWl0IHRoaXMuZmluZENhbGxlZXMoc3ltYm9sKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgY2FsbGVycyxcbiAgICAgIGNhbGxlZXMsXG4gICAgICBmaWxlRGVwZW5kZW5jaWVzOiBmaWxlRGVwcyxcbiAgICAgIGRlcHRoOiAxLCAvLyDnrKzkuIDniYjlj6rlgZrnm7TmjqXosIPnlKhcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65paH5Lu25L6d6LWW5YWz57O7XG4gICAqL1xuICBhc3luYyBidWlsZEZpbGVEZXBlbmRlbmNpZXMoKTogUHJvbWlzZTxGaWxlUmVsYXRpb25bXT4ge1xuICAgIGNvbnN0IHJlbGF0aW9uczogRmlsZVJlbGF0aW9uW10gPSBbXTtcbiAgICBcbiAgICBpZiAoIXRoaXMuaW5kZXgpIHJldHVybiByZWxhdGlvbnM7XG4gICAgXG4gICAgLy8g5oyJ5paH5Lu25YiG57uE56ym5Y+3XG4gICAgY29uc3QgZmlsZVN5bWJvbHMgPSBuZXcgTWFwPHN0cmluZywgU3ltYm9sRGVmaW5pdGlvbltdPigpO1xuICAgIGZvciAoY29uc3QgW2ZpbGUsIHN5bWJvbHNdIG9mIHRoaXMuaW5kZXguYnlGaWxlLmVudHJpZXMoKSkge1xuICAgICAgZmlsZVN5bWJvbHMuc2V0KGZpbGUsIHN5bWJvbHMpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmn6Xmib4gaW1wb3J0IOWFs+ezu1xuICAgIGZvciAoY29uc3QgW2ZpbGUsIHN5bWJvbHNdIG9mIGZpbGVTeW1ib2xzLmVudHJpZXMoKSkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVhZEZpbGUoZmlsZSk7XG4gICAgICBpZiAoIWNvbnRlbnQpIGNvbnRpbnVlO1xuICAgICAgXG4gICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgICAgXG4gICAgICAgIC8vIGltcG9ydCAuLi4gZnJvbSAnLi4uJ1xuICAgICAgICBjb25zdCBpbXBvcnRNYXRjaCA9IGxpbmUubWF0Y2goL2ltcG9ydFxccysuKj9cXHMrZnJvbVxccytbJ1wiXSguKz8pWydcIl0vKTtcbiAgICAgICAgaWYgKGltcG9ydE1hdGNoKSB7XG4gICAgICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IGltcG9ydE1hdGNoWzFdO1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHRoaXMucmVzb2x2ZUltcG9ydFBhdGgoZmlsZSwgaW1wb3J0UGF0aCk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlc29sdmVkUGF0aCkge1xuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWRTeW1ib2xzID0gdGhpcy5leHRyYWN0SW1wb3J0ZWRTeW1ib2xzKGxpbmUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZWxhdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAgIGZyb206IGZpbGUsXG4gICAgICAgICAgICAgIHRvOiByZXNvbHZlZFBhdGgsXG4gICAgICAgICAgICAgIHJlbGF0aW9uOiAnaW1wb3J0cycsXG4gICAgICAgICAgICAgIHN5bWJvbHM6IGltcG9ydGVkU3ltYm9scyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVsYXRpb25zO1xuICB9XG4gIFxuICAvKipcbiAgICog5p+l5om+6KKr6LCD55So6ICFXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGZpbmRDYWxsZWVzKHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbik6IFByb21pc2U8U3ltYm9sRGVmaW5pdGlvbltdPiB7XG4gICAgY29uc3QgY2FsbGVlczogU3ltYm9sRGVmaW5pdGlvbltdID0gW107XG4gICAgXG4gICAgLy8g6K+75Y+W56ym5Y+35a6a5LmJ55qE5paH5Lu25YaF5a65XG4gICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVhZEZpbGUoc3ltYm9sLmZpbGUpO1xuICAgIGlmICghY29udGVudCkgcmV0dXJuIGNhbGxlZXM7XG4gICAgXG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICBcbiAgICAvLyDojrflj5bnrKblj7fkvZPojIPlm7RcbiAgICBjb25zdCBzdGFydExpbmUgPSBzeW1ib2wubGluZSAtIDE7XG4gICAgY29uc3QgZW5kTGluZSA9IHN5bWJvbC5lbmRMaW5lIHx8IHN0YXJ0TGluZSArIDIwOyAvLyDpu5jorqQgMjAg6KGMXG4gICAgXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0TGluZTsgaSA8IE1hdGgubWluKGVuZExpbmUsIGxpbmVzLmxlbmd0aCk7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgXG4gICAgICAvLyDmn6Xmib7lh73mlbDosIPnlKhcbiAgICAgIGNvbnN0IGNhbGxNYXRjaGVzID0gbGluZS5tYXRjaEFsbCgvXFxiKFxcdyspXFxzKlxcKC9nKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBjYWxsTWF0Y2hlcykge1xuICAgICAgICBjb25zdCBjYWxsZWROYW1lID0gbWF0Y2hbMV07XG4gICAgICAgIFxuICAgICAgICAvLyDot7Pov4flhbPplK7lrZdcbiAgICAgICAgaWYgKFsnaWYnLCAnZm9yJywgJ3doaWxlJywgJ3N3aXRjaCcsICdyZXR1cm4nLCAnZnVuY3Rpb24nLCAnZGVmJywgJ2NsYXNzJ10uaW5jbHVkZXMoY2FsbGVkTmFtZSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5Zyo57Si5byV5Lit5p+l5om+XG4gICAgICAgIGNvbnN0IGRlZmluaXRpb25zID0gdGhpcy5pbmRleD8uYnlOYW1lLmdldChjYWxsZWROYW1lKTtcbiAgICAgICAgaWYgKGRlZmluaXRpb25zKSB7XG4gICAgICAgICAgY2FsbGVlcy5wdXNoKC4uLmRlZmluaXRpb25zKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDljrvph41cbiAgICBjb25zdCB1bmlxdWUgPSBBcnJheS5mcm9tKG5ldyBTZXQoY2FsbGVlcy5tYXAocyA9PiBgJHtzLmZpbGV9OiR7cy5saW5lfWApKSlcbiAgICAgIC5tYXAoa2V5ID0+IGNhbGxlZXMuZmluZChzID0+IGAke3MuZmlsZX06JHtzLmxpbmV9YCA9PT0ga2V5KSlcbiAgICAgIC5maWx0ZXIoKHMpOiBzIGlzIFN5bWJvbERlZmluaXRpb24gPT4gcyAhPT0gdW5kZWZpbmVkKTtcbiAgICBcbiAgICByZXR1cm4gdW5pcXVlO1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W6LCD55So6ICFXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RDYWxsZXJzKHJlZmVyZW5jZXM6IFN5bWJvbFJlZmVyZW5jZVtdKTogU3ltYm9sRGVmaW5pdGlvbltdIHtcbiAgICBjb25zdCBjYWxsZXJzOiBTeW1ib2xEZWZpbml0aW9uW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHJlZiBvZiByZWZlcmVuY2VzKSB7XG4gICAgICBpZiAocmVmLnJlZmVyZW5jZVR5cGUgPT09ICdjYWxsJyB8fCByZWYucmVmZXJlbmNlVHlwZSA9PT0gJ2ltcG9ydCcpIHtcbiAgICAgICAgLy8g5Zyo5byV55So5L2N572u5p+l5om+6LCD55So6ICF56ym5Y+3XG4gICAgICAgIGNvbnN0IGZpbGVTeW1ib2xzID0gdGhpcy5pbmRleD8uYnlGaWxlLmdldChyZWYubG9jYXRpb24uZmlsZSk7XG4gICAgICAgIGlmIChmaWxlU3ltYm9scykge1xuICAgICAgICAgIC8vIOafpeaJvuWMheWQq+W8leeUqOS9jee9rueahOespuWPt1xuICAgICAgICAgIGNvbnN0IGNhbGxlciA9IGZpbGVTeW1ib2xzLmZpbmQocyA9PiBcbiAgICAgICAgICAgIHMubGluZSA8PSByZWYubG9jYXRpb24ubGluZSAmJiBcbiAgICAgICAgICAgIChzLmVuZExpbmUgfHwgcy5saW5lICsgMjApID49IHJlZi5sb2NhdGlvbi5saW5lXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY2FsbGVyICYmIGNhbGxlciAhPT0gcmVmLnN5bWJvbCkge1xuICAgICAgICAgICAgY2FsbGVycy5wdXNoKGNhbGxlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjYWxsZXJzO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej5p6Q5a+85YWl6Lev5b6EXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVJbXBvcnRQYXRoKGZyb21GaWxlOiBzdHJpbmcsIGltcG9ydFBhdGg6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIC8vIOebuOWvuei3r+W+hFxuICAgIGlmIChpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgY29uc3QgZnJvbURpciA9IGltcG9ydFBhdGguZGlybmFtZShmcm9tRmlsZSk7XG4gICAgICBjb25zdCByZXNvbHZlZCA9IGltcG9ydFBhdGguam9pbihmcm9tRGlyLCBpbXBvcnRQYXRoKTtcbiAgICAgIHJldHVybiByZXNvbHZlZDtcbiAgICB9XG4gICAgXG4gICAgLy8g57ud5a+56Lev5b6E77yI5YyF5ZCN77yJLSDnroDljJblpITnkIZcbiAgICAvLyDlrp7pmYXlupTor6Xmn6Xmib4gbm9kZV9tb2R1bGVzIOaIliBzaXRlLXBhY2thZ2VzXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5blr7zlhaXnmoTnrKblj7dcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdEltcG9ydGVkU3ltYm9scyhpbXBvcnRMaW5lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3Qgc3ltYm9sczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyBpbXBvcnQgeyBhLCBiLCBjIH0gZnJvbSAuLi5cbiAgICBjb25zdCBuYW1lZE1hdGNoID0gaW1wb3J0TGluZS5tYXRjaCgvaW1wb3J0XFxzK3soW159XSspfVxccytmcm9tLyk7XG4gICAgaWYgKG5hbWVkTWF0Y2gpIHtcbiAgICAgIHN5bWJvbHMucHVzaCguLi5uYW1lZE1hdGNoWzFdLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpKTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW1wb3J0IGEgZnJvbSAuLi5cbiAgICBjb25zdCBkZWZhdWx0TWF0Y2ggPSBpbXBvcnRMaW5lLm1hdGNoKC9pbXBvcnRcXHMrKFxcdyspXFxzK2Zyb20vKTtcbiAgICBpZiAoZGVmYXVsdE1hdGNoKSB7XG4gICAgICBzeW1ib2xzLnB1c2goZGVmYXVsdE1hdGNoWzFdKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN5bWJvbHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDor7vlj5bmlofku7ZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcmVhZEZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydCgnZnMvcHJvbWlzZXMnKTtcbiAgICAgIHJldHVybiBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66LCD55So5Zu+5p6E5bu65ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYWxsR3JhcGhCdWlsZGVyKCk6IENhbGxHcmFwaEJ1aWxkZXIge1xuICByZXR1cm4gbmV3IENhbGxHcmFwaEJ1aWxkZXIoKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mnoTlu7rosIPnlKjlm75cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1aWxkQ2FsbEdyYXBoKFxuICBpbmRleDogU3ltYm9sSW5kZXgsXG4gIHN5bWJvbD86IFN5bWJvbERlZmluaXRpb25cbik6IFByb21pc2U8Q2FsbEdyYXBoU3VtbWFyeT4ge1xuICBjb25zdCBidWlsZGVyID0gbmV3IENhbGxHcmFwaEJ1aWxkZXIoKTtcbiAgYnVpbGRlci5zZXRJbmRleChpbmRleCk7XG4gIHJldHVybiBhd2FpdCBidWlsZGVyLmJ1aWxkKHN5bWJvbCk7XG59XG4iXX0=