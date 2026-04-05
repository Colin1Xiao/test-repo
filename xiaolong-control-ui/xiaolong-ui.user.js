// ==UserScript==
// @name         🐉 小龙 Control UI 增强
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  小龙主题 + 交易/路由/自愈面板 for OpenClaw Control UI
// @author       小龙
// @match        http://localhost:18789/*
// @match        http://127.0.0.1:18789/*
// @match        https://*.tail*.ts.net/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🐉 小龙 Control UI 增强已加载');

    // 小龙主题 CSS
    const xiaolongCSS = `
        /* 主题色 */
        :root {
            --xl-primary: #7c5cfc;
            --xl-primary-light: #a78bfa;
            --xl-success: #2dd4a0;
            --xl-warning: #f5a623;
            --xl-danger: #f85149;
            --xl-info: #58a6ff;
            --xl-bg: #06080e;
            --xl-card: #0d1117;
            --xl-border: #1a1f2e;
        }

        /* 深色模式覆盖 */
        [data-theme="dark"], [data-theme="claw"] {
            --background-primary: var(--xl-bg) !important;
            --background-secondary: var(--xl-card) !important;
            --border-color: var(--xl-border) !important;
            --accent-primary: var(--xl-primary) !important;
            --accent-secondary: var(--xl-primary-light) !important;
            --status-online: var(--xl-success) !important;
        }

        /* 玻璃拟态 */
        .sidebar, .chat-panel, .settings-panel {
            background: rgba(13, 17, 23, 0.85) !important;
            backdrop-filter: blur(16px) !important;
        }

        /* Logo */
        .app-header .logo::before {
            content: "🐉 ";
        }

        /* 按钮 */
        button.primary, .btn-primary {
            background: linear-gradient(135deg, var(--xl-primary), var(--xl-primary-light)) !important;
            border: none !important;
        }

        /* 在线状态 */
        .status-dot.online, .status-online {
            background: var(--xl-success) !important;
            box-shadow: 0 0 0 0 rgba(45, 212, 160, 0.4) !important;
            animation: pulse-green 2s infinite !important;
        }

        @keyframes pulse-green {
            0%, 100% { box-shadow: 0 0 0 0 rgba(45, 212, 160, 0.4); }
            50% { box-shadow: 0 0 0 6px rgba(45, 212, 160, 0); }
        }

        /* 用户消息 */
        .message.user .message-content {
            background: linear-gradient(135deg, var(--xl-primary), var(--xl-primary-light)) !important;
        }

        /* 小龙面板按钮 */
        .xiaolong-btn {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            width: 56px !important;
            height: 56px !important;
            border-radius: 50% !important;
            background: linear-gradient(135deg, #7c5cfc, #a78bfa) !important;
            border: none !important;
            color: white !important;
            font-size: 24px !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(124, 92, 252, 0.4) !important;
            z-index: 9999 !important;
            transition: all 0.3s !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .xiaolong-btn:hover {
            transform: scale(1.1) !important;
            box-shadow: 0 6px 30px rgba(124, 92, 252, 0.6) !important;
        }

        /* 小龙面板 */
        .xiaolong-panel {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 90% !important;
            max-width: 800px !important;
            max-height: 80vh !important;
            background: #0d1117 !important;
            border: 1px solid #1a1f2e !important;
            border-radius: 20px !important;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5) !important;
            z-index: 10000 !important;
            overflow: hidden !important;
            display: none;
        }

        .xiaolong-panel.active {
            display: block !important;
        }

        .xiaolong-panel-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 20px 24px !important;
            border-bottom: 1px solid #1a1f2e !important;
            background: linear-gradient(135deg, rgba(124, 92, 252, 0.1), transparent) !important;
        }

        .xiaolong-panel-header h2 {
            margin: 0 !important;
            font-size: 1.3rem !important;
            background: linear-gradient(135deg, #7c5cfc, #a78bfa) !important;
            -webkit-background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
        }

        .xiaolong-panel-close {
            background: transparent !important;
            border: none !important;
            color: #8b949e !important;
            font-size: 24px !important;
            cursor: pointer !important;
            width: 36px !important;
            height: 36px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 8px !important;
            transition: all 0.2s !important;
        }

        .xiaolong-panel-close:hover {
            background: rgba(248, 81, 73, 0.1) !important;
            color: #f85149 !important;
        }

        .xiaolong-panel-body {
            padding: 20px 24px !important;
            max-height: calc(80vh - 80px) !important;
            overflow-y: auto !important;
        }

        .xl-tabs {
            display: flex !important;
            gap: 8px !important;
            margin-bottom: 20px !important;
            padding-bottom: 16px !important;
            border-bottom: 1px solid #1a1f2e !important;
        }

        .xl-tab {
            padding: 10px 20px !important;
            border-radius: 10px !important;
            border: none !important;
            background: transparent !important;
            color: #8b949e !important;
            font-family: inherit !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
        }

        .xl-tab:hover {
            color: #e6edf3 !important;
            background: rgba(124, 92, 252, 0.1) !important;
        }

        .xl-tab.active {
            background: linear-gradient(135deg, #7c5cfc, #a78bfa) !important;
            color: white !important;
        }

        .xl-cards {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            gap: 16px !important;
        }

        .xl-card {
            background: rgba(13, 17, 23, 0.7) !important;
            border: 1px solid #1a1f2e !important;
            border-radius: 16px !important;
            padding: 16px !important;
            transition: all 0.3s !important;
        }

        .xl-card:hover {
            transform: translateY(-2px) !important;
            border-color: rgba(124, 92, 252, 0.3) !important;
            box-shadow: 0 8px 32px rgba(124, 92, 252, 0.1) !important;
        }

        .xl-card-header {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
            font-size: 12px !important;
            text-transform: uppercase !important;
            letter-spacing: 1px !important;
            color: #8b949e !important;
        }

        .xl-card-value {
            font-size: 1.8rem !important;
            font-weight: 700 !important;
            margin-bottom: 4px !important;
            color: #e6edf3 !important;
        }

        .xl-card-detail {
            font-size: 12px !important;
            color: #8b949e !important;
            font-family: 'SF Mono', monospace !important;
        }

        .xl-badge {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            padding: 4px 10px !important;
            border-radius: 999px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
        }

        .xl-badge.ok {
            background: rgba(45, 212, 160, 0.15) !important;
            color: #2dd4a0 !important;
            border: 1px solid rgba(45, 212, 160, 0.25) !important;
        }

        .xl-badge.warn {
            background: rgba(245, 166, 35, 0.15) !important;
            color: #f5a623 !important;
            border: 1px solid rgba(245, 166, 35, 0.25) !important;
        }

        .xl-badge.err {
            background: rgba(248, 81, 73, 0.15) !important;
            color: #f85149 !important;
            border: 1px solid rgba(248, 81, 73, 0.25) !important;
        }

        .xl-loading {
            text-align: center !important;
            padding: 40px !important;
            color: #8b949e !important;
        }

        .xl-overlay {
            position: fixed !important;
            inset: 0 !important;
            background: rgba(6, 8, 14, 0.8) !important;
            backdrop-filter: blur(8px) !important;
            z-index: 9999 !important;
            display: none;
        }

        .xl-overlay.active {
            display: block !important;
        }
    `;

    // 添加 CSS
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(xiaolongCSS);
    } else {
        const style = document.createElement('style');
        style.textContent = xiaolongCSS;
        document.head.appendChild(style);
    }

    // 等待页面加载
    function init() {
        // 添加悬浮按钮
        const btn = document.createElement('button');
        btn.className = 'xiaolong-btn';
        btn.innerHTML = '🐉';
        btn.title = '小龙 Dashboard';
        btn.onclick = togglePanel;
        document.body.appendChild(btn);

        // 创建面板
        createPanel();

        console.log('🐉 小龙按钮已添加');
    }

    function createPanel() {
        const overlay = document.createElement('div');
        overlay.className = 'xl-overlay';
        overlay.id = 'xl-overlay';
        overlay.onclick = togglePanel;

        const panel = document.createElement('div');
        panel.className = 'xiaolong-panel';
        panel.id = 'xiaolong-panel';
        panel.innerHTML = `
            <div class="xiaolong-panel-header">
                <h2>🐉 小龙 Dashboard</h2>
                <button class="xiaolong-panel-close" onclick="togglePanel()">×</button>
            </div>
            <div class="xiaolong-panel-body">
                <div class="xl-tabs">
                    <button class="xl-tab active" data-tab="health" onclick="switchTab('health')">健康</button>
                    <button class="xl-tab" data-tab="trading" onclick="switchTab('trading')">交易</button>
                    <button class="xl-tab" data-tab="ocnmps" onclick="switchTab('ocnmps')">路由</button>
                    <button class="xl-tab" data-tab="recovery" onclick="switchTab('recovery')">自愈</button>
                </div>
                <div id="xl-content">
                    <div class="xl-loading">点击标签加载数据...</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 全局函数
        window.togglePanel = function() {
            const overlay = document.getElementById('xl-overlay');
            const panel = document.getElementById('xiaolong-panel');
            const isActive = overlay.classList.contains('active');

            if (isActive) {
                overlay.classList.remove('active');
                panel.classList.remove('active');
            } else {
                overlay.classList.add('active');
                panel.classList.add('active');
                // 默认加载健康数据
                switchTab('health');
            }
        };

        window.switchTab = function(tabName) {
            // 更新标签样式
            document.querySelectorAll('.xl-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });

            // 加载数据
            loadData(tabName);
        };
    }

    function loadData(tabName) {
        const content = document.getElementById('xl-content');
        content.innerHTML = '<div class="xl-loading">加载中...</div>';

        const token = getToken();
        const baseUrl = window.location.origin;

        switch(tabName) {
            case 'health':
                fetch(`${baseUrl}/api/health?token=${token}`)
                    .then(r => r.json())
                    .then(data => renderHealth(data, content))
                    .catch(e => content.innerHTML = `<div class="xl-loading">错误: ${e.message}</div>`);
                break;
            case 'trading':
                Promise.all([
                    fetch(`${baseUrl}/api/trading/live?token=${token}`).then(r => r.json()),
                    fetch(`${baseUrl}/api/trading/history?token=${token}`).then(r => r.json())
                ])
                .then(([live, history]) => renderTrading(live, history, content))
                .catch(e => content.innerHTML = `<div class="xl-loading">错误: ${e.message}</div>`);
                break;
            case 'ocnmps':
                fetch(`${baseUrl}/api/ocnmps/stats?token=${token}`)
                    .then(r => r.json())
                    .then(data => renderOcnmps(data, content))
                    .catch(e => content.innerHTML = `<div class="xl-loading">错误: ${e.message}</div>`);
                break;
            case 'recovery':
                fetch(`${baseUrl}/api/recovery/history?token=${token}`)
                    .then(r => r.json())
                    .then(data => renderRecovery(data, content))
                    .catch(e => content.innerHTML = `<div class="xl-loading">错误: ${e.message}</div>`);
                break;
        }
    }

    function getToken() {
        // 从 URL 获取 token
        const params = new URLSearchParams(window.location.search);
        return params.get('token') || 'test123';
    }

    function renderHealth(data, container) {
        const components = [
            { name: 'Gateway', key: 'gateway', icon: '🚪' },
            { name: 'Telegram', key: 'telegram', icon: '✈️' },
            { name: 'Memory', key: 'memory', icon: '🧠' },
            { name: 'Cron', key: 'cron', icon: '⏰' },
            { name: '交易系统', key: 'trading', icon: '💰' },
        ];

        let html = '<div class="xl-cards">';
        for (const comp of components) {
            const status = data.components?.[comp.key] || { status: 'unknown' };
            const badgeClass = status.status === 'ok' || status.status === 'running' ? 'ok' :
                               status.status === 'warning' ? 'warn' : 'err';
            const statusText = status.status === 'ok' || status.status === 'running' ? '正常' :
                              status.status === 'warning' ? '警告' : status.status || '未知';

            html += `
                <div class="xl-card">
                    <div class="xl-card-header">${comp.icon} ${comp.name}</div>
                    <div class="xl-card-value"><span class="xl-badge ${badgeClass}">${statusText}</span></div>
                    <div class="xl-card-detail">${status.message || '-'}</div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function renderTrading(live, history, container) {
        const position = live.position || {};
        const balance = live.balance || {};
        const pnl = position.unrealized_pnl || 0;
        const pnlClass = pnl >= 0 ? 'ok' : 'err';
        const pnlSign = pnl >= 0 ? '+' : '';

        container.innerHTML = `
            <div class="xl-cards">
                <div class="xl-card">
                    <div class="xl-card-header">💰 持仓</div>
                    <div class="xl-card-value">${position.side || '无'} ${position.size || 0}</div>
                    <div class="xl-card-detail">均价: ${position.avg_price || 0} | 盈亏: <span class="xl-badge ${pnlClass}">${pnlSign}${pnl}</span></div>
                </div>
                <div class="xl-card">
                    <div class="xl-card-header">💵 余额</div>
                    <div class="xl-card-value">${balance.usdt_total || 0} USDT</div>
                    <div class="xl-card-detail">可用: ${balance.usdt_free || 0}</div>
                </div>
                <div class="xl-card">
                    <div class="xl-card-header">📊 统计</div>
                    <div class="xl-card-value">${history.total_trades || 0}</div>
                    <div class="xl-card-detail">总盈亏: ${history.total_pnl || 0}</div>
                </div>
            </div>
        `;
    }

    function renderOcnmps(data, container) {
        const total = data.total_requests || 0;
        const grayHit = data.gray_hit_count || 0;
        const grayRate = total > 0 ? ((grayHit / total) * 100).toFixed(2) : 0;

        container.innerHTML = `
            <div class="xl-cards">
                <div class="xl-card">
                    <div class="xl-card-header">📊 总请求</div>
                    <div class="xl-card-value">${total}</div>
                    <div class="xl-card-detail">灰度命中: ${grayHit} (${grayRate}%)</div>
                </div>
                <div class="xl-card">
                    <div class="xl-card-header">⚠️ Fallback</div>
                    <div class="xl-card-value">${data.fallback_count || 0}</div>
                    <div class="xl-card-detail">异常降级次数</div>
                </div>
            </div>
        `;
    }

    function renderRecovery(data, container) {
        const recoveries = data.recoveries || [];
        if (recoveries.length === 0) {
            container.innerHTML = '<div class="xl-loading">暂无自愈记录</div>';
            return;
        }

        let html = '<div style="max-height: 300px; overflow-y: auto;">';
        for (const rec of recoveries.slice(-10).reverse()) {
            const badgeClass = rec.success ? 'ok' : 'err';
            const resultText = rec.success ? '成功' : '失败';
            html += `
                <div style="padding: 12px; border-bottom: 1px solid #1a1f2e; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${rec.component || '-'}</div>
                        <div style="font-size: 12px; color: #8b949e;">${rec.strategy || '-'}</div>
                    </div>
                    <span class="xl-badge ${badgeClass}">${resultText}</span>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
