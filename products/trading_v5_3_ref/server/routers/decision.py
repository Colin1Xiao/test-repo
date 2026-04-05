"""
决策追踪路由
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

router = APIRouter(prefix="/decision", tags=["Decision Trace"])

# 数据文件路径
DECISION_LOG = Path(__file__).parent.parent.parent / "logs" / "decision_log.jsonl"


def read_decisions_internal(limit: int = 50):
    """读取决策记录"""
    try:
        if not DECISION_LOG.exists():
            return []
        with open(DECISION_LOG, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-limit:]]
    except Exception:
        return []


@router.get("/api/decisions")
async def get_decisions(limit: int = 50):
    """获取决策记录"""
    decisions = read_decisions_internal(limit)
    return JSONResponse(content={
        "count": len(decisions),
        "decisions": decisions
    })


@router.get("/api/stats")
async def get_decision_stats():
    """获取决策统计"""
    decisions = read_decisions_internal(100)
    
    if not decisions:
        return JSONResponse(content={"error": "no_data"})
    
    # 统计
    total = len(decisions)
    approved = sum(1 for d in decisions if "EXECUTE" in d.get("decision_type", ""))
    rejected = total - approved
    
    # 检查通过率
    all_checks_passed = sum(1 for d in decisions if all(d.get("checks", {}).values()))
    
    return JSONResponse(content={
        "total": total,
        "approved": approved,
        "rejected": rejected,
        "approval_rate": round(approved / total * 100, 1) if total > 0 else 0,
        "all_checks_passed": all_checks_passed,
        "check_pass_rate": round(all_checks_passed / total * 100, 1) if total > 0 else 0
    })


@router.get("/trace", response_class=HTMLResponse)
async def decision_trace_page():
    """决策追踪页面"""
    return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>决策追踪 - 小龙交易系统 V5.3</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
        .header { background: rgba(0,0,0,0.3); padding: 15px 30px; }
        .header a { color: #4fc3f7; }
        .container { padding: 20px; max-width: 1200px; margin: 0 auto; }
        
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; text-align: center; }
        .stat-card .value { font-size: 1.5rem; font-weight: bold; }
        .stat-card .label { color: #888; font-size: 0.9rem; }
        
        .decision-card {
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            border-left: 3px solid #4fc3f7;
        }
        .decision-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .decision-time { color: #888; font-size: 0.9rem; }
        .decision-result { padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
        .approved { background: #4caf50; }
        .rejected { background: #f44336; }
        .checks { display: flex; gap: 10px; font-size: 0.8rem; }
        .check-pass { color: #4caf50; }
        .check-fail { color: #f44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 决策追踪</h1>
        <p><a href="/dashboard/">← 返回主面板</a></p>
    </div>
    <div class="container">
        <div class="stats">
            <div class="stat-card">
                <div class="value" id="total">--</div>
                <div class="label">总决策</div>
            </div>
            <div class="stat-card">
                <div class="value" id="approved">--</div>
                <div class="label">已批准</div>
            </div>
            <div class="stat-card">
                <div class="value" id="rejected">--</div>
                <div class="label">已拒绝</div>
            </div>
            <div class="stat-card">
                <div class="value" id="rate">--</div>
                <div class="label">通过率</div>
            </div>
        </div>
        <div id="decisions">加载中...</div>
    </div>
    <script>
        async function loadStats() {
            const res = await fetch('/decision/api/stats');
            const data = await res.json();
            
            document.getElementById('total').textContent = data.total || 0;
            document.getElementById('approved').textContent = data.approved || 0;
            document.getElementById('rejected').textContent = data.rejected || 0;
            document.getElementById('rate').textContent = (data.approval_rate || 0) + '%';
        }
        
        async function loadDecisions() {
            const res = await fetch('/decision/api/decisions?limit=20');
            const data = await res.json();
            const container = document.getElementById('decisions');
            
            if (data.decisions.length === 0) {
                container.innerHTML = '<p>暂无决策记录</p>';
                return;
            }
            
            container.innerHTML = data.decisions.map(d => {
                const checks = d.checks || {};
                const checksHtml = Object.entries(checks)
                    .map(([k, v]) => `<span class="${v ? 'check-pass' : 'check-fail'}">${k}: ${v ? '✓' : '✗'}</span>`)
                    .join(' ');
                const approved = d.decision_type && d.decision_type.includes('EXECUTE');
                
                return `
                <div class="decision-card">
                    <div class="decision-header">
                        <span class="decision-time">${d.timestamp || '--'}</span>
                        <span class="decision-result ${approved ? 'approved' : 'rejected'}">
                            ${d.decision_type || '--'}
                        </span>
                    </div>
                    <div style="margin: 5px 0;">
                        <strong>Symbol:</strong> ${d.context?.symbol || '--'} | 
                        <strong>Score:</strong> ${d.context?.score || '--'}
                    </div>
                    <div class="checks">${checksHtml}</div>
                    <div style="margin-top: 5px; color: #888;">
                        ${d.reasons ? d.reasons.join(', ') : ''}
                    </div>
                </div>
            `}).join('');
        }
        
        loadStats();
        loadDecisions();
        setInterval(loadDecisions, 10000);
    </script>
</body>
</html>
"""