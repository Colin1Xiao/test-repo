"""
Control Tower Server V2 - 事件驱动 + Hybrid 控制
"""

import json
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 导入
try:
    from state_store import get_state_store
    from hybrid_controller import get_hybrid_controller
    from control_flags import get_control_flags
    ALL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ 导入失败: {e}")
    ALL_AVAILABLE = False

# 全局状态
state_store = None
hybrid_controller = None
control_flags = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global state_store, hybrid_controller, control_flags
    if ALL_AVAILABLE:
        state_store = get_state_store()
        hybrid_controller = get_hybrid_controller()
        control_flags = get_control_flags()
        print("✅ 所有组件初始化完成")
    yield

app = FastAPI(title="小龙 Control Tower V2", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
ws_clients = []

# ============ HTML ============
HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>🐉 小龙 Control Tower V2</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#e2e8f0}
.header{background:linear-gradient(135deg,#1e293b,#0f172a);padding:20px;border-bottom:1px solid #334155}
.header h1{color:#38bdf8}
.header .sub{color:#94a3b8;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;padding:20px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.card h3{color:#94a3b8;font-size:14px;margin-bottom:15px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155}
.row:last-child{border:none}
.label{color:#64748b}
.value{font-weight:600}
.good{color:#22c55e}.warn{color:#eab308}.bad{color:#ef4444}
.phase-box{padding:20px;text-align:center;border-radius:12px;margin:20px}
.phase-0{background:rgba(234,179,8,0.1);border:2px solid #eab308}
.phase-1{background:rgba(56,189,248,0.1);border:2px solid #38bdf8}
.phase-2{background:rgba(168,85,247,0.1);border:2px solid #a855f7}
.phase-3{background:rgba(34,197,94,0.1);border:2px solid #22c55e}
.phase-ready{background:rgba(34,197,94,0.2);border:3px solid #22c55e}
.btn{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin:5px}
.btn-h{background:#38bdf8;color:black}
.btn-w{background:#a855f7;color:white}
.btn-f{background:#22c55e;color:black}
.btn-r{background:#ef4444;color:white}
.btn:disabled{opacity:0.5;cursor:not-allowed}
.status-bar{position:fixed;bottom:0;left:0;right:0;background:#1e293b;padding:10px 20px;border-top:1px solid #334155;display:flex;justify-content:space-between}
</style>
</head>
<body>
<div class="header"><h1>🐉 小龙 Control Tower V2</h1><div class="sub">事件驱动 + Hybrid 控制 + 权重推进</div></div>
<div id="phase" class="phase-box phase-0"><h2>⏳ STEP 0: HYBRID</h2><p>等待进入 WEIGHTED 阶段</p></div>
<div class="grid">
<div class="card"><h3>📊 系统状态</h3><div id="sys"><span class="label">加载中...</span></div></div>
<div class="card"><h3>🔀 Hybrid 控制</h3><div id="hyb"><span class="label">加载中...</span></div></div>
<div class="card"><h3>📈 GO Stability</h3><div id="go"><span class="label">加载中...</span></div></div>
<div class="card"><h3>🎯 阶段推进</h3><div id="adv"><span class="label">加载中...</span></div></div>
</div>
<div class="grid"><div class="card" style="grid-column:1/-1">
<h3>🎮 手动控制</h3>
<button class="btn btn-h" onclick="setMode('hybrid')">HYBRID</button>
<button class="btn btn-w" onclick="setMode('weighted')">WEIGHTED</button>
<button class="btn btn-f" onclick="setMode('full')">FULL</button>
<button class="btn btn-r" onclick="fallback()">🚨 紧急回退</button>
<span style="margin-left:20px">权重:</span>
<button class="btn btn-w" onclick="setWeight(0.2)">0.2</button>
<button class="btn btn-w" onclick="setWeight(0.5)">0.5</button>
<button class="btn btn-w" onclick="setWeight(0.8)">0.8</button>
<button class="btn btn-f" onclick="setWeight(1.0)">1.0</button>
</div></div>
<div class="status-bar"><span id="ws">● 离线</span><span id="upd">更新: --:--:--</span></div>
<script>
async function load(){try{const r=await fetch('/api/all');const d=await r.json();render(d)}catch(e){}}
function render(d){
const c=d.control,p=d.phase;s=d.state,g=d.go_no_go;
const phases={'STEP_0_HYBRID':['phase-0','⏳ STEP 0: HYBRID','等待进入 WEIGHTED'],
'STEP_1_WEIGHTED_0.2':['phase-1','🔵 STEP 1: WEIGHTED 0.2','V3 开始参与'],
'STEP_2_WEIGHTED_0.5':['phase-2','🟣 STEP 2: WEIGHTED 0.5','V3 权重提升'],
'STEP_3_WEIGHTED_0.8':['phase-3','🟢 STEP 3: WEIGHTED 0.8','接近 FULL'],
'STEP_4_FULL_READY':['phase-ready','✅ STEP 4: FULL READY','可切换 FULL']};
const [cls,title,desc]=phases[p.phase]||['phase-0','未知',''];
document.getElementById('phase').className='phase-box '+cls;
document.getElementById('phase').innerHTML='<h2>'+title+'</h2><p>'+desc+'</p><p style="margin-top:10px;font-size:14px">推荐: '+p.recommendation+'</p>';
document.getElementById('sys').innerHTML='<div class="row"><span class="label">模式</span><span class="value">'+c.mode+'</span></div><div class="row"><span class="label">V3 权重</span><span class="value">'+c.v3_weight.toFixed(1)+'</span></div><div class="row"><span class="label">启用</span><span class="value '+(c.enabled?'good':'bad')+'">'+(c.enabled?'是':'否')+'</span></div>';
document.getElementById('hyb').innerHTML='<div class="row"><span class="label">样本</span><span class="value">'+s.shadow.total+'</span></div><div class="row"><span class="label">激进</span><span class="value '+(s.shadow.aggressive>0?'bad':'good')+'">'+s.shadow.aggressive+'</span></div><div class="row"><span class="label">差异率</span><span class="value">'+s.shadow.diff_rate_pct+'</span></div>';
document.getElementById('go').innerHTML='<div class="row"><span class="label">GO/NO-GO</span><span class="value '+(g.status==='go'?'good':g.status==='no_go'?'bad':'warn')+'">'+g.status.toUpperCase()+'</span></div><div class="row"><span class="label">Stability</span><span class="value">'+g.stability.streak+'/'+g.stability.required+'</span></div><div class="row"><span class="label">Ready</span><span class="value '+(g.stability.is_stable?'good':'warn')+'">'+(g.stability.is_stable?'✅':'⏳')+'</span></div>';
document.getElementById('upd').textContent='更新: '+new Date().toLocaleTimeString('zh-CN');
}
async function setMode(m){await fetch('/api/control/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m})});load()}
async function setWeight(w){await fetch('/api/control/weight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weight:w})});load()}
async function fallback(){await fetch('/api/control/fallback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'手动触发'})});load()}
load();setInterval(load,2000);
</script>
</body>
</html>'''

@app.get("/", response_class=HTMLResponse)
async def root(): return HTML

@app.get("/control-tower", response_class=HTMLResponse)
async def tower(): return HTML

@app.get("/api/state")
async def get_state():
    if state_store: return state_store.to_dict()
    return {"error": "not initialized"}

@app.get("/api/control")
async def get_control():
    if control_flags: return control_flags.to_dict()
    return {"error": "not initialized"}

@app.get("/api/all")
async def get_all():
    s = state_store.to_dict() if state_store else {}
    c = control_flags.to_dict() if control_flags else {}
    g = s.get("go_no_go", {}) if s else {}
    rec = control_flags.get_recommendation({"go_stability": g.get("stability", {}).get("streak", 0), "aggressive": s.get("shadow", {}).get("aggressive", 0)}) if control_flags else ""
    return {"state": s, "control": c, "go_no_go": g, "phase": {"phase": c.get("phase", ""), "recommendation": rec}}

@app.post("/api/control/mode")
async def set_mode(data: Dict[str, str]):
    if control_flags:
        success = control_flags.set_mode(data.get("mode", "hybrid"))
        return {"success": success, **control_flags.to_dict()}
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
        control_flags.fallback(data.get("reason", "手动触发"))
        return {"success": True, **control_flags.to_dict()}
    return {"success": False}

@app.get("/debug/state")
async def debug_state():
    if state_store: return state_store.to_dict()
    return {"error": "not initialized"}

@app.post("/debug/simulate-trade")
async def simulate_trade():
    import random
    decision = {"timestamp": datetime.utcnow().isoformat(), "signal_id": f"SIG_{random.randint(1000,9999)}", "old_action": random.choice(["HOLD","BUY","SELL"]), "new_action": random.choice(["HOLD","BUY","SELL"]), "diff_type": random.choice(["SAME","SAME","CONSERVATIVE"]), "risk_level": "LOW", "new_reason": "simulated"}
    if state_store:
        state_store.on_shadow_trade(decision)
        return {"success": True, "decision": decision, "new_state": state_store.to_dict()}
    return {"success": False}

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8768
    print("="*60)
    print("🐉 小龙 Control Tower V2 - 事件驱动 + Hybrid")
    print("="*60)
    print(f"\n🌐 http://localhost:{port}/control-tower")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=port)