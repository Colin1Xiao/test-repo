#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
市场情绪数据采集脚本
负责从多个数据源采集社交媒体、新闻、搜索趋势和交易数据
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, AsyncGenerator
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

import aiohttp
import tweepy
from bs4 import BeautifulSoup
import feedparser

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class SocialPost:
    """社交媒体帖子数据结构"""
    source: str  # twitter/reddit/weibo/telegram
    content: str
    author: str
    timestamp: datetime
    likes: int = 0
    shares: int = 0
    comments: int = 0
    followers: int = 0  # 作者粉丝数
    url: str = ""
    language: str = "en"


@dataclass
class NewsArticle:
    """新闻文章数据结构"""
    source: str
    title: str
    content: str
    url: str
    timestamp: datetime
    author: str = ""
    sentiment_score: float = 0.0


@dataclass
class SearchTrend:
    """搜索趋势数据结构"""
    keyword: str
    platform: str  # google/baidu/wechat
    timestamp: datetime
    search_volume: int
    trend_7d: float = 0.0  # 7 日变化率
    trend_30d: float = 0.0  # 30 日变化率


@dataclass
class TradingData:
    """交易数据数据结构"""
    symbol: str
    timestamp: datetime
    funding_rate: float = 0.0  # 资金费率
    long_short_ratio: float = 0.0  # 多空比
    open_interest: float = 0.0  # 未平仓合约
    volume_24h: float = 0.0  # 24h 交易量


class DataCollector(ABC):
    """数据采集器基类"""
    
    @abstractmethod
    async def collect(self) -> AsyncGenerator:
        """采集数据"""
        pass


class TwitterCollector(DataCollector):
    """
    Twitter 数据采集器
    需要配置 Twitter API v2
    """
    
    def __init__(self, api_key: str, api_secret: str, bearer_token: str):
        self.client = tweepy.Client(
            bearer_token=bearer_token,
            consumer_key=api_key,
            consumer_secret=api_secret,
            wait_on_rate_limit=True
        )
        
        # 关注的加密货币大 V 和机构账号
        self.accounts = [
            'elonmusk', 'VitalikButerin', 'cz_binance', 'APompliano',
            'DocumentingBTC', 'whale_alert', 'glassnode', 'CryptoKaleo',
            'PlanB', '100trillionUSD', 'saylor', 'michael_saylor'
        ]
        
        # 关键词
        self.keywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency']
    
    async def collect(self) -> AsyncGenerator[SocialPost, None]:
        """采集 Twitter 数据"""
        for keyword in self.keywords:
            try:
                # 搜索最近 1 小时的推文
                query = f"{keyword} -is:retweet -is:reply lang:en"
                tweets = self.client.search_recent_tweets(
                    query=query,
                    max_results=100,
                    tweet_fields=['created_at', 'public_metrics', 'author_id'],
                    expansions=['author_id']
                )
                
                if tweets.data:
                    for tweet in tweets.data:
                        post = SocialPost(
                            source='twitter',
                            content=tweet.text,
                            author=str(tweet.author_id),
                            timestamp=tweet.created_at,
                            likes=tweet.public_metrics.get('like_count', 0),
                            shares=tweet.public_metrics.get('retweet_count', 0),
                            comments=tweet.public_metrics.get('reply_count', 0),
                            url=f"https://twitter.com/status/{tweet.id}"
                        )
                        yield post
                
                await asyncio.sleep(1)  # 避免 API 限流
                
            except Exception as e:
                logger.error(f"Twitter 采集错误 ({keyword}): {e}")
                await asyncio.sleep(5)


