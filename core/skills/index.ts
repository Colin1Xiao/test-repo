/**
 * Skills Module - 技能模块
 * 
 * 核心技能集合 + 技能加载器 + frontmatter 支持。
 */

// 核心技能导出
export { fsReadSkill } from './fs.read';
export { fsWriteSkill } from './fs.write';
export { execRunSkill } from './exec.run';
export { grepSearchSkill, type GrepSearchInput, type GrepSearchResult } from './grep.search';
export { taskListSkill, type TaskListInput, type TaskListOutput } from './task.list';
export { taskOutputSkill, type TaskOutputInput, type TaskOutputResult } from './task.output';

// Frontmatter 支持
export {
  SkillFrontmatter,
  SkillEntry,
  parseFrontmatter,
  stringifyFrontmatter,
} from './skill_frontmatter';

// 技能加载器
export { SkillLoader } from './skill_loader';

/** 注册所有核心技能到 ToolRegistry */
export function registerCoreSkills(registry: any): void {
  registry.register(fsReadSkill);
  registry.register(fsWriteSkill);
  registry.register(execRunSkill);
  registry.register(grepSearchSkill);
  registry.register(taskListSkill);
  registry.register(taskOutputSkill);
}
