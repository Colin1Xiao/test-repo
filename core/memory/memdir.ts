/**
 * MemDir - 文件型长期记忆系统
 * 
 * 初始化 .openclaw/MEMORY.md
 * 创建/更新/删除 memory entry
 * 列出/检索 memory entries
 * 控制 index 大小
 */

import {
  MemoryEntry,
  MemoryScope,
  MemoryFile,
  MemoryIndex,
  MemDirConfig,
} from './memory_types';
import * as fs from 'fs';
import * as path from 'path';

/** 解析 frontmatter */
function parseFrontmatter(content: string): { frontmatter: any; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterStr = match[1];
  const body = match[2];
  
  const frontmatter: any = {};
  const lines = frontmatterStr.split('\n');
  
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  
  for (const line of lines) {
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      currentArray.push(arrayMatch[1].trim());
      continue;
    }
    
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentArray.length > 0) {
        frontmatter[currentKey] = currentArray;
      }
      
      const key = kvMatch[1];
      const value = kvMatch[2].trim();
      
      if (value === '') {
        currentKey = key;
        currentArray = [];
      } else {
        currentKey = null;
        frontmatter[key] = parseValue(value);
      }
    }
  }
  
  if (currentKey && currentArray.length > 0) {
    frontmatter[currentKey] = currentArray;
  }
  
  return { frontmatter, body };
}

