"""
Control Tower Server v2 - 事件驱动版本

核心改进:
- 使用 StateStore 存储实时状态
- GO/NO-GO 随每笔 Shadow 交易自动更新
- API 只读取，不计算
"""

import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 导入 StateStore 和 HybridController
try:
    from state_store import get_state_store
    from hybrid_controller import get_hybrid_controller
    STATE_STORE_AVAILABLE = True
    HYBRID_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ 导入失败: {e}")
    STATE_STORE_AVAILABLE = False
    HYBRID_AVAILABLE = False


# ============ 全局状态 ============
state_store = None
hybrid_controller = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global state_store, hybrid_controller
    
    if STATE_STORE_AVAILABLE:
        state_store = get_state_store()
        print("✅ StateStore 初始化完成")
    
    if HYBRID_AVAILABLE:
        hybrid_controller = get_hybrid_controller()
        print("✅ HybridController 初始化完成")
    else:
        print("⚠️ 使用模拟数据模式")
    
    yield
    print("👋 服务器关闭")


app = FastAPI(title="小龙 Control Tower v2", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ws_clients: List[WebSocket] = []


# ============ API 路由 ============

@app.get("/", response_class=HTMLResponse)
async def root():
    return CONTROL_TOWER_HTML


@app.get("/control-tower", response_class=HTMLResponse)
async def control_tower():
    return CONTROL_TOWER_HTML


@app.get("/api/state")
async def get_state() -> Dict[str, Any]:
    """获取完整系统状态（只读取，不计算）"""
    if state_store:
        return state_store.to_dict()
    return _mock_state()


@app.get("/api/go-no-go")
async def get_go_no_go() -> Dict[str, Any]:
    """获取 GO/NO-GO 状态"""
    if state_store:
        return state_store.get_go_no_go()
    return {'status': 'pending', 'can_go': False, 'reason': '无数据'}


@app.get("/debug/state")
async def debug_state() -> Dict[str, Any]:
    """Debug API - 查看当前完整状态"""
    if state_store:
        return state_store.to_dict()
    return {'error': 'state_store not initialized'}


@app.post("/debug/simulate-trade")
async def simulate_trade() -> Dict[str, Any]:
    """Debug API - 模拟一笔交易"""
    import random
    diff_types = ['SAME', 'SAME', 'SAME', 'CONSERVATIVE', 'CONSERVATIVE']  # 故意让 SAME 概率高
    decision = {
        'timestamp': datetime.utcnow().isoformat(),
        'signal_id': f'SIG_{random.randint(1000, 9999)}',
        'old_action': random.choice(['HOLD', 'BUY', 'SELL']),
        'new_action': random.choice(['HOLD', 'BUY', 'SELL']),
        'diff_type': random.choice(diff_types),
        'risk_level': random.choice(['LOW', 'LOW', 'LOW', 'MEDIUM']),  # LOW 概率高
        'new_reason': 'simulated'
    }
    
    if state_store:
        state_store.on_shadow_trade(decision)
        return {
            'success': True,
            'decision': decision,
            'new_state': state_store.to_dict()
        }
    return {'success': False, 'error': 'state_store not initialized'}


@app.post("/api/mode")
async def set_mode(data: Dict[str, str]) -> Dict[str, Any]:
    """设置运行模式"""
    mode = data.get('mode', 'shadow')
    if hybrid_controller:
        success = hybrid_controller.set_mode(mode)
        return {'success': success, 'mode': hybrid_controller.mode.value}
    return {'success': True, 'mode': mode}


@app.get("/api/hybrid/status")
async def get_hybrid_status() -> Dict[str, Any]:
    """获取 Hybrid 控制器状态"""
    if hybrid_controller:
        return hybrid_controller.to_dict()
    return {'error': 'hybrid_controller not initialized'}


@app.post("/api/hybrid/mode")
async def set_hybrid_mode(data: Dict[str, str]) -> Dict[str, Any]:
    """设置 Hybrid 模式"""
    mode = data.get('mode', 'shadow')
    if hybrid_controller:
        success = hybrid_controller.set_mode(mode)
        return {'success': success, **hybrid_controller.to_dict()}
    return {'success': False, 'error': 'not initialized'}


@app.post("/api/hybrid/weight")
async def set_hybrid_weight(data: Dict[str, float]) -> Dict[str, Any]:
    """设置 V3 权重（用于 WEIGHTED 模式）"""
    weight = data.get('weight', 0.0)
    if hybrid_controller:
        success = hybrid_controller.set_weight(weight)
        return {'success': success, **hybrid_controller.to_dict()}
    return {'success': False, 'error': 'not initialized'}


@app.post("/api/hybrid/fallback")
async def trigger_fallback(data: Dict[str, str]) -> Dict[str, Any]:
    """触发紧急回退"""
    reason = data.get('reason', '手动触发')
    if hybrid_controller:
        hybrid_controller.fallback(reason)
        return {'success': True, **hybrid_controller.to_dict()}
    return {'success': False, 'error': 'not initialized'}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except:
        pass
    finally:
        ws_clients.remove(websocket)


def _mock_state() -> Dict[str, Any]:
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'mode': 'shadow',
        'status': 'initializing',
        'execution': {'errors': 0, 'p50': 1050, 'p90': 1320},
        'audit': {'profit_factor': 1.48, 'expectancy': 0.0438, 'drawdown': 0.006},
        'shadow': {'total': 0, 'same': 0, 'conservative': 0, 'aggressive': 0, 'diff_rate': 0, 'diff_rate_pct': '0.0%'},
        'go_no_go': {'status': 'pending', 'can_go': False, 'reason': '系统初始化中'},
        'risk': {'level': 'LOW', 'circuit': 'NORMAL', 'capital': 'NORMAL'},
        'recent_decisions': []
    }


