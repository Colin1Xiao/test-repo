#!/usr/bin/env python3
"""
RL 平仓决策方法（修复版）
"""

def rl_exit_decision(position_info, market_state, config):
    """
    RL 平仓决策（修复止盈逻辑）
    """
    try:
        # 提取持仓信息
        unrealized_pnl = position_info.get('upl', 0)
        entry_price = position_info.get('avg_price', 0)
        
        # 提取市场状态
        current_price = market_state.get('price', 0)
        
        # 计算关键指标
        pnl_pct = (current_price - entry_price) / entry_price if entry_price > 0 else 0
        stop_loss_pct = config.get('stop_loss_pct', 0.01)
        take_profit_pct = config.get('take_profit_pct', 0.03)
        
        # 修复的 RL 平仓决策逻辑
        if unrealized_pnl < 0 and abs(pnl_pct) >= stop_loss_pct * 2:
            return "FULL_EXIT"
        elif unrealized_pnl > 0 and pnl_pct >= take_profit_pct:
            return "FULL_EXIT"
        else:
            return "HOLD"
            
    except Exception as e:
        print(f"⚠️  RL 平仓决策异常: {e}")
        return "HOLD"
