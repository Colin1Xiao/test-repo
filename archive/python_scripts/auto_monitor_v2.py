#!/usr/bin/env python3
"""
Auto Monitor System V2 (整合预测性)
自动监控系统 v2 - 完全整合技术面 + 预测面

功能:
- 技术面分析 (量价/EMA/RSI/MACD)
- 预测面分析 (ML/情绪/宏观)
- 整合信号生成
- 多维度告警
- 7×24 小时监控
"""

import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List
# 设置代理环境变量
import os
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'
# 清除no_proxy，确保交易所API走代理
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']



# 添加路径
sys.path.insert(0, str(Path(__file__).parent))

# 确保代理设置后再导入 ccxt
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


class AutoMonitorV2:
    """自动监控系统 v2 (完全整合版)"""
    
    def __init__(self, symbols: List[str] = None, config_path: str = None):
        # 默认监控标的：BTC/ETH/SOL + 建议扩充标的
        default_symbols = [
            'BTC/USDT:USDT',    # 主力
            'ETH/USDT:USDT',    # 主力
            'SOL/USDT:USDT',    # 高波动
            'UNI/USDT:USDT',    # DeFi 龙头 (建议)
            'AVAX/USDT:USDT',   # 老牌公链 (建议)
            'INJ/USDT:USDT',    # DeFi 新星 (建议)
        ]
        self.symbols = symbols or default_symbols
        self.config = self._load_config(config_path)
        self.last_signals = {}
        self.alert_history = []
        self.running = False
        
        # 加载整合模块
        print("="*70)
        print("🤖 自动监控系统 V2 (整合预测性)")
        print("="*70)
        
        self._load_modules()
        
        # 加载 Telegram 告警
        try:
            from telegram_alert import TelegramAlert
            self.telegram = TelegramAlert()
            if self.telegram.enabled:
                print("✅ Telegram 告警已加载")
            else:
                print("⚠️  Telegram 告警未启用")
        except:
            self.telegram = None
            print("⚠️  Telegram 告警未配置")
        
        print(f"\n监控币种：{', '.join(self.symbols)}")
        print(f"检查间隔：{self.config['check_interval']}秒")
        print(f"告警方式：{self._get_enabled_alerts()}")
        print("="*70)
        print()
    
    def _load_modules(self):
        """加载所有模块"""
        # 1. 整合信号生成器
        try:
            from integrated_signal import IntegratedSignalGenerator
            self.signal_generator = IntegratedSignalGenerator()
            print("✅ 整合信号生成器已加载")
        except Exception as e:
            print(f"⚠️  整合信号生成器加载失败：{e}")
            self.signal_generator = None
        
        # 2. 统一数据管道
        try:
            from unified_pipeline import UnifiedDataPipeline
            self.data_pipeline = UnifiedDataPipeline()
            print("✅ 统一数据管道已加载")
        except Exception as e:
            print(f"⚠️  统一数据管道加载失败：{e}")
            self.data_pipeline = None
        
        # 3. 技术分析模块
        try:
            from skills.crypto_signals.scripts.volume_price_analysis import analyze_volume_price
            self.analyze_volume_price = analyze_volume_price
            print("✅ 技术分析模块已加载")
        except Exception as e:
            print(f"⚠️  技术分析模块加载失败：{e}")
            self.analyze_volume_price = None
    
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        default_config = {
            'check_interval': 60,
            'price_alert_threshold': 0.02,
            'volume_alert_threshold': 1.5,
            'enable_sound': True,
            'enable_file_log': True,
            'alert_cooldown': 300,
            'max_alerts_per_hour': 20,
        }
        
        config_file = Path(__file__).parent / 'monitor_config.yaml'
        if config_file.exists():
            import yaml
            with open(config_file, 'r', encoding='utf-8') as f:
                file_config = yaml.safe_load(f)
                default_config.update(file_config)
        
        return default_config
    
    def _get_enabled_alerts(self) -> str:
        """获取已启用的告警方式"""
        enabled = []
        if self.config.get('enable_sound'):
            enabled.append('声音')
        if self.config.get('enable_file_log'):
            enabled.append('文件日志')
        return ', '.join(enabled) if enabled else '无'
    
    def fetch_market_data(self, symbol: str, timeframe: str = '5m', limit: int = 100):
        """获取市场数据"""
        try:
            exchange = ccxt.okx({
                'enableRateLimit': True,
                'options': {'defaultType': 'swap'},
                'proxies': {
                    'http': 'http://127.0.0.1:7890',
                    'https': 'http://127.0.0.1:7890',
                }
            })
            
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            
            import pandas as pd
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            return df
        except Exception as e:
            print(f"获取 {symbol} 数据失败：{e}", file=sys.stderr)
            return None
    
    def analyze_all(self, symbol: str, df, context: Dict = None) -> Dict:
        """全面分析 (技术面 + 预测面)"""
        result = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'technical': {},
            'predictive': {},
            'integrated': {}
        }
        
        context = context or {}
        
        # 1. 技术面分析
        if self.analyze_volume_price and df is not None:
            vp = self.analyze_volume_price(df)
            result['technical']['volume_price'] = vp
            
            # EMA 排列
            if 'ema_9' in df.columns and 'ema_20' in df.columns:
                latest = df.iloc[-1]
                if latest['ema_9'] > latest['ema_20']:
                    result['technical']['ema'] = 'BULL'
                elif latest['ema_9'] < latest['ema_20']:
                    result['technical']['ema'] = 'BEAR'
                else:
                    result['technical']['ema'] = 'NEUTRAL'
            
            # RSI
            if 'rsi_14' in df.columns:
                rsi = df['rsi_14'].iloc[-1]
                result['technical']['rsi'] = {
                    'value': rsi,
                    'signal': 'OVERSOLD' if rsi < 30 else 'OVERBOUGHT' if rsi > 70 else 'NEUTRAL'
                }
        
        # 2. 预测面分析
        if self.signal_generator:
            # ML 预测 (模拟)
            result['predictive']['ml'] = {
                'score': context.get('ml_score', 0),
                'confidence': context.get('ml_confidence', 0.5)
            }
            
            # 情绪分析
            if 'fear_greed' in context:
                fng = context['fear_greed']
                result['predictive']['sentiment'] = {
                    'csi': fng.get('value', 50),
                    'classification': fng.get('value_classification', 'Neutral')
                }
            
            # 宏观事件
            if 'macro_events' in context:
                result['predictive']['macro'] = context['macro_events']
        
        # 3. 整合信号
        if self.signal_generator and df is not None:
            integrated_signal = self.signal_generator.generate_signal(df, context)
            result['integrated'] = {
                'signal': integrated_signal.signal.value,
                'score': integrated_signal.combined_score,
                'confidence': integrated_signal.confidence,
                'position_pct': integrated_signal.position_pct,
                'leverage': integrated_signal.leverage,
                'reason': integrated_signal.reason
            }
        
        return result
    
    def _send_alert(self, alert_type: str, title: str, content: str, level: str = 'INFO'):
        """发送告警"""
        alert = {
            'timestamp': datetime.now().isoformat(),
            'type': alert_type,
            'title': title,
            'content': content,
            'level': level
        }
        
        # 打印告警
        emoji = {
            'INFO': 'ℹ️',
            'WARNING': '⚠️',
            'CRITICAL': '🚨',
            'TECHNICAL': '📈',
            'PREDICTIVE': '🤖',
            'INTEGRATED': '🎯'
        }.get(alert_type, '📢')
        
        print(f"\n{emoji} [{alert['title']}]")
        print(f"{alert['content']}")
        print("-"*70)
        
        # 记录告警历史
        self.alert_history.append(alert)
        if len(self.alert_history) > 100:
            self.alert_history = self.alert_history[-100:]
        
        # 记录到文件
        if self.config.get('enable_file_log'):
            log_file = Path(__file__).parent / 'monitor_alerts.log'
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{alert['timestamp']} | {alert['level']} | {alert['title']} | {alert['content']}\n")
        
        # 声音告警
        if self.config.get('enable_sound') and level in ['WARNING', 'CRITICAL']:
            try:
                import os
                if sys.platform == 'darwin':
                    os.system('afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &')
            except:
                pass
        
        # Telegram 告警
        if hasattr(self, 'telegram') and self.telegram and self.telegram.enabled:
            if level == 'CRITICAL':
                # 黑天鹅或强信号发送 Telegram
                if alert['type'] == 'MACRO_EVENT' or '黑天鹅' in alert['title']:
                    self.telegram.send_black_swan_alert(alert)
                elif alert['type'] == 'INTEGRATED':
                    self.telegram.send_trading_signal(alert)
    
    async def check_symbol(self, symbol: str):
        """检查单个币种"""
        try:
            # 1. 获取市场数据
            df = self.fetch_market_data(symbol, timeframe='5m', limit=100)
            if df is None:
                return
            
            # 2. 获取预测数据
            context = {}
            if self.data_pipeline:
                import asyncio
                fng = await self.data_pipeline.fetch_fear_greed()
                if 'value' in fng:
                    context['fear_greed'] = fng
                
                macro = await self.data_pipeline.fetch_macro_events()
                if 'events' in macro:
                    context['macro_events'] = macro
            
            # 3. 全面分析
            analysis = self.analyze_all(symbol, df, context)
            
            # 4. 生成告警
            await self._generate_alerts(symbol, analysis)
            
            # 5. 保存状态
            self.last_signals[symbol] = analysis
            
        except Exception as e:
            print(f"检查 {symbol} 失败：{e}", file=sys.stderr)
    
    async def _generate_alerts(self, symbol: str, analysis: Dict):
        """生成告警"""
        # 1. 技术面告警
        tech = analysis.get('technical', {})
        if tech.get('volume_price', {}).get('signal') == 'STRONG_BULL':
            self._send_alert(
                'TECHNICAL',
                f'{symbol} 技术面买入信号',
                f"量价：{tech['volume_price'].get('reason', '放量上涨')}\n"
                f"置信度：{tech['volume_price'].get('confidence', 0)*100:.0f}%",
                'WARNING'
            )
        
        # 2. 情绪告警
        pred = analysis.get('predictive', {})
        sentiment = pred.get('sentiment', {})
        csi = sentiment.get('csi', 50)
        
        if csi < 20:
            self._send_alert(
                'PREDICTIVE',
                f'市场极度恐惧',
                f"CSI: {csi} ({sentiment.get('classification', 'Extreme Fear')})\n"
                f"历史统计：见底概率 85%\n"
                f"建议：准备买入",
                'CRITICAL'
            )
        elif csi > 80:
            self._send_alert(
                'PREDICTIVE',
                f'市场极度贪婪',
                f"CSI: {csi} ({sentiment.get('classification', 'Extreme Greed')})\n"
                f"历史统计：见顶概率 80%\n"
                f"建议：准备卖出",
                'CRITICAL'
            )
        
        # 3. 整合信号告警
        integrated = analysis.get('integrated', {})
        if integrated.get('signal') == 'STRONG_BUY':
            self._send_alert(
                'INTEGRATED',
                f'{symbol} 强烈买入信号',
                f"综合评分：{integrated.get('score', 0):.2f}\n"
                f"置信度：{integrated.get('confidence', 0)*100:.0f}%\n"
                f"仓位：{integrated.get('position_pct', 0)*100:.0f}%\n"
                f"杠杆：{integrated.get('leverage', 0)}x\n"
                f"原因：{integrated.get('reason', '多因子共振')}",
                'CRITICAL'
            )
        elif integrated.get('signal') == 'BUY':
            self._send_alert(
                'INTEGRATED',
                f'{symbol} 买入信号',
                f"综合评分：{integrated.get('score', 0):.2f}\n"
                f"置信度：{integrated.get('confidence', 0)*100:.0f}%",
                'WARNING'
            )
    
    async def run(self):
        """运行监控"""
        self.running = True
        
        print(f"\n🚀 监控系统 V2 启动")
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
    
    def stop(self):
        """停止监控"""
        self.running = False


# 主程序
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='自动监控系统 V2')
    parser.add_argument('--symbols', type=str, default='BTC/USDT,ETH/USDT,SOL/USDT',
                       help='监控币种列表')
    parser.add_argument('--interval', type=int, default=60,
                       help='检查间隔（秒）')
    parser.add_argument('--no-sound', action='store_true',
                       help='禁用声音告警')
    
    args = parser.parse_args()
    
    symbols = [s.strip() for s in args.symbols.split(',')]
    
    # 创建监控
    monitor = AutoMonitorV2(symbols=symbols)
    monitor.config['check_interval'] = args.interval
    if args.no_sound:
        monitor.config['enable_sound'] = False
    
    # 运行监控
    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        print("\n⛔ 监控已停止")


if __name__ == '__main__':
    main()
