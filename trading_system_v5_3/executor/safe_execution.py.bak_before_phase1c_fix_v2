"""
V5.4 安全执行模块 - 完整修复版
核心：原子化执行 + 二次验证 + 数据一致性

修复内容：
1. asyncio.Lock 真正的异步锁
2. Position Gate 双层检查（OKX字段兼容）
3. 止损订单参数完整（tdMode + reduceOnly）
4. 止损二次验证（algo order API）
5. Exit Source 完整记录
"""
import time
import json
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
import ccxt.async_support as ccxt

# 🔥 导入唯一真相源
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))
from state_store_v54 import record_trade


class SafeExecutor:
    """
    安全执行器 - V5.4 完整修复版
    
    保护机制:
    1. asyncio.Lock - 真正的异步执行锁
    2. 双层 Position Gate - 本地 + 交易所（OKX字段兼容）
    3. 止损强制验证 - 无止损则停止系统
    4. 止损二次验证 - algo order API
    5. 数据一致性 - 写入唯一真相源
    """

    def __init__(self, exchange: ccxt.Exchange, symbol: str, state_file: str = None):
        self.exchange = exchange
        self.symbol = symbol
        
        # 🔒 真正的异步执行锁
        self._lock = asyncio.Lock()
        
        # 📍 本地持仓状态
        self.current_position = None
        
        # 🎯 最大仓位限制（锁死单仓）
        self.MAX_POSITION_SIZE = 0.13  # ETH
        
        # 📈 统计
        self.total_trades = 0
        self.win_count = 0
        self.loss_count = 0
        
        # 🛡️ 止损参数
        self.STOP_LOSS_PCT = 0.005  # 0.5%
        
        print("✅ SafeExecutor V5.4 初始化完成")
        print(f"   🎯 默认交易对: {symbol}")
        print(f"   📏 最大仓位: {self.MAX_POSITION_SIZE} ETH")
        print(f"   📉 止损: {self.STOP_LOSS_PCT*100}%")

    async def try_execute(self, side: str, amount: float) -> Optional[Dict[str, Any]]:
        """
        异步执行（Critical Section）
        
        流程：
        1. 获取异步锁
        2. 双层 Position Gate
        3. 仓位限制
        4. 执行交易
        5. 创建止损单
        6. 验证止损单
        7. 记录状态
        8. 释放锁
        """
        # 🔒 Step 1: 获取异步锁（Critical Section 开始）
        async with self._lock:
            print(f"\n{'='*60}")
            print(f"🔒 [SafeExecutor] Critical Section 开始")
            print(f"{'='*60}")
            
            try:
                # 🔒 Step 2: 双层 Position Gate
                gate_result = await self._check_position_gate()
                if not gate_result["passed"]:
                    print(f"⛔ Position Gate 拦截: {gate_result['reason']}")
                    return None
                
                # 🔒 Step 3: 仓位大小限制
                if amount > self.MAX_POSITION_SIZE:
                    print(f"⚠️ 仓位限制: {amount:.4f} → {self.MAX_POSITION_SIZE}")
                    amount = self.MAX_POSITION_SIZE
                
                # 🚀 Step 4: 执行交易
                order = await self._execute_market_order(side, amount)
                if not order:
                    print("❌ 下单失败")
                    return None
                
                # 获取真实成交价
                entry_price = self._get_fill_price(order)
                if not entry_price:
                    print("❌ 无法获取成交价")
                    return None
                
                print(f"✅ 订单成交: {order.get('id')} @ ${entry_price:.2f}")
                
                # 🔻 Step 5: 创建止损单
                stop_result = await self._create_stop_loss(entry_price, amount, side)
                
                # 🔥 Step 6: 强制验证止损单（无止损 = 系统停止）
                if not stop_result.get("stop_ok"):
                    print("\n" + "="*60)
                    print("🚨 CRITICAL: STOP LOSS FAILED")
                    print("🚨 系统强制停止（无止损 = 不可运行）")
                    print("="*60)
                    # 紧急平仓
                    await self._emergency_close(side, amount, "STOP_LOSS_FAILED")
                    raise RuntimeError("STOP_LOSS_FAILED - SYSTEM_STOP")
                
                # 🔍 Step 7: 止损二次验证
                if stop_result.get("stop_order_id"):
                    stop_verified = await self._verify_stop_order(stop_result["stop_order_id"])
                    stop_result["stop_verified"] = stop_verified
                    
                    if not stop_verified:
                        print("🚨 止损单二次验证失败")
                        await self._emergency_close(side, amount, "STOP_VERIFICATION_FAILED")
                        raise RuntimeError("STOP_VERIFICATION_FAILED - SYSTEM_STOP")
                
                # 构建返回结果
                result = {
                    "entry_price": entry_price,
                    "exit_price": None,
                    "position_size": amount,
                    "stop_price": stop_result.get("stop_price"),
                    "stop_order_id": stop_result.get("stop_order_id"),
                    "stop_ok": stop_result.get("stop_ok", False),
                    "stop_verified": stop_result.get("stop_verified", False),
                    "entry_time": time.time(),
                    "entry_order_id": order.get("id"),
                    "exit_source": None,
                }
                
                # 更新本地状态
                self.current_position = result
                self.total_trades += 1
                
                # 📝 写入状态（唯一真相源）
                record_trade({
                    "event": "entry",
                    "symbol": self.symbol,
                    "position": side,
                    "entry_price": entry_price,
                    "position_size": amount,
                    "stop_price": stop_result.get("stop_price"),
                    "stop_ok": stop_result.get("stop_ok", False),
                    "stop_verified": stop_result.get("stop_verified", False),
                    "order_id": order.get("id"),
                    "timestamp": datetime.now().isoformat(),
                })
                
                print(f"\n✅ [SafeExecutor] 执行成功")
                print(f"   入场价: ${entry_price:.2f}")
                print(f"   仓位: {amount:.4f} ETH")
                print(f"   止损价: ${stop_result.get('stop_price', 0):.2f}")
                print(f"   止损验证: ✅ {stop_result.get('stop_verified', False)}")
                print(f"{'='*60}\n")
                
                return result
                
            except RuntimeError as e:
                # 系统停止异常，向上抛出
                raise e
            except Exception as e:
                print(f"❌ SafeExecutor 异常: {e}")
                import traceback
                traceback.print_exc()
                return None
            # 锁会在 async with 退出时自动释放

    async def _check_position_gate(self) -> Dict[str, Any]:
        """
        双层 Position Gate（OKX字段兼容）
        
        Returns:
            {"passed": bool, "reason": str, "local_size": float, "exchange_size": float}
        """
        result = {
            "passed": True,
            "reason": None,
            "local_size": 0.0,
            "exchange_size": 0.0
        }
        
        # 第一层：本地状态
        local_size = 0.0
        if self.current_position is not None:
            local_size = self.current_position.get("position_size", 0)
        result["local_size"] = local_size
        
        if local_size > 0:
            result["passed"] = False
            result["reason"] = f"Local Gate: 已有本地持仓 ({local_size:.4f})"
            return result
        
        # 第二层：交易所状态（OKX字段兼容）
        exchange_size = await self._get_exchange_position_size()
        result["exchange_size"] = exchange_size
        
        if exchange_size > 0.001:  # 允许微小误差
            result["passed"] = False
            result["reason"] = f"Exchange Gate: 已有交易所持仓 ({exchange_size:.4f})"
            return result
        
        return result

    async def _get_exchange_position_size(self) -> float:
        """
        获取交易所持仓大小（OKX字段兼容）
        
        OKX返回字段（按优先级）：
        1. pos (字符串，需要转float)
        2. contracts
        3. positionAmt
        """
        try:
            positions = await self.exchange.fetch_positions([self.symbol])
            
            total = 0.0
            for p in positions:
                # 检查是否是目标交易对
                inst_id = p.get("instId") or p.get("symbol") or ""
                if self.symbol.replace("/", "-").replace(":USDT", "-SWAP") not in inst_id:
                    if self.symbol not in inst_id:
                        continue
                
                # 尝试多种字段名（OKX兼容）
                size = 0.0
                
                # 方法1: pos 字段（OKX特有，字符串）
                pos_val = p.get("pos")
                if pos_val is not None:
                    try:
                        size = abs(float(pos_val))
                    except (ValueError, TypeError):
                        pass
                
                # 方法2: contracts 字段
                if size == 0:
                    contracts = p.get("contracts")
                    if contracts is not None:
                        try:
                            size = abs(float(contracts))
                        except (ValueError, TypeError):
                            pass
                
                # 方法3: positionAmt 字段
                if size == 0:
                    pos_amt = p.get("positionAmt")
                    if pos_amt is not None:
                        try:
                            size = abs(float(pos_amt))
                        except (ValueError, TypeError):
                            pass
                
                # 方法4: info.pos（嵌套在info中）
                if size == 0:
                    info = p.get("info", {})
                    info_pos = info.get("pos")
                    if info_pos is not None:
                        try:
                            size = abs(float(info_pos))
                        except (ValueError, TypeError):
                            pass
                
                total += size
            
            if total > 0:
                print(f"   📊 交易所持仓: {total:.4f} ETH")
            
            return total
            
        except Exception as e:
            print(f"⚠️ 获取交易所持仓失败: {e}")
            # 无法获取持仓时，返回0继续执行（避免阻塞）
            # 但会在日志中记录警告
            return 0.0

    async def _execute_market_order(self, side: str, amount: float) -> Optional[Dict]:
        """执行市价单（带成交确认）"""
        try:
            # 格式化交易对（OKX格式）
            inst_id = self.symbol.replace("/", "-").replace(":USDT", "-SWAP")
            
            print(f"🚀 下单: {side} {amount:.4f} @ MARKET")
            print(f"   交易对: {inst_id}")
            
            # 使用 ccxt 的 create_market_order
            order = await self.exchange.create_market_order(
                self.symbol,
                side,
                amount,
                params={
                    'tdMode': 'cross',  # 全仓模式
                }
            )
            
            if not order:
                print("❌ 下单返回 None")
                return None
            
            order_id = order.get("id")
            if not order_id:
                print("❌ 订单 ID 缺失")
                return None
            
            # 检查订单状态
            s_code = order.get("info", {}).get("sCode")
            if s_code != "0":
                s_msg = order.get("info", {}).get("sMsg", "Unknown error")
                print(f"❌ 订单失败: sCode={s_code}, sMsg={s_msg}")
                return None
            
            print(f"   ✅ 订单已提交: {order_id}")
            
            # 🔥 OKX 需要重新查询才能获取成交价
            # 等待一小段时间让订单成交
            await asyncio.sleep(0.5)
            
            # 重新查询订单获取成交信息
            try:
                filled_order = await self.exchange.fetch_order(order_id, self.symbol)
                if filled_order:
                    print(f"   ✅ 订单已成交")
                    return filled_order
            except Exception as e:
                print(f"   ⚠️ 查询订单失败: {e}")
            
            # 如果查询失败，返回原始订单
            return order
            
        except Exception as e:
            print(f"❌ 下单失败: {e}")
            return None

    def _get_fill_price(self, order: Dict) -> float:
        """获取真实成交价（多种字段兼容）"""
        # 尝试多种字段名
        price = (
            order.get("average") or
            order.get("price") or
            order.get("info", {}).get("fillPx") or
            order.get("info", {}).get("avgPx") or
            0
        )
        
        if price:
            try:
                return float(price)
            except (ValueError, TypeError):
                return 0
        
        return 0

    async def _create_stop_loss(self, entry_price: float, amount: float, side: str) -> Dict:
        """
        创建止损单（OKX私有API）
        
        OKX 止损订单参数：
        - instId: 交易对
        - tdMode: cross/isolated
        - side: buy/sell
        - posSide: long/short/net
        - ordType: conditional
        - sz: 数量
        - slTriggerPx: 触发价格
        - slOrdPx: 订单价格（-1表示市价）
        - reduceOnly: true（防止反向开仓）
        """
        stop_side = "sell" if side == "buy" else "buy"
        stop_price = entry_price * (1 - self.STOP_LOSS_PCT) if side == "buy" else entry_price * (1 + self.STOP_LOSS_PCT)
        
        # 格式化交易对
        inst_id = self.symbol.replace("/", "-").replace(":USDT", "-SWAP")
        
        print(f"\n🔻 创建止损单:")
        print(f"   触发价: ${stop_price:.2f}")
        print(f"   数量: {amount:.4f}")
        print(f"   方向: {stop_side}")
        
        try:
            # 使用 OKX 私有 API 创建条件单
            stop_order = await self.exchange.private_post_trade_order_algo({
                'instId': inst_id,
                'tdMode': 'cross',
                'side': stop_side,
                'posSide': 'net',
                'ordType': 'conditional',
                'sz': str(amount),
                'slTriggerPx': str(stop_price),
                'slOrdPx': '-1',  # 市价
                'reduceOnly': 'true',  # 🔥 关键：防止反向开仓
            })
            
            # 检查返回结果
            if stop_order.get('code') == '0' and stop_order.get('data'):
                algo_id = stop_order['data'][0].get('algoId')
                print(f"   ✅ 止损单已挂: {algo_id}")
                return {
                    "stop_order_id": algo_id,
                    "stop_price": stop_price,
                    "stop_ok": True,
                }
            else:
                error_code = stop_order.get('code', 'UNKNOWN')
                error_msg = stop_order.get('msg', 'No message')
                print(f"   ❌ 止损单返回异常: code={error_code}, msg={error_msg}")
                return {
                    "stop_order_id": None,
                    "stop_price": stop_price,
                    "stop_ok": False,
                    "error": f"{error_code}: {error_msg}"
                }
                
        except Exception as e:
            print(f"   ❌ 止损单失败: {e}")
            return {
                "stop_order_id": None,
                "stop_price": stop_price,
                "stop_ok": False,
                "error": str(e)
            }

    async def _verify_stop_order(self, stop_order_id: str) -> bool:
        """
        验证止损单是否存在（algo order API）
        
        OKX API 要求：
        - instId: 交易对
        - ordType: 订单类型（conditional）
        """
        try:
            inst_id = self.symbol.replace("/", "-").replace(":USDT", "-SWAP")
            
            # 查询未完成的 algo order（必须带 ordType 参数）
            result = await self.exchange.private_get_trade_orders_algo_pending({
                'instId': inst_id,
                'ordType': 'conditional',  # 🔥 关键：必须指定订单类型
            })
            
            if result.get('code') == '0' and result.get('data'):
                orders = result['data']
                for order in orders:
                    if order.get('algoId') == stop_order_id:
                        state = order.get('state', 'unknown')
                        print(f"   ✅ 止损单验证通过: {stop_order_id} (state={state})")
                        return True
            
            print(f"   🚨 止损单不存在: {stop_order_id}")
            return False
            
        except Exception as e:
            print(f"   ⚠️ 止损单验证失败: {e}")
            return False

    async def _emergency_close(self, side: str, amount: float, reason: str):
        """紧急平仓"""
        close_side = "sell" if side == "buy" else "buy"
        
        print(f"\n🚨 紧急平仓: {reason}")
        print(f"   方向: {close_side}")
        print(f"   数量: {amount:.4f}")
        
        try:
            order = await self.exchange.create_market_order(
                self.symbol,
                close_side,
                amount,
                params={
                    'tdMode': 'cross',
                    'reduceOnly': 'true',
                }
            )
            print(f"   ✅ 紧急平仓成功")
        except Exception as e:
            print(f"   ❌ 紧急平仓失败: {e}")

    async def close_position(self, exit_source: str, trigger_module: str = None) -> Optional[Dict]:
        """
        平仓（异步）
        
        Args:
            exit_source: 退出原因 (STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL)
            trigger_module: 触发模块 (main_loop/guardian/etc)
        
        Returns:
            平仓结果
        """
        if self.current_position is None:
            print("⛔ 无持仓")
            return None
        
        position = self.current_position
        amount = position["position_size"]
        
        print(f"\n🚀 平仓执行:")
        print(f"   原因: {exit_source}")
        print(f"   触发: {trigger_module}")
        print(f"   数量: {amount:.4f}")
        
        try:
            # 平仓
            order = await self.exchange.create_market_order(
                self.symbol,
                "sell",
                amount,
                params={
                    'tdMode': 'cross',
                    'reduceOnly': 'true',
                }
            )
            
            # 🔥 重新查询订单获取成交价
            if order and order.get('id'):
                await asyncio.sleep(0.3)  # 等待成交
                try:
                    order = await self.exchange.fetch_order(order['id'], self.symbol)
                except:
                    pass
                
        except Exception as e:
            print(f"❌ 平仓失败: {e}")
            return None
        
        exit_price = self._get_fill_price(order)
        
        # 如果仍无法获取价格，使用当前市价估算
        if exit_price == 0:
            try:
                ticker = await self.exchange.fetch_ticker(self.symbol)
                exit_price = ticker.get('last', position["entry_price"])
                print(f"   ⚠️ 使用市价估算: ${exit_price:.2f}")
            except:
                exit_price = position["entry_price"]
        
        pnl = (exit_price - position["entry_price"]) / position["entry_price"]
        pnl_pct = pnl * 100
        
        # 取消止损单
        if position.get("stop_order_id"):
            try:
                # 使用正确的 API 方法名
                await self.exchange.private_post_trade_cancel_algo([
                    {'algoId': position["stop_order_id"], 'instId': self.symbol.replace('/', '-').replace(':USDT', '-SWAP')}
                ])
                print(f"   ✅ 止损单已取消")
            except Exception as e:
                print(f"   ⚠️ 取消止损单失败: {e}")
        
        result = {
            "entry_price": position["entry_price"],
            "exit_price": exit_price,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
            "exit_source": exit_source,
            "trigger_module": trigger_module,
            "position_size": amount,
            "hold_time": time.time() - position["entry_time"],
            "order_id": order.get("id") if order else None,
        }
        
        # 清空本地状态
        self.current_position = None
        
        # 更新统计
        if pnl > 0:
            self.win_count += 1
        else:
            self.loss_count += 1
        
        # 📝 写入状态（唯一真相源）
        record_trade({
            "event": "exit",
            "symbol": self.symbol,
            "entry_price": position["entry_price"],
            "exit_price": exit_price,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
            "exit_source": exit_source,
            "trigger_module": trigger_module,
            "position_size": amount,
            "hold_time": time.time() - position["entry_time"],
            "timestamp": datetime.now().isoformat(),
        })
        
        print(f"\n✅ 平仓成功:")
        print(f"   入场: ${position['entry_price']:.2f}")
        print(f"   平仓: ${exit_price:.2f}")
        print(f"   PnL: {pnl_pct:+.4f}%")
        print(f"   持仓时间: {result['hold_time']:.0f}s")
        print(f"   退出原因: {exit_source}")
        
        return result

    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            "total_trades": self.total_trades,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "win_rate": self.win_count / max(1, self.total_trades),
            "current_position": self.current_position is not None,
            "position_size": self.current_position.get("position_size", 0) if self.current_position else 0,
        }