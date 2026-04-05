"use strict";
/**
 * Server Health - Server 健康检查
 *
 * 职责：
 * 1. 跟踪 server health
 * 2. 标记 available / degraded / unavailable
 * 3. 给 orchestrator / planner / release_agent 提供 admission 信息
 * 4. 与并发治理、backpressure、熔断衔接
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerHealthManager = void 0;
exports.createServerHealthManager = createServerHealthManager;
// ============================================================================
// Server 健康管理器
// ============================================================================
class ServerHealthManager {
    constructor(config = {}) {
        // 健康记录：serverId → records
        this.healthRecords = new Map();
        // 当前状态：serverId → status
        this.currentStatus = new Map();
        // 最后报告：serverId → report
        this.lastReports = new Map();
        this.config = {
            checkIntervalMs: config.checkIntervalMs ?? 30000, // 30 秒
            degradedThreshold: config.degradedThreshold ?? 0.2, // 20% 错误率
            unavailableThreshold: config.unavailableThreshold ?? 0.5, // 50% 错误率
            healthWindowSize: config.healthWindowSize ?? 10, // 10 个样本
        };
    }
    /**
     * 报告 Server 健康状态
     */
    reportServerHealth(serverId, status, details) {
        const report = {
            serverId,
            status,
            details,
            reportedAt: Date.now(),
        };
        this.lastReports.set(serverId, report);
        this.currentStatus.set(serverId, status);
    }
    /**
     * 记录健康检查
     */
    recordHealthCheck(serverId, success, responseTimeMs, error) {
        const record = {
            timestamp: Date.now(),
            success,
            responseTimeMs,
            error,
        };
        // 获取或创建记录列表
        let records = this.healthRecords.get(serverId);
        if (!records) {
            records = [];
            this.healthRecords.set(serverId, records);
        }
        // 添加记录
        records.push(record);
        // 限制窗口大小
        if (records.length > this.config.healthWindowSize) {
            records.shift();
        }
        // 更新状态
        this.updateServerStatus(serverId);
    }
    /**
     * 获取 Server 健康状态
     */
    getServerHealth(serverId) {
        return this.lastReports.get(serverId) || null;
    }
    /**
     * 检查 Server 是否可用
     */
    isServerUsable(serverId, requirementLevel) {
        const status = this.currentStatus.get(serverId) || 'unknown';
        switch (status) {
            case 'healthy':
                return true;
            case 'degraded':
                // required server 在降级时仍可用，但应该降低优先级
                return true;
            case 'unavailable':
                // required server 不可用时返回 false
                // optional server 不可用时返回 true（但功能受限）
                return requirementLevel !== 'required';
            case 'unknown':
                // 未知状态默认允许
                return true;
            default:
                return false;
        }
    }
    /**
     * 构建健康摘要
     */
    buildHealthSummary(serverIds) {
        const servers = {};
        let healthyCount = 0;
        let degradedCount = 0;
        let unavailableCount = 0;
        for (const serverId of serverIds) {
            const report = this.getServerHealth(serverId);
            if (report) {
                servers[serverId] = report;
                switch (report.status) {
                    case 'healthy':
                        healthyCount++;
                        break;
                    case 'degraded':
                        degradedCount++;
                        break;
                    case 'unavailable':
                        unavailableCount++;
                        break;
                }
            }
            else {
                // 无报告视为 unknown
                servers[serverId] = {
                    serverId,
                    status: 'unknown',
                    reportedAt: Date.now(),
                };
            }
        }
        return {
            servers,
            healthyCount,
            degradedCount,
            unavailableCount,
            snapshotAt: Date.now(),
        };
    }
    /**
     * 获取所有 Server 状态
     */
    getAllServerStatus() {
        return Object.fromEntries(this.currentStatus.entries());
    }
    /**
     * 清除 Server 健康记录
     */
    clearServerHealth(serverId) {
        this.healthRecords.delete(serverId);
        this.currentStatus.delete(serverId);
        this.lastReports.delete(serverId);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 更新 Server 状态
     */
    updateServerStatus(serverId) {
        const records = this.healthRecords.get(serverId);
        if (!records || records.length === 0) {
            this.currentStatus.set(serverId, 'unknown');
            return;
        }
        // 计算错误率
        const failures = records.filter(r => !r.success).length;
        const errorRate = failures / records.length;
        // 确定状态
        let status;
        if (errorRate >= this.config.unavailableThreshold) {
            status = 'unavailable';
        }
        else if (errorRate >= this.config.degradedThreshold) {
            status = 'degraded';
        }
        else {
            status = 'healthy';
        }
        this.currentStatus.set(serverId, status);
        // 更新报告
        const lastRecord = records[records.length - 1];
        this.lastReports.set(serverId, {
            serverId,
            status,
            details: {
                lastCheckAt: lastRecord.timestamp,
                error: lastRecord.error,
                responseTimeMs: lastRecord.responseTimeMs,
                successRate: 1 - errorRate,
            },
            reportedAt: Date.now(),
        });
    }
}
exports.ServerHealthManager = ServerHealthManager;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 Server 健康管理器
 */
