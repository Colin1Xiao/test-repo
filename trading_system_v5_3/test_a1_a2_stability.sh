#!/bin/bash
# =============================================================================
# A1 + A2 稳定性合并测试脚本
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🐉 小龙交易系统 V41 - A1+A2 稳定性测试"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
test_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

test_info() {
    echo -e "${YELLOW}ℹ️${NC}: $1"
}

# =============================================================================
# 准备阶段
# =============================================================================

echo "📦 准备测试环境..."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    test_fail "Python3 未安装"
    exit 1
fi
test_pass "Python3 已安装"

# 检查依赖
if ! python3 -c "import flask" 2>/dev/null; then
    test_fail "Flask 未安装"
    exit 1
fi
test_pass "Flask 已安装"

# 语法检查
test_info "执行语法检查..."
if python3 -m py_compile panel_v40.py && \
   python3 -m py_compile storage_sqlite.py && \
   python3 -m py_compile storage_exceptions.py; then
    test_pass "语法检查通过"
else
    test_fail "语法检查失败"
    exit 1
fi

# =============================================================================
# 启动服务器
# =============================================================================

echo ""
echo "🚀 启动测试服务器..."

# 清理旧进程
if [ -f server.pid ]; then
    OLD_PID=$(cat server.pid)
    if kill -0 $OLD_PID 2>/dev/null; then
        kill $OLD_PID
        test_info "停止旧进程 (PID: $OLD_PID)"
    fi
fi

# 启动新进程
python3 panel_v40.py > server_test.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > server.pid
test_info "服务器已启动 (PID: $SERVER_PID)"

# 等待服务器就绪
sleep 3

# 检查服务器是否运行
if ! kill -0 $SERVER_PID 2>/dev/null; then
    test_fail "服务器启动失败"
    cat server_test.log
    exit 1
fi
test_pass "服务器运行正常"

# =============================================================================
# A1 稳定性测试
# =============================================================================

echo ""
echo "🧪 A1 稳定性测试（前端）"
echo "------------------------"

# 测试 1: 主页面可访问
test_info "测试主页面..."
if curl -s http://localhost:8780/ | grep -q "小龙交易驾驶舱"; then
    test_pass "主页面可访问"
else
    test_fail "主页面无法访问"
fi

# 测试 2: /api/stats 返回数据
test_info "测试 /api/stats..."
RESPONSE=$(curl -s http://localhost:8780/api/stats)
if echo "$RESPONSE" | grep -q '"vm"'; then
    test_pass "/api/stats 返回数据"
else
    test_fail "/api/stats 返回异常"
fi

# 测试 3: /api/health 返回 SQLite 状态
test_info "测试 /api/health..."
RESPONSE=$(curl -s http://localhost:8780/api/health)
if echo "$RESPONSE" | grep -q '"sqlite"'; then
    test_pass "/api/health 包含 SQLite 状态"
else
    test_fail "/api/health 缺少 SQLite 状态"
fi

# =============================================================================
# A2 稳定性测试（后端异常处理）
# =============================================================================

echo ""
echo "🧪 A2 稳定性测试（SQLite 异常处理）"
echo "------------------------------------"

# 测试 4: 正常查询返回统一格式
test_info "测试正常查询响应格式..."
RESPONSE=$(curl -s http://localhost:8780/api/history/alerts?limit=5)
if echo "$RESPONSE" | grep -q '"ok":true' || echo "$RESPONSE" | grep -q '"ok": true'; then
    test_pass "正常查询返回统一格式"
else
    test_fail "正常查询响应格式异常"
fi

# 测试 5: 无效参数返回错误
test_info "测试无效参数处理..."
RESPONSE=$(curl -s http://localhost:8780/api/reports/alerts?days=999)
if echo "$RESPONSE" | grep -q '"ok":false' || echo "$RESPONSE" | grep -q '"error"'; then
    test_pass "无效参数返回错误"
else
    test_fail "无效参数未返回错误"
fi

# 测试 6: 数据库文件不可读
test_info "测试数据库不可读场景..."
if [ -f data/panel_v41.db ]; then
    # 备份权限
    ORIG_PERM=$(stat -f "%OLp" data/panel_v41.db 2>/dev/null || stat -c "%a" data/panel_v41.db)
    
    # 移除读权限
    chmod 000 data/panel_v41.db
    
    # 测试 API
    RESPONSE=$(curl -s http://localhost:8780/api/reports/alerts?days=7)
    
    # 恢复权限
    chmod $ORIG_PERM data/panel_v41.db
    
    if echo "$RESPONSE" | grep -q '"ok":false' || echo "$RESPONSE" | grep -q '"error"'; then
        test_pass "数据库不可读返回错误"
    else
        test_fail "数据库不可读未返回错误"
    fi
else
    test_info "数据库文件不存在，跳过此测试"
fi

# 测试 7: 表缺失
test_info "测试表缺失场景..."
if [ -f data/panel_v41.db ]; then
    # 备份表名
    sqlite3 data/panel_v41.db "ALTER TABLE alerts RENAME TO alerts_test_backup;" 2>/dev/null || true
    
    # 测试 API
    RESPONSE=$(curl -s http://localhost:8780/api/history/alerts?limit=5)
    
    # 恢复表名
    sqlite3 data/panel_v41.db "ALTER TABLE alerts_test_backup RENAME TO alerts;" 2>/dev/null || true
    
    if echo "$RESPONSE" | grep -q '"ok":false' || echo "$RESPONSE" | grep -q '"error"'; then
        test_pass "表缺失返回错误"
    else
        test_fail "表缺失未返回错误"
    fi
else
    test_info "数据库文件不存在，跳过此测试"
fi

# =============================================================================
# 日志检查
# =============================================================================

echo ""
echo "📋 日志检查"
echo "-----------"

# 测试 8: 日志文件存在
if [ -f panel_v41.log ]; then
    test_pass "日志文件已创建"
    
    # 检查日志内容
    if grep -q "panel_v41" panel_v41.log; then
        test_pass "日志包含应用标识"
    else
        test_fail "日志格式异常"
    fi
else
    test_fail "日志文件未创建"
fi

# =============================================================================
# 清理
# =============================================================================

echo ""
echo "🧹 清理测试环境..."

# 停止服务器
kill $SERVER_PID 2>/dev/null || true
rm -f server.pid
test_info "服务器已停止"

# 清理测试日志
rm -f server_test.log

# =============================================================================
# 测试报告
# =============================================================================

echo ""
echo "========================================"
echo "📊 测试报告"
echo "========================================"
echo -e "${GREEN}通过${NC}: $TESTS_PASSED"
echo -e "${RED}失败${NC}: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    echo ""
    echo "📄 详细测试指南:"
    echo "   - A1: A1_STABILITY_TEST.md"
    echo "   - A2: A2_SQLITE_ERROR_HANDLING_TEST.md"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    echo ""
    echo "请检查日志和错误信息"
    exit 1
fi
