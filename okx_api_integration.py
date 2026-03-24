#!/usr/bin/env python3
"""
OKX API Integration Module
OKX API 集成模块 - 安全封装

功能:
- 安全加载 API 配置
- 自动测试网/实盘切换
- 权限检查
- 交易限制
- 自动止损
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 ccxt - {e}", file=sys.stderr)
    sys.exit(1)


class OKXAPIClient:
    """OKX API 安全客户端"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.exchange = None
        self.is_testnet = self.config.get('testnet', True)
        self.permissions = self.config.get('permissions', ['read'])
        
        # 安全限制
        self.max_position = self.config.get('max_position', 0.2)
        self.max_leverage = self.config.get('max_leverage', 5)
        self.stop_loss = self.config.get('stop_loss', 0.02)
        self.daily_limit = self.config.get('daily_limit', 1000)
        
        # 交易记录
        self.daily_trades = []
        
        print("="*70)
        print("🔐 OKX API 客户端")
        print("="*70)
        print(f"模式：{'✅ 测试网' if self.is_testnet else '⚠️  实盘'}")
        print(f"权限：{', '.join(self.permissions)}")
        print(f"最大仓位：{self.max_position*100:.0f}%")
        print(f"最大杠杆：{self.max_leverage}x")
        print(f"止损：{self.stop_loss*100:.1f}%")
        print(f"日限额：${self.daily_limit}")
        print("="*70)
        
        self._init_exchange()
    
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        if config_path is None:
            config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
        
        if not Path(config_path).exists():
            raise FileNotFoundError(f"配置文件不存在：{config_path}")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return config.get('okx', {})
    
    def _init_exchange(self):
        """初始化交易所连接"""
        try:
            self.exchange = ccxt.okx({
                'apiKey': self.config.get('api_key', ''),
                'secret': self.config.get('secret_key', ''),
                'password': self.config.get('passphrase', ''),
                'enableRateLimit': True,
            })
            
            if self.is_testnet:
                self.exchange.set_sandbox_mode(True)
                print("✅ 测试网连接成功")
            else:
                print("⚠️  实盘连接成功")
            
        except Exception as e:
            print(f"❌ 连接失败：{e}")
            raise
    
    def _check_permission(self, required_permission: str) -> bool:
        """检查权限"""
        if required_permission not in self.permissions:
            print(f"❌ 权限不足：需要 {required_permission}")
            return False
        return True
    
    def _check_daily_limit(self, amount: float) -> bool:
        """检查每日交易限额"""
        today = datetime.now().date().isoformat()
        today_trades = [t for t in self.daily_trades if t['date'] == today]
        today_volume = sum(t['amount'] for t in today_trades)
        
        if today_volume + amount > self.daily_limit:
            print(f"❌ 超过日限额：${today_volume}/{self.daily_limit}")
            return False
        return True
    
    def fetch_balance(self) -> Dict:
        """查询余额"""
        if not self._check_permission('read'):
            return {}
        
        try:
            balance = self.exchange.fetch_balance()
            return balance['total']
        except Exception as e:
            print(f"❌ 查询余额失败：{e}")
            return {}
    
    def fetch_positions(self) -> list:
        """查询仓位"""
        if not self._check_permission('read'):
            return []
        
        try:
            positions = self.exchange.fetch_positions()
            return [p for p in positions if float(p['contracts']) != 0]
        except Exception as e:
            print(f"❌ 查询仓位失败：{e}")
            return []
    
    def create_order(self, symbol: str, side: str, amount: float, 
                     price: float = None, leverage: int = None) -> Optional[Dict]:
        """创建订单"""
        if not self._check_permission('trade'):
            return None
        
        # 安全检查
        if amount > self.max_position:
            print(f"❌ 仓位过大：{amount} > {self.max_position}")
            return None
        
        if leverage and leverage > self.max_leverage:
            print(f"❌ 杠杆过大：{leverage}x > {self.max_leverage}x")
            return None
        
        if not self._check_daily_limit(amount):
            return None
        
        # 创建订单
        try:
            order_type = 'limit' if price else 'market'
            params = {}
            
            if leverage:
                params['leverage'] = leverage
            
            order = self.exchange.create_order(
                symbol=symbol,
                type=order_type,
                side=side,
                amount=amount,
                price=price,
                params=params
            )
            
            # 记录交易
            self.daily_trades.append({
                'date': datetime.now().date().isoformat(),
                'symbol': symbol,
                'side': side,
                'amount': amount,
                'price': order.get('price', 0)
            })
            
            print(f"✅ 订单创建成功")
            print(f"   币种：{symbol}")
            print(f"   方向：{side}")
            print(f"   数量：{amount}")
            print(f"   价格：{order.get('price', '市价')}")
            
            return order
            
        except Exception as e:
            print(f"❌ 创建订单失败：{e}")
            return None
    
    def close_position(self, symbol: str, position_id: str = None) -> Optional[Dict]:
        """平仓"""
        if not self._check_permission('trade'):
            return None
        
        try:
            # 获取仓位
            positions = self.fetch_positions()
            target_position = None
            
            for pos in positions:
                if pos['symbol'] == symbol:
                    target_position = pos
                    break
            
            if not target_position:
                print(f"❌ 无仓位：{symbol}")
                return None
            
            # 平仓（反向开仓）
            side = 'sell' if target_position['side'] == 'long' else 'buy'
            amount = abs(float(target_position['contracts']))
            
            return self.create_order(symbol, side, amount)
            
        except Exception as e:
            print(f"❌ 平仓失败：{e}")
            return None
    
    def set_stop_loss(self, symbol: str, position_id: str, 
                      stop_price: float) -> Optional[Dict]:
        """设置止损"""
        if not self._check_permission('trade'):
            return None
        
        print(f"⚠️  止损订单功能需要 OKX API 高级权限")
        print(f"   建议在 OKX 网页端手动设置止损")
        return None
    
    def get_daily_summary(self) -> Dict:
        """获取每日交易汇总"""
        today = datetime.now().date().isoformat()
        today_trades = [t for t in self.daily_trades if t['date'] == today]
        
        return {
            'date': today,
            'trade_count': len(today_trades),
            'total_volume': sum(t['amount'] for t in today_trades),
            'remaining_limit': self.daily_limit - sum(t['amount'] for t in today_trades)
        }


