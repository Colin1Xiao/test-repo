"""
演化引擎路由
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

router = APIRouter(prefix="/evolution", tags=["Evolution Engine"])

# 数据文件路径
EVOLUTION_LOG = Path(__file__).parent.parent.parent / "logs" / "evolution_logs.jsonl"


def read_evolution_data():
    """读取演化数据"""
    try:
        if not EVOLUTION_LOG.exists():
            return None
        with open(EVOLUTION_LOG, "r") as f:
            lines = f.readlines()
            if not lines:
                return None
            return [json.loads(line) for line in lines]
    except Exception:
        return None


@router.get("/api/status")
async def get_evolution_status():
    """获取演化引擎状态"""
    data = read_evolution_data()
    
    if not data:
        return JSONResponse(content={
            "generation": 0,
            "best_fitness": 0.0,
            "population_size": 10,
            "status": "idle",
            "message": "暂无演化数据"
        })
    
    # 计算统计
    generations = set(d.get("generation", 1) for d in data)
    latest = data[-1] if data else {}
    
    return JSONResponse(content={
        "generation": max(generations) if generations else 1,
        "best_fitness": latest.get("performance", {}).get("score", 0),
        "population_size": len(data),
        "status": latest.get("decision", "idle"),
        "latest_params": latest.get("new_params", {}),
        "performance": latest.get("performance", {}),
        "total_mutations": len([d for d in data if d.get("action") == "mutation"])
    })


@router.get("/api/history")
async def get_evolution_history(limit: int = 20):
    """获取演化历史"""
    data = read_evolution_data()
    
    if not data:
        return JSONResponse(content={"count": 0, "history": []})
    
    return JSONResponse(content={
        "count": len(data[-limit:]),
        "history": data[-limit:]
    })


@router.get("/dashboard", response_class=HTMLResponse)
async def evolution_dashboard():
    """演化引擎面板"""
    return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>演化引擎 - 小龙交易系统 V5.3</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        .header { margin-bottom: 20px; }
        .header a { color: #4fc3f7; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; }
        .card h3 { color: #888; font-size: 0.9rem; margin-bottom: 10px; }
        .card .value { font-size: 1.5rem; font-weight: bold; }
        .params { margin-top: 20px; }
        .param-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧬 演化引擎</h1>
        <p><a href="/dashboard/">← 返回主面板</a></p>
    </div>
    
    <div class="grid">
        <div class="card">
            <h3>当前代数</h3>
            <div class="value" id="generation">--</div>
        </div>
        <div class="card">
            <h3>最佳适应度</h3>
            <div class="value" id="fitness">--</div>
        </div>
        <div class="card">
            <h3>变异次数</h3>
            <div class="value" id="mutations">--</div>
        </div>
        <div class="card">
            <h3>状态</h3>
            <div class="value" id="status">--</div>
        </div>
    </div>
    
    <div class="card params">
        <h3>最新参数</h3>
        <div id="params">加载中...</div>
    </div>
    
    <script>
        async function loadData() {
            const res = await fetch('/evolution/api/status');
            const data = await res.json();
            
            document.getElementById('generation').textContent = data.generation || 0;
            document.getElementById('fitness').textContent = (data.best_fitness || 0).toFixed(3);
            document.getElementById('mutations').textContent = data.total_mutations || 0;
            document.getElementById('status').textContent = data.status || 'idle';
            
            if (data.latest_params) {
                const paramsHtml = Object.entries(data.latest_params)
                    .map(([k, v]) => `<div class="param-item"><span>${k}</span><span>${typeof v === 'number' ? v.toFixed(4) : v}</span></div>`)
                    .join('');
                document.getElementById('params').innerHTML = paramsHtml || '<p>暂无参数</p>';
            }
        }
        
        loadData();
        setInterval(loadData, 10000);
    </script>
</body>
</html>
"""