#!/usr/bin/env python3
"""
🐉 小龙交易系统 V5.4 面板 - 专业金融终端版
Bloomberg/TradingView 风格 + V5.4 数据源
"""

import sys
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, render_template_string, request

# 添加核心模块路径
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))
from trade_integration_v54 import get_trade_bridge

app = Flask(__name__)
bridge = get_trade_bridge()

HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🐉 小龙交易系统 V5.4 Pro | 专业金融终端</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
    --bg-primary: #0a0a0a;
    --bg-secondary: #111111;
    --bg-card: #141414;
    --bg-panel: #1a1a1a;
    --border-color: #2a2a2a;
    --border-highlight: #333333;
    --green: #22c55e;
    --green-dark: #166534;
    --red: #ef4444;
    --red-dark: #991b1b;
    --blue: #3b82f6;
    --blue-dark: #1d4ed8;
    --yellow: #eab308;
    --orange: #f97316;
    --purple: #a855f7;
    --cyan: #06b6d4;
    --text-primary: #ffffff;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
}
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}
body{
    font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
    background:var(--bg-primary);
    color:var(--text-primary);
    min-height:100vh;
    font-size:13px;
    line-height:1.5;
}
.container{
    max-width:1920px;
    margin:0 auto;
    padding:8px;
}
/* 顶部状态栏 */
.top-bar{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:8px 16px;
    background:var(--bg-secondary);
    border-bottom:1px solid var(--border-color);
    margin-bottom:8px;
}
.top-bar-left{
    display:flex;
    align-items:center;
    gap:24px;
}
.logo{
    display:flex;
    align-items:center;
    gap:10px;
}
.logo-icon{
    width:28px;
    height:28px;
    background:linear-gradient(135deg,var(--green),var(--blue));
    border-radius:6px;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:16px;
}
.logo-text{
    font-size:14px;
    font-weight:600;
    letter-spacing:0.5px;
}
.logo-version{
    font-size:10px;
    color:var(--text-muted);
    text-transform:uppercase;
    letter-spacing:1px;
}
.connection-status{
    display:flex;
    align-items:center;
    gap:6px;
    font-size:11px;
    color:var(--text-secondary);
}
.status-dot{
    width:6px;
    height:6px;
    border-radius:50%;
    background:var(--green);
}
.status-dot.warning{background:var(--yellow);}
.status-dot.error{background:var(--red);}
.top-bar-right{
    display:flex;
    align-items:center;
    gap:16px;
    font-family:'JetBrains Mono',monospace;
    font-size:12px;
}
.time-display{
    color:var(--text-secondary);
}
/* 主网格布局 */
.main-grid{
    display:grid;
    grid-template-columns:280px 1fr 320px;
    gap:8px;
}
/* 面板样式 */
.panel{
    background:var(--bg-secondary);
    border:1px solid var(--border-color);
    border-radius:4px;
    overflow:hidden;
}
.panel-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:8px 12px;
    background:var(--bg-card);
    border-bottom:1px solid var(--border-color);
}
.panel-title{
    font-size:11px;
    font-weight:600;
    text-transform:uppercase;
    letter-spacing:0.5px;
    color:var(--text-secondary);
    display:flex;
    align-items:center;
    gap:6px;
}
.panel-title::before{
    content:'';
    width:3px;
    height:12px;
    background:var(--green);
    border-radius:1px;
}
.panel-title.pnl::before{background:var(--green);}
.panel-title.loss::before{background:var(--red);}
.panel-title.neutral::before{background:var(--blue);}
.panel-title.warning::before{background:var(--yellow);}
.panel-body{
    padding:12px;
}
/* 左侧面板 */
.left-column{
    display:flex;
    flex-direction:column;
    gap:8px;
}
/* 控制中心 */
.control-status{
    text-align:center;
    padding:16px;
    background:var(--bg-panel);
    border-radius:4px;
    margin-bottom:12px;
}
.control-status.active{
    border:1px solid var(--green-dark);
    background:linear-gradient(180deg,rgba(34,197,94,0.1),transparent);
}
.control-status.frozen{
    border:1px solid var(--yellow);
    background:linear-gradient(180deg,rgba(234,179,8,0.1),transparent);
}
.control-status.stopped{
    border:1px solid var(--red-dark);
    background:linear-gradient(180deg,rgba(239,68,68,0.1),transparent);
}
.status-main{
    font-size:20px;
    font-weight:700;
    margin-bottom:4px;
}
.status-main.active{color:var(--green);}
.status-main.frozen{color:var(--yellow);}
.status-main.stopped{color:var(--red);}
.status-sub{
    font-size:11px;
    color:var(--text-muted);
}
.control-buttons{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
}
.btn{
    padding:10px 12px;
    border:none;
    border-radius:4px;
    font-size:12px;
    font-weight:500;
    cursor:pointer;
    transition:all 0.15s ease;
    font-family:inherit;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
}
.btn:disabled{
    opacity:0.4;
    cursor:not-allowed;
}
.btn-start{
    background:var(--green);
    color:#000;
}
.btn-start:hover:not(:disabled){background:#4ade80;}
.btn-stop{
    background:var(--red);
    color:#fff;
}
.btn-stop:hover:not(:disabled){background:#f87171;}
.btn-freeze{
    background:var(--yellow);
    color:#000;
}
.btn-freeze:hover:not(:disabled){background:#fde047;}
.btn-reset{
    background:var(--bg-panel);
    color:var(--text-primary);
    border:1px solid var(--border-color);
}
.btn-reset:hover:not(:disabled){background:var(--border-color);}
/* 阈值控制 */
.threshold-section{
    margin-top:16px;
    padding-top:16px;
    border-top:1px solid var(--border-color);
}
.threshold-label{
    font-size:11px;
    color:var(--text-secondary);
    text-transform:uppercase;
}
.threshold-value{
    font-family:'JetBrains Mono',monospace;
    font-size:18px;
    font-weight:600;
    color:var(--blue);
}
/* 行情面板 */
.market-data{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
}
.market-item{
    background:var(--bg-panel);
    padding:10px;
    border-radius:4px;
    border:1px solid var(--border-color);
}
.market-label{
    font-size:11px;
    color:var(--text-secondary);
    margin-bottom:4px;
}
.market-value{
    font-family:'JetBrains Mono',monospace;
    font-size:16px;
    font-weight:600;
}
.market-value.up{color:var(--green);}
.market-value.down{color:var(--red);}
/* 中间主面板 */
.main-column{
    display:flex;
    flex-direction:column;
    gap:8px;
}
.stats-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
    gap:8px;
}
.stat-card{
    background:var(--bg-panel);
    padding:12px;
    border-radius:4px;
    border:1px solid var(--border-color);
}
.stat-label{
    font-size:11px;
    color:var(--text-secondary);
    margin-bottom:4px;
}
.stat-value{
    font-family:'JetBrains Mono',monospace;
    font-size:18px;
    font-weight:600;
}
.stat-value.positive{color:var(--green);}
.stat-value.negative{color:var(--red);}
.stat-value.neutral{color:var(--blue);}
/* 图表区域 */
.chart-container{
    background:var(--bg-panel);
    border-radius:4px;
    border:1px solid var(--border-color);
    height:200px;
    position:relative;
}
/* 右侧详情面板 */
.right-column{
    display:flex;
    flex-direction:column;
    gap:8px;
}
.trade-list{
    max-height:400px;
    overflow-y:auto;
}
.trade-item{
    padding:10px;
    border-bottom:1px solid var(--border-color);
}
.trade-item:last-child{
    border-bottom:none;
}
.trade-header{
    display:flex;
    justify-content:space-between;
    margin-bottom:4px;
}
.trade-source{
    font-size:11px;
    color:var(--text-secondary);
}
.trade-pnl{
    font-family:'JetBrains Mono',monospace;
    font-size:14px;
    font-weight:600;
}
.trade-pnl.positive{color:var(--green);}
.trade-pnl.negative{color:var(--red);}
.trade-details{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
    font-size:11px;
    color:var(--text-muted);
}
.detail-label{
    text-align:right;
}
.detail-value{
    font-family:'JetBrains Mono',monospace;
    text-align:left;
}
/* 响应式 */
@media(max-width:1200px){
    .main-grid{
        grid-template-columns:1fr 320px;
    }
    .left-column{
        display:none;
    }
}
@media(max-width:768px){
    .main-grid{
        grid-template-columns:1fr;
    }
    .right-column{
        display:none;
    }
}
</style>
</head>
<body>
<div class="container">
    <div class="top-bar">
        <div class="top-bar-left">
            <div class="logo">
                <div class="logo-icon">🐉</div>
                <div class="logo-text">小龙交易系统</div>
                <div class="logo-version">V5.4 PRO</div>
            </div>
            <div class="connection-status">
                <div class="status-dot" id="conn-status"></div>
                <span id="conn-text">在线</span>
            </div>
        </div>
        <div class="top-bar-right">
            <div class="time-display" id="current-time"></div>
        </div>
    </div>
    
    <div class="main-grid">
        <!-- 左侧面板 -->
        <div class="left-column">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">控制中心</div>
                </div>
                <div class="panel-body">
                    <div class="control-status active" id="system-status">
                        <div class="status-main active" id="status-main">运行中</div>
                        <div class="status-sub" id="status-sub">系统正常</div>
                    </div>
                    <div class="control-buttons">
                        <button class="btn btn-stop" onclick="stopSystem()">停止</button>
                        <button class="btn btn-freeze" onclick="freezeSystem()">冻结</button>
                        <button class="btn btn-start" onclick="startSystem()">启动</button>
                        <button class="btn btn-reset" onclick="resetSystem()">重置</button>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">阈值控制</div>
                </div>
                <div class="panel-body">
                    <div class="threshold-section">
                        <div class="threshold-header">
                            <div class="threshold-label">安全阈值</div>
                            <div class="threshold-value" id="threshold-value">100%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 中间主面板 -->
        <div class="main-column">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">总交易次数</div>
                    <div class="stat-value" id="total-trades">--</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">累计盈亏</div>
                    <div class="stat-value" id="total-pnl">--</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">胜率</div>
                    <div class="stat-value" id="win-rate">--</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">平均盈亏</div>
                    <div class="stat-value" id="avg-pnl">--</div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title pnl">资金曲线</div>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="equity-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 右侧详情面板 -->
        <div class="right-column">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">最近交易</div>
                </div>
                <div class="panel-body">
                    <div class="trade-list" id="trade-list">
                        <div style="text-align:center;color:var(--text-muted);padding:20px;">暂无交易记录</div>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">安全状态</div>
                </div>
                <div class="panel-body">
                    <div class="market-data">
                        <div class="market-item">
                            <div class="market-label">数据完整</div>
                            <div class="market-value" id="data-complete">--</div>
                        </div>
                        <div class="market-item">
                            <div class="market-label">止损有效</div>
                            <div class="market-value" id="stop-loss">--</div>
                        </div>
                        <div class="market-item">
                            <div class="market-label">验证通过</div>
                            <div class="market-value" id="verified">--</div>
                        </div>
                        <div class="market-item">
                            <div class="market-label">系统安全</div>
                            <div class="market-value" id="system-safe">--</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
function updateUI(data) {
    // 更新时间
    document.getElementById('current-time').textContent = new Date().toLocaleString('zh-CN');
    
    // 系统状态
    const safe = data.safety.safe;
    const statusDiv = document.getElementById('system-status');
    const statusMain = document.getElementById('status-main');
    const statusSub = document.getElementById('status-sub');
    const connStatus = document.getElementById('conn-status');
    
    if (safe) {
        statusDiv.className = 'control-status active';
        statusMain.className = 'status-main active';
        statusMain.textContent = '运行中';
        statusSub.textContent = '系统安全';
        connStatus.className = 'status-dot';
    } else {
        statusDiv.className = 'control-status stopped';
        statusMain.className = 'status-main stopped';
        statusMain.textContent = '已停止';
        statusSub.textContent = data.safety.status || '安全检查失败';
        connStatus.className = 'status-dot error';
    }
    
    // 统计数据
    const stats = data.trade_summary || {};
    document.getElementById('total-trades').textContent = stats.total_trades || 0;
    document.getElementById('total-pnl').textContent = '$' + (stats.total_pnl || 0).toFixed(2);
    document.getElementById('total-pnl').className = 'stat-value ' + (stats.total_pnl >= 0 ? 'positive' : 'negative');
    document.getElementById('win-rate').textContent = ((stats.win_rate || 0) * 100).toFixed(1) + '%';
    document.getElementById('avg-pnl').textContent = '$' + (stats.avg_pnl || 0).toFixed(2);
    document.getElementById('avg-pnl').className = 'stat-value ' + (stats.avg_pnl >= 0 ? 'positive' : 'negative');
    
    // 安全状态
    const checks = data.safety.checks || {};
    document.getElementById('data-complete').textContent = checks.data_complete ? '✅' : '❌';
    document.getElementById('data-complete').className = 'market-value ' + (checks.data_complete ? 'up' : 'down');
    document.getElementById('stop-loss').textContent = checks.stop_ok ? '✅' : '❌';
    document.getElementById('stop-loss').className = 'market-value ' + (checks.stop_ok ? 'up' : 'down');
    document.getElementById('verified').textContent = checks.stop_verified ? '✅' : '❌';
    document.getElementById('verified').className = 'market-value ' + (checks.stop_verified ? 'up' : 'down');
    document.getElementById('system-safe').textContent = safe ? '✅' : '❌';
    document.getElementById('system-safe').className = 'market-value ' + (safe ? 'up' : 'down');
    
    // 最近交易
    const trades = data.recent_trades || [];
    const tradeList = document.getElementById('trade-list');
    if (trades.length > 0) {
        tradeList.innerHTML = trades.slice(0, 10).map(trade => `
            <div class="trade-item">
                <div class="trade-header">
                    <span class="trade-source">${trade.exit_source}</span>
                    <span class="trade-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                        ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                    </span>
                </div>
                <div class="trade-details">
                    <div><span class="detail-label">入场价格</span></div>
                    <div><span class="detail-value">$${trade.entry_price.toFixed(2)}</span></div>
                    <div><span class="detail-label">出场价格</span></div>
                    <div><span class="detail-value">$${trade.exit_price.toFixed(2)}</span></div>
                    <div><span class="detail-label">持仓数量</span></div>
                    <div><span class="detail-value">${trade.position_size.toFixed(4)} ETH</span></div>
                </div>
            </div>
        `).join('');
    } else {
        tradeList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">暂无交易记录</div>';
    }
}

function load() {
    fetch('/api/all')
        .then(response => response.json())
        .then(data => {
            if (data.success !== false) {
                updateUI(data);
            }
        })
        .catch(error => {
            console.error('加载数据失败:', error);
            document.getElementById('conn-status').className = 'status-dot error';
            document.getElementById('conn-text').textContent = '离线';
        });
}

// 控制函数
function stopSystem() {
    fetch('/api/control/stop', {method: 'POST'})
        .then(() => load());
}
function freezeSystem() {
    fetch('/api/control/freeze', {method: 'POST'})
        .then(() => load());
}
function startSystem() {
    fetch('/api/control/start', {method: 'POST'})
        .then(() => load());
}
function resetSystem() {
    if (confirm('确定要重置系统吗？')) {
        fetch('/api/control/reset', {method: 'POST'})
            .then(() => load());
    }
}

// 初始化
load();
setInterval(load, 2000);
</script>
</body>
</html>'''

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/api/all')
def api_all():
    """获取所有数据"""
    try:
        data = bridge.get_state()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/control/<action>', methods=['POST'])
def control_action(action):
    """控制操作"""
    # TODO: 实现实际控制逻辑
    return jsonify({"success": True, "action": action})

if __name__ == '__main__':
    print("="*60)
    print("🐉 小龙交易系统 V5.4 Pro")
    print("="*60)
    print("专业金融终端界面")
    print("V5.4 数据源")
    print("http://localhost:8780/")
    print("="*60)
    app.run(host='0.0.0.0', port=8780, debug=False)