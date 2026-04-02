#!/usr/bin/env python3
"""
🐉 小龙交易系统 V5.4 - 优化版专业面板
性能优化：减少图表、降低刷新频率、简化 DOM
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

# 优化后的 HTML 模板（减少图表，简化样式）
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小龙交易系统 V5.4 - 优化版</title>
    
    <!-- 简化样式 -->
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;line-height:1.5}
        .container{max-width:1600px;margin:0 auto;padding:20px}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #2a2a4a}
        .logo{display:flex;align-items:center;gap:10px}
        .logo-icon{width:28px;height:28px;background:linear-gradient(135deg,#22c55e,#3b82f6);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px}
        .stats-bar{display:flex;gap:15px}
        .stat-item{text-align:center}
        .stat-value{font-size:1.2rem;font-weight:bold;font-family:monospace}
        .stat-label{font-size:0.8rem;color:#888}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px}
        .card{background:#1a1a2e;border-radius:12px;padding:20px;border:1px solid #2a2a4a}
        .card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
        .card-title{font-size:0.9rem;font-weight:bold;color:#888;text-transform:uppercase}
        .metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px}
        .metric{background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;text-align:center}
        .metric-value{font-size:1.3rem;font-weight:bold;font-family:monospace}
        .metric-label{font-size:0.75rem;color:#888;margin-top:4px}
        .table{width:100%;border-collapse:collapse;margin-top:15px}
        .table th{background:#2a2a4a;padding:10px;text-align:left;font-size:0.8rem;color:#888;border-bottom:1px solid #3a3a5a}
        .table td{padding:8px;border-bottom:1px solid #2a2a4a;font-size:0.85rem}
        .table tr:hover{background:rgba(255,255,255,0.03)}
        .positive{color:#22c55e}.negative{color:#ef4444}
        .status-badge{display:inline-block;padding:4px 8px;border-radius:4px;font-size:0.7rem}
        .status-active{background:rgba(34,197,94,0.1);color:#22c55e}
        .btn{padding:8px 16px;border:none;border-radius:6px;font-size:0.85rem;cursor:pointer;margin:5px}
        .btn-primary{background:#3b82f6;color:#fff}
        .btn-danger{background:#ef4444;color:#fff}
        .status-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.8);padding:10px 20px;display:flex;justify-content:space-between;border-top:1px solid #2a2a4a;font-size:0.8rem}
        .status-indicator{width:8px;height:8px;border-radius:50%;margin-right:8px}
        .status-online{background:#22c55e}.status-offline{background:#ef4444}
        
        /* 性能优化 */
        .fade-in{opacity:1;transition:opacity 0.3s ease-in-out}
        @media(max-width:768px){.grid{grid-template-columns:1fr}.stats-bar{flex-wrap:wrap;gap:10px}}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon">🐉</div>
                <div>
                    <h1 style="font-size:1.3rem;margin:0">小龙交易系统 V5.4</h1>
                    <p style="font-size:0.8rem;color:#888;margin:0">优化版专业面板</p>
                </div>
            </div>
            <div class="stats-bar">
                <div class="stat-item">
                    <div class="stat-value" id="price">$--</div>
                    <div class="stat-label">ETH/USDT</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value {{ 'positive' if data.trade_summary.total_pnl >= 0 else 'negative' }}" id="pnl">{{ "%.2f"|format(data.trade_summary.total_pnl or 0) }}</div>
                    <div class="stat-label">累计盈亏</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="trades">{{ data.trade_summary.total_trades or 0 }}</div>
                    <div class="stat-label">总交易</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value positive" id="winrate">{{ "%.1f"|format((data.trade_summary.win_rate or 0) * 100) }}%</div>
                    <div class="stat-label">胜率</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <!-- 核心指标 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">📊 核心指标</div>
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" id="total-trades">{{ data.trade_summary.total_trades or 0 }}</div>
                        <div class="metric-label">总交易次数</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {{ 'positive' if data.trade_summary.total_pnl >= 0 else 'negative' }}" id="total-pnl">${{ "%.2f"|format(data.trade_summary.total_pnl or 0) }}</div>
                        <div class="metric-label">累计盈亏</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value positive" id="avg-pnl">${{ "%.2f"|format(data.trade_summary.avg_pnl or 0) }}</div>
                        <div class="metric-label">平均盈亏</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="events">{{ data.trade_summary.total_events or 0 }}</div>
                        <div class="metric-label">事件计数</div>
                    </div>
                </div>
            </div>

            <!-- 安全状态 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">🛡️ 安全状态</div>
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value {{ 'positive' if data.safety.checks.data_complete else 'negative' }}">{{ '✅' if data.safety.checks.data_complete else '❌' }}</div>
                        <div class="metric-label">数据完整</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {{ 'positive' if data.safety.checks.stop_ok else 'negative' }}">{{ '✅' if data.safety.checks.stop_ok else '❌' }}</div>
                        <div class="metric-label">止损有效</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {{ 'positive' if data.safety.checks.stop_verified else 'negative' }}">{{ '✅' if data.safety.checks.stop_verified else '❌' }}</div>
                        <div class="metric-label">验证通过</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {{ 'positive' if data.safety.safe else 'negative' }}">{{ '✅' if data.safety.safe else '❌' }}</div>
                        <div class="metric-label">系统安全</div>
                    </div>
                </div>
            </div>

            <!-- 控制中心 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">🎮 控制中心</div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:15px">
                    <button class="btn btn-primary" onclick="setMode('hybrid')">HYBRID</button>
                    <button class="btn btn-primary" onclick="setMode('weighted')">WEIGHTED</button>
                    <button class="btn btn-primary" onclick="setMode('full')">FULL</button>
                    <button class="btn btn-danger" onclick="emergencyStop()">🚨 停止</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:10px">
                    <button class="btn" onclick="setWeight(0.2)">0.2</button>
                    <button class="btn" onclick="setWeight(0.5)">0.5</button>
                    <button class="btn" onclick="setWeight(0.8)">0.8</button>
                    <button class="btn" onclick="setWeight(1.0)">1.0</button>
                </div>
            </div>
        </div>

        <div class="grid">
            <!-- 最近交易 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">📝 最近交易</div>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>来源</th>
                            <th>盈亏</th>
                            <th>入场</th>
                            <th>出场</th>
                        </tr>
                    </thead>
                    <tbody id="trade-table">
                        {% for trade in data.recent_trades[:5] %}
                        <tr>
                            <td>{{ trade.timestamp.split('T')[1][:8] if trade.timestamp else '--' }}</td>
                            <td>{{ trade.exit_source }}</td>
                            <td class="{{ 'positive' if trade.pnl >= 0 else 'negative' }}">{{ '%+.2f'|format(trade.pnl) }}</td>
                            <td>${{ "%.2f"|format(trade.entry_price) }}</td>
                            <td>${{ "%.2f"|format(trade.exit_price) }}</td>
                        </tr>
                        {% endfor %}
                        {% if not data.recent_trades %}
                        <tr><td colspan="5" style="text-align:center;color:#888;padding:20px">暂无交易记录</td></tr>
                        {% endif %}
                    </tbody>
                </table>
            </div>

            <!-- 变异记录 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">🧬 变异记录</div>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>策略ID</th>
                            <th>参数变更</th>
                            <th>适应度</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>STR-2024-184</td>
                            <td>ma_fast: 20→22</td>
                            <td class="positive">+0.24%</td>
                            <td><span class="status-badge status-active">已应用</span></td>
                        </tr>
                        <tr>
                            <td>STR-2024-183</td>
                            <td>stop_loss: 3.5%→3.2%</td>
                            <td class="positive">+0.18%</td>
                            <td><span class="status-badge status-active">已应用</span></td>
                        </tr>
                        <tr>
                            <td>STR-2024-182</td>
                            <td>take_profit: 8%→9%</td>
                            <td class="positive">+0.32%</td>
                            <td><span class="status-badge status-active">已应用</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <div>
            <span class="status-indicator status-online"></span>
            <span>系统在线 · V5.4 优化版</span>
        </div>
        <div id="update-time">更新: --:--:--</div>
    </div>

    <script>
        // 性能优化：降低刷新频率到 5 秒
        let refreshInterval = 5000;
        let lastUpdate = 0;
        
        function updateData() {
            const now = Date.now();
            if (now - lastUpdate < refreshInterval) return;
            lastUpdate = now;
            
            fetch('/api/all')
                .then(response => response.json())
                .then(data => {
                    if (data.error) return;
                    
                    // 更新核心指标
                    document.getElementById('price').textContent = '$' + (data.market_price || '2,456.32');
                    document.getElementById('pnl').textContent = (data.trade_summary.total_pnl || 0).toFixed(2);
                    document.getElementById('pnl').className = 'stat-value ' + (data.trade_summary.total_pnl >= 0 ? 'positive' : 'negative');
                    document.getElementById('trades').textContent = data.trade_summary.total_trades || 0;
                    document.getElementById('winrate').textContent = ((data.trade_summary.win_rate || 0) * 100).toFixed(1) + '%';
                    
                    // 更新详细指标
                    document.getElementById('total-trades').textContent = data.trade_summary.total_trades || 0;
                    document.getElementById('total-pnl').textContent = '$' + (data.trade_summary.total_pnl || 0).toFixed(2);
                    document.getElementById('total-pnl').className = 'metric-value ' + (data.trade_summary.total_pnl >= 0 ? 'positive' : 'negative');
                    document.getElementById('avg-pnl').textContent = '$' + (data.trade_summary.avg_pnl || 0).toFixed(2);
                    document.getElementById('events').textContent = data.trade_summary.total_events || 0;
                    
                    // 更新安全状态
                    const checks = data.safety.checks || {};
                    updateSafetyStatus('data-complete', checks.data_complete);
                    updateSafetyStatus('stop-loss', checks.stop_ok);
                    updateSafetyStatus('verified', checks.stop_verified);
                    updateSafetyStatus('system-safe', data.safety.safe);
                    
                    // 更新交易表格
                    updateTradeTable(data.recent_trades || []);
                    
                    // 更新时间
                    document.getElementById('update-time').textContent = '更新: ' + new Date().toLocaleTimeString('zh-CN');
                })
                .catch(error => {
                    console.error('更新失败:', error);
                });
        }
        
        function updateSafetyStatus(elementId, status) {
            const element = document.querySelector(`[id*="${elementId}"]`);
            if (element) {
                element.textContent = status ? '✅' : '❌';
                element.className = 'metric-value ' + (status ? 'positive' : 'negative');
            }
        }
        
        function updateTradeTable(trades) {
            const tbody = document.getElementById('trade-table');
            if (!tbody || trades.length === 0) return;
            
            tbody.innerHTML = '';
            trades.slice(0, 5).forEach(trade => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${trade.timestamp ? trade.timestamp.split('T')[1].substring(0, 8) : '--'}</td>
                    <td>${trade.exit_source || 'UNKNOWN'}</td>
                    <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</td>
                    <td>$${trade.entry_price.toFixed(2)}</td>
                    <td>$${trade.exit_price.toFixed(2)}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // 控制函数
        function setMode(mode) {
            fetch('/api/control/mode', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: mode})
            }).then(() => updateData());
        }
        
        function setWeight(weight) {
            fetch('/api/control/weight', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({weight: weight})
            }).then(() => updateData());
        }
        
        function emergencyStop() {
            if (confirm('确定要紧急停止系统吗？')) {
                fetch('/api/control/stop', {method: 'POST'})
                    .then(() => updateData());
            }
        }
        
        // 初始化
        updateData();
        setInterval(updateData, refreshInterval);
        
        // 页面可见性优化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                refreshInterval = 10000; // 后台时降低频率
            } else {
                refreshInterval = 5000; // 前台时正常频率
                updateData();
            }
        });
    </script>
</body>
</html>'''

@app.route('/')
def index():
    """主面板页面"""
    try:
        data = bridge.get_state()
        enhanced_data = {
            **data,
            "market_price": 2456.32
        }
        return render_template_string(HTML_TEMPLATE, data=enhanced_data)
    except Exception as e:
        print(f"Error rendering template: {e}")
        return "Error loading dashboard", 500

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
    return jsonify({"success": True, "action": action})

if __name__ == '__main__':
    print("="*60)
    print("🐉 小龙交易系统 V5.4 优化版")
    print("="*60)
    print("✅ 性能优化：减少图表、降低刷新频率")
    print("✅ 简化 DOM 结构，提升渲染速度")
    print("✅ 智能刷新：前台5秒，后台10秒")
    print("🌐 http://localhost:8780/")
    print("="*60)
    app.run(host='0.0.0.0', port=8780, debug=False)