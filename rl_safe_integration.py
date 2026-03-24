#!/usr/bin/env python3
"""
安全的 RL 集成方法
避免直接修改 V3 主文件，使用外部调用
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def safe_rl_evaluate(symbol, analysis, config):
    """
    安全的 RL 评估方法
    返回: ALLOW_ENTRY, REJECT_ENTRY, REDUCE_SIZE
    """
    try:
        from rl_modules.rl_integration import RLIntegration
        
        # 构建状态信息
        state_info = {
            'symbol': symbol,
            'price': analysis.get('technical', {}).get('price', 0),
            'volatility': analysis.get('technical', {}).get('volatility', 0),
            'position': 'none',
            'risk_state': 'normal',
            'cooldown': False,
            'frozen': False
        }
        
        # 获取信号类型
        integrated = analysis.get('integrated', {})
        if integrated.get('signal') == 'STRONG_BUY':
            signal_type = 'STRONG_BUY'
        elif integrated.get('signal') == 'BUY':
            signal_type = 'BUY'
        else:
            return 'ALLOW_ENTRY'  # 默认允许
        
        # 初始化 RL 集成
        rl_integration = RLIntegration(config=config)
        
        # 执行 RL 评估
        rl_decision = rl_integration.evaluate_signal(
            state=state_info,
            rule_signal=signal_type,
            current_position=None
        )
        
        print(f"🤖 RL 安全评估: {symbol} {signal_type} -> {rl_decision}")
        return rl_decision
        
    except Exception as e:
        print(f"⚠️  RL 安全评估失败: {e}")
        return 'ALLOW_ENTRY'  # 失败时默认允许
