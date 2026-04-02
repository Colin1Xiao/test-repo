/**
 * MemoryIndex - 记忆索引管理
 * 
 * 控制 MEMORY.md 大小，管理条目优先级。
 */

import { MemoryEntry, MemoryIndex, MemoryScope } from './memory_types';
import * as fs from 'fs';
import * as path from 'path';

/** 索引配置 */
export interface MemoryIndexConfig {
  /** 最大条目数 */
  maxEntries?: number;
  /** 索引文件路径 */
  indexPath?: string;
}

/** 记忆索引管理器 */
export class MemoryIndexManager {
  private maxEntries: number;
  private indexPath: string;

  constructor(config: MemoryIndexConfig = {}) {
    this.maxEntries = config.maxEntries ?? 100;
    this.indexPath = config.indexPath ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'workspace',
      '.openclaw',
      'MEMORY.md',
    );
  }

  /**
   * 添加条目（自动控制大小）
   */
  add(entry: MemoryEntry, priority?: 'low' | 'medium' | 'high'): void {
    const index = this.read();
    
    // 检查是否已存在
    const existing = index.entries.findIndex(e => e.id === entry.id);
    if (existing >= 0) {
      index.entries[existing] = entry;
    } else {
      index.entries.push(entry);
    }
    
    // 控制大小
    if (index.entries.length > this.maxEntries) {
      this.trim(index);
    }
    
    index.updatedAt = new Date().toISOString();
    this.write(index);
  }

  /**
   * 修剪索引（保留高优先级条目）
   */
  private trim(index: MemoryIndex): void {
    // 按范围和更新时间排序
    index.entries.sort((a, b) => {
      // 高优先级范围优先
      const scopePriority: Record<MemoryScope, number> = {
        preferences: 3,
        project: 2,
        user: 1,
        ops: 1,
        session: 0,
      };
      
      const scopeDiff = scopePriority[b.scope] - scopePriority[a.scope];
      if (scopeDiff !== 0) return scopeDiff;
      
      // 同范围内按更新时间排序（新的优先）
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    
    // 保留前 maxEntries 个
    index.entries = index.entries.slice(0, this.maxEntries);
  }

  /**
   * 读取索引
   */
  read(): MemoryIndex {
    if (!fs.existsSync(this.indexPath)) {
      return {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }
    
    const content = fs.readFileSync(this.indexPath, 'utf-8');
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    
    if (!match) {
      return {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }
    
    try {
      const entries = JSON.parse(match[1]) as MemoryEntry[];
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
  write(index: MemoryIndex): void {
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const frontmatter = {
      title: 'Memory Index',
      description: '长期记忆索引',
      updatedAt: index.updatedAt,
      entryCount: index.entries.length,
    };
    
    const lines = [
      '---',
      ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
      '---',
      '',
      JSON.stringify(index.entries, null, 2),
    ];
    
    fs.writeFileSync(this.indexPath, lines.join('\n'));
  }

  /**
   * 获取统计
   */
  getStats(): {
    total: number;
    byScope: Record<MemoryScope, number>;
  } {
    const index = this.read();
    const byScope: Record<MemoryScope, number> = {
      user: 0,
      project: 0,
      ops: 0,
      session: 0,
      preferences: 0,
    };
    
    index.entries.forEach(e => {
      byScope[e.scope]++;
    });
    
    return {
      total: index.entries.length,
      byScope,
    };
  }
}