/** 解析 YAML 值 */
function parseValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/** 序列化 frontmatter */
function stringifyFrontmatter(fm: Partial<MemoryEntry>): string {
  const lines = ['---'];
  
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      continue;
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/** MemDir 实现 */
export class MemDir {
  private rootDir: string;
  private memoryDir: string;
  private indexPath: string;
  private maxIndexSize: number;

  constructor(config: MemDirConfig = {}) {
    this.rootDir = config.rootDir ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'workspace',
    );
    this.memoryDir = path.join(this.rootDir, '.openclaw', 'memory');
    this.indexPath = path.join(this.rootDir, '.openclaw', 'MEMORY.md');
    this.maxIndexSize = config.maxIndexSize ?? 100;
    
    if (config.autoCreate !== false) {
      this.init();
    }
  }

  /**
   * 初始化记忆目录和索引
   */
  init(): void {
    // 创建目录结构
    const scopes: MemoryScope[] = ['user', 'project', 'ops', 'session', 'preferences'];
    for (const scope of scopes) {
      const scopeDir = path.join(this.memoryDir, scope);
      if (!fs.existsSync(scopeDir)) {
        fs.mkdirSync(scopeDir, { recursive: true });
      }
    }
    
    // 创建索引文件
    if (!fs.existsSync(this.indexPath)) {
      const index: MemoryIndex = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries: [],
      };
      this.writeIndex(index);
    }
  }

  /**
   * 创建记忆条目
   */
  create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>, content: string): MemoryEntry {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    
    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    // 写入记忆文件
    const filePath = path.join(this.memoryDir, entry.scope, `${id}.md`);
    const fileContent = `${stringifyFrontmatter(fullEntry)}\n\n${content}`;
    fs.writeFileSync(filePath, fileContent);
    
    // 更新索引
    this.addIndexEntry(fullEntry);
    
    return fullEntry;
  }

  /**
   * 更新记忆条目
   */
  update(id: string, patch: Partial<MemoryEntry>, content?: string): MemoryEntry | null {
    const entry = this.get(id);
    if (!entry) {
      return null;
    }
    
    const updated: MemoryEntry = {
      ...entry,
      ...patch,
      id, // 不允许修改 ID
      updatedAt: new Date().toISOString(),
    };
    
    // 更新文件
    const filePath = path.join(this.memoryDir, entry.scope, `${id}.md`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { body } = parseFrontmatter(fileContent);
    
    const newContent = `${stringifyFrontmatter(updated)}\n\n${content ?? body}`;
    fs.writeFileSync(filePath, newContent);
    
    // 更新索引
    this.updateIndexEntry(updated);
    
    return updated;
  }

  /**
   * 删除记忆条目
   */
  delete(id: string): boolean {
    const entry = this.get(id);
    if (!entry) {
      return false;
    }
    
    // 删除文件
    const filePath = path.join(this.memoryDir, entry.scope, `${id}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 从索引移除
    this.removeIndexEntry(id);
    
    return true;
  }

  /**
   * 获取记忆条目
   */
  get(id: string): MemoryEntry | null {
    const index = this.readIndex();
    const entry = index.entries.find(e => e.id === id);
    
    if (!entry) {
      return null;
    }
    
    // 读取完整文件获取内容
    const filePath = path.join(this.memoryDir, entry.scope, `${id}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return entry;
  }

  /**
   * 读取记忆文件（含正文）
   */
  readFile(id: string): MemoryFile | null {
    const entry = this.get(id);
    if (!entry) {
      return null;
    }
    
    const filePath = path.join(this.memoryDir, entry.scope, `${id}.md`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(fileContent);
    
    return {
      frontmatter: entry,
      content: body,
      fullPath: filePath,
    };
  }

  /**
   * 列出记忆条目
   */
  list(options?: {
    scope?: MemoryScope;
    tag?: string;
    limit?: number;
  }): MemoryEntry[] {
    const index = this.readIndex();
    let results = index.entries;
    
    if (options?.scope) {
      results = results.filter(e => e.scope === options.scope);
    }
    
    if (options?.tag) {
      results = results.filter(e => e.tags.includes(options.tag!));
    }
    
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * 搜索记忆
   */
  search(query: string, options?: { limit?: number }): MemoryEntry[] {
    const index = this.readIndex();
    const queryLower = query.toLowerCase();
    const limit = options?.limit ?? 20;
    
    const results = index.entries.filter(entry => {
      if (entry.title.toLowerCase().includes(queryLower)) return true;
      if (entry.summary.toLowerCase().includes(queryLower)) return true;
      if (entry.tags.some(tag => tag.toLowerCase().includes(queryLower))) return true;
      
      // 搜索正文
      const file = this.readFile(entry.id);
      if (file && file.content.toLowerCase().includes(queryLower)) return true;
      
      return false;
    });
    
    return results.slice(0, limit);
  }

  /**
   * 读取索引
   */
  private readIndex(): MemoryIndex {
    if (!fs.existsSync(this.indexPath)) {
      return {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }
    
    const content = fs.readFileSync(this.indexPath, 'utf-8');
    const { body } = parseFrontmatter(content);
    
    try {
      const entries = JSON.parse(body) as MemoryEntry[];
      return {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries,
      };
    } catch {
      return {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }
  }

  /**
   * 写入索引
   */
  private writeIndex(index: MemoryIndex): void {
    const frontmatter = {
      title: 'Memory Index',
      description: '长期记忆索引',
      updatedAt: index.updatedAt,
      entryCount: index.entries.length,
    };
    
    const content = `${stringifyFrontmatter(frontmatter)}\n\n${JSON.stringify(index.entries, null, 2)}`;
    fs.writeFileSync(this.indexPath, content);
  }

  /**
   * 添加索引条目
   */
  private addIndexEntry(entry: MemoryEntry): void {
    const index = this.readIndex();
    
    // 控制索引大小
    if (index.entries.length >= this.maxIndexSize) {
      // 移除最旧的条目
      index.entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      index.entries.shift();
    }
    
    index.entries.push(entry);
    index.updatedAt = new Date().toISOString();
    this.writeIndex(index);
  }

  /**
   * 更新索引条目
   */
  private updateIndexEntry(entry: MemoryEntry): void {
    const index = this.readIndex();
    const idx = index.entries.findIndex(e => e.id === entry.id);
    
    if (idx >= 0) {
      index.entries[idx] = entry;
    } else {
      index.entries.push(entry);
    }
    
    index.updatedAt = new Date().toISOString();
    this.writeIndex(index);
  }

  /**
   * 移除索引条目
   */
  private removeIndexEntry(id: string): void {
    const index = this.readIndex();
    index.entries = index.entries.filter(e => e.id !== id);
    index.updatedAt = new Date().toISOString();
    this.writeIndex(index);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byScope: Record<MemoryScope, number>;
  } {
    const index = this.readIndex();
    const byScope: Record<MemoryScope, number> = {
      user: 0,
      project: 0,
      ops: 0,
      session: 0,
      preferences: 0,
    };
    
    index.entries.forEach(entry => {
      byScope[entry.scope]++;
    });
    
    return {
      total: index.entries.size,
      byScope,
    };
  }
}
