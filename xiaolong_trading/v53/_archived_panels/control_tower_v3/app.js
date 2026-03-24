/**
 * Control Tower v3 - 系统监控与裁决 (中文版)
 */

const CONFIG = {
    refreshInterval: 2000,
    minSamples: 30,
    maxDiffRate: 0.3,
    apiEndpoints: {
        stats: '/stats',
        audit: '/audit',
        diff: '/decision_diff',
        risk: '/ai/risk',
        mode: '/control/mode',
        recent: '/decision_diff/recent'
    }
};

let currentMode = 'shadow';
let systemStartTime = Date.now();
const logs = [];

// 中文映射表
const CN = {
    actions: { 'BUY': '买入', 'SELL': '卖出', 'HOLD': '持有', 'CLOSE': '平仓', 'PASS': '跳过' },
    diffTypes: { 'SAME': '一致', 'CONSERVATIVE': '保守', 'AGGRESSIVE': '激进' },
    riskLevels: { 'LOW': '低风险', 'MEDIUM': '中风险', 'HIGH': '高风险', 'UNKNOWN': '未知' },
    circuitStates: { 'NORMAL': '正常', 'TRIGGERED': '已触发' },
    capitalStates: { 'NORMAL': '正常', 'REDUCED': '已降低', 'HALTED': '已暂停' },
    modes: { 'shadow': '影子模式', 'hybrid': '混合模式', 'full': '完全接管' },
    recs: { 'PASS': '通过', 'WARN': '警告', 'BLOCK': '阻断' },
    sources: { 'SPREAD': '点差', 'DEPTH': '深度', 'DELAY': '延迟', 'VOLATILITY': '波动', 'UNKNOWN': '未知' }
};

// 工具函数
function fmtPct(n, d=1) { return n == null ? '-' : (n*100).toFixed(d)+'%'; }
function fmtTime(d) { return d ? new Date(d).toLocaleTimeString('zh-CN',{hour12:false}) : '--:--:--'; }
function fmtUptime(ms) {
    const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
    return h>0 ? `${h}小时${m%60}分` : `${m}分${s%60}秒`;
}

// API
async function fetchJSON(url) {
    try { const r=await fetch(url); return r.ok?await r.json():null; }
    catch(e){ console.error('请求失败:',url); return null; }
}
async function postJSON(url,data) {
    try { const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); return r.ok; }
    catch(e){ return false; }
}

// 日志
function addLog(lv,msg){ logs.unshift({time:new Date(),level:lv,message:msg}); if(logs.length>50)logs.pop(); renderLogs(); }
function renderLogs(){
    const el=document.getElementById('log-list'); if(!el)return;
    let html=logs.slice(0,20).map(l=>`<div class="log-item ${l.level.toLowerCase()}"><span class="log-time">${fmtTime(l.time)}</span><span class="log-level">${l.level}</span><span class="log-msg">${l.message}</span></div>`).join('');
    el.innerHTML=html||'<div class="log-item info"><span class="log-time">--:--:--</span><span class="log-level">INFO</span><span class="log-msg">暂无日志</span></div>';
}

// 渲染
function renderVerdict(stats,audit,diff){
    const el=document.getElementById('verdict');
    let cls='safe',title='系统正常',sub='所有指标正常',icon='✅';
    if(!diff||diff.total===0){ cls='warn'; title='系统初始化'; sub='等待影子模式数据...'; icon='⏳'; }
    else if(diff.over_aggressive>0){ cls='block'; title='系统阻断'; sub=`检测到 ${diff.over_aggressive} 笔激进决策`; icon='🚫'; }
    else if(diff.diff_rate>CONFIG.maxDiffRate){ cls='warn'; title='系统警告'; sub=`差异率 ${fmtPct(diff.diff_rate)} 超过阈值`; icon='⚠️'; }
    else if(diff.total<CONFIG.minSamples){ cls='warn'; title='数据验证中'; sub=`数据收集 (${diff.total}/${CONFIG.minSamples} 笔)`; icon='📊'; }
    
    el.className=`verdict ${cls}`;
    el.innerHTML=`<div class="verdict-icon">${icon}</div><div class="title">${title}</div><div class="subtitle">${sub}</div>
        <div class="metrics">
            <div class="metric"><span class="metric-label">盈亏比</span><span class="metric-value">${audit?.profit_factor?.toFixed(2)||'-'}</span></div>
            <div class="metric"><span class="metric-label">差异率</span><span class="metric-value">${diff?fmtPct(diff.diff_rate):'-'}</span></div>
            <div class="metric"><span class="metric-label">样本数</span><span class="metric-value">${diff?.total||0}</span></div>
            <div class="metric"><span class="metric-label">激进决策</span><span class="metric-value ${diff?.over_aggressive>0?'bad':'good'}">${diff?.over_aggressive||0}</span></div>
        </div>`;
    updateGoNoGo(diff); updateModeButtons(diff);
}

