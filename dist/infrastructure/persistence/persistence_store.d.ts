/**
 * Persistence Store
 * Phase 2E-1 - 持久化存储基础
 *
 * 职责：
 * - 提供统一的持久化接口
 * - 支持文件存储 / SQLite
 * - 提供序列化/反序列化
 */
export type StorageBackend = 'file' | 'sqlite';
export interface PersistenceConfig {
    backend: StorageBackend;
    dataDir: string;
    sqlitePath?: string;
}
export interface PersistenceRepository<T> {
    save(id: string, data: T): Promise<void>;
    load(id: string): Promise<T | null>;
    delete(id: string): Promise<void>;
    list(filter?: Partial<T>): Promise<T[]>;
    count(filter?: Partial<T>): Promise<number>;
}
export declare class FilePersistenceStore<T> implements PersistenceRepository<T> {
    private dataDir;
    private fileExtension;
    constructor(dataDir: string, fileExtension?: string);
    private getFilePath;
    save(id: string, data: T): Promise<void>;
    load(id: string): Promise<T | null>;
    delete(id: string): Promise<void>;
    list(filter?: Partial<T>): Promise<T[]>;
    count(filter?: Partial<T>): Promise<number>;
    private matchesFilter;
}
export declare class InMemoryPersistenceStore<T> implements PersistenceRepository<T> {
    private store;
    save(id: string, data: T): Promise<void>;
    load(id: string): Promise<T | null>;
    delete(id: string): Promise<void>;
    list(filter?: Partial<T>): Promise<T[]>;
    count(filter?: Partial<T>): Promise<number>;
    private matchesFilter;
}
export declare function createFilePersistenceStore<T>(dataDir: string, fileExtension?: string): FilePersistenceStore<T>;
export declare function createInMemoryPersistenceStore<T>(): InMemoryPersistenceStore<T>;
export declare function createPersistenceStore<T>(config: PersistenceConfig): PersistenceRepository<T>;
