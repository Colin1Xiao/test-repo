/**
 * UI-3.9 统一 Freshness Badge 更新函数
 * 
 * 用法：
 *   updateFreshnessBadge(ageSec)
 * 
 * 参数:
 *   ageSec - 数据年龄（秒），可以是 null/undefined
 */
function updateFreshnessBadge(ageSec) {
  const badge = document.getElementById('freshness-badge');
  if (!badge) return;
  
  let html, className;
  
  if (ageSec === null || ageSec === undefined) {
    html = '● 未知';
    className = 'freshness-neutral';
  } else if (ageSec <= 30) {
    html = `● 数据新鲜 (${ageSec}s)`;
    className = 'freshness-fresh';
  } else if (ageSec <= 60) {
    html = `⚠️ 数据延迟 (${ageSec}s)`;
    className = 'freshness-delayed';
  } else {
    html = `🔴 数据陈旧 (${ageSec}s)`;
    className = 'freshness-stale';
  }
  
  badge.innerHTML = `<span class="badge ${className}">${html}</span>`;
}

// 自动更新 freshness（每 30 秒）
function startFreshnessAutoUpdate(apiEndpoint) {
  setInterval(async () => {
    try {
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      const ageSec = data.data?.freshness?.age_sec;
      updateFreshnessBadge(ageSec);
    } catch (e) {
      console.error('Freshness 自动更新失败:', e);
    }
  }, 30000); // 30 秒
}
