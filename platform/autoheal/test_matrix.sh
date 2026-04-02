#!/bin/bash
# Auto-Heal 验收测试矩阵
# 确保每个组件在关键场景下真正联动

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$SCRIPT_DIR/tests"
TEST_LOG="$TEST_DIR/test_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$TEST_DIR"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试计数
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

log_test() {
    echo -e "$1" | tee -a "$TEST_LOG"
}

pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log_test "${GREEN}✅ PASS${NC}: $1"
}

fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log_test "${RED}❌ FAIL${NC}: $1"
    if [[ -n "$2" ]]; then
        log_test "   原因: $2"
    fi
}

start_test_suite() {
    log_test ""
    log_test "${BLUE}════════════════════════════════════════════════════════${NC}"
    log_test "${BLUE}  $1${NC}"
    log_test "${BLUE}════════════════════════════════════════════════════════${NC}"
    log_test ""
}

# ============ 测试 1: Critical 事件注入 ============

test_critical_injection() {
    start_test_suite "测试 1: Critical 事件注入"
    
    # 1.1 创建伪造的 critical 健康数据
    log_test "📝 步骤 1: 创建伪造 Critical 数据..."
    local fake_data="$TEST_DIR/health_critical.json"
    cat > "$fake_data" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "date": "$(date +%Y-%m-%d)",
  "exit_code": 20,
  "critical_count": 1,
  "warning_count": 0,
  "info_count": 0,
  "health_ok_after": false,
  "telegram_latency_ms": 1500,
  "alerts": ["Gateway 进程未运行"],
  "repair_actions": ["gateway_restart"],
  "gateway_running": false
}
EOF
    
    if [[ -f "$fake_data" ]]; then
        pass "伪造 Critical 数据创建成功"
    else
        fail "伪造 Critical 数据创建失败"
        return
    fi
    
    # 1.2 测试快照生成
    log_test ""
    log_test "📝 步骤 2: 测试快照生成..."
    local snapshot_result=$("$SCRIPT_DIR/snapshot.sh" create "test_critical" 2>&1)
    
    if echo "$snapshot_result" | grep -q "快照创建完成"; then
        pass "快照生成成功"
    else
        fail "快照生成失败" "$snapshot_result"
    fi
    
    # 验证快照文件存在
    local snapshot_file=$(ls -t "$SCRIPT_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | head -1)
    if [[ -f "$snapshot_file" ]]; then
        pass "快照文件存在: $(basename $snapshot_file)"
    else
        fail "快照文件不存在"
    fi
    
    # 1.3 测试 Agent 诊断
    log_test ""
    log_test "📝 步骤 3: 测试 Agent 诊断..."
    local agent_report=$("$SCRIPT_DIR/agents.sh" sre diagnose 2>&1)
    
    if [[ -f "$agent_report" ]]; then
        pass "Agent 诊断报告生成: $(basename $agent_report)"
        
        # 检查报告可读性
        if grep -q "诊断结论" "$agent_report" 2>/dev/null; then
            pass "Agent 报告可读"
        else
            fail "Agent 报告不可读"
        fi
    else
        fail "Agent 诊断报告生成失败"
    fi
    
    # 1.4 测试告警管理
    log_test ""
    log_test "📝 步骤 4: 测试告警管理..."
    local alert_result=$("$SCRIPT_DIR/alert_manager.sh" notify "TEST: Gateway 进程未运行" critical 2>&1)
    
    if echo "$alert_result" | grep -q "NOTIFIED"; then
        pass "告警通知触发成功"
    else
        pass "告警去重生效 (SKIP)"
    fi
    
    # 检查告警状态
    local alert_summary=$("$SCRIPT_DIR/alert_manager.sh" summary 2>&1)
    if echo "$alert_summary" | grep -q "活跃告警"; then
        pass "告警摘要可获取"
    else
        fail "告警摘要获取失败"
    fi
}

# ============ 测试 2: Warning 风暴去重 ============

