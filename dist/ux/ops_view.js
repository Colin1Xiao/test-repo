"use strict";
/**
 * Ops View - 运维视图
 *
 * 职责：
 * 1. 聚合 Sprint 5 的 health / ops summary / audit 数据
 * 2. 输出 health score / degraded servers / blocked skills / replay hotspots / top failures
 * 3. 暴露基础运维动作入口
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsViewBuilder = void 0;
exports.createOpsViewBuilder = createOpsViewBuilder;
exports.buildOpsView = buildOpsView;
// ============================================================================
// 运维视图构建器
// ============================================================================
class OpsViewBuilder {
    constructor(healthMetricsDataSource, opsSummaryDataSource, config = {}) {
        this.config = {
            maxDegradedServers: config.maxDegradedServers ?? 10,
            maxBlockedSkills: config.maxBlockedSkills ?? 20,
            maxTopFailures: config.maxTopFailures ?? 5,
            maxReplayHotspots: config.maxReplayHotspots ?? 5,
        };
        this.healthMetricsDataSource = healthMetricsDataSource;
        this.opsSummaryDataSource = opsSummaryDataSource;
    }
    /**
     * 构建运维视图
     */
    async buildOpsView() {
        // 获取健康快照
        const healthSnapshot = await this.healthMetricsDataSource.getHealthSnapshot();
        // 获取运维摘要
        const opsSummary = await this.opsSummaryDataSource.getOpsSummary();
        // 构建视图
        return {
            overallStatus: this.determineOverallStatus(healthSnapshot, opsSummary),
            healthScore: healthSnapshot.global?.healthScore || 0,
            degradedServers: this.buildDegradedServers(healthSnapshot.byServer || {}),
            blockedSkills: this.buildBlockedSkills(healthSnapshot.bySkill || {}),
            pendingApprovals: healthSnapshot.global?.pendingApprovals || 0,
            activeIncidents: this.buildActiveIncidents(opsSummary),
            topFailures: this.buildTopFailures(opsSummary.topFailures || []),
            replayHotspots: this.buildReplayHotspots(opsSummary.replayHotspots || []),
        };
    }
    /**
     * 列出降级 Server
     */
    async listDegradedServers() {
        const view = await this.buildOpsView();
        return view.degradedServers;
    }
    /**
     * 列出被阻塞 Skill
     */
    async listBlockedSkills() {
        const view = await this.buildOpsView();
        return view.blockedSkills;
    }
    /**
     * 列出顶级事件
     */
    async listTopIncidents() {
        const view = await this.buildOpsView();
        return view.activeIncidents;
    }
    /**
     * 确认事件
     */
    async ackIncident(incidentId) {
        // 简化实现：实际应该调用事件管理系统
        return {
            success: true,
            actionType: 'ack_incident',
            targetId: incidentId,
            message: `Incident ${incidentId} acknowledged`,
            nextActions: ['request_recovery'],
        };
    }
    /**
     * 请求重放
     */
    async requestReplay(taskId) {
        // 简化实现：实际应该调用 Recovery 系统
        return {
            success: true,
            actionType: 'request_replay',
            targetId: taskId,
            message: `Replay requested for task ${taskId}`,
            nextActions: [],
        };
    }
    /**
     * 请求恢复
     */
    async requestRecovery(taskId) {
        // 简化实现：实际应该调用 Recovery 系统
        return {
            success: true,
            actionType: 'request_recovery',
            targetId: taskId,
            message: `Recovery requested for task ${taskId}`,
            nextActions: [],
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 确定总体状态
     */
    determineOverallStatus(healthSnapshot, opsSummary) {
        const healthScore = healthSnapshot.global?.healthScore || 100;
        if (healthScore < 50) {
            return 'critical';
        }
        if (healthScore < 70) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * 构建降级 Server 列表
     */
    buildDegradedServers(byServer) {
        const degraded = [];
        for (const [serverId, metrics] of Object.entries(byServer)) {
            if (metrics.healthStatus !== 'healthy') {
                degraded.push({
                    serverId,
                    status: metrics.healthStatus,
                    errorRate: metrics.errorRate || 0,
                    lastCheck: metrics.lastCheck || Date.now(),
                });
            }
        }
        // 按错误率排序
        degraded.sort((a, b) => b.errorRate - a.errorRate);
        return degraded.slice(0, this.config.maxDegradedServers);
    }
    /**
     * 构建被阻塞 Skill 列表
     */
    buildBlockedSkills(bySkill) {
        const blocked = [];
        for (const [skillName, metrics] of Object.entries(bySkill)) {
            if (metrics.blockedFrequency > 0 || metrics.pendingFrequency > 0) {
                blocked.push({
                    skillName,
                    status: metrics.blockedFrequency > 0 ? 'blocked' : 'pending',
                    count: metrics.blockedFrequency || metrics.pendingFrequency || 0,
                    reason: this.getBlockedReason(metrics),
                });
            }
        }
        // 按数量排序
        blocked.sort((a, b) => b.count - a.count);
        return blocked.slice(0, this.config.maxBlockedSkills);
    }
    /**
     * 获取阻塞原因
     */
    getBlockedReason(metrics) {
        if (metrics.compatibilityIssues > 0) {
            return `Compatibility issues: ${metrics.compatibilityIssues}`;
        }
        if (metrics.loadSuccessRate < 0.5) {
            return `Low load success rate: ${(metrics.loadSuccessRate * 100).toFixed(1)}%`;
        }
        return undefined;
    }
    /**
     * 构建活跃事件列表
     */
    buildActiveIncidents(opsSummary) {
        const incidents = [];
        // 从顶级失败创建事件
        if (opsSummary.topFailures) {
            for (const failure of opsSummary.topFailures.slice(0, 5)) {
                incidents.push({
                    id: `incident_${failure.category}`,
                    type: 'failure',
                    severity: this.mapFailureSeverity(failure.count),
                    description: `${failure.category}: ${failure.count} events`,
                    createdAt: Date.now(),
                    acknowledged: false,
                });
            }
        }
        // 从降级 Server 创建事件
        if (opsSummary.degradedServers) {
            for (const server of opsSummary.degradedServers.slice(0, 3)) {
                incidents.push({
                    id: `incident_server_${server.serverId}`,
                    type: 'server_degraded',
                    severity: server.status === 'unavailable' ? 'critical' : 'high',
                    description: `Server ${server.serverId} is ${server.status}`,
                    createdAt: Date.now(),
                    acknowledged: false,
                });
            }
        }
        return incidents;
    }
    /**
     * 构建顶级失败列表
     */
    buildTopFailures(topFailures) {
        return topFailures.slice(0, this.config.maxTopFailures);
    }
    /**
     * 构建重放热点列表
     */
    buildReplayHotspots(replayHotspots) {
        return replayHotspots.slice(0, this.config.maxReplayHotspots);
    }
    /**
     * 映射失败严重级别
     */
    mapFailureSeverity(count) {
        if (count >= 50) {
            return 'critical';
        }
        if (count >= 20) {
            return 'high';
        }
        if (count >= 5) {
            return 'medium';
        }
        return 'low';
    }
}
exports.OpsViewBuilder = OpsViewBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建运维视图构建器
 */
function createOpsViewBuilder(healthMetricsDataSource, opsSummaryDataSource, config) {
    return new OpsViewBuilder(healthMetricsDataSource, opsSummaryDataSource, config);
}
/**
 * 快速构建运维视图
 */
async function buildOpsView(healthMetricsDataSource, opsSummaryDataSource) {
    const builder = new OpsViewBuilder(healthMetricsDataSource, opsSummaryDataSource);
    return await builder.buildOpsView();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BzX3ZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvb3BzX3ZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQXNVSCxvREFNQztBQUtELG9DQU1DO0FBelNELCtFQUErRTtBQUMvRSxVQUFVO0FBQ1YsK0VBQStFO0FBRS9FLE1BQWEsY0FBYztJQUt6QixZQUNFLHVCQUFnRCxFQUNoRCxvQkFBMEMsRUFDMUMsU0FBK0IsRUFBRTtRQUVqQyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLEVBQUU7WUFDbkQsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixJQUFJLEVBQUU7WUFDL0MsY0FBYyxFQUFFLE1BQU0sQ0FBQyxjQUFjLElBQUksQ0FBQztZQUMxQyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCLElBQUksQ0FBQztTQUNqRCxDQUFDO1FBQ0YsSUFBSSxDQUFDLHVCQUF1QixHQUFHLHVCQUF1QixDQUFDO1FBQ3ZELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQztJQUNuRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsWUFBWTtRQUNoQixTQUFTO1FBQ1QsTUFBTSxjQUFjLEdBQUcsTUFBTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUU5RSxTQUFTO1FBQ1QsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFbkUsT0FBTztRQUNQLE9BQU87WUFDTCxhQUFhLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxVQUFVLENBQUM7WUFDdEUsV0FBVyxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsV0FBVyxJQUFJLENBQUM7WUFDcEQsZUFBZSxFQUFFLElBQUksQ0FBQyxvQkFBb0Is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LENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUVEOztPQUVHO0lBQ0ssa0JBQWtCLENBQUMsS0FBYTtRQUN0QyxJQUFJLEtBQUssSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUNoQixPQUFPLFVBQVUsQ0FBQztRQUNwQixDQUFDO1FBRUQsSUFBSSxLQUFLLElBQUksRUFBRSxFQUFFLENBQUM7WUFDaEIsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2YsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBM1FELHdDQTJRQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQ2xDLHVCQUFnRCxFQUNoRCxvQkFBMEMsRUFDMUMsTUFBNkI7SUFFN0IsT0FBTyxJQUFJLGNBQWMsQ0FBQyx1QkFBdUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNuRixDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsWUFBWSxDQUNoQyx1QkFBZ0QsRUFDaEQsb0JBQTBDO0lBRTFDLE1BQU0sT0FBTyxHQUFHLElBQUksY0FBYyxDQUFDLHVCQUF1QixFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDbEYsT0FBTyxNQUFNLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcHMgVmlldyAtIOi/kOe7tOinhuWbvlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOiBmuWQiCBTcHJpbnQgNSDnmoQgaGVhbHRoIC8gb3BzIHN1bW1hcnkgLyBhdWRpdCDmlbDmja5cbiAqIDIuIOi+k+WHuiBoZWFsdGggc2NvcmUgLyBkZWdyYWRlZCBzZXJ2ZXJzIC8gYmxvY2tlZCBza2lsbHMgLyByZXBsYXkgaG90c3BvdHMgLyB0b3AgZmFpbHVyZXNcbiAqIDMuIOaatOmcsuWfuuehgOi/kOe7tOWKqOS9nOWFpeWPo1xuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE9wc1ZpZXdNb2RlbCxcbiAgU2V2ZXJpdHksXG4gIFNlcnZlclN0YXR1cyxcbiAgQ29udHJvbEFjdGlvblJlc3VsdCxcbn0gZnJvbSAnLi9jb250cm9sX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5YGl5bq35oyH5qCH5pWw5o2u5rqQXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSGVhbHRoTWV0cmljc0RhdGFTb3VyY2Uge1xuICAvKiog6I635Y+W5YGl5bq35b+r54WnICovXG4gIGdldEhlYWx0aFNuYXBzaG90KCk6IFByb21pc2U8YW55Pjtcbn1cblxuLyoqXG4gKiDov5Dnu7TmkZjopoHmlbDmja7mupBcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcHNTdW1tYXJ5RGF0YVNvdXJjZSB7XG4gIC8qKiDojrflj5bov5Dnu7TmkZjopoEgKi9cbiAgZ2V0T3BzU3VtbWFyeSgpOiBQcm9taXNlPGFueT47XG59XG5cbi8qKlxuICog6L+Q57u06KeG5Zu+5p6E5bu65Zmo6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT3BzVmlld0J1aWxkZXJDb25maWcge1xuICAvKiog5pyA5aSn6ZmN57qnIFNlcnZlciDmlbAgKi9cbiAgbWF4RGVncmFkZWRTZXJ2ZXJzPzogbnVtYmVyO1xuICBcbiAgLyoqIOacgOWkp+iiq+mYu+WhniBTa2lsbCDmlbAgKi9cbiAgbWF4QmxvY2tlZFNraWxscz86IG51bWJlcjtcbiAgXG4gIC8qKiDmnIDlpKfpobbnuqflpLHotKXmlbAgKi9cbiAgbWF4VG9wRmFpbHVyZXM/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA5aSn6YeN5pS+54Ot54K55pWwICovXG4gIG1heFJlcGxheUhvdHNwb3RzPzogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDov5Dnu7Top4blm77mnoTlu7rlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIE9wc1ZpZXdCdWlsZGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPE9wc1ZpZXdCdWlsZGVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBoZWFsdGhNZXRyaWNzRGF0YVNvdXJjZTogSGVhbHRoTWV0cmljc0RhdGFTb3VyY2U7XG4gIHByaXZhdGUgb3BzU3VtbWFyeURhdGFTb3VyY2U6IE9wc1N1bW1hcnlEYXRhU291cmNlO1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgaGVhbHRoTWV0cmljc0RhdGFTb3VyY2U6IEhlYWx0aE1ldHJpY3NEYXRhU291cmNlLFxuICAgIG9wc1N1bW1hcnlEYXRhU291cmNlOiBPcHNTdW1tYXJ5RGF0YVNvdXJjZSxcbiAgICBjb25maWc6IE9wc1ZpZXdCdWlsZGVyQ29uZmlnID0ge31cbiAgKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhEZWdyYWRlZFNlcnZlcnM6IGNvbmZpZy5tYXhEZWdyYWRlZFNlcnZlcnMgPz8gMTAsXG4gICAgICBtYXhCbG9ja2VkU2tpbGxzOiBjb25maWcubWF4QmxvY2tlZFNraWxscyA/PyAyMCxcbiAgICAgIG1heFRvcEZhaWx1cmVzOiBjb25maWcubWF4VG9wRmFpbHVyZXMgPz8gNSxcbiAgICAgIG1heFJlcGxheUhvdHNwb3RzOiBjb25maWcubWF4UmVwbGF5SG90c3BvdHMgPz8gNSxcbiAgICB9O1xuICAgIHRoaXMuaGVhbHRoTWV0cmljc0RhdGFTb3VyY2UgPSBoZWFsdGhNZXRyaWNzRGF0YVNvdXJjZTtcbiAgICB0aGlzLm9wc1N1bW1hcnlEYXRhU291cmNlID0gb3BzU3VtbWFyeURhdGFTb3VyY2U7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rov5Dnu7Top4blm75cbiAgICovXG4gIGFzeW5jIGJ1aWxkT3BzVmlldygpOiBQcm9taXNlPE9wc1ZpZXdNb2RlbD4ge1xuICAgIC8vIOiOt+WPluWBpeW6t+W/q+eFp1xuICAgIGNvbnN0IGhlYWx0aFNuYXBzaG90ID0gYXdhaXQgdGhpcy5oZWFsdGhNZXRyaWNzRGF0YVNvdXJjZS5nZXRIZWFsdGhTbmFwc2hvdCgpO1xuICAgIFxuICAgIC8vIOiOt+WPlui/kOe7tOaRmOimgVxuICAgIGNvbnN0IG9wc1N1bW1hcnkgPSBhd2FpdCB0aGlzLm9wc1N1bW1hcnlEYXRhU291cmNlLmdldE9wc1N1bW1hcnkoKTtcbiAgICBcbiAgICAvLyDmnoTlu7rop4blm75cbiAgICByZXR1cm4ge1xuICAgICAgb3ZlcmFsbFN0YXR1czogdGhpcy5kZXRlcm1pbmVPdmVyYWxsU3RhdHVzKGhlYWx0aFNuYXBzaG90LCBvcHNTdW1tYXJ5KSxcbiAgICAgIGhlYWx0aFNjb3JlOiBoZWFsdGhTbmFwc2hvdC5nbG9iYWw/LmhlYWx0aFNjb3JlIHx8IDAsXG4gICAgICBkZWdyYWRlZFNlcnZlcnM6IHRoaXMuYnVpbGREZWdyYWRlZFNlcnZlcnMoaGVhbHRoU25hcHNob3QuYnlTZXJ2ZXIgfHwge30pLFxuICAgICAgYmxvY2tlZFNraWxsczogdGhpcy5idWlsZEJsb2NrZWRTa2lsbHMoaGVhbHRoU25hcHNob3QuYnlTa2lsbCB8fCB7fSksXG4gICAgICBwZW5kaW5nQXBwcm92YWxzOiBoZWFsdGhTbmFwc2hvdC5nbG9iYWw/LnBlbmRpbmdBcHByb3ZhbHMgfHwgMCxcbiAgICAgIGFjdGl2ZUluY2lkZW50czogdGhpcy5idWlsZEFjdGl2ZUluY2lkZW50cyhvcHNTdW1tYXJ5KSxcbiAgICAgIHRvcEZhaWx1cmVzOiB0aGlzLmJ1aWxkVG9wRmFpbHVyZXMob3BzU3VtbWFyeS50b3BGYWlsdXJlcyB8fCBbXSksXG4gICAgICByZXBsYXlIb3RzcG90czogdGhpcy5idWlsZFJlcGxheUhvdHNwb3RzKG9wc1N1bW1hcnkucmVwbGF5SG90c3BvdHMgfHwgW10pLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJflh7rpmY3nuqcgU2VydmVyXG4gICAqL1xuICBhc3luYyBsaXN0RGVncmFkZWRTZXJ2ZXJzKCk6IFByb21pc2U8T3BzVmlld01vZGVsWydkZWdyYWRlZFNlcnZlcnMnXT4ge1xuICAgIGNvbnN0IHZpZXcgPSBhd2FpdCB0aGlzLmJ1aWxkT3BzVmlldygpO1xuICAgIHJldHVybiB2aWV3LmRlZ3JhZGVkU2VydmVycztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIl+WHuuiiq+mYu+WhniBTa2lsbFxuICAgKi9cbiAgYXN5bmMgbGlzdEJsb2NrZWRTa2lsbHMoKTogUHJvbWlzZTxPcHNWaWV3TW9kZWxbJ2Jsb2NrZWRTa2lsbHMnXT4ge1xuICAgIGNvbnN0IHZpZXcgPSBhd2FpdCB0aGlzLmJ1aWxkT3BzVmlldygpO1xuICAgIHJldHVybiB2aWV3LmJsb2NrZWRTa2lsbHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJflh7rpobbnuqfkuovku7ZcbiAgICovXG4gIGFzeW5jIGxpc3RUb3BJbmNpZGVudHMoKTogUHJvbWlzZTxPcHNWaWV3TW9kZWxbJ2FjdGl2ZUluY2lkZW50cyddPiB7XG4gICAgY29uc3QgdmlldyA9IGF3YWl0IHRoaXMuYnVpbGRPcHNWaWV3KCk7XG4gICAgcmV0dXJuIHZpZXcuYWN0aXZlSW5jaWRlbnRzO1xuICB9XG4gIFxuICAvKipcbiAgICog56Gu6K6k5LqL5Lu2XG4gICAqL1xuICBhc3luYyBhY2tJbmNpZGVudChpbmNpZGVudElkOiBzdHJpbmcpOiBQcm9taXNlPENvbnRyb2xBY3Rpb25SZXN1bHQ+IHtcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6XosIPnlKjkuovku7bnrqHnkIbns7vnu59cbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGFjdGlvblR5cGU6ICdhY2tfaW5jaWRlbnQnLFxuICAgICAgdGFyZ2V0SWQ6IGluY2lkZW50SWQsXG4gICAgICBtZXNzYWdlOiBgSW5jaWRlbnQgJHtpbmNpZGVudElkfSBhY2tub3dsZWRnZWRgLFxuICAgICAgbmV4dEFjdGlvbnM6IFsncmVxdWVzdF9yZWNvdmVyeSddLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDor7fmsYLph43mlL5cbiAgICovXG4gIGFzeW5jIHJlcXVlc3RSZXBsYXkodGFza0lkOiBzdHJpbmcpOiBQcm9taXNlPENvbnRyb2xBY3Rpb25SZXN1bHQ+IHtcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6XosIPnlKggUmVjb3Zlcnkg57O757ufXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZXBsYXknLFxuICAgICAgdGFyZ2V0SWQ6IHRhc2tJZCxcbiAgICAgIG1lc3NhZ2U6IGBSZXBsYXkgcmVxdWVzdGVkIGZvciB0YXNrICR7dGFza0lkfWAsXG4gICAgICBuZXh0QWN0aW9uczogW10sXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivt+axguaBouWkjVxuICAgKi9cbiAgYXN5bmMgcmVxdWVzdFJlY292ZXJ5KHRhc2tJZDogc3RyaW5nKTogUHJvbWlzZTxDb250cm9sQWN0aW9uUmVzdWx0PiB7XG4gICAgLy8g566A5YyW5a6e546w77ya5a6e6ZmF5bqU6K+l6LCD55SoIFJlY292ZXJ5IOezu+e7n1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgYWN0aW9uVHlwZTogJ3JlcXVlc3RfcmVjb3ZlcnknLFxuICAgICAgdGFyZ2V0SWQ6IHRhc2tJZCxcbiAgICAgIG1lc3NhZ2U6IGBSZWNvdmVyeSByZXF1ZXN0ZWQgZm9yIHRhc2sgJHt0YXNrSWR9YCxcbiAgICAgIG5leHRBY3Rpb25zOiBbXSxcbiAgICB9O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog56Gu5a6a5oC75L2T54q25oCBXG4gICAqL1xuICBwcml2YXRlIGRldGVybWluZU92ZXJhbGxTdGF0dXMoXG4gICAgaGVhbHRoU25hcHNob3Q6IGFueSxcbiAgICBvcHNTdW1tYXJ5OiBhbnlcbiAgKTogJ2hlYWx0aHknIHwgJ2RlZ3JhZGVkJyB8ICdjcml0aWNhbCcge1xuICAgIGNvbnN0IGhlYWx0aFNjb3JlID0gaGVhbHRoU25hcHNob3QuZ2xvYmFsPy5oZWFsdGhTY29yZSB8fCAxMDA7XG4gICAgXG4gICAgaWYgKGhlYWx0aFNjb3JlIDwgNTApIHtcbiAgICAgIHJldHVybiAnY3JpdGljYWwnO1xuICAgIH1cbiAgICBcbiAgICBpZiAoaGVhbHRoU2NvcmUgPCA3MCkge1xuICAgICAgcmV0dXJuICdkZWdyYWRlZCc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiAnaGVhbHRoeSc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rpmY3nuqcgU2VydmVyIOWIl+ihqFxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZERlZ3JhZGVkU2VydmVycyhcbiAgICBieVNlcnZlcjogUmVjb3JkPHN0cmluZywgYW55PlxuICApOiBPcHNWaWV3TW9kZWxbJ2RlZ3JhZGVkU2VydmVycyddIHtcbiAgICBjb25zdCBkZWdyYWRlZDogT3BzVmlld01vZGVsWydkZWdyYWRlZFNlcnZlcnMnXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgW3NlcnZlcklkLCBtZXRyaWNzXSBvZiBPYmplY3QuZW50cmllcyhieVNlcnZlcikpIHtcbiAgICAgIGlmIChtZXRyaWNzLmhlYWx0aFN0YXR1cyAhPT0gJ2hlYWx0aHknKSB7XG4gICAgICAgIGRlZ3JhZGVkLnB1c2goe1xuICAgICAgICAgIHNlcnZlcklkLFxuICAgICAgICAgIHN0YXR1czogbWV0cmljcy5oZWFsdGhTdGF0dXMgYXMgU2VydmVyU3RhdHVzLFxuICAgICAgICAgIGVycm9yUmF0ZTogbWV0cmljcy5lcnJvclJhdGUgfHwgMCxcbiAgICAgICAgICBsYXN0Q2hlY2s6IG1ldHJpY3MubGFzdENoZWNrIHx8IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmjInplJnor6/njofmjpLluo9cbiAgICBkZWdyYWRlZC5zb3J0KChhLCBiKSA9PiBiLmVycm9yUmF0ZSAtIGEuZXJyb3JSYXRlKTtcbiAgICBcbiAgICByZXR1cm4gZGVncmFkZWQuc2xpY2UoMCwgdGhpcy5jb25maWcubWF4RGVncmFkZWRTZXJ2ZXJzKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuiiq+mYu+WhniBTa2lsbCDliJfooahcbiAgICovXG4gIHByaXZhdGUgYnVpbGRCbG9ja2VkU2tpbGxzKFxuICAgIGJ5U2tpbGw6IFJlY29yZDxzdHJpbmcsIGFueT5cbiAgKTogT3BzVmlld01vZGVsWydibG9ja2VkU2tpbGxzJ10ge1xuICAgIGNvbnN0IGJsb2NrZWQ6IE9wc1ZpZXdNb2RlbFsnYmxvY2tlZFNraWxscyddID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBbc2tpbGxOYW1lLCBtZXRyaWNzXSBvZiBPYmplY3QuZW50cmllcyhieVNraWxsKSkge1xuICAgICAgaWYgKG1ldHJpY3MuYmxvY2tlZEZyZXF1ZW5jeSA+IDAgfHwgbWV0cmljcy5wZW5kaW5nRnJlcXVlbmN5ID4gMCkge1xuICAgICAgICBibG9ja2VkLnB1c2goe1xuICAgICAgICAgIHNraWxsTmFtZSxcbiAgICAgICAgICBzdGF0dXM6IG1ldHJpY3MuYmxvY2tlZEZyZXF1ZW5jeSA+IDAgPyAnYmxvY2tlZCcgOiAncGVuZGluZycsXG4gICAgICAgICAgY291bnQ6IG1ldHJpY3MuYmxvY2tlZEZyZXF1ZW5jeSB8fCBtZXRyaWNzLnBlbmRpbmdGcmVxdWVuY3kgfHwgMCxcbiAgICAgICAgICByZWFzb246IHRoaXMuZ2V0QmxvY2tlZFJlYXNvbihtZXRyaWNzKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaMieaVsOmHj+aOkuW6j1xuICAgIGJsb2NrZWQuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgIFxuICAgIHJldHVybiBibG9ja2VkLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heEJsb2NrZWRTa2lsbHMpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6Zi75aGe5Y6f5ZugXG4gICAqL1xuICBwcml2YXRlIGdldEJsb2NrZWRSZWFzb24obWV0cmljczogYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAobWV0cmljcy5jb21wYXRpYmlsaXR5SXNzdWVzID4gMCkge1xuICAgICAgcmV0dXJuIGBDb21wYXRpYmlsaXR5IGlzc3VlczogJHttZXRyaWNzLmNvbXBhdGliaWxpdHlJc3N1ZXN9YDtcbiAgICB9XG4gICAgXG4gICAgaWYgKG1ldHJpY3MubG9hZFN1Y2Nlc3NSYXRlIDwgMC41KSB7XG4gICAgICByZXR1cm4gYExvdyBsb2FkIHN1Y2Nlc3MgcmF0ZTogJHsobWV0cmljcy5sb2FkU3VjY2Vzc1JhdGUgKiAxMDApLnRvRml4ZWQoMSl9JWA7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rmtLvot4Pkuovku7bliJfooahcbiAgICovXG4gIHByaXZhdGUgYnVpbGRBY3RpdmVJbmNpZGVudHMob3BzU3VtbWFyeTogYW55KTogT3BzVmlld01vZGVsWydhY3RpdmVJbmNpZGVudHMnXSB7XG4gICAgY29uc3QgaW5jaWRlbnRzOiBPcHNWaWV3TW9kZWxbJ2FjdGl2ZUluY2lkZW50cyddID0gW107XG4gICAgXG4gICAgLy8g5LuO6aG257qn5aSx6LSl5Yib5bu65LqL5Lu2XG4gICAgaWYgKG9wc1N1bW1hcnkudG9wRmFpbHVyZXMpIHtcbiAgICAgIGZvciAoY29uc3QgZmFpbHVyZSBvZiBvcHNTdW1tYXJ5LnRvcEZhaWx1cmVzLnNsaWNlKDAsIDUpKSB7XG4gICAgICAgIGluY2lkZW50cy5wdXNoKHtcbiAgICAgICAgICBpZDogYGluY2lkZW50XyR7ZmFpbHVyZS5jYXRlZ29yeX1gLFxuICAgICAgICAgIHR5cGU6ICdmYWlsdXJlJyxcbiAgICAgICAgICBzZXZlcml0eTogdGhpcy5tYXBGYWlsdXJlU2V2ZXJpdHkoZmFpbHVyZS5jb3VudCksXG4gICAgICAgICAgZGVzY3JpcHRpb246IGAke2ZhaWx1cmUuY2F0ZWdvcnl9OiAke2ZhaWx1cmUuY291bnR9IGV2ZW50c2AsXG4gICAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIGFja25vd2xlZGdlZDogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDku47pmY3nuqcgU2VydmVyIOWIm+W7uuS6i+S7tlxuICAgIGlmIChvcHNTdW1tYXJ5LmRlZ3JhZGVkU2VydmVycykge1xuICAgICAgZm9yIChjb25zdCBzZXJ2ZXIgb2Ygb3BzU3VtbWFyeS5kZWdyYWRlZFNlcnZlcnMuc2xpY2UoMCwgMykpIHtcbiAgICAgICAgaW5jaWRlbnRzLnB1c2goe1xuICAgICAgICAgIGlkOiBgaW5jaWRlbnRfc2VydmVyXyR7c2VydmVyLnNlcnZlcklkfWAsXG4gICAgICAgICAgdHlwZTogJ3NlcnZlcl9kZWdyYWRlZCcsXG4gICAgICAgICAgc2V2ZXJpdHk6IHNlcnZlci5zdGF0dXMgPT09ICd1bmF2YWlsYWJsZScgPyAnY3JpdGljYWwnIDogJ2hpZ2gnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgU2VydmVyICR7c2VydmVyLnNlcnZlcklkfSBpcyAke3NlcnZlci5zdGF0dXN9YCxcbiAgICAgICAgICBjcmVhdGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgICAgYWNrbm93bGVkZ2VkOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBpbmNpZGVudHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rpobbnuqflpLHotKXliJfooahcbiAgICovXG4gIHByaXZhdGUgYnVpbGRUb3BGYWlsdXJlcyh0b3BGYWlsdXJlczogYW55W10pOiBPcHNWaWV3TW9kZWxbJ3RvcEZhaWx1cmVzJ10ge1xuICAgIHJldHVybiB0b3BGYWlsdXJlcy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhUb3BGYWlsdXJlcyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rph43mlL7ng63ngrnliJfooahcbiAgICovXG4gIHByaXZhdGUgYnVpbGRSZXBsYXlIb3RzcG90cyhyZXBsYXlIb3RzcG90czogYW55W10pOiBPcHNWaWV3TW9kZWxbJ3JlcGxheUhvdHNwb3RzJ10ge1xuICAgIHJldHVybiByZXBsYXlIb3RzcG90cy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhSZXBsYXlIb3RzcG90cyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmmKDlsITlpLHotKXkuKXph43nuqfliKtcbiAgICovXG4gIHByaXZhdGUgbWFwRmFpbHVyZVNldmVyaXR5KGNvdW50OiBudW1iZXIpOiBTZXZlcml0eSB7XG4gICAgaWYgKGNvdW50ID49IDUwKSB7XG4gICAgICByZXR1cm4gJ2NyaXRpY2FsJztcbiAgICB9XG4gICAgXG4gICAgaWYgKGNvdW50ID49IDIwKSB7XG4gICAgICByZXR1cm4gJ2hpZ2gnO1xuICAgIH1cbiAgICBcbiAgICBpZiAoY291bnQgPj0gNSkge1xuICAgICAgcmV0dXJuICdtZWRpdW0nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gJ2xvdyc7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66L+Q57u06KeG5Zu+5p6E5bu65ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcHNWaWV3QnVpbGRlcihcbiAgaGVhbHRoTWV0cmljc0RhdGFTb3VyY2U6IEhlYWx0aE1ldHJpY3NEYXRhU291cmNlLFxuICBvcHNTdW1tYXJ5RGF0YVNvdXJjZTogT3BzU3VtbWFyeURhdGFTb3VyY2UsXG4gIGNvbmZpZz86IE9wc1ZpZXdCdWlsZGVyQ29uZmlnXG4pOiBPcHNWaWV3QnVpbGRlciB7XG4gIHJldHVybiBuZXcgT3BzVmlld0J1aWxkZXIoaGVhbHRoTWV0cmljc0RhdGFTb3VyY2UsIG9wc1N1bW1hcnlEYXRhU291cmNlLCBjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+aehOW7uui/kOe7tOinhuWbvlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRPcHNWaWV3KFxuICBoZWFsdGhNZXRyaWNzRGF0YVNvdXJjZTogSGVhbHRoTWV0cmljc0RhdGFTb3VyY2UsXG4gIG9wc1N1bW1hcnlEYXRhU291cmNlOiBPcHNTdW1tYXJ5RGF0YVNvdXJjZVxuKTogUHJvbWlzZTxPcHNWaWV3TW9kZWw+IHtcbiAgY29uc3QgYnVpbGRlciA9IG5ldyBPcHNWaWV3QnVpbGRlcihoZWFsdGhNZXRyaWNzRGF0YVNvdXJjZSwgb3BzU3VtbWFyeURhdGFTb3VyY2UpO1xuICByZXR1cm4gYXdhaXQgYnVpbGRlci5idWlsZE9wc1ZpZXcoKTtcbn1cbiJdfQ==