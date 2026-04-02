"""
模块职责：
- 接收交易所原始行情，转换成内部标准市场数据结构
"""

from __future__ import annotations

from typing import Any, Dict

from connectors.okx.mapper import OkxMapper
from schemas.market import Tick


class MarketDataNormalizer:
    """
    不同 venue 原始行情的统一入口。
    """

    def normalize_tick(self, venue: str, raw: Dict[str, Any], symbol: str) -> Tick:
        if venue.upper() == "OKX":
            return OkxMapper.to_tick(raw, symbol)
        raise NotImplementedError(f"TODO: 未支持的 venue: {venue}")
