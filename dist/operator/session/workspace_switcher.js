"use strict";
/**
 * Workspace Switcher
 * Phase 2A-2A - Workspace 切换器
 *
 * 职责：
 * - 校验 Workspace 是否存在
 * - 更新 Session 的 workspaceId
 * - 重置 Navigation State
 * - 返回切换结果
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultWorkspaceSwitcher = void 0;
exports.createWorkspaceSwitcher = createWorkspaceSwitcher;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultWorkspaceSwitcher {
    constructor(sessionStore, workspaceRegistry, config = {}) {
        this.config = {
            resetNavigationOnSwitch: config.resetNavigationOnSwitch ?? true,
        };
        this.sessionStore = sessionStore;
        this.workspaceRegistry = workspaceRegistry;
    }
    async switchWorkspace(sessionId, workspaceId) {
        const now = Date.now();
        // 1. 获取当前 Session
        const session = await this.sessionStore.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // 2. 校验 Workspace 是否存在
        const workspace = await this.workspaceRegistry.getWorkspace(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        // 3. 记录之前的 Workspace
        const previousWorkspaceId = session.workspaceId;
        // 4. 检查是否实际切换
        const changed = previousWorkspaceId !== workspaceId;
        // 5. 更新 Session
        session.workspaceId = workspaceId;
        session.updatedAt = now;
        // 6. 重置 Navigation State（如果配置）
        if (this.config.resetNavigationOnSwitch && changed) {
            session.navigationState = this.resetNavigationState(session.navigationState);
        }
        // 7. 保存 Session
        await this.sessionStore.saveSession(session);
        // 8. 返回结果
        return {
            session,
            previousWorkspaceId,
            currentWorkspaceId: workspaceId,
            changed,
            switchedAt: now,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 重置 Navigation State
     */
    resetNavigationState(currentState) {
        return {
            currentView: 'dashboard',
            lastCommandAt: Date.now(),
            // 清空选择状态
            selectedItemId: undefined,
            selectedTargetType: undefined,
            previousView: undefined,
            // 清空过滤/排序
            mode: undefined,
            filter: undefined,
            sort: undefined,
            page: undefined,
            pageSize: undefined,
        };
    }
}
exports.DefaultWorkspaceSwitcher = DefaultWorkspaceSwitcher;
// ============================================================================
// 工厂函数
// ============================================================================
function createWorkspaceSwitcher(sessionStore, workspaceRegistry, config) {
    return new DefaultWorkspaceSwitcher(sessionStore, workspaceRegistry, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlX3N3aXRjaGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL29wZXJhdG9yL3Nlc3Npb24vd29ya3NwYWNlX3N3aXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7OztBQXVISCwwREFVQztBQTdHRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxNQUFhLHdCQUF3QjtJQUtuQyxZQUNFLFlBQTBCLEVBQzFCLGlCQUFvQyxFQUNwQyxTQUFrQyxFQUFFO1FBRXBDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWix1QkFBdUIsRUFBRSxNQUFNLENBQUMsdUJBQXVCLElBQUksSUFBSTtTQUNoRSxDQUFDO1FBRUYsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO0lBQzdDLENBQUM7SUFFRCxLQUFLLENBQUMsZUFBZSxDQUNuQixTQUFpQixFQUNqQixXQUFtQjtRQUVuQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFdkIsa0JBQWtCO1FBQ2xCLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQsdUJBQXVCO1FBQ3ZCLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV6RSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxxQkFBcUI7UUFDckIsTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO1FBRWhELGNBQWM7UUFDZCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsS0FBSyxXQUFXLENBQUM7UUFFcEQsZ0JBQWdCO1FBQ2hCLE9BQU8sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQ2xDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDO1FBRXhCLCtCQUErQjtRQUMvQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQXVCLElBQUksT0FBTyxFQUFFLENBQUM7WUFDbkQsT0FBTyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCxnQkFBZ0I7UUFDaEIsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU3QyxVQUFVO1FBQ1YsT0FBTztZQUNMLE9BQU87WUFDUCxtQkFBbUI7WUFDbkIsa0JBQWtCLEVBQUUsV0FBVztZQUMvQixPQUFPO1lBQ1AsVUFBVSxFQUFFLEdBQUc7U0FDaEIsQ0FBQztJQUNKLENBQUM7SUFFRCwrRUFBK0U7SUFDL0UsT0FBTztJQUNQLCtFQUErRTtJQUUvRTs7T0FFRztJQUNLLG9CQUFvQixDQUFDLFlBQWlCO1FBQzVDLE9BQU87WUFDTCxXQUFXLEVBQUUsV0FBVztZQUN4QixhQUFhLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUN6QixTQUFTO1lBQ1QsY0FBYyxFQUFFLFNBQVM7WUFDekIsa0JBQWtCLEVBQUUsU0FBUztZQUM3QixZQUFZLEVBQUUsU0FBUztZQUN2QixVQUFVO1lBQ1YsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsU0FBUztZQUNqQixJQUFJLEVBQUUsU0FBUztZQUNmLElBQUksRUFBRSxTQUFTO1lBQ2YsUUFBUSxFQUFFLFNBQVM7U0FDcEIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXpGRCw0REF5RkM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxTQUFnQix1QkFBdUIsQ0FDckMsWUFBMEIsRUFDMUIsaUJBQW9DLEVBQ3BDLE1BQWdDO0lBRWhDLE9BQU8sSUFBSSx3QkFBd0IsQ0FDakMsWUFBWSxFQUNaLGlCQUFpQixFQUNqQixNQUFNLENBQ1AsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdvcmtzcGFjZSBTd2l0Y2hlclxuICogUGhhc2UgMkEtMkEgLSBXb3Jrc3BhY2Ug5YiH5o2i5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDmoKHpqowgV29ya3NwYWNlIOaYr+WQpuWtmOWcqFxuICogLSDmm7TmlrAgU2Vzc2lvbiDnmoQgd29ya3NwYWNlSWRcbiAqIC0g6YeN572uIE5hdmlnYXRpb24gU3RhdGVcbiAqIC0g6L+U5Zue5YiH5o2i57uT5p6cXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBPcGVyYXRvclNlc3Npb24sXG4gIFdvcmtzcGFjZURlc2NyaXB0b3IsXG4gIFdvcmtzcGFjZVN3aXRjaFJlc3VsdCxcbiAgV29ya3NwYWNlU3dpdGNoZXIsXG59IGZyb20gJy4uL3R5cGVzL3Nlc3Npb25fdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBTZXNzaW9uU3RvcmUgfSBmcm9tICcuLi90eXBlcy9zZXNzaW9uX3R5cGVzJztcbmltcG9ydCB0eXBlIHsgV29ya3NwYWNlUmVnaXN0cnkgfSBmcm9tICcuLi90eXBlcy9zZXNzaW9uX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ya3NwYWNlU3dpdGNoZXJDb25maWcge1xuICAvKiog5YiH5o2i5pe25piv5ZCm6YeN572uIE5hdmlnYXRpb24gU3RhdGUgKi9cbiAgcmVzZXROYXZpZ2F0aW9uT25Td2l0Y2g/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpu5jorqTlrp7njrBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRXb3Jrc3BhY2VTd2l0Y2hlciBpbXBsZW1lbnRzIFdvcmtzcGFjZVN3aXRjaGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFdvcmtzcGFjZVN3aXRjaGVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBzZXNzaW9uU3RvcmU6IFNlc3Npb25TdG9yZTtcbiAgcHJpdmF0ZSB3b3Jrc3BhY2VSZWdpc3RyeTogV29ya3NwYWNlUmVnaXN0cnk7XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICBzZXNzaW9uU3RvcmU6IFNlc3Npb25TdG9yZSxcbiAgICB3b3Jrc3BhY2VSZWdpc3RyeTogV29ya3NwYWNlUmVnaXN0cnksXG4gICAgY29uZmlnOiBXb3Jrc3BhY2VTd2l0Y2hlckNvbmZpZyA9IHt9XG4gICkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgcmVzZXROYXZpZ2F0aW9uT25Td2l0Y2g6IGNvbmZpZy5yZXNldE5hdmlnYXRpb25PblN3aXRjaCA/PyB0cnVlLFxuICAgIH07XG4gICAgXG4gICAgdGhpcy5zZXNzaW9uU3RvcmUgPSBzZXNzaW9uU3RvcmU7XG4gICAgdGhpcy53b3Jrc3BhY2VSZWdpc3RyeSA9IHdvcmtzcGFjZVJlZ2lzdHJ5O1xuICB9XG4gIFxuICBhc3luYyBzd2l0Y2hXb3Jrc3BhY2UoXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgd29ya3NwYWNlSWQ6IHN0cmluZ1xuICApOiBQcm9taXNlPFdvcmtzcGFjZVN3aXRjaFJlc3VsdD4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8gMS4g6I635Y+W5b2T5YmNIFNlc3Npb25cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5zZXNzaW9uU3RvcmUuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgIFxuICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXNzaW9uIG5vdCBmb3VuZDogJHtzZXNzaW9uSWR9YCk7XG4gICAgfVxuICAgIFxuICAgIC8vIDIuIOagoemqjCBXb3Jrc3BhY2Ug5piv5ZCm5a2Y5ZyoXG4gICAgY29uc3Qgd29ya3NwYWNlID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VSZWdpc3RyeS5nZXRXb3Jrc3BhY2Uod29ya3NwYWNlSWQpO1xuICAgIFxuICAgIGlmICghd29ya3NwYWNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFdvcmtzcGFjZSBub3QgZm91bmQ6ICR7d29ya3NwYWNlSWR9YCk7XG4gICAgfVxuICAgIFxuICAgIC8vIDMuIOiusOW9leS5i+WJjeeahCBXb3Jrc3BhY2VcbiAgICBjb25zdCBwcmV2aW91c1dvcmtzcGFjZUlkID0gc2Vzc2lvbi53b3Jrc3BhY2VJZDtcbiAgICBcbiAgICAvLyA0LiDmo4Dmn6XmmK/lkKblrp7pmYXliIfmjaJcbiAgICBjb25zdCBjaGFuZ2VkID0gcHJldmlvdXNXb3Jrc3BhY2VJZCAhPT0gd29ya3NwYWNlSWQ7XG4gICAgXG4gICAgLy8gNS4g5pu05pawIFNlc3Npb25cbiAgICBzZXNzaW9uLndvcmtzcGFjZUlkID0gd29ya3NwYWNlSWQ7XG4gICAgc2Vzc2lvbi51cGRhdGVkQXQgPSBub3c7XG4gICAgXG4gICAgLy8gNi4g6YeN572uIE5hdmlnYXRpb24gU3RhdGXvvIjlpoLmnpzphY3nva7vvIlcbiAgICBpZiAodGhpcy5jb25maWcucmVzZXROYXZpZ2F0aW9uT25Td2l0Y2ggJiYgY2hhbmdlZCkge1xuICAgICAgc2Vzc2lvbi5uYXZpZ2F0aW9uU3RhdGUgPSB0aGlzLnJlc2V0TmF2aWdhdGlvblN0YXRlKHNlc3Npb24ubmF2aWdhdGlvblN0YXRlKTtcbiAgICB9XG4gICAgXG4gICAgLy8gNy4g5L+d5a2YIFNlc3Npb25cbiAgICBhd2FpdCB0aGlzLnNlc3Npb25TdG9yZS5zYXZlU2Vzc2lvbihzZXNzaW9uKTtcbiAgICBcbiAgICAvLyA4LiDov5Tlm57nu5PmnpxcbiAgICByZXR1cm4ge1xuICAgICAgc2Vzc2lvbixcbiAgICAgIHByZXZpb3VzV29ya3NwYWNlSWQsXG4gICAgICBjdXJyZW50V29ya3NwYWNlSWQ6IHdvcmtzcGFjZUlkLFxuICAgICAgY2hhbmdlZCxcbiAgICAgIHN3aXRjaGVkQXQ6IG5vdyxcbiAgICB9O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog6YeN572uIE5hdmlnYXRpb24gU3RhdGVcbiAgICovXG4gIHByaXZhdGUgcmVzZXROYXZpZ2F0aW9uU3RhdGUoY3VycmVudFN0YXRlOiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB7XG4gICAgICBjdXJyZW50VmlldzogJ2Rhc2hib2FyZCcsXG4gICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgLy8g5riF56m66YCJ5oup54q25oCBXG4gICAgICBzZWxlY3RlZEl0ZW1JZDogdW5kZWZpbmVkLFxuICAgICAgc2VsZWN0ZWRUYXJnZXRUeXBlOiB1bmRlZmluZWQsXG4gICAgICBwcmV2aW91c1ZpZXc6IHVuZGVmaW5lZCxcbiAgICAgIC8vIOa4heepuui/h+a7pC/mjpLluo9cbiAgICAgIG1vZGU6IHVuZGVmaW5lZCxcbiAgICAgIGZpbHRlcjogdW5kZWZpbmVkLFxuICAgICAgc29ydDogdW5kZWZpbmVkLFxuICAgICAgcGFnZTogdW5kZWZpbmVkLFxuICAgICAgcGFnZVNpemU6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV29ya3NwYWNlU3dpdGNoZXIoXG4gIHNlc3Npb25TdG9yZTogU2Vzc2lvblN0b3JlLFxuICB3b3Jrc3BhY2VSZWdpc3RyeTogV29ya3NwYWNlUmVnaXN0cnksXG4gIGNvbmZpZz86IFdvcmtzcGFjZVN3aXRjaGVyQ29uZmlnXG4pOiBXb3Jrc3BhY2VTd2l0Y2hlciB7XG4gIHJldHVybiBuZXcgRGVmYXVsdFdvcmtzcGFjZVN3aXRjaGVyKFxuICAgIHNlc3Npb25TdG9yZSxcbiAgICB3b3Jrc3BhY2VSZWdpc3RyeSxcbiAgICBjb25maWdcbiAgKTtcbn1cbiJdfQ==