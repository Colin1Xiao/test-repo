#!/usr/bin/env python3
"""
UnitGuard - 运行时单位断言系统

核心思想：任何一笔交易，只要单位不对 → 立即中断执行

防止：
- 单位混淆（0.05 vs 0.0005）
- 杠杆错误
- 仓位计算错误
- 魔法数字

用法：
    from core.unit_guard import UnitGuard
    
    UnitGuard.validate_order(
        margin_usd=3,
        leverage=100,
        price=2183,
        amount=0.1376,
        notional_usd=300,
        stop_loss_pct=0.005,
        slippage=0.0005
    )
"""

from typing import Optional
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from constants import (
    GLOBAL_LEVERAGE,
    GLOBAL_STOP_LOSS_PCT,
    MAX_SLIPPAGE_PCT,
    LIQUIDATION_EXIT_PCT,
    PCT, BPS
)


class UnitGuardError(Exception):
    """单位保护触发异常"""
    pass


class UnitGuard:
    """
    运行时单位断言守护者
    
    在以下位置插入检查：
    1. 下单前 - validate_order()
    2. 成交后 - validate_execution()
    3. 平仓时 - validate_pnl()
    """
    
    # 系统安全状态
    SYSTEM_STATE = {
        "unit_safe": True,
        "last_check": None,
        "error_count": 0,
        "last_error": None
    }
    
    @staticmethod
    def validate_order(
        margin_usd: float,
        leverage: int,
        price: float,
        amount: float,
        notional_usd: float,
        stop_loss_pct: float,
        slippage: float = 0
    ) -> bool:
        """
        下单前单位验证
        
        任何一项失败 → 抛出 UnitGuardError
        """
        errors = []
        
        # 1️⃣ 杠杆锁死检查
        if leverage != GLOBAL_LEVERAGE:
            errors.append(f"❌ LEVERAGE_MISMATCH: {leverage} != {GLOBAL_LEVERAGE}")
        
        # 2️⃣ 名义仓位一致性
        expected_notional = margin_usd * leverage
        if abs(notional_usd - expected_notional) > 0.01:
            errors.append(
                f"❌ NOTIONAL_MISMATCH: {notional_usd} != {expected_notional} (margin={margin_usd} × leverage={leverage})"
            )
        
        # 3️⃣ 数量一致性
        if price > 0:
            expected_amount = notional_usd / price
            if abs(amount - expected_amount) / max(expected_amount, 0.0001) > 0.01:
                errors.append(
                    f"❌ AMOUNT_MISMATCH: {amount} != {expected_amount:.6f} (notional={notional_usd} / price={price})"
                )
        
        # 4️⃣ 百分比范围检查
        if not (0 < stop_loss_pct < 0.02):  # 0-2%
            errors.append(f"❌ STOP_LOSS_INVALID: {stop_loss_pct} 不在有效范围 (0, 0.02)")
        
        # 5️⃣ 滑点单位检查（必须是小数形式）
        if slippage > 0.01:  # > 1% 说明可能是百分比形式
            errors.append(
                f"❌ SLIPPAGE_UNIT_ERROR: {slippage} 过大，可能用了百分比形式（应为 0.0005 而非 0.05）"
            )
        
        # 6️⃣ 价格合理性
        if price <= 0:
            errors.append(f"❌ PRICE_INVALID: {price}")
        elif price < 10:
            errors.append(f"⚠️ PRICE_SUSPICIOUS: {price} 过低")
        
        # 7️⃣ 保证金合理性
        if margin_usd <= 0:
            errors.append(f"❌ MARGIN_INVALID: {margin_usd}")
        elif margin_usd > 1000:
            errors.append(f"⚠️ MARGIN_HIGH: {margin_usd} USD")
        
        # 8️⃣ 名义仓位上限（风险控制）
        if notional_usd > 10000:
            errors.append(f"🚨 NOTIONAL_TOO_HIGH: {notional_usd} USD > 10000 USD")
        
        # 如果有错误，抛出异常
        if errors:
            UnitGuard.SYSTEM_STATE["unit_safe"] = False
            UnitGuard.SYSTEM_STATE["error_count"] += 1
            UnitGuard.SYSTEM_STATE["last_error"] = "\n".join(errors)
            
            raise UnitGuardError("\n".join(errors))
        
        # 更新状态
        UnitGuard.SYSTEM_STATE["unit_safe"] = True
        UnitGuard.SYSTEM_STATE["last_check"] = "order_validated"
        
        return True
    
    @staticmethod
    def validate_execution(
        slippage: float,
        delay_ms: float,
        fill_ratio: float = 1.0
    ) -> bool:
        """
        成交后执行质量验证
        """
        errors = []
        
        # 滑点检查
        if slippage > MAX_SLIPPAGE_PCT:
            errors.append(
                f"❌ SLIPPAGE_EXCEEDED: {slippage*100:.4f}% > {MAX_SLIPPAGE_PCT*100:.2f}%"
            )
        
        # 滑点单位检查
        if slippage > 0.01:
            errors.append(
                f"❌ SLIPPAGE_UNIT_ERROR: {slippage} 可能是百分比形式"
            )
        
        # 延迟检查
        if delay_ms > 2000:
            errors.append(f"❌ DELAY_TOO_HIGH: {delay_ms:.0f}ms > 2000ms")
        
        # 成交比检查
        if fill_ratio < 0.8:
            errors.append(f"❌ FILL_RATIO_LOW: {fill_ratio*100:.1f}% < 80%")
        
        if errors:
            UnitGuard.SYSTEM_STATE["unit_safe"] = False
            UnitGuard.SYSTEM_STATE["error_count"] += 1
            UnitGuard.SYSTEM_STATE["last_error"] = "\n".join(errors)
            
            raise UnitGuardError("\n".join(errors))
        
        UnitGuard.SYSTEM_STATE["last_check"] = "execution_validated"
        return True
    
    @staticmethod
    def validate_pnl(
        entry_price: float,
        exit_price: float,
        pnl_pct: float,
        pnl_usd: float = None,
        notional_usd: float = None
    ) -> bool:
        """
        平仓时 PnL 验证
        """
        errors = []
        
        # 计算 PnL 百分比
        real_pct = (exit_price - entry_price) / entry_price
        
        # 验证 pnl_pct 一致性
        if abs(pnl_pct - real_pct) > 0.0001:
            errors.append(
                f"❌ PNL_PCT_MISMATCH: {pnl_pct*100:.4f}% != {real_pct*100:.4f}%"
            )
        
        # 如果提供了 pnl_usd 和 notional_usd，验证一致性
        if pnl_usd is not None and notional_usd is not None:
            expected_pnl_usd = real_pct * notional_usd
            if abs(pnl_usd - expected_pnl_usd) > 0.01:
                errors.append(
                    f"❌ PNL_USD_MISMATCH: {pnl_usd} != {expected_pnl_usd:.2f}"
                )
        
        if errors:
            UnitGuard.SYSTEM_STATE["unit_safe"] = False
            UnitGuard.SYSTEM_STATE["error_count"] += 1
            UnitGuard.SYSTEM_STATE["last_error"] = "\n".join(errors)
            
            raise UnitGuardError("\n".join(errors))
        
        UnitGuard.SYSTEM_STATE["last_check"] = "pnl_validated"
        return True
    
    @staticmethod
    def check_system_safe() -> bool:
        """检查系统是否安全"""
        return UnitGuard.SYSTEM_STATE["unit_safe"]
    
    @staticmethod
    def get_state() -> dict:
        """获取系统状态"""
        return UnitGuard.SYSTEM_STATE.copy()
    
    @staticmethod
    def reset():
        """重置系统状态"""
        UnitGuard.SYSTEM_STATE = {
            "unit_safe": True,
            "last_check": None,
            "error_count": 0,
            "last_error": None
        }


