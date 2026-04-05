"""
市场结构路由
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime
import json
from pathlib import Path

router = APIRouter(prefix="/structure", tags=["Market Structure"])

# 数据文件路径
SYSTEM_STATE_FILE = Path(__file__).parent.parent.parent / "logs" / "system_state.jsonl"


def read_latest_state():
    """读取最新状态"""
    try:
        if not SYSTEM_STATE_FILE.exists():
            return None
        with open(SYSTEM_STATE_FILE, "r") as f:
            lines = f.readlines()
            if not lines:
                return None
            return json.loads(lines[-1])
    except Exception:
        return None


@router.get("/api/status")
async def get_structure_status():
    """获取市场结构状态"""
    state = read_latest_state()
    
    if not state:
        return JSONResponse(content={
            "trend": "unknown",
            "volatility": "unknown",
            "structure": "loading",
            "signals": [],
            "score": 0,
            "volume_ratio": 0
        })
    
    # 从实际状态提取数据
    regime = state.get("regime", "range")
    score = state.get("score", 0)
    volume_ratio = state.get("volume_ratio", 0)
    
    # 趋势映射
    trend_map = {
        "range": "sideways",
        "trend": "trending",
        "breakout": "breakout"
    }
    
    # 波动性映射（基于成交量）
    if volume_ratio > 1.5:
        volatility = "high"
    elif volume_ratio > 0.5:
        volatility = "medium"
    else:
        volatility = "low"
    
    return JSONResponse(content={
        "trend": trend_map.get(regime, "neutral"),
        "volatility": volatility,
        "structure": regime,
        "signals": [],
        "score": score,
        "volume_ratio": round(volume_ratio, 2),
        "timestamp": state.get("timestamp", "")
    })


@router.get("/dashboard", response_class=HTMLResponse)
async def structure_dashboard():
    """市场结构面板"""
    return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>市场结构 - 小龙交易系统 V5.3</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        .card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 20px; margin: 10px 0; }
        h1 { margin-bottom: 20px; }
        a { color: #4fc3f7; }
        .value { font-size: 1.5rem; font-weight: bold; color: #4fc3f7; }
    </style>
</head>
<body>
    <h1>📊 市场结构</h1>
    <div class="card">
        <p><a href="/dashboard/">← 返回主面板</a></p>
    </div>
    <div class="card">
        <h3>当前状态</h3>
        <p>趋势: <span id="trend" class="value">-</span></p>
        <p>波动性: <span id="volatility" class="value">-</span></p>
        <p>结构: <span id="structure" class="value">-</span></p>
        <p>评分: <span id="score" class="value">-</span></p>
        <p>成交量比: <span id="volume" class="value">-</span></p>
    </div>
    <script>
        fetch('/structure/api/status').then(r => r.json()).then(d => {
            document.getElementById('trend').textContent = d.trend;
            document.getElementById('volatility').textContent = d.volatility;
            document.getElementById('structure').textContent = d.structure;
            document.getElementById('score').textContent = d.score;
            document.getElementById('volume').textContent = d.volume_ratio + 'x';
        });
        setInterval(() => {
            fetch('/structure/api/status').then(r => r.json()).then(d => {
                document.getElementById('trend').textContent = d.trend;
                document.getElementById('volatility').textContent = d.volatility;
                document.getElementById('structure').textContent = d.structure;
                document.getElementById('score').textContent = d.score;
                document.getElementById('volume').textContent = d.volume_ratio + 'x';
            });
        }, 10000);
    </script>
</body>
</html>
"""