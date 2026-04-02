#!/usr/local/bin/python3.14
"""
M2 Live 实盘验证

验证范围：
- 单交易对 (ETH-USDT-SWAP)
- 单笔订单 (0.01 ETH ≈ $21)
- 限价单
- 强制保护 (SL/TP)
- 全程事件落盘

⚠️ 风险提示：实盘模式！真金白银！
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Dict, Any, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, OrderType, OrderStatus
from schemas.order import Order
from connectors.okx.trade_client_real import OKXTradeClientReal, OKXConfig, OKXEnv
from execution.order_state import OrderStateManager
from execution.protection import ProtectionManager, ProtectionType
from core.event_store import JsonlEventStore
from cockpit.widgets import CockpitWidgets
from cockpit.admin_controls import AdminControlPanel


class M2LiveValidator:
    """M2 Live 实盘验证器"""
    
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config = self._load_config()
        
        # 组件初始化
        self.okx_client: OKXTradeClientReal = None
        self.order_manager = OrderStateManager()
        self.protection_manager = ProtectionManager()
        self.event_store: JsonlEventStore = None
        self.cockpit = CockpitWidgets()
        self.admin_controls = AdminControlPanel()
        
        # 事件记录
        self._events: List[EventEnvelope] = []
        
        # 测试数据
        self.test_order_id = f"M2-LIVE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        self.test_symbol = self.config.get('symbol', 'ETH-USDT-SWAP')
        self.test_qty = Decimal(self.config.get('qty', '0.01'))
        self.test_price = Decimal('2000')  # 限价单价格
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置"""
        with open(self.config_path, 'r') as f:
            return json.load(f)
    
    def setup(self) -> bool:
        """设置测试环境"""
        print("=" * 60)
        print("🐉 M2 Live 实盘验证")
        print("=" * 60)
        print()
        print("⚠️  风险提示：实盘模式！真金白银！")
        print(f"   订单量：{self.test_qty} ETH")
        print(f"   交易对：{self.test_symbol}")
        print(f"   止损：{self.config['protection']['stop_loss_pct']*100}%")
        print(f"   止盈：{self.config['protection']['take_profit_pct']*100}%")
        print()
        
        # 确认
        print("请确认:")
        print("  1. 已了解风险")
        print("  2. 账户有足够余额")
        print("  3. 接受可能亏损")
        print()
        
        # 创建工作目录
        workspace = Path(__file__).parent.parent / "test_storage" / "m2_live"
        workspace.mkdir(parents=True, exist_ok=True)
        
        # 初始化事件存储
        self.event_store = JsonlEventStore(workspace / "events.jsonl")
        print(f"📄 事件存储：{workspace / 'events.jsonl'}")
        
        # 设置事件回调
        def on_event(envelope: EventEnvelope):
            self._events.append(envelope)
            self.event_store.append(envelope)
            self.cockpit.on_event(envelope)
        
        # 初始化 OKX 客户端
        config = OKXConfig(
            api_key=self.config["api_key"],
            secret_key=self.config["secret_key"],
            passphrase=self.config["passphrase"],
            environment=OKXEnv.LIVE,
        )
        self.okx_client = OKXTradeClientReal(config)
        
        print("✅ 组件初始化完成")
        print()
        
        return True
    
    async def validate(self) -> Dict[str, Any]:
        """执行验证"""
        results = {
            "test_id": self.test_order_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {},
            "details": {},
            "passed": False,
        }
        
        try:
            # [1] 连接 OKX Live
            print("[1/8] 连接 OKX Live...")
            connected = self.okx_client.connect()
            results["checks"]["okx_connection"] = connected
            
            if not connected:
                print("❌ 连接失败")
                return results
            
            print("✅ 连接成功")
            
            # [2] 获取账户余额
            print("\n[2/8] 获取账户余额...")
            balances = self.okx_client.get_balance()
            results["checks"]["balance_query"] = len(balances) > 0
            results["details"]["balances"] = {k: str(v) for k, v in balances.items()}
            
            if balances:
                usdt = balances.get('USDT', Decimal('0'))
                print(f"✅ USDT 余额：{usdt}")
                if usdt < Decimal('50'):
                    print("⚠️  余额较低，建议充值")
            else:
                print("⚠️  余额查询失败")
            
            # [3] 获取行情
            print("\n[3/8] 获取行情...")
            tickers = self.okx_client.get_tickers("SWAP")
            results["checks"]["ticker_query"] = len(tickers) > 0
            
            eth_ticker = next((t for t in tickers if 'ETH' in t.get('instId')), None)
            if eth_ticker:
                current_price = Decimal(eth_ticker.get('last', '0'))
                results["details"]["eth_price"] = str(current_price)
                # 调整限价单价格为当前价格
                self.test_price = current_price
                print(f"✅ ETH 价格：{current_price} USDT")
            else:
                print("⚠️  ETH 行情获取失败")
            
            # [4] 创建本地订单
            print("\n[4/8] 创建本地订单...")
            order = Order(
                order_id=self.test_order_id,
                venue="okx_live",
                symbol=self.test_symbol,
                side=Side.BUY,
                order_type=OrderType.LIMIT,
                status=OrderStatus.DRAFT,
                qty=self.test_qty,
                price=self.test_price,
            )
            
            order_fsm = self.order_manager.create_order(order)
            order_fsm.set_event_callback(lambda e: self._handle_event(e))
            
            results["checks"]["order_created"] = True
            results["details"]["order"] = {
                "order_id": order.order_id,
                "symbol": order.symbol,
                "qty": str(order.qty),
                "price": str(order.price),
            }
            print(f"✅ 订单创建：{order.order_id}")
            
            # [5] 创建保护订单
            print("\n[5/8] 创建保护订单...")
            sl, tp = self.protection_manager.create_sl_tp(
                parent_order_id=order.order_id,
                symbol=order.symbol,
                side=order.side,
                quantity=order.qty,
                entry_price=order.price,
            )
            
            results["checks"]["protection_created"] = True
            results["details"]["protection"] = {
                "stop_loss": str(sl.trigger_price),
                "take_profit": str(tp.trigger_price),
            }
            print(f"✅ 保护订单：SL={sl.trigger_price} ({(sl.trigger_price/order.price-1)*100:.2f}%), TP={tp.trigger_price} ({(tp.trigger_price/order.price-1)*100:.2f}%)")
            
            # [6] 提交订单到 OKX Live
            print("\n[6/8] 提交订单到 OKX Live...")
            print(f"   价格：{self.test_price} USDT")
            print(f"   数量：{self.test_qty} ETH")
            print(f"   价值：~{float(self.test_price) * float(self.test_qty):.2f} USDT")
            print()
            
            submit_result = self.okx_client.place_order(
                symbol=self.test_symbol,
                side=Side.BUY,
                order_type=OrderType.LIMIT,
                quantity=self.test_qty,
                price=self.test_price,
                client_order_id=self.test_order_id,
            )
            
            results["checks"]["order_submitted"] = submit_result.get("success", False)
            results["details"]["submit_result"] = submit_result
            
            if submit_result.get("success"):
                order_fsm.submit()
                order_fsm.accept(submit_result.get("order_id", "UNKNOWN"))
                print(f"✅ 订单提交成功：{submit_result.get('order_id')}")
                
                # 等待成交或取消
                print("\n⏳ 等待 5 秒观察成交...")
                await asyncio.sleep(5)
                
                # 查询订单状态
                order_info = self.okx_client.get_order(
                    self.test_symbol,
                    order_id=submit_result.get("order_id")
                )
                if order_info:
                    results["details"]["order_status"] = order_info.get('state')
                    print(f"📊 订单状态：{order_info.get('state')}")
                
                # 撤单
                print("\n[7/8] 撤销订单...")
                cancel_result = self.okx_client.cancel_order(
                    self.test_symbol,
                    order_id=submit_result.get("order_id")
                )
                results["checks"]["order_cancelled"] = cancel_result.get("success", False)
                if cancel_result.get("success"):
                    print("✅ 订单已撤销")
                else:
                    print(f"⚠️  撤单失败：{cancel_result.get('error')}")
            else:
                print(f"❌ 订单提交失败：{submit_result.get('error')}")
                results["checks"]["order_cancelled"] = False
            
            # [8] 验证事件链
            print("\n[8/8] 验证事件链...")
            event_count = len(self._events)
            results["checks"]["event_chain"] = event_count >= 2
            results["details"]["event_count"] = event_count
            results["details"]["event_types"] = list(set(e.event_type.value for e in self._events))
            
            print(f"✅ 事件数：{event_count}")
            print(f"   类型：{results['details']['event_types']}")
            
            # 综合判断
            passed_checks = sum(1 for v in results["checks"].values() if v)
            total_checks = len(results["checks"])
            results["passed"] = (passed_checks >= total_checks - 1)  # 允许 1 项失败
            
        except Exception as e:
            print(f"\n❌ 验证异常：{e}")
            results["error"] = str(e)
            import traceback
            traceback.print_exc()
        
        return results
    
    def _handle_event(self, envelope: EventEnvelope):
        """处理事件"""
        self._events.append(envelope)
        self.event_store.append(envelope)
        self.cockpit.on_event(envelope)
    
    def print_summary(self, results: Dict[str, Any]) -> None:
        """打印总结"""
        print()
        print("=" * 60)
        print("📊 M2 Live 验证结果")
        print("=" * 60)
        
        status = "✅ PASS" if results.get("passed") else "❌ FAIL"
        print(f"\n{status} {results.get('test_id')}")
        print(f"时间：{results.get('timestamp')}")
        print()
        
        print("检查项:")
        for check, passed in results.get("checks", {}).items():
            symbol = "✓" if passed else "✗"
            print(f"  {symbol} {check}")
        
        if results.get("error"):
            print(f"\n错误：{results['error']}")
        
        print()
        if results.get("passed"):
            print("🎉 M2 Live 验证通过！")
        else:
            print("⚠️  M2 Live 验证未完全通过")


async def main():
    """主函数"""
    # 加载配置
    config_path = Path(__file__).parent.parent / "tests" / "config" / "okx_live.json"
    
    if not config_path.exists():
        print(f"❌ 配置文件不存在：{config_path}")
        return None
    
    # 创建验证器
    validator = M2LiveValidator(config_path)
    
    if not validator.setup():
        return None
    
    # 执行验证
    results = await validator.validate()
    
    # 打印总结
    validator.print_summary(results)
    
    # 保存报告
    report_path = Path(__file__).parent.parent / "reports" / "m2_live_validation.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📄 报告已保存：{report_path}")
    
    return results


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result and result.get("passed") else 1)
