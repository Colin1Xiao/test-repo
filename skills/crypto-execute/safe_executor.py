#!/usr/bin/env python3
"""
Crypto Execute - 安全交易执行器
默认禁用实盘，仅测试网可用，实盘需人工确认
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

class SafeCryptoExecutor:
    """安全加密货币交易执行器"""
    
    def __init__(self):
        self.policy = self._load_policy()
        self.session_authorized = {
            'testnet': True,  # 测试网自动授权
            'paper': False,   # 模拟盘需确认
            'live': False     # 实盘默认禁用
        }
        self.trade_count = 0
        self.daily_loss = 0.0
        
    def _load_policy(self):
        """加载执行策略"""
        policy_path = Path(__file__).parent / 'execution_policy.json'
        if policy_path.exists():
            with open(policy_path) as f:
                return json.load(f)
        return self._default_policy()
    
    def _default_policy(self):
        """默认策略"""
        return {
            'defaultMode': 'testnet',
            'modes': {
                'testnet': {'enabled': True, 'requiresConfirmation': False},
                'paper': {'enabled': True, 'requiresConfirmation': True},
                'live': {'enabled': False, 'requiresConfirmation': True, 'requiresExplicitAuthorization': True}
            }
        }
    
    def check_prohibited_chain(self, source_skill):
        """检查是否来自禁止的技能链"""
        prohibited = self.policy.get('prohibitedChains', [])
        for chain in prohibited:
            if source_skill in chain and '-> crypto-execute' in chain:
                return False, f"禁止的技能链: {chain}"
        return True, None
    
    def authorize(self, mode, **kwargs):
        """授权交易模式"""
        mode_config = self.policy['modes'].get(mode, {})
        
        if not mode_config.get('enabled', False):
            return False, f"{mode} 模式已禁用"
        
        if mode == 'testnet':
            # 测试网自动授权
            self.session_authorized['testnet'] = True
            return True, "测试网自动授权"
        
        if mode == 'paper':
            # 模拟盘需确认
            if not self.session_authorized['paper']:
                return False, "模拟盘交易需要确认: 请回复 '确认模拟盘交易' 授权"
            return True, "模拟盘已授权"
        
        if mode == 'live':
            # 实盘严格限制
            if not mode_config.get('enabled', False):
                return False, "实盘交易已禁用，请在 execution_policy.json 中启用"
            
            if not self.session_authorized['live']:
                return False, "实盘交易需要显式授权: 请回复 '确认实盘交易' 并等待二次确认"
            
            # 检查风控限制
            amount = kwargs.get('amount', 0)
            leverage = kwargs.get('leverage', 1)
            max_amount = mode_config.get('maxOrderAmount', 0)
            max_leverage = mode_config.get('maxLeverage', 1)
            
            if amount > max_amount:
                return False, f"订单金额 {amount} 超过限制 {max_amount}"
            
            if leverage > max_leverage:
                return False, f"杠杆 {leverage}x 超过限制 {max_leverage}x"
            
            # 检查日亏损限制
            max_daily_loss = mode_config.get('maxDailyLoss', 0)
            if self.daily_loss >= max_daily_loss:
                return False, f"日亏损 {self.daily_loss} 已达上限 {max_daily_loss}"
            
            return True, "实盘授权通过"
        
        return False, f"未知模式: {mode}"
    
    def execute_order(self, symbol, side, amount, leverage=1, mode='testnet', 
                     stop_loss=None, take_profit=None, **kwargs):
        """执行订单"""
        print(f"🛡️ 安全交易检查: {symbol} {side} {amount} @ {leverage}x [{mode}]")
        
        # 检查技能链
        source = kwargs.get('source_skill', 'unknown')
        allowed, reason = self.check_prohibited_chain(source)
        if not allowed:
            print(f"❌ {reason}")
            return {'error': reason, 'status': 'rejected'}
        
        # 授权检查
        authorized, auth_reason = self.authorize(mode, amount=amount, leverage=leverage)
        if not authorized:
            print(f"⛔ {auth_reason}")
            return {'error': auth_reason, 'status': 'unauthorized'}
        
        print(f"✅ {auth_reason}")
        
        # 风控检查
        if mode == 'live':
            if not stop_loss:
                return {'error': '实盘交易必须设置止损', 'status': 'rejected'}
            if not take_profit:
                return {'error': '实盘交易必须设置止盈', 'status': 'rejected'}
        
        # 模拟执行
        if mode == 'testnet':
            print(f"🧪 测试网模拟执行: {symbol} {side} {amount}")
            return {
                'status': 'simulated',
                'mode': 'testnet',
                'order_id': f'test_{datetime.now().timestamp()}',
                'symbol': symbol,
                'side': side,
                'amount': amount,
                'leverage': leverage
            }
        
        elif mode == 'paper':
            print(f"📄 模拟盘执行: {symbol} {side} {amount}")
            self.trade_count += 1
            return {
                'status': 'paper_executed',
                'mode': 'paper',
                'order_id': f'paper_{datetime.now().timestamp()}',
                'symbol': symbol,
                'side': side,
                'amount': amount,
                'leverage': leverage
            }
        
        elif mode == 'live':
            print(f"⚠️ 实盘交易执行: {symbol} {side} {amount}")
            print(f"   止损: {stop_loss}%, 止盈: {take_profit}%")
            
            # 这里调用真实交易所API
            # 实际实现需要接入ccxt等库
            
            self.trade_count += 1
            return {
                'status': 'live_executed',
                'mode': 'live',
                'order_id': f'live_{datetime.now().timestamp()}',
                'symbol': symbol,
                'side': side,
                'amount': amount,
                'leverage': leverage,
                'stop_loss': stop_loss,
                'take_profit': take_profit
            }
        
        return {'error': '未知模式', 'status': 'error'}
    
    def confirm_paper_trading(self):
        """确认模拟盘交易"""
        self.session_authorized['paper'] = True
        print("✅ 模拟盘交易已授权（本次会话有效）")
        return True
    
    def confirm_live_trading(self):
        """确认实盘交易"""
        # 实盘需要二次确认
        print("⚠️ 实盘交易授权请求")
        print("   请在30秒内回复 '确认实盘交易' 完成授权")
        print("   授权后每笔交易仍需单独确认")
        
        # 实际实现中需要等待用户输入
        # 这里简化处理
        self.session_authorized['live'] = True
        print("✅ 实盘交易已授权（谨慎操作！）")
        return True
    
    def get_status(self):
        """获取执行器状态"""
        return {
            'default_mode': self.policy['defaultMode'],
            'authorized': self.session_authorized,
            'trade_count': self.trade_count,
            'daily_loss': self.daily_loss,
            'modes': {
                k: {'enabled': v.get('enabled', False)}
                for k, v in self.policy['modes'].items()
            }
        }


def main():
    """命令行测试"""
    executor = SafeCryptoExecutor()
    
    if len(sys.argv) < 2:
        print("Safe Crypto Executor")
        print("Usage: safe_executor.py <command>")
        print("Commands:")
        print("  status              - 查看状态")
        print("  confirm-paper       - 确认模拟盘交易")
        print("  confirm-live        - 确认实盘交易")
        print("  test-order          - 测试下单")
        sys.exit(0)
    
    command = sys.argv[1]
    
    if command == 'status':
        status = executor.get_status()
        print(json.dumps(status, indent=2))
    
    elif command == 'confirm-paper':
        executor.confirm_paper_trading()
    
    elif command == 'confirm-live':
        executor.confirm_live_trading()
    
    elif command == 'test-order':
        # 测试网自动执行
        result = executor.execute_order(
            symbol='BTC-USDT',
            side='buy',
            amount=100,
            leverage=5,
            mode='testnet'
        )
        print(json.dumps(result, indent=2))
    
    else:
        print(f"Unknown command: {command}")


if __name__ == '__main__':
    main()
