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
from ..state_store import record_trade as record_state_event
from ..state_store_v54 import get_state_store as get_v54_store
from ..constants import GLOBAL_STOP_LOSS_PCT


class SafeExecutionV54:
    """V5.4 安全执行层"""
    
    # 常量
    MAX_HOLD_SECONDS = 30
    MAX_POSITION = 0.13
    STOP_LOSS_PCT = GLOBAL_STOP_LOSS_PCT
    
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
            size = capital_decision.position_size
            # 确保满足交易所最小精度要求
            min_size = 0.01
            if size < min_size:
                print(f"⚠️ 仓位大小 {size:.6f} 小于最小精度 {min_size}，调整为 {min_size}")
                size = min_size
            return size
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
            'equity_usdt': decision.equity_usdt if decision else 0,
            'capital_state': decision.capital_state if decision else 'LEGACY',
            'capital_reason': getattr(decision, 'reason', '') if decision else '',
            'leverage': getattr(decision, 'leverage', 100) if decision else 100,
            'risk_pct': getattr(decision, 'risk_pct', 0.0) if decision else 0.0,
            'trace_id': getattr(decision, 'trace_id', ''),
            'signal_score': getattr(decision, 'signal_score', None),
            'spread_bps': getattr(decision, 'spread_bps', None),
            'volatility': getattr(decision, 'volatility', None),
            'decision_source': getattr(getattr(decision, 'audit_context', {}), 'get', lambda *_: '')('decision_source', '') if decision else '',
        }
        self.current_position = position
        await self.position_gate.set_position(position)

        entry_event = {
            'event': 'entry',
            'symbol': self.symbol,
            'entry_price': entry,
            'position_size': size,
            'margin_usdt': position['margin_usdt'],
            'notional_usdt': position['notional_usdt'],
            'equity_usdt': position['equity_usdt'],
            'capital_state': position['capital_state'],
            'capital_reason': position['capital_reason'],
            'leverage': position['leverage'],
            'risk_pct': position['risk_pct'],
            'stop_ok': self.stop_order_id is not None,
            'stop_verified': self.stop_order_id is not None,
            'trace_id': position.get('trace_id', ''),
            'signal_score': position.get('signal_score'),
            'spread_bps': position.get('spread_bps'),
            'volatility': position.get('volatility'),
            'decision_source': position.get('decision_source', ''),
        }
        try:
            record_state_event(entry_event)
        except Exception as e:
            print(f"⚠️ StateStore(entry) 写入失败: {e}")
        try:
            get_v54_store().record_event('entry', entry_event)
        except Exception as e:
            print(f"⚠️ StateStoreV54(entry) 写入失败: {e}")
    
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
            
            stop_ok = self.stop_order_id is not None
            stop_verified = stop_ok

            exit_event = {
                'event': 'exit',
                'symbol': self.symbol,
                'entry_price': position['entry_price'],
                'exit_price': exit_price,
                'pnl': pnl,
                'exit_source': exit_source,
                'position_size': position['size'],
                'margin_usdt': position.get('margin_usdt', 0.0),
                'notional_usdt': position.get('notional_usdt', 0.0),
                'equity_usdt': position.get('equity_usdt', 0.0),
                'capital_state': position.get('capital_state', 'UNKNOWN'),
                'capital_reason': position.get('capital_reason', ''),
                'leverage': position.get('leverage', 100),
                'risk_pct': position.get('risk_pct', 0.0),
                'stop_ok': stop_ok,
                'stop_verified': stop_verified,
                'trace_id': position.get('trace_id', ''),
                'signal_score': position.get('signal_score'),
                'spread_bps': position.get('spread_bps'),
                'volatility': position.get('volatility'),
                'decision_source': position.get('decision_source', ''),
            }
            try:
                record_state_event(exit_event)
            except Exception as e:
                print(f"⚠️ StateStore(exit) 写入失败: {e}")
            try:
                get_v54_store().record_event('exit', exit_event)
            except Exception as e:
                print(f"⚠️ StateStoreV54(exit) 写入失败: {e}")

            # 清理
            await self._cleanup()
            
            if exit_source == "TIME_EXIT":
                self.stats['time_exits'] += 1
            
            # 构建 TradeResult，只包含 TradeResult 定义的字段
            return TradeResult(
                entry_price=position['entry_price'],
                exit_price=exit_price,
                pnl=pnl,
                exit_source=exit_source,
                position_size=position['size'],
                margin_usdt=position.get('margin_usdt', 0.0),
                notional_usdt=position.get('notional_usdt', 0.0),
                equity_usdt=position.get('equity_usdt', 0.0),
                capital_state=position.get('capital_state', 'UNKNOWN'),
                capital_reason=position.get('capital_reason', ''),
                leverage=position.get('leverage', 100),
                risk_pct=position.get('risk_pct', 0.0),
                stop_ok=stop_ok,
                stop_verified=stop_verified
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
    
    def normalize_order_size(self, symbol: str, requested_size: float, allow_round_up: bool = True) -> float:
        """
        将理论仓位归一化到交易所可执行单位
        
        Args:
            symbol: 交易对
            requested_size: 请求的仓位大小
            allow_round_up: 是否允许向上取整到最小可执行量（MICRO_MODE 下允许）
        
        Returns:
            归一化后的仓位大小，如果无法满足则返回 0
        """
        # ETH/USDT:USDT 最小下单量 = 0.01
        if symbol == "ETH/USDT:USDT":
            min_size = 0.01
            step = 0.01
        else:
            # 默认兜底
            min_size = 0.01
            step = 0.01
        
        # 按步长向下取整
        normalized = (requested_size // step) * step
        
        # 浮点兜底
        normalized = round(normalized, 8)
        
        # 🔥 MICRO_MODE: 如果理论值小于最小可执行量，允许放大到最小可执行量
        if normalized < min_size:
            if allow_round_up:
                print(f"📊 MICRO_MODE: Round up {requested_size:.8f} -> {min_size} (exchange minimum)")
                return min_size
            else:
                return 0.0
        
        return normalized
    
    def effective_risk_pct_after_rounding(
        self,
        normalized_size: float,
        entry_price: float,
        leverage: int,
        equity_usdt: float,
    ) -> float:
        """
        计算归一化后的实际风险比例
        
        Args:
            normalized_size: 归一化后的仓位大小
            entry_price: 入场价格
            leverage: 杠杆倍数
            equity_usdt: 账户权益
        
        Returns:
            实际风险比例
        """
        if equity_usdt <= 0:
            return 0.0
        
        effective_notional = normalized_size * entry_price
        effective_margin = effective_notional / leverage
        return effective_margin / equity_usdt
    
    async def try_execute(self, side: str, size: float, context: Dict = None) -> Optional[Dict]:
        """
        尝试执行交易（统一入口）
        
        Args:
            side: 'buy' 或 'sell'
            size: 仓位大小（理论值）
            context: 上下文信息（margin, notional, equity, capital_state等）
        
        Returns:
            执行结果字典，包含 entry_price, position_size, stop_ok, stop_verified 等
        """
        from types import SimpleNamespace
        
        # 🔥 Step 1: 订单规格归一化
        normalized_size = self.normalize_order_size(self.symbol, size)
        
        if normalized_size <= 0:
            print(f"⛔ BLOCKED: requested_size={size:.8f} below exchange minimum for {self.symbol}")
            return None
        
        # 🔥 Step 2: 重新计算 effective_risk_pct
        entry_price = context.get('entry_price', 0.0) if context else 0.0
        if entry_price <= 0:
            # 尝试获取当前价格
            try:
                entry_price = await self._get_price(0.0)
            except:
                entry_price = 2160.0  # 默认值
        
        equity_usdt = context.get('equity_usdt', 0.0) if context else 0.0
        leverage = context.get('leverage', 100) if context else 100
        
        effective_risk_pct = self.effective_risk_pct_after_rounding(
            normalized_size=normalized_size,
            entry_price=entry_price,
            leverage=leverage,
            equity_usdt=equity_usdt,
        )
        
        # 🔥 Step 3: MICRO_MODE 风险上限检查
        # 生产模式：风险上限 5%；Smoke Test 染式：风险上限 20%
        micro_cap = 0.20 if (context and context.get('smoke_test_mode')) else 0.05
        if effective_risk_pct > micro_cap:
            print(f"⛔ BLOCKED: normalized size raises risk_pct to {effective_risk_pct:.4f} > {micro_cap:.4f}")
            return None
        
        print(f"📊 Order Normalization: {size:.6f} -> {normalized_size:.6f} (effective_risk_pct={effective_risk_pct:.4f})")
        
        # 🔥 Step 4: 构建 capital_decision 对象（使用归一化后的 size）
        if context:
            capital_decision = SimpleNamespace(
                margin_usdt=context.get('margin_usdt', 0),
                notional_usdt=context.get('notional_usdt', 0),
                equity_usdt=equity_usdt,
                capital_state=context.get('capital_state', 'LEGACY'),
                position_size=normalized_size,  # 使用归一化后的 size
                leverage=leverage,
                risk_pct=effective_risk_pct,  # 使用实际风险比例
            )
        else:
            capital_decision = None
        
        # 🔥 Step 5: 调用 execute_entry
        result = await self.execute_entry(entry_price, capital_decision)
        
        if result:
            # 添加 stop_ok 和 stop_verified 字段
            result['stop_ok'] = True
            result['stop_verified'] = self.stop_order_id is not None
            result['stop_price'] = result.get('entry_price', 0) * (1 - self.STOP_LOSS_PCT)
            # 记录理论值和执行值
            result['requested_position_size'] = size
            result['effective_risk_pct'] = effective_risk_pct
        
        return result
    
    async def close_position(self, exit_source: str = "TIME_EXIT", trigger_module: str = "") -> Optional[Dict]:
        """
        平仓（统一入口）
        
        Args:
            exit_source: 退出原因
            trigger_module: 触发模块
        
        Returns:
            平仓结果字典
        """
        result = await self.execute_exit(exit_source)
        
        if result:
            return {
                'entry_price': result.entry_price,
                'exit_price': result.exit_price,
                'pnl_pct': result.pnl * 100,  # 转换为百分比
                'exit_source': result.exit_source,
                'position_size': result.position_size,
                'hold_time': time.time() - (self.current_position.get('entry_time', time.time()) if self.current_position else time.time()),
            }
        return None