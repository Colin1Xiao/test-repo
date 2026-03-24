#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
宏观经济事件数据源整合
======================

整合各类数据源 API，提供统一的数据获取接口

支持的数据源:
- 财经日历 (Forex Factory, Investing.com)
- 经济数据 (FRED, BLS)
- 加密货币价格 (Binance, Coinbase)
- 市场情绪 (Alternative.me)
- 链上数据 (Glassnode, Dune)
- 新闻情感 (CryptoPanic)
- 社交媒体 (Twitter, Reddit)

作者：小龙 🐉
版本：1.0
日期：2026-03-11
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod
import asyncio

# 尝试导入第三方库
try:
    import aiohttp
    import pandas as pd
    from pandas import DataFrame
except ImportError:
    aiohttp = None
    pd = None
    DataFrame = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# 数据类
# =============================================================================

@dataclass
class EconomicCalendarEvent:
    """财经日历事件"""
    event_id: str
    event_name: str
    country: str
    date: datetime
    impact: str  # 'high', 'medium', 'low'
    actual: Optional[float]
    forecast: Optional[float]
    previous: Optional[float]
    currency: str = "USD"


@dataclass
class CryptoPriceData:
    """加密货币价格数据"""
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    
    def to_ohlcv(self) -> List:
        """转换为 OHLCV 列表"""
        return [
            self.timestamp.timestamp() * 1000,
            self.open,
            self.high,
            self.low,
            self.close,
            self.volume
        ]


@dataclass
class SentimentData:
    """市场情绪数据"""
    timestamp: datetime
    fear_greed_index: int  # 0-100
    fear_greed_classification: str
    source: str


@dataclass
class OnchainMetric:
    """链上指标"""
    metric_name: str
    timestamp: datetime
    value: float
    unit: str
    source: str


# =============================================================================
# 数据源基类
# =============================================================================

class DataSource(ABC):
    """数据源抽象基类"""
    
    def __init__(self, api_key: Optional[str] = None, base_url: str = ""):
        self.api_key = api_key
        self.base_url = base_url
        self.session = None
    
    @abstractmethod
    async def fetch(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        """获取数据"""
        pass
    
    @abstractmethod
    async def close(self):
        """关闭连接"""
        pass
    
    async def __aenter__(self):
        if aiohttp:
            self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# =============================================================================
# 财经日历数据源
# =============================================================================

class ForexFactoryCalendar(DataSource):
    """
    Forex Factory 财经日历
    
    URL: https://www.forexfactory.com/calendar
    注意：Forex Factory 没有官方 API，这里使用网页抓取或第三方封装
    """
    
    def __init__(self):
        super().__init__(base_url="https://nfs.faireconomy.media/ff_calendar_thisweek.json")
    
    async def fetch_events(
        self, 
        days: int = 7,
        impact_filter: List[str] = None
    ) -> List[EconomicCalendarEvent]:
        """
        获取财经日历事件
        
        参数:
            days: 获取天数
            impact_filter: 影响程度过滤 ['high', 'medium', 'low']
        
        返回:
            EconomicCalendarEvent 列表
        """
        impact_filter = impact_filter or ['high']
        events = []
        
        try:
            if aiohttp and self.session:
                async with self.session.get(self.base_url) as response:
                    data = await response.json()
                    
                    for item in data:
                        impact = item.get('impact', '').lower()
                        if impact not in impact_filter:
                            continue
                        
                        event = EconomicCalendarEvent(
                            event_id=f"FF_{item.get('id', '')}",
                            event_name=item.get('title', ''),
                            country=item.get('country', ''),
                            date=self._parse_date(item.get('date', '')),
                            impact=impact,
                            actual=self._parse_value(item.get('actual', '')),
                            forecast=self._parse_value(item.get('forecast', '')),
                            previous=self._parse_value(item.get('previous', '')),
                            currency=item.get('currency', 'USD')
                        )
                        events.append(event)
            
            logger.info(f"获取到 {len(events)} 个财经日历事件")
            return events
            
        except Exception as e:
            logger.error(f"获取财经日历失败：{e}")
            return []
    
    def _parse_date(self, date_str: str) -> datetime:
        """解析日期字符串"""
        try:
            # Forex Factory 日期格式：MM/DD/YYYY HH:MM
            return datetime.strptime(date_str, "%m/%d/%Y %H:%M")
        except:
            return datetime.now()
    
    def _parse_value(self, value_str: str) -> Optional[float]:
        """解析数值"""
        if not value_str or value_str == '':
            return None
        try:
            return float(value_str.replace('%', '').replace('K', '000').replace('M', '000000'))
        except:
            return None
    
    async def fetch(self, endpoint: str = "", params: Optional[Dict] = None) -> Any:
        return await self.fetch_events()
    
    async def close(self):
        if self.session:
            await self.session.close()


class InvestingCalendar(DataSource):
    """
    Investing.com 经济日历
    
    注意：需要 API 密钥或使用第三方服务
    """
    
    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key, base_url="https://api.investing.com/api/financials/economic-calendar")
    
    async def fetch_events(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        countries: List[str] = None,
        importance: int = 3
    ) -> List[EconomicCalendarEvent]:
        """
        获取经济日历事件
        
        参数:
            start_date: 开始日期
            end_date: 结束日期
            countries: 国家列表 ['US', 'EU', 'CN', ...]
            importance: 重要性 1-3 (3 最高)
        """
        if not self.api_key:
            logger.warning("Investing.com API 密钥未配置")
            return []
        
        start_date = start_date or datetime.now()
        end_date = end_date or datetime.now() + timedelta(days=7)
        
        params = {
            'from': start_date.strftime('%Y-%m-%d'),
            'to': end_date.strftime('%Y-%m-%d'),
            'importance': importance,
        }
        
        if countries:
            params['countries'] = ','.join(countries)
        
        try:
            if aiohttp and self.session:
                headers = {'Authorization': f'Bearer {self.api_key}'}
                async with self.session.get(self.base_url, params=params, headers=headers) as response:
                    data = await response.json()
                    # 解析数据...
                    return []
        except Exception as e:
            logger.error(f"获取 Investing 日历失败：{e}")
        
        return []
    
    async def fetch(self, endpoint: str = "", params: Optional[Dict] = None) -> Any:
        return await self.fetch_events()
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 经济数据源
# =============================================================================