class RedditCollector(DataCollector):
    """
    Reddit 数据采集器
    使用 Pushshift API 或官方 API
    """
    
    def __init__(self):
        self.subreddits = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'CryptoMarkets']
        self.base_url = "https://www.reddit.com/r/{}/hot.json"
    
    async def collect(self) -> AsyncGenerator[SocialPost, None]:
        """采集 Reddit 数据"""
        headers = {'User-Agent': 'CryptoSentimentBot/1.0'}
        
        async with aiohttp.ClientSession(headers=headers) as session:
            for subreddit in self.subreddits:
                try:
                    url = self.base_url.format(subreddit)
                    async with session.get(url, params={'limit': 50}) as response:
                        if response.status == 200:
                            data = await response.json()
                            posts = data.get('data', {}).get('children', [])
                            
                            for post in posts:
                                post_data = post.get('data', {})
                                yield SocialPost(
                                    source='reddit',
                                    content=post_data.get('title', '') + ' ' + post_data.get('selftext', ''),
                                    author=post_data.get('author', ''),
                                    timestamp=datetime.fromtimestamp(post_data.get('created_utc', 0)),
                                    likes=post_data.get('ups', 0),
                                    shares=post_data.get('num_crossposts', 0),
                                    comments=post_data.get('num_comments', 0),
                                    url=f"https://reddit.com{post_data.get('permalink', '')}"
                                )
                    
                    await asyncio.sleep(2)  # 避免限流
                    
                except Exception as e:
                    logger.error(f"Reddit 采集错误 ({subreddit}): {e}")
                    await asyncio.sleep(5)


class NewsCollector(DataCollector):
    """
    新闻媒体数据采集器
    通过 RSS feed 采集
    """
    
    def __init__(self):
        self.feeds = {
            'coindesk': 'https://www.coindesk.com/arc/outboundfeeds/rss/',
            'cointelegraph': 'https://cointelegraph.com/rss',
            'decrypt': 'https://decrypt.co/feed',
            'theblock': 'https://www.theblockcrypto.com/rss',
        }
    
    async def collect(self) -> AsyncGenerator[NewsArticle, None]:
        """采集新闻数据"""
        async with aiohttp.ClientSession() as session:
            for source, url in self.feeds.items():
                try:
                    async with session.get(url, timeout=10) as response:
                        if response.status == 200:
                            content = await response.text()
                            feed = feedparser.parse(content)
                            
                            for entry in feed.entries[:20]:  # 最近 20 篇
                                article = NewsArticle(
                                    source=source,
                                    title=entry.get('title', ''),
                                    content=entry.get('summary', entry.get('description', '')),
                                    url=entry.get('link', ''),
                                    timestamp=datetime.now(),  # RSS 时间可能不准确
                                    author=entry.get('author', '')
                                )
                                yield article
                    
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"新闻采集错误 ({source}): {e}")
                    await asyncio.sleep(3)


class SearchTrendCollector(DataCollector):
    """
    搜索趋势数据采集器
    注意：Google Trends 需要 pytrends 库
    """
    
    def __init__(self):
        self.keywords = ['bitcoin', 'ethereum', 'crypto', 'buy bitcoin', 'btc price']
        self.platforms = ['google']  # 可扩展 baidu, wechat
    
    async def collect(self) -> AsyncGenerator[SearchTrend, None]:
        """采集搜索趋势数据"""
        try:
            from pytrends import TrendReq
            
            pytrends = TrendReq(hl='en-US', tz=360)
            
            for keyword in self.keywords:
                try:
                    # 获取实时趋势
                    pytrends.build_payload([keyword], timeframe='now 1-H')
                    data = pytrends.interest_over_time()
                    
                    if not data.empty:
                        current_volume = data[keyword].iloc[-1]
                        avg_7d = data[keyword].tail(7).mean() if len(data) >= 7 else current_volume
                        avg_30d = data[keyword].tail(30).mean() if len(data) >= 30 else current_volume
                        
                        yield SearchTrend(
                            keyword=keyword,
                            platform='google',
                            timestamp=datetime.now(),
                            search_volume=int(current_volume),
                            trend_7d=(current_volume - avg_7d) / avg_7d if avg_7d > 0 else 0,
                            trend_30d=(current_volume - avg_30d) / avg_30d if avg_30d > 0 else 0
                        )
                    
                    await asyncio.sleep(5)  # Google Trends 限流严格
                    
                except Exception as e:
                    logger.error(f"搜索趋势采集错误 ({keyword}): {e}")
                    await asyncio.sleep(10)
                    
        except ImportError:
            logger.warning("pytrends 未安装，跳过搜索趋势采集")


