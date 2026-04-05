"use strict";
/**
 * Status Projection - 状态投影统一出口
 *
 * 职责：
 * 1. 统一出口
 * 2. 输入：control surface snapshot + projection options + filter / sort / focus
 * 3. 输出：dashboard projection result + formatted sections + attention summary + recommended actions
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusProjection = void 0;
exports.createStatusProjection = createStatusProjection;
exports.projectStatus = projectStatus;
exports.projectStatusSummary = projectStatusSummary;
exports.projectOperatorView = projectOperatorView;
const dashboard_builder_1 = require("./dashboard_builder");
const projection_service_1 = require("./projection_service");
const dashboard_refresh_1 = require("./dashboard_refresh");
const attention_engine_1 = require("./attention_engine");
// ============================================================================
// 状态投影器
// ============================================================================
class StatusProjection {
    constructor(config = {}) {
        this.config = {
            autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
            maxStaleMs: config.maxStaleMs ?? 120000,
            defaultMode: config.defaultMode ?? 'summary',
            defaultTarget: config.defaultTarget ?? 'api',
        };
        this.dashboardBuilder = new dashboard_builder_1.DashboardBuilder();
        this.projectionService = new projection_service_1.ProjectionService();
        this.attentionEngine = new attention_engine_1.AttentionEngine();
        this.refreshManager = (0, dashboard_refresh_1.createDashboardRefreshManager)({
            autoRefreshIntervalMs: this.config.autoRefreshIntervalMs,
            maxStaleMs: this.config.maxStaleMs,
        }, this.dashboardBuilder);
    }
    /**
     * 投影状态
     */
    projectStatus(controlSnapshot, options) {
        // 构建仪表盘
        const dashboard = this.dashboardBuilder.buildDashboardSnapshot(controlSnapshot);
        // 刷新管理器
        const refreshResult = this.refreshManager.refresh(controlSnapshot);
        // 投影
        const projectionOptions = {
            mode: options?.mode || this.config.defaultMode,
            target: options?.target || this.config.defaultTarget,
            filter: options?.filter,
            sort: options?.sort,
            group: options?.group,
            focus: options?.focus,
            maxItems: options?.maxItems,
        };
        const projection = this.projectionService.project(dashboard, projectionOptions);
        // 关注项摘要
        const attentionSummary = this.buildAttentionSummary(dashboard.attentionItems);
        // 新鲜度
        const freshness = this.refreshManager.getFreshness();
        return {
            dashboard,
            projection,
            attentionSummary,
            recommendedActions: dashboard.recommendedActions,
            freshness: {
                ageMs: freshness.ageMs,
                isStale: freshness.isStale,
                staleMs: freshness.freshnessMs,
            },
            changes: refreshResult.changes,
        };
    }
    /**
     * 投影为摘要模式
     */
    projectSummary(controlSnapshot, target) {
        return this.projectStatus(controlSnapshot, {
            mode: 'summary',
            target: target || this.config.defaultTarget,
            maxItems: 10,
        });
    }
    /**
     * 投影为详情模式
     */
    projectDetail(controlSnapshot, target) {
        return this.projectStatus(controlSnapshot, {
            mode: 'detail',
            target: target || this.config.defaultTarget,
            maxItems: 100,
        });
    }
    /**
     * 投影为操作员模式
     */
    projectOperator(controlSnapshot, target) {
        return this.projectStatus(controlSnapshot, {
            mode: 'operator',
            target: target || this.config.defaultTarget,
            filter: { attentionOnly: true },
            maxItems: 50,
        });
    }
    /**
     * 投影为管理模式
     */
    projectManagement(controlSnapshot, target) {
        return this.projectStatus(controlSnapshot, {
            mode: 'management',
            target: target || this.config.defaultTarget,
            maxItems: 20,
        });
    }
    /**
     * 启动自动刷新
     */
    startAutoRefresh(controlSnapshotProvider, onRefresh) {
        this.refreshManager.startAutoRefresh(controlSnapshotProvider);
        if (onRefresh) {
            this.refreshManager.onRefresh(onRefresh);
        }
    }
    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        this.refreshManager.stopAutoRefresh();
    }
    /**
     * 检测陈旧
     */
    detectStale() {
        return this.refreshManager.detectStale();
    }
    /**
     * 获取当前仪表盘
     */
    getCurrentDashboard() {
        return this.refreshManager.getCurrentSnapshot();
    }
    /**
     * 注册刷新监听器
     */
    onRefresh(listener) {
        this.refreshManager.onRefresh(listener);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 构建关注项摘要
     */
    buildAttentionSummary(attentionItems) {
        const critical = attentionItems.filter(i => i.severity === 'critical').length;
        const high = attentionItems.filter(i => i.severity === 'high').length;
        const medium = attentionItems.filter(i => i.severity === 'medium').length;
        return {
            total: attentionItems.length,
            critical,
            high,
            medium,
            topItems: attentionItems.slice(0, 10),
        };
    }
}
exports.StatusProjection = StatusProjection;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建状态投影器
 */