# ============ HTML ============
CONTROL_TOWER_HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐉 小龙 Control Tower v2 - 事件驱动</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 20px; border-bottom: 1px solid #334155; }
        .header h1 { font-size: 24px; color: #38bdf8; }
        .header .subtitle { color: #94a3b8; font-size: 14px; margin-top: 5px; }
        .verdict { padding: 30px; text-align: center; }
        .verdict.initializing { background: rgba(234,179,8,0.1); }
        .verdict.safe { background: rgba(34,197,94,0.1); }
        .verdict.warn { background: rgba(234,179,8,0.1); }
        .verdict.block { background: rgba(239,68,68,0.1); }
        .verdict .icon { font-size: 48px; }
        .verdict .title { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .verdict.initializing .title, .verdict.warn .title { color: #eab308; }
        .verdict.safe .title { color: #22c55e; }
        .verdict.block .title { color: #ef4444; }
        .verdict .subtitle { color: #94a3b8; }
        .verdict .metrics { display: flex; gap: 20px; justify-content: center; margin-top: 15px; font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; padding: 20px; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
        .card h3 { font-size: 14px; color: #94a3b8; margin-bottom: 15px; text-transform: uppercase; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }
        .row:last-child { border-bottom: none; }
        .label { color: #64748b; }
        .value { font-weight: 600; }
        .value.good { color: #22c55e; }
        .value.warn { color: #eab308; }
        .value.bad { color: #ef4444; }
        .go-nogo { padding: 30px; text-align: center; }
        .go-state { background: rgba(34,197,94,0.1); border: 2px solid #22c55e; border-radius: 12px; padding: 30px; }
        .go-state h2 { color: #22c55e; font-size: 48px; }
        .nogo-state { background: rgba(239,68,68,0.1); border: 2px solid #ef4444; border-radius: 12px; padding: 30px; }
        .nogo-state h2 { color: #ef4444; font-size: 48px; }
        .pending-state { background: rgba(234,179,8,0.1); border: 2px solid #eab308; border-radius: 12px; padding: 30px; }
        .pending-state h2 { color: #eab308; font-size: 48px; }
        .progress { background: #334155; height: 10px; border-radius: 5px; margin-top: 15px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s; }
        .recent { max-height: 300px; overflow-y: auto; }
        .decision { display: grid; grid-template-columns: 60px 80px 60px 30px 60px 70px 60px; gap: 8px; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 12px; align-items: center; }
        .time { color: #64748b; }
        .id { color: #38bdf8; }
        .diff-same { background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .diff-conservative { background: #eab308; color: black; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .diff-aggressive { background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .risk-low { background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .risk-medium { background: #eab308; color: black; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .risk-high { background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; padding: 10px 20px; border-top: 1px solid #334155; display: flex; justify-content: space-between; font-size: 12px; }
        .online { color: #22c55e; }
        .offline { color: #ef4444; }
        .loading { color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐉 小龙 Control Tower v2</h1>
        <div class="subtitle">事件驱动架构 | 每笔交易实时更新 GO/NO-GO</div>
    </div>
    <div id="verdict" class="verdict initializing"><div class="icon">⏳</div><div class="title">系统初始化中</div><div class="subtitle">等待数据...</div></div>
    <div class="grid">
        <div class="card"><h3>⚡ 执行稳定性</h3><div id="exec"><span class="loading">加载中...</span></div></div>
        <div class="card"><h3>📈 收益审计</h3><div id="audit"><span class="loading">加载中...</span></div></div>
        <div class="card"><h3>🧠 Shadow 指标</h3><div id="shadow"><span class="loading">加载中...</span></div></div>
        <div class="card"><h3>🛡️ 风控状态</h3><div id="risk"><span class="loading">加载中...</span></div></div>
    </div>
    <div class="go-nogo" id="gonogo"><div class="pending-state"><h2>⏳ PENDING</h2><p>等待数据积累</p></div></div>
    <div class="grid"><div class="card" style="grid-column:1/-1"><h3>📋 最近决策</h3><div id="recent" class="recent"><span class="loading">加载中...</span></div></div></div>
    <div class="status-bar"><span id="ws" class="offline">● 离线</span><span id="update">最后更新: --:--:--</span></div>
    <script>
        const CN={actions:{BUY:'买入',SELL:'卖出',HOLD:'持有',CLOSE:'平仓',PASS:'跳过'},diff:{SAME:'一致',CONSERVATIVE:'保守',AGGRESSIVE:'激进'},risk:{LOW:'低',MEDIUM:'中',HIGH:'高'}};
        async function load(){try{const r=await fetch('/api/state');const d=await r.json();render(d)}catch(e){console.error(e)}}
        function render(d){
            const v=document.getElementById('verdict'),s={initializing:['⏳','初始化中'],safe:['✅','系统正常'],warn:['⚠️','系统警告'],block:['🚫','系统阻断']}[d.status]||['❓','未知'];
            v.className='verdict '+d.status;v.innerHTML='<div class="icon">'+s[0]+'</div><div class="title">'+s[1]+'</div><div class="subtitle">模式: '+d.mode+'</div><div class="metrics"><span>样本: '+d.shadow.total+'</span><span>差异率: '+d.shadow.diff_rate_pct+'</span><span>激进: '+d.shadow.aggressive+'</span></div>';
            document.getElementById('exec').innerHTML='<div class="row"><span class="label">错误</span><span class="value '+(d.execution.errors>0?'bad':'good')+'">'+d.execution.errors+' 次</span></div><div class="row"><span class="label">延迟P50</span><span class="value">'+(d.execution.p50||'-')+' ms</span></div><div class="row"><span class="label">延迟P90</span><span class="value">'+(d.execution.p90||'-')+' ms</span></div>';
            const pf=d.audit.profit_factor;document.getElementById('audit').innerHTML='<div class="row"><span class="label">盈亏比</span><span class="value '+(pf>=1.2?'good':pf>=1?'warn':'bad')+'">'+(pf?.toFixed(2)||'-')+'</span></div><div class="row"><span class="label">期望值</span><span class="value">'+(d.audit.expectancy?.toFixed(4)||'-')+'</span></div><div class="row"><span class="label">回撤</span><span class="value">'+(d.audit.drawdown*100).toFixed(1)+'%</span></div>';
            document.getElementById('shadow').innerHTML='<div class="row"><span class="label">样本数</span><span class="value">'+d.shadow.total+' / 30</span></div><div class="row"><span class="label">差异率</span><span class="value">'+d.shadow.diff_rate_pct+'</span></div><div class="row"><span class="label">激进</span><span class="value '+(d.shadow.aggressive>0?'bad':'good')+'">'+d.shadow.aggressive+'</span></div>';
            document.getElementById('risk').innerHTML='<div class="row"><span class="label">风险</span><span class="value '+(d.risk.level==='LOW'?'good':d.risk.level==='MEDIUM'?'warn':'bad')+'">'+CN.risk[d.risk.level]+'</span></div><div class="row"><span class="label">熔断</span><span class="value '+(d.risk.circuit==='NORMAL'?'good':'bad')+'">'+(d.risk.circuit==='NORMAL'?'正常':'已触发')+'</span></div>';
            const g=document.getElementById('gonogo'),p=(d.shadow.total/30)*100;
            if(d.go_no_go.status==='pending')g.innerHTML='<div class="pending-state"><h2>⏳ 等待中</h2><p>'+d.go_no_go.reason+'</p><div class="progress"><div class="progress-fill" style="width:'+p+'%;background:#eab308"></div></div></div>';
            else if(d.go_no_go.status==='go'){
                let warn=d.go_no_go.diff_warning?'<p style="color:#eab308;margin-top:10px">⚠️ '+d.go_no_go.diff_warning+'</p>':'';
                let stab=d.go_no_go.stability;
                let stabHtml=stab.is_stable?'<p style="color:#22c55e;margin-top:10px">🔒 GO 稳定性: READY</p>':'<p style="color:#94a3b8;margin-top:10px">📊 GO 稳定性: '+stab.streak+'/'+stab.required+'</p>';
                g.innerHTML='<div class="go-state"><h2>✅ 可以上线</h2><p>'+d.go_no_go.reason+'</p>'+stabHtml+warn+'</div>';
            }else g.innerHTML='<div class="nogo-state"><h2>⛔ 不可上线</h2><p>'+d.go_no_go.reason+'</p></div>';
            const rc=document.getElementById('recent');if(d.recent_decisions.length===0)rc.innerHTML='<span class="loading">暂无记录</span>';
            else rc.innerHTML=d.recent_decisions.slice(0,15).map(i=>{const c=i.diff_type==='SAME'?'diff-same':i.diff_type==='CONSERVATIVE'?'diff-conservative':'diff-aggressive',r=i.risk_level==='LOW'?'risk-low':i.risk_level==='MEDIUM'?'risk-medium':'risk-high',t=new Date(i.timestamp).toLocaleTimeString('zh-CN',{hour12:false});return'<div class="decision"><span class="time">'+t+'</span><span class="id">'+i.signal_id+'</span><span>'+(CN.actions[i.old_action]||i.old_action)+'</span><span>→</span><span>'+(CN.actions[i.new_action]||i.new_action)+'</span><span class="'+c+'">'+CN.diff[i.diff_type]+'</span><span class="'+r+'">'+CN.risk[i.risk_level]+'</span></div>'}).join('');
            document.getElementById('update').textContent='最后更新: '+new Date().toLocaleTimeString('zh-CN');
        }
        load();setInterval(load,2000);
    </script>
</body>
</html>'''


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
    print("="*60)
    print("🐉 小龙 Control Tower v2 - 事件驱动")
    print("="*60)
    print(f"\n🌐 访问: http://localhost:{port}/control-tower")
    print(f"\n🎯 核心改进:")
    print(f"   ✓ StateStore 事件驱动状态")
    print(f"   ✓ 每笔 Shadow 交易自动更新 GO/NO-GO")
    print(f"   ✓ API 只读取，不计算")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=port)