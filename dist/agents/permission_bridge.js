"use strict";
/**
 * Permission Bridge - 权限桥接层
 *
 * 将 Agent Teams 的权限请求桥接到 OpenClaw PermissionEngine
 *
 * 核心原则：
 * 1. 子代理权限只能 ≤ 父上下文权限
 * 2. 不允许子代理绕过审批
 * 3. 所有权限检查可审计
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_TOOL_MATRIX = exports.PermissionBridge = void 0;
exports.createPermissionBridge = createPermissionBridge;
exports.canAccessTool = canAccessTool;
exports.requiresApproval = requiresApproval;
const types_1 = require("./types");
// ============================================================================
// 权限桥接实现
// ============================================================================
class PermissionBridge {
    constructor(permissionEngine) {
        this.permissionEngine = permissionEngine;
    }
    /**
     * 检查子代理权限
     *
     * 流程：
     * 1. 检查角色工具白名单
     * 2. 检查角色工具黑名单
     * 3. 调用 PermissionEngine 进行全局检查
     */
    async checkPermission(check) {
        // Step 1: 检查角色白名单
        const roleDefaults = types_1.AGENT_ROLE_DEFAULTS[check.role];
        if (!roleDefaults) {
            return {
                allowed: false,
                behavior: 'deny',
                requiresApproval: false,
                explanation: `Unknown agent role: ${check.role}`,
            };
        }
        // 检查是否在角色白名单
        if (!roleDefaults.allowedTools.includes(check.tool)) {
            return {
                allowed: false,
                behavior: 'deny',
                requiresApproval: false,
                explanation: `Tool "${check.tool}" not allowed for role "${check.role}"`,
            };
        }
        // 检查是否在角色黑名单
        if (roleDefaults.forbiddenTools.includes(check.tool)) {
            return {
                allowed: false,
                behavior: 'deny',
                requiresApproval: false,
                explanation: `Tool "${check.tool}" forbidden for role "${check.role}"`,
            };
        }
        // Step 2: 调用 PermissionEngine 进行全局检查
        const permissionInput = {
            tool: check.tool,
            target: check.target,
            sessionId: check.teamId, // 使用 teamId 作为 session 标识
            riskLevel: check.riskLevel || 'medium',
        };
        const decision = this.permissionEngine.evaluate(permissionInput);
        // Step 3: 子代理权限只能更严格
        // 如果 PermissionEngine 允许，但角色禁止 → 拒绝
        // 如果 PermissionEngine 需要审批 → 需要审批（不能绕过）
        return decision;
    }
    /**
     * 验证工具是否在白名单
     */
    validateToolAccess(role, tool) {
        const roleDefaults = types_1.AGENT_ROLE_DEFAULTS[role];
        if (!roleDefaults) {
            return false;
        }
        return (roleDefaults.allowedTools.includes(tool) &&
            !roleDefaults.forbiddenTools.includes(tool));
    }
    /**
     * 获取角色允许的工具列表
     */
    getAllowedTools(role) {
        const roleDefaults = types_1.AGENT_ROLE_DEFAULTS[role];
        if (!roleDefaults) {
            return [];
        }
        return [...roleDefaults.allowedTools];
    }
    /**
     * 获取角色禁止的工具列表
     */
    getForbiddenTools(role) {
        const roleDefaults = types_1.AGENT_ROLE_DEFAULTS[role];
        if (!roleDefaults) {
            return [];
        }
        return [...roleDefaults.forbiddenTools];
    }
}
exports.PermissionBridge = PermissionBridge;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建权限桥接实例
 */
function createPermissionBridge(permissionEngine) {
    return new PermissionBridge(permissionEngine);
}
/**
 * 快速检查工具访问
 */
function canAccessTool(role, tool) {
    const bridge = new PermissionBridge({
        evaluate: () => ({
            allowed: true,
            behavior: 'allow',
            requiresApproval: false,
            explanation: 'Mock',
        }),
    });
    return bridge.validateToolAccess(role, tool);
}
// ============================================================================
// 角色工具矩阵（快速参考）
// ============================================================================
/**
 * 角色工具访问矩阵
 *
 * 用于快速查询和验证
 */