class FREDEconomicData(DataSource):
    """
    FRED (Federal Reserve Economic Data)
    
    URL: https://fred.stlouisfed.org/docs/api/fred/
    API 密钥免费申请
    """
    
    def __init__(self, api_key: str):
        super().__init__(
            api_key=api_key,
            base_url="https://api.stlouisfed.org/fred"
        )
    
    async def get_series(self, series_id: str, start_date: str, end_date: str) -> DataFrame:
        """
        获取经济数据序列
        
        常用序列 ID:
        - CPIAUCSL: CPI
        - UNRATE: 失业率
        - GDP: 国内生产总值
        - FEDFUNDS: 联邦基金利率
        
        参数:
            series_id: 序列 ID
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
        """
        if not pd:
            logger.warning("pandas 未安装")
            return None
        
        url = f"{self.base_url}/series/observations"
        params = {
            'series_id': series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'observation_start': start_date,
            'observation_end': end_date
        }
        
        try:
            if aiohttp and self.session:
                async with self.session.get(url, params=params) as response:
                    data = await response.json()
                    
                    observations = data.get('observations', [])
                    df = pd.DataFrame(observations)
                    df['date'] = pd.to_datetime(df['date'])
                    df['value'] = pd.to_numeric(df['value'], errors='coerce')
                    
                    return df[['date', 'value']]
        except Exception as e:
            logger.error(f"获取 FRED 数据失败：{e}")
        
        return None
    
    async def fetch(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        series_id = params.get('series_id', '') if params else ''
        return await self.get_series(
            series_id,
            params.get('start_date', '2020-01-01'),
            params.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        )
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 加密货币价格数据源
# =============================================================================

class BinancePriceAPI(DataSource):
    """
    Binance API - 加密货币价格数据
    
    URL: https://binance-docs.github.io/apidocs/
    无需 API 密钥即可获取公开市场数据
    """
    
    def __init__(self):
        super().__init__(base_url="https://api.binance.com")
    
    async def get_klines(
        self,
        symbol: str = "BTCUSDT",
        interval: str = "1h",
        limit: int = 100
    ) -> List[CryptoPriceData]:
        """
        获取 K 线数据
        
        参数:
            symbol: 交易对 (BTCUSDT, ETHUSDT, ...)
            interval: 时间间隔 (1m, 5m, 1h, 1d, ...)
            limit: 数量 (最多 1000)
        
        返回:
            CryptoPriceData 列表
        """
        url = f"{self.base_url}/api/v3/klines"
        params = {
            'symbol': symbol,
            'interval': interval,
            'limit': min(limit, 1000)
        }
        
        try:
            if aiohttp and self.session:
                async with self.session.get(url, params=params) as response:
                    data = await response.json()
                    
                    klines = []
                    for k in data:
                        kline = CryptoPriceData(
                            symbol=symbol,
                            timestamp=datetime.fromtimestamp(k[0] / 1000),
                            open=float(k[1]),
                            high=float(k[2]),
                            low=float(k[3]),
                            close=float(k[4]),
                            volume=float(k[5])
                        )
                        klines.append(kline)
                    
                    return klines
                    
        except Exception as e:
            logger.error(f"获取 Binance K 线失败：{e}")
            return []
    
    async def get_ticker(self, symbol: str = "BTCUSDT") -> Optional[Dict]:
        """获取当前价格"""
        url = f"{self.base_url}/api/v3/ticker/price"
        params = {'symbol': symbol}
        
        try:
            if aiohttp and self.session:
                async with self.session.get(url, params=params) as response:
                    data = await response.json()
                    return {
                        'symbol': data['symbol'],
                        'price': float(data['price']),
                        'timestamp': datetime.now()
                    }
        except Exception as e:
            logger.error(f"获取 Binance 价格失败：{e}")
        
        return None
    
    async def fetch(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        if endpoint == 'klines':
            return await self.get_klines(
                params.get('symbol', 'BTCUSDT'),
                params.get('interval', '1h'),
                params.get('limit', 100)
            )
        elif endpoint == 'ticker':
            return await self.get_ticker(params.get('symbol', 'BTCUSDT'))
        return None
    
    async def close(self):
        if self.session:
            await self.session.close()


class CoinbasePriceAPI(DataSource):
    """
    Coinbase API - 加密货币价格数据
    
    URL: https://docs.cloud.coinbase.com/exchange/docs
    """
    
    def __init__(self):
        super().__init__(base_url="https://api.exchange.coinbase.com")
    
    async def get_candles(
        self,
        product_id: str = "BTC-USD",
        granularity: int = 3600,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[CryptoPriceData]:
        """获取蜡烛图数据"""
        url = f"{self.base_url}/products/{product_id}/candles"
        params = {'granularity': granularity}
        
        if start:
            params['start'] = start.isoformat()
        if end:
            params['end'] = end.isoformat()
        
        try:
            if aiohttp and self.session:
                async with self.session.get(url, params=params) as response:
                    data = await response.json()
                    
                    candles = []
                    for c in data:
                        candle = CryptoPriceData(
                            symbol=product_id,
                            timestamp=datetime.fromtimestamp(c[0]),
                            open=float(c[3]),
                            high=float(c[2]),
                            low=float(c[1]),
                            close=float(c[4]),
                            volume=float(c[5])
                        )
                        candles.append(candle)
                    
                    return candles
        except Exception as e:
            logger.error(f"获取 Coinbase 数据失败：{e}")
        
        return []
    
    async def fetch(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        return await self.get_candles(
            params.get('product_id', 'BTC-USD'),
            params.get('granularity', 3600)
        )
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 市场情绪数据源
# =============================================================================

class AlternativeMeSentiment(DataSource):
    """
    Alternative.me 恐惧贪婪指数
    
    URL: https://alternative.me/crypto/fear-and-greed-index/
    免费 API，无需密钥
    """
    
    def __init__(self):
        super().__init__(base_url="https://api.alternative.me/fng")
    
    async def get_current(self) -> Optional[SentimentData]:
        """获取当前恐惧贪婪指数"""
        try:
            if aiohttp and self.session:
                async with self.session.get(self.base_url) as response:
                    data = await response.json()
                    
                    if data.get('status') == 'success' and data.get('data'):
                        latest = data['data'][0]
                        return SentimentData(
                            timestamp=datetime.fromtimestamp(int(latest['timestamp'])),
                            fear_greed_index=int(latest['value']),
                            fear_greed_classification=latest['value_classification'],
                            source='alternative.me'
                        )
        except Exception as e:
            logger.error(f"获取恐惧贪婪指数失败：{e}")
        
        return None
    
    async def get_history(self, days: int = 30) -> List[SentimentData]:
        """获取历史恐惧贪婪指数"""
        try:
            if aiohttp and self.session:
                url = f"{self.base_url}?limit={days}"
                async with self.session.get(url) as response:
                    data = await response.json()
                    
                    sentiments = []
                    for item in data.get('data', []):
                        sentiment = SentimentData(
                            timestamp=datetime.fromtimestamp(int(item['timestamp'])),
                            fear_greed_index=int(item['value']),
                            fear_greed_classification=item['value_classification'],
                            source='alternative.me'
                        )
                        sentiments.append(sentiment)
                    
                    return sentiments
        except Exception as e:
            logger.error(f"获取历史情绪数据失败：{e}")
        
        return []
    
    async def fetch(self, endpoint: str = "", params: Optional[Dict] = None) -> Any:
        if params and params.get('history'):
            return await self.get_history(params.get('days', 30))
        return await self.get_current()
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 链上数据源
# =============================================================================

class GlassnodeAPI(DataSource):
    """
    Glassnode 链上数据 API
    
    URL: https://docs.glassnode.com/
    需要 API 密钥 (有免费层级)
    """
    
    def __init__(self, api_key: str):
        super().__init__(
            api_key=api_key,
            base_url="https://api.glassnode.com/v1"
        )
    
    async def get_metrics(
        self,
        metrics: List[str],
        asset: str = "btc",
        interval: str = "24h"
    ) -> List[OnchainMetric]:
        """
        获取链上指标
        
        常用指标:
        - addresses/active_count: 活跃地址数
        - supply/active: 活跃供应量
        - transactions/count: 交易数量
        - fees/sum: 总手续费
        
        参数:
            metrics: 指标列表
            asset: 资产 (btc, eth)
            interval: 间隔 (24h, 1w, ...)
        """
        if not self.api_key:
            logger.warning("Glassnode API 密钥未配置")
            return []
        
        results = []
        
        try:
            if aiohttp and self.session:
                for metric in metrics:
                    url = f"{self.base_url}/metrics/{metric}"
                    params = {
                        'a': asset,
                        'i': interval,
                        'api_key': self.api_key
                    }
                    
                    async with self.session.get(url, params=params) as response:
                        data = await response.json()
                        
                        for item in data:
                            metric_data = OnchainMetric(
                                metric_name=metric,
                                timestamp=datetime.fromtimestamp(item['t']),
                                value=item['v'],
                                unit='',
                                source='glassnode'
                            )
                            results.append(metric_data)
        except Exception as e:
            logger.error(f"获取 Glassnode 数据失败：{e}")
        
        return results
    
    async def fetch(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        return await self.get_metrics(
            params.get('metrics', []),
            params.get('asset', 'btc'),
            params.get('interval', '24h')
        )
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 新闻情感数据源
# =============================================================================

class CryptoPanicAPI(DataSource):
    """
    CryptoPanic 新闻 API
    
    URL: https://cryptopanic.com/developers/api/
    免费 API 密钥
    """
    
    def __init__(self, api_key: str):
        super().__init__(
            api_key=api_key,
            base_url="https://www.cryptopanic.com/api/v1"
        )
    
    async def get_news(
        self,
        limit: int = 20,
        filter_by: str = "hot"
    ) -> List[Dict]:
        """
        获取加密货币新闻
        
        参数:
            limit: 数量
            filter_by: 过滤 (hot, rising, bullish, bearish)
        """
        if not self.api_key:
            logger.warning("CryptoPanic API 密钥未配置")
            return []
        
        url = f"{self.base_url}/posts/"
        params = {
            'auth_token': self.api_key,
            'limit': limit,
            'filter': filter_by
        }
        
        try:
            if aiohttp and self.session:
                async with self.session.get(url, params=params) as response:
                    data = await response.json()
                    return data.get('results', [])
        except Exception as e:
            logger.error(f"获取 CryptoPanic 新闻失败：{e}")
        
        return []
    
    async def analyze_sentiment(self, news_list: List[Dict]) -> Dict:
        """
        分析新闻情感
        
        返回:
            {'bullish': count, 'bearish': count, 'neutral': count, 'score': -1 to 1}
        """
        bullish = 0
        bearish = 0
        neutral = 0
        
        for news in news_list:
            # 简化分析，实际应使用 NLP
            title = news.get('title', '').lower()
            
            if any(word in title for word in ['surge', 'rally', 'bull', 'rise', 'gain']):
                bullish += 1
            elif any(word in title for word in ['crash', 'drop', 'bear', 'fall', 'loss']):
                bearish += 1
            else:
                neutral += 1
        
        total = bullish + bearish + neutral
        score = (bullish - bearish) / total if total > 0 else 0
        
        return {
            'bullish': bullish,
            'bearish': bearish,
            'neutral': neutral,
            'score': score,
            'analyzed_at': datetime.now().isoformat()
        }
    
    async def fetch(self, endpoint: str = "", params: Optional[Dict] = None) -> Any:
        news = await self.get_news(
            params.get('limit', 20),
            params.get('filter', 'hot')
        )
        return await self.analyze_sentiment(news)
    
    async def close(self):
        if self.session:
            await self.session.close()


# =============================================================================
# 统一数据聚合器
# =============================================================================

class DataAggregator:
    """
    统一数据聚合器
    
    整合所有数据源，提供统一的访问接口
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        
        # 初始化数据源
        self.calendar = ForexFactoryCalendar()
        self.fred = FREDEconomicData(self.config.get('fred_api_key', '')) if self.config.get('fred_api_key') else None
        self.binance = BinancePriceAPI()
        self.sentiment = AlternativeMeSentiment()
        self.glassnode = GlassnodeAPI(self.config.get('glassnode_api_key', '')) if self.config.get('glassnode_api_key') else None
        self.cryptopanic = CryptoPanicAPI(self.config.get('cryptopanic_api_key', '')) if self.config.get('cryptopanic_api_key') else None
        
        logger.info("数据聚合器初始化完成")
    
    async def get_event_calendar(self, days: int = 7) -> List[EconomicCalendarEvent]:
        """获取未来 N 天的经济日历"""
        return await self.calendar.fetch_events(days=days, impact_filter=['high'])
    
    async def get_current_sentiment(self) -> Optional[SentimentData]:
        """获取当前市场情绪"""
        return await self.sentiment.get_current()
    
    async def get_crypto_price(
        self, 
        symbol: str = "BTCUSDT",
        interval: str = "1h",
        limit: int = 100
    ) -> List[CryptoPriceData]:
        """获取加密货币价格数据"""
        return await self.binance.get_klines(symbol, interval, limit)
    
    async def get_economic_data(
        self,
        series_id: str,
        start_date: str,
        end_date: str
    ) -> Optional[DataFrame]:
        """获取经济数据"""
        if self.fred:
            return await self.fred.get_series(series_id, start_date, end_date)
        logger.warning("FRED 数据源未配置")
        return None
    
    async def get_onchain_metrics(
        self,
        metrics: List[str],
        asset: str = "btc"
    ) -> List[OnchainMetric]:
        """获取链上指标"""
        if self.glassnode:
            return await self.glassnode.get_metrics(metrics, asset)
        logger.warning("Glassnode 数据源未配置")
        return []
    
    async def get_news_sentiment(self) -> Dict:
        """获取新闻情感分析"""
        if self.cryptopanic:
            return await self.cryptopanic.fetch()
        logger.warning("CryptoPanic 数据源未配置")
        return {'score': 0, 'bullish': 0, 'bearish': 0, 'neutral': 0}
    
    async def get_full_market_context(self) -> Dict:
        """
        获取完整市场环境数据
        
        返回:
            包含所有相关数据的字典
        """
        logger.info("获取完整市场环境数据...")
        
        # 并行获取所有数据
        tasks = [
            self.get_event_calendar(days=7),
            self.get_current_sentiment(),
            self.get_crypto_price("BTCUSDT", "1h", 168),  # 1 周小时线
            self.get_news_sentiment()
        ]
        
        if self.glassnode:
            tasks.append(self.get_onchain_metrics(['addresses/active_count', 'transactions/count']))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        context = {
            'calendar_events': results[0] if not isinstance(results[0], Exception) else [],
            'sentiment': results[1] if not isinstance(results[1], Exception) else None,
            'btc_prices': results[2] if not isinstance(results[2], Exception) else [],
            'news_sentiment': results[3] if not isinstance(results[3], Exception) else {},
            'onchain_metrics': results[4] if len(results) > 4 and not isinstance(results[4], Exception) else [],
            'retrieved_at': datetime.now().isoformat()
        }
        
        logger.info(f"市场环境数据获取完成，{len(context['calendar_events'])} 个事件")
        return context
    
    async def close_all(self):
        """关闭所有数据源连接"""
        await asyncio.gather(
            self.calendar.close(),
            self.binance.close(),
            self.sentiment.close(),
            self.fred.close() if self.fred else asyncio.sleep(0),
            self.glassnode.close() if self.glassnode else asyncio.sleep(0),
            self.cryptopanic.close() if self.cryptopanic else asyncio.sleep(0)
        )
        logger.info("所有数据源连接已关闭")


# =============================================================================
# 配置和示例
# =============================================================================

def create_default_config() -> Dict:
    """创建默认配置文件"""
    config = {
        "fred_api_key": "",  # https://fred.stlouisfed.org/docs/api/api_key.html
        "glassnode_api_key": "",  # https://glassnode.com
        "cryptopanic_api_key": "",  # https://cryptopanic.com/developers/api/
        "data_retention_days": 90,
        "update_interval_minutes": 60
    }
    return config


async def demo():
    """演示数据聚合器使用"""
    print("=" * 60)
    print("宏观经济数据源整合 - 演示")
    print("=" * 60)
    
    # 创建聚合器 (无 API 密钥，部分功能受限)
    aggregator = DataAggregator()
    
    try:
        # 获取财经日历
        print("\n1. 获取财经日历 (高影响事件)...")
        events = await aggregator.get_event_calendar(days=7)
        print(f"   找到 {len(events)} 个高影响事件")
        for event in events[:5]:  # 显示前 5 个
            print(f"   - {event.event_name} ({event.date.strftime('%m-%d %H:%M')})")
        
        # 获取市场情绪
        print("\n2. 获取市场情绪...")
        sentiment = await aggregator.get_current_sentiment()
        if sentiment:
            print(f"   恐惧贪婪指数：{sentiment.fear_greed_index} ({sentiment.fear_greed_classification})")
        
        # 获取 BTC 价格
        print("\n3. 获取 BTC 价格数据...")
        prices = await aggregator.get_crypto_price("BTCUSDT", "1h", 24)
        if prices:
            latest = prices[-1]
            print(f"   最新价格：${latest.close:,.2f}")
            print(f"   24h 最高：${max(p.high for p in prices):,.2f}")
            print(f"   24h 最低：${min(p.low for p in prices):,.2f}")
        
        # 获取新闻情感
        print("\n4. 获取新闻情感分析...")
        news_sentiment = await aggregator.get_news_sentiment()
        print(f"   看涨：{news_sentiment.get('bullish', 0)}")
        print(f"   看跌：{news_sentiment.get('bearish', 0)}")
        print(f"   中性：{news_sentiment.get('neutral', 0)}")
        print(f"   情感得分：{news_sentiment.get('score', 0):.2f}")
        
        # 获取完整市场环境
        print("\n5. 获取完整市场环境...")
        context = await aggregator.get_full_market_context()
        print(f"   数据获取时间：{context['retrieved_at']}")
        print(f"   日历事件：{len(context['calendar_events'])} 个")
        print(f"   价格数据：{len(context['btc_prices'])} 条")
        
    except Exception as e:
        print(f"演示出错：{e}")
    finally:
        await aggregator.close_all()
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)


if __name__ == "__main__":
    import asyncio
    asyncio.run(demo())
