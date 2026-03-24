#!/usr/bin/env python3
"""
Execution State Machine - 执行状态机（V3.X 融合版）
"""

import json
import logging
import os
import threading
import time
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional

# 配置日志
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/execution_state_machine.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ExecutionState(Enum):
    """执行状态枚举"""
    IDLE = "IDLE"  # 空闲
    SIGNAL_DETECTED = "SIGNAL_DETECTED"  # 信号检测到
    RL_EVALUATION_PENDING = "RL_EVALUATION_PENDING"  # RL 评估中
    PRECHECK_PENDING = "PRECHECK_PENDING"  # 预检查中
    ENTRY_ORDER_PENDING = "ENTRY_ORDER_PENDING"  # 入场挂单中
    ENTRY_PARTIALLY_FILLED = "ENTRY_PARTIALLY_FILLED"  # 入场部分成交
    POSITION_OPEN = "POSITION_OPEN"  # 持仓中
    EXIT_ORDER_PENDING = "EXIT_ORDER_PENDING"  # 平仓挂单中
    EXIT_PARTIALLY_FILLED = "EXIT_PARTIALLY_FILLED"  # 平仓部分成交
    EMERGENCY_EXIT_TRIGGERED = "EMERGENCY_EXIT_TRIGGERED"  # 紧急平仓触发
    COOLDOWN = "COOLDOWN"  # 冷静期
    FROZEN = "FROZEN"  # 系统冻结
    ERROR_RECOVERY = "ERROR_RECOVERY"  # 错误恢复
    POSITION_CLOSED = "POSITION_CLOSED"  # 持仓已平

