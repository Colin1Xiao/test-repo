"use strict";
/**
 * Backpressure - 背压策略
 *
 * 职责：
 * 1. 系统压力检测
 * 2. 降低并发上限
 * 3. 降低 fan-out 宽度
 * 4. 禁止低优先级角色入场
 * 5. 缩短 maxTurns
 * 6. 关闭 aggressive retry
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BACKPRESSURE_CONFIG = exports.BackpressureController = void 0;
exports.createBackpressureController = createBackpressureController;
// ============================================================================
// 背压控制器
// ============================================================================
class BackpressureController {
    constructor(config = {}) {
        // 当前状态
        this.state = {
            pressureLevel: 'low',
            activeActions: [],
            metrics: {
                queueLength: 0,
                avgWaitTimeMs: 0,
                currentConcurrency: 0,
                maxConcurrency: 10,
                concurrencyUtilization: 0,
                failureRate: 0,
                timeoutRate: 0,
            },
            lastCheckAt: 0,
        };
        // 动作历史
        this.actionHistory = [];
        // 监听器
        this.listeners = [];
        this.config = {
            checkIntervalMs: config.checkIntervalMs || 1000,
            queueLengthThresholds: config.queueLengthThresholds || {
                medium: 50,
                high: 100,
                critical: 200,
            },
            waitTimeThresholds: config.waitTimeThresholds || {
                medium: 5000,
                high: 10000,
                critical: 30000,
            },
            failureRateThresholds: config.failureRateThresholds || {
                medium: 20,
                high: 40,
                critical: 60,
            },
        };
    }
    /**
     * 检查压力
     */
    checkPressure(metrics) {
        this.state.lastCheckAt = Date.now();
        this.state.metrics = metrics;
        // 计算压力级别
        const newPressureLevel = this.calculatePressureLevel(metrics);
        // 检测压力变化
        if (newPressureLevel !== this.state.pressureLevel) {
            const oldLevel = this.state.pressureLevel;
            this.state.pressureLevel = newPressureLevel;
            if (newPressureLevel !== 'low') {
                this.state.pressureSince = Date.now();
            }
            else {
                this.state.pressureSince = undefined;
            }
            // 生成新动作
            this.state.activeActions = this.generateActions(newPressureLevel, metrics);
            // 通知监听器
            this.notifyListeners();
        }
        return { ...this.state };
    }
    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.state };
    }
    /**
     * 获取当前压力级别
     */
    getPressureLevel() {
        return this.state.pressureLevel;
    }
    /**
     * 获取当前动作
     */
    getActiveActions() {
        return [...this.state.activeActions];
    }
    /**
     * 添加监听器
     */
    onStateChange(listener) {
        this.listeners.push(listener);
    }
    /**
     * 移除监听器
     */
    offStateChange(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * 获取动作历史
     */
    getActionHistory() {
        return [...this.actionHistory];
    }
    /**
     * 重置状态
     */
    reset() {
        this.state = {
            pressureLevel: 'low',
            activeActions: [],
            metrics: this.state.metrics,
            lastCheckAt: Date.now(),
        };
        this.actionHistory = [];
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 计算压力级别
     */
    calculatePressureLevel(metrics) {
        const scores = [];
        // 队列长度评分
        if (metrics.queueLength >= this.config.queueLengthThresholds.critical) {
            scores.push(4);
        }
        else if (metrics.queueLength >= this.config.queueLengthThresholds.high) {
            scores.push(3);
        }
        else if (metrics.queueLength >= this.config.queueLengthThresholds.medium) {
            scores.push(2);
        }
        else {
            scores.push(1);
        }
        // 等待时间评分
        if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.critical) {
            scores.push(4);
        }
        else if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.high) {
            scores.push(3);
        }
        else if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.medium) {
            scores.push(2);
        }
        else {
            scores.push(1);
        }
        // 失败率评分
        if (metrics.failureRate >= this.config.failureRateThresholds.critical) {
            scores.push(4);
        }
        else if (metrics.failureRate >= this.config.failureRateThresholds.high) {
            scores.push(3);
        }
        else if (metrics.failureRate >= this.config.failureRateThresholds.medium) {
            scores.push(2);
        }
        else {
            scores.push(1);
        }
        // 取最高分
        const maxScore = Math.max(...scores);
        switch (maxScore) {
            case 4:
                return 'critical';
            case 3:
                return 'high';
            case 2:
                return 'medium';
            default:
                return 'low';
        }
    }
    /**
     * 生成背压动作
     */
    generateActions(pressureLevel, metrics) {
        const actions = [];
        switch (pressureLevel) {
            case 'medium':
                // 中等压力：降低并发
                actions.push({
                    type: 'reduce_concurrency',
                    params: { reductionFactor: 0.8 }, // 降低到 80%
                    reason: `Queue length: ${metrics.queueLength}, Wait time: ${metrics.avgWaitTimeMs}ms`,
                    pressureLevel: 'medium',
                });
                break;
            case 'high':
                // 高压力：降低并发 + 降低 fan-out
                actions.push({
                    type: 'reduce_concurrency',
                    params: { reductionFactor: 0.5 }, // 降低到 50%
                    reason: `High pressure: queue=${metrics.queueLength}, wait=${metrics.avgWaitTimeMs}ms`,
                    pressureLevel: 'high',
                }, {
                    type: 'reduce_fanout',
                    params: { maxFanout: 2 }, // 最多 2 个并发子任务
                    reason: 'High pressure detected',
                    pressureLevel: 'high',
                }, {
                    type: 'block_low_priority',
                    params: { minPriority: 5 }, // 只允许优先级 >= 5 的任务
                    reason: 'Blocking low priority tasks',
                    pressureLevel: 'high',
                });
                break;
            case 'critical':
                // 临界压力：全面降级
                actions.push({
                    type: 'reduce_concurrency',
                    params: { reductionFactor: 0.25 }, // 降低到 25%
                    reason: `Critical pressure: queue=${metrics.queueLength}, wait=${metrics.avgWaitTimeMs}ms, failure=${metrics.failureRate}%`,
                    pressureLevel: 'critical',
                }, {
                    type: 'reduce_fanout',
                    params: { maxFanout: 1 }, // 串行执行
                    reason: 'Critical pressure - serial execution only',
                    pressureLevel: 'critical',
                }, {
                    type: 'block_low_priority',
                    params: { minPriority: 8 }, // 只允许高优先级
                    reason: 'Critical pressure - high priority only',
                    pressureLevel: 'critical',
                }, {
                    type: 'shorten_turns',
                    params: { maxTurns: 5 }, // 最多 5 轮对话
                    reason: 'Critical pressure - limit conversation turns',
                    pressureLevel: 'critical',
                }, {
                    type: 'disable_retry',
                    params: { disableAll: true },
                    reason: 'Critical pressure - disable retries',
                    pressureLevel: 'critical',
                });
                // 如果队列过长，考虑丢弃任务
                if (metrics.queueLength >= this.config.queueLengthThresholds.critical * 1.5) {
                    actions.push({
                        type: 'shed_load',
                        params: {
                            dropLowestPriority: true,
                            dropPercentage: 0.2, // 丢弃 20% 最低优先级任务
                        },
                        reason: 'Queue overflow - shedding load',
                        pressureLevel: 'critical',
                    });
                }
                break;
        }
        // 记录历史
        if (actions.length > 0) {
            this.actionHistory.push(...actions);
            // 保留最近 100 个动作
            if (this.actionHistory.length > 100) {
                this.actionHistory.splice(0, this.actionHistory.length - 100);
            }
        }
        return actions;
    }
    /**
     * 通知监听器
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener({ ...this.state });
            }
            catch (error) {
                console.error('Backpressure listener error:', error);
            }
        }
    }
}
exports.BackpressureController = BackpressureController;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建背压控制器
 */
