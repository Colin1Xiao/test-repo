#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
特征工程模块 - 机器学习价格预测模型

不依赖传统技术指标，专注于:
- 市场微观结构特征
- 链上数据特征
- 情绪特征
- 宏观特征

作者：小龙
日期：2026-03-11
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


class MarketMicroFeatures:
    """市场微观结构特征"""
    
    def __init__(self, orderbook_depth: int = 10):
        self.orderbook_depth = orderbook_depth
    
    def compute_orderbook_imbalance(self, bids: pd.DataFrame, asks: pd.DataFrame) -> float:
        """
        计算订单簿不平衡度
        
        Args:
            bids: 买单 DataFrame (price, volume)
            asks: 卖单 DataFrame (price, volume)
        
        Returns:
            订单簿不平衡度 [-1, 1]
        """
        # 深度加权，近价权重更高
        bid_prices = bids['price'].values[:self.orderbook_depth]
        bid_vols = bids['volume'].values[:self.orderbook_depth]
        ask_prices = asks['price'].values[:self.orderbook_depth]
        ask_vols = asks['volume'].values[:self.orderbook_depth]
        
        # 权重 = 1 / 价格距离
        mid_price = (bid_prices[0] + ask_prices[0]) / 2
        bid_weights = 1 / (mid_price - bid_prices + 1e-8)
        ask_weights = 1 / (ask_prices - mid_price + 1e-8)
        
        weighted_bid_vol = np.sum(bid_vols * bid_weights)
        weighted_ask_vol = np.sum(ask_vols * ask_weights)
        
        obi = (weighted_bid_vol - weighted_ask_vol) / (weighted_bid_vol + weighted_ask_vol + 1e-8)
        return np.clip(obi, -1, 1)
    
    def compute_vpin(self, trades: pd.DataFrame, bucket_size: int = 1000) -> float:
        """
        VPIN - 成交量同步概率 (毒性订单流)
        
        Args:
            trades: 交易记录 DataFrame (timestamp, price, volume, side)
            bucket_size: 每个桶的成交量
        
        Returns:
            VPIN 值 [0, 1]
        """
        if len(trades) == 0:
            return 0.0
        
        # 按成交量分桶
        trades = trades.sort_values('timestamp').reset_index(drop=True)
        trades['cumulative_vol'] = trades['volume'].cumsum()
        trades['bucket'] = (trades['cumulative_vol'] // bucket_size).astype(int)
        
        # 计算每个桶的买卖不平衡
        bucket_imbalance = trades.groupby('bucket').apply(
            lambda x: abs(x[x['side'] == 'buy']['volume'].sum() - 
                         x[x['side'] == 'sell']['volume'].sum()) / 
                     (x['volume'].sum() + 1e-8)
        )
        
        vpin = bucket_imbalance.mean() if len(bucket_imbalance) > 0 else 0.0
        return np.clip(vpin, 0, 1)
    
    def compute_price_impact(self, trades: pd.DataFrame) -> float:
        """
        计算价格冲击 - 单位成交量的价格变化
        
        Args:
            trades: 交易记录 DataFrame
        
        Returns:
            价格冲击系数
        """
        if len(trades) < 2:
            return 0.0
        
        price_changes = trades['price'].diff().abs()
        volumes = trades['volume']
        
        # 避免除以零
        mask = volumes > 0
        if mask.sum() == 0:
            return 0.0
        
        price_impact = (price_changes[mask] / volumes[mask]).mean()
        return price_impact
    
    def compute_volume_distribution(self, trades: pd.DataFrame) -> Dict[str, float]:
        """
        计算成交量分布特征
        
        Returns:
            字典包含：偏度、集中度、大单比例
        """
        if len(trades) == 0:
            return {'volume_skew': 0, 'volume_herfindahl': 0, 'large_order_ratio': 0}
        
        volumes = trades['volume'].values
        
        # 成交量偏度
        volume_skew = pd.Series(volumes).skew()
        
        # Herfindahl 指数 (集中度)
        volume_shares = volumes / (volumes.sum() + 1e-8)
        volume_herfindahl = np.sum(volume_shares ** 2)
        
        # 大单比例 (超过 90% 分位数的订单)
        large_threshold = np.percentile(volumes, 90)
        large_order_ratio = (volumes > large_threshold).sum() / len(volumes)
        
        return {
            'volume_skew': volume_skew,
            'volume_herfindahl': volume_herfindahl,
            'large_order_ratio': large_order_ratio
        }
    
    def compute_order_flow_imbalance(self, trades: pd.DataFrame, window: int = 100) -> float:
        """
        计算订单流不平衡 - 连续同向订单累积
        
        Args:
            trades: 交易记录
            window: 滑动窗口大小
        
        Returns:
            订单流不平衡度
        """
        if len(trades) < window:
            return 0.0
        
        # 将买卖方向转换为 +1/-1
        trades['direction'] = trades['side'].map({'buy': 1, 'sell': -1})
        
        # 滚动求和
        ofi = trades['direction'].rolling(window=window).sum() / window
        
        return ofi.iloc[-1] if not pd.isna(ofi.iloc[-1]) else 0.0


class OnChainFeatures:
    """链上数据特征"""
    
    def __init__(self, whale_threshold_usd: float = 100000):
        self.whale_threshold_usd = whale_threshold_usd
    
    def compute_whale_flow(self, transactions: pd.DataFrame, 
                          btc_price: float) -> Dict[str, float]:
        """
        计算大额转账流量
        
        Args:
            transactions: 链上交易 DataFrame (timestamp, amount, from_address, to_address, type)
            btc_price: 当前 BTC 价格
        
        Returns:
            大额流量特征字典
        """
        if len(transactions) == 0:
            return {'whale_inflow': 0, 'whale_outflow': 0, 'whale_net_flow': 0}
        
        # 计算 USD 价值
        transactions = transactions.copy()
        transactions['usd_value'] = transactions['amount'] * btc_price
        
        # 识别大额转账
        whale_mask = transactions['usd_value'] >= self.whale_threshold_usd
        whale_txns = transactions[whale_mask]
        
        # 分类流入/流出 (假设 type 包含 'exchange_deposit' / 'exchange_withdrawal')
        whale_inflow = whale_txns[whale_txns['type'] == 'exchange_deposit']['usd_value'].sum()
        whale_outflow = whale_txns[whale_txns['type'] == 'exchange_withdrawal']['usd_value'].sum()
        
        return {
            'whale_inflow': whale_inflow,
            'whale_outflow': whale_outflow,
            'whale_net_flow': whale_inflow - whale_outflow
        }
    
    def compute_exchange_flow(self, exchange_flows: pd.DataFrame, 
                             circulating_supply: float) -> Dict[str, float]:
        """
        计算交易所资金流量
        
        Args:
            exchange_flows: 交易所流量 DataFrame (timestamp, inflow, outflow)
            circulating_supply: 流通供应量
        
        Returns:
            流量特征字典
        """
        if len(exchange_flows) == 0:
            return {'exchange_net_flow': 0, 'exchange_flow_ratio': 0, 'reserve_change': 0}
        
        latest = exchange_flows.iloc[-1]
        
        net_flow = latest['inflow'] - latest['outflow']
        flow_ratio = net_flow / (circulating_supply + 1e-8)
        
        # 储备变化率
        if len(exchange_flows) > 1:
            prev = exchange_flows.iloc[-2]
            reserve_change = (latest['total_reserve'] - prev['total_reserve']) / (prev['total_reserve'] + 1e-8)
        else:
            reserve_change = 0
        
        return {
            'exchange_net_flow': net_flow,
            'exchange_flow_ratio': flow_ratio,
            'reserve_change': reserve_change
        }
    
    def compute_network_activity(self, activity_data: pd.DataFrame) -> Dict[str, float]:
        """
        计算网络活跃度特征
        
        Args:
            activity_data: 网络活动 DataFrame (active_addresses, transaction_count, gas_used)
        
        Returns:
            活跃度特征字典
        """
        if len(activity_data) == 0:
            return {'active_addresses': 0, 'tx_count': 0, 'gas_used': 0}
        
        latest = activity_data.iloc[-1]
        
        # 计算变化率 (如果有历史数据)
        if len(activity_data) > 7:
            week_ago = activity_data.iloc[-7]
            address_change = (latest['active_addresses'] - week_ago['active_addresses']) / (week_ago['active_addresses'] + 1e-8)
            tx_change = (latest['transaction_count'] - week_ago['transaction_count']) / (week_ago['transaction_count'] + 1e-8)
        else:
            address_change = 0
            tx_change = 0
        
        return {
            'active_addresses': latest['active_addresses'],
            'active_addresses_change': address_change,
            'transaction_count': latest['transaction_count'],
            'transaction_count_change': tx_change,
            'gas_used': latest.get('gas_used', 0)
        }
    
    def compute_holder_distribution(self, holder_data: Dict) -> Dict[str, float]:
        """
        计算持有者分布特征
        
        Args:
            holder_data: 持有者数据字典
        
        Returns:
            分布特征字典
        """
        # Top 持仓占比
        top1_percent = holder_data.get('top_1_percent', 0)
        top10_percent = holder_data.get('top_10_percent', 0)
        top100_percent = holder_data.get('top_100_percent', 0)
        
        # 集中度指标
        concentration = top10_percent / (top1_percent + 1e-8)
        
        # 新地址增长
        new_addresses = holder_data.get('new_addresses_24h', 0)
        total_addresses = holder_data.get('total_addresses', 1)
        address_growth = new_addresses / (total_addresses + 1e-8)
        
        return {
            'top_1_percent_holdings': top1_percent,
            'top_10_percent_holdings': top10_percent,
            'concentration_ratio': concentration,
            'address_growth_rate': address_growth
        }


class SentimentFeatures:
    """情绪特征"""
    
    def __init__(self):
        pass
    
    def compute_social_sentiment(self, social_data: pd.DataFrame) -> Dict[str, float]:
        """
        计算社交媒体情感
        
        Args:
            social_data: 社交数据 DataFrame (timestamp, positive, negative, neutral, mentions)
        
        Returns:
            情感特征字典
        """
        if len(social_data) == 0:
            return {'sentiment_score': 0, 'sentiment_volume': 0, 'sentiment_change': 0}
        
        latest = social_data.iloc[-1]
        
        # 情感得分
        total = latest['positive'] + latest['negative'] + latest['neutral'] + 1e-8
        sentiment_score = (latest['positive'] - latest['negative']) / total
        
        # 提及量 (相对于历史平均)
        mentions = latest['mentions']
        avg_mentions = social_data['mentions'].mean()
        sentiment_volume = mentions / (avg_mentions + 1e-8)
        
        # 情感变化
        if len(social_data) > 5:
            prev_sentiment = social_data.iloc[-6:-1]['sentiment_score'].mean() if 'sentiment_score' in social_data.columns else 0
            sentiment_change = sentiment_score - prev_sentiment
        else:
            sentiment_change = 0
        
        return {
            'sentiment_score': np.clip(sentiment_score, -1, 1),
            'sentiment_volume': sentiment_volume,
            'sentiment_change': sentiment_change,
            'mentions': mentions
        }
    
    def compute_news_sentiment(self, news_data: List[Dict]) -> Dict[str, float]:
        """
        计算新闻情感
        
        Args:
            news_data: 新闻列表，每项包含 {sentiment, source_weight, timestamp}
        
        Returns:
            新闻情感特征
        """
        if len(news_data) == 0:
            return {'news_sentiment': 0, 'news_count': 0, 'weighted_sentiment': 0}
        
        # 简单平均
        sentiments = [item['sentiment'] for item in news_data]
        news_sentiment = np.mean(sentiments)
        
        # 加权平均 (按来源权威性)
        weighted_sentiments = [item['sentiment'] * item.get('source_weight', 1) for item in news_data]
        weights = [item.get('source_weight', 1) for item in news_data]
        weighted_sentiment = np.sum(weighted_sentiments) / (np.sum(weights) + 1e-8)
        
        return {
            'news_sentiment': np.clip(news_sentiment, -1, 1),
            'news_count': len(news_data),
            'weighted_sentiment': np.clip(weighted_sentiment, -1, 1)
        }
    
    def compute_fear_greed(self, fg_index: float) -> Dict[str, float]:
        """
        恐惧贪婪指数特征
        
        Args:
            fg_index: 恐惧贪婪指数 (0-100)
        
        Returns:
            特征字典
        """
        # 标准化到 [-1, 1]
        normalized = (fg_index - 50) / 50
        
        # 极端值标志
        extreme_fear = 1 if fg_index < 20 else 0
        extreme_greed = 1 if fg_index > 80 else 0
        
        return {
            'fear_greed_index': fg_index,
            'fear_greed_normalized': normalized,
            'extreme_fear': extreme_fear,
            'extreme_greed': extreme_greed
        }


class MacroFeatures:
    """宏观特征"""
    
    def __init__(self):
        pass
    
    def compute_dxy_features(self, dxy_data: pd.DataFrame) -> Dict[str, float]:
        """
        美元指数特征
        
        Args:
            dxy_data: DXY 数据 DataFrame
        
        Returns:
            特征字典
        """
        if len(dxy_data) == 0:
            return {'dxy_level': 0, 'dxy_change': 0, 'dxy_correlation': 0}
        
        latest = dxy_data.iloc[-1]['value']
        
        # 日变化
        if len(dxy_data) > 1:
            dxy_change = (latest - dxy_data.iloc[-2]['value']) / dxy_data.iloc[-2]['value']
        else:
            dxy_change = 0
        
        return {
            'dxy_level': latest,
            'dxy_change': dxy_change
        }
    
    def compute_treasury_features(self, treasury_data: Dict) -> Dict[str, float]:
        """
        美债收益率特征
        
        Args:
            treasury_data: 包含 yield_10y, yield_2y 的字典
        
        Returns:
            特征字典
        """
        yield_10y = treasury_data.get('yield_10y', 0)
        yield_2y = treasury_data.get('yield_2y', 0)
        
        # 收益率曲线利差
        spread = yield_10y - yield_2y
        
        return {
            'yield_10y': yield_10y,
            'yield_2y': yield_2y,
            'yield_spread': spread,
            'inverted_curve': 1 if spread < 0 else 0
        }
    
    def compute_vix_features(self, vix_data: pd.DataFrame) -> Dict[str, float]:
        """
        VIX 恐慌指数特征
        
        Args:
            vix_data: VIX 数据 DataFrame
        
        Returns:
            特征字典
        """
        if len(vix_data) == 0:
            return {'vix_level': 0, 'vix_change': 0, 'vix_percentile': 0}
        
        latest = vix_data.iloc[-1]['value']
        
        # 日变化
        if len(vix_data) > 1:
            vix_change = (latest - vix_data.iloc[-2]['value']) / vix_data.iloc[-2]['value']
        else:
            vix_change = 0
        
        # 历史分位数
        vix_percentile = (vix_data['value'] < latest).mean()
        
        return {
            'vix_level': latest,
            'vix_change': vix_change,
            'vix_percentile': vix_percentile
        }


class FeatureEngineer:
    """
    主特征工程类
    
    整合所有特征源，生成统一特征向量
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        
        # 初始化各特征模块
        self.market_micro = MarketMicroFeatures(
            orderbook_depth=self.config.get('orderbook_depth', 10)
        )
        self.onchain = OnChainFeatures(
            whale_threshold_usd=self.config.get('whale_threshold_usd', 100000)
        )
        self.sentiment = SentimentFeatures()
        self.macro = MacroFeatures()
        
        # 特征名称列表
        self.feature_names = []
    
    def create_market_micro_features(self, orderbook: Dict, trades: pd.DataFrame) -> pd.Series:
        """创建市场微观特征"""
        features = {}
        
        # 订单簿不平衡度
        if 'bids' in orderbook and 'asks' in orderbook:
            features['orderbook_imbalance'] = self.market_micro.compute_orderbook_imbalance(
                orderbook['bids'], orderbook['asks']
            )
        
        # VPIN
        if len(trades) > 0:
            features['vpin'] = self.market_micro.compute_vpin(trades)
            features['price_impact'] = self.market_micro.compute_price_impact(trades)
            
            # 成交量分布
            vol_dist = self.market_micro.compute_volume_distribution(trades)
            features.update(vol_dist)
            
            # 订单流不平衡
            features['order_flow_imbalance'] = self.market_micro.compute_order_flow_imbalance(trades)
        
        return pd.Series(features)
    
    def create_onchain_features(self, transactions: pd.DataFrame,
                               exchange_flows: pd.DataFrame,
                               activity: pd.DataFrame,
                               holders: Dict,
                               btc_price: float,
                               circulating_supply: float) -> pd.Series:
        """创建链上特征"""
        features = {}
        
        # 大额转账
        whale_flow = self.onchain.compute_whale_flow(transactions, btc_price)
        features.update(whale_flow)
        
        # 交易所流量
        exchange_flow = self.onchain.compute_exchange_flow(exchange_flows, circulating_supply)
        features.update(exchange_flow)
        
        # 网络活跃度
        network_activity = self.onchain.compute_network_activity(activity)
        features.update(network_activity)
        
        # 持有者分布
        holder_dist = self.onchain.compute_holder_distribution(holders)
        features.update(holder_dist)
        
        return pd.Series(features)
    
    def create_sentiment_features(self, social_data: pd.DataFrame,
                                 news_data: List[Dict],
                                 fear_greed_index: float) -> pd.Series:
        """创建情绪特征"""
        features = {}
        
        # 社交媒体情感
        social_sentiment = self.sentiment.compute_social_sentiment(social_data)
        features.update(social_sentiment)
        
        # 新闻情感
        news_sentiment = self.sentiment.compute_news_sentiment(news_data)
        features.update(news_sentiment)
        
        # 恐惧贪婪指数
        fg_features = self.sentiment.compute_fear_greed(fear_greed_index)
        features.update(fg_features)
        
        return pd.Series(features)
    
    def create_macro_features(self, dxy_data: pd.DataFrame,
                             treasury_data: Dict,
                             vix_data: pd.DataFrame) -> pd.Series:
        """创建宏观特征"""
        features = {}
        
        # DXY
        dxy_features = self.macro.compute_dxy_features(dxy_data)
        features.update(dxy_features)
        
        # 美债
        treasury_features = self.macro.compute_treasury_features(treasury_data)
        features.update(treasury_features)
        
        # VIX
        vix_features = self.macro.compute_vix_features(vix_data)
        features.update(vix_features)
        
        return pd.Series(features)
    
    def create_lag_features(self, price_series: pd.Series, 
                           lags: List[int] = [1, 5, 15, 60]) -> pd.Series:
        """创建价格滞后特征"""
        features = {}
        
        for lag in lags:
            features[f'price_lag_{lag}'] = price_series.pct_change(lag)
            features[f'volume_lag_{lag}'] = price_series.rolling(lag).mean()  # 简化
        
        return pd.Series(features)
    
    def create_volatility_features(self, returns: pd.Series,
                                  windows: List[int] = [5, 15, 60, 240]) -> pd.Series:
        """创建波动率特征"""
        features = {}
        
        for window in windows:
            # 已实现波动率
            features[f'volatility_{window}m'] = returns.rolling(window).std()
        
        # 波动率偏斜 (上下行波动不对称)
        upside_vol = returns[returns > 0].rolling(60).std()
        downside_vol = returns[returns < 0].rolling(60).std()
        features['volatility_skew'] = upside_vol / (downside_vol + 1e-8)
        
        return pd.Series(features)
    
    def engineer_features(self, market_data: Dict, onchain_data: Dict,
                         sentiment_data: Dict, macro_data: Dict) -> pd.DataFrame:
        """
        主特征工程函数
        
        Args:
            market_data: 包含 orderbook, trades, prices
            onchain_data: 包含 transactions, exchange_flows, activity, holders
            sentiment_data: 包含 social, news, fear_greed
            macro_data: 包含 dxy, treasury, vix
        
        Returns:
            特征 DataFrame
        """
        all_features = {}
        
        # 市场微观特征
        mm_features = self.create_market_micro_features(
            market_data.get('orderbook', {}),
            market_data.get('trades', pd.DataFrame())
        )
        all_features.update(mm_features.to_dict())
        
        # 链上特征
        oc_features = self.create_onchain_features(
            onchain_data.get('transactions', pd.DataFrame()),
            onchain_data.get('exchange_flows', pd.DataFrame()),
            onchain_data.get('activity', pd.DataFrame()),
            onchain_data.get('holders', {}),
            market_data.get('btc_price', 50000),
            market_data.get('circulating_supply', 19000000)
        )
        all_features.update(oc_features.to_dict())
        
        # 情绪特征
        sent_features = self.create_sentiment_features(
            sentiment_data.get('social', pd.DataFrame()),
            sentiment_data.get('news', []),
            sentiment_data.get('fear_greed', 50)
        )
        all_features.update(sent_features.to_dict())
        
        # 宏观特征
        macro_features = self.create_macro_features(
            macro_data.get('dxy', pd.DataFrame()),
            macro_data.get('treasury', {}),
            macro_data.get('vix', pd.DataFrame())
        )
        all_features.update(macro_features.to_dict())
        
        # 价格和波动率特征
        prices = market_data.get('prices', pd.Series())
        if len(prices) > 0:
            returns = prices.pct_change()
            lag_features = self.create_lag_features(prices)
            vol_features = self.create_volatility_features(returns)
            all_features.update(lag_features.to_dict())
            all_features.update(vol_features.to_dict())
        
        # 时间特征
        now = datetime.now()
        all_features['hour'] = now.hour
        all_features['day_of_week'] = now.dayofweek
        all_features['is_weekend'] = 1 if now.dayofweek >= 5 else 0
        
        # 更新特征名称
        self.feature_names = list(all_features.keys())
        
        return pd.DataFrame([all_features])
    
    def get_feature_names(self) -> List[str]:
        """获取特征名称列表"""
        return self.feature_names
    
    def preprocess_features(self, features_df: pd.DataFrame,
                           fit_params: Optional[Dict] = None) -> Tuple[pd.DataFrame, Dict]:
        """
        特征预处理 (标准化、缺失值处理)
        
        Args:
            features_df: 原始特征 DataFrame
            fit_params: 已有的标准化参数 (用于推理)
        
        Returns:
            (处理后的 DataFrame, 标准化参数)
        """
        df = features_df.copy()
        
        # 缺失值处理
        df = df.fillna(method='ffill').fillna(0)
        
        # 异常值处理 (Winsorization)
        for col in df.columns:
            if df[col].dtype in [np.float64, np.int64]:
                lower = df[col].quantile(0.01)
                upper = df[col].quantile(0.99)
                df[col] = np.clip(df[col], lower, upper)
        
        # 标准化
        if fit_params is None:
            # 训练阶段：计算参数
            mean = df.mean()
            std = df.std().replace(0, 1)
            fit_params = {'mean': mean, 'std': std}
        else:
            # 推理阶段：使用已有参数
            mean = fit_params['mean']
            std = fit_params['std']
        
        df_scaled = (df - mean) / std
        
        return df_scaled, fit_params


# 使用示例
if __name__ == '__main__':
    # 初始化特征工程
    config = {
        'orderbook_depth': 10,
        'whale_threshold_usd': 100000
    }
    engineer = FeatureEngineer(config)
    
    # 模拟数据
    market_data = {
        'orderbook': {
            'bids': pd.DataFrame({'price': [50000, 49999, 49998], 'volume': [10, 20, 30]}),
            'asks': pd.DataFrame({'price': [50001, 50002, 50003], 'volume': [15, 25, 35]})
        },
        'trades': pd.DataFrame({
            'timestamp': [1, 2, 3, 4, 5],
            'price': [50000, 50001, 50000, 50002, 50001],
            'volume': [1, 2, 1.5, 3, 2],
            'side': ['buy', 'buy', 'sell', 'buy', 'sell']
        }),
        'prices': pd.Series([50000, 50001, 50000, 50002, 50001, 50003]),
        'btc_price': 50000,
        'circulating_supply': 19000000
    }
    
    onchain_data = {
        'transactions': pd.DataFrame({
            'timestamp': [1, 2, 3],
            'amount': [10, 5, 100],
            'type': ['exchange_deposit', 'exchange_withdrawal', 'exchange_deposit']
        }),
        'exchange_flows': pd.DataFrame({
            'inflow': [100, 150],
            'outflow': [80, 120],
            'total_reserve': [10000, 10030]
        }),
        'activity': pd.DataFrame({
            'active_addresses': [500000],
            'transaction_count': [300000],
            'gas_used': [15000000]
        }),
        'holders': {
            'top_1_percent': 45,
            'top_10_percent': 70,
            'new_addresses_24h': 10000,
            'total_addresses': 50000000
        }
    }
    
    sentiment_data = {
        'social': pd.DataFrame({
            'positive': [100],
            'negative': [50],
            'neutral': [200],
            'mentions': [5000]
        }),
        'news': [
            {'sentiment': 0.6, 'source_weight': 1.5},
            {'sentiment': -0.2, 'source_weight': 1.0}
        ],
        'fear_greed': 55
    }
    
    macro_data = {
        'dxy': pd.DataFrame({'value': [103.5, 103.6]}),
        'treasury': {'yield_10y': 4.2, 'yield_2y': 4.5},
        'vix': pd.DataFrame({'value': [15, 16]})
    }
    
    # 生成特征
    features_df = engineer.engineer_features(
        market_data, onchain_data, sentiment_data, macro_data
    )
    
    # 预处理
    features_scaled, fit_params = engineer.preprocess_features(features_df)
    
    print(f"生成特征数量：{len(features_scaled.columns)}")
    print(f"特征名称：{engineer.get_feature_names()[:10]}...")  # 显示前 10 个
    print(f"\n特征样本:\n{features_scaled.T.head(15)}")