function renderExecution(stats){
    const el=document.getElementById('execution'); if(!stats){el.innerHTML='<span class="loading">暂无数据</span>';return;}
    const err=stats.errors||0;
    el.innerHTML=`<div class="metric-row"><span class="metric-label">错误次数</span><span class="metric-value ${err>0?'bad':'good'}">${err} 次</span></div>
        <div class="metric-row"><span class="metric-label">延迟 P50</span><span class="metric-value">${stats.p50||'-'} 毫秒</span></div>
        <div class="metric-row"><span class="metric-label">延迟 P90</span><span class="metric-value">${stats.p90||'-'} 毫秒</span></div>
        <div class="metric-row"><span class="metric-label">状态</span><span class="metric-value ${err>0?'bad':'good'}">${err>0?'性能降级':'运行健康'}</span></div>`;
}

function renderEdge(audit){
    const el=document.getElementById('edge'); if(!audit){el.innerHTML='<span class="loading">暂无数据</span>';return;}
    const pf=audit.profit_factor||0,exp=audit.expectancy||0,dd=audit.drawdown||0;
    el.innerHTML=`<div class="metric-row"><span class="metric-label">盈亏比</span><span class="metric-value ${pf>=1.2?'good':pf>=1.0?'warn':'bad'}">${pf.toFixed(2)}</span></div>
        <div class="metric-row"><span class="metric-label">期望值</span><span class="metric-value ${exp>0?'good':'bad'}">${exp.toFixed(4)}</span></div>
        <div class="metric-row"><span class="metric-label">最大回撤</span><span class="metric-value ${dd<0.05?'good':dd<0.1?'warn':'bad'}">${fmtPct(dd)}</span></div>
        <div class="metric-row"><span class="metric-label">状态</span><span class="metric-value ${pf>=1.2?'good':'warn'}">${pf>=1.2?'策略强劲':'策略偏弱'}</span></div>`;
}

function renderSlippage(audit){
    const el=document.getElementById('slippage'); if(!audit){el.innerHTML='<span class="loading">暂无数据</span>';return;}
    const ratio=audit.slippage_ratio||0;
    el.innerHTML=`<div class="metric-row"><span class="metric-label">滑点占比</span><span class="metric-value ${ratio<30?'good':ratio<60?'warn':'bad'}">${ratio.toFixed(1)}%</span></div>
        <div style="background:#1e293b;height:20px;border-radius:4px;margin:10px 0;overflow:hidden"><div style="background:${ratio<30?'#22c55e':ratio<60?'#eab308':'#ef4444'};width:${Math.min(ratio,100)}%;height:100%"></div></div>
        <div class="metric-row"><span class="metric-label">主要来源</span><span class="metric-value">${CN.sources[audit.slippage_source]||audit.slippage_source||'未知'}</span></div>`;
}

function renderDiff(diff){
    const el=document.getElementById('diff'); if(!diff||diff.total===0){el.innerHTML='<span class="loading">等待影子模式数据...</span>';return;}
    el.innerHTML=`<div class="metric-row"><span class="metric-label">差异率</span><span class="metric-value ${diff.diff_rate<0.2?'good':diff.diff_rate<0.3?'warn':'bad'}">${fmtPct(diff.diff_rate)}</span></div>
        <div class="metric-row"><span class="metric-label">激进决策</span><span class="metric-value ${diff.over_aggressive===0?'good':'bad'}">${diff.over_aggressive||0} 🚨</span></div>
        <div class="metric-row"><span class="metric-label">保守决策</span><span class="metric-value">${diff.over_conservative||0}</span></div>
        <div class="metric-row"><span class="metric-label">建议</span><span class="metric-value ${diff.recommendation==='PASS'?'good':diff.recommendation==='WARN'?'warn':'bad'}">${CN.recs[diff.recommendation]||diff.recommendation}</span></div>`;
}

function renderRisk(risk){
    const el=document.getElementById('risk'); if(!risk){el.innerHTML='<span class="loading">暂无数据</span>';return;}
    el.innerHTML=`<div class="metric-row"><span class="metric-label">AI 风险等级</span><span class="metric-value ${risk.level==='LOW'?'good':risk.level==='MEDIUM'?'warn':'bad'}">${CN.riskLevels[risk.level]||risk.level}</span></div>
        <div class="metric-row"><span class="metric-label">熔断状态</span><span class="metric-value ${risk.circuit==='NORMAL'?'good':'bad'}">${CN.circuitStates[risk.circuit]||risk.circuit}</span></div>
        <div class="metric-row"><span class="metric-label">资金状态</span><span class="metric-value ${risk.capital==='NORMAL'?'good':risk.capital==='REDUCED'?'warn':'bad'}">${CN.capitalStates[risk.capital]||risk.capital}</span></div>
        <div class="metric-row"><span class="metric-label">当前模式</span><span class="metric-value">${CN.modes[currentMode]||currentMode}</span></div>`;
}

function renderDistribution(diff){
    const el=document.getElementById('distribution'); if(!diff||!diff.distribution){el.innerHTML='<span class="loading">暂无数据</span>';return;}
    let html=''; for(const [k,v] of Object.entries(diff.distribution)){ html+=`<div class="metric-row"><span class="metric-label">${CN.actions[k]||k}</span><span class="metric-value">${v} 笔 (${((v/diff.total)*100).toFixed(1)}%)</span></div>`; }
    el.innerHTML=html;
}