exports.ROLE_TOOL_MATRIX = {
    planner: {
        allowed: ['fs.read', 'fs.list', 'grep.search', 'shell.run'],
        forbidden: ['fs.write', 'fs.delete', 'git.commit', 'git.push'],
        requiresApproval: [],
    },
    repo_reader: {
        allowed: ['fs.read', 'fs.list', 'grep.search', 'repo.map'],
        forbidden: ['fs.write', 'fs.delete', 'shell.run', 'git.commit'],
        requiresApproval: [],
    },
    code_fixer: {
        allowed: ['fs.read', 'fs.write', 'fs.delete', 'grep.search', 'shell.run', 'git.diff'],
        forbidden: ['git.commit', 'git.push'],
        requiresApproval: [],
    },
    code_reviewer: {
        allowed: ['fs.read', 'grep.search', 'git.diff'],
        forbidden: ['fs.write', 'fs.delete', 'shell.run', 'git.commit'],
        requiresApproval: [],
    },
    verify_agent: {
        allowed: ['fs.read', 'fs.list', 'shell.run', 'grep.search'],
        forbidden: ['fs.write', 'fs.delete', 'git.commit'],
        requiresApproval: [],
    },
    release_agent: {
        allowed: ['fs.read', 'fs.write', 'shell.run', 'git.commit', 'git.push'],
        forbidden: [],
        requiresApproval: ['git.push', 'git.commit'],
    },
};
/**
 * 检查工具是否需要审批
 */
