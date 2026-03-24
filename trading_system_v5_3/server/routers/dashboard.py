"""
主面板路由
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from server.utils import read_last_state, calculate_stats, calculate_funnel

# 🔥 导入唯一真相源
from core.state_store import state_store

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ============================================================
# API 端点
# ============================================================

@router.get("/api/stats")
async def get_stats():
    """
    获取统计信息 - 从唯一真相源读取
    """
    # 🔥 优先从 StateStore 读取（唯一真相源）
    store_stats = state_store.to_dict()
    
    # 如果 StateStore 有数据，直接返回
    if store_stats.get("total_trades", 0) > 0:
        # 合并实时市场数据
        try:
            from server.utils.state_reader import read_live_state
            live = read_live_state()
            if live:
                store_stats["price"] = live.get("price", 0)
                store_stats["position"] = live.get("position")
                store_stats["balance"] = live.get("balance")
                store_stats["network"] = live.get("network", "MAINNET")
        except:
            pass
        
        store_stats["timestamp"] = datetime.now().isoformat()
        return JSONResponse(content=store_stats)
    
    # 回退到历史数据
    stats = calculate_stats()
    return JSONResponse(content=stats)


@router.get("/api/store")
async def get_store():
    """
    直接读取 StateStore（调试用）
    """
    return JSONResponse(content=state_store.to_dict())


@router.get("/api/state")
async def get_state():
    """获取当前状态"""
    state = read_last_state()
    return JSONResponse(content=state or {"status": "no_data"})


@router.get("/api/funnel")
async def get_funnel():
    """获取信号漏斗"""
    funnel = calculate_funnel()
    return JSONResponse(content=funnel)


@router.get("/api/health")
async def health_check():
    """
    系统存活检测
    
    前端应该：
    - 超过 5 秒没更新 → 显示 🔴 SYSTEM DEAD
    """
    import time
    return JSONResponse(content={
        "alive": True,
        "timestamp": time.time(),
        "datetime": datetime.now().isoformat(),
        "version": "5.4.0",
        "state_store_trades": state_store.total_trades,
    })


# ============================================================
# HTML 面板
# ============================================================
@router.get("/", response_class=HTMLResponse)
async def dashboard():
    """主监控面板"""
    return generate_dashboard_html()


def generate_dashboard_html() -> str:
    """生成主面板 HTML"""
    return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小龙交易系统 V5.3 - 监控面板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #eee;
            min-height: 100vh;
        }
        .header {
            background: rgba(0,0,0,0.3);
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .header h1 { font-size: 1.5rem; }
        .nav a {
            color: #4fc3f7;
            text-decoration: none;
            margin-left: 20px;
            padding: 8px 16px;
            border-radius: 4px;
            transition: background 0.3s;
        }
        .nav a:hover { background: rgba(79, 195, 247, 0.2); }
        .container { padding: 20px; max-width: 1400px; margin: 0 auto; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2 { font-size: 1rem; color: #888; margin-bottom: 15px; }
        .card .value { font-size: 2rem; font-weight: bold; }
        .card .unit { font-size: 0.9rem; color: #666; margin-left: 5px; }
        
        .positive { color: #4caf50; }
        .negative { color: #f44336; }
        .neutral { color: #ff9800; }
        
        .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .status-item { text-align: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        
        .funnel { margin-top: 20px; }
        .funnel-step {
            display: flex;
            align-items: center;
            margin: 10px 0;
        }
        .funnel-bar {
            height: 30px;
            background: linear-gradient(90deg, #4fc3f7, #29b6f6);
            border-radius: 4px;
            display: flex;
            align-items: center;
            padding: 0 10px;
            color: #000;
            font-weight: bold;
        }
        .funnel-label { width: 120px; font-size: 0.9rem; }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐉 小龙交易系统 V5.3</h1>
        <nav class="nav">
            <a href="/dashboard/">监控面板</a>
            <a href="/evolution/dashboard">演化引擎</a>
            <a href="/structure/dashboard">市场结构</a>
            <a href="/decision/trace">决策追踪</a>
        </nav>
    </div>
    
    <div class="container">
        <div class="grid">
            <div class="card">
                <h2>📊 总交易次数</h2>
                <div class="value" id="total-trades">--</div>
            </div>
            <div class="card">
                <h2>💰 累计盈亏</h2>
                <div class="value" id="total-pnl">--</div>
            </div>
            <div class="card">
                <h2>🎯 胜率</h2>
                <div class="value" id="win-rate">--</div>
            </div>
            <div class="card">
                <h2>⭐ 平均评分</h2>
                <div class="value" id="avg-score">--</div>
            </div>
        </div>
        
        <div class="grid" style="margin-top: 20px;">
            <div class="card">
                <h2>🔄 信号漏斗</h2>
                <div class="funnel" id="funnel">
                    <div class="funnel-step">
                        <div class="funnel-label">总信号</div>
                        <div class="funnel-bar" style="width: 100%;" id="funnel-total">--</div>
                    </div>
                    <div class="funnel-step">
                        <div class="funnel-label">评分通过</div>
                        <div class="funnel-bar" style="width: 70%;" id="funnel-score">--</div>
                    </div>
                    <div class="funnel-step">
                        <div class="funnel-label">成交量通过</div>
                        <div class="funnel-bar" style="width: 50%;" id="funnel-volume">--</div>
                    </div>
                    <div class="funnel-step">
                        <div class="funnel-label">最终执行</div>
                        <div class="funnel-bar" style="width: 30%;" id="funnel-exec">--</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>⚙️ 系统状态</h2>
                <div class="status-grid" id="system-status">
                    <div class="status-item">
                        <div>状态</div>
                        <div id="sys-mode">--</div>
                    </div>
                    <div class="status-item">
                        <div>模式</div>
                        <div id="sys-state">--</div>
                    </div>
                    <div class="status-item">
                        <div>更新时间</div>
                        <div id="sys-time">--</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <footer>
        小龙交易系统 V5.3 | 统一监控面板 | 更新时间: <span id="update-time">--</span>
    </footer>
    
    <script>
        async function fetchData() {
            try {
                const [statsRes, funnelRes, stateRes] = await Promise.all([
                    fetch('/dashboard/api/stats'),
                    fetch('/dashboard/api/funnel'),
                    fetch('/dashboard/api/state')
                ]);
                
                const stats = await statsRes.json();
                const funnel = await funnelRes.json();
                const state = await stateRes.json();
                
                // 更新统计
                document.getElementById('total-trades').textContent = stats.total_trades || 0;
                const pnlEl = document.getElementById('total-pnl');
                pnlEl.textContent = (stats.total_pnl || 0).toFixed(2) + ' USDT';
                pnlEl.className = 'value ' + (stats.total_pnl >= 0 ? 'positive' : 'negative');
                document.getElementById('win-rate').textContent = (stats.win_rate || 0) + '%';
                document.getElementById('avg-score').textContent = stats.avg_score || '--';
                
                // 更新漏斗
                document.getElementById('funnel-total').textContent = funnel.total_signals || 0;
                document.getElementById('funnel-score').textContent = funnel.score_pass || 0;
                document.getElementById('funnel-volume').textContent = funnel.volume_pass || 0;
                document.getElementById('funnel-exec').textContent = funnel.both_pass || 0;
                
                // 更新时间
                document.getElementById('update-time').textContent = new Date().toLocaleTimeString();
                
            } catch (e) {
                console.error('数据获取失败:', e);
            }
        }
        
        fetchData();
        setInterval(fetchData, 5000);
    </script>
</body>
</html>
"""