class TradingDataCollector(DataCollector):
    """
    交易数据采集器
    从交易所 API 获取资金费率、多空比等数据
    """
    
    def __init__(self):
        self.exchanges = {
            'binance': 'https://fapi.binance.com/fapi/v1/premiumIndex',
            'okx': 'https://www.okx.com/api/v5/risk/trending'
        }
        self.symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
    
    async def collect(self) -> AsyncGenerator[TradingData, None]:
        """采集交易数据"""
        async with aiohttp.ClientSession() as session:
            for symbol in self.symbols:
                try:
                    # Binance 资金费率
                    async with session.get(
                        self.exchanges['binance'],
                        params={'symbol': symbol},
                        timeout=5
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            yield TradingData(
                                symbol=symbol,
                                timestamp=datetime.now(),
                                funding_rate=float(data.get('lastFundingRate', 0)),
                                mark_price=float(data.get('markPrice', 0)),
                                index_price=float(data.get('indexPrice', 0))
                            )
                    
                    # Binance 多空比 (需要单独 API)
                    async with session.get(
                        'https://fapi.binance.com/futures/data/globalLongShortAccountRatio',
                        params={'symbol': symbol, 'period': '5m'},
                        timeout=5
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data:
                                latest = data[-1]
                                yield TradingData(
                                    symbol=symbol,
                                    timestamp=datetime.fromtimestamp(latest['timestamp'] / 1000),
                                    long_short_ratio=float(latest.get('longShortRatio', 1.0))
                                )
                    
                    await asyncio.sleep(2)
                    
                except Exception as e:
                    logger.error(f"交易数据采集错误 ({symbol}): {e}")
                    await asyncio.sleep(3)


class DataPipeline:
    """
    数据管道
    协调多个采集器，将数据输出到存储
    """
    
    def __init__(self, output_dir: str = "./data"):
        self.output_dir = output_dir
        self.collectors: List[DataCollector] = []
        self.running = False
        
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
    
    def add_collector(self, collector: DataCollector):
        """添加数据采集器"""
        self.collectors.append(collector)
    
    async def run(self, duration_hours: int = 24):
        """运行数据管道"""
        self.running = True
        end_time = time.time() + duration_hours * 3600
        
        logger.info(f"数据管道启动，运行 {duration_hours} 小时")
        
        while self.running and time.time() < end_time:
            tasks = []
            
            for collector in self.collectors:
                task = asyncio.create_task(self._collect_from(collector))
                tasks.append(task)
            
            # 等待所有采集器完成一轮
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # 等待下一轮
            await asyncio.sleep(60)  # 每分钟一轮
        
        logger.info("数据管道停止")
    
    async def _collect_from(self, collector: DataCollector):
        """从单个采集器采集数据"""
        try:
            async for data in collector.collect():
                await self._store_data(data)
        except Exception as e:
            logger.error(f"采集器错误：{e}")
    
    async def _store_data(self, data):
        """存储数据到文件"""
        timestamp = datetime.now().strftime('%Y%m%d')
        filename = f"{self.output_dir}/data_{timestamp}.jsonl"
        
        data_dict = asdict(data)
        data_dict['collected_at'] = datetime.now().isoformat()
        
        try:
            with open(filename, 'a', encoding='utf-8') as f:
                f.write(json.dumps(data_dict, ensure_ascii=False) + '\n')
        except Exception as e:
            logger.error(f"数据存储错误：{e}")
    
    def stop(self):
        """停止管道"""
        self.running = False


async def main():
    """主函数示例"""
    # 初始化采集器 (需要配置 API 密钥)
    twitter_collector = TwitterCollector(
        api_key=os.getenv('TWITTER_API_KEY', ''),
        api_secret=os.getenv('TWITTER_API_SECRET', ''),
        bearer_token=os.getenv('TWITTER_BEARER_TOKEN', '')
    )
    
    reddit_collector = RedditCollector()
    news_collector = NewsCollector()
    trading_collector = TradingDataCollector()
    
    # 创建管道
    pipeline = DataPipeline(output_dir="./collected_data")
    pipeline.add_collector(reddit_collector)  # Twitter 需要 API 密钥
    pipeline.add_collector(news_collector)
    pipeline.add_collector(trading_collector)
    
    # 运行 1 小时测试
    await pipeline.run(duration_hours=1)


if __name__ == "__main__":
    # asyncio.run(main())
    print("数据采集模块已就绪")
    print("使用方法:")
    print("  1. 配置环境变量: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_BEARER_TOKEN")
    print("  2. 安装依赖：pip install tweepy aiohttp beautifulsoup4 feedparser pytrends")
    print("  3. 运行：python data_collector.py")
