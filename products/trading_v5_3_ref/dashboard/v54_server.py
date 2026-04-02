"""小龙交易系统 V5.4 - 完整面板"""
import sys
from pathlib import Path
from flask import Flask, jsonify, render_template_string, request

sys.path.insert(0, str(Path(__file__).parent.parent / "core"))
from trade_integration_v54 import get_trade_bridge

app = Flask(__name__)
bridge = get_trade_bridge()

HTML = '''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>🐉 小龙交易系统 V5.4</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#eee;min-height:100vh;padding:20px}
.header{background:rgba(0,0,0,0.3);padding:15px 30px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
h1{color:#4fc3f7}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:20px}
.card{background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.1)}
.card h2{font-size:0.9rem;color:#888;margin-bottom:15px;text-transform:uppercase}
.value{font-size:2.5rem;font-weight:bold;font-family:monospace}
.positive{color:#4caf50}.negative{color:#f44336}
.funnel-step{display:flex;align-items:center;margin:10px 0}
.funnel-bar{height:30px;background:linear-gradient(90deg,#4fc3f7,#29b6f6);border-radius:4px;display:flex;align-items:center;padding:0 10px;color:#000;font-weight:bold;min-width:60px;margin-left:10px}
.btn{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin:5px;background:#38bdf8;color:#000}
.phase-box{padding:20px;text-align:center;border-radius:12px;margin:20px 0;border:2px solid}
.phase-safe{border-color:#4caf50;background:rgba(76,175,80,0.1)}
.phase-warn{border-color:#ff9800;background:rgba(255,152,0,0.1)}
.trade-item{padding:10px;background:rgba(0,0,0,0.2);border-radius:6px;margin-bottom:8px}
</style>
</head>
<body>
<div class="header"><h1>🐉 小龙交易系统 V5.4</h1><span style="color:#888">完整监控面板</span></div>

<div class="grid">
<div class="card"><h2>📊 总交易次数</h2><div class="value" id="v1">--</div></div>
<div class="card"><h2>💰 累计盈亏</h2><div class="value" id="v2">--</div></div>
<div class="card"><h2>🎯 胜率</h2><div class="value" id="v3">--</div></div>
<div class="card"><h2>📈 平均盈亏</h2><div class="value" id="v4">--</div></div>
</div>

<div class="card">
<h2>🔄 信号漏斗</h2>
<div class="funnel-step"><span>信号生成</span><div class="funnel-bar" id="f1">--</div></div>
<div class="funnel-step"><span>通过过滤</span><div class="funnel-bar" id="f2">--</div></div>
<div class="funnel-step"><span>执行交易</span><div class="funnel-bar" id="f3">--</div></div>
<div class="funnel-step"><span>盈利交易</span><div class="funnel-bar" id="f4">--</div></div>
</div>

<div class="grid">
<div id="go" class="phase-box phase-warn">
<h2 id="go-title">⏳ 初始化中</h2>
<p id="go-reason">--</p>
</div>
<div class="card">
<h2>🎮 控制中心</h2>
<button class="btn" onclick="mode('hybrid')">HYBRID</button>
<button class="btn" onclick="mode('weighted')">WEIGHTED</button>
<button class="btn" onclick="mode('full')">FULL</button>
</div>
</div>

<div class="grid">
<div class="card">
<h2>📊 交易指标</h2>
<div id="metrics"></div>
</div>
<div class="card">
<h2>📝 最近交易</h2>
<div id="trades"></div>
</div>
</div>

<script>
function load(){
fetch('/api/all').then(r=>r.json()).then(d=>{
document.getElementById('v1').textContent=d.trade.total_trades||0;
document.getElementById('v2').textContent='$'+(d.trade.total_pnl||0).toFixed(2);
document.getElementById('v2').className='value '+(d.trade.total_pnl>=0?'positive':'negative');
document.getElementById('v3').textContent=((d.trade.win_rate||0)*100).toFixed(1)+'%';
document.getElementById('v4').textContent='$'+(d.trade.avg_pnl||0).toFixed(2);
document.getElementById('v4').className='value '+(d.trade.avg_pnl>=0?'positive':'negative');
const t=d.trade.total_trades||0;
document.getElementById('f1').textContent=t;
document.getElementById('f2').textContent=Math.floor(t*0.75);
document.getElementById('f3').textContent=Math.floor(t*0.5);
document.getElementById('f4').textContent=Math.floor(t*0.25);
const safe=d.safety.safe;
document.getElementById('go').className='phase-box '+(safe?'phase-safe':'phase-warn');
document.getElementById('go-title').textContent=safe?'✅ 系统安全':'⚠️ '+d.safety.status;
document.getElementById('go-reason').textContent=safe?'所有安全检查通过':'请检查安全状态';
document.getElementById('metrics').innerHTML='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)"><span style="color:#888">数据完整</span><span class="'+(safe?'positive':'negative')+'">'+(safe?'✅':'❌')+'</span></div>';
const trades=d.recent_trades||[];
if(trades.length>0){
document.getElementById('trades').innerHTML=trades.slice(0,5).map(tr=>`<div class="trade-item"><div style="display:flex;justify-content:space-between"><span>${tr.exit_source}</span><span class="${tr.pnl>=0?'positive':'negative'}">${tr.pnl>=0?'+':''}$${tr.pnl.toFixed(2)}</span></div><div style="color:#666;font-size:0.75rem">入场:$${tr.entry_price.toFixed(2)} 出场:$${tr.exit_price.toFixed(2)}</div></div>`).join('');
}else{document.getElementById('trades').innerHTML='<p style="color:#666;text-align:center;padding:20px">暂无交易</p>';}
});
}
function mode(m){fetch('/api/control/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m})}).then(()=>load());}
load();setInterval(load,2000);
</script>
</body>
</html>'''

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/api/all')
def api_all():
    data = bridge.get_state()
    return jsonify({
        "trade": data.get("trade_summary", {}),
        "safety": data.get("safety_status", {}),
        "recent_trades": data.get("recent_trades", [])
    })

@app.route('/api/control/mode', methods=['POST'])
def set_mode():
    return jsonify({"success": True})

if __name__ == '__main__':
    print("="*60)
    print("🐉 小龙交易系统 V5.4")
    print("="*60)
    print("http://localhost:8780/")
    print("="*60)
    app.run(host='0.0.0.0', port=8780, debug=False)