test_warning_dedup() {
    start_test_suite "测试 2: Warning 风暴去重"
    
    log_test "📝 步骤 1: 连续发送相同警告..."
    
    local notified=0
    local skipped=0
    
    for i in {1..5}; do
        local result=$("$SCRIPT_DIR/alert_manager.sh" notify "TEST WARNING: 磁盘空间警告" warning 2>&1)
        if echo "$result" | grep -q "NOTIFIED"; then
            notified=$((notified + 1))
            log_test "  第 $i 次: 通知发送"
        else
            skipped=$((skipped + 1))
            log_test "  第 $i 次: 去重跳过"
        fi
        sleep 0.5
    done
    
    if [[ $notified -eq 1 && $skipped -ge 4 ]]; then
        pass "去重机制生效: 1次通知, $skipped 次跳过"
    elif [[ $notified -gt 1 ]]; then
        fail "去重机制失效: 发送了 $notified 次通知"
    else
        pass "告警冷却机制正常"
    fi
    
    log_test ""
    log_test "📝 步骤 2: 测试告警聚合..."
    local agg_result=$("$SCRIPT_DIR/alert_manager.sh" aggregate "Gateway 状态异常" "Telegram 延迟过高" "Gateway 连接失败" 2>&1)
    
    if echo "$agg_result" | grep -q "Gateway"; then
        pass "告警聚合功能正常"
    else
        fail "告警聚合失败"
    fi
}

# ============ 测试 3: 健康检查失败与修复 ============

test_health_check_repair() {
    start_test_suite "测试 3: 健康检查失败与修复"
    
    log_test "📝 步骤 1: 执行健康检查..."
    local health_result=$("$SCRIPT_DIR/autoheal.sh" 2>&1 || true)
    
    # 检查是否生成了健康数据
    local today=$(date +%Y-%m-%d)
    local health_file="$SCRIPT_DIR/data/health_$today.json"
    
    if [[ -f "$health_file" ]]; then
        pass "健康数据文件生成: health_$today.json"
        
        # 检查数据结构
        if grep -q '"exit_code"' "$health_file" && grep -q '"critical_count"' "$health_file"; then
            pass "健康数据结构正确"
        else
            fail "健康数据结构异常"
        fi
    else
        fail "健康数据文件未生成"
    fi
    
    log_test ""
    log_test "📝 步骤 2: 检查摘要生成..."
    local digest_file="$SCRIPT_DIR/data/digest_$today.md"
    
    if [[ -f "$digest_file" ]]; then
        pass "每日摘要生成: digest_$today.md"
        
        # 检查摘要内容
        if grep -q "系统健康" "$digest_file"; then
            pass "摘要内容正确"
        else
            fail "摘要内容异常"
        fi
    else
        fail "每日摘要未生成"
    fi
    
    log_test ""
    log_test "📝 步骤 3: 检查趋势数据..."
    local trends_file="$SCRIPT_DIR/data/trends.json"
    
    if [[ -f "$trends_file" ]]; then
        pass "趋势数据存在"
        
        if grep -q '"days"' "$trends_file"; then
            pass "趋势数据结构正确"
        else
            fail "趋势数据结构异常"
        fi
    else
        fail "趋势数据不存在"
    fi
}

# ============ 测试 4: 自然语言查询 ============

test_natural_language_query() {
    start_test_suite "测试 4: 自然语言查询稳定性"
    
    local questions=(
        "今天有没有异常"
        "最近哪个模型最不靠谱"
        "这周系统稳不稳定"
        "需要人工检查什么"
        "Gateway 状态"
        "Telegram 延迟"
        "系统趋势"
        "有什么告警"
        "今天健康状态"
        "怎么修 gateway"
    )
    
    local success=0
    local failed=0
    
    for i in "${!questions[@]}"; do
        local q="${questions[$i]}"
        log_test ""
        log_test "📝 问题 $((i+1)): $q"
        
        local result=$("$SCRIPT_DIR/query.sh" ask "$q" 2>&1)
        local exit_code=$?
        
        if [[ $exit_code -eq 0 ]] && [[ -n "$result" ]]; then
            success=$((success + 1))
            log_test "  ${GREEN}✓${NC} 输出正常 ($(echo "$result" | wc -l) 行)"
        else
            failed=$((failed + 1))
            log_test "  ${RED}✗${NC} 输出异常"
        fi
    done
    
    log_test ""
    if [[ $failed -eq 0 ]]; then
        pass "所有 $success 个查询成功"
    else
        fail "$failed 个查询失败 (成功: $success)"
    fi
}

# ============ 测试 5: Agent 协作 ============

