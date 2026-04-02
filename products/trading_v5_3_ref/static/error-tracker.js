/**
 * UI-3.10A 前端错误追踪
 * 
 * 功能:
 * - window.onerror 捕获
 * - unhandledrejection 捕获
 * - 自动上报到后端
 */

// 错误上报配置
const ERROR_REPORT_CONFIG = {
  endpoint: '/api/monitor/frontend-error',
  maxRetries: 2,
  retryDelay: 1000,
};

// 错误上报队列
let errorQueue = [];
let isReporting = false;

/**
 * 上报错误到后端
 */
async function reportError(errorData) {
  const payload = {
    page: window.location.pathname,
    message: errorData.message || errorData.reason?.message || 'Unknown error',
    source: errorData.filename || errorData.reason?.stack?.split('\n')[1]?.split(' ')[1] || '',
    lineno: errorData.lineno || null,
    colno: errorData.colno || null,
    stack: errorData.stack || errorData.reason?.stack || '',
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  // 加入队列
  errorQueue.push(payload);

  // 如果正在上报，等待
  if (isReporting) return;

  // 批量上报
  await flushErrorQueue();
}

/**
 * 刷新错误队列
 */
async function flushErrorQueue() {
  if (errorQueue.length === 0 || isReporting) return;

  isReporting = true;

  try {
    const errors = [...errorQueue];
    errorQueue = [];

    const response = await fetch(ERROR_REPORT_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ errors }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[ErrorTracker] 成功上报 ${errors.length} 个错误`);
  } catch (error) {
    console.error('[ErrorTracker] 上报失败:', error);
    // 上报失败，把错误放回队列
    // errorQueue.unshift(...errors);
  } finally {
    isReporting = false;
  }
}

/**
 * 全局错误处理 - window.onerror
 */
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[ErrorTracker] 捕获全局错误:', {
    message,
    source,
    lineno,
    colno,
    error: error?.stack,
  });

  reportError({
    message: typeof message === 'string' ? message : message?.message || 'Unknown error',
    filename: source,
    lineno: lineno,
    colno: colno,
    stack: error?.stack || new Error(message).stack,
  });

  // 不阻止默认错误处理
  return false;
};

/**
 * 全局错误处理 - unhandledrejection
 */
window.onunhandledrejection = function(event) {
  console.error('[ErrorTracker] 捕获未处理 Promise 错误:', event.reason);

  reportError({
    message: event.reason?.message || 'Unhandled Promise Rejection',
    stack: event.reason?.stack || String(event.reason),
  });

  // 阻止控制台重复输出
  event.preventDefault();
};

/**
 * 手动追踪错误（用于业务代码）
 */
function trackError(error, context = {}) {
  console.error('[ErrorTracker] 手动追踪错误:', error, context);

  reportError({
    message: error?.message || String(error),
    stack: error?.stack || new Error(String(error)).stack,
    ...context,
  });
}

/**
 * 性能指标上报
 */
function reportPerformanceMetrics() {
  // 页面加载时间
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    const metrics = {
      // DNS 查询时间
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      // TCP 连接时间
      tcp: timing.connectEnd - timing.connectStart,
      // 请求响应时间
      request: timing.responseStart - timing.requestStart,
      // DOM 加载时间
      domInteractive: timing.domInteractive - navigationStart,
      // 页面完全加载时间
      loadComplete: timing.loadEventEnd - navigationStart,
      // 首次内容绘制 (如果支持)
      fcp: getFCP(),
    };

    console.log('[Performance] 页面性能指标:', metrics);

    // 可以在这里上报到后端
    // fetch('/api/monitor/performance-metrics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metrics),
    // });
  }
}

/**
 * 获取首次内容绘制时间 (FCP)
 */
function getFCP() {
  return new Promise((resolve) => {
    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              resolve(entry.startTime);
            }
          }
          observer.disconnect();
        });
        observer.observe({ entryTypes: ['paint'] });
      } catch (e) {
        resolve(null);
      }
    } else {
      resolve(null);
    }

    // 5 秒超时
    setTimeout(() => resolve(null), 5000);
  });
}

/**
 * 页面卸载前刷新队列
 */
window.addEventListener('beforeunload', () => {
  if (errorQueue.length > 0) {
    // 使用 sendBeacon 确保数据发送
    const blob = new Blob([JSON.stringify({ errors: errorQueue })], {
      type: 'application/json',
    });
    navigator.sendBeacon(ERROR_REPORT_CONFIG.endpoint, blob);
  }
});

// 页面加载完成后上报性能指标
window.addEventListener('load', () => {
  setTimeout(reportPerformanceMetrics, 1000);
});

// 定期刷新队列（每 30 秒）
setInterval(() => {
  if (errorQueue.length > 0) {
    flushErrorQueue();
  }
}, 30000);

console.log('[ErrorTracker] 前端错误追踪已启用');
