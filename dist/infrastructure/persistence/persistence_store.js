"use strict";
/**
 * Persistence Store
 * Phase 2E-1 - 持久化存储基础
 *
 * 职责：
 * - 提供统一的持久化接口
 * - 支持文件存储 / SQLite
 * - 提供序列化/反序列化
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
exports.InMemoryPersistenceStore = exports.FilePersistenceStore = void 0;
exports.createFilePersistenceStore = createFilePersistenceStore;
exports.createInMemoryPersistenceStore = createInMemoryPersistenceStore;
exports.createPersistenceStore = createPersistenceStore;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ============================================================================
// File Storage Implementation
// ============================================================================
class FilePersistenceStore {
    constructor(dataDir, fileExtension = '.json') {
        this.dataDir = dataDir;
        this.fileExtension = fileExtension;
        // 确保目录存在
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    getFilePath(id) {
        // 安全的文件 ID 处理
        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.dataDir, `${safeId}${this.fileExtension}`);
    }
    async save(id, data) {
        const filePath = this.getFilePath(id);
        const content = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(filePath, content, 'utf-8');
    }
    async load(id) {
        const filePath = this.getFilePath(id);
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async delete(id) {
        const filePath = this.getFilePath(id);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async list(filter) {
        const files = await fs.promises.readdir(this.dataDir);
        const items = [];
        for (const file of files) {
            if (!file.endsWith(this.fileExtension)) {
                continue;
            }
            try {
                const filePath = path.join(this.dataDir, file);
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                // 应用过滤器
                if (filter && !this.matchesFilter(data, filter)) {
                    continue;
                }
                items.push(data);
            }
            catch (error) {
                // 跳过损坏的文件
                console.warn(`Failed to load file ${file}:`, error);
            }
        }
        return items;
    }
    async count(filter) {
        const items = await this.list(filter);
        return items.length;
    }
    matchesFilter(data, filter) {
        for (const [key, value] of Object.entries(filter)) {
            if (data[key] !== value) {
                return false;
            }
        }
        return true;
    }
}
exports.FilePersistenceStore = FilePersistenceStore;
// ============================================================================
// In-Memory Store (for testing / fallback)
// ============================================================================
class InMemoryPersistenceStore {
    constructor() {
        this.store = new Map();
    }
    async save(id, data) {
        this.store.set(id, data);
    }
    async load(id) {
        return this.store.get(id) || null;
    }
    async delete(id) {
        this.store.delete(id);
    }
    async list(filter) {
        const items = Array.from(this.store.values());
        if (!filter) {
            return items;
        }
        return items.filter((item) => this.matchesFilter(item, filter));
    }
    async count(filter) {
        const items = await this.list(filter);
        return items.length;
    }
    matchesFilter(data, filter) {
        for (const [key, value] of Object.entries(filter)) {
            if (data[key] !== value) {
                return false;
            }
        }
        return true;
    }
}
exports.InMemoryPersistenceStore = InMemoryPersistenceStore;
// ============================================================================
// Factory Functions
// ============================================================================
function createFilePersistenceStore(dataDir, fileExtension) {
    return new FilePersistenceStore(dataDir, fileExtension);
}
function createInMemoryPersistenceStore() {
    return new InMemoryPersistenceStore();
}
function createPersistenceStore(config) {
    switch (config.backend) {
        case 'file':
            return createFilePersistenceStore(config.dataDir);
        case 'sqlite':
            // TODO: Implement SQLite store
            console.warn('SQLite backend not implemented, falling back to file storage');
            return createFilePersistenceStore(config.dataDir);
        default:
            return createInMemoryPersistenceStore();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVyc2lzdGVuY2Vfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5mcmFzdHJ1Y3R1cmUvcGVyc2lzdGVuY2UvcGVyc2lzdGVuY2Vfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnTEgsZ0VBS0M7QUFFRCx3RUFFQztBQUVELHdEQWFDO0FBdE1ELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUE2QjdCLCtFQUErRTtBQUMvRSw4QkFBOEI7QUFDOUIsK0VBQStFO0FBRS9FLE1BQWEsb0JBQW9CO0lBSS9CLFlBQVksT0FBZSxFQUFFLGdCQUF3QixPQUFPO1FBQzFELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBRW5DLFNBQVM7UUFDVCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzVCLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDN0MsQ0FBQztJQUNILENBQUM7SUFFTyxXQUFXLENBQUMsRUFBVTtRQUM1QixjQUFjO1FBQ2QsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNsRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFVLEVBQUUsSUFBTztRQUM1QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLE1B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T0FBTyw4QkFBOEIsRUFBSyxDQUFDO0lBQy9DLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQZXJzaXN0ZW5jZSBTdG9yZVxuICogUGhhc2UgMkUtMSAtIOaMgeS5heWMluWtmOWCqOWfuuehgFxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5o+Q5L6b57uf5LiA55qE5oyB5LmF5YyW5o6l5Y+jXG4gKiAtIOaUr+aMgeaWh+S7tuWtmOWCqCAvIFNRTGl0ZVxuICogLSDmj5Dkvpvluo/liJfljJYv5Y+N5bqP5YiX5YyWXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIFN0b3JhZ2VCYWNrZW5kID0gJ2ZpbGUnIHwgJ3NxbGl0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVyc2lzdGVuY2VDb25maWcge1xuICBiYWNrZW5kOiBTdG9yYWdlQmFja2VuZDtcbiAgZGF0YURpcjogc3RyaW5nO1xuICBzcWxpdGVQYXRoPzogc3RyaW5nO1xufVxuXG4vLyBOb2RlLmpzIOexu+Wei+WjsOaYjlxuZGVjbGFyZSBuYW1lc3BhY2UgTm9kZUpTIHtcbiAgaW50ZXJmYWNlIEVycm5vRXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige1xuICAgIGNvZGU/OiBzdHJpbmc7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBQZXJzaXN0ZW5jZVJlcG9zaXRvcnk8VD4ge1xuICBzYXZlKGlkOiBzdHJpbmcsIGRhdGE6IFQpOiBQcm9taXNlPHZvaWQ+O1xuICBsb2FkKGlkOiBzdHJpbmcpOiBQcm9taXNlPFQgfCBudWxsPjtcbiAgZGVsZXRlKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuICBsaXN0KGZpbHRlcj86IFBhcnRpYWw8VD4pOiBQcm9taXNlPFRbXT47XG4gIGNvdW50KGZpbHRlcj86IFBhcnRpYWw8VD4pOiBQcm9taXNlPG51bWJlcj47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZpbGUgU3RvcmFnZSBJbXBsZW1lbnRhdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgRmlsZVBlcnNpc3RlbmNlU3RvcmU8VD4gaW1wbGVtZW50cyBQZXJzaXN0ZW5jZVJlcG9zaXRvcnk8VD4ge1xuICBwcml2YXRlIGRhdGFEaXI6IHN0cmluZztcbiAgcHJpdmF0ZSBmaWxlRXh0ZW5zaW9uOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoZGF0YURpcjogc3RyaW5nLCBmaWxlRXh0ZW5zaW9uOiBzdHJpbmcgPSAnLmpzb24nKSB7XG4gICAgdGhpcy5kYXRhRGlyID0gZGF0YURpcjtcbiAgICB0aGlzLmZpbGVFeHRlbnNpb24gPSBmaWxlRXh0ZW5zaW9uO1xuXG4gICAgLy8g56Gu5L+d55uu5b2V5a2Y5ZyoXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGRhdGFEaXIpKSB7XG4gICAgICBmcy5ta2RpclN5bmMoZGF0YURpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRGaWxlUGF0aChpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyDlronlhajnmoTmlofku7YgSUQg5aSE55CGXG4gICAgY29uc3Qgc2FmZUlkID0gaWQucmVwbGFjZSgvW15hLXpBLVowLTlfLV0vZywgJ18nKTtcbiAgICByZXR1cm4gcGF0aC5qb2luKHRoaXMuZGF0YURpciwgYCR7c2FmZUlkfSR7dGhpcy5maWxlRXh0ZW5zaW9ufWApO1xuICB9XG5cbiAgYXN5bmMgc2F2ZShpZDogc3RyaW5nLCBkYXRhOiBUKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZVBhdGggPSB0aGlzLmdldEZpbGVQYXRoKGlkKTtcbiAgICBjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMik7XG4gICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCBjb250ZW50LCAndXRmLTgnKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWQoaWQ6IHN0cmluZyk6IFByb21pc2U8VCB8IG51bGw+IHtcbiAgICBjb25zdCBmaWxlUGF0aCA9IHRoaXMuZ2V0RmlsZVBhdGgoaWQpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoY29udGVudCkgYXMgVDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKChlcnJvciBhcyBhbnkpLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZGVsZXRlKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlUGF0aCA9IHRoaXMuZ2V0RmlsZVBhdGgoaWQpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoZmlsZVBhdGgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoKGVycm9yIGFzIGFueSkuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbGlzdChmaWx0ZXI/OiBQYXJ0aWFsPFQ+KTogUHJvbWlzZTxUW10+IHtcbiAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIodGhpcy5kYXRhRGlyKTtcbiAgICBjb25zdCBpdGVtczogVFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGlmICghZmlsZS5lbmRzV2l0aCh0aGlzLmZpbGVFeHRlbnNpb24pKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmRhdGFEaXIsIGZpbGUpO1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShjb250ZW50KSBhcyBUO1xuXG4gICAgICAgIC8vIOW6lOeUqOi/h+a7pOWZqFxuICAgICAgICBpZiAoZmlsdGVyICYmICF0aGlzLm1hdGNoZXNGaWx0ZXIoZGF0YSwgZmlsdGVyKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaXRlbXMucHVzaChkYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIOi3s+i/h+aNn+Wdj+eahOaWh+S7tlxuICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBsb2FkIGZpbGUgJHtmaWxlfTpgLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZW1zO1xuICB9XG5cbiAgYXN5bmMgY291bnQoZmlsdGVyPzogUGFydGlhbDxUPik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLmxpc3QoZmlsdGVyKTtcbiAgICByZXR1cm4gaXRlbXMubGVuZ3RoO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaGVzRmlsdGVyKGRhdGE6IFQsIGZpbHRlcjogUGFydGlhbDxUPik6IGJvb2xlYW4ge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGZpbHRlcikpIHtcbiAgICAgIGlmICgoZGF0YSBhcyBhbnkpW2tleV0gIT09IHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gSW4tTWVtb3J5IFN0b3JlIChmb3IgdGVzdGluZyAvIGZhbGxiYWNrKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgSW5NZW1vcnlQZXJzaXN0ZW5jZVN0b3JlPFQ+IGltcGxlbWVudHMgUGVyc2lzdGVuY2VSZXBvc2l0b3J5PFQ+IHtcbiAgcHJpdmF0ZSBzdG9yZTogTWFwPHN0cmluZywgVD4gPSBuZXcgTWFwKCk7XG5cbiAgYXN5bmMgc2F2ZShpZDogc3RyaW5nLCBkYXRhOiBUKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yZS5zZXQoaWQsIGRhdGEpO1xuICB9XG5cbiAgYXN5bmMgbG9hZChpZDogc3RyaW5nKTogUHJvbWlzZTxUIHwgbnVsbD4ge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLmdldChpZCkgfHwgbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZShpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yZS5kZWxldGUoaWQpO1xuICB9XG5cbiAgYXN5bmMgbGlzdChmaWx0ZXI/OiBQYXJ0aWFsPFQ+KTogUHJvbWlzZTxUW10+IHtcbiAgICBjb25zdCBpdGVtcyA9IEFycmF5LmZyb20odGhpcy5zdG9yZS52YWx1ZXMoKSk7XG4gICAgaWYgKCFmaWx0ZXIpIHtcbiAgICAgIHJldHVybiBpdGVtcztcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zLmZpbHRlcigoaXRlbSkgPT4gdGhpcy5tYXRjaGVzRmlsdGVyKGl0ZW0sIGZpbHRlcikpO1xuICB9XG5cbiAgYXN5bmMgY291bnQoZmlsdGVyPzogUGFydGlhbDxUPik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLmxpc3QoZmlsdGVyKTtcbiAgICByZXR1cm4gaXRlbXMubGVuZ3RoO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaGVzRmlsdGVyKGRhdGE6IFQsIGZpbHRlcjogUGFydGlhbDxUPik6IGJvb2xlYW4ge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGZpbHRlcikpIHtcbiAgICAgIGlmICgoZGF0YSBhcyBhbnkpW2tleV0gIT09IHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRmFjdG9yeSBGdW5jdGlvbnNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpbGVQZXJzaXN0ZW5jZVN0b3JlPFQ+KFxuICBkYXRhRGlyOiBzdHJpbmcsXG4gIGZpbGVFeHRlbnNpb24/OiBzdHJpbmdcbik6IEZpbGVQZXJzaXN0ZW5jZVN0b3JlPFQ+IHtcbiAgcmV0dXJuIG5ldyBGaWxlUGVyc2lzdGVuY2VTdG9yZTxUPihkYXRhRGlyLCBmaWxlRXh0ZW5zaW9uKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUluTWVtb3J5UGVyc2lzdGVuY2VTdG9yZTxUPigpOiBJbk1lbW9yeVBlcnNpc3RlbmNlU3RvcmU8VD4ge1xuICByZXR1cm4gbmV3IEluTWVtb3J5UGVyc2lzdGVuY2VTdG9yZTxUPigpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGVyc2lzdGVuY2VTdG9yZTxUPihcbiAgY29uZmlnOiBQZXJzaXN0ZW5jZUNvbmZpZ1xuKTogUGVyc2lzdGVuY2VSZXBvc2l0b3J5PFQ+IHtcbiAgc3dpdGNoIChjb25maWcuYmFja2VuZCkge1xuICAgIGNhc2UgJ2ZpbGUnOlxuICAgICAgcmV0dXJuIGNyZWF0ZUZpbGVQZXJzaXN0ZW5jZVN0b3JlPFQ+KGNvbmZpZy5kYXRhRGlyKTtcbiAgICBjYXNlICdzcWxpdGUnOlxuICAgICAgLy8gVE9ETzogSW1wbGVtZW50IFNRTGl0ZSBzdG9yZVxuICAgICAgY29uc29sZS53YXJuKCdTUUxpdGUgYmFja2VuZCBub3QgaW1wbGVtZW50ZWQsIGZhbGxpbmcgYmFjayB0byBmaWxlIHN0b3JhZ2UnKTtcbiAgICAgIHJldHVybiBjcmVhdGVGaWxlUGVyc2lzdGVuY2VTdG9yZTxUPihjb25maWcuZGF0YURpcik7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBjcmVhdGVJbk1lbW9yeVBlcnNpc3RlbmNlU3RvcmU8VD4oKTtcbiAgfVxufVxuIl19