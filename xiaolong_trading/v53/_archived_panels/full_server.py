"""
小龙交易系统 V5.3 - 完整统一监控面板
整合原 V5.3 功能 + Control Tower V2 功能

端口: 8765
"""

import json
from datetime import datetime
from typing import Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 导入组件
try:
    from state_store import get_state_store
    from control_flags import get_control_flags
    ALL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ 导入失败: {e}")
    ALL_AVAILABLE = False

# 全局状态
state_store = None
control_flags = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global state_store, control_flags
    if ALL_AVAILABLE:
        state_store = get_state_store()
        control_flags = get_control_flags()
        print("✅ 所有组件初始化完成")
    yield

app = FastAPI(title="小龙交易系统 V5.3 - 完整监控面板", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============ 完整 HTML ============
HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🐉 小龙交易系统 V5.3 - 完整监控面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#eee;min-height:100vh}
.header{background:rgba(0,0,0,0.3);padding:15px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1)}
.header h1{font-size:1.5rem}
.nav a{color:#4fc3f7;text-decoration:none;margin-left:20px;padding:8px 16px;border-radius:4px;transition:background .3s}
.nav a:hover,.nav a.active{background:rgba(79,195,247,0.2)}
.container{padding:20px;max-width:1400px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.card{background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.1)}
.card h2{font-size:1rem;color:#888;margin-bottom:15px}
.card .value{font-size:2rem;font-weight:bold}
.card .unit{font-size:0.9rem;color:#666;margin-left:5px}
.positive{color:#4caf50}.negative{color:#f44336}.neutral{color:#ff9800}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)}
.row:last-child{border:none}
.label{color:#888}
.funnel{margin-top:20px}
.funnel-step{display:flex;align-items:center;margin:10px 0}
.funnel-bar{height:30px;background:linear-gradient(90deg,#4fc3f7,#29b6f6);border-radius:4px;display:flex;align-items:center;padding:0 10px;color:#000;font-weight:bold;min-width:60px}
.funnel-label{width:120px;font-size:0.9rem}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.status-item{text-align:center;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px}
.btn{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin:5px}
.btn-h{background:#38bdf8}.btn-w{background:#a855f7;color:#fff}.btn-f{background:#22c55e}.btn-r{background:#ef4444;color:#fff}
.phase-box{padding:20px;text-align:center;border-radius:12px;margin:20px 0}
.phase-0{background:rgba(234,179,8,0.1);border:2px solid #eab308}
.phase-1{background:rgba(56,189,248,0.1);border:2px solid #38bdf8}
.phase-2{background:rgba(168,85,247,0.1);border:2px solid #a855f7}
.phase-3{background:rgba(34,197,94,0.1);border:2px solid #22c55e}
.status-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);padding:10px 30px;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.1)}
</style>
</head>
<body>
<div class="header">
<h1>🐉 小龙交易系统 V5.3</h1>
<nav class="nav">
<a href="#" class="active">监控面板</a>
<a href="#control">控制中心</a>
<a href="#status">系统状态</a>
</nav>
</div>

<div class="container">
<!-- 核心指标 -->
<div class="grid">
<div class="card">
<h2>📊 总交易次数</h2>
<div class="value" id="total">--</div>
</div>
<div class="card">
<h2>💰 累计盈亏</h2>
<div class="value" id="pnl">--</div>
</div>
<div class="card">
<h2>🎯 胜率</h2>
<div class="value" id="winrate">--</div>
</div>
<div class="card">
<h2>⭐ 平均评分</h2>
<div class="value" id="score">--</div>
</div>
</div>

<!-- 信号漏斗 -->
<div class="card" style="margin-top:20px">
<h2>🔄 信号漏斗</h2>
<div class="funnel">
<div class="funnel-step"><span class="funnel-label">信号生成</span><div class="funnel-bar" style="width:100%" id="f1">--</div></div>
<div class="funnel-step"><span class="funnel-label">通过过滤</span><div class="funnel-bar" style="width:75%" id="f2">--</div></div>
<div class="funnel-step"><span class="funnel-label">执行交易</span><div class="funnel-bar" style="width:50%" id="f3">--</div></div>
<div class="funnel-step"><span class="funnel-label">盈利交易</span><div class="funnel-bar" style="width:25%" id="f4">--</div></div>
</div>
</div>

<!-- GO/NO-GO 与控制 -->
<div class="grid" style="margin-top:20px">
<div id="gonogo" class="phase-box phase-0">
<h2 id="go-title">⏳ 初始化中</h2>
<p id="go-reason">--</p>
<p style="margin-top:10px;color:#888" id="go-stab">Stability: --/10</p>
<p style="margin-top:5px;color:#666;font-size:0.9rem" id="go-rec">--</p>
</div>

<div class="card">
<h2>🎮 控制中心</h2>
<div style="margin-top:15px">
<div style="margin-bottom:15px">
<span style="color:#888;font-size:0.9rem">模式切换</span><br>
<button class="btn btn-h" onclick="setMode('hybrid')">HYBRID</button>
<button class="btn btn-w" onclick="setMode('weighted')">WEIGHTED</button>
<button class="btn btn-f" onclick="setMode('full')">FULL</button>
<button class="btn btn-r" onclick="fallback()">🚨 回退</button>
</div>
<div>
<span style="color:#888;font-size:0.9rem">权重推进</span><br>
<button class="btn btn-w" onclick="setWeight(0.2)">0.2</button>
<button class="btn btn-w" onclick="setWeight(0.5)">0.5</button>
<button class="btn btn-w" onclick="setWeight(0.8)">0.8</button>
<button class="btn btn-f" onclick="setWeight(1.0)">1.0</button>
</div>
</div>
</div>
</div>

<!-- 详细信息 -->
<div class="grid" style="margin-top:20px">
<div class="card">
<h2>📊 Shadow 指标</h2>
<div id="shadow">
<div class="row"><span class="label">样本数</span><span>--</span></div>
<div class="row"><span class="label">激进决策</span><span>--</span></div>
<div class="row"><span class="label">保守决策</span><span>--</span></div>
<div class="row"><span class="label">差异率</span><span>--</span></div>
</div>
</div>

<div id="status" class="card">
<h2>⚙️ 系统状态</h2>
<div class="status-grid">
<div class="status-item"><div style="font-size:1.5rem" id="s1">--</div><div style="font-size:0.8rem;color:#888">API</div></div>
<div class="status-item"><div style="font-size:1.5rem" id="s2">--</div><div style="font-size:0.8rem;color:#888">执行</div></div>
<div class="status-item"><div style="font-size:1.5rem" id="s3">--</div><div style="font-size:0.8rem;color:#888">风控</div></div>
<div class="status-item"><div style="font-size:1.5rem" id="s4">--</div><div style="font-size:0.8rem;color:#888">模式</div></div>
<div class="status-item"><div style="font-size:1.5rem" id="s5">--</div><div style="font-size:0.8rem;color:#888">权重</div></div>
<div class="status-item"><div style="font-size:1.5rem" id="s6">--</div><div style="font-size:0.8rem;color:#888">错误</div></div>
</div>
</div>
</div>
</div>

<div class="status-bar">
<span id="st">● 加载中...</span>
<span id="up">更新: --:--:--</span>
</div>

<script>
async function load(){try{const r=await fetch('/api/all'),d=await r.json();render(d)}catch(e){}}
function render(d){
const s=d.state,c=d.control,g=d.go_no_go;
// 核心指标
document.getElementById('total').textContent=s.shadow.total||0;
document.getElementById('pnl').textContent=(s.audit?.total_pnl||0).toFixed(2)+' USDT';
document.getElementById('winrate').textContent=((s.audit?.win_rate||0)*100).toFixed(1)+'%';
document.getElementById('score').textContent=(s.audit?.avg_score||0).toFixed(1)+'/5';

// 漏斗
const t=s.shadow.total||0;
const pass=Math.floor(t*0.75),exec=Math.floor(t*0.5),profit=Math.floor(t*0.25);
document.getElementById('f1').textContent=t;
document.getElementById('f2').textContent=pass;
document.getElementById('f3').textContent=exec;
document.getElementById('f4').textContent=profit;

// GO/NO-GO
const p={'STEP_0_HYBRID':['phase-0','⏳ HYBRID'],'STEP_1_WEIGHTED_0.2':['phase-1','🔵 0.2'],'STEP_2_WEIGHTED_0.5':['phase-2','🟣 0.5'],'STEP_3_WEIGHTED_0.8':['phase-3','🟢 0.8'],'STEP_4_FULL_READY':['phase-3','✅ READY']};
const[cls,title]=p[c.phase]||['phase-0','?'];
document.getElementById('gonogo').className='phase-box '+cls;
document.getElementById('go-title').textContent=title;
document.getElementById('go-reason').textContent=g.reason||'--';
document.getElementById('go-stab').textContent='Stability: '+(g.stability?.streak||0)+'/'+(g.stability?.required||10);
document.getElementById('go-rec').textContent=d.phase.recommendation||'--';

// Shadow
document.getElementById('shadow').innerHTML='<div class="row"><span class="label">样本数</span><span>'+s.shadow.total+'</span></div><div class="row"><span class="label">激进决策</span><span class="'+(s.shadow.aggressive>0?'negative':'positive')+'">'+s.shadow.aggressive+'</span></div><div class="row"><span class="label">保守决策</span><span>'+s.shadow.conservative+'</span></div><div class="row"><span class="label">差异率</span><span>'+s.shadow.diff_rate_pct+'</span></div>';

// 系统状态
document.getElementById('s1').textContent='✅';document.getElementById('s2').textContent='✅';
document.getElementById('s3').textContent=g.status==='go'?'✅':g.status==='no_go'?'⛔':'⏳';
document.getElementById('s4').textContent=c.mode.toUpperCase().substring(0,4);
document.getElementById('s5').textContent=c.v3_weight.toFixed(1);
document.getElementById('s6').textContent=s.execution?.errors||0;

// 状态栏
document.getElementById('st').textContent=g.status==='go'?'● 正常':g.status==='no_go'?'● 阻断':'● 等待';
document.getElementById('up').textContent='更新: '+new Date().toLocaleTimeString('zh-CN');
}
async function setMode(m){await fetch('/api/control/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m})});load()}
async function setWeight(w){await fetch('/api/control/weight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weight:w})});load()}
async function fallback(){await fetch('/api/control/fallback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'手动'})});load()}
load();setInterval(load,2000);
</script>
</body>
</html>'''

# ============ API 路由 ============

@app.get("/", response_class=HTMLResponse)
async def root(): return HTML

@app.get("/dashboard/", response_class=HTMLResponse)
async def dashboard(): return HTML

@app.get("/api/all")
async def get_all():
    s = state_store.to_dict() if state_store else {"shadow":{"total":0,"aggressive":0,"conservative":0,"diff_rate_pct":"0%"},"audit":{},"execution":{}}
    c = control_flags.to_dict() if control_flags else {"mode":"hybrid","v3_weight":0.0,"phase":"STEP_0_HYBRID"}
    g = s.get("go_no_go", {"status":"pending","reason":"--","stability":{"streak":0,"required":10}})
    rec = control_flags.get_recommendation({"go_stability": g.get("stability", {}).get("streak", 0)}) if control_flags else ""
    return {"state": s, "control": c, "go_no_go": g, "phase": {"phase": c.get("phase", ""), "recommendation": rec}}

@app.post("/api/control/mode")
async def set_mode(data: Dict[str, str]):
    if control_flags: return {"success": control_flags.set_mode(data.get("mode", "hybrid")), **control_flags.to_dict()}
    return {"success": False}

@app.post("/api/control/weight")
async def set_weight(data: Dict[str, float]):
    if control_flags:
        success = control_flags.set_weight(data.get("weight", 0.0))
        if success: control_flags.set_mode("weighted")
        return {"success": success, **control_flags.to_dict()}
    return {"success": False}

@app.post("/api/control/fallback")
async def trigger_fallback(data: Dict[str, str]):
    if control_flags:
        control_flags.fallback(data.get("reason", "手动"))
        return {"success": True, **control_flags.to_dict()}
    return {"success": False}

@app.post("/debug/simulate-trade")
async def simulate_trade():
    import random
    decision = {"timestamp": datetime.utcnow().isoformat(), "signal_id": f"SIG_{random.randint(1000,9999)}", "old_action": random.choice(["HOLD","BUY","SELL"]), "new_action": random.choice(["HOLD","BUY","SELL"]), "diff_type": random.choice(["SAME","SAME","CONSERVATIVE"]), "risk_level": "LOW"}
    if state_store:
        state_store.on_shadow_trade(decision)
        return {"success": True, "decision": decision}
    return {"success": False}

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print("="*60)
    print("🐉 小龙交易系统 V5.3 - 完整监控面板")
    print("="*60)
    print(f"\n本地: http://localhost:{port}")
    print(f"公网: https://unpersonal-currently-amberly.ngrok-free.dev")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=port)