"use strict";
/**
 * Operator Command Dispatch
 * Phase 2A-1 - 命令分发层
 *
 * 职责：
 * - 接受统一 OperatorCommand
 * - 映射到：view action / control action / hitl action / navigation action
 * - 返回 OperatorCommandResult
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHASE_2A1_MINIMAL_COMMANDS = exports.COMMAND_REGISTRY = void 0;
exports.COMMAND_REGISTRY = {
    // View 类
    view_dashboard: {
        category: "view",
        targetType: "dashboard",
        handler: "surfaceService.getDashboardView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_tasks: {
        category: "view",
        targetType: "task",
        handler: "surfaceService.getTaskView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_approvals: {
        category: "view",
        targetType: "approval",
        handler: "surfaceService.getApprovalView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_incidents: {
        category: "view",
        targetType: "incident",
        handler: "surfaceService.getIncidentView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_agents: {
        category: "view",
        targetType: "agent",
        handler: "surfaceService.getAgentView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_inbox: {
        category: "view",
        targetType: "inbox",
        handler: "surfaceService.getInboxView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_interventions: {
        category: "view",
        targetType: "intervention",
        handler: "surfaceService.getInterventionView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    view_history: {
        category: "view",
        targetType: "history",
        handler: "surfaceService.getHistoryView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    open_item: {
        category: "view",
        targetType: "any",
        handler: "surfaceService.getItemDetailView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    refresh: {
        category: "view",
        targetType: "current",
        handler: "surfaceService.getView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    // Control 类
    approve: {
        category: "control",
        targetType: "approval",
        handler: "control/hitl approve flow",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    reject: {
        category: "control",
        targetType: "approval",
        handler: "control/hitl reject flow",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    escalate: {
        category: "control",
        targetType: "approval/incident/intervention",
        handler: "hitl escalation flow",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    ack_incident: {
        category: "control",
        targetType: "incident",
        handler: "incident workflow ack",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    request_recovery: {
        category: "control",
        targetType: "incident",
        handler: "recovery engine",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    request_replay: {
        category: "control",
        targetType: "incident/task",
        handler: "replay engine",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    retry_task: {
        category: "control",
        targetType: "task",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    cancel_task: {
        category: "control",
        targetType: "task",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    pause_task: {
        category: "control",
        targetType: "task",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    resume_task: {
        category: "control",
        targetType: "task",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    pause_agent: {
        category: "control",
        targetType: "agent",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    resume_agent: {
        category: "control",
        targetType: "agent",
        handler: "control surface",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    inspect_agent: {
        category: "control",
        targetType: "agent",
        handler: "surfaceService.getItemDetailView()",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    // HITL 类
    confirm_action: {
        category: "hitl",
        targetType: "unknown",
        handler: "confirmation manager",
        returnsUpdatedView: false,
        returnsActionResult: true,
    },
    dismiss_intervention: {
        category: "hitl",
        targetType: "intervention",
        handler: "human loop service",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    snooze_intervention: {
        category: "hitl",
        targetType: "intervention",
        handler: "human loop service",
        returnsUpdatedView: true,
        returnsActionResult: true,
    },
    // Navigation 类
    switch_workspace: {
        category: "navigation",
        targetType: "workspace",
        handler: "workspace switcher",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
    go_back: {
        category: "navigation",
        targetType: "unknown",
        handler: "navigation service",
        returnsUpdatedView: true,
        returnsActionResult: false,
    },
};
// ============================================================================
// 2A-1 最小命令集 (首批实现)
// ============================================================================
exports.PHASE_2A1_MINIMAL_COMMANDS = [
    // 视图 (5)
    "view_dashboard",
    "view_tasks",
    "view_approvals",
    "view_incidents",
    "view_inbox",
    // 动作 (5)
    "approve",
    "reject",
    "ack_incident",
    "retry_task",
    "pause_agent",
    // 辅助 (2)
    "switch_workspace",
    "refresh",
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0b3JfY29tbWFuZF9kaXNwYXRjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9vcGVyYXRvci9zZXJ2aWNlcy9vcGVyYXRvcl9jb21tYW5kX2Rpc3BhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBK0NVLFFBQUEsZ0JBQWdCLEdBQW1DO0lBQzlELFNBQVM7SUFDVCxjQUFjLEVBQUU7UUFDZCxRQUFRLEVBQUUsTUFBTTtRQUNoQixVQUFVLEVBQUUsV0FBVztRQUN2QixPQUFPLEVBQUUsbUNBQW1DO1FBQzVDLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsbUJBQW1CLEVBQUUsS0FBSztLQUMzQjtJQUNELFVBQVUsRUFBRTtRQUNWLFFBQVEsRUFBRSxNQUFNO1FBQ2hCLFVBQVUsRUFBRSxNQUFNO1FBQ2xCLE9BQU8sRUFBRSw4QkFBOEI7UUFDdkMsa0JBQWtCLEVBQUUsSUFBSTtRQUN4QixtQkFBbUIsRUFBRSxLQUFLO0tBQzNCO0lBQ0QsY0FBYyxFQUFFO1FBQ2QsUUFBUSxFQUFFLE1BQU07UUFDaEIsVUFBVSxFQUFFLFVBQVU7UUFDdEIsT0FBTyxFQUFFLGtDQUFrQztRQUMzQyxrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLG1CQUFtQixFQUFFLEtBQUs7S0FDM0I7SUFDRCxjQUFjLEVBQUU7UUFDZCxRQUFRLEVBQUUsTUFBTTtRQUNoQixVQUFVLEVBQUUsVUFBVTtRQUN0QixPQUFPLEVBQUUsa0NBQWtDO1FBQzNDLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsbUJBQW1CLEVBQUUsS0FBSztLQUMzQjtJQUNELFdBQVcsRUFBRTtRQUNYLFFBQVEsRUFBRSxNQUFNO1FBQ2hCLFVBQVUsRUFBRSxPQUFPO1FBQ25CLE9BQU8sRUFBRSwrQkFBK0I7UUFDeEMsa0JBQWtCLEVBQUUsSUFBSTtRQUN4QixtQkFBbUIsRUFBRSxLQUFLO0tBQzNCO0lBQ0QsVUFBVSxFQUFFO1FBQ1YsUUFBUSxF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QUFvQjtRQUM3QixrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLG1CQUFtQixFQUFFLElBQUk7S0FDMUI7SUFFRCxlQUFlO0lBQ2YsZ0JBQWdCLEVBQUU7UUFDaEIsUUFBUSxFQUFFLFlBQVk7UUFDdEIsVUFBVSxFQUFFLFdBQVc7UUFDdkIsT0FBTyxFQUFFLG9CQUFvQjtRQUM3QixrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLG1CQUFtQixFQUFFLEtBQUs7S0FDM0I7SUFDRCxPQUFPLEVBQUU7UUFDUCxRQUFRLEVBQUUsWUFBWTtRQUN0QixVQUFVLEVBQUUsU0FBUztRQUNyQixPQUFPLEVBQUUsb0JBQW9CO1FBQzdCLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsbUJBQW1CLEVBQUUsS0FBSztLQUMzQjtDQUNGLENBQUM7QUFFRiwrRUFBK0U7QUFDL0Usb0JBQW9CO0FBQ3BCLCtFQUErRTtBQUVsRSxRQUFBLDBCQUEwQixHQUFhO0lBQ2xELFNBQVM7SUFDVCxnQkFBZ0I7SUFDaEIsWUFBWTtJQUNaLGdCQUFnQjtJQUNoQixnQkFBZ0I7SUFDaEIsWUFBWTtJQUNaLFNBQVM7SUFDVCxTQUFTO0lBQ1QsUUFBUTtJQUNSLGNBQWM7SUFDZCxZQUFZO0lBQ1osYUFBYTtJQUNiLFNBQVM7SUFDVCxrQkFBa0I7SUFDbEIsU0FBUztDQUNWLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE9wZXJhdG9yIENvbW1hbmQgRGlzcGF0Y2hcbiAqIFBoYXNlIDJBLTEgLSDlkb3ku6TliIblj5HlsYJcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOaOpeWPl+e7n+S4gCBPcGVyYXRvckNvbW1hbmRcbiAqIC0g5pig5bCE5Yiw77yadmlldyBhY3Rpb24gLyBjb250cm9sIGFjdGlvbiAvIGhpdGwgYWN0aW9uIC8gbmF2aWdhdGlvbiBhY3Rpb25cbiAqIC0g6L+U5ZueIE9wZXJhdG9yQ29tbWFuZFJlc3VsdFxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgRGlzcGF0Y2hDb250ZXh0LFxuICBPcGVyYXRvckNvbW1hbmQsXG4gIE9wZXJhdG9yQ29tbWFuZFJlc3VsdCxcbn0gZnJvbSBcIi4uL3R5cGVzL3N1cmZhY2VfdHlwZXNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBPcGVyYXRvckNvbW1hbmREaXNwYXRjaCB7XG4gIC8qKlxuICAgKiDliIblj5Hlkb3ku6TliLDlr7nlupTlpITnkIblmahcbiAgICogQHBhcmFtIGNvbW1hbmQgLSDmoIflh4bljJblkb3ku6Tlr7nosaFcbiAgICogQHBhcmFtIGNvbnRleHQgLSDliIblj5HkuIrkuIvmlofvvIjljIXlkKsgYWN0b3LjgIFuYXZpZ2F0aW9uIOeKtuaAgeetie+8iVxuICAgKiBAcmV0dXJucyDlkb3ku6TmiafooYznu5PmnpxcbiAgICovXG4gIGRpc3BhdGNoKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0Pjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5ZG95Luk5aSE55CG5Zmo5YiG57G7XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIENvbW1hbmRIYW5kbGVyQ2F0ZWdvcnkgPVxuICB8IFwidmlld1wiXG4gIHwgXCJjb250cm9sXCJcbiAgfCBcImhpdGxcIlxuICB8IFwibmF2aWdhdGlvblwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlkb3ku6TmmKDlsITooaggKFJlZ2lzdHJ5KVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWRveS7pOaYoOWwhOmFjee9rlxuICogY29tbWFuZFR5cGUgLT4geyBjYXRlZ29yeSwgdGFyZ2V0VHlwZSwgaGFuZGxlciB9XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tbWFuZE1hcHBpbmcge1xuICBjYXRlZ29yeTogQ29tbWFuZEhhbmRsZXJDYXRlZ29yeTtcbiAgdGFyZ2V0VHlwZTogc3RyaW5nO1xuICBoYW5kbGVyOiBzdHJpbmc7XG4gIHJldHVybnNVcGRhdGVkVmlldzogYm9vbGVhbjtcbiAgcmV0dXJuc0FjdGlvblJlc3VsdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNvbnN0IENPTU1BTkRfUkVHSVNUUlk6IFJlY29yZDxzdHJpbmcsIENvbW1hbmRNYXBwaW5nPiA9IHtcbiAgLy8gVmlldyDnsbtcbiAgdmlld19kYXNoYm9hcmQ6IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJkYXNoYm9hcmRcIixcbiAgICBoYW5kbGVyOiBcInN1cmZhY2VTZXJ2aWNlLmdldERhc2hib2FyZFZpZXcoKVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiBmYWxzZSxcbiAgfSxcbiAgdmlld190YXNrczoge1xuICAgIGNhdGVnb3J5OiBcInZpZXdcIixcbiAgICB0YXJnZXRUeXBlOiBcInRhc2tcIixcbiAgICBoYW5kbGVyOiBcInN1cmZhY2VTZXJ2aWNlLmdldFRhc2tWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG4gIHZpZXdfYXBwcm92YWxzOiB7XG4gICAgY2F0ZWdvcnk6IFwidmlld1wiLFxuICAgIHRhcmdldFR5cGU6IFwiYXBwcm92YWxcIixcbiAgICBoYW5kbGVyOiBcInN1cmZhY2VTZXJ2aWNlLmdldEFwcHJvdmFsVmlldygpXCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IGZhbHNlLFxuICB9LFxuICB2aWV3X2luY2lkZW50czoge1xuICAgIGNhdGVnb3J5OiBcInZpZXdcIixcbiAgICB0YXJnZXRUeXBlOiBcImluY2lkZW50XCIsXG4gICAgaGFuZGxlcjogXCJzdXJmYWNlU2VydmljZS5nZXRJbmNpZGVudFZpZXcoKVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiBmYWxzZSxcbiAgfSxcbiAgdmlld19hZ2VudHM6IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJhZ2VudFwiLFxuICAgIGhhbmRsZXI6IFwic3VyZmFjZVNlcnZpY2UuZ2V0QWdlbnRWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG4gIHZpZXdfaW5ib3g6IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJpbmJveFwiLFxuICAgIGhhbmRsZXI6IFwic3VyZmFjZVNlcnZpY2UuZ2V0SW5ib3hWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG4gIHZpZXdfaW50ZXJ2ZW50aW9uczoge1xuICAgIGNhdGVnb3J5OiBcInZpZXdcIixcbiAgICB0YXJnZXRUeXBlOiBcImludGVydmVudGlvblwiLFxuICAgIGhhbmRsZXI6IFwic3VyZmFjZVNlcnZpY2UuZ2V0SW50ZXJ2ZW50aW9uVmlldygpXCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IGZhbHNlLFxuICB9LFxuICB2aWV3X2hpc3Rvcnk6IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJoaXN0b3J5XCIsXG4gICAgaGFuZGxlcjogXCJzdXJmYWNlU2VydmljZS5nZXRIaXN0b3J5VmlldygpXCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IGZhbHNlLFxuICB9LFxuICBvcGVuX2l0ZW06IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJhbnlcIixcbiAgICBoYW5kbGVyOiBcInN1cmZhY2VTZXJ2aWNlLmdldEl0ZW1EZXRhaWxWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG4gIHJlZnJlc2g6IHtcbiAgICBjYXRlZ29yeTogXCJ2aWV3XCIsXG4gICAgdGFyZ2V0VHlwZTogXCJjdXJyZW50XCIsXG4gICAgaGFuZGxlcjogXCJzdXJmYWNlU2VydmljZS5nZXRWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG5cbiAgLy8gQ29udHJvbCDnsbtcbiAgYXBwcm92ZToge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcImFwcHJvdmFsXCIsXG4gICAgaGFuZGxlcjogXCJjb250cm9sL2hpdGwgYXBwcm92ZSBmbG93XCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IHRydWUsXG4gIH0sXG4gIHJlamVjdDoge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcImFwcHJvdmFsXCIsXG4gICAgaGFuZGxlcjogXCJjb250cm9sL2hpdGwgcmVqZWN0IGZsb3dcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgZXNjYWxhdGU6IHtcbiAgICBjYXRlZ29yeTogXCJjb250cm9sXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJhcHByb3ZhbC9pbmNpZGVudC9pbnRlcnZlbnRpb25cIixcbiAgICBoYW5kbGVyOiBcImhpdGwgZXNjYWxhdGlvbiBmbG93XCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IHRydWUsXG4gIH0sXG4gIGFja19pbmNpZGVudDoge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcImluY2lkZW50XCIsXG4gICAgaGFuZGxlcjogXCJpbmNpZGVudCB3b3JrZmxvdyBhY2tcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgcmVxdWVzdF9yZWNvdmVyeToge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcImluY2lkZW50XCIsXG4gICAgaGFuZGxlcjogXCJyZWNvdmVyeSBlbmdpbmVcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgcmVxdWVzdF9yZXBsYXk6IHtcbiAgICBjYXRlZ29yeTogXCJjb250cm9sXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJpbmNpZGVudC90YXNrXCIsXG4gICAgaGFuZGxlcjogXCJyZXBsYXkgZW5naW5lXCIsXG4gICAgcmV0dXJuc1VwZGF0ZWRWaWV3OiB0cnVlLFxuICAgIHJldHVybnNBY3Rpb25SZXN1bHQ6IHRydWUsXG4gIH0sXG4gIHJldHJ5X3Rhc2s6IHtcbiAgICBjYXRlZ29yeTogXCJjb250cm9sXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJ0YXNrXCIsXG4gICAgaGFuZGxlcjogXCJjb250cm9sIHN1cmZhY2VcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgY2FuY2VsX3Rhc2s6IHtcbiAgICBjYXRlZ29yeTogXCJjb250cm9sXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJ0YXNrXCIsXG4gICAgaGFuZGxlcjogXCJjb250cm9sIHN1cmZhY2VcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgcGF1c2VfdGFzazoge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcInRhc2tcIixcbiAgICBoYW5kbGVyOiBcImNvbnRyb2wgc3VyZmFjZVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiB0cnVlLFxuICB9LFxuICByZXN1bWVfdGFzazoge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcInRhc2tcIixcbiAgICBoYW5kbGVyOiBcImNvbnRyb2wgc3VyZmFjZVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiB0cnVlLFxuICB9LFxuICBwYXVzZV9hZ2VudDoge1xuICAgIGNhdGVnb3J5OiBcImNvbnRyb2xcIixcbiAgICB0YXJnZXRUeXBlOiBcImFnZW50XCIsXG4gICAgaGFuZGxlcjogXCJjb250cm9sIHN1cmZhY2VcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgcmVzdW1lX2FnZW50OiB7XG4gICAgY2F0ZWdvcnk6IFwiY29udHJvbFwiLFxuICAgIHRhcmdldFR5cGU6IFwiYWdlbnRcIixcbiAgICBoYW5kbGVyOiBcImNvbnRyb2wgc3VyZmFjZVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiB0cnVlLFxuICB9LFxuICBpbnNwZWN0X2FnZW50OiB7XG4gICAgY2F0ZWdvcnk6IFwiY29udHJvbFwiLFxuICAgIHRhcmdldFR5cGU6IFwiYWdlbnRcIixcbiAgICBoYW5kbGVyOiBcInN1cmZhY2VTZXJ2aWNlLmdldEl0ZW1EZXRhaWxWaWV3KClcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG5cbiAgLy8gSElUTCDnsbtcbiAgY29uZmlybV9hY3Rpb246IHtcbiAgICBjYXRlZ29yeTogXCJoaXRsXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJ1bmtub3duXCIsXG4gICAgaGFuZGxlcjogXCJjb25maXJtYXRpb24gbWFuYWdlclwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogZmFsc2UsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcbiAgZGlzbWlzc19pbnRlcnZlbnRpb246IHtcbiAgICBjYXRlZ29yeTogXCJoaXRsXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJpbnRlcnZlbnRpb25cIixcbiAgICBoYW5kbGVyOiBcImh1bWFuIGxvb3Agc2VydmljZVwiLFxuICAgIHJldHVybnNVcGRhdGVkVmlldzogdHJ1ZSxcbiAgICByZXR1cm5zQWN0aW9uUmVzdWx0OiB0cnVlLFxuICB9LFxuICBzbm9vemVfaW50ZXJ2ZW50aW9uOiB7XG4gICAgY2F0ZWdvcnk6IFwiaGl0bFwiLFxuICAgIHRhcmdldFR5cGU6IFwiaW50ZXJ2ZW50aW9uXCIsXG4gICAgaGFuZGxlcjogXCJodW1hbiBsb29wIHNlcnZpY2VcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogdHJ1ZSxcbiAgfSxcblxuICAvLyBOYXZpZ2F0aW9uIOexu1xuICBzd2l0Y2hfd29ya3NwYWNlOiB7XG4gICAgY2F0ZWdvcnk6IFwibmF2aWdhdGlvblwiLFxuICAgIHRhcmdldFR5cGU6IFwid29ya3NwYWNlXCIsXG4gICAgaGFuZGxlcjogXCJ3b3Jrc3BhY2Ugc3dpdGNoZXJcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG4gIGdvX2JhY2s6IHtcbiAgICBjYXRlZ29yeTogXCJuYXZpZ2F0aW9uXCIsXG4gICAgdGFyZ2V0VHlwZTogXCJ1bmtub3duXCIsXG4gICAgaGFuZGxlcjogXCJuYXZpZ2F0aW9uIHNlcnZpY2VcIixcbiAgICByZXR1cm5zVXBkYXRlZFZpZXc6IHRydWUsXG4gICAgcmV0dXJuc0FjdGlvblJlc3VsdDogZmFsc2UsXG4gIH0sXG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAyQS0xIOacgOWwj+WRveS7pOmbhiAo6aaW5om55a6e546wKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY29uc3QgUEhBU0VfMkExX01JTklNQUxfQ09NTUFORFM6IHN0cmluZ1tdID0gW1xuICAvLyDop4blm74gKDUpXG4gIFwidmlld19kYXNoYm9hcmRcIixcbiAgXCJ2aWV3X3Rhc2tzXCIsXG4gIFwidmlld19hcHByb3ZhbHNcIixcbiAgXCJ2aWV3X2luY2lkZW50c1wiLFxuICBcInZpZXdfaW5ib3hcIixcbiAgLy8g5Yqo5L2cICg1KVxuICBcImFwcHJvdmVcIixcbiAgXCJyZWplY3RcIixcbiAgXCJhY2tfaW5jaWRlbnRcIixcbiAgXCJyZXRyeV90YXNrXCIsXG4gIFwicGF1c2VfYWdlbnRcIixcbiAgLy8g6L6F5YqpICgyKVxuICBcInN3aXRjaF93b3Jrc3BhY2VcIixcbiAgXCJyZWZyZXNoXCIsXG5dO1xuIl19