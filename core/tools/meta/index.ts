/**
 * Meta Tools - 元认知工具
 * 
 * 让 Agent"会做事"的工具：
 * - todo.write/read/update - 任务拆解与跟踪
 * - tool.search - 工具自发现
 * - task.verify - 执行后验证
 */

export { todoWriteSkill, type TodoWriteInput, type TodoWriteOutput, type TodoItem, type TodoStatus } from './todo_write';
export { todoReadSkill, type TodoReadInput, type TodoReadOutput } from './todo_read';
export { todoUpdateSkill, type TodoUpdateInput, type TodoUpdateOutput } from './todo_update';
export { toolSearchSkill, type ToolSearchInput, type ToolSearchOutput, type ToolSearchResult } from './tool_search';
export { taskVerifySkill, type TaskVerifyInput, type TaskVerifyOutput, type VerificationResult, type CheckItem } from './task_verify';

/** 注册所有元技能 */
export function registerMetaSkills(registry: any): void {
  registry.register(todoWriteSkill);
  registry.register(todoReadSkill);
  registry.register(todoUpdateSkill);
  registry.register(toolSearchSkill);
  registry.register(taskVerifySkill);
}
