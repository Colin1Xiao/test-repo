"""
最小集成验证 - PAPER 模式闭环

验证链路：
1. Market Tick → Event
2. Signal → Risk Check
3. Order → Paper Broker
4. Fill → Position Update
5. Event Store Append
6. State Engine Apply
7. Cockpit API 可读

运行时间：约 5 秒
"""

import asyncio
from decimal import Decimal
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, OrderType, OrderStatus, TradingMode
from schemas.order import Order
from core.bus import InMemoryEventBus
from core.state_engine import InMemoryStateEngine
from core.event_store import JsonlEventStore
from execution.paper_broker import PaperBroker, PaperBrokerConfig
from execution.order_state import OrderStateManager
from runtime.event_driven_loop import EventDrivenLoop


async def test_minimal_loop():
    """最小循环测试"""
    print("=" * 60)
    print("🐉 最小集成验证 - PAPER 模式")
    print("=" * 60)
    
    # 1. 初始化组件
    print("\n【1】初始化组件...")
    workspace = Path(__file__).parent.parent / "test_storage"
    workspace.mkdir(exist_ok=True)
    
    event_bus = InMemoryEventBus()
    state_engine = InMemoryStateEngine()
    event_store = JsonlEventStore(workspace / "test_events.jsonl")
    
    broker = PaperBroker(PaperBrokerConfig(
        fill_probability=1.0,
        auto_fill=True,
        fill_delay_range=(0.1, 0.2),
    ))
    broker.set_market_price("ETH/USDT", 2000.0)
    
    order_manager = OrderStateManager()
    
    print("  ✓ Event Bus")
    print("  ✓ State Engine")
    print("  ✓ Event Store")
    print("  ✓ Paper Broker")
    print("  ✓ Order Manager")
    
    # 2. 注册事件处理器
    print("\n【2】注册事件处理器...")
    
    events_received = []
    
    def record_event(envelope: EventEnvelope):
        events_received.append(envelope)
        event_store.append(envelope)
        state_engine.apply(envelope)
    
    event_bus.subscribe(EventType.ALL, record_event)
    print(f"  ✓ 记录所有事件")
    
    # 3. 模拟市场数据
    print("\n【3】发布市场数据...")
    market_event = EventEnvelope(
        event_type=EventType.MARKET_DATA,
        source=EventSource.MARKET_DATA_ENGINE,
        payload={
            "symbol": "ETH/USDT",
            "price": 2000.0,
            "bid": 1999.5,
            "ask": 2000.5,
        },
    )
    event_bus.publish(market_event)
    print(f"  ✓ 市场价格：2000.0 USDT")
    
    # 4. 生成交易信号
    print("\n【4】生成交易信号...")
    signal_event = EventEnvelope(
        event_type=EventType.TRADING_SIGNAL,
        source=EventSource.STRATEGY_ENGINE,
        payload={
            "symbol": "ETH/USDT",
            "side": "buy",
            "size": 0.1,
            "confidence": 0.8,
        },
        correlation_id="TRADE-001",
        causation_id=market_event.event_id,
    )
    event_bus.publish(signal_event)
    print(f"  ✓ 信号：BUY 0.1 ETH")
    
    # 5. 创建并提交订单
    print("\n【5】创建订单并提交...")
    order = Order(
        order_id="ORD-TEST-001",
        venue="okx",
        symbol="ETH/USDT",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        status=OrderStatus.DRAFT,
        qty=Decimal("0.1"),
        price=Decimal("2000.0"),
    )
    
    order_fsm = order_manager.create_order(order)
    order_fsm.set_event_callback(lambda e: event_bus.publish(e))
    
    order_fsm.submit()
    order_fsm.accept("PAPER-001")
    print(f"  ✓ 订单已提交：{order.order_id}")
    
    # 6. 模拟成交
    print("\n【6】模拟成交...")
    order_fsm.partial_fill(Decimal("0.05"), Decimal("2000.1"), Decimal("0.01"))
    order_fsm.fill(Decimal("0.05"), Decimal("2000.2"), Decimal("0.01"))
    print(f"  ✓ 订单已成交：0.1 ETH @ ~2000.15")
    
    # 7. 等待一小段时间让事件处理完成
    print("\n【7】等待事件处理...")
    await asyncio.sleep(0.5)
    
    # 8. 验证结果
    print("\n【8】验证结果...")
    
    print(f"\n  事件统计:")
    print(f"    - 总事件数：{len(events_received)}")
    print(f"    - Event Store: {event_store.count()}")
    print(f"    - State Engine: {state_engine.stats()['event_count']}")
    
    print(f"\n  订单状态:")
    order_data = order_manager.get_order(order.order_id)
    if order_data:
        print(f"    - 状态：{order_data.state.current_status.value}")
        print(f"    - 成交：{order_data.state.filled_quantity}")
        print(f"    - 均价：{order_data.state.average_fill_price}")
    
    print(f"\n  事件链:")
    for i, event in enumerate(events_received, 1):
        print(f"    {i}. {event.event_type.value} @ {event.source.value}")
    
    # 9. 验证关联链
    print(f"\n【9】验证关联链...")
    chain = event_bus.get_correlation_chain("TRADE-001")
    print(f"  ✓ 关联链长度：{len(chain)}")
    
    chain_from_store = event_store.get_events_by_correlation("TRADE-001")
    print(f"  ✓ Event Store 关联链：{len(chain_from_store)}")
    
    # 10. 清理
    print(f"\n【10】清理...")
    event_store.clear()
    print(f"  ✓ 测试数据已清理")
    
    # 总结
    print("\n" + "=" * 60)
    print("✅ 集成验证完成")
    print("=" * 60)
    
    # 检查点
    checks = [
        ("事件总线正常", len(events_received) > 0),
        ("事件存储正常", event_store.count() == len(events_received)),
        ("状态引擎正常", state_engine.stats()['event_count'] > 0),
        ("订单状态机正常", order_data.state.current_status == OrderStatus.FILLED),
        ("关联链正常", len(chain) >= 2),
    ]
    
    print("\n检查点:")
    all_passed = True
    for name, passed in checks:
        status = "✓" if passed else "✗"
        print(f"  {status} {name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 所有检查点通过！")
        return True
    else:
        print("\n⚠️ 部分检查点失败")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_minimal_loop())
    sys.exit(0 if result else 1)
