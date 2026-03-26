/**
 * 公共工具函数 - 所有页面共享
 */

// 格式化时间戳为可读格式
function formatTime(ts) {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

// 格式化日期
function formatDate(day) {
  if (!day) return '-';
  return day.slice(5); // MM-DD
}

// 更新 Freshness Badge
function updateFreshnessBadge(ageSec) {
  const badge = document.getElementById('freshness-badge');
  if (!badge) return;

  if (ageSec === null || ageSec === undefined) {
    badge.innerHTML = '<span class="badge badge-neutral">● 未知</span>';
  } else if (ageSec <= 30) {
    badge.innerHTML = `<span class="badge badge-fresh" style="background:var(--freshness-fresh);color:#000">● 数据新鲜 (${ageSec}s)</span>`;
  } else if (ageSec <= 60) {
    badge.innerHTML = `<span class="badge badge-delayed" style="background:var(--freshness-delayed);color:#000">⚠️ 数据延迟 (${ageSec}s)</span>`;
  } else {
    badge.innerHTML = `<span class="badge badge-stale" style="background:var(--freshness-stale);color:#fff">🔴 数据陈旧 (${ageSec}s)</span>`;
  }
}

// 渲染加载状态
function renderLoading(containerId, text = '正在加载数据...') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">${text}</div>
    </div>
  `;
}

// 渲染空状态
function renderEmpty(containerId, text = '暂无数据', hint = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="state-stack">
        <div>${text}</div>
        ${hint ? `<div class="state-hint">${hint}</div>` : ''}
      </div>
    </div>
  `;
}

// 渲染错误状态
function renderError(containerId, text = '加载失败', hint = '请稍后重试') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="error">
      <span class="icon">⚠️</span>
      <div>
        <div>${text}</div>
        ${hint ? `<div class="state-hint">${hint}</div>` : ''}
      </div>
    </div>
  `;
}

// 渲染条形图
function renderBarChart(containerId, data, colorMap) {
  const container = document.getElementById(containerId);
  if (!data || data.length === 0) {
    renderEmpty(containerId, '最近所选周期内暂无数据', '等待后续新数据写入');
    return;
  }

  const maxVal = Math.max(...data.map(d => d.cnt));
  const html = data.map(item => {
    const pct = maxVal > 0 ? (item.cnt / maxVal * 100) : 0;
    const color = colorMap[item.normalized_action] || colorMap[item.level] || '#3b82f6';
    const label = item.normalized_action || item.level;
    return `
      <div class="chart-bar">
        <div class="chart-label">${label}</div>
        <div class="chart-bar-inner">
          <div class="chart-fill ${colorMap[item.normalized_action] || colorMap[item.level] ? 'fill-' + (item.normalized_action || item.level).toLowerCase() : ''}"
               style="width: ${pct}%; background: ${color}">
            ${item.cnt}
          </div>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = html;
}

// 设置文本内容
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// 设置徽章样式和内容
function setBadge(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'badge ' + cls;
}

// 根据PnL获取徽章样式
function badgeForPnl(value) {
  if (value > 0) return 'pnl-positive';
  if (value < 0) return 'pnl-negative';
  return 'state-neutral';
}
