#!/usr/bin/env python3
"""
V5.2 Monitor Server v2 - 交易指挥中心

Level 2 功能：
- 决策追踪（Decision Trace）
- 信号漏斗（Signal Funnel）
- 执行失败日志

Level 3 功能：
- 控制能力（Control Plane）
- AI 风控评分
- 异常检测
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
import asyncio

# ============================================================
# 配置
# ============================================================
BASE_DIR = Path(__file__).parent
LOG_FILE = BASE_DIR / "logs" / "system_state.jsonl"
OUTPUT_LOG = BASE_DIR / "logs" / "v52_output.log"
CONTROL_FILE = BASE_DIR / "logs" / "control_state.json"

# 控制状态
control_state = {
    "enabled": True,
    "mode": "shadow",  # shadow / live
    "frozen": False,
    "last_update": datetime.now().isoformat()
}

app = FastAPI(
    title="V5.2 Control Tower",
    description="小龙交易系统监控面板 v2",
    version="2.0.0"
)

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 数据读取函数
# ============================================================
def read_last_state() -> Optional[Dict[str, Any]]:
    """读取最后一条状态"""
    try:
        if not LOG_FILE.exists():
            return None
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
            if not lines:
                return None
            return json.loads(lines[-1])
    except Exception as e:
        return {"error": str(e)}

def read_recent_states(n: int = 100) -> List[Dict[str, Any]]:
    """读取最近 N 条状态"""
    try:
        if not LOG_FILE.exists():
            return []
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-n:]]
    except:
        return []

def calculate_funnel() -> Dict[str, Any]:
    """计算信号漏斗"""
    states = read_recent_states(200)
    if not states:
        return {"error": "no_data"}
    
    total = len(states)
    
    # 各层级统计
    score_pass = sum(1 for s in states if s.get('score', 0) >= 80)
    volume_pass = sum(1 for s in states if s.get('volume_ratio', 0) >= 1.2)
    both_pass = sum(1 for s in states if s.get('score', 0) >= 80 and s.get('volume_ratio', 0) >= 1.2)
    traded = sum(s.get('total_trades', 0) for s in states)
    
    return {
        "total_signals": total,
        "score_pass": score_pass,
        "volume_pass": volume_pass,
        "both_pass": both_pass,
        "trades": traded,
        "conversion_rate": f"{(both_pass / total * 100) if total > 0 else 0:.1f}%",
        "funnel": [
            {"stage": "总信号", "count": total, "rate": "100%"},
            {"stage": "评分≥80", "count": score_pass, "rate": f"{(score_pass / total * 100) if total > 0 else 0:.1f}%"},
            {"stage": "成交量≥1.2x", "count": volume_pass, "rate": f"{(volume_pass / total * 100) if total > 0 else 0:.1f}%"},
            {"stage": "全部通过", "count": both_pass, "rate": f"{(both_pass / total * 100) if total > 0 else 0:.1f}%"},
            {"stage": "执行交易", "count": traded, "rate": f"{(traded / total * 100) if total > 0 else 0:.1f}%"}
        ]
    }

def calculate_stats() -> Dict[str, Any]:
    """计算统计数据"""
    states = read_recent_states(100)
    if not states:
        return {}
    
    scores = [s.get('score', 0) for s in states]
    volumes = [s.get('volume_ratio', 0) for s in states]
    signals = [s for s in states if s.get('score', 0) >= 80 and s.get('volume_ratio', 0) >= 1.2]
    
    # Regime 分布
    regimes = {}
    for s in states:
        r = s.get('regime', 'unknown')
        regimes[r] = regimes.get(r, 0) + 1
    
    # 拒绝原因分析
    reject_score = sum(1 for s in states if s.get('score', 0) < 80)
    reject_volume = sum(1 for s in states if s.get('score', 0) >= 80 and s.get('volume_ratio', 0) < 1.2)
    
    return {
        "total_records": len(states),
        "avg_score": sum(scores) / len(scores) if scores else 0,
        "max_score": max(scores) if scores else 0,
        "min_score": min(scores) if scores else 0,
        "avg_volume": sum(volumes) / len(volumes) if volumes else 0,
        "signals_detected": len(signals),
        "regime_distribution": regimes,
        "total_trades": states[-1].get('total_trades', 0) if states else 0,
        "reject_analysis": {
            "reject_score": reject_score,
            "reject_volume": reject_volume,
            "reject_score_pct": f"{(reject_score / len(states) * 100) if states else 0:.1f}%",
            "reject_volume_pct": f"{(reject_volume / len(states) * 100) if states else 0:.1f}%"
        }
    }

def calculate_ai_risk() -> Dict[str, Any]:
    """计算 AI 风控评分"""
    states = read_recent_states(50)
    if not states:
        return {"score": 0, "level": "UNKNOWN", "factors": []}
    
    anomaly_score = 0.0
    factors = []
    
    # 检查平均评分
    avg_score = sum(s.get('score', 0) for s in states) / len(states)
    if avg_score < 50:
        anomaly_score += 0.2
        factors.append(f"平均评分过低: {avg_score:.1f}")
    
    # 检查成交量
    avg_volume = sum(s.get('volume_ratio', 0) for s in states) / len(states)
    if avg_volume < 0.5:
        anomaly_score += 0.2
        factors.append(f"平均成交量过低: {avg_volume:.2f}x")
    
    # 检查执行质量
    avg_exec_quality = sum(s.get('execution_quality', 1) for s in states) / len(states)
    if avg_exec_quality < 0.7:
        anomaly_score += 0.3
        factors.append(f"执行质量下降: {avg_exec_quality:.2f}")
    
    # 检查胜率
    win_rate = states[-1].get('win_rate', 0.5) if states else 0.5
    if win_rate < 0.4:
        anomaly_score += 0.3
        factors.append(f"胜率过低: {win_rate * 100:.0f}%")
    
    # 确定风险等级
    if anomaly_score < 0.3:
        level = "LOW"
    elif anomaly_score < 0.6:
        level = "MEDIUM"
    elif anomaly_score < 0.8:
        level = "HIGH"
    else:
        level = "CRITICAL"
    
    return {
        "score": round(anomaly_score, 2),
        "level": level,
        "factors": factors
    }

def read_output_log(n: int = 100) -> List[str]:
    """读取输出日志"""
    try:
        if not OUTPUT_LOG.exists():
            return []
        with open(OUTPUT_LOG, "r") as f:
            lines = f.readlines()
            return lines[-n:]
    except:
        return []

def save_control_state():
    """保存控制状态"""
    control_state["last_update"] = datetime.now().isoformat()
    with open(CONTROL_FILE, "w") as f:
        json.dump(control_state, f, indent=2)

# ============================================================
# API 端点
# ============================================================
@app.get("/")
async def root():
    """API 根"""
    return {
        "name": "V5.2 Control Tower", 
        "version": "2.0.0",
        "status": "running",
        "features": ["decision_trace", "signal_funnel", "control_plane", "ai_risk"]
    }

@app.get("/status")
async def get_status():
    """获取当前状态"""
    state = read_last_state()
    if state is None:
        return {"status": "no_data", "message": "等待数据..."}
    return state

@app.get("/recent")
async def get_recent(n: int = 50):
    """获取最近 N 条记录"""
    return read_recent_states(n)

@app.get("/stats")
async def get_stats():
    """获取统计数据"""
    return calculate_stats()

@app.get("/funnel")
async def get_funnel():
    """获取信号漏斗"""
    return calculate_funnel()

@app.get("/signals")
async def get_signals():
    """获取触发信号"""
    states = read_recent_states(100)
    signals = [s for s in states if s.get('score', 0) >= 80 and s.get('volume_ratio', 0) >= 1.2]
    return {"count": len(signals), "signals": signals}

@app.get("/logs")
async def get_logs(n: int = 50):
    """获取输出日志"""
    logs = read_output_log(n)
    return {"logs": logs}

@app.get("/health")
async def health_check():
    """健康检查"""
    state = read_last_state()
    if state is None:
        return {"status": "waiting", "message": "等待数据"}
    
    timestamp = state.get('timestamp', '')
    if timestamp:
        try:
            last_time = datetime.fromisoformat(timestamp)
            now = datetime.now()
            age_seconds = (now - last_time).total_seconds()
            
            if age_seconds > 120:
                return {"status": "stale", "age_seconds": age_seconds}
            else:
                return {"status": "healthy", "age_seconds": age_seconds}
        except:
            pass
    
    return {"status": "unknown"}

# ============================================================
# Level 3: 控制能力
# ============================================================
@app.get("/control")
async def get_control():
    """获取控制状态"""
    return control_state

@app.post("/control/enable")
async def enable_trading():
    """启用交易"""
    control_state["enabled"] = True
    control_state["frozen"] = False
    save_control_state()
    return {"status": "enabled", "message": "交易已启用"}

@app.post("/control/disable")
async def disable_trading():
    """禁用交易"""
    control_state["enabled"] = False
    save_control_state()
    return {"status": "disabled", "message": "交易已禁用"}

@app.post("/control/freeze")
async def freeze_system():
    """冻结系统（紧急停止）"""
    control_state["frozen"] = True
    control_state["enabled"] = False
    save_control_state()
    return {"status": "frozen", "message": "🚨 系统已冻结"}

@app.post("/control/unfreeze")
async def unfreeze_system():
    """解冻系统"""
    control_state["frozen"] = False
    save_control_state()
    return {"status": "unfrozen", "message": "系统已解冻"}

@app.post("/control/mode/{mode}")
async def set_mode(mode: str):
    """设置模式 (shadow/live)"""
    if mode not in ["shadow", "live"]:
        return {"error": "无效模式，请使用 shadow 或 live"}
    control_state["mode"] = mode
    save_control_state()
    return {"status": "ok", "mode": mode, "message": f"模式已切换为 {mode}"}

# ============================================================
# AI 风控
# ============================================================
@app.get("/ai/risk")
async def get_ai_risk():
    """获取 AI 风控评分"""
    return calculate_ai_risk()

# ============================================================
# Evolution Dashboard API
# ============================================================
@app.get("/evolution")
async def get_evolution(n: int = 50):
    """获取进化日志列表"""
    try:
        log_file = BASE_DIR / "logs" / "evolution_logs.jsonl"
        if not log_file.exists():
            return []
        
        with open(log_file, "r") as f:
            lines = f.readlines()[-n:]
        
        return [json.loads(line) for line in lines]
    except Exception as e:
        return {"error": str(e)}

@app.get("/evolution/summary")
async def evolution_summary():
    """进化统计聚合"""
    try:
        log_file = BASE_DIR / "logs" / "evolution_logs.jsonl"
        if not log_file.exists():
            return {"accepted": 0, "rejected": 0, "testing": 0, "accept_rate": 0}
        
        with open(log_file, "r") as f:
            logs = [json.loads(line) for line in f]
        
        accepted = sum(1 for e in logs if e.get("decision") == "ACCEPTED")
        rejected = sum(1 for e in logs if e.get("decision") == "REJECTED")
        testing = sum(1 for e in logs if e.get("decision") == "TESTING")
        total = accepted + rejected + testing
        
        # 计算平均改进
        scores = [e.get("performance", {}).get("score", 0) for e in logs if e.get("performance")]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # 检测恶化
        degradation_events = 0
        if len(scores) >= 3:
            for i in range(len(scores) - 3):
                if scores[i+1] < scores[i] and scores[i+2] < scores[i+1]:
                    degradation_events += 1
        
        return {
            "accepted": accepted,
            "rejected": rejected,
            "testing": testing,
            "total": total,
            "accept_rate": accepted / max(1, total),
            "avg_score": round(avg_score, 3),
            "degradation_events": degradation_events
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/evolution/warnings")
async def evolution_warnings():
    """危险检测 - 检测系统是否在学坏"""
    warnings = []
    
    try:
        log_file = BASE_DIR / "logs" / "evolution_logs.jsonl"
        if not log_file.exists():
            return {"warnings": [], "status": "NO_DATA"}
        
        with open(log_file, "r") as f:
            logs = [json.loads(line) for line in f]
        
        if not logs:
            return {"warnings": [], "status": "NO_DATA"}
        
        # 1. 检测连续下降
        recent = logs[-5:]
        scores = [e.get("performance", {}).get("score", 0) for e in recent if e.get("performance")]
        if len(scores) >= 3:
            decreasing = all(scores[i] > scores[i+1] for i in range(len(scores)-1))
            if decreasing:
                warnings.append({
                    "level": "HIGH",
                    "type": "PERFORMANCE_DECREASING",
                    "message": f"性能连续下降 {len(scores)} 次",
                    "scores": scores
                })
        
        # 2. 检测参数漂移
        for log in logs[-10:]:
            old_params = log.get("old_params", {})
            new_params = log.get("new_params", {})
            
            # 评分阈值过低
            if new_params.get("score_threshold", 80) < 65:
                warnings.append({
                    "level": "HIGH",
                    "type": "PARAMETER_DRIFT",
                    "message": f"评分阈值过低: {new_params.get('score_threshold')}",
                    "strategy": log.get("strategy")
                })
            
            # 成交量阈值过低
            if new_params.get("volume_threshold", 1.0) < 0.6:
                warnings.append({
                    "level": "MEDIUM",
                    "type": "PARAMETER_DRIFT",
                    "message": f"成交量阈值过低: {new_params.get('volume_threshold')}",
                    "strategy": log.get("strategy")
                })
        
        # 3. 检测接受率异常
        total = len(logs)
        accepted = sum(1 for e in logs if e.get("decision") == "ACCEPTED")
        accept_rate = accepted / max(1, total)
        
        if accept_rate > 0.8:
            warnings.append({
                "level": "MEDIUM",
                "type": "ACCEPT_RATE_HIGH",
                "message": f"接受率过高: {accept_rate*100:.0f}% (>80%)",
                "accept_rate": accept_rate
            })
        elif accept_rate < 0.1 and total >= 5:
            warnings.append({
                "level": "MEDIUM",
                "type": "ACCEPT_RATE_LOW",
                "message": f"接受率过低: {accept_rate*100:.0f}% (<10%)",
                "accept_rate": accept_rate
            })
        
        # 状态判断
        high_warnings = sum(1 for w in warnings if w.get("level") == "HIGH")
        status = "CRITICAL" if high_warnings > 0 else "WARNING" if warnings else "OK"
        
        return {"warnings": warnings, "status": status, "count": len(warnings)}
    
    except Exception as e:
        return {"error": str(e), "warnings": [], "status": "ERROR"}

@app.get("/evolution/params-trend")
async def evolution_params_trend():
    """参数变化趋势"""
    try:
        log_file = BASE_DIR / "logs" / "evolution_logs.jsonl"
        if not log_file.exists():
            return {"score_threshold": [], "volume_threshold": []}
        
        with open(log_file, "r") as f:
            logs = [json.loads(line) for line in f]
        
        score_trend = []
        volume_trend = []
        
        for log in logs:
            params = log.get("new_params", {})
            timestamp = log.get("timestamp", "")
            
            if "score_threshold" in params:
                score_trend.append({
                    "time": timestamp,
                    "value": params["score_threshold"]
                })
            
            if "volume_threshold" in params:
                volume_trend.append({
                    "time": timestamp,
                    "value": params["volume_threshold"]
                })
        
        return {
            "score_threshold": score_trend[-20:],
            "volume_threshold": volume_trend[-20:]
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/evolution/stats")
async def get_evolution_stats():
    """获取进化统计"""
    try:
        from core.evolution_engine import EvolutionEngine
        engine = EvolutionEngine()
        return engine.get_evolution_stats()
    except Exception as e:
        return {"error": str(e)}

@app.get("/evolution/recent")
async def get_evolution_recent(n: int = 10):
    """获取最近进化记录"""
    try:
        from core.evolution_engine import EvolutionEngine
        engine = EvolutionEngine()
        return {"records": engine.get_recent_evolutions(n)}
    except Exception as e:
        return {"error": str(e), "records": []}

@app.get("/evolution/logs")
async def get_evolution_logs(n: int = 50):
    """读取进化日志"""
    try:
        log_file = BASE_DIR / "logs" / "evolution_logs.jsonl"
        if not log_file.exists():
            return {"logs": []}
        
        with open(log_file, "r") as f:
            lines = f.readlines()[-n:]
        
        logs = [json.loads(line) for line in lines]
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        return {"error": str(e), "logs": []}

@app.get("/evolution/dashboard", response_class=HTMLResponse)
async def evolution_dashboard():
    """Evolution Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧬 Evolution Dashboard</title>
    <style>
        * { margin: 0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .stat-good { color:#00ff88; }
        .stat-warn { color:#ffaa00; }
        .stat-bad { color:#ff4444; }
        .evolution-log { background:#0a0a15; border-radius:10px; padding:15px; font-family:Monaco,monospace; font-size:11px; max-height:400px; overflow-y:auto; }
        .log-entry { margin:5px 0; padding:8px; border-radius:5px; }
        .log-accepted { background:#1a3d1a; border-left:3px solid #00ff88; }
        .log-rejected { background:#3d1a1a; border-left:3px solid #ff4444; }
        .log-testing { background:#3d3d1a; border-left:3px solid #ffaa00; }
        .generation-badge { display:inline-block; background:#333; padding:2px 8px; border-radius:3px; margin-right:5px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧬 Evolution Dashboard</h1>
        <div><span class="live"></span>策略自我进化监控</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 进化统计</h2>
            <div id="stats">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🎯 当前策略</h2>
            <div id="strategies">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📈 变异参数</h2>
            <div id="params">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📜 进化日志</h2>
        <div class="evolution-log" id="logs">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchEvolution() {
            try {
                const statsRes = await fetch(`${API}/evolution/stats`);
                const stats = await statsRes.json();
                updateStats(stats);
                
                const logsRes = await fetch(`${API}/evolution/logs?n=20`);
                const logs = await logsRes.json();
                updateLogs(logs.logs);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateStats(stats) {
            if (stats.error) {
                document.getElementById('stats').innerHTML = `<div class="stat-item"><span>状态</span><span class="stat-bad">${stats.error}</span></div>`;
                return;
            }
            
            document.getElementById('stats').innerHTML = `
                <div class="stat-item"><span>总变异次数</span><span>${stats.total_mutations || 0}</span></div>
                <div class="stat-item"><span>已接受</span><span class="stat-good">${stats.accepted || 0}</span></div>
                <div class="stat-item"><span>已拒绝</span><span class="stat-bad">${stats.rejected || 0}</span></div>
                <div class="stat-item"><span>测试中</span><span class="stat-warn">${stats.testing || 0}</span></div>
                <div class="stat-item"><span>当前代数</span><span>${stats.generations || 0}</span></div>
            `;
            
            document.getElementById('strategies').innerHTML = `
                <div class="stat-item"><span>版本</span><span>V5.5</span></div>
                <div class="stat-item"><span>进化状态</span><span class="stat-good">ACTIVE</span></div>
                <div class="stat-item"><span>学习模式</span><span>shadow</span></div>
            `;
            
            document.getElementById('params').innerHTML = `
                <div class="stat-item"><span>评分阈值</span><span>60-90</span></div>
                <div class="stat-item"><span>成交量阈值</span><span>0.5-2.0x</span></div>
                <div class="stat-item"><span>最大变化</span><span>5.0 / 0.2</span></div>
            `;
        }
        
        function updateLogs(logs) {
            if (!logs || logs.length === 0) {
                document.getElementById('logs').innerHTML = '<div style="color:#888">暂无进化记录</div>';
                return;
            }
            
            let html = '';
            logs.slice().reverse().forEach(log => {
                const cls = log.decision === 'ACCEPTED' ? 'log-accepted' : 
                           log.decision === 'REJECTED' ? 'log-rejected' : 'log-testing';
                const time = log.timestamp ? log.timestamp.split('T')[1].split('.')[0] : '-';
                
                html += `
                    <div class="log-entry ${cls}">
                        <span class="generation-badge">Gen ${log.generation || 0}</span>
                        <span>${time}</span> 
                        <strong>${log.strategy || 'v52'}</strong> → ${log.version || '-'} 
                        [<strong>${log.decision}</strong>]
                        ${log.performance ? `<br>Score: ${(log.performance.score || 0).toFixed(2)}` : ''}
                    </div>
                `;
            });
            
            document.getElementById('logs').innerHTML = html;
        }
        
        fetchEvolution();
        setInterval(fetchEvolution, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================
# HTML Dashboard v2
# ============================================================
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    """Web Dashboard v2"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐉 V5.2 Control Tower</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f23;
            color: #e0e0e0;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 10px;
        }
        .header h1 { color: #00ff88; margin-bottom: 10px; }
        .header .version { color: #888; font-size: 14px; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .card {
            background: #1a1a2e;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .card h2 {
            color: #00ff88;
            margin-bottom: 15px;
            font-size: 14px;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }
        
        .status-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #252540;
        }
        .status-item:last-child { border-bottom: none; }
        .status-label { color: #888; font-size: 13px; }
        .status-value { font-weight: bold; font-size: 13px; }
        
        .status-healthy { color: #00ff88; }
        .status-warning { color: #ffaa00; }
        .status-danger { color: #ff4444; }
        
        .score-bar {
            height: 20px;
            background: #252540;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 10px;
        }
        .score-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff88, #00cc66);
            transition: width 0.3s;
        }
        
        .funnel-stage {
            display: flex;
            align-items: center;
            padding: 8px;
            margin: 5px 0;
            background: #252540;
            border-radius: 5px;
        }
        .funnel-name { flex: 1; color: #888; font-size: 12px; }
        .funnel-count { font-weight: bold; margin: 0 10px; }
        .funnel-rate { color: #00ff88; font-size: 12px; }
        
        .control-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            margin: 5px;
            transition: all 0.2s;
        }
        .btn-enable { background: #00ff88; color: #000; }
        .btn-disable { background: #ff4444; color: #fff; }
        .btn-freeze { background: #ff4444; color: #fff; }
        .btn-unfreeze { background: #00ff88; color: #000; }
        .btn-shadow { background: #4488ff; color: #fff; }
        .btn-live { background: #ff8800; color: #fff; }
        .control-btn:hover { opacity: 0.8; transform: scale(1.02); }
        
        .risk-meter {
            height: 30px;
            background: linear-gradient(90deg, #00ff88 0%, #ffaa00 50%, #ff4444 100%);
            border-radius: 15px;
            position: relative;
            margin: 10px 0;
        }
        .risk-indicator {
            position: absolute;
            top: -5px;
            width: 20px;
            height: 40px;
            background: #fff;
            border-radius: 5px;
            transform: translateX(-50%);
            transition: left 0.3s;
        }
        
        .logs {
            background: #0a0a15;
            border-radius: 10px;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 11px;
            max-height: 200px;
            overflow-y: auto;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .live-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #00ff88;
            border-radius: 50%;
            animation: pulse 1s infinite;
            margin-right: 10px;
        }
        
        .decision-box {
            background: #252540;
            border-radius: 5px;
            padding: 10px;
            margin: 10px 0;
            font-size: 12px;
        }
        .decision-item {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
        }
        .decision-ok { color: #00ff88; }
        .decision-fail { color: #ff4444; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐉 V5.2 Control Tower</h1>
        <div class="version">Trading Command Center v2.0 | <span class="live-indicator"></span>实时监控</div>
    </div>
    
    <div class="grid">
        <!-- 系统状态 -->
        <div class="card">
            <h2>📊 系统状态</h2>
            <div class="status-item">
                <span class="status-label">Regime</span>
                <span class="status-value" id="regime">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">评分</span>
                <span class="status-value" id="score">-</span>
            </div>
            <div class="score-bar">
                <div class="score-fill" id="score-bar" style="width: 0%"></div>
            </div>
            <div class="status-item">
                <span class="status-label">成交量</span>
                <span class="status-value" id="volume">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">品种</span>
                <span class="status-value" id="symbol">-</span>
            </div>
        </div>
        
        <!-- 决策追踪 -->
        <div class="card">
            <h2>🔍 决策追踪</h2>
            <div class="decision-box">
                <div class="decision-item">
                    <span>评分检查</span>
                    <span id="decision-score">-</span>
                </div>
                <div class="decision-item">
                    <span>成交量检查</span>
                    <span id="decision-volume">-</span>
                </div>
                <div class="decision-item">
                    <span>最终决定</span>
                    <span id="decision-final">-</span>
                </div>
            </div>
            <div class="status-item">
                <span class="status-label">评分拒绝</span>
                <span class="status-value" id="reject-score">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">成交量拒绝</span>
                <span class="status-value" id="reject-volume">-</span>
            </div>
        </div>
        
        <!-- AI 风控 -->
        <div class="card">
            <h2>🧠 AI 风控评分</h2>
            <div class="status-item">
                <span class="status-label">风险等级</span>
                <span class="status-value" id="risk-level">-</span>
            </div>
            <div class="risk-meter">
                <div class="risk-indicator" id="risk-indicator" style="left: 0%"></div>
            </div>
            <div class="status-item">
                <span class="status-label">风险因素</span>
                <span class="status-value" id="risk-factors">-</span>
            </div>
        </div>
        
        <!-- 控制面板 -->
        <div class="card">
            <h2>🎮 控制面板</h2>
            <div class="status-item">
                <span class="status-label">状态</span>
                <span class="status-value" id="control-status">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">模式</span>
                <span class="status-value" id="control-mode">-</span>
            </div>
            <div style="margin-top: 10px;">
                <button class="control-btn btn-enable" onclick="enableTrading()">▶️ 启用</button>
                <button class="control-btn btn-disable" onclick="disableTrading()">⛔ 禁用</button>
            </div>
            <div>
                <button class="control-btn btn-freeze" onclick="freezeSystem()">🚨 冻结</button>
                <button class="control-btn btn-unfreeze" onclick="unfreezeSystem()">❄️ 解冻</button>
            </div>
            <div>
                <button class="control-btn btn-shadow" onclick="setMode('shadow')">🌙 Shadow</button>
                <button class="control-btn btn-live" onclick="setMode('live')">⚡ Live</button>
            </div>
        </div>
    </div>
    
    <!-- 信号漏斗 -->
    <div class="card">
        <h2>🎯 信号漏斗</h2>
        <div id="funnel">加载中...</div>
    </div>
    
    <!-- 日志 -->
    <div class="card">
        <h2>📝 最新日志</h2>
        <div class="logs">
            <pre id="logs">加载中...</pre>
        </div>
    </div>
    
    <script>
        const API_BASE = window.location.origin;
        
        async function fetchData() {
            try {
                // 获取状态
                const statusRes = await fetch(`${API_BASE}/status`);
                const status = await statusRes.json();
                updateStatus(status);
                
                // 获取统计
                const statsRes = await fetch(`${API_BASE}/stats`);
                const stats = await statsRes.json();
                updateStats(stats);
                
                // 获取漏斗
                const funnelRes = await fetch(`${API_BASE}/funnel`);
                const funnelData = await funnelRes.json();
                updateFunnel(funnelData);
                
                // 获取 AI 风控
                const riskRes = await fetch(`${API_BASE}/ai/risk`);
                const riskData = await riskRes.json();
                updateRisk(riskData);
                
                // 获取控制状态
                const controlRes = await fetch(`${API_BASE}/control`);
                const controlData = await controlRes.json();
                updateControl(controlData);
                
                // 获取日志
                const logsRes = await fetch(`${API_BASE}/logs?n=20`);
                const logsData = await logsRes.json();
                updateLogs(logsData.logs);
                
            } catch (e) {
                console.error('Fetch error:', e);
            }
        }
        
        function updateStatus(data) {
            if (data.error) return;
            
            document.getElementById('regime').textContent = (data.regime || '-').toUpperCase();
            document.getElementById('score').textContent = data.score || 0;
            document.getElementById('score').className = data.score >= 80 ? 'status-value status-healthy' : 'status-value';
            document.getElementById('score-bar').style.width = Math.min(data.score || 0, 100) + '%';
            document.getElementById('volume').textContent = (data.volume_ratio || 0).toFixed(2) + 'x';
            document.getElementById('volume').className = (data.volume_ratio || 0) >= 1.2 ? 'status-value status-healthy' : 'status-value';
            document.getElementById('symbol').textContent = data.symbol || '-';
            
            // 决策追踪
            const scoreOk = (data.score || 0) >= 80;
            const volumeOk = (data.volume_ratio || 0) >= 1.2;
            document.getElementById('decision-score').textContent = scoreOk ? '✅ PASS' : '❌ FAIL';
            document.getElementById('decision-score').className = scoreOk ? 'decision-ok' : 'decision-fail';
            document.getElementById('decision-volume').textContent = volumeOk ? '✅ PASS' : '❌ FAIL';
            document.getElementById('decision-volume').className = volumeOk ? 'decision-ok' : 'decision-fail';
            
            const final = scoreOk && volumeOk ? '✅ ACCEPT' : '❌ REJECT';
            document.getElementById('decision-final').textContent = final;
            document.getElementById('decision-final').className = scoreOk && volumeOk ? 'decision-ok' : 'decision-fail';
        }
        
        function updateStats(data) {
            if (!data) return;
            const reject = data.reject_analysis || {};
            document.getElementById('reject-score').textContent = reject.reject_score_pct || '-';
            document.getElementById('reject-volume').textContent = reject.reject_volume_pct || '-';
        }
        
        function updateFunnel(data) {
            if (!data.funnel) {
                document.getElementById('funnel').textContent = '暂无数据';
                return;
            }
            
            let html = '';
            data.funnel.forEach(stage => {
                html += `
                    <div class="funnel-stage">
                        <span class="funnel-name">${stage.stage}</span>
                        <span class="funnel-count">${stage.count}</span>
                        <span class="funnel-rate">${stage.rate}</span>
                    </div>
                `;
            });
            document.getElementById('funnel').innerHTML = html;
        }
        
        function updateRisk(data) {
            const level = data.level || 'UNKNOWN';
            const score = data.score || 0;
            
            document.getElementById('risk-level').textContent = level;
            document.getElementById('risk-level').className = level === 'LOW' ? 'status-value status-healthy' : 
                level === 'MEDIUM' ? 'status-value status-warning' : 'status-value status-danger';
            
            document.getElementById('risk-indicator').style.left = (score * 100) + '%';
            document.getElementById('risk-factors').textContent = (data.factors || []).join(', ') || '正常';
        }
        
        function updateControl(data) {
            const status = data.enabled ? (data.frozen ? '🚨 冻结' : '✅ 运行') : '⛔ 禁用';
            document.getElementById('control-status').textContent = status;
            document.getElementById('control-status').className = data.enabled && !data.frozen ? 'status-value status-healthy' : 'status-value status-danger';
            document.getElementById('control-mode').textContent = data.mode === 'live' ? '⚡ LIVE' : '🌙 SHADOW';
            document.getElementById('control-mode').className = data.mode === 'live' ? 'status-value status-warning' : 'status-value';
        }
        
        function updateLogs(logs) {
            if (!logs || logs.length === 0) {
                document.getElementById('logs').textContent = '暂无日志';
                return;
            }
            document.getElementById('logs').textContent = logs.join('');
        }
        
        // 控制函数
        async function enableTrading() {
            await fetch(`${API_BASE}/control/enable`, { method: 'POST' });
            fetchData();
        }
        
        async function disableTrading() {
            await fetch(`${API_BASE}/control/disable`, { method: 'POST' });
            fetchData();
        }
        
        async function freezeSystem() {
            await fetch(`${API_BASE}/control/freeze`, { method: 'POST' });
            fetchData();
        }
        
        async function unfreezeSystem() {
            await fetch(`${API_BASE}/control/unfreeze`, { method: 'POST' });
            fetchData();
        }
        
        async function setMode(mode) {
            await fetch(`${API_BASE}/control/mode/${mode}`, { method: 'POST' });
            fetchData();
        }
        
        // 初始加载
        fetchData();
        
        // 每 3 秒更新
        setInterval(fetchData, 3000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================
# 启动命令
# ============================================================
if __name__ == "__main__":
    import uvicorn
    print("🚀 V5.2 Control Tower 启动中...")
    print(f"   API: http://localhost:8765")
    print(f"   Dashboard: http://localhost:8765/dashboard")
    print(f"   Level 2: 决策追踪 + 信号漏斗")
    print(f"   Level 3: 控制能力 + AI风控")
    uvicorn.run(app, host="0.0.0.0", port=8765)
# ============================================================
# Market Structure API
# ============================================================
@app.get("/structure")
async def get_market_structure():
    """获取当前市场结构"""
    try:
        # 从最近的 system_state.jsonl 推断市场特征
        states = read_recent_states(10)
        if not states:
            return {"structure": "UNKNOWN", "confidence": 0, "reasons": ["无数据"]}
        
        # 计算特征
        scores = [s.get('score', 0) for s in states]
        volumes = [s.get('volume_ratio', 0) for s in states]
        
        # 价格变化（简化）
        price_changes = []
        for i in range(1, len(states)):
            if states[i-1].get('price') and states[i].get('price'):
                change = abs(states[i]['price'] - states[i-1]['price']) / states[i-1]['price']
                price_changes.append(change)
        
        avg_price_change = sum(price_changes) / len(price_changes) if price_changes else 0
        avg_volume = sum(volumes) / len(volumes) if volumes else 1
        
        # 波动率（简化）
        volatility = (max(scores) - min(scores)) / 100 if scores else 0
        
        # 趋势强度（简化）
        trend_strength = abs(sum(scores[-3:]) - sum(scores[:3])) / 300 if len(scores) >= 6 else 0
        
        # 使用 MarketStructureEngine
        from core.market_structure import MarketStructureEngine
        engine = MarketStructureEngine()
        structure, confidence, reasons = engine.detect(
            price_change=avg_price_change,
            volatility=volatility,
            volume_ratio=avg_volume,
            trend_strength=trend_strength
        )
        
        return {
            "structure": structure.value,
            "confidence": round(confidence, 2),
            "reasons": reasons,
            "features": {
                "price_change": round(avg_price_change * 100, 3),
                "volatility": round(volatility * 100, 3),
                "volume_ratio": round(avg_volume, 2),
                "trend_strength": round(trend_strength, 2)
            }
        }
    except Exception as e:
        return {"error": str(e), "structure": "ERROR", "confidence": 0}

@app.get("/structure/dashboard", response_class=HTMLResponse)
async def structure_dashboard():
    """Market Structure Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🏗️ Market Structure Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .structure-display { text-align:center; padding:30px; font-size:32px; font-weight:bold; }
        .structure-RANGE { color:#00ff88; }
        .structure-TREND { color:#4488ff; }
        .structure-BREAKOUT { color:#ffaa00; }
        .structure-CHAOTIC { color:#ff4444; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .reasons { background:#0a0a15; border-radius:5px; padding:10px; margin-top:10px; font-size:12px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏗️ Market Structure Dashboard</h1>
        <div><span class="live"></span>市场结构识别</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>🎯 当前结构</h2>
            <div class="structure-display" id="structure">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📊 结构特征</h2>
            <div id="features">加载中...</div>
        </div>
        
        <div class="card">
            <h2>💡 交易决策</h2>
            <div id="decision">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📝 检测原因</h2>
        <div class="reasons" id="reasons">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchStructure() {
            try {
                const res = await fetch(`${API}/structure`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('structure').innerHTML = `<span style="color:#ff4444">ERROR</span>`;
                document.getElementById('features').innerHTML = `<div class="stat-item"><span>错误</span><span>${data.error}</span></div>`;
                return;
            }
            
            // 结构显示
            const structure = data.structure;
            document.getElementById('structure').innerHTML = `<span class="structure-${structure}">${structure}</span>`;
            document.getElementById('structure').className = `structure-display`;
            
            // 特征
            const features = data.features || {};
            document.getElementById('features').innerHTML = `
                <div class="stat-item"><span>价格变化</span><span>${(features.price_change || 0).toFixed(3)}%</span></div>
                <div class="stat-item"><span>波动率</span><span>${(features.volatility || 0).toFixed(3)}%</span></div>
                <div class="stat-item"><span>成交量比</span><span>${(features.volume_ratio || 0).toFixed(2)}x</span></div>
                <div class="stat-item"><span>趋势强度</span><span>${(features.trend_strength || 0).toFixed(2)}</span></div>
                <div class="stat-item"><span>置信度</span><span>${(data.confidence || 0).toFixed(2)}</span></div>
            `;
            
            // 决策
            let execute, mode, threshold;
            if (structure === 'CHAOTIC') {
                execute = '❌ 禁止交易';
                mode = 'NO_TRADE';
                threshold = '-';
            } else if (structure === 'BREAKOUT') {
                execute = '✅ 允许';
                mode = 'MOMENTUM';
                threshold = '60';
            } else if (structure === 'TREND') {
                execute = '✅ 允许';
                mode = 'TREND_FOLLOW';
                threshold = '65';
            } else {
                execute = '✅ 允许';
                mode = 'MEAN_REVERSION';
                threshold = '80';
            }
            
            document.getElementById('decision').innerHTML = `
                <div class="stat-item"><span>执行</span><span>${execute}</span></div>
                <div class="stat-item"><span>模式</span><span>${mode}</span></div>
                <div class="stat-item"><span>评分阈值</span><span>${threshold}</span></div>
            `;
            
            // 原因
            const reasons = data.reasons || [];
            document.getElementById('reasons').innerHTML = reasons.map(r => `<div>• ${r}</div>`).join('');
        }
        
        fetchStructure();
        setInterval(fetchStructure, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================
# Structure Prediction API
# ============================================================
@app.get("/structure/predict")
async def get_structure_prediction():
    """获取结构预测"""
    try:
        from core.structure_predictor import StructurePredictor, StructureFeatures
        from core.market_structure import MarketStructure
        
        predictor = StructurePredictor()
        
        # 从最近的 system_state.jsonl 构建历史
        states = read_recent_states(20)
        
        if len(states) < 5:
            return {
                "error": "数据不足",
                "current": "UNKNOWN",
                "predicted": "UNKNOWN",
                "confidence": 0
            }
        
        # 添加历史观察
        for state in states:
            structure_map = {
                "range": MarketStructure.RANGE,
                "trend": MarketStructure.TREND,
                "breakout": MarketStructure.BREAKOUT,
                "chaotic": MarketStructure.CHAOTIC
            }
            
            structure_str = state.get("regime", "range").lower()
            structure = structure_map.get(structure_str, MarketStructure.RANGE)
            
            predictor.add_observation(StructureFeatures(
                structure=structure,
                volatility=state.get("volatility", 0.001),
                volume_ratio=state.get("volume_ratio", 1.0),
                price_change=abs(state.get("price_change", 0)),
                range_width=state.get("range_width", 0.01),
                momentum=state.get("momentum", 0.5)
            ))
        
        # 预测
        result = predictor.predict()
        
        return {
            "current": result.current_structure.value,
            "predicted": result.predicted_structure.value,
            "confidence": round(result.confidence, 2),
            "mode": result.mode.value,
            "scores": {
                "breakout": round(result.breakout_score, 2),
                "trend": round(result.trend_score, 2),
                "exhaustion": round(result.exhaustion_score, 2)
            },
            "signals": result.signals,
            "reasons": result.reasons
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/structure/predict/dashboard", response_class=HTMLResponse)
async def structure_prediction_dashboard():
    """Structure Prediction Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🔮 Structure Prediction Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .prediction-display { text-align:center; padding:20px; }
        .prediction-arrow { font-size:32px; margin:10px 0; }
        .current { font-size:28px; font-weight:bold; color:#888; }
        .predicted { font-size:32px; font-weight:bold; }
        .pred-RANGE { color:#00ff88; }
        .pred-TREND { color:#4488ff; }
        .pred-BREAKOUT { color:#ffaa00; }
        .pred-CHAOTIC { color:#ff4444; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .mode-early { background:#1a3d1a; padding:5px 10px; border-radius:5px; color:#00ff88; }
        .mode-confirm { background:#3d3d1a; padding:5px 10px; border-radius:5px; color:#ffaa00; }
        .signals { background:#0a0a15; border-radius:5px; padding:10px; margin-top:10px; font-size:12px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔮 Structure Prediction Dashboard</h1>
        <div><span class="live"></span>市场结构预测</div>
    </div>
    
    <div class="card">
        <h2>🎯 结构预测</h2>
        <div class="prediction-display">
            <div class="current" id="current">加载中...</div>
            <div class="prediction-arrow">→</div>
            <div class="predicted" id="predicted">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 置信度 & 模式</h2>
            <div id="confidence">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📈 预测分数</h2>
            <div id="scores">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📡 关键信号</h2>
            <div id="signals">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📝 预测原因</h2>
        <div class="signals" id="reasons">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchPrediction() {
            try {
                const res = await fetch(`${API}/structure/predict`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('current').innerHTML = `<span style="color:#ff4444">ERROR</span>`;
                document.getElementById('predicted').innerHTML = `<span style="color:#ff4444">${data.error}</span>`;
                return;
            }
            
            // 当前结构
            const current = data.current || 'RANGE';
            document.getElementById('current').textContent = current;
            
            // 预测结构
            const predicted = data.predicted || 'RANGE';
            document.getElementById('predicted').innerHTML = `<span class="pred-${predicted}">${predicted}</span>`;
            
            // 置信度 & 模式
            const confidence = (data.confidence || 0) * 100;
            const mode = data.mode || 'CONFIRMATION';
            const modeClass = mode === 'EARLY_ENTRY' ? 'mode-early' : 'mode-confirm';
            const modeText = mode === 'EARLY_ENTRY' ? '⚡ 提前模式' : '🔒 确认模式';
            
            document.getElementById('confidence').innerHTML = `
                <div class="stat-item"><span>置信度</span><span>${confidence.toFixed(0)}%</span></div>
                <div class="stat-item"><span>交易模式</span><span class="${modeClass}">${modeText}</span></div>
            `;
            
            // 分数
            const scores = data.scores || {};
            document.getElementById('scores').innerHTML = `
                <div class="stat-item"><span>突破概率</span><span>${((scores.breakout || 0) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>趋势延续</span><span>${((scores.trend || 0) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>耗竭概率</span><span>${((scores.exhaustion || 0) * 100).toFixed(0)}%</span></div>
            `;
            
            // 信号
            const signals = data.signals || {};
            document.getElementById('signals').innerHTML = `
                <div class="stat-item"><span>波动趋势</span><span>${signals.volatility || '-'}</span></div>
                <div class="stat-item"><span>成交量趋势</span><span>${signals.volume || '-'}</span></div>
                <div class="stat-item"><span>区间状态</span><span>${signals.range || '-'}</span></div>
                <div class="stat-item"><span>假突破次数</span><span>${signals.fake_breakouts || '0'}</span></div>
            `;
            
            // 原因
            const reasons = data.reasons || [];
            document.getElementById('reasons').innerHTML = reasons.map(r => `<div>• ${r}</div>`).join('');
        }
        
        fetchPrediction();
        setInterval(fetchPrediction, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================
# Meta Controller API (V10 系统大脑)
# ============================================================
@app.get("/meta")
async def get_meta_status():
    """获取元控制器状态"""
    try:
        from core.meta_controller import MetaController, SystemState
        
        # 创建或获取实例
        meta = MetaController()
        
        # 读取最近的状态
        states = read_recent_states(20)
        
        if states:
            # 计算上下文
            risk_data = await get_ai_risk()
            structure_data = await get_market_structure()
            
            # 历史胜率
            wins = sum(1 for s in states if s.get('pnl', 0) > 0)
            total = sum(1 for s in states if 'pnl' in s)
            win_rate = wins / max(1, total)
            
            # 平均执行质量
            qualities = [s.get('execution_quality', 1) for s in states if 'execution_quality' in s]
            avg_quality = sum(qualities) / len(qualities) if qualities else 1.0
            
            # 评估
            context = {
                "risk_score": risk_data.get("score", 0),
                "structure": structure_data.get("structure", "RANGE"),
                "memory_stats": {
                    "win_rate": win_rate,
                    "recent_pnl": states[-1].get('total_pnl', 0) if states else 0
                },
                "execution_quality": avg_quality,
                "pnl": states[-1].get('pnl', 0) if states else 0,
                "slippage": states[-1].get('slippage', 0) if states else 0,
                "delay_ms": states[-1].get('delay_ms', 0) if states else 0
            }
            
            result = meta.evaluate(context)
            
            return {
                "state": result["state"],
                "emoji": meta._get_state_emoji(),
                "decision": result["decision"],
                "position_multiplier": result["position_multiplier"],
                "action": result["action"],
                "reasons": result["reasons"],
                "trigger": result.get("trigger", "-"),
                "daily_stats": {
                    "pnl": meta.daily_stats.pnl,
                    "trade_count": meta.daily_stats.trade_count,
                    "win_count": meta.daily_stats.win_count,
                    "loss_count": meta.daily_stats.loss_count,
                    "consecutive_losses": meta.daily_stats.consecutive_losses,
                    "win_rate": win_rate
                },
                "config": {
                    "daily_loss_limit": meta.config.daily_loss_limit,
                    "consecutive_loss_limit": meta.config.consecutive_loss_limit,
                    "execution_quality_min": meta.config.execution_quality_min
                },
                "timestamp": datetime.now().isoformat()
            }
        
        return meta.get_meta_status()
    
    except Exception as e:
        return {"error": str(e), "state": "ERROR", "emoji": "🔴"}


@app.get("/meta/evaluate")
async def meta_evaluate():
    """实时评估系统状态"""
    try:
        from core.meta_controller import MetaController
        
        meta = MetaController()
        
        # 获取所有需要的上下文
        risk_data = await get_ai_risk()
        structure_data = await get_market_structure()
        states = read_recent_states(30)
        
        # 计算历史统计
        wins = sum(1 for s in states if s.get('pnl', 0) > 0)
        total = sum(1 for s in states if 'pnl' in s)
        win_rate = wins / max(1, total)
        
        qualities = [s.get('execution_quality', 1) for s in states if 'execution_quality' in s]
        avg_quality = sum(qualities) / len(qualities) if qualities else 1.0
        
        slippages = [s.get('slippage', 0) for s in states if 'slippage' in s]
        avg_slippage = sum(slippages) / len(slippages) if slippages else 0
        
        delays = [s.get('delay_ms', 0) for s in states if 'delay_ms' in s]
        avg_delay = sum(delays) / len(delays) if delays else 0
        
        # 构建评估上下文
        context = {
            "risk_score": risk_data.get("score", 0),
            "structure": structure_data.get("structure", "RANGE"),
            "memory_stats": {
                "win_rate": win_rate,
                "recent_pnl": states[-1].get('total_pnl', 0) if states else 0
            },
            "execution_quality": avg_quality,
            "pnl": 0,
            "slippage": avg_slippage,
            "delay_ms": avg_delay
        }
        
        result = meta.evaluate(context)
        
        return {
            "result": result,
            "context": context,
            "components": {
                "risk": risk_data,
                "structure": structure_data
            }
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.post("/meta/state/{state}")
async def set_meta_state(state: str):
    """手动设置系统状态"""
    try:
        from core.meta_controller import MetaController, SystemState
        
        meta = MetaController()
        
        state_map = {
            "NORMAL": SystemState.NORMAL,
            "CAUTION": SystemState.CAUTION,
            "DEFENSIVE": SystemState.DEFENSIVE,
            "SLEEP": SystemState.SLEEP
        }
        
        if state.upper() not in state_map:
            return {"error": f"无效状态: {state}", "valid_states": list(state_map.keys())}
        
        result = meta.force_state(state_map[state.upper()], reason="API_REQUEST")
        return {"status": "ok", **result}
    
    except Exception as e:
        return {"error": str(e)}


@app.post("/meta/reset")
async def reset_meta():
    """重置元控制器"""
    try:
        from core.meta_controller import MetaController
        
        meta = MetaController()
        meta.reset()
        
        return {"status": "ok", "message": "Meta Controller 已重置"}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta/history")
async def get_meta_history(n: int = 20):
    """获取决策历史"""
    try:
        from core.meta_controller import MetaController
        
        meta = MetaController()
        history = meta.get_decision_history(n)
        
        return {"count": len(history), "history": history}
    
    except Exception as e:
        return {"error": str(e), "history": []}


@app.get("/meta/dashboard", response_class=HTMLResponse)
async def meta_dashboard():
    """Meta Controller Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧠 Meta Controller Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .state-display { text-align:center; padding:40px; font-size:48px; font-weight:bold; margin:20px 0; }
        .state-NORMAL { color:#00ff88; }
        .state-CAUTION { color:#ffaa00; }
        .state-DEFENSIVE { color:#ff8844; }
        .state-SLEEP { color:#ff4444; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .action-box { background:#0a0a15; border-radius:10px; padding:20px; text-align:center; margin:20px 0; }
        .action-text { font-size:18px; margin-bottom:10px; }
        .position-bar { height:30px; background:#252540; border-radius:15px; overflow:hidden; margin:10px 0; }
        .position-fill { height:100%; background:linear-gradient(90deg,#00ff88,#00cc66); transition:width 0.3s; }
        .reasons { background:#0a0a15; border-radius:5px; padding:15px; margin-top:10px; }
        .reason-item { padding:5px 0; border-bottom:1px solid #252540; }
        .control-btn { padding:10px 20px; border:none; border-radius:5px; cursor:pointer; font-size:13px; margin:5px; transition:all 0.2s; }
        .btn-normal { background:#00ff88; color:#000; }
        .btn-caution { background:#ffaa00; color:#000; }
        .btn-defensive { background:#ff8844; color:#000; }
        .btn-sleep { background:#ff4444; color:#fff; }
        .btn-reset { background:#4488ff; color:#fff; }
        .control-btn:hover { opacity:0.8; transform:scale(1.02); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Meta Controller Dashboard</h1>
        <div><span class="live"></span>系统大脑 - V10 元控制器</div>
    </div>
    
    <div class="card">
        <h2>🎯 系统状态</h2>
        <div class="state-display" id="state-emoji">加载中...</div>
        <div class="action-box">
            <div class="action-text" id="action">-</div>
            <div class="position-bar">
                <div class="position-fill" id="position-bar" style="width:100%"></div>
            </div>
            <div>仓位乘数: <strong id="multiplier">-</strong></div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 每日统计</h2>
            <div id="daily-stats">加载中...</div>
        </div>
        
        <div class="card">
            <h2>⚙️ 系统配置</h2>
            <div id="config">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🎮 手动控制</h2>
            <div>
                <button class="control-btn btn-normal" onclick="setState('NORMAL')">🟢 正常</button>
                <button class="control-btn btn-caution" onclick="setState('CAUTION')">🟡 谨慎</button>
            </div>
            <div>
                <button class="control-btn btn-defensive" onclick="setState('DEFENSIVE')">🟠 防御</button>
                <button class="control-btn btn-sleep" onclick="setState('SLEEP')">🔴 休眠</button>
            </div>
            <div>
                <button class="control-btn btn-reset" onclick="resetMeta()">🔄 重置</button>
            </div>
        </div>
    </div>
    
    <div class="card">
        <h2>📝 状态原因</h2>
        <div class="reasons" id="reasons">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchMeta() {
            try {
                const res = await fetch(`${API}/meta`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('state-emoji').innerHTML = `<span class="state-SLEEP">ERROR</span>`;
                document.getElementById('action').textContent = data.error;
                return;
            }
            
            // 状态显示
            const state = data.state || 'NORMAL';
            const emoji = data.emoji || '🟢';
            document.getElementById('state-emoji').innerHTML = `<span class="state-${state}">${emoji} ${state}</span>`;
            
            // 动作
            document.getElementById('action').textContent = data.action || '-';
            
            // 仓位乘数
            const multiplier = data.position_multiplier || 1.0;
            document.getElementById('multiplier').textContent = multiplier.toFixed(1);
            document.getElementById('position-bar').style.width = (multiplier * 100) + '%';
            
            // 每日统计
            const daily = data.daily_stats || {};
            const winRate = daily.win_rate || 0;
            document.getElementById('daily-stats').innerHTML = `
                <div class="stat-item"><span>今日盈亏</span><span style="color:${daily.pnl >= 0 ? '#00ff88' : '#ff4444'}">${(daily.pnl * 100).toFixed(2)}%</span></div>
                <div class="stat-item"><span>交易次数</span><span>${daily.trade_count || 0}</span></div>
                <div class="stat-item"><span>胜/负</span><span>${daily.win_count || 0} / ${daily.loss_count || 0}</span></div>
                <div class="stat-item"><span>胜率</span><span style="color:${winRate >= 0.5 ? '#00ff88' : '#ffaa00'}">${(winRate * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>连续亏损</span><span style="color:${(daily.consecutive_losses || 0) >= 2 ? '#ff4444' : '#00ff88'}">${daily.consecutive_losses || 0}</span></div>
            `;
            
            // 配置
            const config = data.config || {};
            document.getElementById('config').innerHTML = `
                <div class="stat-item"><span>每日亏损限制</span><span>${(config.daily_loss_limit * 100).toFixed(1)}%</span></div>
                <div class="stat-item"><span>连续亏损限制</span><span>${config.consecutive_loss_limit} 笔</span></div>
                <div class="stat-item"><span>执行质量阈值</span><span>${config.execution_quality_min.toFixed(2)}</span></div>
            `;
            
            // 原因
            const reasons = data.reasons || [];
            if (reasons.length > 0) {
                document.getElementById('reasons').innerHTML = reasons.map(r => 
                    `<div class="reason-item">• ${r}</div>`
                ).join('');
            } else {
                document.getElementById('reasons').innerHTML = '<div style="color:#888">系统正常运行</div>';
            }
        }
        
        async function setState(state) {
            try {
                await fetch(`${API}/meta/state/${state}`, { method: 'POST' });
                fetchMeta();
            } catch(e) {
                console.error(e);
            }
        }
        
        async function resetMeta() {
            try {
                await fetch(`${API}/meta/reset`, { method: 'POST' });
                fetchMeta();
            } catch(e) {
                console.error(e);
            }
        }
        
        fetchMeta();
        setInterval(fetchMeta, 3000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================
# Regime Memory API (V9 市场记忆)
# ============================================================
@app.get("/regime-memory")
async def get_regime_memory():
    """获取市场记忆状态"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        
        return {
            "stats": memory.get_overall_stats(),
            "buckets": memory.get_all_buckets(),
            "worst_environments": memory.get_worst_environments(5),
            "best_environments": memory.get_best_environments(5),
            "config": {
                "min_samples": memory.config.min_samples,
                "win_rate_threshold": memory.config.win_rate_threshold,
                "avg_pnl_threshold": memory.config.avg_pnl_threshold
            }
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/regime-memory/check")
async def check_regime_memory(
    structure: str = "RANGE",
    volatility: float = 0.01,
    volume_ratio: float = 1.0,
    risk_level: str = "LOW"
):
    """检查当前环境是否应该交易"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        
        should, info = memory.should_trade(
            structure=structure,
            volatility=volatility,
            volume_ratio=volume_ratio,
            risk_level=risk_level
        )
        
        recommendation = memory.get_recommendation(
            structure=structure,
            volatility=volatility,
            volume_ratio=volume_ratio,
            risk_level=risk_level
        )
        
        return {
            "should_trade": should,
            "info": info,
            "recommendation": recommendation
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/regime-memory/buckets")
async def get_regime_buckets():
    """获取所有环境桶统计"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        return memory.get_all_buckets()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/regime-memory/worst")
async def get_worst_environments(n: int = 5):
    """获取表现最差的环境"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        return memory.get_worst_environments(n)
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/regime-memory/best")
async def get_best_environments(n: int = 5):
    """获取表现最好的环境"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        return memory.get_best_environments(n)
    
    except Exception as e:
        return {"error": str(e)}


@app.post("/regime-memory/clear")
async def clear_regime_memory():
    """清空市场记忆"""
    try:
        from core.regime_memory import RegimeMemory
        
        memory = RegimeMemory()
        memory.clear()
        
        return {"status": "ok", "message": "Regime Memory 已清空"}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/regime-memory/dashboard", response_class=HTMLResponse)
async def regime_memory_dashboard():
    """Regime Memory Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧠 Regime Memory Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .env-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        .env-header { display:flex; justify-content:space-between; margin-bottom:5px; }
        .env-structure { font-weight:bold; color:#00ff88; }
        .env-status { padding:2px 8px; border-radius:3px; font-size:11px; }
        .status-OK { background:#1a3d1a; color:#00ff88; }
        .status-WARNING { background:#3d3d1a; color:#ffaa00; }
        .status-BLOCKED { background:#3d1a1a; color:#ff4444; }
        .status-INSUFFICIENT_DATA { background:#252540; color:#888; }
        .check-box { background:#0a0a15; border-radius:10px; padding:20px; margin:20px 0; }
        .check-result { text-align:center; font-size:24px; padding:20px; }
        .result-allow { color:#00ff88; }
        .result-block { color:#ff4444; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Regime Memory Dashboard</h1>
        <div><span class="live"></span>市场记忆系统 - V9</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 总体统计</h2>
            <div id="stats">加载中...</div>
        </div>
        
        <div class="card">
            <h2>⚙️ 配置</h2>
            <div id="config">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>🔴 表现最差的环境（自动禁止）</h2>
        <div id="worst">加载中...</div>
    </div>
    
    <div class="card">
        <h2>🟢 表现最好的环境</h2>
        <div id="best">加载中...</div>
    </div>
    
    <div class="card">
        <h2>📋 所有环境桶</h2>
        <div id="buckets">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchMemory() {
            try {
                const res = await fetch(`${API}/regime-memory`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('stats').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                return;
            }
            
            // 统计
            const stats = data.stats || {};
            const winRate = stats.win_rate || 0;
            document.getElementById('stats').innerHTML = `
                <div class="stat-item"><span>总交易</span><span>${stats.total_trades || 0} 笔</span></div>
                <div class="stat-item"><span>胜/负</span><span>${stats.wins || 0} / ${stats.losses || 0}</span></div>
                <div class="stat-item"><span>胜率</span><span style="color:${winRate >= 0.5 ? '#00ff88' : '#ffaa00'}">${(winRate * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>平均收益</span><span style="color:${(stats.avg_pnl || 0) >= 0 ? '#00ff88' : '#ff4444'}">${((stats.avg_pnl || 0) * 100).toFixed(3)}%</span></div>
                <div class="stat-item"><span>环境桶</span><span>${stats.buckets || 0} 个</span></div>
            `;
            
            // 配置
            const config = data.config || {};
            document.getElementById('config').innerHTML = `
                <div class="stat-item"><span>最少样本</span><span>${config.min_samples || 10} 笔</span></div>
                <div class="stat-item"><span>胜率阈值</span><span>${((config.win_rate_threshold || 0.4) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>收益阈值</span><span>${((config.avg_pnl_threshold || 0) * 100).toFixed(1)}%</span></div>
            `;
            
            // 最差环境
            const worst = data.worst_environments || [];
            if (worst.length > 0) {
                document.getElementById('worst').innerHTML = worst.map(w => {
                    const env = w.environment;
                    return `
                        <div class="env-item">
                            <div class="env-header">
                                <span class="env-structure">${env[0]}</span>
                                <span class="env-status status-BLOCKED">BLOCKED</span>
                            </div>
                            <div style="font-size:12px;color:#888">
                                波动: ${env[1]} | 成交量: ${env[2]} | 风险: ${env[3]}
                            </div>
                            <div style="margin-top:5px">
                                样本: ${w.count} | 胜率: ${(w.win_rate * 100).toFixed(0)}% | 收益: ${(w.avg_pnl * 100).toFixed(2)}%
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('worst').innerHTML = '<div style="color:#888">暂无数据</div>';
            }
            
            // 最好环境
            const best = data.best_environments || [];
            if (best.length > 0) {
                document.getElementById('best').innerHTML = best.map(w => {
                    const env = w.environment;
                    return `
                        <div class="env-item">
                            <div class="env-header">
                                <span class="env-structure">${env[0]}</span>
                                <span class="env-status status-OK">OK</span>
                            </div>
                            <div style="font-size:12px;color:#888">
                                波动: ${env[1]} | 成交量: ${env[2]} | 风险: ${env[3]}
                            </div>
                            <div style="margin-top:5px">
                                样本: ${w.count} | 胜率: ${(w.win_rate * 100).toFixed(0)}% | 收益: ${(w.avg_pnl * 100).toFixed(2)}%
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('best').innerHTML = '<div style="color:#888">暂无数据</div>';
            }
            
            // 所有桶
            const buckets = data.buckets || {};
            const bucketList = Object.values(buckets);
            if (bucketList.length > 0) {
                document.getElementById('buckets').innerHTML = bucketList.map(b => {
                    const statusClass = b.status === 'OK' ? 'status-OK' : 
                                       b.status === 'WARNING' ? 'status-WARNING' : 
                                       b.status === 'BLOCKED' ? 'status-BLOCKED' : 'status-INSUFFICIENT_DATA';
                    return `
                        <div class="env-item">
                            <div class="env-header">
                                <span>${b.structure} | ${b.volatility} | ${b.volume} | ${b.risk_level}</span>
                                <span class="env-status ${statusClass}">${b.status}</span>
                            </div>
                            <div style="margin-top:5px;font-size:12px">
                                样本: ${b.count} | 胜率: ${(b.win_rate * 100).toFixed(0)}% | 收益: ${b.avg_pnl.toFixed(3)}%
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('buckets').innerHTML = '<div style="color:#888">暂无数据</div>';
            }
        }
        
        fetchMemory();
        setInterval(fetchMemory, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Portfolio Brain API (V11 全局资金大脑)
# ============================================================
@app.get("/portfolio")
async def get_portfolio():
    """获取资金大脑状态"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        
        return brain.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/allocate")
async def allocate_portfolio():
    """获取资金分配"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        
        # 注册默认策略
        brain.update_strategy_score("v52", 0.8)
        brain.update_strategy_score("trend", 0.6)
        brain.update_strategy_score("breakout", 0.4)
        
        allocation = brain.allocate()
        
        return {
            "total_equity": brain.equity,
            "allocation": allocation,
            "strategies": {
                name: {
                    "score": info.score,
                    "capital": info.capital,
                    "enabled": info.enabled
                }
                for name, info in brain.strategies.items()
            }
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/risk")
async def check_portfolio_risk(daily_pnl: float = None):
    """检查资金风险"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        action, info = brain.risk_check(daily_pnl)
        
        return {
            "action": action.value,
            "info": info,
            "state": brain.get_state().value
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/exposure")
async def check_portfolio_exposure():
    """检查风险敞口"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        status, info = brain.check_exposure()
        
        return {
            "status": status,
            "info": info,
            "positions": brain.get_position_summary()
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/resolve")
async def resolve_conflicts():
    """解决多策略冲突"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        
        # 模拟冲突
        signals = [
            {"strategy": "v52", "symbol": "BTC", "direction": 1, "size": 100},
            {"strategy": "trend", "symbol": "BTC", "direction": -1, "size": 80}
        ]
        
        result, info = brain.resolve_conflict(signals)
        
        return {
            "signals": signals,
            "result": result,
            "conflict_log": brain.conflict_log[-5:] if brain.conflict_log else []
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/state")
async def get_portfolio_state():
    """获取资金状态机"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        
        return {
            "state": brain.get_state().value,
            "behavior": brain.get_state_behavior(),
            "drawdown": brain._calculate_drawdown(),
            "daily_pnl": brain.daily_pnl
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.post("/portfolio/reset")
async def reset_portfolio():
    """重置资金系统"""
    try:
        from core.portfolio_brain import PortfolioBrain
        
        brain = PortfolioBrain()
        brain.reset()
        
        return {"status": "ok", "message": "Portfolio Brain 已重置"}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/portfolio/dashboard", response_class=HTMLResponse)
async def portfolio_dashboard():
    """Portfolio Brain Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧠 Portfolio Brain Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .big-number { font-size:36px; text-align:center; padding:20px; }
        .state-box { text-align:center; padding:20px; margin:10px 0; border-radius:10px; }
        .state-NORMAL { background:#1a3d1a; }
        .state-CAUTION { background:#3d3d1a; }
        .state-PROTECTION { background:#3d2a1a; }
        .state-STOP { background:#3d1a1a; }
        .strategy-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        .strategy-header { display:flex; justify-content:space-between; margin-bottom:5px; }
        .strategy-name { font-weight:bold; color:#00ff88; }
        .bar-container { background:#252540; border-radius:3px; height:8px; margin:5px 0; }
        .bar-fill { height:100%; border-radius:3px; }
        .bar-green { background:#00ff88; }
        .bar-yellow { background:#ffaa00; }
        .bar-red { background:#ff4444; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Portfolio Brain Dashboard</h1>
        <div><span class="live"></span>全局资金大脑 - V11</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>💰 资金状态</h2>
            <div id="equity">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📊 系统状态</h2>
            <div id="state">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>⚙️ 策略分配</h2>
            <div id="allocation">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🛡️ 风险控制</h2>
            <div id="risk">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📈 持仓概览</h2>
        <div id="positions">加载中...</div>
    </div>
    
    <div class="card">
        <h2>🎯 行为建议</h2>
        <div id="behavior">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchPortfolio() {
            try {
                const res = await fetch(`${API}/portfolio`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('equity').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                return;
            }
            
            // 资金状态
            const pnlColor = (data.daily_pnl || 0) >= 0 ? '#00ff88' : '#ff4444';
            const ddColor = (data.drawdown || 0) < 2 ? '#00ff88' : (data.drawdown < 4 ? '#ffaa00' : '#ff4444');
            document.getElementById('equity').innerHTML = `
                <div class="big-number" style="color:#00ff88">$${data.total_equity || 0}</div>
                <div class="stat-item"><span>峰值资金</span><span>$${data.peak_equity || 0}</span></div>
                <div class="stat-item"><span>今日盈亏</span><span style="color:${pnlColor}">${data.daily_pnl || 0}% ($${data.daily_pnl_usd || 0})</span></div>
                <div class="stat-item"><span>当前回撤</span><span style="color:${ddColor}">${data.drawdown || 0}%</span></div>
                <div class="stat-item"><span>今日交易</span><span>${data.trades_today || 0} 笔</span></div>
            `;
            
            // 系统状态
            const state = data.state || 'UNKNOWN';
            const stateColors = {
                'NORMAL': '#00ff88',
                'CAUTION': '#ffaa00',
                'PROTECTION': '#ff8800',
                'STOP': '#ff4444'
            };
            const stateNames = {
                'NORMAL': '正常',
                'CAUTION': '警告',
                'PROTECTION': '保护',
                'STOP': '停止'
            };
            document.getElementById('state').innerHTML = `
                <div class="state-box state-${state}">
                    <div style="font-size:28px;font-weight:bold;color:${stateColors[state] || '#888'}">${stateNames[state] || state}</div>
                    <div style="margin-top:10px;font-size:12px">系统状态: ${state}</div>
                </div>
            `;
            
            // 策略分配
            const strategies = data.strategies || {};
            const stratList = Object.entries(strategies);
            if (stratList.length > 0) {
                const totalCapital = Object.values(strategies).reduce((sum, s) => sum + (s.capital || 0), 0);
                document.getElementById('allocation').innerHTML = stratList.map(([name, info]) => {
                    const pct = totalCapital > 0 ? (info.capital / totalCapital * 100) : 0;
                    const scorePct = (info.score || 0) * 100;
                    const scoreColor = scorePct >= 70 ? 'bar-green' : (scorePct >= 50 ? 'bar-yellow' : 'bar-red');
                    return `
                        <div class="strategy-item">
                            <div class="strategy-header">
                                <span class="strategy-name">${name}</span>
                                <span style="color:${info.enabled ? '#00ff88' : '#888'}">${info.enabled ? '启用' : '禁用'}</span>
                            </div>
                            <div style="font-size:12px;color:#888;margin-bottom:5px">评分: ${scorePct.toFixed(0)}%</div>
                            <div class="bar-container"><div class="bar-fill ${scoreColor}" style="width:${scorePct}%"></div></div>
                            <div style="margin-top:5px">分配: $${(info.capital || 0).toFixed(2)} (${pct.toFixed(0)}%)</div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('allocation').innerHTML = '<div style="color:#888">暂无策略</div>';
            }
            
            // 风险控制
            const risk = data.risk || {};
            const riskColor = risk.action === 'CONTINUE' ? '#00ff88' : (risk.action === 'REDUCE' ? '#ffaa00' : '#ff4444');
            document.getElementById('risk').innerHTML = `
                <div class="stat-item"><span>风险动作</span><span style="color:${riskColor}">${risk.action || 'UNKNOWN'}</span></div>
                <div class="stat-item"><span>原因</span><span>${risk.reason || '-'}</span></div>
                ${risk.message ? `<div class="stat-item" style="color:${riskColor}"><span>信息</span><span>${risk.message}</span></div>` : ''}
            `;
            
            // 持仓概览
            const positions = data.positions || {};
            document.getElementById('positions').innerHTML = `
                <div class="stat-item"><span>总持仓</span><span>${positions.total_positions || 0} 笔</span></div>
                <div class="stat-item"><span>多头/空头</span><span>${positions.long_count || 0} / ${positions.short_count || 0}</span></div>
                <div class="stat-item"><span>总敞口</span><span>$${(positions.total_exposure || 0).toFixed(2)} (${((positions.exposure_ratio || 0)).toFixed(1)}x)</span></div>
                <div class="stat-item"><span>净敞口</span><span>$${(positions.net_exposure || 0).toFixed(2)}</span></div>
                <div class="stat-item"><span>持仓盈亏</span><span style="color:${(positions.total_pnl || 0) >= 0 ? '#00ff88' : '#ff4444'}">$${(positions.total_pnl || 0).toFixed(2)}</span></div>
            `;
            
            // 行为建议
            const behavior = data.behavior || {};
            document.getElementById('behavior').innerHTML = `
                <div class="stat-item"><span>运行模式</span><span>${behavior.mode || '-'}</span></div>
                <div class="stat-item"><span>最大仓位</span><span>${((behavior.max_position || 1) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>质量阈值</span><span>${((behavior.quality_threshold || 0.5) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>建议动作</span><span>${behavior.actions || '-'}</span></div>
            `;
        }
        
        fetchPortfolio();
        setInterval(fetchPortfolio, 3000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Liquidity Engine API (V12 流动性感知)
# ============================================================
@app.get("/liquidity")
async def get_liquidity():
    """获取流动性状态"""
    try:
        from core.liquidity_engine import LiquidityEngine
        
        engine = LiquidityEngine()
        
        return {
            "status": engine.get_status(),
            "summary": engine.get_summary()
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/liquidity/analyze")
async def analyze_liquidity(
    symbol: str = "BTC/USDT",
    order_size: float = 0.1,
    side: str = "BUY"
):
    """分析流动性"""
    try:
        from core.liquidity_engine import LiquidityEngine, OrderbookSnapshot
        from datetime import datetime
        
        engine = LiquidityEngine()
        
        # 创建模拟订单簿（实际使用时从交易所获取）
        mid_price = 50000 if "BTC" in symbol else 2000
        spread_pct = 0.0002
        
        orderbook = OrderbookSnapshot(
            timestamp=datetime.now().isoformat(),
            symbol=symbol,
            bids=[
                (mid_price * (1 - spread_pct * (i + 1)), 2 + i * 0.5)
                for i in range(5)
            ],
            asks=[
                (mid_price * (1 + spread_pct * (i + 1)), 2 + i * 0.5)
                for i in range(5)
            ]
        )
        
        analysis = engine.analyze(orderbook, order_size, side)
        
        return {
            "symbol": analysis.symbol,
            "spread_bps": round(analysis.spread_bps, 2),
            "bid_depth": round(analysis.bid_depth, 2),
            "ask_depth": round(analysis.ask_depth, 2),
            "total_depth": round(analysis.total_depth, 2),
            "estimated_slippage_bps": round(analysis.estimated_slippage_bps, 2),
            "liquidity_score": round(analysis.liquidity_score, 2),
            "liquidity_type": analysis.liquidity_type.value,
            "action": analysis.action.value,
            "recommended_size": round(analysis.recommended_size, 4),
            "max_position": round(analysis.max_position, 4),
            "warnings": analysis.warnings
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/liquidity/check")
async def check_liquidity(
    symbol: str = "BTC/USDT",
    order_size: float = 0.1,
    side: str = "BUY"
):
    """交易前流动性检查"""
    try:
        from core.liquidity_engine import LiquidityEngine
        
        engine = LiquidityEngine()
        can_trade, info = engine.pre_trade_check(symbol, order_size, side)
        
        return {
            "can_trade": can_trade,
            "info": info
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/liquidity/status")
async def get_liquidity_status():
    """获取流动性引擎状态"""
    try:
        from core.liquidity_engine import LiquidityEngine
        
        engine = LiquidityEngine()
        
        return engine.get_status()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/liquidity/dashboard", response_class=HTMLResponse)
async def liquidity_dashboard():
    """Liquidity Engine Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🌊 Liquidity Engine Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00aaff; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00aaff; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .liquidity-box { text-align:center; padding:20px; margin:10px 0; border-radius:10px; }
        .type-THICK { background:#1a3d1a; }
        .type-MEDIUM { background:#3d3d1a; }
        .type-THIN { background:#3d1a1a; }
        .type-FAKE { background:#2a1a2a; border:2px solid #ff4444; }
        .big-score { font-size:48px; font-weight:bold; margin:20px 0; }
        .score-good { color:#00ff88; }
        .score-medium { color:#ffaa00; }
        .score-bad { color:#ff4444; }
        .warning-item { background:#2a2020; border-left:3px solid #ff4444; padding:10px; margin:5px 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00aaff; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌊 Liquidity Engine Dashboard</h1>
        <div><span class="live"></span>流动性感知系统 - V12</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 流动性评分</h2>
            <div id="score">加载中...</div>
        </div>
        
        <div class="card">
            <h2>💧 深度分析</h2>
            <div id="depth">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📉 冲击成本</h2>
            <div id="impact">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🎯 交易决策</h2>
            <div id="decision">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>⚠️ 警告信息</h2>
        <div id="warnings">加载中...</div>
    </div>
    
    <div class="card">
        <h2>⚙️ 引擎配置</h2>
        <div id="config">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchLiquidity() {
            try {
                const res = await fetch(`${API}/liquidity/analyze?symbol=BTC/USDT&order_size=0.5`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('score').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                return;
            }
            
            // 评分
            const score = data.liquidity_score || 0;
            const scoreClass = score >= 0.8 ? 'score-good' : (score >= 0.5 ? 'score-medium' : 'score-bad');
            const typeClass = `type-${data.liquidity_type || 'THIN'}`;
            const typeNames = {
                'THICK': '厚流动性',
                'MEDIUM': '中等流动性',
                'THIN': '薄流动性',
                'FAKE': '假流动性'
            };
            document.getElementById('score').innerHTML = `
                <div class="big-score ${scoreClass}">${(score * 100).toFixed(0)}</div>
                <div class="liquidity-box ${typeClass}">
                    <div style="font-size:20px;font-weight:bold">${typeNames[data.liquidity_type] || data.liquidity_type}</div>
                </div>
            `;
            
            // 深度
            document.getElementById('depth').innerHTML = `
                <div class="stat-item"><span>点差</span><span>${data.spread_bps || 0} bps</span></div>
                <div class="stat-item"><span>买单深度</span><span>${data.bid_depth || 0} BTC</span></div>
                <div class="stat-item"><span>卖单深度</span><span>${data.ask_depth || 0} BTC</span></div>
                <div class="stat-item"><span>总深度</span><span>${data.total_depth || 0} BTC</span></div>
            `;
            
            // 冲击成本
            const slipColor = (data.estimated_slippage_bps || 0) < 5 ? '#00ff88' : ((data.estimated_slippage_bps || 0) < 10 ? '#ffaa00' : '#ff4444');
            document.getElementById('impact').innerHTML = `
                <div class="stat-item"><span>预估滑点</span><span style="color:${slipColor}">${data.estimated_slippage_bps || 0} bps</span></div>
                <div class="stat-item"><span>滑点阈值</span><span>5 bps</span></div>
                <div class="stat-item"><span>状态</span><span style="color:${slipColor}">${(data.estimated_slippage_bps || 0) < 5 ? 'OK' : 'WARNING'}</span></div>
            `;
            
            // 决策
            const actionColors = {
                'FULL_SIZE': '#00ff88',
                'REDUCED_SIZE': '#ffaa00',
                'NO_TRADE': '#ff4444',
                'REJECT': '#ff4444'
            };
            const actionNames = {
                'FULL_SIZE': '全仓执行',
                'REDUCED_SIZE': '减半执行',
                'NO_TRADE': '禁止交易',
                'REJECT': '拒绝'
            };
            const actionColor = actionColors[data.action] || '#888';
            document.getElementById('decision').innerHTML = `
                <div class="stat-item"><span>决策</span><span style="color:${actionColor};font-size:18px">${actionNames[data.action] || data.action}</span></div>
                <div class="stat-item"><span>建议仓位</span><span>${(data.recommended_size || 0).toFixed(4)} BTC</span></div>
                <div class="stat-item"><span>最大仓位</span><span>${(data.max_position || 0).toFixed(4)} BTC</span></div>
            `;
            
            // 警告
            const warnings = data.warnings || [];
            if (warnings.length > 0) {
                document.getElementById('warnings').innerHTML = warnings.map(w => 
                    `<div class="warning-item">${w}</div>`
                ).join('');
            } else {
                document.getElementById('warnings').innerHTML = '<div style="color:#00ff88">无警告</div>';
            }
            
            // 配置
            document.getElementById('config').innerHTML = `
                <div class="stat-item"><span>分析档位</span><span>10 档</span></div>
                <div class="stat-item"><span>最大滑点</span><span>5 bps</span></div>
                <div class="stat-item"><span>最大吃单比例</span><span>20%</span></div>
                <div class="stat-item"><span>最低评分</span><span>0.50</span></div>
            `;
        }
        
        fetchLiquidity();
        setInterval(fetchLiquidity, 3000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Execution Optimizer API (V13 执行优化)
# ============================================================
@app.get("/execution")
async def get_execution():
    """获取执行优化状态"""
    try:
        from core.execution_optimizer import ExecutionOptimizer
        
        optimizer = ExecutionOptimizer()
        
        return optimizer.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/execution/plan")
async def create_execution_plan(
    symbol: str = "BTC/USDT",
    side: str = "BUY",
    order_size: float = 1.0,
    liquidity_score: float = 0.75
):
    """创建执行计划"""
    try:
        from core.execution_optimizer import ExecutionOptimizer
        
        optimizer = ExecutionOptimizer()
        
        plan = optimizer.create_execution_plan(
            symbol=symbol,
            side=side,
            order_size=order_size,
            liquidity_score=liquidity_score,
            liquidity_type="MEDIUM"
        )
        
        return {
            "mode": plan.mode.value,
            "symbol": plan.symbol,
            "side": plan.side,
            "total_size": plan.total_size,
            "recommended_size": plan.recommended_size,
            "chunks": plan.chunks,
            "chunk_size": round(plan.chunk_size, 4),
            "interval_sec": plan.interval_sec,
            "limit_price": plan.limit_price,
            "liquidity_score": plan.liquidity_score,
            "reason": plan.reason
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/execution/twap")
async def create_twap_plan(
    total_size: float = 3.0,
    chunks: int = 3,
    interval_sec: float = 1.0
):
    """创建 TWAP 拆单计划"""
    try:
        from core.execution_optimizer import ExecutionOptimizer
        
        optimizer = ExecutionOptimizer()
        schedule = optimizer.create_twap_schedule(total_size, chunks, interval_sec)
        
        return {
            "total_size": total_size,
            "chunks": chunks,
            "interval_sec": interval_sec,
            "schedule": schedule
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/execution/simulate")
async def simulate_execution(
    symbol: str = "BTC/USDT",
    side: str = "BUY",
    order_size: float = 1.0,
    liquidity_score: float = 0.75
):
    """模拟执行"""
    try:
        from core.execution_optimizer import ExecutionOptimizer
        
        optimizer = ExecutionOptimizer()
        
        plan = optimizer.create_execution_plan(
            symbol=symbol,
            side=side,
            order_size=order_size,
            liquidity_score=liquidity_score,
            liquidity_type="MEDIUM"
        )
        
        result = optimizer.simulate_execution(plan)
        
        return {
            "execution_id": result.execution_id,
            "mode": result.mode.value,
            "fill_rate": round(result.fill_rate, 2),
            "slippage_bps": round(result.slippage_bps, 2),
            "cost_saved": round(result.cost_saved, 4),
            "latency_ms": result.latency_ms,
            "chunks_executed": result.chunks_executed,
            "status": result.status.value
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/execution/status")
async def get_execution_status():
    """获取执行引擎状态"""
    try:
        from core.execution_optimizer import ExecutionOptimizer
        
        optimizer = ExecutionOptimizer()
        
        return optimizer.get_status()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/execution/dashboard", response_class=HTMLResponse)
async def execution_dashboard():
    """Execution Optimizer Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>⚡ Execution Optimizer Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#ffaa00; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#ffaa00; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .mode-box { text-align:center; padding:20px; margin:10px 0; border-radius:10px; }
        .mode-MARKET { background:#1a3d1a; }
        .mode-LIMIT { background:#3d3d1a; }
        .mode-TWAP { background:#2a2a3d; }
        .mode-SKIP { background:#3d1a1a; }
        .big-metric { font-size:36px; font-weight:bold; margin:20px 0; text-align:center; }
        .metric-good { color:#00ff88; }
        .metric-medium { color:#ffaa00; }
        .metric-bad { color:#ff4444; }
        .chunk-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#ffaa00; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Execution Optimizer Dashboard</h1>
        <div><span class="live"></span>执行优化引擎 - V13</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 执行模式</h2>
            <div id="mode">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📈 执行统计</h2>
            <div id="stats">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>🎯 执行计划</h2>
            <div id="plan">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📉 滑点监控</h2>
            <div id="slippage">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>⏱️ TWAP 拆单计划</h2>
        <div id="twap">加载中...</div>
    </div>
    
    <div class="card">
        <h2>⚙️ 引擎配置</h2>
        <div id="config">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchExecution() {
            try {
                const [planRes, twapRes, statsRes] = await Promise.all([
                    fetch(`${API}/execution/plan?liquidity_score=0.75`),
                    fetch(`${API}/execution/twap`),
                    fetch(`${API}/execution/status`)
                ]);
                
                const planData = await planRes.json();
                const twapData = await twapRes.json();
                const statsData = await statsRes.json();
                
                updateDisplay(planData, twapData, statsData);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(plan, twap, stats) {
            // 执行模式
            const mode = plan.mode || 'SKIP';
            const modeNames = {
                'FULL_MARKET': '全仓市价',
                'SMART_LIMIT': '智能限价',
                'TWAP': 'TWAP拆单',
                'POV': 'POV跟随',
                'SKIP': '跳过执行'
            };
            const modeClass = `mode-${mode.replace('FULL_', '').replace('SMART_', '')}`;
            document.getElementById('mode').innerHTML = `
                <div class="mode-box ${modeClass}">
                    <div style="font-size:28px;font-weight:bold">${modeNames[mode] || mode}</div>
                    <div style="margin-top:10px;font-size:12px">流动性评分: ${plan.liquidity_score || 0}</div>
                </div>
                <div style="margin-top:10px">${plan.reason || ''}</div>
            `;
            
            // 统计
            const avgFillRate = stats.avg_fill_rate || 0;
            const avgSlippage = stats.avg_slippage_bps || 0;
            const fillClass = avgFillRate >= 0.9 ? 'metric-good' : (avgFillRate >= 0.7 ? 'metric-medium' : 'metric-bad');
            const slipClass = avgSlippage <= 3 ? 'metric-good' : (avgSlippage <= 5 ? 'metric-medium' : 'metric-bad');
            document.getElementById('stats').innerHTML = `
                <div class="stat-item"><span>总执行次数</span><span>${stats.total_executions || 0}</span></div>
                <div class="stat-item"><span>平均成交率</span><span class="${fillClass}">${(avgFillRate * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>平均滑点</span><span class="${slipClass}">${avgSlippage.toFixed(1)} bps</span></div>
            `;
            
            // 执行计划
            document.getElementById('plan').innerHTML = `
                <div class="stat-item"><span>交易对</span><span>${plan.symbol || 'BTC/USDT'}</span></div>
                <div class="stat-item"><span>方向</span><span>${plan.side || 'BUY'}</span></div>
                <div class="stat-item"><span>请求大小</span><span>${plan.total_size || 0} BTC</span></div>
                <div class="stat-item"><span>建议大小</span><span style="color:#00ff88">${(plan.recommended_size || 0).toFixed(4)} BTC</span></div>
                <div class="stat-item"><span>拆单数</span><span>${plan.chunks || 1} 笔</span></div>
            `;
            
            // 滑点
            const slippage = plan.liquidity_score ? (5 - plan.liquidity_score * 3).toFixed(1) : '3.0';
            document.getElementById('slippage').innerHTML = `
                <div class="stat-item"><span>预估滑点</span><span style="color:#ffaa00">${slippage} bps</span></div>
                <div class="stat-item"><span>滑点阈值</span><span>5 bps</span></div>
                <div class="stat-item"><span>状态</span><span style="color:#00ff88">OK</span></div>
            `;
            
            // TWAP
            if (twap.schedule) {
                document.getElementById('twap').innerHTML = twap.schedule.map(chunk => `
                    <div class="chunk-item">
                        <div style="display:flex;justify-content:space-between">
                            <span>第 ${chunk.chunk} 笔</span>
                            <span style="color:#00ff88">${chunk.size.toFixed(4)} BTC</span>
                        </div>
                        <div style="font-size:12px;color:#888">延迟 ${chunk.delay.toFixed(1)}s</div>
                    </div>
                `).join('');
            }
            
            // 配置
            const config = stats.config || {};
            document.getElementById('config').innerHTML = `
                <div class="stat-item"><span>市价阈值</span><span>${config.market_threshold || 0.85}</span></div>
                <div class="stat-item"><span>限价阈值</span><span>${config.limit_threshold || 0.70}</span></div>
                <div class="stat-item"><span>TWAP阈值</span><span>${config.twap_threshold || 0.60}</span></div>
                <div class="stat-item"><span>最大滑点</span><span>${config.max_slippage_bps || 5} bps</span></div>
                <div class="stat-item"><span>TWAP拆单数</span><span>${config.twap_chunks || 3}</span></div>
            `;
        }
        
        fetchExecution();
        setInterval(fetchExecution, 3000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# PnL Attribution API (V14 盈亏归因)
# ============================================================
@app.get("/pnl")
async def get_pnl_attribution():
    """获取盈亏归因状态"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        return engine.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/breakdown")
async def get_pnl_breakdown():
    """获取归因分解"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        return engine.get_breakdown()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/verdicts")
async def get_pnl_verdicts():
    """获取裁决分布"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        return engine.get_verdict_distribution()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/issues")
async def get_pnl_issues(limit: int = 10):
    """获取检测到的问题"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        return {"issues": engine.get_issues(limit)}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/recent")
async def get_recent_attributions(n: int = 10):
    """获取最近的归因"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        return {"attributions": engine.get_recent_attributions(n)}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/simulate")
async def simulate_pnl_attribution(
    entry_price: float = 50000,
    exit_price: float = 50100,
    signal_score: float = 0.8,
    side: str = "BUY"
):
    """模拟归因分析"""
    try:
        from core.pnl_attribution import PnLAttributionEngine
        
        engine = PnLAttributionEngine()
        
        attribution = engine.attribute(
            trade_id="SIM-001",
            symbol="BTC/USDT",
            side=side,
            entry_price=entry_price,
            exit_price=exit_price,
            expected_entry=entry_price,
            expected_exit=entry_price * 1.002 if side == "BUY" else entry_price * 0.998,
            size=1.0,
            signal_score=signal_score,
            strategy="test"
        )
        
        return {
            "trade_id": attribution.trade_id,
            "gross_pnl_pct": round(attribution.gross_pnl_pct * 100, 4),
            "signal_edge_pct": round(attribution.signal_edge * 100, 4),
            "slippage_pct": round(attribution.slippage_cost * 100, 4),
            "fee_pct": round(attribution.fee_cost * 100, 4),
            "net_pnl_pct": round(attribution.net_pnl_pct * 100, 4),
            "verdict": attribution.verdict.value,
            "trade_type": attribution.trade_type.value
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/pnl/dashboard", response_class=HTMLResponse)
async def pnl_dashboard():
    """PnL Attribution Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>📊 PnL Attribution Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ff88; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ff88; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .big-number { font-size:36px; text-align:center; padding:10px; }
        .positive { color:#00ff88; }
        .negative { color:#ff4444; }
        .neutral { color:#ffaa00; }
        .verdict-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        .verdict-bar { height:8px; background:#252540; border-radius:4px; margin-top:5px; }
        .verdict-bar-fill { height:100%; border-radius:4px; }
        .bar-green { background:#00ff88; }
        .bar-yellow { background:#ffaa00; }
        .bar-red { background:#ff4444; }
        .issue-item { background:#2a2020; border-left:3px solid #ff4444; padding:10px; margin:5px 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ff88; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 PnL Attribution Dashboard</h1>
        <div><span class="live"></span>盈亏归因引擎 - V14</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📈 总体统计</h2>
            <div id="summary">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🔍 归因分解</h2>
            <div id="breakdown">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>⚖️ 裁决分布</h2>
            <div id="verdicts">加载中...</div>
        </div>
        
        <div class="card">
            <h2>⚠️ 问题检测</h2>
            <div id="issues">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📝 最近归因</h2>
        <div id="recent">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchPnL() {
            try {
                const [summaryRes, breakdownRes, verdictsRes, issuesRes] = await Promise.all([
                    fetch(`${API}/pnl`),
                    fetch(`${API}/pnl/breakdown`),
                    fetch(`${API}/pnl/verdicts`),
                    fetch(`${API}/pnl/issues`)
                ]);
                
                const summary = await summaryRes.json();
                const breakdown = await breakdownRes.json();
                const verdicts = await verdictsRes.json();
                const issues = await issuesRes.json();
                
                updateDisplay(summary, breakdown, verdicts, issues);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(summary, breakdown, verdicts, issues) {
            // 总体统计
            const winRate = summary.win_rate || 0;
            const winRateClass = winRate >= 0.5 ? 'positive' : 'negative';
            document.getElementById('summary').innerHTML = `
                <div class="big-number ${summary.total_pnl_pct >= 0 ? 'positive' : 'negative'}">${(summary.total_pnl_pct || 0).toFixed(2)}%</div>
                <div class="stat-item"><span>总交易</span><span>${summary.total_trades || 0} 笔</span></div>
                <div class="stat-item"><span>胜率</span><span class="${winRateClass}">${(winRate * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>信号质量</span><span>${(summary.signal_quality_score || 0).toFixed(2)}</span></div>
                <div class="stat-item"><span>执行质量</span><span>${(summary.execution_quality_score || 0).toFixed(2)}</span></div>
            `;
            
            // 归因分解
            if (breakdown.pnl_breakdown) {
                document.getElementById('breakdown').innerHTML = Object.entries(breakdown.pnl_breakdown).map(([key, value]) => {
                    const val = value.total_pct || 0;
                    const colorClass = val >= 0 ? 'positive' : 'negative';
                    return `
                        <div class="stat-item">
                            <span>${key}</span>
                            <span class="${colorClass}">${val.toFixed(4)}%</span>
                        </div>
                    `;
                }).join('') + `
                    <div class="stat-item" style="margin-top:10px;padding-top:10px;border-top:2px solid #333">
                        <span><b>最大漏洞</b></span>
                        <span style="color:#ffaa00">${breakdown.leak_analysis?.biggest_leak || '-'}: ${breakdown.leak_analysis?.leak_pct || 0}%</span>
                    </div>
                `;
            } else {
                document.getElementById('breakdown').innerHTML = '<div style="color:#888">暂无数据</div>';
            }
            
            // 裁决分布
            if (verdicts.distribution) {
                const total = verdicts.total || 1;
                document.getElementById('verdicts').innerHTML = Object.entries(verdicts.distribution).map(([v, s]) => {
                    const barClass = v.includes('GOOD_GOOD') ? 'bar-green' : (v.includes('BAD') ? 'bar-red' : 'bar-yellow');
                    const vNames = {
                        'GOOD_SIGNAL_GOOD_EXECUTION': '好信号+好执行',
                        'GOOD_SIGNAL_BAD_EXECUTION': '好信号+坏执行',
                        'BAD_SIGNAL_GOOD_EXECUTION': '坏信号+好执行',
                        'BAD_SIGNAL_BAD_EXECUTION': '坏信号+坏执行',
                        'LUCK_WIN': '运气赢',
                        'UNLUCKY_LOSS': '运气输'
                    };
                    return `
                        <div class="verdict-item">
                            <div style="display:flex;justify-content:space-between">
                                <span>${vNames[v] || v}</span>
                                <span>${s.count}笔 (${s.pct}%)</span>
                            </div>
                            <div class="verdict-bar">
                                <div class="verdict-bar-fill ${barClass}" style="width:${s.pct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('verdicts').innerHTML = '<div style="color:#888">暂无数据</div>';
            }
            
            // 问题
            if (issues.issues && issues.issues.length > 0) {
                document.getElementById('issues').innerHTML = issues.issues.map(i => `
                    <div class="issue-item">
                        <div style="font-weight:bold">${i.type}</div>
                        <div style="font-size:12px;color:#888">${i.message}</div>
                    </div>
                `).join('');
            } else {
                document.getElementById('issues').innerHTML = '<div style="color:#00ff88">无问题检测</div>';
            }
            
            // 最近归因
            document.getElementById('recent').innerHTML = '<div style="color:#888;text-align:center">请通过 /pnl/simulate 测试归因功能</div>';
        }
        
        fetchPnL();
        setInterval(fetchPnL, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Strategy Evolution API (V15 策略进化)
# ============================================================
@app.get("/evolution")
async def get_evolution():
    """获取策略进化状态"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        return engine.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/patterns")
async def get_evolution_patterns():
    """获取所有模式详情"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        return engine.get_pattern_details()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/boosted")
async def get_boosted_patterns():
    """获取被强化的模式"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        return {"boosted": engine.get_boosted_patterns()}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/suppressed")
async def get_suppressed_patterns():
    """获取被削弱的模式"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        return {"suppressed": engine.get_suppressed_patterns()}
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/run")
async def run_evolution():
    """执行进化"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        # 模拟一些交易记录
        # TREND + LONG + HIGH 应该被强化
        for i in range(15):
            pnl = 0.002 if i % 3 != 0 else -0.001
            engine.record_trade(
                regime="TREND",
                signal_type="LONG",
                liquidity_bucket="HIGH",
                pnl=pnl
            )
        
        # RANGE + SHORT + LOW 应该被削弱
        for i in range(12):
            pnl = -0.002 if i % 2 == 0 else 0.001
            engine.record_trade(
                regime="RANGE",
                signal_type="SHORT",
                liquidity_bucket="LOW",
                pnl=pnl
            )
        
        records = engine.run_evolution()
        
        return {
            "evolutions": len(records),
            "summary": engine.get_summary(),
            "records": [
                {
                    "pattern": list(r.pattern_key),
                    "decision": r.decision.value,
                    "reason": r.reason
                }
                for r in records
            ]
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/evaluate")
async def evaluate_patterns():
    """评估所有模式"""
    try:
        from core.strategy_evolution import StrategyEvolutionEngine
        
        engine = StrategyEvolutionEngine()
        
        # 模拟交易
        for i in range(15):
            pnl = 0.002 if i % 3 != 0 else -0.001
            engine.record_trade("TREND", "LONG", "HIGH", pnl)
        
        for i in range(12):
            pnl = -0.002 if i % 2 == 0 else 0.001
            engine.record_trade("RANGE", "SHORT", "LOW", pnl)
        
        evaluations = engine.evaluate_all_patterns()
        
        return {
            "patterns": len(evaluations),
            "evaluations": {
                str(k): {
                    "health": v.get("health", "FAIR"),
                    "win_rate": round(v.get("win_rate", 0) * 100, 1),
                    "samples": v.get("samples", 0),
                    "confidence": round(v.get("confidence", 0), 2)
                }
                for k, v in evaluations.items()
            }
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/evolution/dashboard", response_class=HTMLResponse)
async def evolution_dashboard():
    """Strategy Evolution Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧬 Strategy Evolution Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#ff8800; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#ff8800; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .pattern-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        .pattern-header { display:flex; justify-content:space-between; margin-bottom:5px; }
        .pattern-name { font-weight:bold; }
        .pattern-boost { color:#00ff88; }
        .pattern-suppress { color:#ff4444; }
        .pattern-neutral { color:#888; }
        .big-number { font-size:48px; text-align:center; margin:20px 0; }
        .evolution-btn { background:#ff8800; color:#000; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; }
        .evolution-btn:hover { background:#ffaa00; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#ff8800; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧬 Strategy Evolution Dashboard</h1>
        <div><span class="live"></span>策略自我进化引擎 - V15</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 进化统计</h2>
            <div id="stats">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🎯 进化决策</h2>
            <div id="decisions">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>🟢 被强化的模式</h2>
        <div id="boosted">加载中...</div>
    </div>
    
    <div class="card">
        <h2>🔴 被削弱的模式</h2>
        <div id="suppressed">加载中...</div>
    </div>
    
    <div class="card">
        <h2>⚙️ 执行进化</h2>
        <div style="text-align:center;padding:20px">
            <button class="evolution-btn" onclick="runEvolution()">运行进化</button>
            <div id="evolution-result" style="margin-top:20px"></div>
        </div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchEvolution() {
            try {
                const res = await fetch(`${API}/evolution`);
                const data = await res.json();
                updateDisplay(data);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(data) {
            if (data.error) {
                document.getElementById('stats').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                return;
            }
            
            // 统计
            document.getElementById('stats').innerHTML = `
                <div class="stat-item"><span>总模式</span><span>${data.total_patterns || 0}</span></div>
                <div class="stat-item"><span>总进化次数</span><span>${data.total_evolutions || 0}</span></div>
                <div class="stat-item"><span>强化</span><span class="pattern-boost">${data.boosted_count || 0}</span></div>
                <div class="stat-item"><span>削弱</span><span class="pattern-suppress">${data.suppressed_count || 0}</span></div>
                <div class="stat-item"><span>中立</span><span>${data.neutral_count || 0}</span></div>
                <div class="stat-item"><span>回滚次数</span><span>${data.total_rollbacks || 0}</span></div>
            `;
            
            // 决策分布
            const boosted = data.boosted_count || 0;
            const suppressed = data.suppressed_count || 0;
            const neutral = data.neutral_count || 0;
            const total = boosted + suppressed + neutral || 1;
            
            document.getElementById('decisions').innerHTML = `
                <div style="margin-bottom:10px">
                    <div style="display:flex;height:20px;border-radius:10px;overflow:hidden">
                        <div style="width:${boosted/total*100}%;background:#00ff88"></div>
                        <div style="width:${suppressed/total*100}%;background:#ff4444"></div>
                        <div style="width:${neutral/total*100}%;background:#888"></div>
                    </div>
                </div>
                <div class="stat-item"><span>🟢 强化</span><span>${(boosted/total*100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>🔴 削弱</span><span>${(suppressed/total*100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>⚪ 中立</span><span>${(neutral/total*100).toFixed(0)}%</span></div>
            `;
            
            // 强化模式
            if (data.boosted && data.boosted.length > 0) {
                document.getElementById('boosted').innerHTML = data.boosted.map(p => `
                    <div class="pattern-item">
                        <div class="pattern-header">
                            <span class="pattern-name">${p.pattern.join(' / ')}</span>
                            <span class="pattern-boost">BOOST</span>
                        </div>
                        <div style="font-size:12px;color:#888">
                            胜率 ${p.win_rate}% | 样本 ${p.samples} | 权重 ${p.weight_multiplier}x
                        </div>
                    </div>
                `).join('');
            } else {
                document.getElementById('boosted').innerHTML = '<div style="color:#888;text-align:center">暂无强化模式</div>';
            }
            
            // 削弱模式
            if (data.suppressed && data.suppressed.length > 0) {
                document.getElementById('suppressed').innerHTML = data.suppressed.map(p => `
                    <div class="pattern-item">
                        <div class="pattern-header">
                            <span class="pattern-name">${p.pattern.join(' / ')}</span>
                            <span class="pattern-suppress">${p.decision}</span>
                        </div>
                        <div style="font-size:12px;color:#888">
                            胜率 ${p.win_rate}% | 样本 ${p.samples}
                        </div>
                    </div>
                `).join('');
            } else {
                document.getElementById('suppressed').innerHTML = '<div style="color:#888;text-align:center">暂无削弱模式</div>';
            }
        }
        
        async function runEvolution() {
            try {
                document.getElementById('evolution-result').innerHTML = '<div style="color:#ffaa00">执行中...</div>';
                
                const res = await fetch(`${API}/evolution/run`);
                const data = await res.json();
                
                if (data.error) {
                    document.getElementById('evolution-result').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                    return;
                }
                
                document.getElementById('evolution-result').innerHTML = `
                    <div style="color:#00ff88;margin-bottom:10px">进化完成！</div>
                    <div>执行了 ${data.evolutions} 个进化决策</div>
                `;
                
                // 刷新显示
                setTimeout(fetchEvolution, 1000);
            } catch(e) {
                document.getElementById('evolution-result').innerHTML = `<div style="color:#ff4444">执行失败</div>`;
            }
        }
        
        fetchEvolution();
        setInterval(fetchEvolution, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Meta Strategy Controller API (V16 策略调度)
# ============================================================
@app.get("/meta-strategy")
async def get_meta_strategy():
    """获取策略调度状态"""
    try:
        from core.meta_strategy_controller import MetaStrategyController
        
        controller = MetaStrategyController()
        
        return controller.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta-strategy/select")
async def select_strategy(regime: str = "TREND"):
    """选择策略"""
    try:
        from core.meta_strategy_controller import MetaStrategyController
        
        controller = MetaStrategyController()
        
        # 更新策略统计
        for i in range(20):
            pnl = 0.002 if i % 3 != 0 else -0.001
            controller.update_strategy_stats("TREND_FOLLOW", pnl)
        
        for i in range(15):
            pnl = 0.001 if i % 2 == 0 else -0.001
            controller.update_strategy_stats("MEAN_REVERT", pnl)
        
        selection = controller.select_strategy(regime)
        
        return {
            "regime": selection.regime,
            "selected_strategy": selection.selected_strategy,
            "score": round(selection.score, 2),
            "confidence": round(selection.confidence, 2),
            "decision": selection.decision.value,
            "reason": selection.reason,
            "candidates": selection.candidates[:5],
            "alternative": selection.alternative
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta-strategy/strategies")
async def get_strategies():
    """获取所有策略"""
    try:
        from core.meta_strategy_controller import MetaStrategyController
        
        controller = MetaStrategyController()
        
        active = controller.get_active_strategies()
        
        return {
            "total": len(controller.strategy_pool),
            "active_count": len(active),
            "strategies": active
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta-strategy/mapping")
async def get_regime_mapping():
    """获取 Regime 策略映射"""
    try:
        from core.meta_strategy_controller import MetaStrategyController
        
        controller = MetaStrategyController()
        
        return controller.get_regime_mapping()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta-strategy/conflict")
async def resolve_strategy_conflict():
    """模拟多策略冲突"""
    try:
        from core.meta_strategy_controller import MetaStrategyController
        
        controller = MetaStrategyController()
        
        signals = [
            {"strategy": "TREND_FOLLOW", "confidence": 0.8, "signal": {"side": "LONG"}},
            {"strategy": "MEAN_REVERT", "confidence": 0.6, "signal": {"side": "SHORT"}},
            {"strategy": "BREAKOUT", "confidence": 0.7, "signal": {"side": "LONG"}}
        ]
        
        best, signal = controller.resolve_conflict(signals)
        
        return {
            "signals": len(signals),
            "selected": best,
            "confidence": signal.get("confidence", 0),
            "all_signals": [
                {"strategy": s["strategy"], "confidence": s["confidence"]}
                for s in sorted(signals, key=lambda x: -x["confidence"])
            ]
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/meta-strategy/dashboard", response_class=HTMLResponse)
async def meta_strategy_dashboard():
    """Meta Strategy Controller Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧠 Meta Strategy Controller Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#aa88ff; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#aa88ff; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .strategy-item { background:#0a0a15; border-radius:5px; padding:10px; margin:5px 0; }
        .strategy-header { display:flex; justify-content:space-between; margin-bottom:5px; }
        .strategy-name { font-weight:bold; color:#aa88ff; }
        .strategy-score { font-weight:bold; }
        .score-high { color:#00ff88; }
        .score-medium { color:#ffaa00; }
        .score-low { color:#ff4444; }
        .regime-box { text-align:center; padding:15px; margin:10px 0; border-radius:10px; background:#252540; }
        .regime-name { font-size:20px; font-weight:bold; margin-bottom:5px; }
        .strategy-btn { background:#aa88ff; color:#000; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin:5px; }
        .strategy-btn:hover { background:#cc99ff; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#aa88ff; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Meta Strategy Controller Dashboard</h1>
        <div><span class="live"></span>策略调度中枢 - V16</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>📊 当前状态</h2>
            <div id="status">加载中...</div>
        </div>
        
        <div class="card">
            <h2>🎯 策略选择</h2>
            <div id="selection">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>🧠 活跃策略</h2>
        <div id="strategies">加载中...</div>
    </div>
    
    <div class="card">
        <h2>📋 Regime 映射</h2>
        <div id="mapping">加载中...</div>
    </div>
    
    <div class="card">
        <h2>⚙️ 手动选择</h2>
        <div style="text-align:center;padding:15px">
            <button class="strategy-btn" onclick="selectForRegime('TREND')">TREND</button>
            <button class="strategy-btn" onclick="selectForRegime('RANGE')">RANGE</button>
            <button class="strategy-btn" onclick="selectForRegime('BREAKOUT')">BREAKOUT</button>
            <button class="strategy-btn" onclick="selectForRegime('CHAOTIC')">CHAOTIC</button>
            <div id="select-result" style="margin-top:15px"></div>
        </div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchData() {
            try {
                const [summaryRes, strategiesRes, mappingRes] = await Promise.all([
                    fetch(`${API}/meta-strategy`),
                    fetch(`${API}/meta-strategy/strategies`),
                    fetch(`${API}/meta-strategy/mapping`)
                ]);
                
                const summary = await summaryRes.json();
                const strategies = await strategiesRes.json();
                const mapping = await mappingRes.json();
                
                updateDisplay(summary, strategies, mapping);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(summary, strategies, mapping) {
            if (summary.error) {
                document.getElementById('status').innerHTML = `<div style="color:#ff4444">${summary.error}</div>`;
                return;
            }
            
            // 当前状态
            const currentStrat = summary.current_strategy || '无';
            document.getElementById('status').innerHTML = `
                <div class="stat-item"><span>总策略</span><span>${summary.total_strategies || 0}</span></div>
                <div class="stat-item"><span>活跃策略</span><span>${summary.active_strategies || 0}</span></div>
                <div class="stat-item"><span>当前市场</span><span>${summary.current_regime || 'UNKNOWN'}</span></div>
                <div class="stat-item"><span>当前策略</span><span style="color:#aa88ff">${currentStrat}</span></div>
                <div class="stat-item"><span>选择次数</span><span>${summary.selections || 0}</span></div>
            `;
            
            // 策略选择占位
            document.getElementById('selection').innerHTML = '<div style="color:#888;text-align:center">点击下方按钮选择策略</div>';
            
            // 活跃策略
            if (strategies.strategies && strategies.strategies.length > 0) {
                document.getElementById('strategies').innerHTML = strategies.strategies.map(s => {
                    const scoreClass = s.score >= 0.7 ? 'score-high' : (s.score >= 0.5 ? 'score-medium' : 'score-low');
                    return `
                        <div class="strategy-item">
                            <div class="strategy-header">
                                <span class="strategy-name">${s.name}</span>
                                <span class="strategy-score ${scoreClass}">${s.score.toFixed(2)}</span>
                            </div>
                            <div style="font-size:12px;color:#888">
                                胜率 ${s.win_rate}% | 样本 ${s.samples} | 置信度 ${s.confidence.toFixed(2)}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('strategies').innerHTML = '<div style="color:#888;text-align:center">暂无活跃策略</div>';
            }
            
            // Regime 映射
            if (mapping && Object.keys(mapping).length > 0) {
                document.getElementById('mapping').innerHTML = Object.entries(mapping).map(([regime, strategies]) => `
                    <div class="regime-box">
                        <div class="regime-name">${regime}</div>
                        <div style="font-size:12px;color:#888">${strategies.join(', ')}</div>
                    </div>
                `).join('');
            } else {
                document.getElementById('mapping').innerHTML = '<div style="color:#888;text-align:center">暂无映射</div>';
            }
        }
        
        async function selectForRegime(regime) {
            try {
                document.getElementById('select-result').innerHTML = '<div style="color:#ffaa00">选择中...</div>';
                
                const res = await fetch(`${API}/meta-strategy/select?regime=${regime}`);
                const data = await res.json();
                
                if (data.error) {
                    document.getElementById('select-result').innerHTML = `<div style="color:#ff4444">${data.error}</div>`;
                    return;
                }
                
                const scoreClass = data.score >= 0.7 ? 'score-high' : (data.score >= 0.5 ? 'score-medium' : 'score-low');
                
                document.getElementById('selection').innerHTML = `
                    <div class="regime-box">
                        <div class="regime-name">${data.selected_strategy || 'NO_TRADE'}</div>
                        <div style="font-size:12px;color:#888">Regime: ${data.regime}</div>
                    </div>
                    <div class="stat-item"><span>评分</span><span class="${scoreClass}">${data.score}</span></div>
                    <div class="stat-item"><span>置信度</span><span>${data.confidence}</span></div>
                    <div class="stat-item"><span>决策</span><span>${data.decision}</span></div>
                    <div class="stat-item"><span>原因</span><span style="font-size:11px">${data.reason}</span></div>
                `;
                
                document.getElementById('select-result').innerHTML = `<div style="color:#00ff88">✅ 已选择 ${data.selected_strategy}</div>`;
            } catch(e) {
                document.getElementById('select-result').innerHTML = '<div style="color:#ff4444">选择失败</div>';
            }
        }
        
        fetchData();
        setInterval(fetchData, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ============================================================
# Market Intelligence API (V18 市场智能)
# ============================================================
@app.get("/intelligence")
async def get_market_intelligence():
    """获取市场智能状态"""
    try:
        from core.market_intelligence import MarketIntelligenceEngine
        
        engine = MarketIntelligenceEngine()
        
        return engine.get_summary()
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/intelligence/analyze")
async def analyze_market(
    buy_trades: int = 35,
    sell_trades: int = 15,
    long_liq: float = 100,
    short_liq: float = 500
):
    """分析市场状态"""
    try:
        from core.market_intelligence import MarketIntelligenceEngine, TradeData
        from datetime import datetime
        
        engine = MarketIntelligenceEngine()
        
        # 创建模拟交易
        trades = []
        for i in range(buy_trades):
            trades.append(TradeData(
                timestamp=datetime.now().isoformat(),
                side="buy",
                price=50000 + i * 10,
                size=1.0
            ))
        for i in range(sell_trades):
            trades.append(TradeData(
                timestamp=datetime.now().isoformat(),
                side="sell",
                price=50000 - i * 10,
                size=1.0
            ))
        
        state = engine.analyze(
            trades=trades,
            long_liquidations=long_liq,
            short_liquidations=short_liq,
            price_change=0.002,
            volume_change=2.5
        )
        
        return {
            "timestamp": state.timestamp,
            "flow": {
                "state": state.flow_state.value,
                "imbalance": round(state.flow_imbalance * 100, 1),
                "buy_volume": state.buy_volume,
                "sell_volume": state.sell_volume
            },
            "liquidation": {
                "state": state.liquidation_state.value,
                "long_liq": state.long_liquidations,
                "short_liq": state.short_liquidations
            },
            "structure": {
                "state": state.structure_state.value,
                "price_change_pct": round(state.price_change * 100, 3),
                "volume_change_pct": round(state.volume_change * 100, 1)
            },
            "liquidity": {
                "shift": state.liquidity_shift.value,
                "bid_change_pct": state.bid_depth_change,
                "ask_change_pct": state.ask_depth_change
            },
            "confidence": round(state.confidence * 100, 0),
            "confidence_level": state.confidence_level.value
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/intelligence/flow")
async def analyze_money_flow():
    """分析资金流"""
    try:
        from core.market_intelligence import MarketIntelligenceEngine, TradeData
        from datetime import datetime
        
        engine = MarketIntelligenceEngine()
        
        # 模拟交易
        trades = []
        for i in range(40):
            trades.append(TradeData(
                timestamp=datetime.now().isoformat(),
                side="buy" if i % 3 != 0 else "sell",
                price=50000,
                size=1.0 + i * 0.1
            ))
        
        flow_state, imbalance, details = engine.detect_money_flow(trades)
        
        return {
            "state": flow_state.value,
            "imbalance_pct": round(imbalance * 100, 1),
            "details": details
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/intelligence/liquidation")
async def analyze_liquidations(long_liq: float = 100, short_liq: float = 500):
    """分析爆仓"""
    try:
        from core.market_intelligence import MarketIntelligenceEngine
        
        engine = MarketIntelligenceEngine()
        
        liq_state, details = engine.detect_liquidations(long_liq, short_liq)
        
        return {
            "state": liq_state.value,
            "details": details
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/intelligence/structure")
async def analyze_structure(price_change: float = 0.002, volume_change: float = 2.5):
    """分析市场结构"""
    try:
        from core.market_intelligence import MarketIntelligenceEngine
        
        engine = MarketIntelligenceEngine()
        
        struct_state, details = engine.detect_accumulation(price_change, volume_change)
        
        return {
            "state": struct_state.value,
            "details": details
        }
    
    except Exception as e:
        return {"error": str(e)}


@app.get("/intelligence/dashboard", response_class=HTMLResponse)
async def intelligence_dashboard():
    """Market Intelligence Dashboard HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>🧠 Market Intelligence Dashboard</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,sans-serif; background:#0f0f23; color:#e0e0e0; padding:20px; }
        .header { text-align:center; padding:20px; margin-bottom:20px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; }
        .header h1 { color:#00ccff; margin-bottom:10px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-bottom:20px; }
        .card { background:#1a1a2e; border-radius:10px; padding:20px; }
        .card h2 { color:#00ccff; margin-bottom:15px; font-size:14px; border-bottom:1px solid #333; padding-bottom:10px; }
        .stat-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #252540; }
        .stat-label { color:#888; }
        .stat-value { font-weight:bold; }
        .state-box { text-align:center; padding:15px; margin:10px 0; border-radius:10px; }
        .state-buy { background:#1a3d1a; }
        .state-sell { background:#3d1a1a; }
        .state-neutral { background:#252540; }
        .state-squeeze { background:#3d2a1a; }
        .state-accumulation { background:#1a2a3d; }
        .state-distribution { background:#3d1a2a; }
        .big-number { font-size:48px; text-align:center; margin:10px 0; }
        .high { color:#00ff88; }
        .medium { color:#ffaa00; }
        .low { color:#ff4444; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live { display:inline-block; width:10px; height:10px; background:#00ccff; border-radius:50%; animation:pulse 1s infinite; margin-right:10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Market Intelligence Dashboard</h1>
        <div><span class="live"></span>市场智能引擎 - V18</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>💰 资金流</h2>
            <div id="flow">加载中...</div>
        </div>
        
        <div class="card">
            <h2>💥 爆仓流</h2>
            <div id="liquidation">加载中...</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>🏗️ 市场结构</h2>
            <div id="structure">加载中...</div>
        </div>
        
        <div class="card">
            <h2>📊 综合置信度</h2>
            <div id="confidence">加载中...</div>
        </div>
    </div>
    
    <div class="card">
        <h2>📈 系统统计</h2>
        <div id="stats">加载中...</div>
    </div>
    
    <script>
        const API = window.location.origin;
        
        async function fetchIntelligence() {
            try {
                const [analyzeRes, summaryRes] = await Promise.all([
                    fetch(`${API}/intelligence/analyze`),
                    fetch(`${API}/intelligence`)
                ]);
                
                const analysis = await analyzeRes.json();
                const summary = await summaryRes.json();
                
                updateDisplay(analysis, summary);
            } catch(e) {
                console.error(e);
            }
        }
        
        function updateDisplay(analysis, summary) {
            if (analysis.error) {
                document.getElementById('flow').innerHTML = `<div style="color:#ff4444">${analysis.error}</div>`;
                return;
            }
            
            // 资金流
            const flowState = analysis.flow?.state || 'NEUTRAL';
            const flowImbalance = analysis.flow?.imbalance || 0;
            const flowClass = flowState.includes('BUY') ? 'state-buy' : (flowState.includes('SELL') ? 'state-sell' : 'state-neutral');
            document.getElementById('flow').innerHTML = `
                <div class="state-box ${flowClass}">
                    <div style="font-size:18px;font-weight:bold">${flowState.replace('_', ' ')}</div>
                </div>
                <div class="stat-item"><span>失衡</span><span>${flowImbalance}%</span></div>
                <div class="stat-item"><span>买量</span><span style="color:#00ff88">${analysis.flow?.buy_volume || 0}</span></div>
                <div class="stat-item"><span>卖量</span><span style="color:#ff4444">${analysis.flow?.sell_volume || 0}</span></div>
            `;
            
            // 爆仓
            const liqState = analysis.liquidation?.state || 'NEUTRAL';
            const liqClass = liqState.includes('SQUEEZE') ? 'state-squeeze' : 'state-neutral';
            document.getElementById('liquidation').innerHTML = `
                <div class="state-box ${liqClass}">
                    <div style="font-size:18px;font-weight:bold">${liqState.replace('_', ' ')}</div>
                </div>
                <div class="stat-item"><span>多头爆仓</span><span style="color:#00ff88">${analysis.liquidation?.long_liq || 0}</span></div>
                <div class="stat-item"><span>空头爆仓</span><span style="color:#ff4444">${analysis.liquidation?.short_liq || 0}</span></div>
            `;
            
            // 结构
            const structState = analysis.structure?.state || 'CONSOLIDATION';
            const structClass = structState === 'ACCUMULATION' ? 'state-accumulation' : (structState === 'DISTRIBUTION' ? 'state-distribution' : 'state-neutral');
            document.getElementById('structure').innerHTML = `
                <div class="state-box ${structClass}">
                    <div style="font-size:18px;font-weight:bold">${structState}</div>
                </div>
                <div class="stat-item"><span>价格变化</span><span>${analysis.structure?.price_change_pct || 0}%</span></div>
                <div class="stat-item"><span>成交量变化</span><span>${analysis.structure?.volume_change_pct || 0}%</span></div>
            `;
            
            // 置信度
            const conf = analysis.confidence || 50;
            const confLevel = analysis.confidence_level || 'MEDIUM';
            const confClass = conf >= 70 ? 'high' : (conf >= 40 ? 'medium' : 'low');
            document.getElementById('confidence').innerHTML = `
                <div class="big-number ${confClass}">${conf}%</div>
                <div style="text-align:center;color:#888">置信度等级: ${confLevel}</div>
            `;
            
            // 统计
            document.getElementById('stats').innerHTML = `
                <div class="stat-item"><span>总分析次数</span><span>${summary.total_analyses || 0}</span></div>
                <div class="stat-item"><span>买盘主导比例</span><span>${((summary.buy_dominant_ratio || 0) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>卖盘主导比例</span><span>${((summary.sell_dominant_ratio || 0) * 100).toFixed(0)}%</span></div>
                <div class="stat-item"><span>爆仓事件</span><span>${summary.liquidation_events || 0}</span></div>
                <div class="stat-item"><span>吸筹检测</span><span>${summary.accumulation_detected || 0}</span></div>
                <div class="stat-item"><span>派发检测</span><span>${summary.distribution_detected || 0}</span></div>
            `;
        }
        
        fetchIntelligence();
        setInterval(fetchIntelligence, 5000);
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)