function renderRecent(recent){
    const el=document.getElementById('recent-list'); if(!recent||recent.length===0){el.innerHTML='<span class="loading">暂无决策记录</span>';return;}
    let html=''; for(const item of recent.slice(0,10)){
        const diffClass=item.diff_type==='SAME'?'diff-same':item.diff_type==='CONSERVATIVE'?'diff-conservative':'diff-aggressive';
        const riskClass=item.risk_level==='LOW'?'risk-low':item.risk_level==='MEDIUM'?'risk-medium':'risk-high';
        html+=`<div class="decision-item"><span class="decision-time">${fmtTime(item.timestamp)}</span><span class="decision-id">#${item.signal_id}</span><span class="decision-old">${CN.actions[item.old_action]||item.old_action}</span><span class="decision-arrow">→</span><span class="decision-new">${CN.actions[item.new_action]||item.new_action}</span><span class="decision-diff ${diffClass}">${CN.diffTypes[item.diff_type]||item.diff_type}</span><span class="decision-risk ${riskClass}">${CN.riskLevels[item.risk_level]||item.risk_level}</span></div>`;
    }
    el.innerHTML=html;
}

function updateGoNoGo(diff){
    const el=document.getElementById('go-nogo'), count=diff?.total||0;
    document.getElementById('progress-count').textContent=count;
    if(!diff||count<CONFIG.minSamples){
        el.innerHTML=`<div class="nogo-state"><h2>⛔ 暂不可上线</h2><p>等待影子模式数据积累</p><p class="progress">当前: <span id="progress-count">${count}</span> / ${CONFIG.minSamples} 笔</p><div style="background:#1e293b;height:10px;border-radius:5px;margin-top:15px;overflow:hidden"><div style="background:#ef4444;width:${(count/CONFIG.minSamples)*100}%;height:100%"></div></div></div>`;
    }else if(diff.over_aggressive>0){
        el.innerHTML=`<div class="nogo-state"><h2>⛔ 暂不可上线</h2><p>检测到 ${diff.over_aggressive} 笔激进决策</p><p>新系统比旧系统更激进，禁止切换</p></div>`;
    }else if(diff.diff_rate>CONFIG.maxDiffRate){
        el.innerHTML=`<div class="nogo-state"><h2>⛔ 暂不可上线</h2><p>差异率 ${fmtPct(diff.diff_rate)} 超过阈值 ${fmtPct(CONFIG.maxDiffRate)}</p><p>系统行为变化过大，需要审查</p></div>`;
    }else{
        el.innerHTML=`<div class="go-state"><h2>✅ 可以上线</h2><p>影子模式验证通过</p><p>差异率: ${fmtPct(diff.diff_rate)} | 激进: ${diff.over_aggressive}</p><button class="go-button" onclick="setMode('hybrid')">🚀 切换到混合模式</button></div>`;
    }
}

function updateModeButtons(diff){
    const count=diff?.total||0;
    const canUpgrade=count>=CONFIG.minSamples&&diff.over_aggressive===0&&diff.diff_rate<=CONFIG.maxDiffRate;
    document.getElementById('btn-shadow').disabled=false;
    document.getElementById('btn-hybrid').disabled=!canUpgrade;
    document.getElementById('btn-full').disabled=!canUpgrade||currentMode!=='hybrid';
}

async function setMode(mode){
    const success=await postJSON(CONFIG.apiEndpoints.mode,{mode});
    if(success){
        currentMode=mode;
        document.getElementById('mode-status').textContent=`当前模式: ${CN.modes[mode]||mode}`;
        document.querySelectorAll('.mode-btn').forEach(btn=>btn.classList.remove('active'));
        document.getElementById(`btn-${mode}`).classList.add('active');
        addLog('INFO',`已切换到${CN.modes[mode]||mode}`);
        alert(`已切换到 ${CN.modes[mode]||mode}`);
    }else{
        addLog('ERROR','模式切换失败');
        alert('切换失败');
    }
}

async function loadAll(){
    const [stats,audit,diff,risk,recent]=await Promise.all([
        fetchJSON(CONFIG.apiEndpoints.stats),
        fetchJSON(CONFIG.apiEndpoints.audit),
        fetchJSON(CONFIG.apiEndpoints.diff),
        fetchJSON(CONFIG.apiEndpoints.risk),
        fetchJSON(CONFIG.apiEndpoints.recent)
    ]);
    renderVerdict(stats,audit,diff);
    renderExecution(stats);
    renderEdge(audit);
    renderSlippage(audit);
    renderDiff(diff);
    renderRisk(risk);
    renderDistribution(diff);
    renderRecent(recent);
    document.getElementById('system-uptime').textContent=`运行时间: ${fmtUptime(Date.now()-systemStartTime)}`;
    document.getElementById('last-update').textContent=`最后更新: ${fmtTime(new Date())}`;
}

loadAll();
setInterval(loadAll,CONFIG.refreshInterval);
window.setMode=setMode;
console.log('小龙 Control Tower V3 已启动');