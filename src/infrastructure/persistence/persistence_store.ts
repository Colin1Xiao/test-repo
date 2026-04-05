/**
 * Persistence Store
 * Phase 2E-1 - 持久化存储基础
 * 
 * 职责：
 * - 提供统一的持久化接口
 * - 支持文件存储 / SQLite
 * - 提供序列化/反序列化
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export type StorageBackend = 'file' | 'sqlite';

export interface PersistenceConfig {
  backend: StorageBackend;
  dataDir: string;
  sqlitePath?: string;
}

// Node.js 类型声明
declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}

export interface PersistenceRepository<T> {
  save(id: string, data: T): Promise<void>;
  load(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
  list(filter?: Partial<T>): Promise<T[]>;
  count(filter?: Partial<T>): Promise<number>;
}

// ============================================================================
// File Storage Implementation
// ============================================================================

export class FilePersistenceStore<T> implements PersistenceRepository<T> {
  private dataDir: string;
  private fileExtension: string;

  constructor(dataDir: string, fileExtension: string = '.json') {
    this.dataDir = dataDir;
    this.fileExtension = fileExtension;

    // 确保目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private getFilePath(id: string): string {
    // 安全的文件 ID 处理
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safeId}${this.fileExtension}`);
  }

  async save(id: string, data: T): Promise<void> {
    const filePath = this.getFilePath(id);
    const content = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  async load(id: string): Promise<T | null> {
    const filePath = this.getFilePath(id);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(filter?: Partial<T>): Promise<T[]> {
    const files = await fs.promises.readdir(this.dataDir);
    const items: T[] = [];

    for (const file of files) {
      if (!file.endsWith(this.fileExtension)) {
        continue;
      }

      try {
        const filePath = path.join(this.dataDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as T;

        // 应用过滤器
        if (filter && !this.matchesFilter(data, filter)) {
          continue;
        }

        items.push(data);
      } catch (error) {
        // 跳过损坏的文件
        console.warn(`Failed to load file ${file}:`, error);
      }
    }

    return items;
  }

  async count(filter?: Partial<T>): Promise<number> {
    const items = await this.list(filter);
    return items.length;
  }

  private matchesFilter(data: T, filter: Partial<T>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if ((data as any)[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================================
// In-Memory Store (for testing / fallback)
// ============================================================================

export class InMemoryPersistenceStore<T> implements PersistenceRepository<T> {
  private store: Map<string, T> = new Map();

  async save(id: string, data: T): Promise<void> {
    this.store.set(id, data);
  }

  async load(id: string): Promise<T | null> {
    return this.store.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async list(filter?: Partial<T>): Promise<T[]> {
    const items = Array.from(this.store.values());
    if (!filter) {
      return items;
    }
    return items.filter((item) => this.matchesFilter(item, filter));
  }

  async count(filter?: Partial<T>): Promise<number> {
    const items = await this.list(filter);
    return items.length;
  }

  private matchesFilter(data: T, filter: Partial<T>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if ((data as any)[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createFilePersistenceStore<T>(
  dataDir: string,
  fileExtension?: string
): FilePersistenceStore<T> {
  return new FilePersistenceStore<T>(dataDir, fileExtension);
}

export function createInMemoryPersistenceStore<T>(): InMemoryPersistenceStore<T> {
  return new InMemoryPersistenceStore<T>();
}

export function createPersistenceStore<T>(
  config: PersistenceConfig
): PersistenceRepository<T> {
  switch (config.backend) {
    case 'file':
      return createFilePersistenceStore<T>(config.dataDir);
    case 'sqlite':
      // TODO: Implement SQLite store
      console.warn('SQLite backend not implemented, falling back to file storage');
      return createFilePersistenceStore<T>(config.dataDir);
    default:
      return createInMemoryPersistenceStore<T>();
  }
}