function createBackpressureController(config) {
    return new BackpressureController(config);
}
/**
 * 默认背压配置
 */
exports.DEFAULT_BACKPRESSURE_CONFIG = {
    checkIntervalMs: 1000,
    queueLengthThresholds: {
        medium: 50,
        high: 100,
        critical: 200,
    },
    waitTimeThresholds: {
        medium: 5000,
        high: 10000,
        critical: 30000,
    },
    failureRateThresholds: {
        medium: 20,
        high: 40,
        critical: 60,
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja3ByZXNzdXJlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50cy9iYWNrcHJlc3N1cmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7O0dBYUc7OztBQTRhSCxvRUFJQztBQXpVRCwrRUFBK0U7QUFDL0UsUUFBUTtBQUNSLCtFQUErRTtBQUUvRSxNQUFhLHNCQUFzQjtJQXlCakMsWUFBWSxTQUE2QixFQUFFO1FBdEIzQyxPQUFPO1FBQ0MsVUFBSyxHQUFzQjtZQUNqQyxhQUFhLEVBQUUsS0FBSztZQUNwQixhQUFhLEVBQUUsRUFBRTtZQUNqQixPQUFPLEVBQUU7Z0JBQ1AsV0FBVyxFQUFFLENBQUM7Z0JBQ2QsYUFBYSxFQUFFLENBQUM7Z0JBQ2hCLGtCQUFrQixFQUFFLENBQUM7Z0JBQ3JCLGNBQWMsRUFBRSxFQUFFO2dCQUNsQixzQkFBc0IsRUFBRSxDQUFDO2dCQUN6QixXQUFXLEVBQUUsQ0FBQztnQkFDZCxXQUFXLEVBQUUsQ0FBQzthQUNmO1lBQ0QsV0FBVyxFQUFFLENBQUM7U0FDZixDQUFDO1FBRUYsT0FBTztRQUNDLGtCQUFhLEdBQXlCLEVBQUUsQ0FBQztRQUVqRCxNQUFNO1FBQ0UsY0FBUyxHQUE4QyxFQUFFLENBQUM7UUFHaEUsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLElBQUk7WUFDL0MscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixJQUFJO2dCQUNyRCxNQUFNLEVBQUUsRUFBRTtnQkFDVixJQUFJLEVBQUUsR0FBRztnQkFDVCxRQUFRLEVBQUUsR0FBRzthQUNkO1lBQ0Qsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJO2dCQUMvQyxNQUFNLEVBQUUsSUFBSTtnQkFDWixJQUFJLEVBQUUsS0FBSztnQkFDWCxRQUFRLEVBQUUsS0FBSzthQUNoQjtZQUNELHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxx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UUFDWixJQUFJLEVBQUUsS0FBSztRQUNYLFFBQVEsRUFBRSxLQUFLO0tBQ2hCO0lBQ0QscUJBQXFCLEVBQUU7UUFDckIsTUFBTSxFQUFFLEVBQUU7UUFDVixJQUFJLEVBQUUsRUFBRTtRQUNSLFFBQVEsRUFBRSxFQUFFO0tBQ2I7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCYWNrcHJlc3N1cmUgLSDog4zljovnrZbnlaVcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDns7vnu5/ljovlipvmo4DmtYtcbiAqIDIuIOmZjeS9juW5tuWPkeS4iumZkFxuICogMy4g6ZmN5L2OIGZhbi1vdXQg5a695bqmXG4gKiA0LiDnpoHmraLkvY7kvJjlhYjnuqfop5LoibLlhaXlnLpcbiAqIDUuIOe8qeefrSBtYXhUdXJuc1xuICogNi4g5YWz6ZetIGFnZ3Jlc3NpdmUgcmV0cnlcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Y6L5Yqb57qn5YirXG4gKi9cbmV4cG9ydCB0eXBlIFByZXNzdXJlTGV2ZWwgPSAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJztcblxuLyoqXG4gKiDljovlipvmjIfmoIdcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmVzc3VyZU1ldHJpY3Mge1xuICAvLyDpmJ/liJdcbiAgcXVldWVMZW5ndGg6IG51bWJlcjtcbiAgYXZnV2FpdFRpbWVNczogbnVtYmVyO1xuICBcbiAgLy8g5bm25Y+RXG4gIGN1cnJlbnRDb25jdXJyZW5jeTogbnVtYmVyO1xuICBtYXhDb25jdXJyZW5jeTogbnVtYmVyO1xuICBjb25jdXJyZW5jeVV0aWxpemF0aW9uOiBudW1iZXI7XG4gIFxuICAvLyDlpLHotKXnjodcbiAgZmFpbHVyZVJhdGU6IG51bWJlcjtcbiAgdGltZW91dFJhdGU6IG51bWJlcjtcbiAgXG4gIC8vIOi1hOa6kFxuICBhdmFpbGFibGVNZW1vcnk/OiBudW1iZXI7XG4gIGF2YWlsYWJsZUNwdT86IG51bWJlcjtcbn1cblxuLyoqXG4gKiDog4zljovphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYWNrcHJlc3N1cmVDb25maWcge1xuICAvKiog5Y6L5Yqb5qOA5p+l6Ze06ZqU77yI5q+r56eS77yJICovXG4gIGNoZWNrSW50ZXJ2YWxNcz86IG51bWJlcjtcbiAgXG4gIC8qKiDpmJ/liJfplb/luqbpmIjlgLwgKi9cbiAgcXVldWVMZW5ndGhUaHJlc2hvbGRzPzoge1xuICAgIG1lZGl1bTogbnVtYmVyO1xuICAgIGhpZ2g6IG51bWJlcjtcbiAgICBjcml0aWNhbDogbnVtYmVyO1xuICB9O1xuICBcbiAgLyoqIOetieW+heaXtumXtOmYiOWAvO+8iOavq+enku+8iSAqL1xuICB3YWl0VGltZVRocmVzaG9sZHM/OiB7XG4gICAgbWVkaXVtOiBudW1iZXI7XG4gICAgaGlnaDogbnVtYmVyO1xuICAgIGNyaXRpY2FsOiBudW1iZXI7XG4gIH07XG4gIFxuICAvKiog5aSx6LSl546H6ZiI5YC877yI55m+5YiG5q+U77yJICovXG4gIGZhaWx1cmVSYXRlVGhyZXNob2xkcz86IHtcbiAgICBtZWRpdW06IG51bWJlcjtcbiAgICBoaWdoOiBudW1iZXI7XG4gICAgY3JpdGljYWw6IG51bWJlcjtcbiAgfTtcbn1cblxuLyoqXG4gKiDog4zljovliqjkvZxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYWNrcHJlc3N1cmVBY3Rpb24ge1xuICAvKiog5Yqo5L2c57G75Z6LICovXG4gIHR5cGU6XG4gICAgfCAncmVkdWNlX2NvbmN1cnJlbmN5J1xuICAgIHwgJ3JlZHVjZV9mYW5vdXQnXG4gICAgfCAnYmxvY2tfbG93X3ByaW9yaXR5J1xuICAgIHwgJ3Nob3J0ZW5fdHVybnMnXG4gICAgfCAnZGlzYWJsZV9yZXRyeSdcbiAgICB8ICdzaGVkX2xvYWQnO1xuICBcbiAgLyoqIOWKqOS9nOWPguaVsCAqL1xuICBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIG51bWJlciB8IGJvb2xlYW4gfCBzdHJpbmc+O1xuICBcbiAgLyoqIOWOn+WboCAqL1xuICByZWFzb246IHN0cmluZztcbiAgXG4gIC8qKiDljovlipvnuqfliKsgKi9cbiAgcHJlc3N1cmVMZXZlbDogUHJlc3N1cmVMZXZlbDtcbn1cblxuLyoqXG4gKiDog4zljovnirbmgIFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYWNrcHJlc3N1cmVTdGF0ZSB7XG4gIC8vIOW9k+WJjeWOi+WKm+e6p+WIq1xuICBwcmVzc3VyZUxldmVsOiBQcmVzc3VyZUxldmVsO1xuICBcbiAgLy8g5b2T5YmN5Yqo5L2cXG4gIGFjdGl2ZUFjdGlvbnM6IEJhY2twcmVzc3VyZUFjdGlvbltdO1xuICBcbiAgLy8g5oyH5qCHXG4gIG1ldHJpY3M6IFByZXNzdXJlTWV0cmljcztcbiAgXG4gIC8vIOaXtumXtFxuICBsYXN0Q2hlY2tBdDogbnVtYmVyO1xuICBwcmVzc3VyZVNpbmNlPzogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDog4zljovmjqfliLblmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEJhY2twcmVzc3VyZUNvbnRyb2xsZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8QmFja3ByZXNzdXJlQ29uZmlnPjtcbiAgXG4gIC8vIOW9k+WJjeeKtuaAgVxuICBwcml2YXRlIHN0YXRlOiBCYWNrcHJlc3N1cmVTdGF0ZSA9IHtcbiAgICBwcmVzc3VyZUxldmVsOiAnbG93JyxcbiAgICBhY3RpdmVBY3Rpb25zOiBbXSxcbiAgICBtZXRyaWNzOiB7XG4gICAgICBxdWV1ZUxlbmd0aDogMCxcbiAgICAgIGF2Z1dhaXRUaW1lTXM6IDAsXG4gICAgICBjdXJyZW50Q29uY3VycmVuY3k6IDAsXG4gICAgICBtYXhDb25jdXJyZW5jeTogMTAsXG4gICAgICBjb25jdXJyZW5jeVV0aWxpemF0aW9uOiAwLFxuICAgICAgZmFpbHVyZVJhdGU6IDAsXG4gICAgICB0aW1lb3V0UmF0ZTogMCxcbiAgICB9LFxuICAgIGxhc3RDaGVja0F0OiAwLFxuICB9O1xuICBcbiAgLy8g5Yqo5L2c5Y6G5Y+yXG4gIHByaXZhdGUgYWN0aW9uSGlzdG9yeTogQmFja3ByZXNzdXJlQWN0aW9uW10gPSBbXTtcbiAgXG4gIC8vIOebkeWQrOWZqFxuICBwcml2YXRlIGxpc3RlbmVyczogQXJyYXk8KHN0YXRlOiBCYWNrcHJlc3N1cmVTdGF0ZSkgPT4gdm9pZD4gPSBbXTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQmFja3ByZXNzdXJlQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGNoZWNrSW50ZXJ2YWxNczogY29uZmlnLmNoZWNrSW50ZXJ2YWxNcyB8fCAxMDAwLFxuICAgICAgcXVldWVMZW5ndGhUaHJlc2hvbGRzOiBjb25maWcucXVldWVMZW5ndGhUaHJlc2hvbGRzIHx8IHtcbiAgICAgICAgbWVkaXVtOiA1MCxcbiAgICAgICAgaGlnaDogMTAwLFxuICAgICAgICBjcml0aWNhbDogMjAwLFxuICAgICAgfSxcbiAgICAgIHdhaXRUaW1lVGhyZXNob2xkczogY29uZmlnLndhaXRUaW1lVGhyZXNob2xkcyB8fCB7XG4gICAgICAgIG1lZGl1bTogNTAwMCxcbiAgICAgICAgaGlnaDogMTAwMDAsXG4gICAgICAgIGNyaXRpY2FsOiAzMDAwMCxcbiAgICAgIH0sXG4gICAgICBmYWlsdXJlUmF0ZVRocmVzaG9sZHM6IGNvbmZpZy5mYWlsdXJlUmF0ZVRocmVzaG9sZHMgfHwge1xuICAgICAgICBtZWRpdW06IDIwLFxuICAgICAgICBoaWdoOiA0MCxcbiAgICAgICAgY3JpdGljYWw6IDYwLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5Y6L5YqbXG4gICAqL1xuICBjaGVja1ByZXNzdXJlKG1ldHJpY3M6IFByZXNzdXJlTWV0cmljcyk6IEJhY2twcmVzc3VyZVN0YXRlIHtcbiAgICB0aGlzLnN0YXRlLmxhc3RDaGVja0F0ID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnN0YXRlLm1ldHJpY3MgPSBtZXRyaWNzO1xuICAgIFxuICAgIC8vIOiuoeeul+WOi+WKm+e6p+WIq1xuICAgIGNvbnN0IG5ld1ByZXNzdXJlTGV2ZWwgPSB0aGlzLmNhbGN1bGF0ZVByZXNzdXJlTGV2ZWwobWV0cmljcyk7XG4gICAgXG4gICAgLy8g5qOA5rWL5Y6L5Yqb5Y+Y5YyWXG4gICAgaWYgKG5ld1ByZXNzdXJlTGV2ZWwgIT09IHRoaXMuc3RhdGUucHJlc3N1cmVMZXZlbCkge1xuICAgICAgY29uc3Qgb2xkTGV2ZWwgPSB0aGlzLnN0YXRlLnByZXNzdXJlTGV2ZWw7XG4gICAgICB0aGlzLnN0YXRlLnByZXNzdXJlTGV2ZWwgPSBuZXdQcmVzc3VyZUxldmVsO1xuICAgICAgXG4gICAgICBpZiAobmV3UHJlc3N1cmVMZXZlbCAhPT0gJ2xvdycpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wcmVzc3VyZVNpbmNlID0gRGF0ZS5ub3coKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUucHJlc3N1cmVTaW5jZSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g55Sf5oiQ5paw5Yqo5L2cXG4gICAgICB0aGlzLnN0YXRlLmFjdGl2ZUFjdGlvbnMgPSB0aGlzLmdlbmVyYXRlQWN0aW9ucyhuZXdQcmVzc3VyZUxldmVsLCBtZXRyaWNzKTtcbiAgICAgIFxuICAgICAgLy8g6YCa55+l55uR5ZCs5ZmoXG4gICAgICB0aGlzLm5vdGlmeUxpc3RlbmVycygpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAuLi50aGlzLnN0YXRlIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blvZPliY3nirbmgIFcbiAgICovXG4gIGdldFN0YXRlKCk6IEJhY2twcmVzc3VyZVN0YXRlIHtcbiAgICByZXR1cm4geyAuLi50aGlzLnN0YXRlIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5blvZPliY3ljovlipvnuqfliKtcbiAgICovXG4gIGdldFByZXNzdXJlTGV2ZWwoKTogUHJlc3N1cmVMZXZlbCB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUucHJlc3N1cmVMZXZlbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluW9k+WJjeWKqOS9nFxuICAgKi9cbiAgZ2V0QWN0aXZlQWN0aW9ucygpOiBCYWNrcHJlc3N1cmVBY3Rpb25bXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLnN0YXRlLmFjdGl2ZUFjdGlvbnNdO1xuICB9XG4gIFxuICAvKipcbiAgICog5re75Yqg55uR5ZCs5ZmoXG4gICAqL1xuICBvblN0YXRlQ2hhbmdlKGxpc3RlbmVyOiAoc3RhdGU6IEJhY2twcmVzc3VyZVN0YXRlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnp7vpmaTnm5HlkKzlmahcbiAgICovXG4gIG9mZlN0YXRlQ2hhbmdlKGxpc3RlbmVyOiAoc3RhdGU6IEJhY2twcmVzc3VyZVN0YXRlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmxpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICB0aGlzLmxpc3RlbmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluWKqOS9nOWOhuWPslxuICAgKi9cbiAgZ2V0QWN0aW9uSGlzdG9yeSgpOiBCYWNrcHJlc3N1cmVBY3Rpb25bXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLmFjdGlvbkhpc3RvcnldO1xuICB9XG4gIFxuICAvKipcbiAgICog6YeN572u54q25oCBXG4gICAqL1xuICByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgcHJlc3N1cmVMZXZlbDogJ2xvdycsXG4gICAgICBhY3RpdmVBY3Rpb25zOiBbXSxcbiAgICAgIG1ldHJpY3M6IHRoaXMuc3RhdGUubWV0cmljcyxcbiAgICAgIGxhc3RDaGVja0F0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgdGhpcy5hY3Rpb25IaXN0b3J5ID0gW107XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpfljovlipvnuqfliKtcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlUHJlc3N1cmVMZXZlbChtZXRyaWNzOiBQcmVzc3VyZU1ldHJpY3MpOiBQcmVzc3VyZUxldmVsIHtcbiAgICBjb25zdCBzY29yZXM6IG51bWJlcltdID0gW107XG4gICAgXG4gICAgLy8g6Zif5YiX6ZW/5bqm6K+E5YiGXG4gICAgaWYgKG1ldHJpY3MucXVldWVMZW5ndGggPj0gdGhpcy5jb25maWcucXVldWVMZW5ndGhUaHJlc2hvbGRzLmNyaXRpY2FsKSB7XG4gICAgICBzY29yZXMucHVzaCg0KTtcbiAgICB9IGVsc2UgaWYgKG1ldHJpY3MucXVldWVMZW5ndGggPj0gdGhpcy5jb25maWcucXVldWVMZW5ndGhUaHJlc2hvbGRzLmhpZ2gpIHtcbiAgICAgIHNjb3Jlcy5wdXNoKDMpO1xuICAgIH0gZWxzZSBpZiAobWV0cmljcy5xdWV1ZUxlbmd0aCA+PSB0aGlzLmNvbmZpZy5xdWV1ZUxlbmd0aFRocmVzaG9sZHMubWVkaXVtKSB7XG4gICAgICBzY29yZXMucHVzaCgyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2NvcmVzLnB1c2goMSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOetieW+heaXtumXtOivhOWIhlxuICAgIGlmIChtZXRyaWNzLmF2Z1dhaXRUaW1lTXMgPj0gdGhpcy5jb25maWcud2FpdFRpbWVUaHJlc2hvbGRzLmNyaXRpY2FsKSB7XG4gICAgICBzY29yZXMucHVzaCg0KTtcbiAgICB9IGVsc2UgaWYgKG1ldHJpY3MuYXZnV2FpdFRpbWVNcyA+PSB0aGlzLmNvbmZpZy53YWl0VGltZVRocmVzaG9sZHMuaGlnaCkge1xuICAgICAgc2NvcmVzLnB1c2goMyk7XG4gICAgfSBlbHNlIGlmIChtZXRyaWNzLmF2Z1dhaXRUaW1lTXMgPj0gdGhpcy5jb25maWcud2FpdFRpbWVUaHJlc2hvbGRzLm1lZGl1bSkge1xuICAgICAgc2NvcmVzLnB1c2goMik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjb3Jlcy5wdXNoKDEpO1xuICAgIH1cbiAgICBcbiAgICAvLyDlpLHotKXnjofor4TliIZcbiAgICBpZiAobWV0cmljcy5mYWlsdXJlUmF0ZSA+PSB0aGlzLmNvbmZpZy5mYWlsdXJlUmF0ZVRocmVzaG9sZHMuY3JpdGljYWwpIHtcbiAgICAgIHNjb3Jlcy5wdXNoKDQpO1xuICAgIH0gZWxzZSBpZiAobWV0cmljcy5mYWlsdXJlUmF0ZSA+PSB0aGlzLmNvbmZpZy5mYWlsdXJlUmF0ZVRocmVzaG9sZHMuaGlnaCkge1xuICAgICAgc2NvcmVzLnB1c2goMyk7XG4gICAgfSBlbHNlIGlmIChtZXRyaWNzLmZhaWx1cmVSYXRlID49IHRoaXMuY29uZmlnLmZhaWx1cmVSYXRlVGhyZXNob2xkcy5tZWRpdW0pIHtcbiAgICAgIHNjb3Jlcy5wdXNoKDIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzY29yZXMucHVzaCgxKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5Y+W5pyA6auY5YiGXG4gICAgY29uc3QgbWF4U2NvcmUgPSBNYXRoLm1heCguLi5zY29yZXMpO1xuICAgIFxuICAgIHN3aXRjaCAobWF4U2NvcmUpIHtcbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuICdjcml0aWNhbCc7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIHJldHVybiAnaGlnaCc7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIHJldHVybiAnbWVkaXVtJztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnbG93JztcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDog4zljovliqjkvZxcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVBY3Rpb25zKFxuICAgIHByZXNzdXJlTGV2ZWw6IFByZXNzdXJlTGV2ZWwsXG4gICAgbWV0cmljczogUHJlc3N1cmVNZXRyaWNzXG4gICk6IEJhY2twcmVzc3VyZUFjdGlvbltdIHtcbiAgICBjb25zdCBhY3Rpb25zOiBCYWNrcHJlc3N1cmVBY3Rpb25bXSA9IFtdO1xuICAgIFxuICAgIHN3aXRjaCAocHJlc3N1cmVMZXZlbCkge1xuICAgICAgY2FzZSAnbWVkaXVtJzpcbiAgICAgICAgLy8g5Lit562J5Y6L5Yqb77ya6ZmN5L2O5bm25Y+RXG4gICAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3JlZHVjZV9jb25jdXJyZW5jeScsXG4gICAgICAgICAgcGFyYW1zOiB7IHJlZHVjdGlvbkZhY3RvcjogMC44IH0sIC8vIOmZjeS9juWIsCA4MCVcbiAgICAgICAgICByZWFzb246IGBRdWV1ZSBsZW5ndGg6ICR7bWV0cmljcy5xdWV1ZUxlbmd0aH0sIFdhaXQgdGltZTogJHttZXRyaWNzLmF2Z1dhaXRUaW1lTXN9bXNgLFxuICAgICAgICAgIHByZXNzdXJlTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSAnaGlnaCc6XG4gICAgICAgIC8vIOmrmOWOi+WKm++8mumZjeS9juW5tuWPkSArIOmZjeS9jiBmYW4tb3V0XG4gICAgICAgIGFjdGlvbnMucHVzaChcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAncmVkdWNlX2NvbmN1cnJlbmN5JyxcbiAgICAgICAgICAgIHBhcmFtczogeyByZWR1Y3Rpb25GYWN0b3I6IDAuNSB9LCAvLyDpmY3kvY7liLAgNTAlXG4gICAgICAgICAgICByZWFzb246IGBIaWdoIHByZXNzdXJlOiBxdWV1ZT0ke21ldHJpY3MucXVldWVMZW5ndGh9LCB3YWl0PSR7bWV0cmljcy5hdmdXYWl0VGltZU1zfW1zYCxcbiAgICAgICAgICAgIHByZXNzdXJlTGV2ZWw6ICdoaWdoJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdyZWR1Y2VfZmFub3V0JyxcbiAgICAgICAgICAgIHBhcmFtczogeyBtYXhGYW5vdXQ6IDIgfSwgLy8g5pyA5aSaIDIg5Liq5bm25Y+R5a2Q5Lu75YqhXG4gICAgICAgICAgICByZWFzb246ICdIaWdoIHByZXNzdXJlIGRldGVjdGVkJyxcbiAgICAgICAgICAgIHByZXNzdXJlTGV2ZWw6ICdoaWdoJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdibG9ja19sb3dfcHJpb3JpdHknLFxuICAgICAgICAgICAgcGFyYW1zOiB7IG1pblByaW9yaXR5OiA1IH0sIC8vIOWPquWFgeiuuOS8mOWFiOe6pyA+PSA1IOeahOS7u+WKoVxuICAgICAgICAgICAgcmVhc29uOiAnQmxvY2tpbmcgbG93IHByaW9yaXR5IHRhc2tzJyxcbiAgICAgICAgICAgIHByZXNzdXJlTGV2ZWw6ICdoaWdoJyxcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGNhc2UgJ2NyaXRpY2FsJzpcbiAgICAgICAgLy8g5Li055WM5Y6L5Yqb77ya5YWo6Z2i6ZmN57qnXG4gICAgICAgIGFjdGlvbnMucHVzaChcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAncmVkdWNlX2NvbmN1cnJlbmN5JyxcbiAgICAgICAgICAgIHBhcmFtczogeyByZWR1Y3Rpb25GYWN0b3I6IDAuMjUgfSwgLy8g6ZmN5L2O5YiwIDI1JVxuICAgICAgICAgICAgcmVhc29uOiBgQ3JpdGljYWwgcHJlc3N1cmU6IHF1ZXVlPSR7bWV0cmljcy5xdWV1ZUxlbmd0aH0sIHdhaXQ9JHttZXRyaWNzLmF2Z1dhaXRUaW1lTXN9bXMsIGZhaWx1cmU9JHttZXRyaWNzLmZhaWx1cmVSYXRlfSVgLFxuICAgICAgICAgICAgcHJlc3N1cmVMZXZlbDogJ2NyaXRpY2FsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdyZWR1Y2VfZmFub3V0JyxcbiAgICAgICAgICAgIHBhcmFtczogeyBtYXhGYW5vdXQ6IDEgfSwgLy8g5Liy6KGM5omn6KGMXG4gICAgICAgICAgICByZWFzb246ICdDcml0aWNhbCBwcmVzc3VyZSAtIHNlcmlhbCBleGVjdXRpb24gb25seScsXG4gICAgICAgICAgICBwcmVzc3VyZUxldmVsOiAnY3JpdGljYWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2Jsb2NrX2xvd19wcmlvcml0eScsXG4gICAgICAgICAgICBwYXJhbXM6IHsgbWluUHJpb3JpdHk6IDggfSwgLy8g5Y+q5YWB6K646auY5LyY5YWI57qnXG4gICAgICAgICAgICByZWFzb246ICdDcml0aWNhbCBwcmVzc3VyZSAtIGhpZ2ggcHJpb3JpdHkgb25seScsXG4gICAgICAgICAgICBwcmVzc3VyZUxldmVsOiAnY3JpdGljYWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ3Nob3J0ZW5fdHVybnMnLFxuICAgICAgICAgICAgcGFyYW1zOiB7IG1heFR1cm5zOiA1IH0sIC8vIOacgOWkmiA1IOi9ruWvueivnVxuICAgICAgICAgICAgcmVhc29uOiAnQ3JpdGljYWwgcHJlc3N1cmUgLSBsaW1pdCBjb252ZXJzYXRpb24gdHVybnMnLFxuICAgICAgICAgICAgcHJlc3N1cmVMZXZlbDogJ2NyaXRpY2FsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdkaXNhYmxlX3JldHJ5JyxcbiAgICAgICAgICAgIHBhcmFtczogeyBkaXNhYmxlQWxsOiB0cnVlIH0sXG4gICAgICAgICAgICByZWFzb246ICdDcml0aWNhbCBwcmVzc3VyZSAtIGRpc2FibGUgcmV0cmllcycsXG4gICAgICAgICAgICBwcmVzc3VyZUxldmVsOiAnY3JpdGljYWwnLFxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWmguaenOmYn+WIl+i/h+mVv++8jOiAg+iZkeS4ouW8g+S7u+WKoVxuICAgICAgICBpZiAobWV0cmljcy5xdWV1ZUxlbmd0aCA+PSB0aGlzLmNvbmZpZy5xdWV1ZUxlbmd0aFRocmVzaG9sZHMuY3JpdGljYWwgKiAxLjUpIHtcbiAgICAgICAgICBhY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ3NoZWRfbG9hZCcsXG4gICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgZHJvcExvd2VzdFByaW9yaXR5OiB0cnVlLFxuICAgICAgICAgICAgICBkcm9wUGVyY2VudGFnZTogMC4yLCAvLyDkuKLlvIMgMjAlIOacgOS9juS8mOWFiOe6p+S7u+WKoVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlYXNvbjogJ1F1ZXVlIG92ZXJmbG93IC0gc2hlZGRpbmcgbG9hZCcsXG4gICAgICAgICAgICBwcmVzc3VyZUxldmVsOiAnY3JpdGljYWwnLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBcbiAgICAvLyDorrDlvZXljoblj7JcbiAgICBpZiAoYWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmFjdGlvbkhpc3RvcnkucHVzaCguLi5hY3Rpb25zKTtcbiAgICAgIFxuICAgICAgLy8g5L+d55WZ5pyA6L+RIDEwMCDkuKrliqjkvZxcbiAgICAgIGlmICh0aGlzLmFjdGlvbkhpc3RvcnkubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgIHRoaXMuYWN0aW9uSGlzdG9yeS5zcGxpY2UoMCwgdGhpcy5hY3Rpb25IaXN0b3J5Lmxlbmd0aCAtIDEwMCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhY3Rpb25zO1xuICB9XG4gIFxuICAvKipcbiAgICog6YCa55+l55uR5ZCs5ZmoXG4gICAqL1xuICBwcml2YXRlIG5vdGlmeUxpc3RlbmVycygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBsaXN0ZW5lcih7IC4uLnRoaXMuc3RhdGUgfSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdCYWNrcHJlc3N1cmUgbGlzdGVuZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rog4zljovmjqfliLblmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJhY2twcmVzc3VyZUNvbnRyb2xsZXIoXG4gIGNvbmZpZz86IEJhY2twcmVzc3VyZUNvbmZpZ1xuKTogQmFja3ByZXNzdXJlQ29udHJvbGxlciB7XG4gIHJldHVybiBuZXcgQmFja3ByZXNzdXJlQ29udHJvbGxlcihjb25maWcpO1xufVxuXG4vKipcbiAqIOm7mOiupOiDjOWOi+mFjee9rlxuICovXG5leHBvcnQgY29uc3QgREVGQVVMVF9CQUNLUFJFU1NVUkVfQ09ORklHOiBCYWNrcHJlc3N1cmVDb25maWcgPSB7XG4gIGNoZWNrSW50ZXJ2YWxNczogMTAwMCxcbiAgcXVldWVMZW5ndGhUaHJlc2hvbGRzOiB7XG4gICAgbWVkaXVtOiA1MCxcbiAgICBoaWdoOiAxMDAsXG4gICAgY3JpdGljYWw6IDIwMCxcbiAgfSxcbiAgd2FpdFRpbWVUaHJlc2hvbGRzOiB7XG4gICAgbWVkaXVtOiA1MDAwLFxuICAgIGhpZ2g6IDEwMDAwLFxuICAgIGNyaXRpY2FsOiAzMDAwMCxcbiAgfSxcbiAgZmFpbHVyZVJhdGVUaHJlc2hvbGRzOiB7XG4gICAgbWVkaXVtOiAyMCxcbiAgICBoaWdoOiA0MCxcbiAgICBjcml0aWNhbDogNjAsXG4gIH0sXG59O1xuIl19