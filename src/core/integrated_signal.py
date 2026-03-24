#!/usr/bin/env python3
"""
Integrated Signal Generator
整合信号生成器 - 技术面 + 预测面融合

信号融合公式:
综合信号 = 0.4×技术面 + 0.3×ML 预测 + 0.25×情绪 + 0.05×宏观事件

动态权重:
- 趋势市：技术 50% + 预测 50%
- 震荡市：技术 60% + 预测 40%
- 突破市：技术 40% + 预测 60%
- 极端市：技术 20% + 预测 80%
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-data' / 'scripts'))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-ta' / 'scripts'))
sys.path.insert(0, str(Path(__file__).parent / 'skills' / 'crypto-signals' / 'scripts'))


class SignalType(Enum):
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


class MarketState(Enum):
    TREND = "趋势市"
    SIDEWAY = "震荡市"
    BREAKOUT = "突破市"
    EXTREME = "极端市"


@dataclass
class TechSignal:
    """技术面信号"""
    score: float = 0.0  # -10 to +10
    confidence: float = 0.5
    volume_price_score: float = 0.0
    ema_score: float = 0.0
    rsi_score: float = 0.0
    macd_score: float = 0.0


@dataclass
class PredictiveSignal:
    """预测面信号"""
    score: float = 0.0  # -10 to +10
    confidence: float = 0.5
    ml_score: float = 0.0
    sentiment_score: float = 0.0
    macro_score: float = 0.0


@dataclass
class IntegratedSignal:
    """整合信号"""
    signal: SignalType
    combined_score: float
    confidence: float
    tech_weight: float
    pred_weight: float
    position_pct: float
    leverage: int
    stop_loss: float
    take_profit: float
    reason: str
    timestamp: str


class IntegratedSignalGenerator:
    """整合信号生成器"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.last_signals = {}
        
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        default_config = {
            'base_risk': 0.02,  # 基础风险 2%
            'max_position': 0.8,  # 最大仓位 80%
            'max_leverage': 50,  # 最大杠杆 50x
            'signal_thresholds': {
                'strong_buy': 0.75,
                'buy': 0.6,
                'sell': -0.6,
                'strong_sell': -0.75
            },
            'confidence_thresholds': {
                'high': 0.7,
                'medium': 0.5,
                'low': 0.3
            }
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                file_config = json.load(f)
                default_config.update(file_config)
        
        return default_config
    
    def analyze_technical(self, df) -> TechSignal:
        """技术面分析"""
        tech = TechSignal()
        
        if df is None or len(df) < 50:
            return tech
        
        try:
            # 1. 量价关系分析
            from skills.crypto_signals.scripts.volume_price_analysis import analyze_volume_price
            vp = analyze_volume_price(df)
            tech.volume_price_score = vp.get('score', 0)
            
            # 2. EMA 排列
            latest = df.iloc[-1]
            if 'ema_9' in df.columns and 'ema_20' in df.columns and 'ema_50' in df.columns:
                if latest['ema_9'] > latest['ema_20'] > latest['ema_50']:
                    tech.ema_score = 3  # 多头排列
                elif latest['ema_9'] < latest['ema_20'] < latest['ema_50']:
                    tech.ema_score = -3  # 空头排列
            
            # 3. RSI
            if 'rsi_14' in df.columns:
                rsi = latest['rsi_14']
                if rsi < 30:
                    tech.rsi_score = 3  # 超卖
                elif rsi < 40:
                    tech.rsi_score = 1
                elif rsi > 70:
                    tech.rsi_score = -3  # 超买
                elif rsi > 60:
                    tech.rsi_score = -1
            
            # 4. MACD
            if 'macd' in df.columns and 'macd_signal' in df.columns:
                if latest['macd'] > latest['macd_signal']:
                    tech.macd_score = 2  # 金叉
                else:
                    tech.macd_score = -2  # 死叉
            
            # 综合技术面评分
            tech.score = (
                tech.volume_price_score +
                tech.ema_score +
                tech.rsi_score +
                tech.macd_score
            )
            
            # 置信度
            tech.confidence = min(abs(tech.score) / 10, 0.9)
            
        except Exception as e:
            print(f"技术面分析失败：{e}", file=sys.stderr)
        
        return tech
    
    def analyze_predictive(self, context: Dict) -> PredictiveSignal:
        """预测面分析"""
        pred = PredictiveSignal()
        
        try:
            # 1. ML 预测
            if 'ml_prediction' in context:
                ml = context['ml_prediction']
                pred.ml_score = ml.get('score', 0)
            
            # 2. 情绪分析
            if 'sentiment' in context:
                sent = context['sentiment']
                csi = sent.get('csi', 50)
                # CSI 0-20: 极度恐惧 (+3), 20-40: 恐惧 (+1), 60-80: 贪婪 (-1), 80-100: 极度贪婪 (-3)
                if csi < 20:
                    pred.sentiment_score = 3
                elif csi < 40:
                    pred.sentiment_score = 1
                elif csi > 80:
                    pred.sentiment_score = -3
                elif csi > 60:
                    pred.sentiment_score = -1
            
            # 3. 宏观事件
            if 'macro_events' in context:
                macro = context['macro_events']
                risk_level = macro.get('risk_level', 'GREEN')
                if risk_level == 'RED':
                    pred.macro_score = -5  # 红色风险禁止开仓
                elif risk_level == 'ORANGE':
                    pred.macro_score = -2
                elif risk_level == 'YELLOW':
                    pred.macro_score = -1
                else:
                    pred.macro_score = 0
            
            # 综合预测面评分
            pred.score = (
                pred.ml_score * 0.6 +  # ML 权重 60%
                pred.sentiment_score * 0.3 +  # 情绪权重 30%
                pred.macro_score * 0.1  # 宏观权重 10%
            )
            
            # 置信度
            pred.confidence = min(abs(pred.score) / 10, 0.9)
            
        except Exception as e:
            print(f"预测面分析失败：{e}", file=sys.stderr)
        
        return pred
    
    def detect_market_state(self, df) -> MarketState:
        """检测市场状态"""
        if df is None or len(df) < 50:
            return MarketState.SIDEWAY
        
        try:
            latest = df.iloc[-1]
            
            # 1. 波动率
            if 'volatility' in df.columns:
                vol = latest['volatility']
                if vol > 0.05:  # 波动率>5%
                    return MarketState.EXTREME
                elif vol > 0.03:  # 波动率>3%
                    return MarketState.BREAKOUT
            
            # 2. ADX (趋势强度)
            if 'adx' in df.columns:
                adx = latest['adx']
                if adx > 30:
                    return MarketState.TREND
                elif adx < 20:
                    return MarketState.SIDEWAY
            
            # 3. EMA 排列
            if 'ema_9' in df.columns and 'ema_20' in df.columns:
                if abs(latest['ema_9'] - latest['ema_20']) / latest['close'] > 0.02:
                    return MarketState.TREND
            
            return MarketState.SIDEWAY
            
        except Exception as e:
            print(f"市场状态检测失败：{e}", file=sys.stderr)
            return MarketState.SIDEWAY
    
    def get_dynamic_weights(self, market_state: MarketState) -> tuple:
        """获取动态权重"""
        weights = {
            MarketState.TREND: (0.5, 0.5),      # 技术 50% + 预测 50%
            MarketState.SIDEWAY: (0.6, 0.4),    # 技术 60% + 预测 40%
            MarketState.BREAKOUT: (0.4, 0.6),   # 技术 40% + 预测 60%
            MarketState.EXTREME: (0.2, 0.8)     # 技术 20% + 预测 80%
        }
        return weights.get(market_state, (0.5, 0.5))
    
    def calc_position(self, combined_score: float, confidence: float, 
                      risk_level: str = 'GREEN') -> float:
        """计算仓位"""
        # 基础仓位
        base_position = self.config['base_risk'] / 0.02  # 假设止损 2%
        
        # 信号系数
        signal_coef = min(abs(combined_score) / 5, 1.0)
        
        # 置信度系数
        confidence_coef = confidence
        
        # 风险系数
        risk_coef = {
            'GREEN': 1.0,
            'YELLOW': 0.7,
            'ORANGE': 0.4,
            'RED': 0.0
        }.get(risk_level, 1.0)
        
        # 调整后仓位
        position = base_position * signal_coef * confidence_coef * risk_coef
        
        # 限制
        position = min(position, self.config['max_position'])
        
        return position
    
    def calc_leverage(self, market_state: MarketState, confidence: float) -> int:
        """计算杠杆"""
        base_leverage = 10
        
        # 根据市场状态调整
        if market_state == MarketState.EXTREME:
            base_leverage = 2
        elif market_state == MarketState.BREAKOUT:
            base_leverage = 15
        elif market_state == MarketState.TREND:
            base_leverage = 20
        else:
            base_leverage = 10
        
        # 根据置信度调整
        if confidence > 0.8:
            leverage = base_leverage * 1.5
        elif confidence > 0.6:
            leverage = base_leverage
        else:
            leverage = base_leverage * 0.5
        
        # 限制
        leverage = min(int(leverage), self.config['max_leverage'])
        leverage = max(leverage, 1)
        
        return leverage
    
    def generate_signal(self, df, context: Dict = None) -> IntegratedSignal:
        """生成整合信号"""
        context = context or {}
        
        # 1. 技术面分析
        tech = self.analyze_technical(df)
        
        # 2. 预测面分析
        pred = self.analyze_predictive(context)
        
        # 3. 市场状态
        market_state = self.detect_market_state(df)
        
        # 4. 动态权重
        tech_weight, pred_weight = self.get_dynamic_weights(market_state)
        
        # 5. 信号融合
        combined_score = (
            tech.score * tech_weight +
            pred.score * pred_weight
        ) / 10  # 归一化到 -1 to 1
        
        # 6. 置信度
        confidence = (
            tech.confidence * tech_weight +
            pred.confidence * pred_weight
        )
        
        # 7. 风险等级
        risk_level = context.get('risk_level', 'GREEN')
        
        # 8. 生成交易信号
        thresholds = self.config['signal_thresholds']
        
        if combined_score > thresholds['strong_buy'] and confidence > 0.7:
            signal = SignalType.STRONG_BUY
        elif combined_score > thresholds['buy'] and confidence > 0.5:
            signal = SignalType.BUY
        elif combined_score < thresholds['strong_sell'] and confidence > 0.7:
            signal = SignalType.STRONG_SELL
        elif combined_score < thresholds['sell'] and confidence > 0.5:
            signal = SignalType.SELL
        else:
            signal = SignalType.HOLD
        
        # 9. 计算仓位和杠杆
        position_pct = self.calc_position(combined_score, confidence, risk_level)
        leverage = self.calc_leverage(market_state, confidence)
        
        # 10. 止损止盈
        stop_loss = 0.02 if signal in [SignalType.STRONG_BUY, SignalType.STRONG_SELL] else 0.015
        take_profit = stop_loss * 2.5  # 盈亏比 2.5:1
        
        # 11. 生成原因
        reasons = []
        if tech.volume_price_score > 2:
            reasons.append('放量')
        if tech.ema_score > 2:
            reasons.append('EMA 多头')
        if pred.ml_score > 2:
            reasons.append('ML 看涨')
        if pred.sentiment_score > 2:
            reasons.append('情绪极度恐惧')
        
        reason = ' + '.join(reasons[:3]) if reasons else '信号不明朗'
        
        return IntegratedSignal(
            signal=signal,
            combined_score=combined_score,
            confidence=confidence,
            tech_weight=tech_weight,
            pred_weight=pred_weight,
            position_pct=position_pct,
            leverage=leverage,
            stop_loss=stop_loss,
            take_profit=take_profit,
            reason=reason,
            timestamp=datetime.now().isoformat()
        )


# 使用示例
if __name__ == '__main__':
    # 创建信号生成器
    generator = IntegratedSignalGenerator()
    
    # 示例：生成信号
    print("整合信号生成器已就绪")
    print("使用方法:")
    print("  generator = IntegratedSignalGenerator()")
    print("  signal = generator.generate_signal(df, context)")
    print(f"\n当前配置:")
    print(f"  基础风险：{generator.config['base_risk']*100:.1f}%")
    print(f"  最大仓位：{generator.config['max_position']*100:.0f}%")
    print(f"  最大杠杆：{generator.config['max_leverage']}x")
