/**
 * SkillFrontmatter - 技能前置元数据
 * 
 * 技能从 prompt 文件升级成能力单元。
 * 带 frontmatter 的技能包，有触发条件、允许工具集合、上下文范围等。
 */

/** 技能前置元数据 */
export type SkillFrontmatter = {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 使用场景 */
  whenToUse?: string;
  /** 允许的工具列表 */
  allowedTools?: string[];
  /** 关联代理 */
  agent?: string;
  /** 用户是否可直接调用 */
  userInvocable?: boolean;
  /** 执行上下文 */
  executionContext?: 'default' | 'sandbox' | 'worktree';
  /** 努力程度 */
  effort?: 'low' | 'medium' | 'high';
  /** 记忆范围 */
  memoryScope?: 'none' | 'session' | 'project';
  /** 标签 */
  tags?: string[];
  /** 版本号 */
  version?: string;
};

/** 技能条目（含元数据和内容） */
export type SkillEntry = {
  /** 前置元数据 */
  frontmatter: SkillFrontmatter;
  /** 技能内容（markdown 正文） */
  content: string;
  /** 文件路径 */
  path: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
};

/** 解析 markdown frontmatter */
export function parseFrontmatter(content: string): {
  frontmatter: Partial<SkillFrontmatter>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterStr = match[1];
  const body = match[2];
  
  // 简化 YAML 解析
  const frontmatter: any = {};
  const lines = frontmatterStr.split('\n');
  
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  
  for (const line of lines) {
    // 数组项
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      currentArray.push(arrayMatch[1].trim());
      continue;
    }
    
    // 键值对
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      // 保存之前的数组
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
  
  // 保存最后的数组
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

/** 序列化 frontmatter 为 YAML */
export function stringifyFrontmatter(fm: SkillFrontmatter): string {
  const lines = ['---'];
  
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      continue; // 跳过复杂对象
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}