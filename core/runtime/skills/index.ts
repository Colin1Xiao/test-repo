/**
 * Runtime Skills - 核心技能集合
 * 
 * 已迁移的 6 个核心技能：
 * 1. fs.read - 文件读取
 * 2. fs.write - 文件写入
 * 3. exec.run - 命令执行
 * 4. grep.search - 搜索
 * 5. task.list - 任务列表
 * 6. task.output - 任务输出读取
 */

export { fsReadSkill } from './fs.read';
export { fsWriteSkill } from './fs.write';
export { execRunSkill } from './exec.run';
export { grepSearchSkill, type GrepSearchInput, type GrepSearchResult } from './grep.search';
export { taskListSkill, type TaskListInput, type TaskListOutput } from './task.list';
export { taskOutputSkill, type TaskOutputInput, type TaskOutputResult } from './task.output';

/** 注册所有核心技能到 ToolRegistry */
export function registerCoreSkills(registry: any): void {
  registry.register(fsReadSkill);
  registry.register(fsWriteSkill);
  registry.register(execRunSkill);
  registry.register(grepSearchSkill);
  registry.register(taskListSkill);
  registry.register(taskOutputSkill);
}
