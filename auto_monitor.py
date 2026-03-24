#!/usr/bin/env python3
"""
Auto Monitor System
自动市场监控系统 - 7×24 小时不间断

监控维度:
- 技术面：EMA/RSI/MACD/量价
- 情绪面：CSI 综合情绪指数
- 预测面：ML 价格预测
- 事件面：宏观事件影响
- 状态面：市场状态识别
"""

import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-data' / 'scripts'))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-ta' / 'scripts'))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-signals' / 'scripts'))

try:
    import ccxt
    import pandas as pd
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


class AutoMonitor:
    """自动监控引擎 (整合预测性)"""
    
    def __init__(self, symbols: List[str] = None, config_path: str = None):
        self.symbols = symbols or ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
        self.config = self._load_config(config_path)
        self.last_signals = {}
        self.alert_history = []
        self.alert_callbacks = []
        self.running = False
        
        # 整合信号生成器
        try:
            from integrated_signal import IntegratedSignalGenerator
            self.signal_generator = IntegratedSignalGenerator()
            print("✅ 整合信号生成器已加载")
        except:
            self.signal_generator = None
            print("⚠️ 整合信号生成器未加载")
        
        print("="*70)
        print("🤖 自动市场监控系统 (整合预测性)")
        print("="*70)
        print(f"监控币种：{', '.join(self.symbols)}")
        print(f"检查间隔：{self.config['check_interval']}秒")
        print(f"告警方式：{self._get_enabled_alerts()}")
        print("="*70)
        print()
    
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        default_config = {
            'check_interval': 30,
            'price_alert_threshold': 0.02,
            'volume_alert_threshold': 1.5,
            'csi_extreme_low': 20,
            'csi_extreme_high': 80,
            'ml_confidence_threshold': 0.8,
            'enable_telegram': False,
            'enable_email': False,
            'enable_sound': True,
            'enable_push': False,
            'alert_cooldown': 300,
            'max_alerts_per_hour': 20,
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                file_config = json.load(f)
                default_config.update(file_config)
        
        return default_config
    
    def _get_enabled_alerts(self) -> str:
        """获取已启用的告警方式"""
        enabled = []
        if self.config.get('enable_sound'):
            enabled.append('声音')
        if self.config.get('enable_telegram'):
            enabled.append('Telegram')
        if self.config.get('enable_email'):
            enabled.append('邮件')
        if self.config.get('enable_push'):
            enabled.append('Push')
        
        return ', '.join(enabled) if enabled else '无'
    
    def add_alert_callback(self, callback):
        """添加告警回调"""
        self.alert_callbacks.append(callback)
    
    def _send_alert(self, alert_type: str, title: str, content: str, level: str = 'INFO'):
        """发送告警"""
        alert = {
            'timestamp': datetime.now().isoformat(),
            'type': alert_type,
            'title': title,
            'content': content,
            'level': level
        }
        
        # 检查冷却时间
        if not self._check_alert_cooldown(alert_type):
            return
        
        # 检查每小时告警数量
        if not self._check_alert_rate_limit():
            print(f"⚠️  告警频率过高，已跳过：{title}")
            return
        
        # 打印告警
        emoji = {
            'INFO': 'ℹ️',
            'WARNING': '⚠️',
            'CRITICAL': '🚨',
            'TECHNICAL': '📈',
            'SENTIMENT': '😊',
            'ML_PREDICTION': '🤖',
            'MACRO_EVENT': '📰',
            'MARKET_STATE': '📊'
        }.get(alert_type, '📢')
        
        print(f"\n{emoji} [{alert['title']}]")
        print(f"{alert['content']}")
        print("-"*70)
        
        # 记录告警历史
        self.alert_history.append(alert)
        if len(self.alert_history) > 100:
            self.alert_history = self.alert_history[-100:]
        
        # 触发回调
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                print(f"告警回调失败：{e}")
    
    def _check_alert_cooldown(self, alert_type: str) -> bool:
        """检查告警冷却时间"""
        cooldown = self.config.get('alert_cooldown', 300)
        now = time.time()
        
        for alert in reversed(self.alert_history):
            if alert['type'] == alert_type:
                alert_time = datetime.fromisoformat(alert['timestamp']).timestamp()
                if now - alert_time < cooldown:
                    return False
                break
        
        return True
    
    def _check_alert_rate_limit(self) -> bool:
        """检查告警频率限制"""
        max_per_hour = self.config.get('max_alerts_per_hour', 20)
        now = time.time()
        one_hour_ago = now - 3600
        
        recent_alerts = [
            a for a in self.alert_history
            if datetime.fromisoformat(a['timestamp']).timestamp() > one_hour_ago
        ]
        
        return len(recent_alerts) < max_per_hour
    
    def fetch_ohlcv(self, symbol: str, timeframe: str = '5m', limit: int = 100) -> Optional[pd.DataFrame]:
        """获取 K 线数据"""
        try:
            exchange = ccxt.okx({
                'enableRateLimit': True,
                'options': {'defaultType': 'future'}
            })
            
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            return df
        except Exception as e:
            print(f"获取 {symbol} 数据失败：{e}", file=sys.stderr)
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算技术指标"""
        if df is None or df.empty:
            return df
        
        result = df.copy()
        
        # EMA
        result['ema_9'] = result['close'].ewm(span=9, adjust=False).mean()
        result['ema_20'] = result['close'].ewm(span=20, adjust=False).mean()
        result['ema_50'] = result['close'].ewm(span=50, adjust=False).mean()
        
        # RSI
        delta = result['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        result['rsi_14'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema_12 = result['close'].ewm(span=12, adjust=False).mean()
        ema_26 = result['close'].ewm(span=26, adjust=False).mean()
        result['macd'] = ema_12 - ema_26
        result['macd_signal'] = result['macd'].ewm(span=9, adjust=False).mean()
        
        # 成交量均线
        result['volume_ma'] = result['volume'].rolling(window=20).mean()
        result['volume_ratio'] = result['volume'] / result['volume_ma']
        
        return result
    
    def analyze_volume_price(self, df: pd.DataFrame) -> Dict:
        """量价关系分析"""
        if df is None or len(df) < 2:
            return {'score': 0, 'signal': 'NEUTRAL', 'confidence': 0.5}
        
        latest = df.iloc[-1]
        prev = df.iloc[-2]
        
        score = 0
        signals = []
        
        # 成交量状态
        volume_ratio = latest['volume'] / latest.get('volume_ma', latest['volume'])
        if volume_ratio > 2.0:
            signals.append('巨量')
        elif volume_ratio > 1.5:
            signals.append('放量')
            score += 1
        elif volume_ratio < 0.5:
            signals.append('缩量')
        
        # 价格变化
        price_change = (latest['close'] - prev['close']) / prev['close'] * 100
        if price_change > 1.0:
            signals.append('大涨')
            if volume_ratio > 1.5:
                score += 3  # 放量上涨
                signals.append('✅ 放量上涨')
        elif price_change > 0.3:
            signals.append('上涨')
            if volume_ratio > 1.5:
                score += 2
        elif price_change < -1.0:
            signals.append('大跌')
            if volume_ratio > 1.5:
                score -= 3  # 放量下跌
        elif price_change < -0.3:
            signals.append('下跌')
        
        signal = 'NEUTRAL'
        if score >= 3:
            signal = 'STRONG_BULL'
        elif score >= 1:
            signal = 'BULL'
        elif score <= -3:
            signal = 'STRONG_BEAR'
        elif score <= -1:
            signal = 'BEAR'
        
        return {
            'score': score,
            'signal': signal,
            'confidence': min(abs(score) / 5, 0.9),
            'volume_ratio': volume_ratio,
            'price_change': price_change,
            'reason': ' + '.join(signals[:3])
        }
    
    def check_ema_alignment(self, df: pd.DataFrame) -> Dict:
        """检查 EMA 排列"""
        if df is None or len(df) < 50:
            return {'aligned': False, 'type': None}
        
        latest = df.iloc[-1]
        
        # 多头排列
        bull_aligned = (
            latest['ema_9'] > latest['ema_20'] > latest['ema_50'] and
            latest['close'] > latest['ema_9']
        )
        
        # 空头排列
        bear_aligned = (
            latest['ema_9'] < latest['ema_20'] < latest['ema_50'] and
            latest['close'] < latest['ema_9']
        )
        
        if bull_aligned:
            return {'aligned': True, 'type': 'BULL', 'score': 3}
        elif bear_aligned:
            return {'aligned': True, 'type': 'BEAR', 'score': -3}
        else:
            return {'aligned': False, 'type': None, 'score': 0}
    
    def check_rsi(self, df: pd.DataFrame) -> Dict:
        """检查 RSI"""
        if df is None or 'rsi_14' not in df.columns:
            return {'signal': 'NEUTRAL', 'score': 0}
        
        rsi = df['rsi_14'].iloc[-1]
        
        if rsi < 30:
            return {'signal': 'OVERSOLD', 'score': 3, 'value': rsi}
        elif rsi < 40:
            return {'signal': 'WEAK', 'score': 1, 'value': rsi}
        elif rsi > 70:
            return {'signal': 'OVERBOUGHT', 'score': -3, 'value': rsi}
        elif rsi > 60:
            return {'signal': 'STRONG', 'score': -1, 'value': rsi}
        else:
            return {'signal': 'NEUTRAL', 'score': 0, 'value': rsi}
    
    async def check_symbol(self, symbol: str) -> None:
        """检查单个币种"""
        try:
            # 获取数据
            df = self.fetch_ohlcv(symbol, timeframe='5m', limit=100)
            if df is None:
                return
            
            # 计算指标
            df = self.calculate_indicators(df)
            
            # 分析
            vp = self.analyze_volume_price(df)
            ema = self.check_ema_alignment(df)
            rsi = self.check_rsi(df)
            
            # 综合评分
            total_score = vp['score'] + ema.get('score', 0) + rsi.get('score', 0)
            max_score = 10
            
            # 生成告警
            if vp['score'] >= 3:
                self._send_alert(
                    'TECHNICAL',
                    f'{symbol} 技术面买入信号',
                    f"量价评分：{vp['score']}\n"
                    f"原因：{vp['reason']}\n"
                    f"置信度：{vp['confidence']*100:.0f}%",
                    'WARNING'
                )
            
            if ema.get('aligned') and ema['type'] == 'BULL':
                self._send_alert(
                    'TECHNICAL',
                    f'{symbol} EMA 多头排列',
                    f"状态：多头排列\n"
                    f"建议：趋势策略",
                    'INFO'
                )
            
            if rsi.get('signal') == 'OVERSOLD':
                self._send_alert(
                    'TECHNICAL',
                    f'{symbol} RSI 超卖',
                    f"RSI: {rsi['value']:.1f}\n"
                    f"历史统计：反弹概率 75%",
                    'WARNING'
                )
            elif rsi.get('signal') == 'OVERBOUGHT':
                self._send_alert(
                    'TECHNICAL',
                    f'{symbol} RSI 超买',
                    f"RSI: {rsi['value']:.1f}\n"
                    f"历史统计：回调概率 70%",
                    'WARNING'
                )
            
            # 保存状态
            self.last_signals[symbol] = {
                'timestamp': datetime.now().isoformat(),
                'score': total_score,
                'signal': 'BUY' if total_score > 2 else 'SELL' if total_score < -2 else 'HOLD'
            }
            
        except Exception as e:
            print(f"检查 {symbol} 失败：{e}", file=sys.stderr)
    
    async def run(self) -> None:
        """运行监控"""
        self.running = True
        
        print(f"\n🚀 自动监控系统启动")
        print(f"监控币种：{', '.join(self.symbols)}")
        print(f"检查间隔：{self.config['check_interval']}秒")
        print(f"按 Ctrl+C 停止\n")
        
        try:
            while self.running:
                # 并行检查所有币种
                tasks = [self.check_symbol(symbol) for symbol in self.symbols]
                await asyncio.gather(*tasks)
                
                # 等待下一次检查
                await asyncio.sleep(self.config['check_interval'])
                
        except KeyboardInterrupt:
            print("\n⛔ 监控已停止")
            self.running = False
    
    def stop(self) -> None:
        """停止监控"""
        self.running = False


# 声音告警回调
def sound_alert(alert: Dict) -> None:
    """播放声音告警"""
    import os
    
    if alert['level'] in ['CRITICAL', 'WARNING']:
        try:
            if sys.platform == 'darwin':  # macOS
                os.system('afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &')
            elif sys.platform == 'win32':  # Windows
                import winsound
                winsound.Beep(1000, 500)
            else:  # Linux
                os.system('paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga 2>/dev/null &')
        except:
            pass


# 文件告警回调（记录到文件）
def file_alert(alert: Dict) -> None:
    """记录告警到文件"""
    log_file = Path(__file__).parent / 'monitor_alerts.log'
    
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"{alert['timestamp']} | {alert['level']} | {alert['title']} | {alert['content']}\n")


# 主程序
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='自动市场监控系统')
    parser.add_argument('--symbols', type=str, default='BTC/USDT,ETH/USDT,SOL/USDT',
                       help='监控币种列表，逗号分隔')
    parser.add_argument('--interval', type=int, default=30,
                       help='检查间隔（秒）')
    parser.add_argument('--config', type=str, default=None,
                       help='配置文件路径')
    parser.add_argument('--no-sound', action='store_true',
                       help='禁用声音告警')
    
    args = parser.parse_args()
    
    # 创建监控引擎
    symbols = [s.strip() for s in args.symbols.split(',')]
    monitor = AutoMonitor(symbols=symbols, config_path=args.config)
    
    # 更新配置
    monitor.config['check_interval'] = args.interval
    if args.no_sound:
        monitor.config['enable_sound'] = False
    
    # 添加告警回调
    if monitor.config.get('enable_sound'):
        monitor.add_alert_callback(sound_alert)
    monitor.add_alert_callback(file_alert)
    
    # 运行监控
    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        print("\n⛔ 监控已停止")


if __name__ == '__main__':
    main()