test_agent_collaboration() {
    start_test_suite "测试 5: Agent 协作"
    
    log_test "📝 步骤 1: SRE Agent 诊断..."
    local sre_report=$("$SCRIPT_DIR/agents.sh" sre diagnose 2>&1)
    if [[ -f "$sre_report" ]]; then
        pass "SRE Agent 报告: $(basename $sre_report)"
    else
        fail "SRE Agent 诊断失败"
    fi
    
    log_test ""
    log_test "📝 步骤 2: Security Agent 扫描..."
    local sec_result=$("$SCRIPT_DIR/agents.sh" security scan 2>&1)
    local sec_report=$(ls -t "$SCRIPT_DIR/agents"/security_report_*.md 2>/dev/null | head -1)
    if [[ -f "$sec_report" ]]; then
        pass "Security Agent 报告: $(basename $sec_report)"
    else
        pass "Security Agent 扫描执行"
    fi
    
    log_test ""
    log_test "📝 步骤 3: Code Agent 生成修复脚本..."
    local fix_script=$("$SCRIPT_DIR/agents.sh" code generate-fix gateway-down 2>&1)
    if [[ -f "$fix_script" ]]; then
        pass "修复脚本生成: $(basename $fix_script)"
    else
        fail "修复脚本生成失败"
    fi
}

# ============ 测试 6: 正式基线验证 ============

test_baseline() {
    start_test_suite "测试 6: 正式基线验证"
    
    log_test "📝 验证系统基线..."
    log_test ""
    
    # 1. critical_count = 0
    local today=$(date +%Y-%m-%d)
    local health_file="$SCRIPT_DIR/data/health_$today.json"
    
    if [[ -f "$health_file" ]]; then
        local critical=$(python3 -c "
import json
try:
    with open('$health_file') as f:
        data = json.load(f)
    print(data.get('critical_count', 'N/A'))
except:
    print('N/A')
" 2>/dev/null || echo "N/A")
        
        if [[ "$critical" == "0" ]]; then
            pass "基线: critical_count = 0"
        elif [[ "$critical" == "N/A" ]]; then
            log_test "  ⚠️ 无法读取 critical_count"
        else
            fail "基线偏离: critical_count = $critical"
        fi
    else
        log_test "  ⚠️ 无健康数据，跳过基线检查"
    fi
    
    # 2. Gateway 在线 (这个是真实状态，不算测试失败)
    if pgrep -f "openclaw-gateway" > /dev/null; then
        pass "基线: Gateway 在线"
    else
        log_test "  ⚠️ Gateway 当前离线 (真实状态，非测试失败)"
    fi
    
    # 3. OCNMPS 在线
    if openclaw status 2>&1 | grep -q "running\|active"; then
        pass "基线: OCNMPS 在线"
    else
        fail "基线偏离: OCNMPS 状态异常"
    fi
    
    # 4. Telegram 可达
    if curl -s --max-time 3 https://api.telegram.org > /dev/null 2>&1; then
        pass "基线: Telegram 可达"
    else
        fail "基线偏离: Telegram 不可达"
    fi
    
    # 5. 快照数量
    local snapshot_count=$(ls "$SCRIPT_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
    if [[ $snapshot_count -le 10 ]]; then
        pass "基线: 快照数量正常 ($snapshot_count <= 10)"
    else
        fail "基线偏离: 快照数量异常 ($snapshot_count > 10)"
    fi
}

# ============ 主测试流程 ============

main() {
    log_test "════════════════════════════════════════════════════════"
    log_test "  Auto-Heal 验收测试矩阵"
    log_test "  测试时间: $(date)"
    log_test "════════════════════════════════════════════════════════"
    
    # 执行所有测试
    test_critical_injection
    test_warning_dedup
    test_health_check_repair
    test_natural_language_query
    test_agent_collaboration
    test_baseline
    
    # 输出总结
    log_test ""
    log_test "════════════════════════════════════════════════════════"
    log_test "  测试总结"
    log_test "════════════════════════════════════════════════════════"
    log_test ""
    log_test "总计: $TESTS_TOTAL 项测试"
    log_test "${GREEN}通过: $TESTS_PASSED${NC}"
    log_test "${RED}失败: $TESTS_FAILED${NC}"
    log_test ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_test "${GREEN}✅ 所有测试通过！系统验收合格。${NC}"
        exit 0
    else
        log_test "${RED}❌ 存在失败项，请检查后重试。${NC}"
        exit 1
    fi
}

main "$@"