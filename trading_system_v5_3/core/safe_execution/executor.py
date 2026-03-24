"""
Safe Execution V5.4 - 主执行器

核心机制:
1. asyncio.Lock - 原子化执行
2. 双层 Position Gate - 防叠仓
3. 止损强制验证
4. TIME_EXIT 主循环控制
"""

import asyncio
import time
import requests
from typing import Dict, Optional
import ccxt.async_support as ccxt

from .types import TradeResult
from .position_gate import PositionGate
from .stop_loss import StopLossManager
from ..state_store import record_trade


class SafeExecutionV54:
    """V5.4 安全执行层"""
    
    # 常量
    MAX_HOLD_SECONDS = 30
    MAX_POSITION = 0.13
    STOP_LOSS_PCT = 0.005
    
    def __init__(self, exchange, symbol: str = 'ETH/USDT:USDT'):
        self.exchange = exchange
        self.symbol = symbol
        self._lock = asyncio.Lock()
        
        # 子系统
        self.position_gate = PositionGate(exchange, symbol)
        self.stop_loss = StopLossManager(exchange, symbol, self.STOP_LOSS_PCT)
        
        # 状态
        self.current_position: Optional[Dict] = None
        self.stop_order_id: Optional[str] = None
        
        # 统计
        self.stats = {
            'executions': 0,
            'blocked': 0,
            'stop_failures': 0,
            'time_exits': 0,
        }
    
    async def execute_entry(self, signal_price: float, capital_decision=None) -> Optional[Dict]:
        """安全开仓"""
        async with self._lock:
            print(f"\n{'='*50}")
            print(f"🚀 SafeExecution V5.4 开仓")
            print(f"{'='*50}")
            
            # Step 1: Position Gate
            can_open, reason = await self.position_gate.can_open()
            if not can_open:
                print(f"🚫 {reason}")
                self.stats['blocked'] += 1
                return None
            
            print(f"✅ {reason}")
            
            # Step 2: 获取价格
            entry_price = await self._get_price(signal_price)
            
            # Step 3: 计算仓位
            position_size = self._calc_position(capital_decision)
            
            # Step 4: 执行开仓
            order = await self._place_order(position_size)
            if not order:
                return None
            
            # Step 5: 提交止损
            stop_ok, stop_id = await self._place_stop_loss(entry_price, position_size)
            if not stop_ok:
                self.stats['stop_failures'] += 1
                return None
            
            self.stop_order_id = stop_id
            
            # Step 6: 记录仓位
            await self._record_position(entry_price, position_size, capital_decision)
            
            self.stats['executions'] += 1
            print(f"✅ 开仓完成: {position_size:.4f} ETH @ {entry_price:.2f}")
            
            return {'entry_price': entry_price, 'position_size': position_size}
    
    async def _get_price(self, fallback: float) -> float:
        """获取当前价格"""
        try:
            inst_id = self._format_symbol()
            url = f"https://www.okx.com/api/v5/market/books?instId={inst_id}&sz=1"
            resp = requests.get(url, timeout=10)
            data = resp.json()
            if data.get('code') == '0':
                asks = data['data'][0]['asks']
                return float(asks[0][0]) if asks else fallback
        except Exception as e:
            print(f"⚠️ 价格获取失败: {e}")
        return fallback
    
    def _calc_position(self, capital_decision) -> float:
        """计算仓位"""
        if capital_decision:
            return capital_decision.position_size
        return self.MAX_POSITION
    
    async def _place_order(self, size: float) -> Optional[Dict]:
        """提交订单"""
        try:
            order = await self.exchange.create_market_buy_order(self.symbol, size)
            return order
        except Exception as e:
            print(f"❌ 开仓失败: {e}")
            return None
    
    async def _place_stop_loss(self, entry: float, size: float) -> tuple:
        """提交止损"""
        return await self.stop_loss.place_stop_loss(entry, size, 'long')
    
    async def _record_position(self, entry: float, size: float, decision):
        """记录仓位"""
        position = {
            'entry_price': entry,
            'size': size,
            'entry_time': time.time(),
            'margin_usdt': decision.margin_usdt if decision else 0,
            'notional_usdt': decision.notional_usdt if decision else 0,
            'capital_state': decision.capital_state if decision else 'LEGACY',
        }
        self.current_position = position
        await self.position_gate.set_position(position)
    
    async def execute_exit(self, exit_source: str = "TIME_EXIT") -> Optional[TradeResult]:
        """安全平仓"""
        if not self.current_position:
            return None
        
        position = self.current_position
        
        # 执行平仓
        try:
            await self.exchange.create_market_sell_order(self.symbol, position['size'])
            
            # 获取退出价格
            exit_price = await self._get_price(position['entry_price'])
            
            # 计算盈亏
            pnl = (exit_price - position['entry_price']) / position['entry_price']
            
            # 清理
            await self._cleanup()
            
            if exit_source == "TIME_EXIT":
                self.stats['time_exits'] += 1
            
            return TradeResult(
                entry_price=position['entry_price'],
                exit_price=exit_price,
                pnl=pnl,
                exit_source=exit_source,
                position_size=position['size'],
                **{k: v for k, v in position.items() if k not in ['entry_price', 'size']}
            )
            
        except Exception as e:
            print(f"❌ 平仓失败: {e}")
            return None
    
    async def _cleanup(self):
        """清理状态"""
        self.current_position = None
        self.stop_order_id = None
        await self.position_gate.clear_position()
    
    def _format_symbol(self) -> str:
        """格式化交易对"""
        return self.symbol.replace("/", "-").replace(":USDT", "-SWAP")
    
    def get_stats(self) -> Dict:
        """获取统计"""
        return self.stats.copy()