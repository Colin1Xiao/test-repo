"""
真实市场数据 API - 为面板提供实时市场数据

使用 ccxt 同步模式获取 OKX 数据，避免 asyncio 与 Flask 冲突
"""

import ccxt
import time
import threading
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


class MarketDataAPI:
    """面板用市场数据API - 同步模式"""
    
    def __init__(self):
        self.exchange = ccxt.okx({
            'enableRateLimit': True,
            'options': {'defaultType': 'swap'},
            'proxies': {
                'http': 'socks5://127.0.0.1:7890',
                'https': 'socks5://127.0.0.1:7890',
            },
            'aiohttp_proxy': 'socks5://127.0.0.1:7890',
        })
        
        # 缓存
        self._cache = {
            'ticker': None,
            'orderbook': None,
            'ohlcv_1h': None,
            'ohlcv_15m': None,
            'funding_rate': None,
            'last_update': None,
        }
        self._cache_ttl = 3  # 缓存3秒
        self._lock = threading.Lock()
        
        # 读取本地状态文件
        self.base_dir = Path(__file__).parent.parent
        self.live_state_path = self.base_dir / "logs" / "live_state.json"
        self.state_store_path = self.base_dir / "logs" / "state_store.json"
        
        self.symbol = "ETH/USDT:USDT"
        print("✅ MarketDataAPI 初始化完成")
    
    def _is_fresh(self, key: str) -> bool:
        if self._cache.get('last_update') is None:
            return False
        elapsed = time.time() - self._cache['last_update'].get(key, 0)
        return elapsed < self._cache_ttl
    
    def get_ticker(self) -> Dict[str, Any]:
        """获取实时行情"""
        if self._is_fresh('ticker') and self._cache['ticker']:
            return self._cache['ticker']
        
        try:
            ticker = self.exchange.fetch_ticker(self.symbol)
            result = {
                'symbol': self.symbol,
                'last': ticker['last'],
                'bid': ticker['bid'],
                'ask': ticker['ask'],
                'high': ticker['high'],
                'low': ticker['low'],
                'volume': ticker['baseVolume'],
                'quoteVolume': ticker['quoteVolume'],
                'change': ticker['change'],
                'percentage': ticker['percentage'],
                'timestamp': ticker['timestamp'],
            }
            with self._lock:
                self._cache['ticker'] = result
                if not self._cache.get('last_update'):
                    self._cache['last_update'] = {}
                self._cache['last_update']['ticker'] = time.time()
            return result
        except Exception as e:
            print(f"❌ 获取行情失败: {e}")
            return self._cache.get('ticker') or {'error': str(e)}
    
    def get_orderbook(self, limit: int = 10) -> Dict[str, Any]:
        """获取订单簿"""
        if self._is_fresh('orderbook') and self._cache['orderbook']:
            return self._cache['orderbook']
        
        try:
            ob = self.exchange.fetch_order_book(self.symbol, limit)
            best_bid = ob['bids'][0][0] if ob['bids'] else 0
            best_ask = ob['asks'][0][0] if ob['asks'] else 0
            spread = (best_ask - best_bid) / best_bid * 10000 if best_bid > 0 else 0
            
            result = {
                'bids': ob['bids'][:limit],
                'asks': ob['asks'][:limit],
                'spread_bps': round(spread, 2),
                'mid_price': round((best_bid + best_ask) / 2, 2),
            }
            with self._lock:
                self._cache['orderbook'] = result
                self._cache['last_update']['orderbook'] = time.time()
            return result
        except Exception as e:
            print(f"❌ 获取订单簿失败: {e}")
            return self._cache.get('orderbook') or {'error': str(e)}
    
    def get_ohlcv(self, timeframe: str = '1h', limit: int = 24) -> list:
        """获取K线数据"""
        cache_key = f'ohlcv_{timeframe}'
        if self._is_fresh(cache_key) and self._cache.get(cache_key):
            return self._cache[cache_key]
        
        try:
            ohlcv = self.exchange.fetch_ohlcv(self.symbol, timeframe, limit=limit)
            result = [{
                'timestamp': c[0],
                'open': c[1],
                'high': c[2],
                'low': c[3],
                'close': c[4],
                'volume': c[5],
            } for c in ohlcv]
            
            with self._lock:
                self._cache[cache_key] = result
                self._cache['last_update'][cache_key] = time.time()
            return result
        except Exception as e:
            print(f"❌ 获取K线失败: {e}")
            return self._cache.get(cache_key) or []
    
    def get_funding_rate(self) -> Dict[str, Any]:
        """获取资金费率"""
        if self._is_fresh('funding_rate') and self._cache['funding_rate']:
            return self._cache['funding_rate']
        
        try:
            funding = self.exchange.fetch_funding_rate(self.symbol)
            result = {
                'symbol': self.symbol,
                'funding_rate': funding.get('fundingRate', 0),
                'next_funding_time': funding.get('fundingDatetime'),
                'timestamp': funding.get('timestamp'),
            }
            with self._lock:
                self._cache['funding_rate'] = result
                self._cache['last_update']['funding_rate'] = time.time()
            return result
        except Exception as e:
            print(f"❌ 获取资金费率失败: {e}")
            return self._cache.get('funding_rate') or {'error': str(e)}
    
    def get_local_live_state(self) -> Dict[str, Any]:
        """读取本地 live_state.json"""
        try:
            if self.live_state_path.exists():
                with open(self.live_state_path) as f:
                    return json.load(f)
        except Exception as e:
            print(f"❌ 读取 live_state 失败: {e}")
        return {}
    
    def get_local_state_store(self) -> Dict[str, Any]:
        """读取本地 state_store.json"""
        try:
            if self.state_store_path.exists():
                with open(self.state_store_path) as f:
                    return json.load(f)
        except Exception as e:
            print(f"❌ 读取 state_store 失败: {e}")
        return {}
    
    def compute_market_structure(self, ohlcv_1h: list) -> Dict[str, Any]:
        """基于K线计算市场结构指标"""
        if not ohlcv_1h or len(ohlcv_1h) < 10:
            return {}
        
        closes = [c['close'] for c in ohlcv_1h]
        highs = [c['high'] for c in ohlcv_1h]
        lows = [c['low'] for c in ohlcv_1h]
        volumes = [c['volume'] for c in ohlcv_1h]
        
        # 趋势强度：最近N根K线的方向一致性
        changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        up = sum(1 for c in changes if c > 0)
        trend_strength = round(abs(up / len(changes) - 0.5) * 2, 2)
        
        # 波动性：ATR / 当前价格
        atr_values = [highs[i] - lows[i] for i in range(len(highs))]
        avg_atr = sum(atr_values[-14:]) / min(14, len(atr_values))
        current_price = closes[-1]
        volatility = round(avg_atr / current_price, 4) if current_price > 0 else 0
        
        # 量能：最近量 vs 均量
        avg_vol = sum(volumes) / len(volumes)
        recent_vol = sum(volumes[-3:]) / 3
        volume_ratio = round(recent_vol / avg_vol, 2) if avg_vol > 0 else 1
        
        # Regime 判断
        sma_fast = sum(closes[-5:]) / 5
        sma_slow = sum(closes[-20:]) / min(20, len(closes))
        if sma_fast > sma_slow * 1.002:
            regime = "TREND_UP"
        elif sma_fast < sma_slow * 0.998:
            regime = "TREND_DOWN"
        else:
            regime = "RANGE"
        
        # 支撑阻力
        recent_lows = sorted(lows[-20:])
        recent_highs = sorted(highs[-20:], reverse=True)
        support = round(recent_lows[1] if len(recent_lows) > 1 else recent_lows[0], 2)
        resistance = round(recent_highs[1] if len(recent_highs) > 1 else recent_highs[0], 2)
        
        return {
            'trend_strength': trend_strength,
            'volatility': volatility,
            'volume_ratio': volume_ratio,
            'regime': regime,
            'support': support,
            'resistance': resistance,
            'atr': round(avg_atr, 2),
            'sma_fast': round(sma_fast, 2),
            'sma_slow': round(sma_slow, 2),
        }
    
    def get_evolution_data(self) -> Dict[str, Any]:
        """获取真实演化引擎数据 - 从策略版本历史"""
        evolution_data = {
            'iterations': 0,
            'population_size': 50,
            'fitness_avg': 0,
            'fitness_best': 0,
            'mutations': [],
        }
        
        # 读取各版本策略统计
        versions = ['v35', 'v36', 'v37', 'v38']
        version_stats = []
        
        for v in versions:
            stats_path = self.base_dir / "data" / f"{v}_stats.json"
            if stats_path.exists():
                try:
                    with open(stats_path) as f:
                        stats = json.load(f)
                        version_stats.append({
                            'version': stats.get('version', v),
                            'total_trades': stats.get('total_trades', 0),
                            'wins': stats.get('wins', 0),
                            'losses': stats.get('losses', 0),
                            'total_pnl': stats.get('total_pnl', 0),
                            'win_rate': stats.get('wins', 0) / max(stats.get('total_trades', 1), 1) * 100,
                        })
                except Exception as e:
                    print(f"⚠️ 读取 {v}_stats 失败: {e}")
        
        if version_stats:
            # 计算演化指标
            evolution_data['iterations'] = len(version_stats)
            evolution_data['fitness_avg'] = round(sum(v['win_rate'] for v in version_stats) / len(version_stats), 2)
            evolution_data['fitness_best'] = round(max(v['win_rate'] for v in version_stats), 2)
            
            # 生成变异记录（基于版本间的参数改进）
            for i, v in enumerate(version_stats[1:], 1):
                prev = version_stats[i-1]
                if v['total_pnl'] > prev['total_pnl']:
                    fitness_change = round(v['win_rate'] - prev['win_rate'], 2)
                    evolution_data['mutations'].append({
                        'strategy_id': f"STR-{v['version']}",
                        'param_change': f"版本升级: {prev['version']} → {v['version']}",
                        'fitness_change': fitness_change,
                        'total_pnl': round(v['total_pnl'], 6),
                    })
        
        return evolution_data
    
    def get_full_market_data(self) -> Dict[str, Any]:
        """获取完整市场数据（面板用）"""
        ticker = self.get_ticker()
        orderbook = self.get_orderbook()
        ohlcv_1h = self.get_ohlcv('1h', 24)
        funding = self.get_funding_rate()
        market_structure = self.compute_market_structure(ohlcv_1h)
        local_state = self.get_local_state_store()
        evolution = self.get_evolution_data()
        
        # 计算决策追踪真实数据
        events = local_state.get('events', [])
        trades = [e for e in events if e.get('event') == 'exit']
        win_trades = [t for t in trades if t.get('pnl', 0) > 0]
        loss_trades = [t for t in trades if t.get('pnl', 0) <= 0]
        total_pnl = sum(t.get('pnl', 0) for t in trades)
        
        return {
            'ticker': ticker,
            'orderbook': orderbook,
            'ohlcv_1h': ohlcv_1h,
            'funding': funding,
            'market_structure': market_structure,
            'evolution': evolution,
            'decision_tracking': {
                'total_decisions': len(trades),
                'win_count': len(win_trades),
                'loss_count': len(loss_trades),
                'success_rate': round(len(win_trades) / max(len(trades), 1) * 100, 1),
                'total_pnl': round(total_pnl, 6),
                'avg_pnl': round(total_pnl / max(len(trades), 1), 6),
                'profit_factor': round(
                    abs(sum(t['pnl'] for t in win_trades)) / max(abs(sum(t['pnl'] for t in loss_trades)), 0.000001), 2
                ) if trades else 0,
                'trades': trades[-10:],  # 最近10笔
            },
            'timestamp': datetime.utcnow().isoformat(),
        }


# 单例
_market_api = None

def get_market_api() -> MarketDataAPI:
    global _market_api
    if _market_api is None:
        _market_api = MarketDataAPI()
    return _market_api
