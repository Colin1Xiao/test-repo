/**
 * MemoryRetrieval - 记忆检索
 * 
 * 按 scope / tag / keyword 检索。
 * 双路召回：先规则，再语义。
 */

import { MemoryEntry, MemoryScope, MemorySearchResult } from './memory_types';
import { MemDir } from './memdir';

/** 检索配置 */
export interface RetrievalConfig {
  memDir?: MemDir;
}

/** 记忆检索器 */
export class MemoryRetriever {
  private memDir: MemDir;

  constructor(config: RetrievalConfig = {}) {
    this.memDir = config.memDir ?? new MemDir();
  }

  /**
   * 检索记忆（多策略）
   */
  retrieve(query: {
    text?: string;
    scope?: MemoryScope;
    tags?: string[];
    limit?: number;
  }): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const limit = query.limit ?? 20;
    
    // 策略 1: 按范围筛选
    if (query.scope) {
      const entries = this.memDir.list({ scope: query.scope, limit });
      results.push(...entries.map(e => ({
        ...e,
        score: 50,
        matchReason: [`scope:${query.scope}`],
      })));
    }
    
    // 策略 2: 按标签筛选
    if (query.tags && query.tags.length > 0) {
      const entries = this.memDir.list({ limit: limit * 2 });
      for (const entry of entries) {
        const matchedTags = entry.tags.filter(t => query.tags!.includes(t));
        if (matchedTags.length > 0) {
          results.push({
            ...entry,
            score: 30 * matchedTags.length,
            matchReason: matchedTags.map(t => `tag:${t}`),
          });
        }
      }
    }
    
    // 策略 3: 文本搜索
    if (query.text) {
      const entries = this.memDir.search(query.text, { limit: limit * 2 });
      results.push(...entries.map(e => ({
        ...e,
        score: 100,
        matchReason: [`text:${query.text}`],
      })));
    }
    
    // 去重和排序
    const unique = new Map<string, MemorySearchResult>();
    for (const result of results) {
      const existing = unique.get(result.id);
      if (existing) {
        existing.score += result.score;
        existing.matchReason.push(...result.matchReason);
      } else {
        unique.set(result.id, result);
      }
    }
    
    // 按分数排序
    const sorted = Array.from(unique.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return sorted;
  }

  /**
   * 按会话检索
   */
  bySession(sessionId: string, limit: number = 10): MemorySearchResult[] {
    const entries = this.memDir.list({ limit: limit * 2 });
    const results = entries
      .filter(e => e.source === sessionId || e.scope === 'session')
      .slice(0, limit);
    
    return results.map(e => ({
      ...e,
      score: 20,
      matchReason: [`session:${sessionId}`],
    }));
  }

  /**
   * 按项目检索
   */
  byProject(projectName: string, limit: number = 20): MemorySearchResult[] {
    return this.retrieve({
      text: projectName,
      scope: 'project',
      limit,
    });
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences(): MemorySearchResult[] {
    const entries = this.memDir.list({ scope: 'preferences', limit: 20 });
    return entries.map(e => ({
      ...e,
      score: 10,
      matchReason: ['preferences'],
    }));
  }

  /**
   * 获取最近记忆
   */
  getRecent(limit: number = 10): MemorySearchResult[] {
    const entries = this.memDir.list({ limit });
    return entries.map(e => ({
      ...e,
      score: 5,
      matchReason: ['recent'],
    }));
  }
}
