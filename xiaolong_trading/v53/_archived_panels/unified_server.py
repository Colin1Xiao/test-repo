"""
小龙交易系统 V5.3 - 统一监控面板
整合 Control Tower V2 功能

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

app = FastAPI(title="小龙交易系统 V5.3", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# HTML 模板
HTML = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>🐉 小龙交易系统 V5.3</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#eee}
.header{background:rgba(0,0,0,0.3);padding:15px 30px;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1)}
.nav a{color:#4fc3f7;text-decoration:none;margin-left:20px}
.container{padding:20px;max-width:1400px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.card{background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.1)}
.card h2{font-size:1rem;color:#888;margin-bottom:15px}
.value{font-size:2rem;font-weight:bold}
.positive{color:#4caf50}.negative{color:#f44336}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)}
.btn{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin:5px}
.btn-h{background:#38bdf8}.btn-w{background:#a855f7;color:#fff}.btn-f{background:#22c55e}.btn-r{background:#ef4444;color:#fff}
.phase-box{padding:20px;text-align:center;border-radius:12px;margin:20px 0}
.phase-0{background:rgba(234,179,8,0.1);border:2px solid #eab308}
.phase-1{background:rgba(56,189,248,0.1);border:2px solid #38bdf8}
.phase-2{background:rgba(168,85,247,0.1);border:2px solid #a855f7}
.phase-3{background:rgba(34,197,94,0.1);border:2px solid #22c55e}
.status-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);padding:10px 30px;display:flex;justify-content:space-between}</style></head>
<body>
<div class="header"><h1>🐉 小龙交易系统 V5.3</h1>
<nav><a href="#">监控面板</a><a href="#control">控制中心</a></nav></div>
<div class="container">
<div class="grid">
<div class="card"><h2>📊 总交易</h2><div class="value" id="total">--</div></div>
<div class="card"><h2>💰 盈亏比</h2><div class="value" id="pnl">--</div></div>
<div class="card"><h2>🎯 Stability</h2><div class="value" id="stab">--</div></div>
<div class="card"><h2>🔀 模式</h2><div class="value" id="mode">--</div></div>
</div>
<div id="control" class="card"><h2>🎮 控制中心</h2>
<div style="margin-top:15px">
<button class="btn btn-h" onclick="setMode('hybrid')">HYBRID</button>
<button class="btn btn-w" onclick="setMode('weighted')">WEIGHTED</button>
<button class="btn btn-f" onclick="setMode('full')">FULL</button>
<button class="btn btn-r" onclick="fallback()">🚨 回退</button>
<span style="margin-left:20px">
<button class="btn btn-w" onclick="setWeight(0.2)">0.2</button>
<button class="btn btn-w" onclick="setWeight(0.5)">0.5</button>
<button class="btn btn-w" onclick="setWeight(0.8)">0.8</button>
<button class="btn btn-f" onclick="setWeight(1.0)">1.0</button>
</span></div></div>
<div id="gonogo" class="phase-box phase-0"><h2 id="gt">⏳ 初始化</h2><p id="gr">--</p><p style="margin-top:10px;color:#888" id="rec">--</p></div>
<div class="grid">
<div class="card"><h2>📊 Shadow</h2><div id="sh"><div class="row"><span>样本</span><span>--</span></div><div class="row"><span>激进</span><span>--</span></div><div class="row"><span>差异率</span><span>--</span></div></div></div>
<div class="card"><h2>🔒 安全</h2><div id="sf"><div class="row"><span>Fallback</span><span>--</span></div><div class="row"><span>错误</span><span>--</span></div></div></div>
</div></div>
<div class="status-bar"><span id="st">● 加载中</span><span id="up">更新: --:--:--</span></div>
<script>
async function load(){try{const r=await fetch('/api/all'),d=await r.json();render(d)}catch(e){}}
function render(d){const s=d.state,c=d.control,g=d.go_no_go;
document.getElementById('total').textContent=s.shadow.total;
document.getElementById('pnl').textContent=(s.audit?.profit_factor||0).toFixed(2);
document.getElementById('stab').textContent=g.stability.streak+'/'+g.stability.required;
document.getElementById('mode').textContent=c.mode.toUpperCase();
const p={'STEP_0_HYBRID':['phase-0','⏳ HYBRID'],'STEP_1_WEIGHTED_0.2':['phase-1','🔵 0.2'],'STEP_2_WEIGHTED_0.5':['phase-2','🟣 0.5'],'STEP_3_WEIGHTED_0.8':['phase-3','🟢 0.8'],'STEP_4_FULL_READY':['phase-3','✅ READY']};
const[cls,t]=p[c.phase]||['phase-0','?'];
document.getElementById('gonogo').className='phase-box '+cls;
document.getElementById('gt').textContent=t;
document.getElementById('gr').textContent=g.reason;
document.getElementById('rec').textContent=d.phase.recommendation;
document.getElementById('sh').innerHTML='<div class="row"><span>样本</span><span>'+s.shadow.total+'</span></div><div class="row"><span>激进</span><span class="'+(s.shadow.aggressive>0?'negative':'positive')+'">'+s.shadow.aggressive+'</span></div><div class="row"><span>差异率</span><span>'+s.shadow.diff_rate_pct+'</span></div>';
document.getElementById('sf').innerHTML='<div class="row"><span>Fallback</span><span class="'+(c.force_fallback?'negative':'positive')+'">'+(c.force_fallback?'激活':'正常')+'</span></div><div class="row"><span>错误</span><span>'+(s.execution?.errors||0)+'</span></div>';
document.getElementById('st').textContent=g.status==='go'?'● 正常':g.status==='no_go'?'● 阻断':'● 等待';
document.getElementById('up').textContent='更新: '+new Date().toLocaleTimeString('zh-CN');
}
async function setMode(m){await fetch('/api/control/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m})});load()}
async function setWeight(w){await fetch('/api/control/weight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weight:w})});load()}
async function fallback(){await fetch('/api/control/fallback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'手动'})});load()}
load();setInterval(load,2000);
</script></body></html>'''

@app.get("/", response_class=HTMLResponse)
async def root(): return HTML

@app.get("/api/all")
async def get_all():
    s = state_store.to_dict() if state_store else {}
    c = control_flags.to_dict() if control_flags else {}
    g = s.get("go_no_go", {})
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
    print(f"🐉 小龙交易系统 V5.3 - 本地: http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)