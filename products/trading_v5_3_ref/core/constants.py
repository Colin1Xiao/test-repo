#!/usr/bin/env python3
"""
全局常量定义
100x杠杆系统 - 所有模块必须使用此常量

⚠️ 单位系统强制规范：
- 所有比例/百分比必须使用 PCT/BPS 常量
- 禁止硬编码小数作为百分比
- 违反此规范的代码将被 assert 拒绝
"""

# ============================================================
# 单位常量 - 强制使用
# ============================================================
PCT = 0.01       # 1% = 0.01
BPS = 0.0001     # 1 basis point = 0.0001
PERCENT = 0.01   # 别名

# ============================================================
# 杠杆配置 - 100x 极限杠杆
# ============================================================
GLOBAL_LEVERAGE = 100  # 强制100x，禁止修改

# ============================================================
# 100x 风控参数（V2 策略 - 更紧止损 + 更快止盈）
# ============================================================
# V2: 止损：0.05% (更紧，快速止损)
GLOBAL_STOP_LOSS_PCT = 0.05 * PCT  # 0.05%

# V2: 止盈：0.15% (更快锁定利润)
GLOBAL_TAKE_PROFIT_PCT = 0.15 * PCT  # 0.15%

# 爆仓前强制退出：-0.4%
LIQUIDATION_EXIT_PCT = -0.4 * PCT  # -0.4%

# V2: 最大持仓时间：45秒
MAX_HOLD_SECONDS = 45

# 滑点熔断阈值：0.08%（MARKET 单正常滑点范围）
# 注：MARKET 单 bid-ask spread 通常在 0.05%~0.1%，0.08% 可容纳正常波动
MAX_SLIPPAGE_PCT = 8 * BPS  # 0.08% = 8 bps (原 5 bps 过于严格)

# 单笔失败冻结阈值：-0.3%
FREEZE_LOSS_PCT = -0.3 * PCT  # -0.3%

# 最小信号评分：70分（V2: 从80提高到70，但增加动量过滤）
MIN_SIGNAL_SCORE = 70

# ============================================================
# 样本过滤器阈值 - 单位明确
# ============================================================
# 执行质量阈值
MIN_EXECUTION_QUALITY = 0.7  # 小数形式，直接比较

# 滑点阈值：0.05% = 5 bps
MAX_SAMPLE_SLIPPAGE = 5 * BPS  # 0.05%

# 延迟阈值：1秒
MAX_SAMPLE_LATENCY = 1.0  # 秒

# 成交比例阈值：80%
MIN_FILL_RATIO = 0.8  # 小数形式

# 价格跳跃阈值：0.05%
MAX_PRICE_JUMP = 5 * BPS  # 0.05%

# ============================================================
# 仓位限制
# ============================================================
MAX_POSITION_USD = 3  # 最大仓位3 USD

# ============================================================
# 验证函数
# ============================================================
def validate_leverage(leverage: int) -> bool:
    """验证杠杆是否为100x"""
    if leverage != GLOBAL_LEVERAGE:
        raise ValueError(f"LEVERAGE_MISMATCH: 期望 {GLOBAL_LEVERAGE}, 实际 {leverage}")
    return True

def validate_config():
    """启动时验证配置一致性"""
    assert GLOBAL_LEVERAGE == 100, "杠杆必须为100x"
    # 止损方向由外部处理，这里只检查绝对值
    assert abs(GLOBAL_STOP_LOSS_PCT) < 1 * PCT, "止损不能超过1%"
    assert MAX_SLIPPAGE_PCT < 10 * BPS, "滑点熔断阈值不能超过0.1%"
    
    # 单位系统断言
    assert PCT == 0.01, "PCT单位定义错误"
    assert BPS == 0.0001, "BPS单位定义错误"
    assert MAX_SAMPLE_SLIPPAGE == 0.0005, "滑点阈值单位错误"
    
    print("✅ 100x配置验证通过 (V2 策略)")
    print(f"   杠杆: {GLOBAL_LEVERAGE}x")
    print(f"   止损: -{GLOBAL_STOP_LOSS_PCT/PCT}%")
    print(f"   止盈: {GLOBAL_TAKE_PROFIT_PCT/PCT}%")
    print(f"   最大持仓: {MAX_HOLD_SECONDS}s")
    print(f"   最小评分: {MIN_SIGNAL_SCORE}")
    print(f"   V2 Entry: score≥70 + volume≥1.2x + momentum≥0.15%")
    return True

def assert_unit_valid(value: float, name: str, max_pct: float = 0.1):
    """
    断言单位有效性
    
    Args:
        value: 待检查的值
        name: 参数名称
        max_pct: 最大允许百分比（默认10%）
    
    用途：防止单位混淆
    - 如果 value > max_pct，说明可能用了百分比数值但忘记 * PCT
    """
    assert value < max_pct, f"UNIT_ERROR: {name}={value} 过大，可能单位混淆（期望小数形式，如 0.005 而非 0.5）"


if __name__ == "__main__":
    validate_config()
    print(f"\n单位常量:")
    print(f"  PCT = {PCT} (1%)")
    print(f"  BPS = {BPS} (1 basis point)")
    print(f"\n风控参数:")
    print(f"  止损: {GLOBAL_STOP_LOSS_PCT/PCT}% = {GLOBAL_STOP_LOSS_PCT}")
    print(f"  止盈: {GLOBAL_TAKE_PROFIT_PCT/PCT}% = {GLOBAL_TAKE_PROFIT_PCT}")
    print(f"  最大滑点: {MAX_SAMPLE_SLIPPAGE/BPS} bps = {MAX_SAMPLE_SLIPPAGE}")