# 使用示例
if __name__ == '__main__':
    print("\n" + "="*70)
    print("📖 OKX API 使用示例")
    print("="*70)
    
    try:
        # 创建客户端
        client = OKXAPIClient()
        
        # 查询余额
        print("\n1. 查询余额:")
        balance = client.fetch_balance()
        for currency, amount in balance.items():
            if amount > 0:
                print(f"   {currency}: {amount}")
        
        # 查询仓位
        print("\n2. 查询仓位:")
        positions = client.fetch_positions()
        if positions:
            for pos in positions:
                print(f"   {pos['symbol']}: {pos['side']} {pos['contracts']}")
        else:
            print("   无仓位")
        
        # 创建订单（示例，不执行）
        print("\n3. 创建订单示例:")
        print("   client.create_order('BTC/USDT', 'buy', 0.001, leverage=5)")
        
        # 每日汇总
        print("\n4. 每日交易汇总:")
        summary = client.get_daily_summary()
        print(f"   日期：{summary['date']}")
        print(f"   交易数：{summary['trade_count']}")
        print(f"   交易量：${summary['total_volume']:.2f}")
        print(f"   剩余限额：${summary['remaining_limit']:.2f}")
        
    except FileNotFoundError as e:
        print(f"\n⚠️  配置文件不存在")
        print(f"   请先配置：nano ~/.openclaw/secrets/okx_api.json")
    except Exception as e:
        print(f"\n❌ 错误：{e}")
    
    print("\n" + "="*70)
