"use strict";
/**
 * Reference Search - 符号引用搜索
 *
 * 职责：
 * 1. 查找符号引用位置
 * 2. 识别 import/export 引用
 * 3. 识别函数调用引用
 * 4. 识别类继承/实现引用
 * 5. 返回引用上下文
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
exports.ReferenceSearch = void 0;
exports.createReferenceSearch = createReferenceSearch;
exports.findReferences = findReferences;
const fs = __importStar(require("fs/promises"));
// ============================================================================
// 引用搜索器
// ============================================================================
class ReferenceSearch {
    constructor(config = {}) {
        this.config = {
            contextLines: config.contextLines ?? 2,
            maxResults: config.maxResults ?? 50,
            excludeDirs: config.excludeDirs ?? [
                'node_modules',
                '__pycache__',
                '.git',
                'dist',
                'build',
            ],
        };
    }
    /**
     * 设置索引
     */
    setIndex(index) {
        this.index = index;
    }
    /**
     * 查找引用
     */
    async findReferences(symbol) {
        const startTime = Date.now();
        if (!this.index) {
            return { symbol, references: [], totalReferences: 0, durationMs: 0 };
        }
        const references = [];
        let totalReferences = 0;
        // 1. 查找 import/export 引用
        const importRefs = await this.findImportReferences(symbol);
        references.push(...importRefs);
        totalReferences += importRefs.length;
        // 2. 查找函数调用引用
        const callRefs = await this.findCallReferences(symbol);
        references.push(...callRefs);
        totalReferences += callRefs.length;
        // 3. 查找继承/实现引用
        const inheritRefs = await this.findInheritanceReferences(symbol);
        references.push(...inheritRefs);
        totalReferences += inheritRefs.length;
        // 4. 查找普通引用
        const generalRefs = await this.findGeneralReferences(symbol);
        references.push(...generalRefs);
        totalReferences += generalRefs.length;
        // 去重
        const unique = this.deduplicateReferences(references);
        // 限制结果数
        const limited = unique.slice(0, this.config.maxResults);
        return {
            symbol,
            references: limited,
            totalReferences,
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 查找 import/export 引用
     */
    async findImportReferences(symbol) {
        const references = [];
        // 在索引中查找导入该符号的文件
        for (const [file, symbols] of this.index?.byFile.entries() || []) {
            if (file === symbol.file)
                continue; // 跳过定义文件
            const content = await this.readFile(file);
            if (!content)
                continue;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // import { symbol } from ...
                if (line.includes(`import`) && line.includes(symbol.name)) {
                    const importMatch = line.match(new RegExp(`import\\s+.*?\\b${this.escapeRegex(symbol.name)}\\b.*?from`, 'i'));
                    if (importMatch) {
                        references.push({
                            symbol,
                            location: {
                                file,
                                line: i + 1,
                            },
                            referenceType: 'import',
                            context: this.getContext(lines, i),
                        });
                    }
                }
                // export { symbol }
                if (line.includes(`export`) && line.includes(symbol.name)) {
                    const exportMatch = line.match(new RegExp(`export\\s+.*?\\b${this.escapeRegex(symbol.name)}\\b`, 'i'));
                    if (exportMatch) {
                        references.push({
                            symbol,
                            location: {
                                file,
                                line: i + 1,
                            },
                            referenceType: 'export',
                            context: this.getContext(lines, i),
                        });
                    }
                }
            }
        }
        return references;
    }
    /**
     * 查找函数调用引用
     */
    async findCallReferences(symbol) {
        const references = [];
        if (symbol.kind !== 'function' && symbol.kind !== 'method') {
            return references;
        }
        // 扫描所有文件查找函数调用
        for (const [file, symbols] of this.index?.byFile.entries() || []) {
            if (file === symbol.file)
                continue;
            const content = await this.readFile(file);
            if (!content)
                continue;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 函数调用模式：symbolName(
                const callMatch = line.match(new RegExp(`\\b${this.escapeRegex(symbol.name)}\\s*\\(`));
                if (callMatch && !line.includes('function') && !line.includes('def')) {
                    references.push({
                        symbol,
                        location: {
                            file,
                            line: i + 1,
                        },
                        referenceType: 'call',
                        context: this.getContext(lines, i),
                    });
                }
            }
        }
        return references;
    }
    /**
     * 查找继承/实现引用
     */
    async findInheritanceReferences(symbol) {
        const references = [];
        if (symbol.kind !== 'class' && symbol.kind !== 'interface') {
            return references;
        }
        // 扫描所有文件查找继承/实现
        for (const [file, symbols] of this.index?.byFile.entries() || []) {
            if (file === symbol.file)
                continue;
            const content = await this.readFile(file);
            if (!content)
                continue;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // extends SymbolName
                const extendsMatch = line.match(new RegExp(`extends\\s+${this.escapeRegex(symbol.name)}\\b`));
                if (extendsMatch) {
                    references.push({
                        symbol,
                        location: {
                            file,
                            line: i + 1,
                        },
                        referenceType: 'inherit',
                        context: this.getContext(lines, i),
                    });
                }
                // implements SymbolName
                const implementsMatch = line.match(new RegExp(`implements\\s+${this.escapeRegex(symbol.name)}\\b`));
                if (implementsMatch) {
                    references.push({
                        symbol,
                        location: {
                            file,
                            line: i + 1,
                        },
                        referenceType: 'implement',
                        context: this.getContext(lines, i),
                    });
                }
            }
        }
        return references;
    }
    /**
     * 查找普通引用
     */
    async findGeneralReferences(symbol) {
        const references = [];
        // 在同文件中查找引用
        const fileSymbols = this.index?.byFile.get(symbol.file);
        if (fileSymbols) {
            const content = await this.readFile(symbol.file);
            if (content) {
                const lines = content.split('\n');
                for (let i = symbol.line; i < lines.length; i++) {
                    const line = lines[i];
                    // 跳过定义行
                    if (i + 1 === symbol.line)
                        continue;
                    if (line.includes(symbol.name)) {
                        references.push({
                            symbol,
                            location: {
                                file: symbol.file,
                                line: i + 1,
                            },
                            referenceType: 'reference',
                            context: this.getContext(lines, i),
                        });
                    }
                }
            }
        }
        return references;
    }
    /**
     * 去重引用
     */
    deduplicateReferences(references) {
        const seen = new Set();
        const unique = [];
        for (const ref of references) {
            const key = `${ref.location.file}:${ref.location.line}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(ref);
            }
        }
        return unique;
    }
    /**
     * 获取上下文
     */
    getContext(lines, lineIndex) {
        const start = Math.max(0, lineIndex - this.config.contextLines);
        const end = Math.min(lines.length, lineIndex + this.config.contextLines + 1);
        return lines.slice(start, end).join('\n');
    }
    /**
     * 读取文件
     */
    async readFile(filePath) {
        try {
            return await fs.readFile(filePath, 'utf-8');
        }
        catch {
            return null;
        }
    }
    /**
     * 转义正则表达式
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
exports.ReferenceSearch = ReferenceSearch;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建引用搜索器
 */
function createReferenceSearch(config) {
    return new ReferenceSearch(config);
}
/**
 * 快速查找引用
 */
async function findReferences(index, symbol) {
    const search = new ReferenceSearch();
    search.setIndex(index);
    return await search.findReferences(symbol);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmZXJlbmNlX3NlYXJjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb2RlL3JlZmVyZW5jZV9zZWFyY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBd1hILHNEQUVDO0FBS0Qsd0NBT0M7QUFwWUQsZ0RBQWtDO0FBdUNsQywrRUFBK0U7QUFDL0UsUUFBUTtBQUNSLCtFQUErRTtBQUUvRSxNQUFhLGVBQWU7SUFJMUIsWUFBWSxTQUFnQyxFQUFFO1FBQzVDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksSUFBSSxDQUFDO1lBQ3RDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxJQUFJLEVBQUU7WUFDbkMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXLElBQUk7Z0JBQ2pDLGNBQWM7Z0JBQ2QsYUFBYTtnQkFDYixNQUFNO2dCQUNOLE1BQU07Z0JBQ04sT0FBTzthQUNSO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVEsQ0FBQyxLQUFrQjtRQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQXdCO1FBQzNDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUU3QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2hCLE9BQU8sRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQXNCLEVBQUUsQ0FBQztRQUN6QyxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7UUFFeEIs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d0I7SUFFeEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUNyQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZCLE9BQU8sTUFBTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlZmVyZW5jZSBTZWFyY2ggLSDnrKblj7flvJXnlKjmkJzntKJcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDmn6Xmib7nrKblj7flvJXnlKjkvY3nva5cbiAqIDIuIOivhuWIqyBpbXBvcnQvZXhwb3J0IOW8leeUqFxuICogMy4g6K+G5Yir5Ye95pWw6LCD55So5byV55SoXG4gKiA0LiDor4bliKvnsbvnu6fmib8v5a6e546w5byV55SoXG4gKiA1LiDov5Tlm57lvJXnlKjkuIrkuIvmlodcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgU3ltYm9sRGVmaW5pdGlvbiwgU3ltYm9sUmVmZXJlbmNlLCBSZWZlcmVuY2VUeXBlLCBTeW1ib2xJbmRleCB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmkJzntKLlmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWZlcmVuY2VTZWFyY2hDb25maWcge1xuICAvKiog5YyF5ZCr5LiK5LiL5paH6KGM5pWwICovXG4gIGNvbnRleHRMaW5lcz86IG51bWJlcjtcbiAgXG4gIC8qKiDmnIDlpKfov5Tlm57nu5PmnpzmlbAgKi9cbiAgbWF4UmVzdWx0cz86IG51bWJlcjtcbiAgXG4gIC8qKiDmjpLpmaTnmoTnm67lvZUgKi9cbiAgZXhjbHVkZURpcnM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiDlvJXnlKjmkJzntKLnu5PmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWZlcmVuY2VTZWFyY2hSZXN1bHQge1xuICAvKiog56ym5Y+35a6a5LmJICovXG4gIHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbjtcbiAgXG4gIC8qKiDlvJXnlKjliJfooaggKi9cbiAgcmVmZXJlbmNlczogU3ltYm9sUmVmZXJlbmNlW107XG4gIFxuICAvKiog5byV55So5oC75pWw77yI5Y+v6IO96LaF6L+HIG1heFJlc3VsdHPvvIkgKi9cbiAgdG90YWxSZWZlcmVuY2VzOiBudW1iZXI7XG4gIFxuICAvKiog5pCc57Si6ICX5pe2ICovXG4gIGR1cmF0aW9uTXM6IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5byV55So5pCc57Si5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VTZWFyY2gge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8UmVmZXJlbmNlU2VhcmNoQ29uZmlnPjtcbiAgcHJpdmF0ZSBpbmRleD86IFN5bWJvbEluZGV4O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBSZWZlcmVuY2VTZWFyY2hDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgY29udGV4dExpbmVzOiBjb25maWcuY29udGV4dExpbmVzID8/IDIsXG4gICAgICBtYXhSZXN1bHRzOiBjb25maWcubWF4UmVzdWx0cyA/PyA1MCxcbiAgICAgIGV4Y2x1ZGVEaXJzOiBjb25maWcuZXhjbHVkZURpcnMgPz8gW1xuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgICAgJ19fcHljYWNoZV9fJyxcbiAgICAgICAgJy5naXQnLFxuICAgICAgICAnZGlzdCcsXG4gICAgICAgICdidWlsZCcsXG4gICAgICBdLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorr7nva7ntKLlvJVcbiAgICovXG4gIHNldEluZGV4KGluZGV4OiBTeW1ib2xJbmRleCk6IHZvaWQge1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuW8leeUqFxuICAgKi9cbiAgYXN5bmMgZmluZFJlZmVyZW5jZXMoc3ltYm9sOiBTeW1ib2xEZWZpbml0aW9uKTogUHJvbWlzZTxSZWZlcmVuY2VTZWFyY2hSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGlmICghdGhpcy5pbmRleCkge1xuICAgICAgcmV0dXJuIHsgc3ltYm9sLCByZWZlcmVuY2VzOiBbXSwgdG90YWxSZWZlcmVuY2VzOiAwLCBkdXJhdGlvbk1zOiAwIH07XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHJlZmVyZW5jZXM6IFN5bWJvbFJlZmVyZW5jZVtdID0gW107XG4gICAgbGV0IHRvdGFsUmVmZXJlbmNlcyA9IDA7XG4gICAgXG4gICAgLy8gMS4g5p+l5om+IGltcG9ydC9leHBvcnQg5byV55SoXG4gICAgY29uc3QgaW1wb3J0UmVmcyA9IGF3YWl0IHRoaXMuZmluZEltcG9ydFJlZmVyZW5jZXMoc3ltYm9sKTtcbiAgICByZWZlcmVuY2VzLnB1c2goLi4uaW1wb3J0UmVmcyk7XG4gICAgdG90YWxSZWZlcmVuY2VzICs9IGltcG9ydFJlZnMubGVuZ3RoO1xuICAgIFxuICAgIC8vIDIuIOafpeaJvuWHveaVsOiwg+eUqOW8leeUqFxuICAgIGNvbnN0IGNhbGxSZWZzID0gYXdhaXQgdGhpcy5maW5kQ2FsbFJlZmVyZW5jZXMoc3ltYm9sKTtcbiAgICByZWZlcmVuY2VzLnB1c2goLi4uY2FsbFJlZnMpO1xuICAgIHRvdGFsUmVmZXJlbmNlcyArPSBjYWxsUmVmcy5sZW5ndGg7XG4gICAgXG4gICAgLy8gMy4g5p+l5om+57un5om/L+WunueOsOW8leeUqFxuICAgIGNvbnN0IGluaGVyaXRSZWZzID0gYXdhaXQgdGhpcy5maW5kSW5oZXJpdGFuY2VSZWZlcmVuY2VzKHN5bWJvbCk7XG4gICAgcmVmZXJlbmNlcy5wdXNoKC4uLmluaGVyaXRSZWZzKTtcbiAgICB0b3RhbFJlZmVyZW5jZXMgKz0gaW5oZXJpdFJlZnMubGVuZ3RoO1xuICAgIFxuICAgIC8vIDQuIOafpeaJvuaZrumAmuW8leeUqFxuICAgIGNvbnN0IGdlbmVyYWxSZWZzID0gYXdhaXQgdGhpcy5maW5kR2VuZXJhbFJlZmVyZW5jZXMoc3ltYm9sKTtcbiAgICByZWZlcmVuY2VzLnB1c2goLi4uZ2VuZXJhbFJlZnMpO1xuICAgIHRvdGFsUmVmZXJlbmNlcyArPSBnZW5lcmFsUmVmcy5sZW5ndGg7XG4gICAgXG4gICAgLy8g5Y676YeNXG4gICAgY29uc3QgdW5pcXVlID0gdGhpcy5kZWR1cGxpY2F0ZVJlZmVyZW5jZXMocmVmZXJlbmNlcyk7XG4gICAgXG4gICAgLy8g6ZmQ5Yi257uT5p6c5pWwXG4gICAgY29uc3QgbGltaXRlZCA9IHVuaXF1ZS5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhSZXN1bHRzKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3ltYm9sLFxuICAgICAgcmVmZXJlbmNlczogbGltaXRlZCxcbiAgICAgIHRvdGFsUmVmZXJlbmNlcyxcbiAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJviBpbXBvcnQvZXhwb3J0IOW8leeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5kSW1wb3J0UmVmZXJlbmNlcyhzeW1ib2w6IFN5bWJvbERlZmluaXRpb24pOiBQcm9taXNlPFN5bWJvbFJlZmVyZW5jZVtdPiB7XG4gICAgY29uc3QgcmVmZXJlbmNlczogU3ltYm9sUmVmZXJlbmNlW10gPSBbXTtcbiAgICBcbiAgICAvLyDlnKjntKLlvJXkuK3mn6Xmib7lr7zlhaXor6XnrKblj7fnmoTmlofku7ZcbiAgICBmb3IgKGNvbnN0IFtmaWxlLCBzeW1ib2xzXSBvZiB0aGlzLmluZGV4Py5ieUZpbGUuZW50cmllcygpIHx8IFtdKSB7XG4gICAgICBpZiAoZmlsZSA9PT0gc3ltYm9sLmZpbGUpIGNvbnRpbnVlOyAvLyDot7Pov4flrprkuYnmlofku7ZcbiAgICAgIFxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVhZEZpbGUoZmlsZSk7XG4gICAgICBpZiAoIWNvbnRlbnQpIGNvbnRpbnVlO1xuICAgICAgXG4gICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgICAgXG4gICAgICAgIC8vIGltcG9ydCB7IHN5bWJvbCB9IGZyb20gLi4uXG4gICAgICAgIGlmIChsaW5lLmluY2x1ZGVzKGBpbXBvcnRgKSAmJiBsaW5lLmluY2x1ZGVzKHN5bWJvbC5uYW1lKSkge1xuICAgICAgICAgIGNvbnN0IGltcG9ydE1hdGNoID0gbGluZS5tYXRjaChuZXcgUmVnRXhwKFxuICAgICAgICAgICAgYGltcG9ydFxcXFxzKy4qP1xcXFxiJHt0aGlzLmVzY2FwZVJlZ2V4KHN5bWJvbC5uYW1lKX1cXFxcYi4qP2Zyb21gLFxuICAgICAgICAgICAgJ2knXG4gICAgICAgICAgKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGltcG9ydE1hdGNoKSB7XG4gICAgICAgICAgICByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgICBzeW1ib2wsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgICBsaW5lOiBpICsgMSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcmVmZXJlbmNlVHlwZTogJ2ltcG9ydCcsXG4gICAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ2V0Q29udGV4dChsaW5lcywgaSksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIGV4cG9ydCB7IHN5bWJvbCB9XG4gICAgICAgIGlmIChsaW5lLmluY2x1ZGVzKGBleHBvcnRgKSAmJiBsaW5lLmluY2x1ZGVzKHN5bWJvbC5uYW1lKSkge1xuICAgICAgICAgIGNvbnN0IGV4cG9ydE1hdGNoID0gbGluZS5tYXRjaChuZXcgUmVnRXhwKFxuICAgICAgICAgICAgYGV4cG9ydFxcXFxzKy4qP1xcXFxiJHt0aGlzLmVzY2FwZVJlZ2V4KHN5bWJvbC5uYW1lKX1cXFxcYmAsXG4gICAgICAgICAgICAnaSdcbiAgICAgICAgICApKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZXhwb3J0TWF0Y2gpIHtcbiAgICAgICAgICAgIHJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgIHN5bWJvbCxcbiAgICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICAgIGxpbmU6IGkgKyAxLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICByZWZlcmVuY2VUeXBlOiAnZXhwb3J0JyxcbiAgICAgICAgICAgICAgY29udGV4dDogdGhpcy5nZXRDb250ZXh0KGxpbmVzLCBpKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVmZXJlbmNlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuWHveaVsOiwg+eUqOW8leeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5kQ2FsbFJlZmVyZW5jZXMoc3ltYm9sOiBTeW1ib2xEZWZpbml0aW9uKTogUHJvbWlzZTxTeW1ib2xSZWZlcmVuY2VbXT4ge1xuICAgIGNvbnN0IHJlZmVyZW5jZXM6IFN5bWJvbFJlZmVyZW5jZVtdID0gW107XG4gICAgXG4gICAgaWYgKHN5bWJvbC5raW5kICE9PSAnZnVuY3Rpb24nICYmIHN5bWJvbC5raW5kICE9PSAnbWV0aG9kJykge1xuICAgICAgcmV0dXJuIHJlZmVyZW5jZXM7XG4gICAgfVxuICAgIFxuICAgIC8vIOaJq+aPj+aJgOacieaWh+S7tuafpeaJvuWHveaVsOiwg+eUqFxuICAgIGZvciAoY29uc3QgW2ZpbGUsIHN5bWJvbHNdIG9mIHRoaXMuaW5kZXg/LmJ5RmlsZS5lbnRyaWVzKCkgfHwgW10pIHtcbiAgICAgIGlmIChmaWxlID09PSBzeW1ib2wuZmlsZSkgY29udGludWU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRGaWxlKGZpbGUpO1xuICAgICAgaWYgKCFjb250ZW50KSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAgIFxuICAgICAgICAvLyDlh73mlbDosIPnlKjmqKHlvI/vvJpzeW1ib2xOYW1lKFxuICAgICAgICBjb25zdCBjYWxsTWF0Y2ggPSBsaW5lLm1hdGNoKG5ldyBSZWdFeHAoXG4gICAgICAgICAgYFxcXFxiJHt0aGlzLmVzY2FwZVJlZ2V4KHN5bWJvbC5uYW1lKX1cXFxccypcXFxcKGAsXG4gICAgICAgICkpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNhbGxNYXRjaCAmJiAhbGluZS5pbmNsdWRlcygnZnVuY3Rpb24nKSAmJiAhbGluZS5pbmNsdWRlcygnZGVmJykpIHtcbiAgICAgICAgICByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgc3ltYm9sLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgbGluZTogaSArIDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVmZXJlbmNlVHlwZTogJ2NhbGwnLFxuICAgICAgICAgICAgY29udGV4dDogdGhpcy5nZXRDb250ZXh0KGxpbmVzLCBpKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVmZXJlbmNlcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvue7p+aJvy/lrp7njrDlvJXnlKhcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZmluZEluaGVyaXRhbmNlUmVmZXJlbmNlcyhzeW1ib2w6IFN5bWJvbERlZmluaXRpb24pOiBQcm9taXNlPFN5bWJvbFJlZmVyZW5jZVtdPiB7XG4gICAgY29uc3QgcmVmZXJlbmNlczogU3ltYm9sUmVmZXJlbmNlW10gPSBbXTtcbiAgICBcbiAgICBpZiAoc3ltYm9sLmtpbmQgIT09ICdjbGFzcycgJiYgc3ltYm9sLmtpbmQgIT09ICdpbnRlcmZhY2UnKSB7XG4gICAgICByZXR1cm4gcmVmZXJlbmNlcztcbiAgICB9XG4gICAgXG4gICAgLy8g5omr5o+P5omA5pyJ5paH5Lu25p+l5om+57un5om/L+WunueOsFxuICAgIGZvciAoY29uc3QgW2ZpbGUsIHN5bWJvbHNdIG9mIHRoaXMuaW5kZXg/LmJ5RmlsZS5lbnRyaWVzKCkgfHwgW10pIHtcbiAgICAgIGlmIChmaWxlID09PSBzeW1ib2wuZmlsZSkgY29udGludWU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRGaWxlKGZpbGUpO1xuICAgICAgaWYgKCFjb250ZW50KSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAgIFxuICAgICAgICAvLyBleHRlbmRzIFN5bWJvbE5hbWVcbiAgICAgICAgY29uc3QgZXh0ZW5kc01hdGNoID0gbGluZS5tYXRjaChuZXcgUmVnRXhwKFxuICAgICAgICAgIGBleHRlbmRzXFxcXHMrJHt0aGlzLmVzY2FwZVJlZ2V4KHN5bWJvbC5uYW1lKX1cXFxcYmAsXG4gICAgICAgICkpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGV4dGVuZHNNYXRjaCkge1xuICAgICAgICAgIHJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBzeW1ib2wsXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICBsaW5lOiBpICsgMSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZWZlcmVuY2VUeXBlOiAnaW5oZXJpdCcsXG4gICAgICAgICAgICBjb250ZXh0OiB0aGlzLmdldENvbnRleHQobGluZXMsIGkpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBpbXBsZW1lbnRzIFN5bWJvbE5hbWVcbiAgICAgICAgY29uc3QgaW1wbGVtZW50c01hdGNoID0gbGluZS5tYXRjaChuZXcgUmVnRXhwKFxuICAgICAgICAgIGBpbXBsZW1lbnRzXFxcXHMrJHt0aGlzLmVzY2FwZVJlZ2V4KHN5bWJvbC5uYW1lKX1cXFxcYmAsXG4gICAgICAgICkpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGltcGxlbWVudHNNYXRjaCkge1xuICAgICAgICAgIHJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBzeW1ib2wsXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICBsaW5lOiBpICsgMSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZWZlcmVuY2VUeXBlOiAnaW1wbGVtZW50JyxcbiAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ2V0Q29udGV4dChsaW5lcywgaSksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlZmVyZW5jZXM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmn6Xmib7mma7pgJrlvJXnlKhcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZmluZEdlbmVyYWxSZWZlcmVuY2VzKHN5bWJvbDogU3ltYm9sRGVmaW5pdGlvbik6IFByb21pc2U8U3ltYm9sUmVmZXJlbmNlW10+IHtcbiAgICBjb25zdCByZWZlcmVuY2VzOiBTeW1ib2xSZWZlcmVuY2VbXSA9IFtdO1xuICAgIFxuICAgIC8vIOWcqOWQjOaWh+S7tuS4reafpeaJvuW8leeUqFxuICAgIGNvbnN0IGZpbGVTeW1ib2xzID0gdGhpcy5pbmRleD8uYnlGaWxlLmdldChzeW1ib2wuZmlsZSk7XG4gICAgaWYgKGZpbGVTeW1ib2xzKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZWFkRmlsZShzeW1ib2wuZmlsZSk7XG4gICAgICBpZiAoY29udGVudCkge1xuICAgICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IHN5bWJvbC5saW5lOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g6Lez6L+H5a6a5LmJ6KGMXG4gICAgICAgICAgaWYgKGkgKyAxID09PSBzeW1ib2wubGluZSkgY29udGludWU7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGxpbmUuaW5jbHVkZXMoc3ltYm9sLm5hbWUpKSB7XG4gICAgICAgICAgICByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgICBzeW1ib2wsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICAgICAgZmlsZTogc3ltYm9sLmZpbGUsXG4gICAgICAgICAgICAgICAgbGluZTogaSArIDEsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHJlZmVyZW5jZVR5cGU6ICdyZWZlcmVuY2UnLFxuICAgICAgICAgICAgICBjb250ZXh0OiB0aGlzLmdldENvbnRleHQobGluZXMsIGkpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZWZlcmVuY2VzO1xuICB9XG4gIFxuICAvKipcbiAgICog5Y676YeN5byV55SoXG4gICAqL1xuICBwcml2YXRlIGRlZHVwbGljYXRlUmVmZXJlbmNlcyhyZWZlcmVuY2VzOiBTeW1ib2xSZWZlcmVuY2VbXSk6IFN5bWJvbFJlZmVyZW5jZVtdIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgdW5pcXVlOiBTeW1ib2xSZWZlcmVuY2VbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgcmVmIG9mIHJlZmVyZW5jZXMpIHtcbiAgICAgIGNvbnN0IGtleSA9IGAke3JlZi5sb2NhdGlvbi5maWxlfToke3JlZi5sb2NhdGlvbi5saW5lfWA7XG4gICAgICBpZiAoIXNlZW4uaGFzKGtleSkpIHtcbiAgICAgICAgc2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgdW5pcXVlLnB1c2gocmVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHVuaXF1ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluS4iuS4i+aWh1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRDb250ZXh0KGxpbmVzOiBzdHJpbmdbXSwgbGluZUluZGV4OiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXJ0ID0gTWF0aC5tYXgoMCwgbGluZUluZGV4IC0gdGhpcy5jb25maWcuY29udGV4dExpbmVzKTtcbiAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihsaW5lcy5sZW5ndGgsIGxpbmVJbmRleCArIHRoaXMuY29uZmlnLmNvbnRleHRMaW5lcyArIDEpO1xuICAgIFxuICAgIHJldHVybiBsaW5lcy5zbGljZShzdGFydCwgZW5kKS5qb2luKCdcXG4nKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivu+WPluaWh+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyByZWFkRmlsZShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDovazkuYnmraPliJnooajovr7lvI9cbiAgICovXG4gIHByaXZhdGUgZXNjYXBlUmVnZXgoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBzdHIucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rlvJXnlKjmkJzntKLlmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlZmVyZW5jZVNlYXJjaChjb25maWc/OiBSZWZlcmVuY2VTZWFyY2hDb25maWcpOiBSZWZlcmVuY2VTZWFyY2gge1xuICByZXR1cm4gbmV3IFJlZmVyZW5jZVNlYXJjaChjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+afpeaJvuW8leeUqFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZFJlZmVyZW5jZXMoXG4gIGluZGV4OiBTeW1ib2xJbmRleCxcbiAgc3ltYm9sOiBTeW1ib2xEZWZpbml0aW9uXG4pOiBQcm9taXNlPFJlZmVyZW5jZVNlYXJjaFJlc3VsdD4ge1xuICBjb25zdCBzZWFyY2ggPSBuZXcgUmVmZXJlbmNlU2VhcmNoKCk7XG4gIHNlYXJjaC5zZXRJbmRleChpbmRleCk7XG4gIHJldHVybiBhd2FpdCBzZWFyY2guZmluZFJlZmVyZW5jZXMoc3ltYm9sKTtcbn1cbiJdfQ==