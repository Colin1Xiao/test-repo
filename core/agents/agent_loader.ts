/**
 * AgentLoader - 代理加载器
 * 
 * 从配置文件加载代理规格，支持 YAML frontmatter。
 */

import { AgentSpec, DEFAULT_AGENTS } from './agent_spec';
import * as fs from 'fs';
import * as path from 'path';

/** 配置 */
export interface AgentLoaderConfig {
  /** 代理目录路径 */
  agentsDir?: string;
  /** 是否加载默认代理 */
  loadDefaults?: boolean;
}

/** 代理加载器实现 */
export class AgentLoader {
  private agentsDir: string;
  private agents: Map<string, AgentSpec> = new Map();

  constructor(config: AgentLoaderConfig = {}) {
    this.agentsDir = config.agentsDir ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'workspace',
      'core',
      'agents',
      'defaults',
    );
    
    // 加载默认代理
    if (config.loadDefaults !== false) {
      Object.entries(DEFAULT_AGENTS).forEach(([name, spec]) => {
        this.agents.set(name, spec);
      });
    }
    
    // 加载自定义代理
    this.loadFromDir();
  }

  /**
   * 从目录加载代理配置
   */
  private loadFromDir(): void {
    if (!fs.existsSync(this.agentsDir)) {
      return;
    }
    
    const files = fs.readdirSync(this.agentsDir);
    
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const filePath = path.join(this.agentsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const spec = this.parseYaml(content);
          
          if (spec && spec.name) {
            this.agents.set(spec.name, spec);
          }
        } catch (error) {
          console.error(`Failed to load agent from ${file}:`, error);
        }
      }
    }
  }

  /**
   * 解析 YAML（简化实现）
   */
  private parseYaml(content: string): Partial<AgentSpec> {
    // 简化 YAML 解析，支持基本格式
    const result: any = {};
    const lines = content.split('\n');
    
    let currentKey: string | null = null;
    let currentArray: string[] | null = null;
    
    for (const line of lines) {
      // 跳过注释和空行
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }
      
      // 检查是否是数组项
      const arrayMatch = line.match(/^\s+-\s+(.+)$/);
      if (arrayMatch && currentKey && currentArray) {
        currentArray.push(arrayMatch[1].trim());
        continue;
      }
      
      // 检查是否是键值对
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2].trim();
        
        if (value === '') {
          // 可能是数组或对象的开始
          currentKey = key;
          currentArray = [];
          result[key] = currentArray;
        } else {
          // 简单值
          currentKey = null;
          currentArray = null;
          result[key] = this.parseValue(value);
        }
      }
    }
    
    return result;
  }

  /**
   * 解析 YAML 值
   */
  private parseValue(value: string): any {
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // 数字
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    
    // 字符串（去掉引号）
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    return value;
  }

  /**
   * 获取代理规格
   */
  get(name: string): AgentSpec | undefined {
    return this.agents.get(name);
  }

  /**
   * 列出所有代理
   */
  list(): AgentSpec[] {
    return Array.from(this.agents.values());
  }

  /**
   * 注册代理
   */
  register(spec: AgentSpec): void {
    this.agents.set(spec.name, spec);
  }

  /**
   * 移除代理
   */
  unregister(name: string): void {
    this.agents.delete(name);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    defaults: number;
    custom: number;
  } {
    const defaults = Object.keys(DEFAULT_AGENTS).length;
    return {
      total: this.agents.size,
      defaults,
      custom: this.agents.size - defaults,
    };
  }
}
