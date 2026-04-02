"""
模块职责：
- 协调市场数据源获取与标准化
- 第一轮只提供最小接口，不实现完整 websocket 订阅编排
"""

from __future__ import annotations

from schemas.market import Tick
from marketdata.normalizer import MarketDataNormalizer


class MarketDataFeedService:
    def __init__(self, normalizer: MarketDataNormalizer) -> None:
        self.normalizer = normalizer

    def on_raw_tick(self, venue: str, symbol: str, raw: dict) -> Tick:
        """
        接收原始行情并输出标准化 Tick。
        """
        return self.normalizer.normalize_tick(venue=venue, raw=raw, symbol=symbol)