function createServerHealthManager(config) {
    return new ServerHealthManager(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyX2hlYWx0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tY3Avc2VydmVyX2hlYWx0aC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7OztBQXFSSCw4REFFQztBQWhQRCwrRUFBK0U7QUFDL0UsZUFBZTtBQUNmLCtFQUErRTtBQUUvRSxNQUFhLG1CQUFtQjtJQVk5QixZQUFZLFNBQTZCLEVBQUU7UUFUM0MsMEJBQTBCO1FBQ2xCLGtCQUFhLEdBQWdDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFL0QseUJBQXlCO1FBQ2pCLGtCQUFhLEdBQXVDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFdEUseUJBQXlCO1FBQ2pCLGdCQUFXLEdBQXVDLElBQUksR0FBRyxFQUFFLENBQUM7UUFHbEUsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLEtBQUssRUFBRSxPQUFPO1lBQ3pELGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxHQUFHLEVBQUUsVUFBVTtZQUM5RCxvQkFBb0IsRUFBRSxNQUFNLENBQUMsb0JBQW9CLElBQUksR0FBRyxFQUFFLFVBQVU7WUFDcEUsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixJQUFJLEVBQUUsRUFBRSxTQUFTO1NBQzNELENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxrQkFBa0IsQ0FDaEIsUUFBZ0IsRUFDaEIsTUFBNkIsRUFDN0IsT0FLQztRQUVELE1BQU0sTUFBTSxHQUEwQjtZQUNwQyxRQUFRO1lBQ1IsTUFBTTtZQUNOLE9BQU87WUFDUCxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFD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QyxPQUFPO1FBQ1AsSUFBSSxNQUE2QixDQUFDO1FBRWxDLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNsRCxNQUFNLEdBQUcsYUFBYSxDQUFDO1FBQ3pCLENBQUM7YUFBTSxJQUFJLFNBQVMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDdEQsTUFBTSxHQUFHLFVBQVUsQ0FBQztRQUN0QixDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFDckIsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV6QyxPQUFPO1FBQ1AsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQzdCLFFBQVE7WUFDUixNQUFNO1lBQ04sT0FBTyxFQUFFO2dCQUNQLFdBQVcsRUFBRSxVQUFVLENBQUMsU0FBUztnQkFDakMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLO2dCQUN2QixjQUFjLEVBQUUsVUFBVSxDQUFDLGNBQWM7Z0JBQ3pDLFdBQVcsRUFBRSxDQUFDLEdBQUcsU0FBUzthQUMzQjtZQUNELFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3ZCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpPRCxrREFpT0M7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHlCQUF5QixDQUFDLE1BQTJCO0lBQ25FLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTZXJ2ZXIgSGVhbHRoIC0gU2VydmVyIOWBpeW6t+ajgOafpVxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOi3n+i4qiBzZXJ2ZXIgaGVhbHRoXG4gKiAyLiDmoIforrAgYXZhaWxhYmxlIC8gZGVncmFkZWQgLyB1bmF2YWlsYWJsZVxuICogMy4g57uZIG9yY2hlc3RyYXRvciAvIHBsYW5uZXIgLyByZWxlYXNlX2FnZW50IOaPkOS+myBhZG1pc3Npb24g5L+h5oGvXG4gKiA0LiDkuI7lubblj5HmsrvnkIbjgIFiYWNrcHJlc3N1cmXjgIHnhpTmlq3ooZTmjqVcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBNY3BTZXJ2ZXJIZWFsdGhTdGF0dXMsXG4gIE1jcFNlcnZlckhlYWx0aFJlcG9ydCxcbiAgTWNwSGVhbHRoU25hcHNob3QsXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDlgaXlurfmo4Dmn6XphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJ2ZXJIZWFsdGhDb25maWcge1xuICAvKiog5YGl5bq35qOA5p+l6Ze06ZqU77yI5q+r56eS77yJICovXG4gIGNoZWNrSW50ZXJ2YWxNcz86IG51bWJlcjtcbiAgXG4gIC8qKiDpmY3nuqfpmIjlgLzvvIjplJnor6/njofvvIkgKi9cbiAgZGVncmFkZWRUaHJlc2hvbGQ/OiBudW1iZXI7XG4gIFxuICAvKiog5LiN5Y+v55So6ZiI5YC877yI6ZSZ6K+v546H77yJICovXG4gIHVuYXZhaWxhYmxlVGhyZXNob2xkPzogbnVtYmVyO1xuICBcbiAgLyoqIOWBpeW6t+eql+WPo+Wkp+WwjyAqL1xuICBoZWFsdGhXaW5kb3dTaXplPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIOWBpeW6t+iusOW9lVxuICovXG5pbnRlcmZhY2UgSGVhbHRoUmVjb3JkIHtcbiAgdGltZXN0YW1wOiBudW1iZXI7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHJlc3BvbnNlVGltZU1zPzogbnVtYmVyO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2VydmVyIOWBpeW6t+euoeeQhuWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgU2VydmVySGVhbHRoTWFuYWdlciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxTZXJ2ZXJIZWFsdGhDb25maWc+O1xuICBcbiAgLy8g5YGl5bq36K6w5b2V77yac2VydmVySWQg4oaSIHJlY29yZHNcbiAgcHJpdmF0ZSBoZWFsdGhSZWNvcmRzOiBNYXA8c3RyaW5nLCBIZWFsdGhSZWNvcmRbXT4gPSBuZXcgTWFwKCk7XG4gIFxuICAvLyDlvZPliY3nirbmgIHvvJpzZXJ2ZXJJZCDihpIgc3RhdHVzXG4gIHByaXZhdGUgY3VycmVudFN0YXR1czogTWFwPHN0cmluZywgTWNwU2VydmVySGVhbHRoU3RhdHVzPiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIOacgOWQjuaKpeWRiu+8mnNlcnZlcklkIOKGkiByZXBvcnRcbiAgcHJpdmF0ZSBsYXN0UmVwb3J0czogTWFwPHN0cmluZywgTWNwU2VydmVySGVhbHRoUmVwb3J0PiA9IG5ldyBNYXAoKTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogU2VydmVySGVhbHRoQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGNoZWNrSW50ZXJ2YWxNczogY29uZmlnLmNoZWNrSW50ZXJ2YWxNcyA/PyAzMDAwMCwgLy8gMzAg56eSXG4gICAgICBkZWdyYWRlZFRocmVzaG9sZDogY29uZmlnLmRlZ3JhZGVkVGhyZXNob2xkID8/IDAuMiwgLy8gMjAlIOmUmeivr+eOh1xuICAgICAgdW5hdmFpbGFibGVUaHJlc2hvbGQ6IGNvbmZpZy51bmF2YWlsYWJsZVRocmVzaG9sZCA/PyAwLjUsIC8vIDUwJSDplJnor6/njodcbiAgICAgIGhlYWx0aFdpbmRvd1NpemU6IGNvbmZpZy5oZWFsdGhXaW5kb3dTaXplID8/IDEwLCAvLyAxMCDkuKrmoLfmnKxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5oql5ZGKIFNlcnZlciDlgaXlurfnirbmgIFcbiAgICovXG4gIHJlcG9ydFNlcnZlckhlYWx0aChcbiAgICBzZXJ2ZXJJZDogc3RyaW5nLFxuICAgIHN0YXR1czogTWNwU2VydmVySGVhbHRoU3RhdHVzLFxuICAgIGRldGFpbHM/OiB7XG4gICAgICBsYXN0Q2hlY2tBdD86IG51bWJlcjtcbiAgICAgIGVycm9yPzogc3RyaW5nO1xuICAgICAgcmVzcG9uc2VUaW1lTXM/OiBudW1iZXI7XG4gICAgICBzdWNjZXNzUmF0ZT86IG51bWJlcjtcbiAgICB9XG4gICk6IHZvaWQge1xuICAgIGNvbnN0IHJlcG9ydDogTWNwU2VydmVySGVhbHRoUmVwb3J0ID0ge1xuICAgICAgc2VydmVySWQsXG4gICAgICBzdGF0dXMsXG4gICAgICBkZXRhaWxzLFxuICAgICAgcmVwb3J0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIHRoaXMubGFzdFJlcG9ydHMuc2V0KHNlcnZlcklkLCByZXBvcnQpO1xuICAgIHRoaXMuY3VycmVudFN0YXR1cy5zZXQoc2VydmVySWQsIHN0YXR1cyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorrDlvZXlgaXlurfmo4Dmn6VcbiAgICovXG4gIHJlY29yZEhlYWx0aENoZWNrKFxuICAgIHNlcnZlcklkOiBzdHJpbmcsXG4gICAgc3VjY2VzczogYm9vbGVhbixcbiAgICByZXNwb25zZVRpbWVNcz86IG51bWJlcixcbiAgICBlcnJvcj86IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zdCByZWNvcmQ6IEhlYWx0aFJlY29yZCA9IHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIHN1Y2Nlc3MsXG4gICAgICByZXNwb25zZVRpbWVNcyxcbiAgICAgIGVycm9yLFxuICAgIH07XG4gICAgXG4gICAgLy8g6I635Y+W5oiW5Yib5bu66K6w5b2V5YiX6KGoXG4gICAgbGV0IHJlY29yZHMgPSB0aGlzLmhlYWx0aFJlY29yZHMuZ2V0KHNlcnZlcklkKTtcbiAgICBpZiAoIXJlY29yZHMpIHtcbiAgICAgIHJlY29yZHMgPSBbXTtcbiAgICAgIHRoaXMuaGVhbHRoUmVjb3Jkcy5zZXQoc2VydmVySWQsIHJlY29yZHMpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmt7vliqDorrDlvZVcbiAgICByZWNvcmRzLnB1c2gocmVjb3JkKTtcbiAgICBcbiAgICAvLyDpmZDliLbnqpflj6PlpKflsI9cbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiB0aGlzLmNvbmZpZy5oZWFsdGhXaW5kb3dTaXplKSB7XG4gICAgICByZWNvcmRzLnNoaWZ0KCk7XG4gICAgfVxuICAgIFxuICAgIC8vIOabtOaWsOeKtuaAgVxuICAgIHRoaXMudXBkYXRlU2VydmVyU3RhdHVzKHNlcnZlcklkKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPliBTZXJ2ZXIg5YGl5bq354q25oCBXG4gICAqL1xuICBnZXRTZXJ2ZXJIZWFsdGgoc2VydmVySWQ6IHN0cmluZyk6IE1jcFNlcnZlckhlYWx0aFJlcG9ydCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmxhc3RSZXBvcnRzLmdldChzZXJ2ZXJJZCkgfHwgbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpSBTZXJ2ZXIg5piv5ZCm5Y+v55SoXG4gICAqL1xuICBpc1NlcnZlclVzYWJsZShcbiAgICBzZXJ2ZXJJZDogc3RyaW5nLFxuICAgIHJlcXVpcmVtZW50TGV2ZWw/OiAncmVxdWlyZWQnIHwgJ29wdGlvbmFsJ1xuICApOiBib29sZWFuIHtcbiAgICBjb25zdCBzdGF0dXMgPSB0aGlzLmN1cnJlbnRTdGF0dXMuZ2V0KHNlcnZlcklkKSB8fCAndW5rbm93bic7XG4gICAgXG4gICAgc3dpdGNoIChzdGF0dXMpIHtcbiAgICAgIGNhc2UgJ2hlYWx0aHknOlxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgXG4gICAgICBjYXNlICdkZWdyYWRlZCc6XG4gICAgICAgIC8vIHJlcXVpcmVkIHNlcnZlciDlnKjpmY3nuqfml7bku43lj6/nlKjvvIzkvYblupTor6XpmY3kvY7kvJjlhYjnuqdcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIFxuICAgICAgY2FzZSAndW5hdmFpbGFibGUnOlxuICAgICAgICAvLyByZXF1aXJlZCBzZXJ2ZXIg5LiN5Y+v55So5pe26L+U5ZueIGZhbHNlXG4gICAgICAgIC8vIG9wdGlvbmFsIHNlcnZlciDkuI3lj6/nlKjml7bov5Tlm54gdHJ1Ze+8iOS9huWKn+iDveWPl+mZkO+8iVxuICAgICAgICByZXR1cm4gcmVxdWlyZW1lbnRMZXZlbCAhPT0gJ3JlcXVpcmVkJztcbiAgICAgICAgXG4gICAgICBjYXNlICd1bmtub3duJzpcbiAgICAgICAgLy8g5pyq55+l54q25oCB6buY6K6k5YWB6K64XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICBcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rlgaXlurfmkZjopoFcbiAgICovXG4gIGJ1aWxkSGVhbHRoU3VtbWFyeShzZXJ2ZXJJZHM6IHN0cmluZ1tdKTogTWNwSGVhbHRoU25hcHNob3Qge1xuICAgIGNvbnN0IHNlcnZlcnM6IFJlY29yZDxzdHJpbmcsIE1jcFNlcnZlckhlYWx0aFJlcG9ydD4gPSB7fTtcbiAgICBsZXQgaGVhbHRoeUNvdW50ID0gMDtcbiAgICBsZXQgZGVncmFkZWRDb3VudCA9IDA7XG4gICAgbGV0IHVuYXZhaWxhYmxlQ291bnQgPSAwO1xuICAgIFxuICAgIGZvciAoY29uc3Qgc2VydmVySWQgb2Ygc2VydmVySWRzKSB7XG4gICAgICBjb25zdCByZXBvcnQgPSB0aGlzLmdldFNlcnZlckhlYWx0aChzZXJ2ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChyZXBvcnQpIHtcbiAgICAgICAgc2VydmVyc1tzZXJ2ZXJJZF0gPSByZXBvcnQ7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHJlcG9ydC5zdGF0dXMpIHtcbiAgICAgICAgICBjYXNlICdoZWFsdGh5JzpcbiAgICAgICAgICAgIGhlYWx0aHlDb3VudCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZGVncmFkZWQnOlxuICAgICAgICAgICAgZGVncmFkZWRDb3VudCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAndW5hdmFpbGFibGUnOlxuICAgICAgICAgICAgdW5hdmFpbGFibGVDb3VudCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOaXoOaKpeWRiuinhuS4uiB1bmtub3duXG4gICAgICAgIHNlcnZlcnNbc2VydmVySWRdID0ge1xuICAgICAgICAgIHNlcnZlcklkLFxuICAgICAgICAgIHN0YXR1czogJ3Vua25vd24nLFxuICAgICAgICAgIHJlcG9ydGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzZXJ2ZXJzLFxuICAgICAgaGVhbHRoeUNvdW50LFxuICAgICAgZGVncmFkZWRDb3VudCxcbiAgICAgIHVuYXZhaWxhYmxlQ291bnQsXG4gICAgICBzbmFwc2hvdEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bmiYDmnIkgU2VydmVyIOeKtuaAgVxuICAgKi9cbiAgZ2V0QWxsU2VydmVyU3RhdHVzKCk6IFJlY29yZDxzdHJpbmcsIE1jcFNlcnZlckhlYWx0aFN0YXR1cz4ge1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXModGhpcy5jdXJyZW50U3RhdHVzLmVudHJpZXMoKSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmuIXpmaQgU2VydmVyIOWBpeW6t+iusOW9lVxuICAgKi9cbiAgY2xlYXJTZXJ2ZXJIZWFsdGgoc2VydmVySWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuaGVhbHRoUmVjb3Jkcy5kZWxldGUoc2VydmVySWQpO1xuICAgIHRoaXMuY3VycmVudFN0YXR1cy5kZWxldGUoc2VydmVySWQpO1xuICAgIHRoaXMubGFzdFJlcG9ydHMuZGVsZXRlKHNlcnZlcklkKTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOabtOaWsCBTZXJ2ZXIg54q25oCBXG4gICAqL1xuICBwcml2YXRlIHVwZGF0ZVNlcnZlclN0YXR1cyhzZXJ2ZXJJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgcmVjb3JkcyA9IHRoaXMuaGVhbHRoUmVjb3Jkcy5nZXQoc2VydmVySWQpO1xuICAgIFxuICAgIGlmICghcmVjb3JkcyB8fCByZWNvcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnNldChzZXJ2ZXJJZCwgJ3Vua25vd24nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8g6K6h566X6ZSZ6K+v546HXG4gICAgY29uc3QgZmFpbHVyZXMgPSByZWNvcmRzLmZpbHRlcihyID0+ICFyLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICBjb25zdCBlcnJvclJhdGUgPSBmYWlsdXJlcyAvIHJlY29yZHMubGVuZ3RoO1xuICAgIFxuICAgIC8vIOehruWumueKtuaAgVxuICAgIGxldCBzdGF0dXM6IE1jcFNlcnZlckhlYWx0aFN0YXR1cztcbiAgICBcbiAgICBpZiAoZXJyb3JSYXRlID49IHRoaXMuY29uZmlnLnVuYXZhaWxhYmxlVGhyZXNob2xkKSB7XG4gICAgICBzdGF0dXMgPSAndW5hdmFpbGFibGUnO1xuICAgIH0gZWxzZSBpZiAoZXJyb3JSYXRlID49IHRoaXMuY29uZmlnLmRlZ3JhZGVkVGhyZXNob2xkKSB7XG4gICAgICBzdGF0dXMgPSAnZGVncmFkZWQnO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXMgPSAnaGVhbHRoeSc7XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY3VycmVudFN0YXR1cy5zZXQoc2VydmVySWQsIHN0YXR1cyk7XG4gICAgXG4gICAgLy8g5pu05paw5oql5ZGKXG4gICAgY29uc3QgbGFzdFJlY29yZCA9IHJlY29yZHNbcmVjb3Jkcy5sZW5ndGggLSAxXTtcbiAgICB0aGlzLmxhc3RSZXBvcnRzLnNldChzZXJ2ZXJJZCwge1xuICAgICAgc2VydmVySWQsXG4gICAgICBzdGF0dXMsXG4gICAgICBkZXRhaWxzOiB7XG4gICAgICAgIGxhc3RDaGVja0F0OiBsYXN0UmVjb3JkLnRpbWVzdGFtcCxcbiAgICAgICAgZXJyb3I6IGxhc3RSZWNvcmQuZXJyb3IsXG4gICAgICAgIHJlc3BvbnNlVGltZU1zOiBsYXN0UmVjb3JkLnJlc3BvbnNlVGltZU1zLFxuICAgICAgICBzdWNjZXNzUmF0ZTogMSAtIGVycm9yUmF0ZSxcbiAgICAgIH0sXG4gICAgICByZXBvcnRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uiBTZXJ2ZXIg5YGl5bq3566h55CG5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJIZWFsdGhNYW5hZ2VyKGNvbmZpZz86IFNlcnZlckhlYWx0aENvbmZpZyk6IFNlcnZlckhlYWx0aE1hbmFnZXIge1xuICByZXR1cm4gbmV3IFNlcnZlckhlYWx0aE1hbmFnZXIoY29uZmlnKTtcbn1cbiJdfQ==