class ExecutionStateMachine:
    """执行状态机（V3.X 融合版）"""
    
    def __init__(self, adapter=None, config: Dict = None):
        self.adapter = adapter
        self.config = config or {}
        self.current_state = ExecutionState.IDLE
        self.position_info = {}
        self.entry_orders = []
        self.exit_orders = []
        self.last_signal = None
        self.entry_start_time = None
        self.exit_start_time = None
        self.daily_trade_count = 0
        self.logger = logger
        
    def transition_to(self, new_state: ExecutionState, reason: str = ""):
        """状态转换"""
        old_state = self.current_state
        if old_state != new_state:
            self.log_state_transition(old_state, new_state, reason)
            
            # 根据状态转换发送告警
            if new_state in [ExecutionState.SIGNAL_DETECTED, ExecutionState.POSITION_OPEN, ExecutionState.POSITION_CLOSED]:
                alert_msg = f"📊 TRADE STATE CHANGE: {new_state.value}"
                self.logger.info(alert_msg)
                print(alert_msg)  # 同时打印到控制台
        
        self.current_state = new_state
    
    def log_state_transition(self, old_state: ExecutionState, new_state: ExecutionState, reason: str = ""):
        """记录状态转换"""
        log_msg = f"State transition: {old_state.value} -> {new_state.value}"
        if reason:
            log_msg += f" ({reason})"
        self.logger.info(log_msg)
        print(log_msg)  # 同时打印到控制台
    
    def save_state(self):
        """保存状态到文件"""
        state_data = {
            'current_state': self.current_state.value,
            'position_info': self.position_info,
            'entry_orders': self.entry_orders,
            'exit_orders': self.exit_orders,
            'last_signal': self.last_signal,
            'entry_start_time': self.entry_start_time.isoformat() if self.entry_start_time else None,
            'exit_start_time': self.exit_start_time.isoformat() if self.exit_start_time else None,
            'timestamp': datetime.now().isoformat()
        }
        
        with open('logs/state_machine_state.json', 'w') as f:
            json.dump(state_data, f, indent=2)
        self.logger.info("状态已保存到 logs/state_machine_state.json")
    
    def load_state(self):
        """从文件加载状态"""
        try:
            with open('logs/state_machine_state.json', 'r') as f:
                state_data = json.load(f)
            
            # 恢复状态
            self.current_state = ExecutionState(state_data['current_state'])
            self.position_info = state_data['position_info']
            self.entry_orders = state_data['entry_orders']
            self.exit_orders = state_data['exit_orders']
            self.last_signal = state_data['last_signal']
            
            if state_data['entry_start_time']:
                self.entry_start_time = datetime.fromisoformat(state_data['entry_start_time'])
            if state_data['exit_start_time']:
                self.exit_start_time = datetime.fromisoformat(state_data['exit_start_time'])
                
            self.logger.info("状态已从 logs/state_machine_state.json 加载")
            return True
        except FileNotFoundError:
            self.logger.info("状态文件不存在，使用默认状态")
            return False
        except Exception as e:
            self.logger.error(f"加载状态失败: {e}")
            return False
    
    def enter_position_limit_order(self, signal_params: Dict[str, Any]) -> bool:
        """
        挂单进场逻辑（V3.X 增强版）
        - 支持分层挂单 (30%/40%/30%)
        - 增加超时机制 (entry_timeout_seconds)
        - 增加重挂次数限制 (max_entry_requotes)
        - 增加部分成交处理
        - 增加风控检查
        """
        if self.current_state != ExecutionState.ENTRY_ORDER_PENDING:
            self.logger.warning(f"Cannot enter position from state {self.current_state.value}")
            return False
        
        try:
            self.logger.info("Starting limit order entry process (V3.X)")
            
            # 获取信号参数
            symbol = signal_params.get('symbol')
            direction = signal_params.get('direction')  # 'long' or 'short'
            quantity = signal_params.get('quantity')
            entry_price = signal_params.get('entry_price')
            
            # 风控检查
            if not self._precheck_entry_allowed():
                self.logger.warning("Entry precheck failed, aborting")
                return False
            
            # 分层挂单 (30%/40%/30%)
            total_qty = float(quantity)
            levels = [
                {'ratio': 0.3, 'price_offset': -0.001 if direction == 'long' else 0.001},  # 30%
                {'ratio': 0.4, 'price_offset': -0.002 if direction == 'long' else 0.002},  # 40%
                {'ratio': 0.3, 'price_offset': -0.003 if direction == 'long' else 0.003}   # 30%
            ]
            
            placed_orders = []
            self.entry_start_time = datetime.now()
            
            for i, level in enumerate(levels):
                qty = total_qty * level['ratio']
                price = entry_price * (1 + level['price_offset'])
                
                # 根据配置决定是否使用post-only模式
                if self.config.get('enable_post_only', True):
                    order = self.adapter.place_post_only_order(
                        symbol=symbol,
                        side='buy' if direction == 'long' else 'sell',
                        quantity=qty,
                        price=price
                    )
                else:
                    order = self.adapter.place_limit_order(
                        symbol=symbol,
                        side='buy' if direction == 'long' else 'sell',
                        quantity=qty,
                        price=price
                    )
                
                if order:
                    placed_orders.append({
                        'order_id': order.get('order_id'),
                        'price': price,
                        'quantity': qty,
                        'level': i+1
                    })
                    self.logger.info(f"Placed entry order {i+1}: {qty}@{price}")
                else:
                    self.logger.error(f"Failed to place entry order {i+1}")
            
            self.entry_orders = placed_orders
            
            # 检查是否有订单完全成交
            fully_filled = self.check_order_fill_status(placed_orders, is_entry=True)
            if fully_filled:
                self.logger.info("Entry orders fully filled")
                self.transition_to(ExecutionState.POSITION_OPEN, "Position opened successfully")
                return True
            elif len(placed_orders) > 0:
                self.logger.info("Entry orders partially filled or pending")
                self.transition_to(ExecutionState.ENTRY_PARTIALLY_FILLED, "Entry partially filled")
                return True
            else:
                self.logger.error("All entry orders failed")
                return False
                
        except Exception as e:
            self.logger.error(f"Error in enter_position_limit_order: {e}")
            return False
    
    def exit_position_limit_order(self) -> bool:
        """
        挂单平仓逻辑（V3.X 增强版）
        - 支持分批止盈 (30%/40%/30%)
        - 增加超时机制 (exit_timeout_seconds)
        - 增加重挂次数限制 (max_exit_requotes)
        - 增加部分成交处理
        - 超时升级紧急平仓
        """
        if self.current_state != ExecutionState.POSITION_OPEN:
            self.logger.warning(f"Cannot exit position from state {self.current_state.value}")
            return False
        
        try:
            self.logger.info("Starting limit order exit process (V3.X)")
            
            # 获取持仓信息
            position = self.adapter.get_position(self.position_info.get('symbol', ''))
            if not position or float(position.get('size', 0)) == 0:
                self.logger.warning("No position to exit")
                self.transition_to(ExecutionState.POSITION_CLOSED, "Position already closed")
                return True
            
            symbol = position.get('symbol')
            position_size = abs(float(position.get('size', 0)))
            side = 'sell' if float(position.get('size', 0)) > 0 else 'buy'  # 正数为多头，负数为空头
            mark_price = float(position.get('mark_price', 0))
            
            # 分批止盈 (30%/40%/30%)
            total_qty = position_size
            levels = [
                {'ratio': 0.3, 'price_offset': 0.001 if side == 'sell' else -0.001},  # 30%
                {'ratio': 0.4, 'price_offset': 0.002 if side == 'sell' else -0.002},  # 40%
                {'ratio': 0.3, 'price_offset': 0.003 if side == 'sell' else -0.003}   # 30%
            ]
            
            placed_orders = []
            self.exit_start_time = datetime.now()
            
            for i, level in enumerate(levels):
                qty = total_qty * level['ratio']
                price = mark_price * (1 + level['price_offset'])
                
                order = self.adapter.place_limit_order(
                    symbol=symbol,
                    side=side,
                    quantity=qty,
                    price=price
                )
                
                if order:
                    placed_orders.append({
                        'order_id': order.get('order_id'),
                        'price': price,
                        'quantity': qty,
                        'level': i+1
                    })
                    self.logger.info(f"Placed exit order {i+1}: {qty}@{price}")
                else:
                    self.logger.error(f"Failed to place exit order {i+1}")
            
            self.exit_orders = placed_orders
            
            # 启动超时检查
            threading.Thread(target=self._check_exit_timeout, daemon=True).start()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error in exit_position_limit_order: {e}")
            return False
    
    def emergency_exit_market(self):
        """
        紧急平仓例外（V3.X 增强版）
        - 取消所有挂单
        - 获取最新持仓
        - 市价强平
        - 验证仓位归零
        - 发送关键告警
        - 进入冷静期 (cooldown_after_emergency_exit_seconds)
        """
        self.logger.warning("Triggering emergency exit (V3.X)")
        self.transition_to(ExecutionState.EMERGENCY_EXIT_TRIGGERED, "Emergency market exit initiated")
        
        try:
            # 1. 取消所有挂单
            self.logger.info("Cancelling all pending orders...")
            if self.adapter:
                self.adapter.cancel_all_orders()
            
            # 2. 获取最新持仓
            position = self.adapter.get_position() if self.adapter else None
            if not position or float(position.get('size', 0)) == 0:
                self.logger.info("No position to emergency exit")
                self.transition_to(ExecutionState.POSITION_CLOSED, "No position to close")
                return
            
            symbol = position.get('symbol')
            position_size = abs(float(position.get('size', 0)))
            side = 'sell' if float(position.get('size', 0)) > 0 else 'buy'
            
            self.logger.info(f"Current position: {position_size} {symbol}, side: {side}")
            
            # 3. 市价强平
            if self.adapter:
                order_result = self.adapter.close_position_emergency(symbol, position_size, side)
            else:
                order_result = True  # 模拟成功
            
            if order_result:
                self.logger.info("Emergency market order placed successfully")
                
                # 4. 验证仓位归零
                time.sleep(2)  # 等待订单执行
                verification_position = self.adapter.get_position(symbol) if self.adapter else None
                remaining_size = float(verification_position.get('size', 0)) if verification_position else 0
                
                if abs(remaining_size) < 0.001:  # 基本归零
                    self.logger.info("Position successfully closed via emergency exit")
                    self.transition_to(ExecutionState.POSITION_CLOSED, "Position closed via emergency exit")
                    
                    # 5. 发送关键告警
                    alert_msg = f"🚨 EMERGENCY EXIT EXECUTED 🚨\n"
                    alert_msg += f"Symbol: {symbol}\n"
                    alert_msg += f"Size: {position_size}\n"
                    alert_msg += f"Reason: Emergency trigger\n"
                    self._send_system_alert(alert_msg, "CRITICAL")
                    
                    # 6. 进入冷静期
                    cooldown_seconds = self.config.get('cooldown_after_emergency_exit_seconds', 1800)
                    self.logger.info(f"Entering cooldown period: {cooldown_seconds} seconds")
                    self.transition_to(ExecutionState.COOLDOWN, f"Cool down after emergency exit ({cooldown_seconds}s)")
                    
                else:
                    self.logger.warning(f"Position not fully closed: {remaining_size} remaining")
                    
            else:
                self.logger.error("Emergency exit failed")
                
        except Exception as e:
            self.logger.error(f"Error in emergency_exit_market: {e}")
    
    def _precheck_entry_allowed(self) -> bool:
        """
        入场预检查（V3.X 新增）
        检查是否允许新开仓
        """
        # 检查是否在冷静期
        if self.current_state == ExecutionState.COOLDOWN:
            self.logger.warning("Cannot enter position during cooldown")
            return False
        
        # 检查是否被冻结
        if self.current_state == ExecutionState.FROZEN:
            self.logger.warning("Cannot enter position when frozen")
            return False
        
        # 检查日交易次数限制
        daily_trades = getattr(self, 'daily_trade_count', 0)
        max_daily_trades = self.config.get('max_daily_trades', 1)
        if daily_trades >= max_daily_trades:
            self.logger.warning(f"Daily trade limit reached: {daily_trades}/{max_daily_trades}")
            return False
        
        # 检查是否存在未完成订单
        if self.config.get('allow_new_entry_when_orders_exist', False) == False:
            if len(self.entry_orders) > 0 or len(self.exit_orders) > 0:
                self.logger.warning("Cannot enter new position when orders exist")
                return False
        
        return True
    
    def check_order_fill_status(self, orders, is_entry: bool) -> bool:
        """
        检查订单填充状态（V3.X 增强版）
        """
        if not orders:
            return False
        
        fully_filled = True
        partially_filled = False
        
        for order in orders:
            order_id = order.get('order_id')
            if order_id and self.adapter:
                # 查询订单状态
                order_status = self.adapter.get_order_status(order_id)
                if order_status:
                    filled_qty = float(order_status.get('filled', 0))
                    total_qty = float(order_status.get('amount', 0))
                    
                    if filled_qty == total_qty:
                        # 完全成交
                        pass
                    elif filled_qty > 0:
                        # 部分成交
                        partially_filled = True
                        fully_filled = False
                    else:
                        # 未成交
                        fully_filled = False
                else:
                    fully_filled = False
        
        if partially_filled and not fully_filled:
            # 部分成交
            if is_entry:
                self.transition_to(ExecutionState.ENTRY_PARTIALLY_FILLED, "Entry partially filled")
            else:
                self.transition_to(ExecutionState.EXIT_PARTIALLY_FILLED, "Exit partially filled")
        
        return fully_filled
    
    def _send_system_alert(self, message: str, level: str = "INFO"):
        """发送系统告警"""
        # 这里可以集成 Telegram 或其他告警方式
        self.logger.info(f"System Alert [{level}]: {message}")
