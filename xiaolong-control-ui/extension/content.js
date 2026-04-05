/**
 * 🐉 小龙 Control UI 增强脚本
 * 自动注入主题 + 添加小龙面板
 */

(function() {
  'use strict';
  
  console.log('🐉 小龙 Control UI 主题已加载');
  
  // 添加小龙侧边栏按钮
  function addXiaolongPanel() {
    // 等待侧边栏加载
    const observer = new MutationObserver((mutations, obs) => {
      const sidebar = document.querySelector('nav.sidebar, .sidebar, [class*="sidebar"]');
      if (sidebar) {
        obs.disconnect();
        injectXiaolongButton(sidebar);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function injectXiaolongButton(sidebar) {
    const button = document.createElement('button');
    button.className = 'xiaolong-panel-btn';
    button.innerHTML = `
      <span class="icon">🐉</span>
      <span class="label">小龙</span>
    `;
    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      margin: 8px;
      background: linear-gradient(135deg, #7c5cfc, #a78bfa);
      border: none;
      border-radius: 12px;
      color: white;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    button.addEventListener('click', () => {
      openXiaolongPanel();
    });
    
    sidebar.appendChild(button);
    console.log('🐉 小龙按钮已添加');
  }
  
  function openXiaolongPanel() {
    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'xiaolong-panel';
    panel.innerHTML = `
      <div class="xiaolong-panel-overlay" onclick="this.remove()">
        <div class="xiaolong-panel-content" onclick="event.stopPropagation()">
          <div class="xiaolong-panel-header">
            <h2>🐉 小龙 Dashboard</h2>
            <button class="close-btn" onclick="document.getElementById('xiaolong-panel').remove()">×</button>
          </div>
          <div class="xiaolong-panel-body">
            <div class="xl-tabs">
              <button class="xl-tab active" data-tab="health">健康</button>
              <button class="xl-tab" data-tab="trading">交易</button>
              <button class="xl-tab" data-tab="ocnmps">路由</button>
              <button class="xl-tab" data-tab="recovery">自愈</button>
            </div>
            <div class="xl-tab-content" id="xl-content">
              <div class="xl-loading">加载中...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    panel.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .xiaolong-panel-overlay {
        position: fixed;
        inset: 0;
        background: rgba(6, 8, 14, 0.8);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .xiaolong-panel-content {
        background: #0d1117;
        border: 1px solid #1a1f2e;
        border-radius: 20px;
        width: 90%;
        max-width: 900px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      }
      
      .xiaolong-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #1a1f2e;
      }
      
      .xiaolong-panel-header h2 {
        margin: 0;
        font-size: 1.3rem;
        background: linear-gradient(135deg, #7c5cfc, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .close-btn {
        background: transparent;
        border: none;
        color: #8b949e;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s;
      }
      
      .close-btn:hover {
        background: rgba(248, 81, 73, 0.1);
        color: #f85149;
      }
      
      .xiaolong-panel-body {
        padding: 20px 24px;
        max-height: calc(80vh - 80px);
        overflow-y: auto;
      }
      
      .xl-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
      }
      
      .xl-tab {
        padding: 10px 20px;
        border-radius: 10px;
        border: none;
        background: transparent;
        color: #8b949e;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .xl-tab:hover {
        color: #e6edf3;
      }
      
      .xl-tab.active {
        background: #7c5cfc;
        color: white;
      }
      
      .xl-loading {
        text-align: center;
        padding: 40px;
        color: #8b949e;
      }
      
      .xl-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      
      .xl-card {
        background: rgba(13, 17, 23, 0.7);
        border: 1px solid #1a1f2e;
        border-radius: 16px;
        padding: 16px;
      }
      
      .xl-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8b949e;
      }
      
      .xl-card-value {
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 4px;
      }
      
      .xl-card-detail {
        font-size: 12px;
        color: #8b949e;
        font-family: 'Space Mono', monospace;
      }
      
      .xl-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
      }
      
      .xl-badge.ok {
        background: rgba(45, 212, 160, 0.15);
        color: #2dd4a0;
        border: 1px solid rgba(45, 212, 160, 0.25);
      }
      
      .xl-badge.warn {
        background: rgba(245, 166, 35, 0.15);
        color: #f5a623;
        border: 1px solid rgba(245, 166, 35, 0.25);
      }
      
      .xl-badge.err {
        background: rgba(248, 81, 73, 0.15);
        color: #f85149;
        border: 1px solid rgba(248, 81, 73, 0.25);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(panel);
    
    // 加载数据
    loadXiaolongData('health');
    
    // Tab 切换
    panel.querySelectorAll('.xl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.query