function requiresApproval(role, tool) {
    const matrix = exports.ROLE_TOOL_MATRIX[role];
    if (!matrix) {
        return false;
    }
    return matrix.requiresApproval.includes(tool);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbl9icmlkZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL3Blcm1pc3Npb25fYnJpZGdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7OztBQWtLSCx3REFJQztBQUtELHNDQWNDO0FBbURELDRDQU1DO0FBNU9ELG1DQUE4QztBQTJDOUMsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBYSxnQkFBZ0I7SUFHM0IsWUFBWSxnQkFBa0M7UUFDNUMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUE4QjtRQUNsRCxrQkFBa0I7UUFDbEIsTUFBTSxZQUFZLEdBQUcsMkJBQW1CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLE9BQU8sRUFBRSxLQUFLO2dCQUNkLFFBQVEsRUFBRSxNQUFNO2dCQUNoQixnQkFBZ0IsRUFBRSxLQUFLO2dCQUN2QixXQUFXLEVBQUUsdUJBQXVCLEtBQUssQ0FBQyxJQUFJLEVBQUU7YUFDakQsQ0FBQztRQUNKLENBQUM7UUFFRCxhQUFhO1FBQ2IsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3BELE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsUUFBUSxFQUFFLE1BQU07Z0JBQ2hCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLFdBQVcsRUFBRSxTQUFTLEtBQUssQ0FBQyxJQUFJLDJCQUEyQixLQUFLLENBQUMsSUFBSSxHQUFHO2FBQ3pFLENBQUM7UUFDSixDQUFDO1FBRUQsYUFBYTtRQUNiLElBQUksWUFBWSxDQUFDLGNB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QztDQUNGLENBQUM7QUFFRjs7R0FFRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLElBQWtCLEVBQUUsSUFBWTtJQUMvRCxNQUFNLE1BQU0sR0FBRyx3QkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDWixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGVybWlzc2lvbiBCcmlkZ2UgLSDmnYPpmZDmoaXmjqXlsYJcbiAqIFxuICog5bCGIEFnZW50IFRlYW1zIOeahOadg+mZkOivt+axguahpeaOpeWIsCBPcGVuQ2xhdyBQZXJtaXNzaW9uRW5naW5lXG4gKiBcbiAqIOaguOW/g+WOn+WIme+8mlxuICogMS4g5a2Q5Luj55CG5p2D6ZmQ5Y+q6IO9IOKJpCDniLbkuIrkuIvmlofmnYPpmZBcbiAqIDIuIOS4jeWFgeiuuOWtkOS7o+eQhue7lei/h+WuoeaJuVxuICogMy4g5omA5pyJ5p2D6ZmQ5qOA5p+l5Y+v5a6h6K6hXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvbkVuZ2luZSB9IGZyb20gJy4uLy4uL2NvcmUvcnVudGltZS9wZXJtaXNzaW9uX2VuZ2luZSc7XG5pbXBvcnQgdHlwZSB7IFBlcm1pc3Npb25DaGVja0lucHV0LCBQZXJtaXNzaW9uRGVjaXNpb24gfSBmcm9tICcuLi8uLi9jb3JlL3J1bnRpbWUvcGVybWlzc2lvbl90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFN1YmFnZW50RXhlY3V0aW9uQ29udGV4dCB9IGZyb20gJy4vZXhlY3V0aW9uX2NvbnRleHRfYWRhcHRlcic7XG5pbXBvcnQgdHlwZSB7IFN1YmFnZW50Um9sZSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQUdFTlRfUk9MRV9ERUZBVUxUUyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmnYPpmZDmo4Dmn6XovpPlhaXvvIjlrZDku6PnkIbnroDljJbniYjvvIlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdWJhZ2VudFBlcm1pc3Npb25DaGVjayB7XG4gIHN1YmFnZW50VGFza0lkOiBzdHJpbmc7XG4gIHRlYW1JZDogc3RyaW5nO1xuICByb2xlOiBTdWJhZ2VudFJvbGU7XG4gIHRvb2w6IHN0cmluZztcbiAgdGFyZ2V0Pzogc3RyaW5nO1xuICByaXNrTGV2ZWw/OiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnO1xufVxuXG4vKipcbiAqIOadg+mZkOahpeaOpeaOpeWPo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElQZXJtaXNzaW9uQnJpZGdlIHtcbiAgLyoqXG4gICAqIOajgOafpeWtkOS7o+eQhuadg+mZkFxuICAgKi9cbiAgY2hlY2tQZXJtaXNzaW9uKGNoZWNrOiBTdWJhZ2VudFBlcm1pc3Npb25DaGVjayk6IFByb21pc2U8UGVybWlzc2lvbkRlY2lzaW9uPjtcbiAgXG4gIC8qKlxuICAgKiDpqozor4Hlt6XlhbfmmK/lkKblnKjnmb3lkI3ljZVcbiAgICovXG4gIHZhbGlkYXRlVG9vbEFjY2Vzcyhyb2xlOiBTdWJhZ2VudFJvbGUsIHRvb2w6IHN0cmluZyk6IGJvb2xlYW47XG4gIFxuICAvKipcbiAgICog6I635Y+W6KeS6Imy5YWB6K6455qE5bel5YW35YiX6KGoXG4gICAqL1xuICBnZXRBbGxvd2VkVG9vbHMocm9sZTogU3ViYWdlbnRSb2xlKTogc3RyaW5nW107XG4gIFxuICAvKipcbiAgICog6I635Y+W6KeS6Imy56aB5q2i55qE5bel5YW35YiX6KGoXG4gICAqL1xuICBnZXRGb3JiaWRkZW5Ub29scyhyb2xlOiBTdWJhZ2VudFJvbGUpOiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5p2D6ZmQ5qGl5o6l5a6e546wXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBQZXJtaXNzaW9uQnJpZGdlIGltcGxlbWVudHMgSVBlcm1pc3Npb25CcmlkZ2Uge1xuICBwcml2YXRlIHBlcm1pc3Npb25FbmdpbmU6IFBlcm1pc3Npb25FbmdpbmU7XG4gIFxuICBjb25zdHJ1Y3RvcihwZXJtaXNzaW9uRW5naW5lOiBQZXJtaXNzaW9uRW5naW5lKSB7XG4gICAgdGhpcy5wZXJtaXNzaW9uRW5naW5lID0gcGVybWlzc2lvbkVuZ2luZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpeWtkOS7o+eQhuadg+mZkFxuICAgKiBcbiAgICog5rWB56iL77yaXG4gICAqIDEuIOajgOafpeinkuiJsuW3peWFt+eZveWQjeWNlVxuICAgKiAyLiDmo4Dmn6Xop5LoibLlt6Xlhbfpu5HlkI3ljZVcbiAgICogMy4g6LCD55SoIFBlcm1pc3Npb25FbmdpbmUg6L+b6KGM5YWo5bGA5qOA5p+lXG4gICAqL1xuICBhc3luYyBjaGVja1Blcm1pc3Npb24oY2hlY2s6IFN1YmFnZW50UGVybWlzc2lvbkNoZWNrKTogUHJvbWlzZTxQZXJtaXNzaW9uRGVjaXNpb24+IHtcbiAgICAvLyBTdGVwIDE6IOajgOafpeinkuiJsueZveWQjeWNlVxuICAgIGNvbnN0IHJvbGVEZWZhdWx0cyA9IEFHRU5UX1JPTEVfREVGQVVMVFNbY2hlY2sucm9sZV07XG4gICAgaWYgKCFyb2xlRGVmYXVsdHMpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFsbG93ZWQ6IGZhbHNlLFxuICAgICAgICBiZWhhdmlvcjogJ2RlbnknLFxuICAgICAgICByZXF1aXJlc0FwcHJvdmFsOiBmYWxzZSxcbiAgICAgICAgZXhwbGFuYXRpb246IGBVbmtub3duIGFnZW50IHJvbGU6ICR7Y2hlY2sucm9sZX1gLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5Zyo6KeS6Imy55m95ZCN5Y2VXG4gICAgaWYgKCFyb2xlRGVmYXVsdHMuYWxsb3dlZFRvb2xzLmluY2x1ZGVzKGNoZWNrLnRvb2wpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgYmVoYXZpb3I6ICdkZW55JyxcbiAgICAgICAgcmVxdWlyZXNBcHByb3ZhbDogZmFsc2UsXG4gICAgICAgIGV4cGxhbmF0aW9uOiBgVG9vbCBcIiR7Y2hlY2sudG9vbH1cIiBub3QgYWxsb3dlZCBmb3Igcm9sZSBcIiR7Y2hlY2sucm9sZX1cImAsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmmK/lkKblnKjop5LoibLpu5HlkI3ljZVcbiAgICBpZiAocm9sZURlZmF1bHRzLmZvcmJpZGRlblRvb2xzLmluY2x1ZGVzKGNoZWNrLnRvb2wpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgYmVoYXZpb3I6ICdkZW55JyxcbiAgICAgICAgcmVxdWlyZXNBcHByb3ZhbDogZmFsc2UsXG4gICAgICAgIGV4cGxhbmF0aW9uOiBgVG9vbCBcIiR7Y2hlY2sudG9vbH1cIiBmb3JiaWRkZW4gZm9yIHJvbGUgXCIke2NoZWNrLnJvbGV9XCJgLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RlcCAyOiDosIPnlKggUGVybWlzc2lvbkVuZ2luZSDov5vooYzlhajlsYDmo4Dmn6VcbiAgICBjb25zdCBwZXJtaXNzaW9uSW5wdXQ6IFBlcm1pc3Npb25DaGVja0lucHV0ID0ge1xuICAgICAgdG9vbDogY2hlY2sudG9vbCxcbiAgICAgIHRhcmdldDogY2hlY2sudGFyZ2V0LFxuICAgICAgc2Vzc2lvbklkOiBjaGVjay50ZWFtSWQsIC8vIOS9v+eUqCB0ZWFtSWQg5L2c5Li6IHNlc3Npb24g5qCH6K+GXG4gICAgICByaXNrTGV2ZWw6IGNoZWNrLnJpc2tMZXZlbCB8fCAnbWVkaXVtJyxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IGRlY2lzaW9uID0gdGhpcy5wZXJtaXNzaW9uRW5naW5lLmV2YWx1YXRlKHBlcm1pc3Npb25JbnB1dCk7XG4gICAgXG4gICAgLy8gU3RlcCAzOiDlrZDku6PnkIbmnYPpmZDlj6rog73mm7TkuKXmoLxcbiAgICAvLyDlpoLmnpwgUGVybWlzc2lvbkVuZ2luZSDlhYHorrjvvIzkvYbop5LoibLnpoHmraIg4oaSIOaLkue7nVxuICAgIC8vIOWmguaenCBQZXJtaXNzaW9uRW5naW5lIOmcgOimgeWuoeaJuSDihpIg6ZyA6KaB5a6h5om577yI5LiN6IO957uV6L+H77yJXG4gICAgXG4gICAgcmV0dXJuIGRlY2lzaW9uO1xuICB9XG4gIFxuICAvKipcbiAgICog6aqM6K+B5bel5YW35piv5ZCm5Zyo55m95ZCN5Y2VXG4gICAqL1xuICB2YWxpZGF0ZVRvb2xBY2Nlc3Mocm9sZTogU3ViYWdlbnRSb2xlLCB0b29sOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCByb2xlRGVmYXVsdHMgPSBBR0VOVF9ST0xFX0RFRkFVTFRTW3JvbGVdO1xuICAgIGlmICghcm9sZURlZmF1bHRzKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiAoXG4gICAgICByb2xlRGVmYXVsdHMuYWxsb3dlZFRvb2xzLmluY2x1ZGVzKHRvb2wpICYmXG4gICAgICAhcm9sZURlZmF1bHRzLmZvcmJpZGRlblRvb2xzLmluY2x1ZGVzKHRvb2wpXG4gICAgKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluinkuiJsuWFgeiuuOeahOW3peWFt+WIl+ihqFxuICAgKi9cbiAgZ2V0QWxsb3dlZFRvb2xzKHJvbGU6IFN1YmFnZW50Um9sZSk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCByb2xlRGVmYXVsdHMgPSBBR0VOVF9ST0xFX0RFRkFVTFRTW3JvbGVdO1xuICAgIGlmICghcm9sZURlZmF1bHRzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBbLi4ucm9sZURlZmF1bHRzLmFsbG93ZWRUb29sc107XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bop5LoibLnpoHmraLnmoTlt6XlhbfliJfooahcbiAgICovXG4gIGdldEZvcmJpZGRlblRvb2xzKHJvbGU6IFN1YmFnZW50Um9sZSk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCByb2xlRGVmYXVsdHMgPSBBR0VOVF9ST0xFX0RFRkFVTFRTW3JvbGVdO1xuICAgIGlmICghcm9sZURlZmF1bHRzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBbLi4ucm9sZURlZmF1bHRzLmZvcmJpZGRlblRvb2xzXTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rmnYPpmZDmoaXmjqXlrp7kvotcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBlcm1pc3Npb25CcmlkZ2UoXG4gIHBlcm1pc3Npb25FbmdpbmU6IFBlcm1pc3Npb25FbmdpbmVcbik6IElQZXJtaXNzaW9uQnJpZGdlIHtcbiAgcmV0dXJuIG5ldyBQZXJtaXNzaW9uQnJpZGdlKHBlcm1pc3Npb25FbmdpbmUpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ajgOafpeW3peWFt+iuv+mXrlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2FuQWNjZXNzVG9vbChcbiAgcm9sZTogU3ViYWdlbnRSb2xlLFxuICB0b29sOiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBjb25zdCBicmlkZ2UgPSBuZXcgUGVybWlzc2lvbkJyaWRnZSh7XG4gICAgZXZhbHVhdGU6ICgpID0+ICh7XG4gICAgICBhbGxvd2VkOiB0cnVlLFxuICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gICAgICByZXF1aXJlc0FwcHJvdmFsOiBmYWxzZSxcbiAgICAgIGV4cGxhbmF0aW9uOiAnTW9jaycsXG4gICAgfSksXG4gIH0gYXMgYW55KTtcbiAgXG4gIHJldHVybiBicmlkZ2UudmFsaWRhdGVUb29sQWNjZXNzKHJvbGUsIHRvb2wpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDop5LoibLlt6Xlhbfnn6npmLXvvIjlv6vpgJ/lj4LogIPvvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDop5LoibLlt6Xlhbforr/pl67nn6npmLVcbiAqIFxuICog55So5LqO5b+r6YCf5p+l6K+i5ZKM6aqM6K+BXG4gKi9cbmV4cG9ydCBjb25zdCBST0xFX1RPT0xfTUFUUklYOiBSZWNvcmQ8U3ViYWdlbnRSb2xlLCB7XG4gIGFsbG93ZWQ6IHN0cmluZ1tdO1xuICBmb3JiaWRkZW46IHN0cmluZ1tdO1xuICByZXF1aXJlc0FwcHJvdmFsOiBzdHJpbmdbXTtcbn0+ID0ge1xuICBwbGFubmVyOiB7XG4gICAgYWxsb3dlZDogWydmcy5yZWFkJywgJ2ZzLmxpc3QnLCAnZ3JlcC5zZWFyY2gnLCAnc2hlbGwucnVuJ10sXG4gICAgZm9yYmlkZGVuOiBbJ2ZzLndyaXRlJywgJ2ZzLmRlbGV0ZScsICdnaXQuY29tbWl0JywgJ2dpdC5wdXNoJ10sXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogW10sXG4gIH0sXG4gIHJlcG9fcmVhZGVyOiB7XG4gICAgYWxsb3dlZDogWydmcy5yZWFkJywgJ2ZzLmxpc3QnLCAnZ3JlcC5zZWFyY2gnLCAncmVwby5tYXAnXSxcbiAgICBmb3JiaWRkZW46IFsnZnMud3JpdGUnLCAnZnMuZGVsZXRlJywgJ3NoZWxsLnJ1bicsICdnaXQuY29tbWl0J10sXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogW10sXG4gIH0sXG4gIGNvZGVfZml4ZXI6IHtcbiAgICBhbGxvd2VkOiBbJ2ZzLnJlYWQnLCAnZnMud3JpdGUnLCAnZnMuZGVsZXRlJywgJ2dyZXAuc2VhcmNoJywgJ3NoZWxsLnJ1bicsICdnaXQuZGlmZiddLFxuICAgIGZvcmJpZGRlbjogWydnaXQuY29tbWl0JywgJ2dpdC5wdXNoJ10sXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogW10sXG4gIH0sXG4gIGNvZGVfcmV2aWV3ZXI6IHtcbiAgICBhbGxvd2VkOiBbJ2ZzLnJlYWQnLCAnZ3JlcC5zZWFyY2gnLCAnZ2l0LmRpZmYnXSxcbiAgICBmb3JiaWRkZW46IFsnZnMud3JpdGUnLCAnZnMuZGVsZXRlJywgJ3NoZWxsLnJ1bicsICdnaXQuY29tbWl0J10sXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogW10sXG4gIH0sXG4gIHZlcmlmeV9hZ2VudDoge1xuICAgIGFsbG93ZWQ6IFsnZnMucmVhZCcsICdmcy5saXN0JywgJ3NoZWxsLnJ1bicsICdncmVwLnNlYXJjaCddLFxuICAgIGZvcmJpZGRlbjogWydmcy53cml0ZScsICdmcy5kZWxldGUnLCAnZ2l0LmNvbW1pdCddLFxuICAgIHJlcXVpcmVzQXBwcm92YWw6IFtdLFxuICB9LFxuICByZWxlYXNlX2FnZW50OiB7XG4gICAgYWxsb3dlZDogWydmcy5yZWFkJywgJ2ZzLndyaXRlJywgJ3NoZWxsLnJ1bicsICdnaXQuY29tbWl0JywgJ2dpdC5wdXNoJ10sXG4gICAgZm9yYmlkZGVuOiBbXSxcbiAgICByZXF1aXJlc0FwcHJvdmFsOiBbJ2dpdC5wdXNoJywgJ2dpdC5jb21taXQnXSxcbiAgfSxcbn07XG5cbi8qKlxuICog5qOA5p+l5bel5YW35piv5ZCm6ZyA6KaB5a6h5om5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlc0FwcHJvdmFsKHJvbGU6IFN1YmFnZW50Um9sZSwgdG9vbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IG1hdHJpeCA9IFJPTEVfVE9PTF9NQVRSSVhbcm9sZV07XG4gIGlmICghbWF0cml4KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiBtYXRyaXgucmVxdWlyZXNBcHByb3ZhbC5pbmNsdWRlcyh0b29sKTtcbn1cbiJdfQ==