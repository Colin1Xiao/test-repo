#!/usr/bin/env python3
"""
强制开仓测试 - 验证执行能力（不走评分逻辑）

目标：验证系统是否能完整执行
IDLE → 开仓 → ENTRY → POSITION → 平仓 → EXIT → IDLE

不验证策略，只验证执行能力
"""

import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'core'))
os.environ['https_proxy'] = 'http://127.0.0.1:7890'

from live_executor import LiveExecutor
from constants import GLOBAL_LEVERAGE


class ExecutionTest:
    """执行能力测试"""
    
    def __init__(self):
        self.state = "IDLE"
        self.test_passed = {
            'order_placed': False,
            'filled': False,
            'position_open': False,
            'position_closed': False,
            'back_to_idle': False,
            'no_exceptions': True
        }
        
    async def run_test(self):
        """运行强制开仓测试"""
        
        print("=" * 60)
        print("🧪 强制开仓测试 - 执行能力验证")
        print("=" * 60)
        print(f"\n测试参数:")
        print(f"  交易对: BTC/USDT:USDT")
        print(f"  仓位: 3 USD")
        print(f"  杠杆: {GLOBAL_LEVERAGE}x")
        print(f"  自动平仓: 10秒后")
        print("")
        
        # 初始化执行器
        print("📋 步骤1: 初始化执行器...")
        
        try:
            executor = LiveExecutor(
                api_key="8705ea66-bb2a-4eb3-b58a-768346d83657",
                api_secret="8D2DF7BEA6EA559FE5BD1F36E11C44B1",
                passphrase="Xzl405026.",
                testnet=False  # 使用实盘
            )
            print("   ✅ 执行器初始化成功")
        except Exception as e:
            print(f"   ❌ 初始化失败: {e}")
            return False
        
        symbol = "BTC/USDT:USDT"
        position_size_usd = 3.0
        
        try:
            # ========== 开仓阶段 ==========
            print(f"\n📋 步骤2: 强制开仓...")
            self.state = "ENTRY"
            
            # 获取当前价格
            bid, ask, mid = await executor.get_best_price(symbol)
            if mid == 0:
                print("   ❌ 无法获取价格")
                await executor.exchange.close()
                return False
            
            print(f"   当前价格: ${mid:,.2f}")
            print(f"   计划仓位: ${position_size_usd}")
            
            # 计算数量（BTC合约最小0.01）
            raw_amount = position_size_usd / ask
            amount = max(0.01, round(raw_amount, 2))
            print(f"   计算数量: {amount} BTC")
            
            # 设置杠杆
            print(f"\n📋 步骤3: 设置杠杆 {GLOBAL_LEVERAGE}x...")
            try:
                # 先设置账户为单向持仓模式
                account_mode = await executor.exchange.private_post_account_set_position_mode({
                    'posMode': 'net_mode'  # 单向持仓模式
                })
                print(f"   持仓模式: {account_mode}")
                
                leverage_result = await executor.exchange.private_post_account_set_leverage({
                    'instId': 'BTC-USDT-SWAP',
                    'lever': str(GLOBAL_LEVERAGE),
                    'mgnMode': 'isolated'
                })
                print(f"   ✅ 杠杆设置成功")
            except Exception as e:
                print(f"   ⚠️ 杠杆设置: {e}")
            
            # 下单
            print(f"\n📋 步骤4: 下市价单...")
            print(f"   [ORDER] leverage={GLOBAL_LEVERAGE}")
            
            try:
                # OKX合约需要指定posSide (单向模式下为'net')
                order = await executor.exchange.create_order(
                    symbol=symbol,
                    type='market',
                    side='buy',
                    amount=amount,
                    params={
                        'tdMode': 'isolated',  # 逐仓模式
                        'lever': str(GLOBAL_LEVERAGE)
                    }
                )
                print(f"   ✅ [ORDER PLACED] 订单ID: {order.get('id')}")
                self.test_passed['order_placed'] = True
            except Exception as e:
                print(f"   ❌ 下单失败: {e}")
                self.test_passed['no_exceptions'] = False
                await executor.exchange.close()
                return False
            
            # 检查成交
            print(f"   订单返回: {order}")
            
            if order:
                # OKX返回格式可能不同
                filled_amount = order.get('filled') or order.get('fillSz') or order.get('accumFill')
                avg_price = order.get('average') or order.get('fillPx') or order.get('avgPx') or ask
                
                if filled_amount and float(filled_amount) > 0:
                    filled_amount = float(filled_amount)
                    avg_price = float(avg_price) if avg_price else ask
                    print(f"   ✅ [FILLED] 成交数量: {filled_amount:.6f} BTC")
                    print(f"   ✅ 成交均价: ${avg_price:,.2f}")
                    print(f"   ✅ 名义价值: ${filled_amount * avg_price:.2f}")
                    self.test_passed['filled'] = True
                else:
                    # 订单已下，可能还在处理中，等待一下
                    print(f"   ⏳ 订单处理中，等待成交...")
                    await asyncio.sleep(2)
                    
                    # 查询订单状态
                    order_id = order.get('id') or order.get('ordId')
                    if order_id:
                        order_info = await executor.exchange.fetch_order(order_id, symbol)
                        print(f"   订单状态: {order_info}")
                        
                        filled_amount = order_info.get('filled') or order_info.get('fillSz')
                        if filled_amount and float(filled_amount) > 0:
                            filled_amount = float(filled_amount)
                            avg_price = float(order_info.get('average') or order_info.get('avgPx') or ask)
                            print(f"   ✅ [FILLED] 成交数量: {filled_amount:.6f} BTC")
                            print(f"   ✅ 成交均价: ${avg_price:,.2f}")
                            self.test_passed['filled'] = True
                        else:
                            print(f"   ❌ 未成交")
                            await executor.exchange.close()
                            return False
                    else:
                        print(f"   ❌ 未成交且无法查询")
                        await executor.exchange.close()
                        return False
            
            # 进入持仓状态
            self.state = "POSITION"
            self.test_passed['position_open'] = True
            print(f"\n✅ [POSITION OPEN] 状态: {self.state}")
            
            # 记录持仓
            position = {
                'entry_price': avg_price,
                'size': filled_amount,
                'entry_time': datetime.now().isoformat()
            }
            executor.open_positions[symbol] = position
            
            # ========== 持仓等待 ==========
            print(f"\n📋 步骤5: 持仓等待 (10秒)...")
            
            for i in range(10, 0, -1):
                print(f"   倒计时: {i}秒", end='\r')
                await asyncio.sleep(1)
            print("")
            
            # ========== 平仓阶段 ==========
            print(f"\n📋 步骤6: 强制平仓...")
            self.state = "EXIT"
            
            try:
                close_order = await executor.exchange.create_order(
                    symbol=symbol,
                    type='market',
                    side='sell',
                    amount=filled_amount,
                    params={
                        'tdMode': 'isolated',
                        'lever': str(GLOBAL_LEVERAGE)
                    }
                )
                print(f"   ✅ 平仓订单ID: {close_order.get('id')}")
                
                # 等待并查询成交状态
                await asyncio.sleep(2)
                close_order_id = close_order.get('id')
                if close_order_id:
                    close_info = await executor.exchange.fetch_order(close_order_id, symbol)
                    
                    exit_filled = close_info.get('filled') or close_info.get('fillSz')
                    if exit_filled and float(exit_filled) > 0:
                        exit_price = float(close_info.get('average') or close_info.get('avgPx'))
                        pnl_pct = (exit_price - avg_price) / avg_price * 100
                        print(f"   ✅ 平仓价格: ${exit_price:,.2f}")
                        print(f"   盈亏: {pnl_pct:+.4f}%")
                        self.test_passed['position_closed'] = True
                    else:
                        print(f"   ❌ 平仓未成交")
                        print(f"   订单状态: {close_info}")
                        await executor.exchange.close()
                        return False
                else:
                    print(f"   ❌ 无法获取平仓订单ID")
                    await executor.exchange.close()
                    return False
                    
            except Exception as e:
                print(f"   ❌ 平仓失败: {e}")
                self.test_passed['no_exceptions'] = False
                await executor.exchange.close()
                return False
            
            # 回到IDLE
            self.state = "IDLE"
            self.test_passed['back_to_idle'] = True
            if symbol in executor.open_positions:
                del executor.open_positions[symbol]
            print(f"\n✅ [STATE = IDLE] 状态机完成")
            
        except Exception as e:
            print(f"\n❌ 测试异常: {e}")
            self.test_passed['no_exceptions'] = False
            
        finally:
            await executor.exchange.close()
        
        # ========== 结果汇总 ==========
        print("\n" + "=" * 60)
        print("📊 测试结果汇总")
        print("=" * 60)
        
        all_passed = all(self.test_passed.values())
        
        for check, passed in self.test_passed.items():
            status = "✅" if passed else "❌"
            print(f"  {status} {check}: {passed}")
        
        print("\n" + "=" * 60)
        if all_passed:
            print("✅ 执行能力测试通过")
        else:
            print("❌ 执行能力测试失败")
        print("=" * 60)
        
        return all_passed


async def main():
    test = ExecutionTest()
    result = await test.run_test()
    return result

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)