# ============================================================
# 便捷函数
# ============================================================
def guard_order(**kwargs) -> bool:
    """下单前保护（简写）"""
    return UnitGuard.validate_order(**kwargs)


def guard_execution(slippage: float, delay_ms: float, fill_ratio: float = 1.0) -> bool:
    """成交后保护（简写）"""
    return UnitGuard.validate_execution(slippage, delay_ms, fill_ratio)


def guard_pnl(entry_price: float, exit_price: float, pnl_pct: float, **kwargs) -> bool:
    """PnL 保护（简写）"""
    return UnitGuard.validate_pnl(entry_price, exit_price, pnl_pct, **kwargs)


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== UnitGuard 测试 ===\n")
    
    # 测试正常情况
    print("1. 正常订单:")
    try:
        UnitGuard.validate_order(
            margin_usd=3,
            leverage=100,
            price=2183,
            amount=0.1376,
            notional_usd=300,
            stop_loss_pct=0.005,
            slippage=0.0005
        )
        print("   ✅ 通过")
    except UnitGuardError as e:
        print(f"   ❌ {e}")
    
    # 测试杠杆错误
    print("\n2. 杠杆错误:")
    try:
        UnitGuard.validate_order(
            margin_usd=3,
            leverage=50,  # 错误杠杆
            price=2183,
            amount=0.1376,
            notional_usd=150,  # 3 × 50
            stop_loss_pct=0.005,
            slippage=0.0005
        )
        print("   ✅ 通过")
    except UnitGuardError as e:
        print(f"   ❌ {e}")
    
    # 测试滑点单位错误
    print("\n3. 滑点单位错误:")
    try:
        UnitGuard.validate_execution(
            slippage=0.05,  # 5%！可能是百分比形式
            delay_ms=200
        )
        print("   ✅ 通过")
    except UnitGuardError as e:
        print(f"   ❌ {e}")
    
    # 测试执行质量
    print("\n4. 正常执行:")
    try:
        UnitGuard.validate_execution(
            slippage=0.0005,
            delay_ms=195,
            fill_ratio=1.0
        )
        print("   ✅ 通过")
    except UnitGuardError as e:
        print(f"   ❌ {e}")
    
    print("\n=== 系统状态 ===")
    print(json.dumps(UnitGuard.get_state(), indent=2))


import json