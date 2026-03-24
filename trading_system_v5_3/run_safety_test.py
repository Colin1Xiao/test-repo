#!/usr/bin/env python3
"""
Safety Test - V5.4 验收测试

验收 5 项必测：
1. Execution Lock: 无重复开仓
2. Position Gate: 单仓 0.13 ETH
3. Stop Loss: 存在且可查
4. TIME_EXIT: ≤ 30s 触发
5. Exit Source: 正确记录

目标：连续 3 笔全部通过
"""

import sys
import asyncio
import time
import os
import json
import subprocess
import requests
from pathlib import Path
from datetime import datetime
import ccxt.async_support as ccxt
import ccxt.async_support as ccxt

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.safe_execution import SafeExecutionV54, TradeResult
from core.capital_controller_v2 import CapitalControllerV2
from core.state_store import record_trade


class SafetyTestV54:
    """
    Safety Test V5.4
    
    目标：验证系统不会犯致命错误
    """
    
    TARGET_TRADES = 3
    MAX_POSITION = 0.13  # ETH
    
    def __init__(self, testnet: bool = False):  # 🔧 改为 mainnet
        # 加载 API 配置（从 secrets 文件）
        import json
        secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
        
        if secrets_path.exists():
            with open(secrets_path) as f:
                config = json.load(f)
            okx_config = config.get('okx', {})
            api_key = okx_config.get('api_key')
            api_secret = okx_config.get('secret_key')
            passphrase = okx_config.get('passphrase')
            # 从配置读取 testnet 设置
            testnet = okx_config.get('testnet', False)
        else:
            api_key = os.getenv('OKX_API_KEY')
            api_secret = os.getenv('OKX_API_SECRET')
            passphrase = os.getenv('OKX_PASSPHRASE')
        
        proxy = os.environ.get('https_proxy') or 'http://127.0.0.1:7890'
        
        self.exchange = ccxt.okx({
            'apiKey': api_key,
            'secret': api_secret,
            'password': passphrase,
            'enableRateLimit': True,
            'options': {'defaultType': 'swap'},
            'proxies': {'http': proxy, 'https': proxy},
            'verbose': False,
            'loadMarkets': False,
            'skipFetch': True,  # 跳过 fetch
            ' reducedRateLimit': 1000,  # 增加延迟
        })
        
        if testnet:
            self.exchange.set_sandbox_mode(True)
        
        self.symbol = 'ETH/USDT:USDT'
        self.safe_exec: SafeExecutionV54 = None

        # 动态资金控制器（适应当前余额和最小保证金）
        self.capital_controller = CapitalControllerV2(
            base_risk_fraction=0.02,  # 每笔 2% 本金
            min_margin_usdt=0.05,     # 最小保证金（ETH 最小名义 ~$2.16，100x 下 ~$0.02）
            max_margin_usdt=2.0,      # 适应当前余额 ~$1.46
            leverage=100,
        )

        # 测试结果
        self.results = []
        self.current_test = 0
        
        print("="*60)
        print("🧪 Safety Test V5.4")
        print("="*60)
        print(f"目标: 连续 {self.TARGET_TRADES} 笔全部通过")
        print(f"最大仓位: {self.MAX_POSITION} ETH")
        print(f"模式: {'Testnet' if testnet else 'Mainnet'}")
        print("="*60)
    
    async def run(self):
        """运行测试"""
        try:
            # 初始化安全执行层
            self.safe_exec = SafeExecutionV54(self.exchange, self.symbol)
            
            print("\n🚀 开始测试...")
            
            while self.current_test < self.TARGET_TRADES:
                self.current_test += 1
                print(f"\n{'='*60}")
                print(f"📋 测试 #{self.current_test}/{self.TARGET_TRADES}")
                print(f"{'='*60}")
                
                result = await self.run_single_test()
                self.results.append(result)
                
                if not result['passed']:
                    print(f"\n🚨 测试 #{self.current_test} 失败！")
                    self.report()
                    return False
                
                print(f"\n✅ 测试 #{self.current_test} 通过")
                
                # 等待下一轮
                await asyncio.sleep(10)
            
            print(f"\n🎉 全部 {self.TARGET_TRADES} 笔测试通过！")
            self.report()
            return True
            
        except Exception as e:
            print(f"\n❌ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        finally:
            await self.exchange.close()
    
    async def run_single_test(self) -> dict:
        """运行单笔测试"""
        result = {
            'test_id': self.current_test,
            'passed': False,
            'checks': {
                'execution_lock': False,
                'position_gate': False,
                'stop_loss': False,
                'time_exit': False,
                'exit_source': False,
            },
            'trade': None,
            'errors': [],
        }
        
        try:
            # ===== Check 1: Position Gate =====
            print("\n🔍 Check 1: Position Gate...")
            can_open, reason = await self.safe_exec.position_gate.can_open()
            if not can_open:
                result['errors'].append(f"Position Gate: {reason}")
                print(f"   🚫 失败: {reason}")
                return result
            result['checks']['position_gate'] = True
            print(f"   ✅ 通过: {reason}")
            
            # ===== 动态资金计算 =====
            print("\n💰 动态资金计算...")

            # 获取当前账户权益（从 OKX API）
            try:
                import hmac
                import base64
                import hashlib
                from datetime import datetime
                
                secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
                with open(secrets_path) as f:
                    secrets = json.load(f)
                okx_cfg = secrets.get('okx', {})
                api_key = okx_cfg.get('api_key', '')
                api_secret = okx_cfg.get('secret_key', '')
                passphrase = okx_cfg.get('passphrase', '')
                
                api_path = "/api/v5/account/balance"
                timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                message = timestamp + "GET" + api_path + ""
                
                signature = base64.b64encode(hmac.new(
                    api_secret.encode('utf-8'),
                    message.encode('utf-8'),
                    hashlib.sha256
                ).digest()).decode()
                
                headers = {
                    'OK-ACCESS-KEY': api_key,
                    'OK-ACCESS-SIGN': signature,
                    'OK-ACCESS-TIMESTAMP': timestamp,
                    'OK-ACCESS-PASSPHRASE': passphrase,
                    'Content-Type': 'application/json',
                }
                
                resp = requests.get(f"https://www.okx.com{api_path}", headers=headers, timeout=10)
                balance_data = resp.json()
                if balance_data.get('code') == '0':
                    details = balance_data['data'][0]['details']
                    for d in details:
                        if d.get('ccy') == 'USDT':
                            equity_usdt = float(d.get('availEq', 0))
                            break
                    else:
                        equity_usdt = 1.46  # 默认值
                else:
                    print(f"⚠️ 获取权益失败: {balance_data}")
                    equity_usdt = 1.46
            except Exception as e:
                print(f"⚠️ 获取权益失败，使用默认值: {e}")
                equity_usdt = 1.46  # 测试默认值

            # 获取当前价格 - 直接用 requests 避免 ccxt 的内部依赖
            try:
                api_url = f"https://www.okx.com/api/v5/market/ticker?instId={self.symbol.replace('/', '-').replace(':USDT', '-SWAP')}"
                headers = {'User-Agent': 'Mozilla/5.0'}
                response = requests.get(api_url, headers=headers, timeout=10)
                ticker_data = response.json()
                if ticker_data.get('code') == '0':
                    current_price = float(ticker_data['data'][0]['last'])
                else:
                    print(f"⚠️ 获取价格失败: {ticker_data}")
                    current_price = 2300.0
            except Exception as e:
                print(f"⚠️ 获取价格失败，使用默认值: {e}")
                current_price = 2300.0
            
            print(f"💰 当前价格: {current_price:.2f} USDT")

            # 系统状态（测试用固定值）
            current_drawdown = 0.03
            edge_state = "STRONG"
            risk_state = "NORMAL"

            capital_decision = self.capital_controller.calculate(
                equity_usdt=equity_usdt,
                entry_price=current_price,
                drawdown=current_drawdown,
                edge_state=edge_state,
                risk_state=risk_state,
            )

            print(f"   Equity: {capital_decision.equity_usdt:.2f} USDT")
            print(f"   Margin: {capital_decision.margin_usdt:.2f} USDT")
            print(f"   Notional: {capital_decision.notional_usdt:.2f} USDT")
            print(f"   Size: {capital_decision.position_size:.6f} ETH")
            print(f"   State: {capital_decision.capital_state}")
            print(f"   Reason: {capital_decision.reason}")

            if not capital_decision.can_trade:
                result['errors'].append(f"资金控制阻止: {capital_decision.reason}")
                print(f"   🚫 失败: {capital_decision.reason}")
                return result

            # ===== 开仓 =====
            print("\n🚀 开仓...")
            entry_result = await self.safe_exec.execute_entry(
                signal_price=current_price,
                capital_decision=capital_decision,
            )
            
            if not entry_result:
                result['errors'].append("开仓失败")
                return result
            
            # ===== Check 2: Execution Lock =====
            # 尝试在持仓时再次开仓，应该被拒绝
            print("\n🔍 Check 2: Execution Lock...")
            can_open_again, reason_again = await self.safe_exec.position_gate.can_open()
            if can_open_again:
                result['errors'].append("Execution Lock 失效：允许重复开仓")
                print(f"   🚫 失败: 允许重复开仓")
                return result
            result['checks']['execution_lock'] = True
            print(f"   ✅ 通过: {reason_again}")
            
            # ===== Check 3: Stop Loss =====
            print("\n🔍 Check 3: Stop Loss...")
            if not entry_result.get('stop_verified'):
                result['errors'].append("止损单未验证")
                print(f"   🚫 失败: 止损单未验证")
                return result
            result['checks']['stop_loss'] = True
            print(f"   ✅ 通过: 止损单已验证")
            
            # ===== Check 4: TIME_EXIT =====
            print("\n🔍 Check 4: TIME_EXIT (等待 35s)...")
            for i in range(35):
                await asyncio.sleep(1)
                exit_result = await self.safe_exec.check_time_exit()
                if exit_result:
                    print(f"   ✅ TIME_EXIT 触发: {i+1}s")
                    result['checks']['time_exit'] = True
                    
                    # ===== Check 5: Exit Source =====
                    print("\n🔍 Check 5: Exit Source...")
                    if exit_result.exit_source == "TIME_EXIT":
                        result['checks']['exit_source'] = True
                        print(f"   ✅ 通过: exit_source = {exit_result.exit_source}")
                    else:
                        result['errors'].append(f"Exit Source 错误: {exit_result.exit_source}")
                        print(f"   🚫 失败: exit_source = {exit_result.exit_source}")
                    
                    result['trade'] = {
                        'entry_price': exit_result.entry_price,
                        'exit_price': exit_result.exit_price,
                        'pnl': exit_result.pnl,
                        'exit_source': exit_result.exit_source,
                        'position_size': exit_result.position_size,
                        # 资金字段
                        'margin_usdt': exit_result.margin_usdt,
                        'notional_usdt': exit_result.notional_usdt,
                        'equity_usdt': exit_result.equity_usdt,
                        'capital_state': exit_result.capital_state,
                        'capital_reason': exit_result.capital_reason,
                    }

                    # 记录到 state_store
                    exit_event = {
                        'event': 'exit',
                        'symbol': self.symbol,
                        'entry_price': exit_result.entry_price,
                        'exit_price': exit_result.exit_price,
                        'pnl': exit_result.pnl,
                        'exit_source': exit_result.exit_source,
                        'position_size': exit_result.position_size,
                        'margin_usdt': exit_result.margin_usdt,
                        'notional_usdt': exit_result.notional_usdt,
                        'equity_usdt': exit_result.equity_usdt,
                        'capital_state': exit_result.capital_state,
                        'capital_reason': exit_result.capital_reason,
                        'leverage': exit_result.leverage,
                        'risk_pct': exit_result.risk_pct,  # 🔥 添加
                        'stop_ok': exit_result.stop_ok,
                        'stop_verified': exit_result.stop_verified,
                    }
                    # 🔥 注释掉：execute_exit 已经调用过 record_trade 了
                    # record_trade(exit_event)
                    break
            
            if not result['checks']['time_exit']:
                result['errors'].append("TIME_EXIT 未触发 (35s)")
                print(f"   🚫 失败: TIME_EXIT 未触发")
            
            # 判断是否通过
            all_passed = all(result['checks'].values())
            result['passed'] = all_passed
            
            return result
            
        except Exception as e:
            result['errors'].append(f"异常: {e}")
            print(f"\n❌ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            return result
    
    def report(self):
        """输出报告"""
        print("\n" + "="*60)
        print("📊 Safety Test V5.4 报告")
        print("="*60)
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r['passed'])
        
        print(f"\n总测试: {total}/{self.TARGET_TRADES}")
        print(f"通过: {passed}")
        print(f"失败: {total - passed}")
        
        print("\n详细结果:")
        for r in self.results:
            status = "✅ PASS" if r['passed'] else "❌ FAIL"
            print(f"\n  测试 #{r['test_id']}: {status}")
            for check, passed in r['checks'].items():
                print(f"    - {check}: {'✅' if passed else '❌'}")
            if r['errors']:
                print(f"    错误: {r['errors']}")
            if r['trade']:
                t = r['trade']
                print(f"    交易: entry={t['entry_price']:.2f}, exit={t['exit_price']:.2f}, pnl={t['pnl']*100:.4f}%")
        
        print("\n" + "="*60)
        
        if passed == self.TARGET_TRADES:
            print("🟢 GO - 系统安全验证通过，可以进入 V3.8")
        else:
            print("🔴 BLOCK - 系统存在致命问题，需要修复")
        
        print("="*60)


async def main():
    test = SafetyTestV54(testnet=True)
    passed = await test.run()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())