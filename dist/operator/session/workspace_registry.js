"use strict";
/**
 * Workspace Registry
 * Phase 2A-2A - Workspace 注册表
 *
 * 职责：
 * - 管理可用 Workspace
 * - 提供默认 Workspace
 * - 支持查询 / 枚举
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryWorkspaceRegistry = void 0;
exports.createWorkspaceRegistry = createWorkspaceRegistry;
// ============================================================================
// 内存实现
// ============================================================================
class InMemoryWorkspaceRegistry {
    constructor(config = {}) {
        this.workspaces = new Map();
        this.config = {
            defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
        };
        // 注册默认 Workspaces
        this.registerDefaultWorkspaces();
    }
    async registerWorkspace(workspace) {
        this.workspaces.set(workspace.workspaceId, workspace);
    }
    async getWorkspace(workspaceId) {
        return this.workspaces.get(workspaceId) || null;
    }
    async listWorkspaces() {
        return Array.from(this.workspaces.values())
            .sort((a, b) => {
            // 默认 Workspace 排前面
            if (a.isDefault)
                return -1;
            if (b.isDefault)
                return 1;
            // 按名称排序
            return a.name.localeCompare(b.name);
        });
    }
    async getDefaultWorkspace() {
        // 优先返回标记为默认的
        const defaultWorkspace = Array.from(this.workspaces.values())
            .find(w => w.isDefault);
        if (defaultWorkspace) {
            return defaultWorkspace;
        }
        // 其次返回配置的默认 ID
        const configuredDefault = this.workspaces.get(this.config.defaultWorkspaceId);
        if (configuredDefault) {
            return configuredDefault;
        }
        // 最后返回第一个
        const workspaces = Array.from(this.workspaces.values());
        return workspaces.length > 0 ? workspaces[0] : null;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    registerDefaultWorkspaces() {
        // 本地默认 Workspace
        this.workspaces.set('local-default', {
            workspaceId: 'local-default',
            name: '本地默认',
            description: '本地开发环境默认 Workspace',
            environment: 'local',
            isDefault: true,
            metadata: {
                createdAt: Date.now(),
            },
        });
        // 演示 Workspace
        this.workspaces.set('demo-default', {
            workspaceId: 'demo-default',
            name: '演示环境',
            description: '演示/测试环境 Workspace',
            environment: 'demo',
            metadata: {
                createdAt: Date.now(),
            },
        });
        // 生产环境 Workspace（可选）
        this.workspaces.set('production', {
            workspaceId: 'production',
            name: '生产环境',
            description: '生产环境 Workspace',
            environment: 'production',
            metadata: {
                createdAt: Date.now(),
            },
        });
    }
    // ============================================================================
    // 测试辅助方法
    // ============================================================================
    /**
     * 清除所有 Workspaces
     */
    clear() {
        this.workspaces.clear();
        this.registerDefaultWorkspaces();
    }
    /**
     * 获取 Workspaces 数量
     */
    size() {
        return this.workspaces.size;
    }
}
exports.InMemoryWorkspaceRegistry = InMemoryWorkspaceRegistry;
// ============================================================================
// 工厂函数
// ============================================================================
function createWorkspaceRegistry(config) {
    return new InMemoryWorkspaceRegistry(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlX3JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL29wZXJhdG9yL3Nlc3Npb24vd29ya3NwYWNlX3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBc0lILDBEQUVDO0FBM0hELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEseUJBQXlCO0lBSXBDLFlBQVksU0FBa0MsRUFBRTtRQUZ4QyxlQUFVLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFHL0QsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxlQUFlO1NBQ2pFLENBQUM7UUFFRixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxTQUE4QjtRQUNwRCxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxLQUFLLENBQUMsWUFBWSxDQUFDLFdBQW1CO1FBQ3BDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ2xELENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYztRQUNsQixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQzthQUN4QyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDYixtQkFBbUI7WUFDbkIsSUFBSSxDQUFDLENBQUMsU0FBUztnQkFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxDQUFDLFNBQVM7Z0JBQUUsT0FBTyxDQUFDLENBQUM7WUFF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a3NwYWNlIFJlZ2lzdHJ5XG4gKiBQaGFzZSAyQS0yQSAtIFdvcmtzcGFjZSDms6jlhozooahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOeuoeeQhuWPr+eUqCBXb3Jrc3BhY2VcbiAqIC0g5o+Q5L6b6buY6K6kIFdvcmtzcGFjZVxuICogLSDmlK/mjIHmn6Xor6IgLyDmnprkuL5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFdvcmtzcGFjZURlc2NyaXB0b3IsIFdvcmtzcGFjZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vdHlwZXMvc2Vzc2lvbl90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtzcGFjZVJlZ2lzdHJ5Q29uZmlnIHtcbiAgLyoqIOm7mOiupCBXb3Jrc3BhY2UgSUQgKi9cbiAgZGVmYXVsdFdvcmtzcGFjZUlkPzogc3RyaW5nO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlhoXlrZjlrp7njrBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEluTWVtb3J5V29ya3NwYWNlUmVnaXN0cnkgaW1wbGVtZW50cyBXb3Jrc3BhY2VSZWdpc3RyeSB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxXb3Jrc3BhY2VSZWdpc3RyeUNvbmZpZz47XG4gIHByaXZhdGUgd29ya3NwYWNlczogTWFwPHN0cmluZywgV29ya3NwYWNlRGVzY3JpcHRvcj4gPSBuZXcgTWFwKCk7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFdvcmtzcGFjZVJlZ2lzdHJ5Q29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGRlZmF1bHRXb3Jrc3BhY2VJZDogY29uZmlnLmRlZmF1bHRXb3Jrc3BhY2VJZCA/PyAnbG9jYWwtZGVmYXVsdCcsXG4gICAgfTtcbiAgICBcbiAgICAvLyDms6jlhozpu5jorqQgV29ya3NwYWNlc1xuICAgIHRoaXMucmVnaXN0ZXJEZWZhdWx0V29ya3NwYWNlcygpO1xuICB9XG4gIFxuICBhc3luYyByZWdpc3RlcldvcmtzcGFjZSh3b3Jrc3BhY2U6IFdvcmtzcGFjZURlc2NyaXB0b3IpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLndvcmtzcGFjZXMuc2V0KHdvcmtzcGFjZS53b3Jrc3BhY2VJZCwgd29ya3NwYWNlKTtcbiAgfVxuICBcbiAgYXN5bmMgZ2V0V29ya3NwYWNlKHdvcmtzcGFjZUlkOiBzdHJpbmcpOiBQcm9taXNlPFdvcmtzcGFjZURlc2NyaXB0b3IgfCBudWxsPiB7XG4gICAgcmV0dXJuIHRoaXMud29ya3NwYWNlcy5nZXQod29ya3NwYWNlSWQpIHx8IG51bGw7XG4gIH1cbiAgXG4gIGFzeW5jIGxpc3RXb3Jrc3BhY2VzKCk6IFByb21pc2U8V29ya3NwYWNlRGVzY3JpcHRvcltdPiB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy53b3Jrc3BhY2VzLnZhbHVlcygpKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgLy8g6buY6K6kIFdvcmtzcGFjZSDmjpLliY3pnaJcbiAgICAgICAgaWYgKGEuaXNEZWZhdWx0KSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChiLmlzRGVmYXVsdCkgcmV0dXJuIDE7XG4gICAgICAgIFxuICAgICAgICAvLyDmjInlkI3np7DmjpLluo9cbiAgICAgICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG4gICAgICB9KTtcbiAgfVxuICBcbiAgYXN5bmMgZ2V0RGVmYXVsdFdvcmtzcGFjZSgpOiBQcm9taXNlPFdvcmtzcGFjZURlc2NyaXB0b3IgfCBudWxsPiB7XG4gICAgLy8g5LyY5YWI6L+U5Zue5qCH6K6w5Li66buY6K6k55qEXG4gICAgY29uc3QgZGVmYXVsdFdvcmtzcGFjZSA9IEFycmF5LmZyb20odGhpcy53b3Jrc3BhY2VzLnZhbHVlcygpKVxuICAgICAgLmZpbmQodyA9PiB3LmlzRGVmYXVsdCk7XG4gICAgXG4gICAgaWYgKGRlZmF1bHRXb3Jrc3BhY2UpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0V29ya3NwYWNlO1xuICAgIH1cbiAgICBcbiAgICAvLyDlhbbmrKHov5Tlm57phY3nva7nmoTpu5jorqQgSURcbiAgICBjb25zdCBjb25maWd1cmVkRGVmYXVsdCA9IHRoaXMud29ya3NwYWNlcy5nZXQodGhpcy5jb25maWcuZGVmYXVsdFdvcmtzcGFjZUlkKTtcbiAgICBpZiAoY29uZmlndXJlZERlZmF1bHQpIHtcbiAgICAgIHJldHVybiBjb25maWd1cmVkRGVmYXVsdDtcbiAgICB9XG4gICAgXG4gICAgLy8g5pyA5ZCO6L+U5Zue56ys5LiA5LiqXG4gICAgY29uc3Qgd29ya3NwYWNlcyA9IEFycmF5LmZyb20odGhpcy53b3Jrc3BhY2VzLnZhbHVlcygpKTtcbiAgICByZXR1cm4gd29ya3NwYWNlcy5sZW5ndGggPiAwID8gd29ya3NwYWNlc1swXSA6IG51bGw7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIHByaXZhdGUgcmVnaXN0ZXJEZWZhdWx0V29ya3NwYWNlcygpOiB2b2lkIHtcbiAgICAvLyDmnKzlnLDpu5jorqQgV29ya3NwYWNlXG4gICAgdGhpcy53b3Jrc3BhY2VzLnNldCgnbG9jYWwtZGVmYXVsdCcsIHtcbiAgICAgIHdvcmtzcGFjZUlkOiAnbG9jYWwtZGVmYXVsdCcsXG4gICAgICBuYW1lOiAn5pys5Zyw6buY6K6kJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAn5pys5Zyw5byA5Y+R546v5aKD6buY6K6kIFdvcmtzcGFjZScsXG4gICAgICBlbnZpcm9ubWVudDogJ2xvY2FsJyxcbiAgICAgIGlzRGVmYXVsdDogdHJ1ZSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGNyZWF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8g5ryU56S6IFdvcmtzcGFjZVxuICAgIHRoaXMud29ya3NwYWNlcy5zZXQoJ2RlbW8tZGVmYXVsdCcsIHtcbiAgICAgIHdvcmtzcGFjZUlkOiAnZGVtby1kZWZhdWx0JyxcbiAgICAgIG5hbWU6ICfmvJTnpLrnjq/looMnLFxuICAgICAgZGVzY3JpcHRpb246ICfmvJTnpLov5rWL6K+V546v5aKDIFdvcmtzcGFjZScsXG4gICAgICBlbnZpcm9ubWVudDogJ2RlbW8nLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyDnlJ/kuqfnjq/looMgV29ya3NwYWNl77yI5Y+v6YCJ77yJXG4gICAgdGhpcy53b3Jrc3BhY2VzLnNldCgncHJvZHVjdGlvbicsIHtcbiAgICAgIHdvcmtzcGFjZUlkOiAncHJvZHVjdGlvbicsXG4gICAgICBuYW1lOiAn55Sf5Lqn546v5aKDJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAn55Sf5Lqn546v5aKDIFdvcmtzcGFjZScsXG4gICAgICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDmtYvor5XovoXliqnmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOa4hemZpOaJgOaciSBXb3Jrc3BhY2VzXG4gICAqL1xuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLndvcmtzcGFjZXMuY2xlYXIoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVmYXVsdFdvcmtzcGFjZXMoKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPliBXb3Jrc3BhY2VzIOaVsOmHj1xuICAgKi9cbiAgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLndvcmtzcGFjZXMuc2l6ZTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVdvcmtzcGFjZVJlZ2lzdHJ5KGNvbmZpZz86IFdvcmtzcGFjZVJlZ2lzdHJ5Q29uZmlnKTogV29ya3NwYWNlUmVnaXN0cnkge1xuICByZXR1cm4gbmV3IEluTWVtb3J5V29ya3NwYWNlUmVnaXN0cnkoY29uZmlnKTtcbn1cbiJdfQ==