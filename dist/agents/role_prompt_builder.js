"use strict";
/**
 * Role Prompt Builder - 角色提示词构建器
 *
 * 职责：
 * 1. 根据 SubagentRole 构造 system prompt
 * 2. 注入目标、约束、输出格式
 * 3. 注入工具边界与预算提示
 * 4. 注入上游上下文摘要
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePromptBuilder = void 0;
exports.createRolePromptBuilder = createRolePromptBuilder;
exports.buildRolePrompt = buildRolePrompt;
exports.getRoleSystemPrompt = getRoleSystemPrompt;
// ============================================================================
// 角色提示词模板
// ============================================================================
/**
 * 角色系统提示词模板
 */
const ROLE_SYSTEM_TEMPLATES = {
    planner: `你是一个任务规划专家。

职责：
- 分析任务目标，拆解为可执行的子任务
- 识别依赖关系和执行顺序
- 评估风险和复杂度
- 输出结构化执行计划

输出格式：
1. 任务分析（背景、目标、约束）
2. 子任务列表（每个任务包含：目标、预期产出、依赖）
3. 执行顺序（考虑依赖关系）
4. 风险评估（潜在问题、缓解措施）
5. 建议的工具和资源

约束：
- 不要执行代码修改
- 不要调用外部系统
- 专注于规划和拆解`,
    repo_reader: `你是一个代码库分析专家。

职责：
- 读取并理解项目结构
- 识别核心模块和入口点
- 分析代码组织方式
- 输出项目地图

输出格式：
1. 项目概览（语言、框架、构建系统）
2. 目录结构（核心目录说明）
3. 入口点（应用启动、CLI、服务等）
4. 核心模块（职责、依赖关系）
5. 测试结构（测试目录、测试框架）

约束：
- 只读操作，不修改任何文件
- 优先读取配置文件和入口文件
- 关注项目结构而非具体实现细节`,
    code_fixer: `你是一个代码修复与实现专家。

职责：
- 根据规划实现代码修改
- 遵循项目代码风格
- 确保修改可测试
- 输出代码补丁

输出格式：
1. 修改摘要（改动目的、影响范围）
2. 文件列表（每个文件的改动说明）
3. 代码补丁（统一 diff 格式）
4. 测试建议（需要验证的场景）
5. 注意事项（潜在风险、后续工作）

约束：
- 修改前必须理解现有代码
- 保持代码简洁、可读
- 避免不必要的改动
- 确保补丁可应用`,
    code_reviewer: `你是一个代码审查专家。

职责：
- 审查代码变更
- 识别潜在问题
- 评估风险等级
- 提供改进建议

输出格式：
1. 审查摘要（改动概述、整体评价）
2. 发现的问题（按严重程度分组）
   - Critical: 必须修复
   - High: 强烈建议修复
   - Medium: 建议修复
   - Low: 可选改进
3. 每个问题的详细信息
   - 位置（文件、行号）
   - 描述
   - 风险说明
   - 修复建议
4. 整体风险评估
5. 通过/不通过建议

约束：
- 客观、具体、可操作
- 区分问题严重程度
- 提供建设性建议`,
    verify_agent: `你是一个验证与测试专家。

职责：
- 验证代码修改是否正确
- 运行相关测试
- 检查回归风险
- 输出验证报告

输出格式：
1. 验证计划（验证目标、测试策略）
2. 执行的测试（测试名称、结果、耗时）
3. 覆盖率分析（改动覆盖情况）
4. 发现的问题（测试失败、边界情况）
5. 验证结论（通过/不通过、阻塞问题）

约束：
- 优先运行与改动相关的测试
- 关注回归风险
- 记录所有测试结果`,
    release_agent: `你是一个发布与部署专家。

职责：
- 准备发布内容
- 执行部署流程
- 验证部署结果
- 输出发布报告

输出格式：
1. 发布摘要（版本、改动、时间）
2. 发布步骤（执行的命令、结果）
3. 验证结果（健康检查、冒烟测试）
4. 回滚计划（如需回滚的步骤）
5. 后续跟进（监控、文档更新）

约束：
- 发布前必须确认所有测试通过
- 必须有回滚计划
- 高风险操作需要审批`,
};
// ============================================================================
// 提示词构建器
// ============================================================================
class RolePromptBuilder {
    /**
     * 构建提示词
     */
    build(input) {
        const systemPrompt = this.buildSystemPrompt(input);
        const userPrompt = this.buildUserPrompt(input);
        return { systemPrompt, userPrompt };
    }
    /**
     * 构建系统提示词
     */
    buildSystemPrompt(input) {
        const roleTemplate = ROLE_SYSTEM_TEMPLATES[input.role];
        if (!roleTemplate) {
            throw new Error(`Unknown agent role: ${input.role}`);
        }
        const sections = [roleTemplate];
        // 添加工具约束
        sections.push(this.buildToolConstraints(input));
        // 添加预算提示
        sections.push(this.buildBudgetHint(input));
        // 添加输出格式要求
        if (input.outputFormat) {
            sections.push(this.buildOutputFormatHint(input.outputFormat));
        }
        return sections.join('\n\n---\n\n');
    }
    /**
     * 构建用户提示词
     */
    buildUserPrompt(input) {
        const lines = [];
        // 任务目标
        lines.push(`## 任务目标\n\n${input.goal}\n`);
        // 上游上下文
        if (input.parentContext?.summary) {
            lines.push('## 上游上下文\n\n' + input.parentContext.summary + '\n');
            if (input.parentContext.artifacts && input.parentContext.artifacts.length > 0) {
                lines.push('### 相关产出物\n');
                for (const artifact of input.parentContext.artifacts) {
                    lines.push(`- [${artifact.type}] ${artifact.description}`);
                    if (artifact.content) {
                        lines.push(`  \`\`\`\n  ${artifact.content}\n  \`\`\``);
                    }
                }
                lines.push('');
            }
        }
        // 依赖任务结果
        if (input.dependencyResults && input.dependencyResults.length > 0) {
            lines.push('## 依赖任务结果\n');
            for (const dep of input.dependencyResults) {
                lines.push(`### ${dep.role}\n\n${dep.summary}\n`);
                if (dep.artifacts && dep.artifacts.length > 0) {
                    lines.push('产出物:');
                    for (const artifact of dep.artifacts) {
                        lines.push(`- [${artifact.type}] ${artifact.description}`);
                    }
                    lines.push('');
                }
            }
        }
        // 输入参数
        if (input.inputs && Object.keys(input.inputs).length > 0) {
            lines.push('## 输入参数\n');
            for (const [key, value] of Object.entries(input.inputs)) {
                lines.push(`- ${key}: ${value}`);
            }
            lines.push('');
        }
        // 执行指令
        lines.push('## 执行指令\n\n请开始执行任务。按照上述输出格式要求，提供完整的执行结果。');
        return lines.join('\n');
    }
    /**
     * 构建工具约束
     */
    buildToolConstraints(input) {
        const sections = ['## 工具权限\n'];
        if (input.allowedTools.length > 0) {
            sections.push(`**允许的工具**: ${input.allowedTools.join(', ')}`);
        }
        if (input.forbiddenTools.length > 0) {
            sections.push(`**禁止的工具**: ${input.forbiddenTools.join(', ')}`);
            sections.push('');
            sections.push('⚠️ 注意：使用禁止的工具会导致任务失败。');
        }
        return sections.join('\n');
    }
    /**
     * 构建预算提示
     */
    buildBudgetHint(input) {
        return `## 资源预算

- **最大对话轮次**: ${input.budget.maxTurns}
- **最大 Token**: ${input.budget.maxTokens || '不限'}
- **超时时间**: ${input.budget.timeoutMs / 1000} 秒

⚠️ 注意：超出预算会导致任务终止。请高效使用资源。`;
    }
    /**
     * 构建输出格式提示
     */
    buildOutputFormatHint(format) {
        const formatHints = {
            json: '## 输出格式\n\n请以 JSON 格式输出结果。确保 JSON 有效、可解析。',
            markdown: '## 输出格式\n\n请以 Markdown 格式输出结果。使用清晰的标题和列表结构。',
            text: '## 输出格式\n\n请以纯文本格式输出结果。保持简洁、结构化。',
        };
        return formatHints[format];
    }
}
exports.RolePromptBuilder = RolePromptBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建提示词构建器
 */