function createStatusProjection(config) {
    return new StatusProjection(config);
}
/**
 * 快速投影状态
 */
function projectStatus(controlSnapshot, options, config) {
    const projection = new StatusProjection(config);
    return projection.projectStatus(controlSnapshot, options);
}
/**
 * 快速投影摘要
 */
function projectStatusSummary(controlSnapshot, target) {
    const projection = new StatusProjection();
    return projection.projectSummary(controlSnapshot, target);
}
/**
 * 快速投影操作员视图
 */
function projectOperatorView(controlSnapshot, target) {
    const projection = new StatusProjection();
    return projection.projectOperator(controlSnapshot, target);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzX3Byb2plY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvc3RhdHVzX3Byb2plY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQW9TSCx3REFFQztBQUtELHNDQU9DO0FBS0Qsb0RBTUM7QUFLRCxrREFNQztBQXRURCwyREFBK0U7QUFDL0UsNkRBQTJFO0FBQzNFLDJEQUk2QjtBQUM3Qix5REFBdUU7QUF3RHZFLCtFQUErRTtBQUMvRSxRQUFRO0FBQ1IsK0VBQStFO0FBRS9FLE1BQWEsZ0JBQWdCO0lBTzNCLFlBQVksU0FBaUMsRUFBRTtRQUM3QyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1oscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixJQUFJLEtBQUs7WUFDNUQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLElBQUksTUFBTTtZQUN2QyxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsSUFBSSxTQUFTO1lBQzVDLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYSxJQUFJLEtBQUs7U0FDN0MsQ0FBQztRQUVGLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLG9DQUFnQixFQUFFLENBQUM7UUFDL0MsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksc0NBQWlCLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksa0NBQWUsRUFBRSxDQUFDO1FBRTdDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBQSxpREFBNkIsRUFDakQ7WUFDRSxxQkFBcUIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQjtZQUN4RCxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1NBQ25DLEVBQ0QsSUFBSSxDQUFDLGdCQUFnQixDQUN0QixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUNYLGVBQXVDLEVBQ3ZDLE9BQTJCO1FB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QyxNQUFNLENBQUM7UUFFMUUsT0FBTztZQUNMLEtBQUssRUFBRSxjQUFjLENBQUMsTUFBTTtZQUM1QixRQUFRO1lBQ1IsSUFBSTtZQUNKLE1BQU07WUFDTixRQUFRLEVBQUUsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO1NBQ3RDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF0TUQsNENBc01DO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxNQUErQjtJQUNwRSxPQUFPLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsYUFBYSxDQUMzQixlQUF1QyxFQUN2QyxPQUEyQixFQUMzQixNQUErQjtJQUUvQixNQUFNLFVBQVUsR0FBRyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hELE9BQU8sVUFBVSxDQUFDLGFBQWEsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDNUQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQ2xDLGVBQXVDLEVBQ3ZDLE1BQXlCO0lBRXpCLE1BQU0sVUFBVSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztJQUMxQyxPQUFPLFVBQVUsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxlQUF1QyxFQUN2QyxNQUF5QjtJQUV6QixNQUFNLFVBQVUsR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUM7SUFDMUMsT0FBTyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM3RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTdGF0dXMgUHJvamVjdGlvbiAtIOeKtuaAgeaKleW9see7n+S4gOWHuuWPo1xuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOe7n+S4gOWHuuWPo1xuICogMi4g6L6T5YWl77yaY29udHJvbCBzdXJmYWNlIHNuYXBzaG90ICsgcHJvamVjdGlvbiBvcHRpb25zICsgZmlsdGVyIC8gc29ydCAvIGZvY3VzXG4gKiAzLiDovpPlh7rvvJpkYXNoYm9hcmQgcHJvamVjdGlvbiByZXN1bHQgKyBmb3JtYXR0ZWQgc2VjdGlvbnMgKyBhdHRlbnRpb24gc3VtbWFyeSArIHJlY29tbWVuZGVkIGFjdGlvbnNcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBDb250cm9sU3VyZmFjZVNuYXBzaG90LFxuICBDb250cm9sQWN0aW9uLFxufSBmcm9tICcuL2NvbnRyb2xfdHlwZXMnO1xuaW1wb3J0IHR5cGUge1xuICBEYXNoYm9hcmRTbmFwc2hvdCxcbiAgUHJvamVjdGlvblJlc3VsdCxcbiAgUHJvamVjdGlvbk9wdGlvbnMsXG4gIFByb2plY3Rpb25Nb2RlLFxuICBQcm9qZWN0aW9uVGFyZ2V0LFxuICBQcm9qZWN0aW9uRmlsdGVyLFxuICBQcm9qZWN0aW9uU29ydCxcbiAgUHJvamVjdGlvbkdyb3VwLFxuICBSZWZyZXNoUmVzdWx0LFxuICBBdHRlbnRpb25JdGVtLFxufSBmcm9tICcuL2Rhc2hib2FyZF90eXBlcyc7XG5pbXBvcnQgeyBEYXNoYm9hcmRCdWlsZGVyLCBidWlsZERhc2hib2FyZFNuYXBzaG90IH0gZnJvbSAnLi9kYXNoYm9hcmRfYnVpbGRlcic7XG5pbXBvcnQgeyBQcm9qZWN0aW9uU2VydmljZSwgcHJvamVjdERhc2hib2FyZCB9IGZyb20gJy4vcHJvamVjdGlvbl9zZXJ2aWNlJztcbmltcG9ydCB7XG4gIERhc2hib2FyZFJlZnJlc2hNYW5hZ2VyLFxuICBjcmVhdGVEYXNoYm9hcmRSZWZyZXNoTWFuYWdlcixcbiAgZGV0ZWN0U3RhbGUsXG59IGZyb20gJy4vZGFzaGJvYXJkX3JlZnJlc2gnO1xuaW1wb3J0IHsgQXR0ZW50aW9uRW5naW5lLCBhbmFseXplQXR0ZW50aW9uIH0gZnJvbSAnLi9hdHRlbnRpb25fZW5naW5lJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog54q25oCB5oqV5b2x5Zmo6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdHVzUHJvamVjdGlvbkNvbmZpZyB7XG4gIC8qKiDoh6rliqjliLfmlrDpl7TpmpTvvIjmr6vnp5LvvIkgKi9cbiAgYXV0b1JlZnJlc2hJbnRlcnZhbE1zPzogbnVtYmVyO1xuICBcbiAgLyoqIOacgOWkp+mZiOaXp+aXtumXtO+8iOavq+enku+8iSAqL1xuICBtYXhTdGFsZU1zPzogbnVtYmVyO1xuICBcbiAgLyoqIOm7mOiupOaKleW9seaooeW8jyAqL1xuICBkZWZhdWx0TW9kZT86IFByb2plY3Rpb25Nb2RlO1xuICBcbiAgLyoqIOm7mOiupOaKleW9seebruaghyAqL1xuICBkZWZhdWx0VGFyZ2V0PzogUHJvamVjdGlvblRhcmdldDtcbn1cblxuLyoqXG4gKiDnirbmgIHmipXlvbHnu5PmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdGF0dXNQcm9qZWN0aW9uUmVzdWx0IHtcbiAgLyoqIOS7quihqOebmOW/q+eFpyAqL1xuICBkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90O1xuICBcbiAgLyoqIOaKleW9see7k+aenCAqL1xuICBwcm9qZWN0aW9uOiBQcm9qZWN0aW9uUmVzdWx0O1xuICBcbiAgLyoqIOWFs+azqOmhueaRmOimgSAqL1xuICBhdHRlbnRpb25TdW1tYXJ5OiB7XG4gICAgdG90YWw6IG51bWJlcjtcbiAgICBjcml0aWNhbDogbnVtYmVyO1xuICAgIGhpZ2g6IG51bWJlcjtcbiAgICBtZWRpdW06IG51bWJlcjtcbiAgICB0b3BJdGVtczogQXR0ZW50aW9uSXRlbVtdO1xuICB9O1xuICBcbiAgLyoqIOW7uuiuruWKqOS9nCAqL1xuICByZWNvbW1lbmRlZEFjdGlvbnM6IENvbnRyb2xBY3Rpb25bXTtcbiAgXG4gIC8qKiDmlrDpspzluqYgKi9cbiAgZnJlc2huZXNzOiB7XG4gICAgYWdlTXM6IG51bWJlcjtcbiAgICBpc1N0YWxlOiBib29sZWFuO1xuICAgIHN0YWxlTXM6IG51bWJlcjtcbiAgfTtcbiAgXG4gIC8qKiDlj5jljJbvvIjlpoLmnpzmnInvvIkgKi9cbiAgY2hhbmdlcz86IGFueTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g54q25oCB5oqV5b2x5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBTdGF0dXNQcm9qZWN0aW9uIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFN0YXR1c1Byb2plY3Rpb25Db25maWc+O1xuICBwcml2YXRlIGRhc2hib2FyZEJ1aWxkZXI6IERhc2hib2FyZEJ1aWxkZXI7XG4gIHByaXZhdGUgcHJvamVjdGlvblNlcnZpY2U6IFByb2plY3Rpb25TZXJ2aWNlO1xuICBwcml2YXRlIHJlZnJlc2hNYW5hZ2VyOiBEYXNoYm9hcmRSZWZyZXNoTWFuYWdlcjtcbiAgcHJpdmF0ZSBhdHRlbnRpb25FbmdpbmU6IEF0dGVudGlvbkVuZ2luZTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogU3RhdHVzUHJvamVjdGlvbkNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBhdXRvUmVmcmVzaEludGVydmFsTXM6IGNvbmZpZy5hdXRvUmVmcmVzaEludGVydmFsTXMgPz8gMzAwMDAsXG4gICAgICBtYXhTdGFsZU1zOiBjb25maWcubWF4U3RhbGVNcyA/PyAxMjAwMDAsXG4gICAgICBkZWZhdWx0TW9kZTogY29uZmlnLmRlZmF1bHRNb2RlID8/ICdzdW1tYXJ5JyxcbiAgICAgIGRlZmF1bHRUYXJnZXQ6IGNvbmZpZy5kZWZhdWx0VGFyZ2V0ID8/ICdhcGknLFxuICAgIH07XG4gICAgXG4gICAgdGhpcy5kYXNoYm9hcmRCdWlsZGVyID0gbmV3IERhc2hib2FyZEJ1aWxkZXIoKTtcbiAgICB0aGlzLnByb2plY3Rpb25TZXJ2aWNlID0gbmV3IFByb2plY3Rpb25TZXJ2aWNlKCk7XG4gICAgdGhpcy5hdHRlbnRpb25FbmdpbmUgPSBuZXcgQXR0ZW50aW9uRW5naW5lKCk7XG4gICAgXG4gICAgdGhpcy5yZWZyZXNoTWFuYWdlciA9IGNyZWF0ZURhc2hib2FyZFJlZnJlc2hNYW5hZ2VyKFxuICAgICAge1xuICAgICAgICBhdXRvUmVmcmVzaEludGVydmFsTXM6IHRoaXMuY29uZmlnLmF1dG9SZWZyZXNoSW50ZXJ2YWxNcyxcbiAgICAgICAgbWF4U3RhbGVNczogdGhpcy5jb25maWcubWF4U3RhbGVNcyxcbiAgICAgIH0sXG4gICAgICB0aGlzLmRhc2hib2FyZEJ1aWxkZXJcbiAgICApO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x54q25oCBXG4gICAqL1xuICBwcm9qZWN0U3RhdHVzKFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgICBvcHRpb25zPzogUHJvamVjdGlvbk9wdGlvbnNcbiAgKTogU3RhdHVzUHJvamVjdGlvblJlc3VsdCB7XG4gICAgLy8g5p6E5bu65Luq6KGo55uYXG4gICAgY29uc3QgZGFzaGJvYXJkID0gdGhpcy5kYXNoYm9hcmRCdWlsZGVyLmJ1aWxkRGFzaGJvYXJkU25hcHNob3QoY29udHJvbFNuYXBzaG90KTtcbiAgICBcbiAgICAvLyDliLfmlrDnrqHnkIblmahcbiAgICBjb25zdCByZWZyZXNoUmVzdWx0ID0gdGhpcy5yZWZyZXNoTWFuYWdlci5yZWZyZXNoKGNvbnRyb2xTbmFwc2hvdCk7XG4gICAgXG4gICAgLy8g5oqV5b2xXG4gICAgY29uc3QgcHJvamVjdGlvbk9wdGlvbnM6IFByb2plY3Rpb25PcHRpb25zID0ge1xuICAgICAgbW9kZTogb3B0aW9ucz8ubW9kZSB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0TW9kZSxcbiAgICAgIHRhcmdldDogb3B0aW9ucz8udGFyZ2V0IHx8IHRoaXMuY29uZmlnLmRlZmF1bHRUYXJnZXQsXG4gICAgICBmaWx0ZXI6IG9wdGlvbnM/LmZpbHRlcixcbiAgICAgIHNvcnQ6IG9wdGlvbnM/LnNvcnQsXG4gICAgICBncm91cDogb3B0aW9ucz8uZ3JvdXAsXG4gICAgICBmb2N1czogb3B0aW9ucz8uZm9jdXMsXG4gICAgICBtYXhJdGVtczogb3B0aW9ucz8ubWF4SXRlbXMsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBwcm9qZWN0aW9uID0gdGhpcy5wcm9qZWN0aW9uU2VydmljZS5wcm9qZWN0KGRhc2hib2FyZCwgcHJvamVjdGlvbk9wdGlvbnMpO1xuICAgIFxuICAgIC8vIOWFs+azqOmhueaRmOimgVxuICAgIGNvbnN0IGF0dGVudGlvblN1bW1hcnkgPSB0aGlzLmJ1aWxkQXR0ZW50aW9uU3VtbWFyeShkYXNoYm9hcmQuYXR0ZW50aW9uSXRlbXMpO1xuICAgIFxuICAgIC8vIOaWsOmynOW6plxuICAgIGNvbnN0IGZyZXNobmVzcyA9IHRoaXMucmVmcmVzaE1hbmFnZXIuZ2V0RnJlc2huZXNzKCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhc2hib2FyZCxcbiAgICAgIHByb2plY3Rpb24sXG4gICAgICBhdHRlbnRpb25TdW1tYXJ5LFxuICAgICAgcmVjb21tZW5kZWRBY3Rpb25zOiBkYXNoYm9hcmQucmVjb21tZW5kZWRBY3Rpb25zLFxuICAgICAgZnJlc2huZXNzOiB7XG4gICAgICAgIGFnZU1zOiBmcmVzaG5lc3MuYWdlTXMsXG4gICAgICAgIGlzU3RhbGU6IGZyZXNobmVzcy5pc1N0YWxlLFxuICAgICAgICBzdGFsZU1zOiBmcmVzaG5lc3MuZnJlc2huZXNzTXMsXG4gICAgICB9LFxuICAgICAgY2hhbmdlczogcmVmcmVzaFJlc3VsdC5jaGFuZ2VzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmipXlvbHkuLrmkZjopoHmqKHlvI9cbiAgICovXG4gIHByb2plY3RTdW1tYXJ5KFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgICB0YXJnZXQ/OiBQcm9qZWN0aW9uVGFyZ2V0XG4gICk6IFN0YXR1c1Byb2plY3Rpb25SZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnByb2plY3RTdGF0dXMoY29udHJvbFNuYXBzaG90LCB7XG4gICAgICBtb2RlOiAnc3VtbWFyeScsXG4gICAgICB0YXJnZXQ6IHRhcmdldCB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0VGFyZ2V0LFxuICAgICAgbWF4SXRlbXM6IDEwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x5Li66K+m5oOF5qih5byPXG4gICAqL1xuICBwcm9qZWN0RGV0YWlsKFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgICB0YXJnZXQ/OiBQcm9qZWN0aW9uVGFyZ2V0XG4gICk6IFN0YXR1c1Byb2plY3Rpb25SZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnByb2plY3RTdGF0dXMoY29udHJvbFNuYXBzaG90LCB7XG4gICAgICBtb2RlOiAnZGV0YWlsJyxcbiAgICAgIHRhcmdldDogdGFyZ2V0IHx8IHRoaXMuY29uZmlnLmRlZmF1bHRUYXJnZXQsXG4gICAgICBtYXhJdGVtczogMTAwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x5Li65pON5L2c5ZGY5qih5byPXG4gICAqL1xuICBwcm9qZWN0T3BlcmF0b3IoXG4gICAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90LFxuICAgIHRhcmdldD86IFByb2plY3Rpb25UYXJnZXRcbiAgKTogU3RhdHVzUHJvamVjdGlvblJlc3VsdCB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdFN0YXR1cyhjb250cm9sU25hcHNob3QsIHtcbiAgICAgIG1vZGU6ICdvcGVyYXRvcicsXG4gICAgICB0YXJnZXQ6IHRhcmdldCB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0VGFyZ2V0LFxuICAgICAgZmlsdGVyOiB7IGF0dGVudGlvbk9ubHk6IHRydWUgfSxcbiAgICAgIG1heEl0ZW1zOiA1MCxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaKleW9seS4uueuoeeQhuaooeW8j1xuICAgKi9cbiAgcHJvamVjdE1hbmFnZW1lbnQoXG4gICAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90LFxuICAgIHRhcmdldD86IFByb2plY3Rpb25UYXJnZXRcbiAgKTogU3RhdHVzUHJvamVjdGlvblJlc3VsdCB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdFN0YXR1cyhjb250cm9sU25hcHNob3QsIHtcbiAgICAgIG1vZGU6ICdtYW5hZ2VtZW50JyxcbiAgICAgIHRhcmdldDogdGFyZ2V0IHx8IHRoaXMuY29uZmlnLmRlZmF1bHRUYXJnZXQsXG4gICAgICBtYXhJdGVtczogMjAsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlkK/liqjoh6rliqjliLfmlrBcbiAgICovXG4gIHN0YXJ0QXV0b1JlZnJlc2goXG4gICAgY29udHJvbFNuYXBzaG90UHJvdmlkZXI6ICgpID0+IENvbnRyb2xTdXJmYWNlU25hcHNob3QsXG4gICAgb25SZWZyZXNoPzogKHJlc3VsdDogUmVmcmVzaFJlc3VsdCkgPT4gdm9pZFxuICApOiB2b2lkIHtcbiAgICB0aGlzLnJlZnJlc2hNYW5hZ2VyLnN0YXJ0QXV0b1JlZnJlc2goY29udHJvbFNuYXBzaG90UHJvdmlkZXIpO1xuICAgIFxuICAgIGlmIChvblJlZnJlc2gpIHtcbiAgICAgIHRoaXMucmVmcmVzaE1hbmFnZXIub25SZWZyZXNoKG9uUmVmcmVzaCk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5YGc5q2i6Ieq5Yqo5Yi35pawXG4gICAqL1xuICBzdG9wQXV0b1JlZnJlc2goKTogdm9pZCB7XG4gICAgdGhpcy5yZWZyZXNoTWFuYWdlci5zdG9wQXV0b1JlZnJlc2goKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1i+mZiOaXp1xuICAgKi9cbiAgZGV0ZWN0U3RhbGUoKToge1xuICAgIGlzU3RhbGU6IGJvb2xlYW47XG4gICAgc3RhbGVNczogbnVtYmVyO1xuICAgIG1heFN0YWxlTXM6IG51bWJlcjtcbiAgICBzdWdnZXN0ZWRBY3Rpb246ICdyZWZyZXNoJyB8ICdpZ25vcmUnIHwgJ3dhcm4nO1xuICB9IHtcbiAgICByZXR1cm4gdGhpcy5yZWZyZXNoTWFuYWdlci5kZXRlY3RTdGFsZSgpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5b2T5YmN5Luq6KGo55uYXG4gICAqL1xuICBnZXRDdXJyZW50RGFzaGJvYXJkKCk6IERhc2hib2FyZFNuYXBzaG90IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVmcmVzaE1hbmFnZXIuZ2V0Q3VycmVudFNuYXBzaG90KCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDms6jlhozliLfmlrDnm5HlkKzlmahcbiAgICovXG4gIG9uUmVmcmVzaChsaXN0ZW5lcjogKHJlc3VsdDogUmVmcmVzaFJlc3VsdCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMucmVmcmVzaE1hbmFnZXIub25SZWZyZXNoKGxpc3RlbmVyKTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuWFs+azqOmhueaRmOimgVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZEF0dGVudGlvblN1bW1hcnkoYXR0ZW50aW9uSXRlbXM6IEF0dGVudGlvbkl0ZW1bXSk6IFN0YXR1c1Byb2plY3Rpb25SZXN1bHRbJ2F0dGVudGlvblN1bW1hcnknXSB7XG4gICAgY29uc3QgY3JpdGljYWwgPSBhdHRlbnRpb25JdGVtcy5maWx0ZXIoaSA9PiBpLnNldmVyaXR5ID09PSAnY3JpdGljYWwnKS5sZW5ndGg7XG4gICAgY29uc3QgaGlnaCA9IGF0dGVudGlvbkl0ZW1zLmZpbHRlcihpID0+IGkuc2V2ZXJpdHkgPT09ICdoaWdoJykubGVuZ3RoO1xuICAgIGNvbnN0IG1lZGl1bSA9IGF0dGVudGlvbkl0ZW1zLmZpbHRlcihpID0+IGkuc2V2ZXJpdHkgPT09ICdtZWRpdW0nKS5sZW5ndGg7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsOiBhdHRlbnRpb25JdGVtcy5sZW5ndGgsXG4gICAgICBjcml0aWNhbCxcbiAgICAgIGhpZ2gsXG4gICAgICBtZWRpdW0sXG4gICAgICB0b3BJdGVtczogYXR0ZW50aW9uSXRlbXMuc2xpY2UoMCwgMTApLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu654q25oCB5oqV5b2x5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdGF0dXNQcm9qZWN0aW9uKGNvbmZpZz86IFN0YXR1c1Byb2plY3Rpb25Db25maWcpOiBTdGF0dXNQcm9qZWN0aW9uIHtcbiAgcmV0dXJuIG5ldyBTdGF0dXNQcm9qZWN0aW9uKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5oqV5b2x54q25oCBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0U3RhdHVzKFxuICBjb250cm9sU25hcHNob3Q6IENvbnRyb2xTdXJmYWNlU25hcHNob3QsXG4gIG9wdGlvbnM/OiBQcm9qZWN0aW9uT3B0aW9ucyxcbiAgY29uZmlnPzogU3RhdHVzUHJvamVjdGlvbkNvbmZpZ1xuKTogU3RhdHVzUHJvamVjdGlvblJlc3VsdCB7XG4gIGNvbnN0IHByb2plY3Rpb24gPSBuZXcgU3RhdHVzUHJvamVjdGlvbihjb25maWcpO1xuICByZXR1cm4gcHJvamVjdGlvbi5wcm9qZWN0U3RhdHVzKGNvbnRyb2xTbmFwc2hvdCwgb3B0aW9ucyk7XG59XG5cbi8qKlxuICog5b+r6YCf5oqV5b2x5pGY6KaBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0U3RhdHVzU3VtbWFyeShcbiAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90LFxuICB0YXJnZXQ/OiBQcm9qZWN0aW9uVGFyZ2V0XG4pOiBTdGF0dXNQcm9qZWN0aW9uUmVzdWx0IHtcbiAgY29uc3QgcHJvamVjdGlvbiA9IG5ldyBTdGF0dXNQcm9qZWN0aW9uKCk7XG4gIHJldHVybiBwcm9qZWN0aW9uLnByb2plY3RTdW1tYXJ5KGNvbnRyb2xTbmFwc2hvdCwgdGFyZ2V0KTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mipXlvbHmk43kvZzlkZjop4blm75cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3RPcGVyYXRvclZpZXcoXG4gIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgdGFyZ2V0PzogUHJvamVjdGlvblRhcmdldFxuKTogU3RhdHVzUHJvamVjdGlvblJlc3VsdCB7XG4gIGNvbnN0IHByb2plY3Rpb24gPSBuZXcgU3RhdHVzUHJvamVjdGlvbigpO1xuICByZXR1cm4gcHJvamVjdGlvbi5wcm9qZWN0T3BlcmF0b3IoY29udHJvbFNuYXBzaG90LCB0YXJnZXQpO1xufVxuIl19