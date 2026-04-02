/**
 * SkillLoader - 技能加载器
 * 
 * 扫描技能目录，解析 frontmatter，建立索引，支持按需加载。
 */

import { SkillFrontmatter, SkillEntry, parseFrontmatter } from './skill_frontmatter';
import * as fs from 'fs';
import * as path from 'path';

/** 配置 */
export interface SkillLoaderConfig {
  /** 技能目录路径 */
  skillsDir?: string;
  /** 库目录路径 */
  libraryDir?: string;
  /** 自动扫描 */
  autoScan?: boolean;
}

/** 技能加载器实现 */
export class SkillLoader {
  private skillsDir: string;
  private libraryDir: string;
  private skills: Map<string, SkillEntry> = new Map();

  constructor(config: SkillLoaderConfig = {}) {
    this.skillsDir = config.skillsDir ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'workspace',
      'core',
      'skills',
    );
    this.libraryDir = config.libraryDir ?? path.join(this.skillsDir, 'library');
    
    if (config.autoScan !== false) {
      this.scan();
    }
  }

  /**
   * 扫描技能目录
   */
  scan(): void {
    this.skills.clear();
    
    // 扫描 library 目录
    if (fs.existsSync(this.libraryDir)) {
      const files = fs.readdirSync(this.libraryDir);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          this.loadSkillFile(path.join(this.libraryDir, file));
        }
      }
    }
  }

  /**
   * 加载技能文件
   */
  private loadSkillFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      
      if (!frontmatter.name) {
        console.warn(`Skill file missing name: ${filePath}`);
        return;
      }
      
      const stat = fs.statSync(filePath);
      
      const entry: SkillEntry = {
        frontmatter: frontmatter as SkillFrontmatter,
        content: body,
        path: filePath,
        createdAt: stat.birthtimeMs,
        updatedAt: stat.mtimeMs,
      };
      
      this.skills.set(frontmatter.name, entry);
    } catch (error) {
      console.error(`Failed to load skill from ${filePath}:`, error);
    }
  }

  /**
   * 获取技能
   */
  get(name: string): SkillEntry | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有技能
   */
  list(options?: {
    agent?: string;
    userInvocable?: boolean;
    tag?: string;
  }): SkillEntry[] {
    let results = Array.from(this.skills.values());
    
    if (options?.agent) {
      results = results.filter(s => s.frontmatter.agent === options.agent);
    }
    
    if (options?.userInvocable !== undefined) {
      results = results.filter(s => s.frontmatter.userInvocable === options.userInvocable);
    }
    
    if (options?.tag) {
      results = results.filter(s => 
        s.frontmatter.tags?.includes(options.tag!),
      );
    }
    
    return results;
  }

  /**
   * 搜索技能
   */
  search(query: string, options?: { limit?: number }): SkillEntry[] {
    const queryLower = query.toLowerCase();
    const limit = options?.limit ?? 20;
    
    const results = this.list().filter(skill => {
      const fm = skill.frontmatter;
      
      // 名称匹配
      if (fm.name.toLowerCase().includes(queryLower)) return true;
      
      // 描述匹配
      if (fm.description.toLowerCase().includes(queryLower)) return true;
      
      // 使用场景匹配
      if (fm.whenToUse?.toLowerCase().includes(queryLower)) return true;
      
      // 标签匹配
      if (fm.tags?.some(tag => tag.toLowerCase().includes(queryLower))) return true;
      
      // 内容匹配
      if (skill.content.toLowerCase().includes(queryLower)) return true;
      
      return false;
    });
    
    return results.slice(0, limit);
  }

  /**
   * 按代理筛选技能
   */
  getByAgent(agentName: string): SkillEntry[] {
    return this.list({ agent: agentName });
  }

  /**
   * 获取用户可调用的技能
   */
  getUserInvocable(): SkillEntry[] {
    return this.list({ userInvocable: true });
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byAgent: Record<string, number>;
    userInvocable: number;
  } {
    const byAgent: Record<string, number> = {};
    let userInvocable = 0;
    
    this.skills.forEach(skill => {
      const agent = skill.frontmatter.agent ?? 'unknown';
      byAgent[agent] = (byAgent[agent] ?? 0) + 1;
      
      if (skill.frontmatter.userInvocable) {
        userInvocable++;
      }
    });
    
    return {
      total: this.skills.size,
      byAgent,
      userInvocable,
    };
  }
}