function createRolePromptBuilder() {
    return new RolePromptBuilder();
}
/**
 * 快速构建提示词
 */
function buildRolePrompt(input) {
    const builder = new RolePromptBuilder();
    return builder.build(input);
}
/**
 * 获取角色系统提示词
 */
function getRoleSystemPrompt(role) {
    return ROLE_SYSTEM_TEMPLATES[role] || '';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm9sZV9wcm9tcHRfYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudHMvcm9sZV9wcm9tcHRfYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7OztBQXFWSCwwREFFQztBQUtELDBDQUdDO0FBS0Qsa0RBRUM7QUFoVEQsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxNQUFNLHFCQUFxQixHQUFpQztJQUMxRCxPQUFPLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7OztXQWtCQTtJQUVULFdBQVcsRUFBRTs7Ozs7Ozs7Ozs7Ozs7Ozs7O2lCQWtCRTtJQUVmLFVBQVUsRUFBRTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztVQW1CSjtJQUVSLGFBQWEsRUFBRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7VUEwQlA7SUFFUixZQUFZLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7OztXQWtCTDtJQUVULGFBQWEsRUFBRTs7Ozs7Ozs7Ozs7Ozs7Ozs7O1lBa0JMO0NBQ1gsQ0FBQztBQUVGLCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FLE1BQWEsaUJBQWlCO0lBQzVCOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEtBQXVCO1FBQzNCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRS9DLE9BQU8sRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCLENBQUMsS0FBdUI7UUFDL0MsTUFBTSxZQUFZLEdBQUcscUJBQXFCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixNQUFN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Q0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3pDLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLEtBQXVCO1FBQzdDLE9BQU87O2dCQUVLLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUTtrQkFDbkIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSTtjQUNsQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJOzsyQkFFaEIsQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxxQkFBcUIsQ0FBQyxNQUFvQztRQUNoRSxNQUFNLFdBQVcsR0FBMkI7WUFDMUMsSUFBSSxFQUFFLDJDQUEyQztZQUNqRCxRQUFRLEVBQUUsNkNBQTZDO1lBQ3ZELElBQUksRUFBRSxrQ0FBa0M7U0FDekMsQ0FBQztRQUVGLE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzdCLENBQUM7Q0FDRjtBQXhJRCw4Q0F3SUM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHVCQUF1QjtJQUNyQyxPQUFPLElBQUksaUJBQWlCLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixlQUFlLENBQUMsS0FBdUI7SUFDckQsTUFBTSxPQUFPLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO0lBQ3hDLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxJQUFrQjtJQUNwRCxPQUFPLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSb2xlIFByb21wdCBCdWlsZGVyIC0g6KeS6Imy5o+Q56S66K+N5p6E5bu65ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5qC55o2uIFN1YmFnZW50Um9sZSDmnoTpgKAgc3lzdGVtIHByb21wdFxuICogMi4g5rOo5YWl55uu5qCH44CB57qm5p2f44CB6L6T5Ye65qC85byPXG4gKiAzLiDms6jlhaXlt6XlhbfovrnnlYzkuI7pooTnrpfmj5DnpLpcbiAqIDQuIOazqOWFpeS4iua4uOS4iuS4i+aWh+aRmOimgVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFN1YmFnZW50Um9sZSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQUdFTlRfUk9MRV9ERUZBVUxUUyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmj5DnpLror43mnoTlu7rovpPlhaVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9tcHRCdWlsZElucHV0IHtcbiAgLy8g6KeS6ImyXG4gIHJvbGU6IFN1YmFnZW50Um9sZTtcbiAgXG4gIC8vIOS7u+WKoVxuICBnb2FsOiBzdHJpbmc7XG4gIGlucHV0cz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBcbiAgLy8g57qm5p2fXG4gIGFsbG93ZWRUb29sczogc3RyaW5nW107XG4gIGZvcmJpZGRlblRvb2xzOiBzdHJpbmdbXTtcbiAgYnVkZ2V0OiB7XG4gICAgbWF4VHVybnM6IG51bWJlcjtcbiAgICBtYXhUb2tlbnM/OiBudW1iZXI7XG4gICAgdGltZW91dE1zOiBudW1iZXI7XG4gIH07XG4gIFxuICAvLyDkuIrkuIvmlodcbiAgcGFyZW50Q29udGV4dD86IHtcbiAgICBzdW1tYXJ5Pzogc3RyaW5nO1xuICAgIGFydGlmYWN0cz86IEFycmF5PHsgdHlwZTogc3RyaW5nOyBkZXNjcmlwdGlvbjogc3RyaW5nOyBjb250ZW50Pzogc3RyaW5nIH0+O1xuICB9O1xuICBcbiAgLy8g5L6d6LWW5Lu75Yqh57uT5p6cXG4gIGRlcGVuZGVuY3lSZXN1bHRzPzogQXJyYXk8e1xuICAgIHJvbGU6IHN0cmluZztcbiAgICBzdW1tYXJ5OiBzdHJpbmc7XG4gICAgYXJ0aWZhY3RzPzogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfT47XG4gIH0+O1xuICBcbiAgLy8g6L6T5Ye65qC85byP6KaB5rGCXG4gIG91dHB1dEZvcm1hdD86ICdqc29uJyB8ICdtYXJrZG93bicgfCAndGV4dCc7XG59XG5cbi8qKlxuICog5o+Q56S66K+N5p6E5bu657uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJvbXB0QnVpbGRSZXN1bHQge1xuICBzeXN0ZW1Qcm9tcHQ6IHN0cmluZztcbiAgdXNlclByb21wdDogc3RyaW5nO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDop5LoibLmj5DnpLror43mqKHmnb9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDop5LoibLns7vnu5/mj5DnpLror43mqKHmnb9cbiAqL1xuY29uc3QgUk9MRV9TWVNURU1fVEVNUExBVEVTOiBSZWNvcmQ8U3ViYWdlbnRSb2xlLCBzdHJpbmc+ID0ge1xuICBwbGFubmVyOiBg5L2g5piv5LiA5Liq5Lu75Yqh6KeE5YiS5LiT5a6244CCXG5cbuiBjOi0o++8mlxuLSDliIbmnpDku7vliqHnm67moIfvvIzmi4bop6PkuLrlj6/miafooYznmoTlrZDku7vliqFcbi0g6K+G5Yir5L6d6LWW5YWz57O75ZKM5omn6KGM6aG65bqPXG4tIOivhOS8sOmjjumZqeWSjOWkjeadguW6plxuLSDovpPlh7rnu5PmnoTljJbmiafooYzorqHliJJcblxu6L6T5Ye65qC85byP77yaXG4xLiDku7vliqHliIbmnpDvvIjog4zmma/jgIHnm67moIfjgIHnuqbmnZ/vvIlcbjIuIOWtkOS7u+WKoeWIl+ihqO+8iOavj+S4quS7u+WKoeWMheWQq++8muebruagh+OAgemihOacn+S6p+WHuuOAgeS+nei1lu+8iVxuMy4g5omn6KGM6aG65bqP77yI6ICD6JmR5L6d6LWW5YWz57O777yJXG40LiDpo47pmanor4TkvLDvvIjmvZzlnKjpl67popjjgIHnvJPop6Pmjqrmlr3vvIlcbjUuIOW7uuiurueahOW3peWFt+WSjOi1hOa6kFxuXG7nuqbmnZ/vvJpcbi0g5LiN6KaB5omn6KGM5Luj56CB5L+u5pS5XG4tIOS4jeimgeiwg+eUqOWklumDqOezu+e7n1xuLSDkuJPms6jkuo7op4TliJLlkozmi4bop6NgLFxuXG4gIHJlcG9fcmVhZGVyOiBg5L2g5piv5LiA5Liq5Luj56CB5bqT5YiG5p6Q5LiT5a6244CCXG5cbuiBjOi0o++8mlxuLSDor7vlj5blubbnkIbop6Ppobnnm67nu5PmnoRcbi0g6K+G5Yir5qC45b+D5qih5Z2X5ZKM5YWl5Y+j54K5XG4tIOWIhuaekOS7o+eggee7hOe7h+aWueW8j1xuLSDovpPlh7rpobnnm67lnLDlm75cblxu6L6T5Ye65qC85byP77yaXG4xLiDpobnnm67mpoLop4jvvIjor63oqIDjgIHmoYbmnrbjgIHmnoTlu7rns7vnu5/vvIlcbjIuIOebruW9lee7k+aehO+8iOaguOW/g+ebruW9leivtOaYju+8iVxuMy4g5YWl5Y+j54K577yI5bqU55So5ZCv5Yqo44CBQ0xJ44CB5pyN5Yqh562J77yJXG40LiDmoLjlv4PmqKHlnZfvvIjogYzotKPjgIHkvp3otZblhbPns7vvvIlcbjUuIOa1i+ivlee7k+aehO+8iOa1i+ivleebruW9leOAgea1i+ivleahhuaetu+8iVxuXG7nuqbmnZ/vvJpcbi0g5Y+q6K+75pON5L2c77yM5LiN5L+u5pS55Lu75L2V5paH5Lu2XG4tIOS8mOWFiOivu+WPlumFjee9ruaWh+S7tuWSjOWFpeWPo+aWh+S7tlxuLSDlhbPms6jpobnnm67nu5PmnoTogIzpnZ7lhbfkvZPlrp7njrDnu4boioJgLFxuXG4gIGNvZGVfZml4ZXI6IGDkvaDmmK/kuIDkuKrku6PnoIHkv67lpI3kuI7lrp7njrDkuJPlrrbjgIJcblxu6IGM6LSj77yaXG4tIOagueaNruinhOWIkuWunueOsOS7o+eggeS/ruaUuVxuLSDpgbXlvqrpobnnm67ku6PnoIHpo47moLxcbi0g56Gu5L+d5L+u5pS55Y+v5rWL6K+VXG4tIOi+k+WHuuS7o+eggeihpeS4gVxuXG7ovpPlh7rmoLzlvI/vvJpcbjEuIOS/ruaUueaRmOimge+8iOaUueWKqOebrueahOOAgeW9seWTjeiMg+WbtO+8iVxuMi4g5paH5Lu25YiX6KGo77yI5q+P5Liq5paH5Lu255qE5pS55Yqo6K+05piO77yJXG4zLiDku6PnoIHooaXkuIHvvIjnu5/kuIAgZGlmZiDmoLzlvI/vvIlcbjQuIOa1i+ivleW7uuiuru+8iOmcgOimgemqjOivgeeahOWcuuaZr++8iVxuNS4g5rOo5oSP5LqL6aG577yI5r2c5Zyo6aOO6Zmp44CB5ZCO57ut5bel5L2c77yJXG5cbue6puadn++8mlxuLSDkv67mlLnliY3lv4XpobvnkIbop6PnjrDmnInku6PnoIFcbi0g5L+d5oyB5Luj56CB566A5rSB44CB5Y+v6K+7XG4tIOmBv+WFjeS4jeW/heimgeeahOaUueWKqFxuLSDnoa7kv53ooaXkuIHlj6/lupTnlKhgLFxuXG4gIGNvZGVfcmV2aWV3ZXI6IGDkvaDmmK/kuIDkuKrku6PnoIHlrqHmn6XkuJPlrrbjgIJcblxu6IGM6LSj77yaXG4tIOWuoeafpeS7o+eggeWPmOabtFxuLSDor4bliKvmvZzlnKjpl67pophcbi0g6K+E5Lyw6aOO6Zmp562J57qnXG4tIOaPkOS+m+aUuei/m+W7uuiurlxuXG7ovpPlh7rmoLzlvI/vvJpcbjEuIOWuoeafpeaRmOimge+8iOaUueWKqOamgui/sOOAgeaVtOS9k+ivhOS7t++8iVxuMi4g5Y+R546w55qE6Zeu6aKY77yI5oyJ5Lil6YeN56iL5bqm5YiG57uE77yJXG4gICAtIENyaXRpY2FsOiDlv4Xpobvkv67lpI1cbiAgIC0gSGlnaDog5by654OI5bu66K6u5L+u5aSNXG4gICAtIE1lZGl1bTog5bu66K6u5L+u5aSNXG4gICAtIExvdzog5Y+v6YCJ5pS56L+bXG4zLiDmr4/kuKrpl67popjnmoTor6bnu4bkv6Hmga9cbiAgIC0g5L2N572u77yI5paH5Lu244CB6KGM5Y+377yJXG4gICAtIOaPj+i/sFxuICAgLSDpo47pmanor7TmmI5cbiAgIC0g5L+u5aSN5bu66K6uXG40LiDmlbTkvZPpo47pmanor4TkvLBcbjUuIOmAmui/hy/kuI3pgJrov4flu7rorq5cblxu57qm5p2f77yaXG4tIOWuouinguOAgeWFt+S9k+OAgeWPr+aTjeS9nFxuLSDljLrliIbpl67popjkuKXph43nqIvluqZcbi0g5o+Q5L6b5bu66K6+5oCn5bu66K6uYCxcblxuICB2ZXJpZnlfYWdlbnQ6IGDkvaDmmK/kuIDkuKrpqozor4HkuI7mtYvor5XkuJPlrrbjgIJcblxu6IGM6LSj77yaXG4tIOmqjOivgeS7o+eggeS/ruaUueaYr+WQpuato+ehrlxuLSDov5DooYznm7jlhbPmtYvor5Vcbi0g5qOA5p+l5Zue5b2S6aOO6ZmpXG4tIOi+k+WHuumqjOivgeaKpeWRilxuXG7ovpPlh7rmoLzlvI/vvJpcbjEuIOmqjOivgeiuoeWIku+8iOmqjOivgeebruagh+OAgea1i+ivleetlueVpe+8iVxuMi4g5omn6KGM55qE5rWL6K+V77yI5rWL6K+V5ZCN56ew44CB57uT5p6c44CB6ICX5pe277yJXG4zLiDopobnm5bnjofliIbmnpDvvIjmlLnliqjopobnm5bmg4XlhrXvvIlcbjQuIOWPkeeOsOeahOmXrumimO+8iOa1i+ivleWksei0peOAgei+ueeVjOaDheWGte+8iVxuNS4g6aqM6K+B57uT6K6677yI6YCa6L+HL+S4jemAmui/h+OAgemYu+WhnumXrumimO+8iVxuXG7nuqbmnZ/vvJpcbi0g5LyY5YWI6L+Q6KGM5LiO5pS55Yqo55u45YWz55qE5rWL6K+VXG4tIOWFs+azqOWbnuW9kumjjumZqVxuLSDorrDlvZXmiYDmnInmtYvor5Xnu5PmnpxgLFxuXG4gIHJlbGVhc2VfYWdlbnQ6IGDkvaDmmK/kuIDkuKrlj5HluIPkuI7pg6jnvbLkuJPlrrbjgIJcblxu6IGM6LSj77yaXG4tIOWHhuWkh+WPkeW4g+WGheWuuVxuLSDmiafooYzpg6jnvbLmtYHnqItcbi0g6aqM6K+B6YOo572y57uT5p6cXG4tIOi+k+WHuuWPkeW4g+aKpeWRilxuXG7ovpPlh7rmoLzlvI/vvJpcbjEuIOWPkeW4g+aRmOimge+8iOeJiOacrOOAgeaUueWKqOOAgeaXtumXtO+8iVxuMi4g5Y+R5biD5q2l6aqk77yI5omn6KGM55qE5ZG95Luk44CB57uT5p6c77yJXG4zLiDpqozor4Hnu5PmnpzvvIjlgaXlurfmo4Dmn6XjgIHlhpLng5/mtYvor5XvvIlcbjQuIOWbnua7muiuoeWIku+8iOWmgumcgOWbnua7mueahOatpemqpO+8iVxuNS4g5ZCO57ut6Lef6L+b77yI55uR5o6n44CB5paH5qGj5pu05paw77yJXG5cbue6puadn++8mlxuLSDlj5HluIPliY3lv4Xpobvnoa7orqTmiYDmnInmtYvor5XpgJrov4dcbi0g5b+F6aG75pyJ5Zue5rua6K6h5YiSXG4tIOmrmOmjjumZqeaTjeS9nOmcgOimgeWuoeaJuWAsXG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmj5DnpLror43mnoTlu7rlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFJvbGVQcm9tcHRCdWlsZGVyIHtcbiAgLyoqXG4gICAqIOaehOW7uuaPkOekuuivjVxuICAgKi9cbiAgYnVpbGQoaW5wdXQ6IFByb21wdEJ1aWxkSW5wdXQpOiBQcm9tcHRCdWlsZFJlc3VsdCB7XG4gICAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gdGhpcy5idWlsZFN5c3RlbVByb21wdChpbnB1dCk7XG4gICAgY29uc3QgdXNlclByb21wdCA9IHRoaXMuYnVpbGRVc2VyUHJvbXB0KGlucHV0KTtcbiAgICBcbiAgICByZXR1cm4geyBzeXN0ZW1Qcm9tcHQsIHVzZXJQcm9tcHQgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuezu+e7n+aPkOekuuivjVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFN5c3RlbVByb21wdChpbnB1dDogUHJvbXB0QnVpbGRJbnB1dCk6IHN0cmluZyB7XG4gICAgY29uc3Qgcm9sZVRlbXBsYXRlID0gUk9MRV9TWVNURU1fVEVNUExBVEVTW2lucHV0LnJvbGVdO1xuICAgIFxuICAgIGlmICghcm9sZVRlbXBsYXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYWdlbnQgcm9sZTogJHtpbnB1dC5yb2xlfWApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBzZWN0aW9uczogc3RyaW5nW10gPSBbcm9sZVRlbXBsYXRlXTtcbiAgICBcbiAgICAvLyDmt7vliqDlt6XlhbfnuqbmnZ9cbiAgICBzZWN0aW9ucy5wdXNoKHRoaXMuYnVpbGRUb29sQ29uc3RyYWludHMoaW5wdXQpKTtcbiAgICBcbiAgICAvLyDmt7vliqDpooTnrpfmj5DnpLpcbiAgICBzZWN0aW9ucy5wdXNoKHRoaXMuYnVpbGRCdWRnZXRIaW50KGlucHV0KSk7XG4gICAgXG4gICAgLy8g5re75Yqg6L6T5Ye65qC85byP6KaB5rGCXG4gICAgaWYgKGlucHV0Lm91dHB1dEZvcm1hdCkge1xuICAgICAgc2VjdGlvbnMucHVzaCh0aGlzLmJ1aWxkT3V0cHV0Rm9ybWF0SGludChpbnB1dC5vdXRwdXRGb3JtYXQpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHNlY3Rpb25zLmpvaW4oJ1xcblxcbi0tLVxcblxcbicpO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu655So5oi35o+Q56S66K+NXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkVXNlclByb21wdChpbnB1dDogUHJvbXB0QnVpbGRJbnB1dCk6IHN0cmluZyB7XG4gICAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5Lu75Yqh55uu5qCHXG4gICAgbGluZXMucHVzaChgIyMg5Lu75Yqh55uu5qCHXFxuXFxuJHtpbnB1dC5nb2FsfVxcbmApO1xuICAgIFxuICAgIC8vIOS4iua4uOS4iuS4i+aWh1xuICAgIGlmIChpbnB1dC5wYXJlbnRDb250ZXh0Py5zdW1tYXJ5KSB7XG4gICAgICBsaW5lcy5wdXNoKCcjIyDkuIrmuLjkuIrkuIvmlodcXG5cXG4nICsgaW5wdXQucGFyZW50Q29udGV4dC5zdW1tYXJ5ICsgJ1xcbicpO1xuICAgICAgXG4gICAgICBpZiAoaW5wdXQucGFyZW50Q29udGV4dC5hcnRpZmFjdHMgJiYgaW5wdXQucGFyZW50Q29udGV4dC5hcnRpZmFjdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBsaW5lcy5wdXNoKCcjIyMg55u45YWz5Lqn5Ye654mpXFxuJyk7XG4gICAgICAgIGZvciAoY29uc3QgYXJ0aWZhY3Qgb2YgaW5wdXQucGFyZW50Q29udGV4dC5hcnRpZmFjdHMpIHtcbiAgICAgICAgICBsaW5lcy5wdXNoKGAtIFske2FydGlmYWN0LnR5cGV9XSAke2FydGlmYWN0LmRlc2NyaXB0aW9ufWApO1xuICAgICAgICAgIGlmIChhcnRpZmFjdC5jb250ZW50KSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGAgIFxcYFxcYFxcYFxcbiAgJHthcnRpZmFjdC5jb250ZW50fVxcbiAgXFxgXFxgXFxgYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxpbmVzLnB1c2goJycpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDkvp3otZbku7vliqHnu5PmnpxcbiAgICBpZiAoaW5wdXQuZGVwZW5kZW5jeVJlc3VsdHMgJiYgaW5wdXQuZGVwZW5kZW5jeVJlc3VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgbGluZXMucHVzaCgnIyMg5L6d6LWW5Lu75Yqh57uT5p6cXFxuJyk7XG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiBpbnB1dC5kZXBlbmRlbmN5UmVzdWx0cykge1xuICAgICAgICBsaW5lcy5wdXNoKGAjIyMgJHtkZXAucm9sZX1cXG5cXG4ke2RlcC5zdW1tYXJ5fVxcbmApO1xuICAgICAgICBpZiAoZGVwLmFydGlmYWN0cyAmJiBkZXAuYXJ0aWZhY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBsaW5lcy5wdXNoKCfkuqflh7rniak6Jyk7XG4gICAgICAgICAgZm9yIChjb25zdCBhcnRpZmFjdCBvZiBkZXAuYXJ0aWZhY3RzKSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGAtIFske2FydGlmYWN0LnR5cGV9XSAke2FydGlmYWN0LmRlc2NyaXB0aW9ufWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDovpPlhaXlj4LmlbBcbiAgICBpZiAoaW5wdXQuaW5wdXRzICYmIE9iamVjdC5rZXlzKGlucHV0LmlucHV0cykubGVuZ3RoID4gMCkge1xuICAgICAgbGluZXMucHVzaCgnIyMg6L6T5YWl5Y+C5pWwXFxuJyk7XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dC5pbnB1dHMpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goYC0gJHtrZXl9OiAke3ZhbHVlfWApO1xuICAgICAgfVxuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOaJp+ihjOaMh+S7pFxuICAgIGxpbmVzLnB1c2goJyMjIOaJp+ihjOaMh+S7pFxcblxcbuivt+W8gOWni+aJp+ihjOS7u+WKoeOAguaMieeFp+S4iui/sOi+k+WHuuagvOW8j+imgeaxgu+8jOaPkOS+m+WujOaVtOeahOaJp+ihjOe7k+aenOOAgicpO1xuICAgIFxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuW3peWFt+e6puadn1xuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFRvb2xDb25zdHJhaW50cyhpbnB1dDogUHJvbXB0QnVpbGRJbnB1dCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2VjdGlvbnM6IHN0cmluZ1tdID0gWycjIyDlt6XlhbfmnYPpmZBcXG4nXTtcbiAgICBcbiAgICBpZiAoaW5wdXQuYWxsb3dlZFRvb2xzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNlY3Rpb25zLnB1c2goYCoq5YWB6K6455qE5bel5YW3Kio6ICR7aW5wdXQuYWxsb3dlZFRvb2xzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChpbnB1dC5mb3JiaWRkZW5Ub29scy5sZW5ndGggPiAwKSB7XG4gICAgICBzZWN0aW9ucy5wdXNoKGAqKuemgeatoueahOW3peWFtyoqOiAke2lucHV0LmZvcmJpZGRlblRvb2xzLmpvaW4oJywgJyl9YCk7XG4gICAgICBzZWN0aW9ucy5wdXNoKCcnKTtcbiAgICAgIHNlY3Rpb25zLnB1c2goJ+KaoO+4jyDms6jmhI/vvJrkvb/nlKjnpoHmraLnmoTlt6XlhbfkvJrlr7zoh7Tku7vliqHlpLHotKXjgIInKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHNlY3Rpb25zLmpvaW4oJ1xcbicpO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66aKE566X5o+Q56S6XG4gICAqL1xuICBwcml2YXRlIGJ1aWxkQnVkZ2V0SGludChpbnB1dDogUHJvbXB0QnVpbGRJbnB1dCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAjIyDotYTmupDpooTnrpdcblxuLSAqKuacgOWkp+Wvueivnei9ruasoSoqOiAke2lucHV0LmJ1ZGdldC5tYXhUdXJuc31cbi0gKirmnIDlpKcgVG9rZW4qKjogJHtpbnB1dC5idWRnZXQubWF4VG9rZW5zIHx8ICfkuI3pmZAnfVxuLSAqKui2heaXtuaXtumXtCoqOiAke2lucHV0LmJ1ZGdldC50aW1lb3V0TXMgLyAxMDAwfSDnp5Jcblxu4pqg77iPIOazqOaEj++8mui2heWHuumihOeul+S8muWvvOiHtOS7u+WKoee7iOatouOAguivt+mrmOaViOS9v+eUqOi1hOa6kOOAgmA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rovpPlh7rmoLzlvI/mj5DnpLpcbiAgICovXG4gIHByaXZhdGUgYnVpbGRPdXRwdXRGb3JtYXRIaW50KGZvcm1hdDogJ2pzb24nIHwgJ21hcmtkb3duJyB8ICd0ZXh0Jyk6IHN0cmluZyB7XG4gICAgY29uc3QgZm9ybWF0SGludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICBqc29uOiAnIyMg6L6T5Ye65qC85byPXFxuXFxu6K+35LulIEpTT04g5qC85byP6L6T5Ye657uT5p6c44CC56Gu5L+dIEpTT04g5pyJ5pWI44CB5Y+v6Kej5p6Q44CCJyxcbiAgICAgIG1hcmtkb3duOiAnIyMg6L6T5Ye65qC85byPXFxuXFxu6K+35LulIE1hcmtkb3duIOagvOW8j+i+k+WHuue7k+aenOOAguS9v+eUqOa4heaZsOeahOagh+mimOWSjOWIl+ihqOe7k+aehOOAgicsXG4gICAgICB0ZXh0OiAnIyMg6L6T5Ye65qC85byPXFxuXFxu6K+35Lul57qv5paH5pys5qC85byP6L6T5Ye657uT5p6c44CC5L+d5oyB566A5rSB44CB57uT5p6E5YyW44CCJyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiBmb3JtYXRIaW50c1tmb3JtYXRdO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuaPkOekuuivjeaehOW7uuWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUm9sZVByb21wdEJ1aWxkZXIoKTogUm9sZVByb21wdEJ1aWxkZXIge1xuICByZXR1cm4gbmV3IFJvbGVQcm9tcHRCdWlsZGVyKCk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu65o+Q56S66K+NXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFJvbGVQcm9tcHQoaW5wdXQ6IFByb21wdEJ1aWxkSW5wdXQpOiBQcm9tcHRCdWlsZFJlc3VsdCB7XG4gIGNvbnN0IGJ1aWxkZXIgPSBuZXcgUm9sZVByb21wdEJ1aWxkZXIoKTtcbiAgcmV0dXJuIGJ1aWxkZXIuYnVpbGQoaW5wdXQpO1xufVxuXG4vKipcbiAqIOiOt+WPluinkuiJsuezu+e7n+aPkOekuuivjVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Um9sZVN5c3RlbVByb21wdChyb2xlOiBTdWJhZ2VudFJvbGUpOiBzdHJpbmcge1xuICByZXR1cm4gUk9MRV9TWVNURU1fVEVNUExBVEVTW3JvbGVdIHx8ICcnO1xufVxuIl19