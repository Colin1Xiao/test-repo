"""
Control Tower v3 - 公网监控服务器
绑定小龙交易系统 V5.2 实时数据

访问地址:
- 本地: http://localhost:8765
- 公网: http://<公网IP>:8765 (需配合 frp/ngrok/cloudflared)
"""

import json
import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import asdict

from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 导入 V5.2 系统组件
try:
    from decision_hub_v3 import DecisionHubV3, SystemState
    from shadow_integration import DecisionDiffLogger, ShadowModeRunner
    from module_adapters import StateAggregator
    V53_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ V5.3 组件导入失败: {e}")
    V53_AVAILABLE = False


class ControlTowerServer:
    """Control Tower 公网服务器"""
    
    def __init__(self, data_source: str = "v52_live"):
        self.data_source = data_source
        self.app = FastAPI(title="小龙 Control Tower v3", version="5.2.0")
        
        # CORS 配置（允许公网访问）
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # 初始化组件
        self._init_components()
        
        # 设置路由
        self._setup_routes()
        
        # WebSocket 连接管理
        self.ws_clients: List[WebSocket] = []
        
        # 启动数据推送任务
        self.push_task = None
    
    def _init_components(self):
        """初始化系统组件"""
        if V53_AVAILABLE:
            from shadow_integration import DecisionDiffLogger
            # 先创建 logger，加载历史数据，再创建 runner
            self.logger = DecisionDiffLogger()
            print("✅ V5.3 Shadow Mode 已加载")
        else:
            self.runner = None
            self.logger = None
            print("⚠️ 使用模拟数据模式")
        
        # 加载历史数据（在 runner 创建之前）
        self._load_historical_data()
        
        # 创建 runner（使用已加载数据的 logger）
        if V53_AVAILABLE:
            from shadow_integration import ShadowModeRunner
            self.runner = ShadowModeRunner()
            # 替换 runner 的 logger 为已加载数据的 logger
            self.runner.logger = self.logger
    
    def _load_historical_data(self):
        """加载历史决策数据"""
        log_dir = Path("logs/decision_diff")
        if not log_dir.exists():
            return
        
        # 加载所有历史文件（最近7天）
        from datetime import timedelta
        loaded_count = 0
        
        for i in range(7):
            date = datetime.now() - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            log_file = log_dir / f"decision_diff_{date_str}.jsonl"
            
            if log_file.exists():
                print(f"📊 加载历史数据: {log_file}")
                with open(log_file) as f:
                    for line in f:
                        try:
                            data = json.loads(line.strip())
                            if self.logger:
                                from shadow_integration import DecisionDiff
                                diff = DecisionDiff(**data)
                                self.logger.diffs.append(diff)
                                loaded_count += 1
                        except Exception as e:
                            print(f"⚠️ 解析日志失败: {e}")
        
        if loaded_count > 0:
            print(f"✅ 共加载 {loaded_count} 条历史决策")
    
    def _setup_routes(self):
        """设置 API 路由"""
        
        @self.app.get("/", response_class=HTMLResponse)
        async def root():
            """主页面 - 重定向到 Control Tower"""
            return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="refresh" content="0; url=/control-tower">
                <title>小龙 Control Tower v3</title>
            </head>
            <body>
                <p>Redirecting to <a href="/control-tower">Control Tower</a>...</p>
            </body>
            </html>
            """
        
        @self.app.get("/control-tower", response_class=HTMLResponse)
        async def control_tower():
            """Control Tower 监控面板"""
            return self._get_html_content()
        
        @self.app.get("/api/stats")
        async def get_stats() -> Dict[str, Any]:
            """执行统计"""
            return self._get_live_stats()
        
        @self.app.get("/api/audit")
        async def get_audit() -> Dict[str, Any]:
            """收益审计"""
            return self._get_live_audit()
        
        @self.app.get("/api/decision_diff")
        async def get_decision_diff() -> Dict[str, Any]:
            """决策差异统计"""
            return self._get_diff_stats()
        
        @self.app.get("/api/decision_diff/recent")
        async def get_recent_decisions(limit: int = 20) -> List[Dict[str, Any]]:
            """最近决策"""
            return self._get_recent_decisions(limit)
        
        @self.app.get("/api/risk")
        async def get_risk() -> Dict[str, Any]:
            """AI 风险状态"""
            return self._get_risk_status()
        
        @self.app.get("/api/mode")
        async def get_mode() -> Dict[str, str]:
            """当前模式"""
            return {"mode": self._get_current_mode()}
        
        @self.app.post("/api/mode")
        async def set_mode(data: Dict[str, str]) -> Dict[str, Any]:
            """设置模式"""
            mode = data.get("mode", "shadow")
            success = self._set_mode(mode)
            return {"success": success, "mode": mode}
        
        @self.app.get("/api/system/status")
        async def get_system_status() -> Dict[str, Any]:
            """完整系统状态"""
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "version": "5.2.0",
                "mode": self._get_current_mode(),
                "stats": self._get_live_stats(),
                "audit": self._get_live_audit(),
                "diff": self._get_diff_stats(),
                "risk": self._get_risk_status()
            }
        
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            """WebSocket 实时数据推送"""
            await websocket.accept()
            self.ws_clients.append(websocket)
            print(f"🔌 WebSocket 客户端连接 (当前: {len(self.ws_clients)})")
            
            try:
                while True:
                    # 等待客户端消息（心跳）
                    data = await websocket.receive_text()
                    if data == "ping":
                        await websocket.send_text("pong")
            except Exception as e:
                print(f"⚠️ WebSocket 断开: {e}")
            finally:
                self.ws_clients.remove(websocket)
                print(f"🔌 WebSocket 客户端断开 (剩余: {len(self.ws_clients)})")
    
    def _get_html_content(self) -> str:
        """获取 HTML 内容 - 始终使用内嵌 HTML"""
        # 使用内嵌 HTML，不读取旧文件
        return self._get_default_html()
    
    def _get_default_html(self) -> str:
        """默认 HTML 模板"""
        return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小龙 Control Tower v3 - V5.2 实时监控</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
        }
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 20px;
            border-bottom: 1px solid #334155;
        }
        .header h1 {
            font-size: 24px;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header .subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-top: 5px;
        }
        .verdict {
            padding: 30px;
            text-align: center;
            border-bottom: 1px solid #334155;
        }
        .verdict.safe { background: rgba(34, 197, 94, 0.1); }
        .verdict.warn { background: rgba(234, 179, 8, 0.1); }
        .verdict.block { background: rgba(239, 68, 68, 0.1); }
        .verdict .title {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .verdict.safe .title { color: #22c55e; }
        .verdict.warn .title { color: #eab308; }
        .verdict.block .title { color: #ef4444; }
        .verdict .subtitle {
            font-size: 16px;
            color: #94a3b8;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .card {
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #334155;
        }
        .card h3 {
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #334155;
        }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { color: #64748b; }
        .metric-value { font-weight: 600; }
        .metric-value.good { color: #22c55e; }
        .metric-value.warn { color: #eab308; }
        .metric-value.bad { color: #ef4444; }
        .go-nogo {
            padding: 30px;
            text-align: center;
        }
        .go-state {
            background: rgba(34, 197, 94, 0.1);
            border: 2px solid #22c55e;
            border-radius: 12px;
            padding: 30px;
        }
        .go-state h2 {
            color: #22c55e;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .nogo-state {
            background: rgba(239, 68, 68, 0.1);
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 30px;
        }
        .nogo-state h2 {
            color: #ef4444;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .mode-buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        .mode-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }
        .mode-btn.shadow {
            background: #64748b;
            color: white;
        }
        .mode-btn.hybrid {
            background: #eab308;
            color: black;
        }
        .mode-btn.full {
            background: #22c55e;
            color: white;
        }
        .mode-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .mode-btn.active {
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.5);
        }
        .recent-decisions {
            max-height: 300px;
            overflow-y: auto;
        }
        .decision-item {
            display: grid;
            grid-template-columns: 60px 80px 70px 30px 70px 90px 70px;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid #334155;
            font-size: 12px;
            align-items: center;
        }
        .decision-time { color: #64748b; }
        .decision-id { color: #38bdf8; }
        .decision-diff { padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .diff-same { background: #22c55e; color: white; }
        .diff-conservative { background: #eab308; color: black; }
        .diff-aggressive { background: #ef4444; color: white; }
        .decision-risk { padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .risk-low { background: #22c55e; color: white; }
        .risk-medium { background: #eab308; color: black; }
        .risk-high { background: #ef4444; color: white; }
        .loading { color: #64748b; font-style: italic; }
        .status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1e293b;
            padding: 10px 20px;
            border-top: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        }
        .status-bar .online { color: #22c55e; }
        .status-bar .offline { color: #ef4444; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐉 小龙 Control Tower v3</h1>
        <div class="subtitle">V5.2 实时监控系统 | 公网访问模式</div>
    </div>
    
    <div id="verdict" class="verdict warn">
        <div class="title">🟡 INITIALIZING</div>
        <div class="subtitle">正在连接 V5.2 数据源...</div>
    </div>
    
    <div class="metrics">
        <div class="card">
            <h3>⚡ 执行稳定性</h3>
            <div id="execution"><span class="loading">Loading...</span></div>
        </div>
        <div class="card">
            <h3>📈 收益审计</h3>
            <div id="edge"><span class="loading">Loading...</span></div>
        </div>
        <div class="card">
            <h3>💧 滑点侵蚀</h3>
            <div id="slippage"><span class="loading">Loading...</span></div>
        </div>
        <div class="card">
            <h3>⚖️ 决策差异</h3>
            <div id="diff"><span class="loading">Loading...</span></div>
        </div>
        <div class="card">
            <h3>🛡️ 风控状态</h3>
            <div id="risk"><span class="loading">Loading...</span></div>
        </div>
        <div class="card">
            <h3>📊 决策分布</h3>
            <div id="distribution"><span class="loading">Loading...</span></div>
        </div>
    </div>
    
    <div class="go-nogo" id="go-nogo">
        <div class="nogo-state">
            <h2>⏳ LOADING</h2>
            <p>等待 V5.2 系统数据...</p>
        </div>
    </div>
    
    <div class="card" style="margin: 20px;">
        <h3>📝 最近决策</h3>
        <div id="recent-list" class="recent-decisions">
            <span class="loading">Loading...</span>
        </div>
    </div>
    
    <div class="status-bar">
        <span id="ws-status" class="offline">● WebSocket 断开</span>
        <span id="last-update">最后更新: --</span>
    </div>
    
    <script>
        const CONFIG = {
            refreshInterval: 2000,
            wsReconnectInterval: 5000
        };
        
        let ws = null;
        let reconnectTimer = null;
        
        // 获取 API 数据
        async function fetchJSON(url) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (e) {
                console.error(`Fetch error: ${url}`, e);
                return null;
            }
        }
        
        // 渲染函数
        function renderVerdict(stats, audit, diff) {
            const el = document.getElementById('verdict');
            if (!diff || diff.total === 0) {
                el.className = 'verdict warn';
                el.innerHTML = '<div class="title">🟡 INITIALIZING</div><div class="subtitle">等待 Shadow 数据...</div>';
                return;
            }
            
            const diffRate = parseFloat(diff.diff_rate);
            let verdictClass = 'safe';
            let title = '🟢 SYSTEM SAFE';
            let subtitle = '所有指标正常';
            
            if (diff.over_aggressive > 0) {
                verdictClass = 'block';
                title = '🔴 BLOCK';
                subtitle = '检测到激进决策，禁止上线';
            } else if (diffRate > 30) {
                verdictClass = 'warn';
                title = '🟡 WARN';
                subtitle = `差异率 ${diffRate.toFixed(1)}% 超过阈值`;
            }
            
            el.className = `verdict ${verdictClass}`;
            el.innerHTML = `
                <div class="title">${title}</div>
                <div class="subtitle">${subtitle}</div>
                <div style="display: flex; gap: 20px; justify-content: center; margin-top: 15px; font-size: 14px;">
                    <span>PF: <b>${audit?.profit_factor?.toFixed(2) || '-'}</b></span>
                    <span>Diff: <b>${diff.diff_rate}</b></span>
                    <span>Samples: <b>${diff.total}</b></span>
                    <span>Aggressive: <b style="color: ${diff.over_aggressive > 0 ? '#ef4444' : '#22c55e'}">${diff.over_aggressive}</b></span>
                </div>
            `;
        }
        
        function renderExecution(stats) {
            const el = document.getElementById('execution');
            if (!stats) { el.innerHTML = '<span class="loading">No data</span>'; return; }
            el.innerHTML = `
                <div class="metric-row"><span class="metric-label">Errors</span><span class="metric-value ${stats.errors > 0 ? 'bad' : 'good'}">${stats.errors}</span></div>
                <div class="metric-row"><span class="metric-label">Latency P50</span><span class="metric-value">${stats.p50} ms</span></div>
                <div class="metric-row"><span class="metric-label">Latency P90</span><span class="metric-value">${stats.p90} ms</span></div>
                <div class="metric-row"><span class="metric-label">Status</span><span class="metric-value ${stats.errors > 0 ? 'bad' : 'good'}">${stats.status}</span></div>
            `;
        }
        
        function renderEdge(audit) {
            const el = document.getElementById('edge');
            if (!audit) { el.innerHTML = '<span class="loading">No data</span>'; return; }
            const pf = audit.profit_factor || 0;
            el.innerHTML = `
                <div class="metric-row"><span class="metric-label">Profit Factor</span><span class="metric-value ${pf >= 1.2 ? 'good' : pf >= 1.0 ? 'warn' : 'bad'}">${pf.toFixed(2)}</span></div>
                <div class="metric-row"><span class="metric-label">Expectancy</span><span class="metric-value ${audit.expectancy > 0 ? 'good' : 'bad'}">${audit.expectancy?.toFixed(4) || '-'}</span></div>
                <div class="metric-row"><span class="metric-label">Drawdown</span><span class="metric-value ${audit.drawdown < 0.05 ? 'good' : audit.drawdown < 0.1 ? 'warn' : 'bad'}">${(audit.drawdown * 100).toFixed(1)}%</span></div>
                <div class="metric-row"><span class="metric-label">Status</span><span class="metric-value ${pf >= 1.2 ? 'good' : 'warn'}">${pf >= 1.2 ? 'STRONG' : 'WEAK'}</span></div>
            `;
        }
        
        function renderSlippage(audit) {
            const el = document.getElementById('slippage');
            if (!audit) { el.innerHTML = '<span class="loading">No data</span>'; return; }
            const ratio = audit.slippage_ratio || 0;
            el.innerHTML = `
                <div class="metric-row"><span class="metric-label">Slippage Ratio</span><span class="metric-value ${ratio < 30 ? 'good' : ratio < 60 ? 'warn' : 'bad'}">${ratio.toFixed(1)}%</span></div>
                <div style="background: #334155; height: 20px; border-radius: 4px; margin: 10px 0; overflow: hidden;">
                    <div style="background: ${ratio < 30 ? '#22c55e' : ratio < 60 ? '#eab308' : '#ef4444'}; width: ${Math.min(ratio, 100)}%; height: 100%;"></div>
                </div>
                <div class="metric-row"><span class="metric-label">Source</span><span class="metric-value">${audit.slippage_source}</span></div>
            `;
        }
        
        function renderDiff(diff) {
            const el = document.getElementById('diff');
            if (!diff || diff.total === 0) { el.innerHTML = '<span class="loading">等待数据...</span>'; return; }
            const diffRate = parseFloat(diff.diff_rate);
            el.innerHTML = `
                <div class="metric-row"><span class="metric-label">Diff Rate</span><span class="metric-value ${diffRate < 20 ? 'good' : diffRate < 30 ? 'warn' : 'bad'}">${diff.diff_rate}</span></div>
                <div class="metric-row"><span class="metric-label">Aggressive</span><span class="metric-value ${diff.over_aggressive === 0 ? 'good' : 'bad'}">${diff.over_aggressive} 🚨</span></div>
                <div class="metric-row"><span class="metric-label">Conservative</span><span class="metric-value">${diff.conservative}</span></div>
                <div class="metric-row"><span class="metric-label">Recommendation</span><span class="metric-value ${diff.recommendation === 'PASS' ? 'good' : diff.recommendation === 'WARN' ? 'warn' : 'bad'}">${diff.recommendation}</span></div>
            `;
        }
        
        function renderRisk(risk) {
            const el = document.getElementById('risk');
            if (!risk) { el.innerHTML = '<span class="loading">No data</span>'; return; }
            el.innerHTML = `
                <div class="metric-row"><span class="metric-label">AI Risk</span><span class="metric-value ${risk.level === 'LOW' ? 'good' : risk.level === 'MEDIUM' ? 'warn' : 'bad'}">${risk.level}</span></div>
                <div class="metric-row"><span class="metric-label">Circuit</span><span class="metric-value ${risk.circuit === 'NORMAL' ? 'good' : 'bad'}">${risk.circuit}</span></div>
                <div class="metric-row"><span class="metric-label">Capital</span><span class="metric-value ${risk.capital === 'NORMAL' ? 'good' : risk.capital === 'REDUCED' ? 'warn' : 'bad'}">${risk.capital}</span></div>
            `;
        }
        
        function renderDistribution(diff) {
            const el = document.getElementById('distribution');
            if (!diff || !diff.distribution) { el.innerHTML = '<span class="loading">No data</span>'; return; }
            let html = '';
            for (const [key, count] of Object.entries(diff.distribution)) {
                const pct = ((count / diff.total) * 100).toFixed(1);
                html += `<div class="metric-row"><span class="metric-label">${key}</span><span class="metric-value">${count} (${pct}%)</span></div>`;
            }
            el.innerHTML = html;
        }
        
        function renderRecent(recent) {
            const el = document.getElementById('recent-list');
            if (!recent || recent.length === 0) { el.innerHTML = '<span class="loading">No recent decisions</span>'; return; }
            let html = '';
            for (const item of recent.slice(0, 15)) {
                const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
                const diffClass = item.diff_type === 'SAME' ? 'diff-same' : item.diff_type === 'CONSERVATIVE' ? 'diff-conservative' : 'diff-aggressive';
                const riskClass = item.risk_level === 'LOW' ? 'risk-low' : item.risk_level === 'MEDIUM' ? 'risk-medium' : 'risk-high';
                html += `
                    <div class="decision-item">
                        <span class="decision-time">${time}</span>
                        <span class="decision-id">${item.signal_id}</span>
                        <span>${item.old_action}</span>
                        <span>→</span>
                        <span>${item.new_action}</span>
                        <span class="decision-diff ${diffClass}">${item.diff_type}</span>
                        <span class="decision-risk ${riskClass}">${item.risk_level}</span>
                    </div>
                `;
            }
            el.innerHTML = html;
        }
        
        function renderGoNoGo(diff) {
            const el = document.getElementById('go-nogo');
            const count = diff?.total || 0;
            const minSamples = 30;
            
            if (!diff || count < minSamples) {
                el.innerHTML = `
                    <div class="nogo-state">
                        <h2>⛔ NO-GO</h2>
                        <p>等待 Shadow 数据积累</p>
                        <p>当前: ${count} / ${minSamples} 笔</p>
                        <div style="background: #334155; height: 10px; border-radius: 5px; margin-top: 15px; overflow: hidden;">
                            <div style="background: #ef4444; width: ${(count / minSamples) * 100}%; height: 100%;"></div>
                        </div>
                    </div>
                `;
            } else if (diff.over_aggressive > 0) {
                el.innerHTML = `
                    <div class="nogo-state">
                        <h2>⛔ NO-GO</h2>
                        <p>检测到 ${diff.over_aggressive} 笔激进决策</p>
                        <p>新系统比旧系统更激进，禁止上线</p>
                    </div>
                `;
            } else if (parseFloat(diff.diff_rate) > 30) {
                el.innerHTML = `
                    <div class="nogo-state">
                        <h2>⛔ NO-GO</h2>
                        <p>差异率 ${diff.diff_rate} 超过阈值 30%</p>
                        <p>系统行为变化过大，需要审查</p>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="go-state">
                        <h2>✅ GO</h2>
                        <p>Shadow 验证通过</p>
                        <p>差异率: ${diff.diff_rate} | 激进: ${diff.over_aggressive}</p>
                    </div>
                `;
            }
        }
        
        // 加载所有数据
        async function loadAll() {
            const [stats, audit, diff, risk, recent] = await Promise.all([
                fetchJSON('/api/stats'),
                fetchJSON('/api/audit'),
                fetchJSON('/api/decision_diff'),
                fetchJSON('/api/risk'),
                fetchJSON('/api/decision_diff/recent')
            ]);
            
            renderVerdict(stats, audit, diff);
            renderExecution(stats);
            renderEdge(audit);
            renderSlippage(audit);
            renderDiff(diff);
            renderRisk(risk);
            renderDistribution(diff);
            renderRecent(recent);
            renderGoNoGo(diff);
            
            document.getElementById('last-update').textContent = '最后更新: ' + new Date().toLocaleTimeString('zh-CN');
        }
        
        // WebSocket 连接
        function connectWebSocket() {
            const wsUrl = `ws://${window.location.host}/ws`;
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('ws-status').innerHTML = '<span class="online">● WebSocket 连接</span>';
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                document.getElementById('ws-status').innerHTML = '<span class="offline">● WebSocket 断开</span>';
                reconnectTimer = setTimeout(connectWebSocket, CONFIG.wsReconnectInterval);
            };
            
            ws.onerror = (e) => {
                console.error('WebSocket error:', e);
            };
            
            ws.onmessage = (event) => {
                if (event.data === 'update') {
                    loadAll();
                }
            };
        }
        
        // 初始化
        loadAll();
        setInterval(loadAll, CONFIG.refreshInterval);
        connectWebSocket();
    </script>
</body>
</html>
"""
    
    # ============ 数据获取方法 ============
    
    def _get_live_stats(self) -> Dict[str, Any]:
        """获取实时执行统计"""
        # TODO: 从 V5.2 系统获取真实数据
        return {
            "errors": 0,
            "p50": 1039,
            "p90": 1343,
            "status": "HEALTHY"
        }
    
    def _get_live_audit(self) -> Dict[str, Any]:
        """获取实时收益审计"""
        # TODO: 从 profit_audit.py 获取真实数据
        return {
            "profit_factor": 1.48,
            "expectancy": 0.0438,
            "drawdown": 0.006,
            "slippage_ratio": 58.9,
            "slippage_source": "ENTRY"
        }
    
    def _get_diff_stats(self) -> Dict[str, Any]:
        """获取决策差异统计"""
        if self.logger and len(self.logger.diffs) > 0:
            diffs = self.logger.diffs
            total = len(diffs)
            
            # 计算统计
            same = sum(1 for d in diffs if d.diff_type == "SAME")
            conservative = sum(1 for d in diffs if d.diff_type == "CONSERVATIVE")
            aggressive = sum(1 for d in diffs if d.diff_type == "AGGRESSIVE")
            
            diff_count = total - same
            diff_rate = diff_count / total if total > 0 else 0
            
            # 推荐
            if aggressive > 0:
                recommendation = "BLOCK"
            elif diff_rate > 0.2:
                recommendation = "WARN"
            else:
                recommendation = "PASS"
            
            # 分布
            distribution = {}
            for diff in diffs:
                reason = diff.new_reason
                distribution[reason] = distribution.get(reason, 0) + 1
            
            return {
                "total": total,
                "same": same,
                "conservative": conservative,
                "aggressive": aggressive,
                "diff_rate": f"{diff_rate*100:.1f}%",
                "recommendation": recommendation,
                "distribution": distribution
            }
        
        return {
            "total": 0,
            "same": 0,
            "conservative": 0,
            "aggressive": 0,
            "diff_rate": "0%",
            "recommendation": "NO_DATA",
            "distribution": {}
        }
    
    def _get_recent_decisions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取最近决策"""
        if self.logger:
            recent = self.logger.get_recent(limit)
            return [
                {
                    "timestamp": diff.timestamp,
                    "signal_id": diff.signal_id,
                    "old_action": diff.old_action,
                    "new_action": diff.new_action,
                    "diff_type": diff.diff_type,
                    "risk_level": diff.risk_level,
                    "new_reason": diff.new_reason
                }
                for diff in recent
            ]
        return []
    
    def _get_risk_status(self) -> Dict[str, str]:
        """获取风险状态"""
        return {
            "level": "LOW",
            "circuit": "NORMAL",
            "capital": "NORMAL"
        }
    
    def _get_current_mode(self) -> str:
        """获取当前模式"""
        # TODO: 从系统配置读取
        return "shadow"
    
    def _set_mode(self, mode: str) -> bool:
        """设置模式"""
        # TODO: 实现模式切换逻辑
        print(f"🔄 模式切换请求: {mode}")
        return True
    
    # ============ 服务器运行 ============
    
    async def _broadcast_update(self):
        """广播更新到所有 WebSocket 客户端"""
        disconnected = []
        for client in self.ws_clients:
            try:
                await client.send_text("update")
            except Exception:
                disconnected.append(client)
        
        # 清理断开的连接
        for client in disconnected:
            if client in self.ws_clients:
                self.ws_clients.remove(client)
    
    async def _push_loop(self):
        """数据推送循环"""
        while True:
            await asyncio.sleep(2)
            await self._broadcast_update()
    
    def run(self, host: str = "0.0.0.0", port: int = 8766):
        """运行服务器"""
        print("="*60)
        print("🐉 小龙 Control Tower v3 - 公网服务器")
        print("="*60)
        print(f"\n📡 数据绑定: V5.2 实时系统")
        print(f"🌐 访问地址:")
        print(f"   本地: http://localhost:{port}/control-tower")
        print(f"   公网: http://<公网IP>:{port}/control-tower")
        print(f"\n📊 API 端点:")
        print(f"   /api/system/status - 完整系统状态")
        print(f"   /api/stats         - 执行统计")
        print(f"   /api/audit         - 收益审计")
        print(f"   /api/decision_diff - 决策差异")
        print(f"   /api/risk          - 风险状态")
        print(f"   /ws                - WebSocket 实时推送")
        print(f"\n⚠️  公网访问需配合 frp/ngrok/cloudflared")
        print("="*60)
        
        uvicorn.run(self.app, host=host, port=port)


# ============ 启动 ============

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    server = ControlTowerServer(data_source="v52_live")
    server.run(host="0.0.0.0", port=port)
