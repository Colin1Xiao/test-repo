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
