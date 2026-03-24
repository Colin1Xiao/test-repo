#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实时预测模块 - 机器学习价格预测模型

功能:
- 加载训练好的模型
- 实时特征计算
- 价格趋势预测
- 置信度评估
- 交易信号生成

作者：小龙
日期：2026-03-11
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import json
import os
import pickle
import time
from dataclasses import dataclass
from enum import Enum
import warnings
warnings.filterwarnings('ignore')

# 导入特征工程
from feature_engineering import FeatureEngineer

# 导入模型定义
from train_model import LSTMModel, TransformerModel, TCNModel


# ==================== 预测结果定义 ====================

class SignalType(Enum):
    """交易信号类型"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    STRONG_BUY = "STRONG_BUY"
    STRONG_SELL = "STRONG_SELL"


@dataclass
class PredictionResult:
    """预测结果"""
    timestamp: datetime
    timeframe: str  # 1m, 5m, 15m, 1h, 4h
    direction: int  # 0=跌，1=涨
    direction_prob: float  # 方向概率
    volatility: float  # 预期波动
    confidence: float  # 置信度
    signal: SignalType
    model_weights: Dict[str, float]  # 各模型权重
    features_used: List[str]  # 使用的特征
    risk_level: str  # LOW, MEDIUM, HIGH
    
    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'timeframe': self.timeframe,
            'direction': 'UP' if self.direction == 1 else 'DOWN',
            'direction_prob': round(self.direction_prob, 4),
            'volatility': round(self.volatility, 6),
            'confidence': round(self.confidence, 4),
            'signal': self.signal.value,
            'model_weights': {k: round(v, 4) for k, v in self.model_weights.items()},
            'risk_level': self.risk_level
        }


# ==================== 模型加载器 ====================

class ModelLoader:
    """模型加载器"""
    
    def __init__(self, model_dir: str = 'models'):
        self.model_dir = model_dir
        self.models = {}
        self.scaler = None
        self.feature_names = None
    
    def load_pytorch_model(self, model_type: str, input_size: int,
                          device: str = 'cpu') -> nn.Module:
        """加载 PyTorch 模型"""
        model_path = os.path.join(self.model_dir, f'{model_type}_model.pth')
        
        if model_type == 'lstm':
            model = LSTMModel(input_size=input_size)
        elif model_type == 'transformer':
            model = TransformerModel(input_size=input_size)
        elif model_type == 'tcn':
            model = TCNModel(input_size=input_size)
        else:
            raise ValueError(f"未知模型类型：{model_type}")
        
        # 加载权重
        if os.path.exists(model_path):
            state_dict = torch.load(model_path, map_location=device)
            model.load_state_dict(state_dict)
            print(f"已加载 {model_type} 模型：{model_path}")
        else:
            print(f"警告：模型文件不存在 {model_path}")
        
        model.to(device)
        model.eval()
        return model
    
    def load_xgboost_model(self, model_path: str = None):
        """加载 XGBoost 模型"""
        try:
            import xgboost as xgb
            path = model_path or os.path.join(self.model_dir, 'xgb_model.json')
            if os.path.exists(path):
                model = xgb.Booster()
                model.load_model(path)
                print(f"已加载 XGBoost 模型：{path}")
                return model
            else:
                print(f"警告：XGBoost 模型文件不存在 {path}")
                return None
        except ImportError:
            print("警告：XGBoost 未安装")
            return None
    
    def load_lightgbm_model(self, model_path: str = None):
        """加载 LightGBM 模型"""
        try:
            import lightgbm as lgb
            path = model_path or os.path.join(self.model_dir, 'lgb_model.txt')
            if os.path.exists(path):
                model = lgb.Booster(model_file=path)
                print(f"已加载 LightGBM 模型：{path}")
                return model
            else:
                print(f"警告：LightGBM 模型文件不存在 {path}")
                return None
        except ImportError:
            print("警告：LightGBM 未安装")
            return None
    
    def load_scaler(self, path: str = None):
        """加载标准化器"""
        path = path or os.path.join(self.model_dir, 'scaler.pkl')
        if os.path.exists(path):
            with open(path, 'rb') as f:
                self.scaler = pickle.load(f)
            print(f"已加载标准化器：{path}")
        else:
            print(f"警告：标准化器文件不存在 {path}")
            self.scaler = None
    
    def load_all(self, input_size: int, device: str = 'cpu'):
        """加载所有模型"""
        self.device = device
        
        # 深度学习模型
        self.models['lstm'] = self.load_pytorch_model('lstm', input_size, device)
        self.models['transformer'] = self.load_pytorch_model('transformer', input_size, device)
        
        # 树模型
        self.models['xgb'] = self.load_xgboost_model()
        self.models['lgb'] = self.load_lightgbm_model()
        
        # 标准化器
        self.load_scaler()
        
        print(f"\n已加载 {len([m for m in self.models.values() if m is not None])} 个模型")


# ==================== 预测引擎 ====================

class PredictionEngine:
    """预测引擎"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.device = config.get('device', 'cuda' if torch.cuda.is_available() else 'cpu')
        self.seq_length = config.get('seq_length', 60)
        
        # 初始化
        self.feature_engineer = FeatureEngineer(config.get('feature_config', {}))
        self.model_loader = ModelLoader(config.get('model_dir', 'models'))
        
        # 模型权重 (基于验证集表现)
        self.model_weights = config.get('model_weights', {
            'lstm': 0.3,
            'transformer': 0.3,
            'xgb': 0.2,
            'lgb': 0.2
        })
        
        # 历史预测 (用于平滑)
        self.prediction_history = []
        self.max_history = 10
        
        # 性能指标
        self.latency_history = []
    
    def initialize(self, input_size: int):
        """初始化预测引擎"""
        print("初始化预测引擎...")
        self.model_loader.load_all(input_size, self.device)
        print("初始化完成")
    
    def prepare_features(self, market_data: Dict, onchain_data: Dict,
                        sentiment_data: Dict, macro_data: Dict) -> np.ndarray:
        """准备特征"""
        # 生成特征
        features_df = self.feature_engineer.engineer_features(
            market_data, onchain_data, sentiment_data, macro_data
        )
        
        # 预处理
        features_scaled, _ = self.feature_engineer.preprocess_features(
            features_df,
            fit_params={
                'mean': self.model_loader.scaler.mean_ if self.model_loader.scaler else None,
                'std': self.model_loader.scaler.scale_ if self.model_loader.scaler else None
            }
        )
        
        return features_scaled.values[0]
    
    def predict_single_model(self, model, features: np.ndarray,
                            model_type: str) -> float:
        """单模型预测"""
        if model is None:
            return 0.5
        
        try:
            if isinstance(model, nn.Module):
                # 深度学习模型
                # 需要序列输入
                if len(features.shape) == 1:
                    features = features.reshape(1, -1)
                
                # 复制序列 (实际应使用真实历史)
                seq_features = np.repeat(features, self.seq_length, axis=0)
                seq_features = seq_features.reshape(1, self.seq_length, -1)
                
                with torch.no_grad():
                    x_tensor = torch.FloatTensor(seq_features).to(self.device)
                    pred = model(x_tensor).cpu().numpy()[0, 0]
                    
            elif hasattr(model, 'predict'):
                # 树模型
                if hasattr(model, 'predict'):  # XGBoost/LightGBM
                    if 'xgb' in str(type(model)).lower():
                        import xgboost as xgb
                        pred = model.predict(xgb.DMatrix(features.reshape(1, -1)))[0]
                    else:
                        pred = model.predict(features.reshape(1, -1))[0]
                else:
                    pred = model.predict(features.reshape(1, -1))[0]
            else:
                pred = 0.5
            
            return float(pred)
            
        except Exception as e:
            print(f"模型预测错误：{e}")
            return 0.5
    
    def ensemble_predict(self, features: np.ndarray) -> Tuple[float, Dict]:
        """集成预测"""
        predictions = {}
        total_weight = 0
        
        for model_name, weight in self.model_weights.items():
            model = self.model_loader.models.get(model_name)
            if model is not None:
                pred = self.predict_single_model(model, features, model_name)
                predictions[model_name] = pred
                total_weight += weight
        
        # 加权平均
        if total_weight > 0:
            ensemble_pred = sum(
                predictions[k] * self.model_weights[k] 
                for k in predictions.keys()
            ) / total_weight
        else:
            ensemble_pred = 0.5
        
        return ensemble_pred, predictions
    
    def calculate_confidence(self, predictions: Dict) -> float:
        """计算预测置信度"""
        if len(predictions) < 2:
            return 0.5
        
        # 模型间一致性
        pred_values = list(predictions.values())
        pred_std = np.std(pred_values)
        
        # 标准差越小，置信度越高
        confidence = 1 / (1 + pred_std * 5)  # 缩放因子
        
        # 靠近 0.5 的预测置信度低
        mean_pred = np.mean(pred_values)
        distance_from_uncertain = abs(mean_pred - 0.5) * 2
        
        # 综合置信度
        confidence = (confidence + distance_from_uncertain) / 2
        
        return np.clip(confidence, 0, 1)
    
    def generate_signal(self, prediction: float, confidence: float,
                       volatility: float) -> SignalType:
        """生成交易信号"""
        # 基于预测概率和置信度
        if prediction > 0.7 and confidence > 0.7:
            return SignalType.STRONG_BUY
        elif prediction < 0.3 and confidence > 0.7:
            return SignalType.STRONG_SELL
        elif prediction > 0.55 and confidence > 0.5:
            return SignalType.BUY
        elif prediction < 0.45 and confidence > 0.5:
            return SignalType.SELL
        else:
            return SignalType.HOLD
    
    def assess_risk(self, volatility: float, confidence: float,
                   market_conditions: Dict) -> str:
        """评估风险等级"""
        risk_score = 0
        
        # 高波动 = 高风险
        if volatility > 0.02:  # 2% 波动
            risk_score += 2
        elif volatility > 0.01:
            risk_score += 1
        
        # 低置信度 = 高风险
        if confidence < 0.5:
            risk_score += 2
        elif confidence < 0.7:
            risk_score += 1
        
        # 市场条件
        if market_conditions.get('high_correlation', False):
            risk_score += 1
        if market_conditions.get('extreme_sentiment', False):
            risk_score += 1
        
        # 风险等级
        if risk_score >= 4:
            return 'HIGH'
        elif risk_score >= 2:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def predict(self, market_data: Dict, onchain_data: Dict,
               sentiment_data: Dict, macro_data: Dict,
               timeframe: str = '5m') -> PredictionResult:
        """
        主预测函数
        
        Args:
            market_data: 市场数据
            onchain_data: 链上数据
            sentiment_data: 情绪数据
            macro_data: 宏观数据
            timeframe: 预测时间框架
        
        Returns:
            PredictionResult
        """
        start_time = time.time()
        
        # 准备特征
        features = self.prepare_features(
            market_data, onchain_data, sentiment_data, macro_data
        )
        
        # 集成预测
        ensemble_pred, individual_preds = self.ensemble_predict(features)
        
        # 计算置信度
        confidence = self.calculate_confidence(individual_preds)
        
        # 预测波动率 (简化 - 实际应使用专门模型)
        volatility = np.std(features[:20])  # 使用前 20 个特征的波动作为代理
        
        # 生成信号
        signal = self.generate_signal(ensemble_pred, confidence, volatility)
        
        # 风险评估
        market_conditions = {
            'high_correlation': False,  # 实际应计算
            'extreme_sentiment': sentiment_data.get('fear_greed', 50) < 20 or \
                                sentiment_data.get('fear_greed', 50) > 80
        }
        risk_level = self.assess_risk(volatility, confidence, market_conditions)
        
        # 记录延迟
        latency = time.time() - start_time
        self.latency_history.append(latency)
        if len(self.latency_history) > 100:
            self.latency_history.pop(0)
        
        # 创建结果
        result = PredictionResult(
            timestamp=datetime.now(),
            timeframe=timeframe,
            direction=1 if ensemble_pred > 0.5 else 0,
            direction_prob=ensemble_pred,
            volatility=volatility,
            confidence=confidence,
            signal=signal,
            model_weights=individual_preds,
            features_used=self.feature_engineer.get_feature_names(),
            risk_level=risk_level
        )
        
        # 保存历史
        self.prediction_history.append(result)
        if len(self.prediction_history) > self.max_history:
            self.prediction_history.pop(0)
        
        return result
    
    def predict_multi_timeframe(self, market_data: Dict, onchain_data: Dict,
                               sentiment_data: Dict, macro_data: Dict) -> Dict[str, PredictionResult]:
        """多时间框架预测"""
        timeframes = ['1m', '5m', '15m', '1h', '4h']
        results = {}
        
        for tf in timeframes:
            # 不同时间框架可能需要不同的特征或模型
            # 这里简化处理，实际应为每个时间框架训练独立模型
            results[tf] = self.predict(
                market_data, onchain_data, sentiment_data, macro_data,
                timeframe=tf
            )
        
        return results
    
    def get_prediction_summary(self) -> Dict:
        """获取预测摘要"""
        if not self.prediction_history:
            return {}
        
        # 平均置信度
        avg_confidence = np.mean([p.confidence for p in self.prediction_history])
        
        # 信号分布
        signal_counts = {}
        for p in self.prediction_history:
            signal = p.signal.value
            signal_counts[signal] = signal_counts.get(signal, 0) + 1
        
        # 平均延迟
        avg_latency = np.mean(self.latency_history) if self.latency_history else 0
        
        # 最新预测
        latest = self.prediction_history[-1]
        
        return {
            'total_predictions': len(self.prediction_history),
            'average_confidence': round(avg_confidence, 4),
            'signal_distribution': signal_counts,
            'average_latency_ms': round(avg_latency * 1000, 2),
            'latest_prediction': latest.to_dict()
        }


# ==================== 实时监控系统 ====================

class RealTimeMonitor:
    """实时监控系统"""
    
    def __init__(self, prediction_engine: PredictionEngine):
        self.engine = prediction_engine
        self.is_running = False
        self.prediction_interval = 60  # 秒
    
    def start_monitoring(self, data_source, callback=None):
        """开始监控"""
        self.is_running = True
        print("开始实时监控...")
        
        while self.is_running:
            try:
                # 获取最新数据
                market_data = data_source.get_market_data()
                onchain_data = data_source.get_onchain_data()
                sentiment_data = data_source.get_sentiment_data()
                macro_data = data_source.get_macro_data()
                
                # 预测
                result = self.engine.predict(
                    market_data, onchain_data,
                    sentiment_data, macro_data
                )
                
                # 回调
                if callback:
                    callback(result)
                
                # 打印结果
                print(f"\n[{result.timestamp}] 预测：{result.signal.value} "
                      f"(概率：{result.direction_prob:.2f}, 置信度：{result.confidence:.2f})")
                
                # 等待
                time.sleep(self.prediction_interval)
                
            except KeyboardInterrupt:
                self.stop_monitoring()
                break
            except Exception as e:
                print(f"监控错误：{e}")
                time.sleep(5)
    
    def stop_monitoring(self):
        """停止监控"""
        self.is_running = False
        print("停止监控")


# ==================== 使用示例 ====================

class MockDataSource:
    """模拟数据源 (用于测试)"""
    
    def get_market_data(self) -> Dict:
        return {
            'orderbook': {
                'bids': pd.DataFrame({'price': [50000, 49999], 'volume': [10, 20]}),
                'asks': pd.DataFrame({'price': [50001, 50002], 'volume': [15, 25]})
            },
            'trades': pd.DataFrame({
                'timestamp': [1, 2, 3],
                'price': [50000, 50001, 50000],
                'volume': [1, 2, 1],
                'side': ['buy', 'buy', 'sell']
            }),
            'prices': pd.Series([50000, 50001, 50000, 50002]),
            'btc_price': 50000,
            'circulating_supply': 19000000
        }
    
    def get_onchain_data(self) -> Dict:
        return {
            'transactions': pd.DataFrame({
                'timestamp': [1, 2],
                'amount': [10, 100],
                'type': ['exchange_deposit', 'exchange_deposit']
            }),
            'exchange_flows': pd.DataFrame({
                'inflow': [100],
                'outflow': [80],
                'total_reserve': [10000]
            }),
            'activity': pd.DataFrame({
                'active_addresses': [500000],
                'transaction_count': [300000]
            }),
            'holders': {
                'top_1_percent': 45,
                'top_10_percent': 70
            }
        }
    
    def get_sentiment_data(self) -> Dict:
        return {
            'social': pd.DataFrame({
                'positive': [100],
                'negative': [50],
                'neutral': [200],
                'mentions': [5000]
            }),
            'news': [{'sentiment': 0.5, 'source_weight': 1.0}],
            'fear_greed': 55
        }
    
    def get_macro_data(self) -> Dict:
        return {
            'dxy': pd.DataFrame({'value': [103.5]}),
            'treasury': {'yield_10y': 4.2, 'yield_2y': 4.5},
            'vix': pd.DataFrame({'value': [15]})
        }


def main():
    """主函数"""
    print("=" * 60)
    print("机器学习价格预测模型 - 预测脚本")
    print("=" * 60)
    
    # 配置
    config = {
        'device': 'cpu',
        'seq_length': 60,
        'model_dir': 'models',
        'feature_config': {
            'orderbook_depth': 10,
            'whale_threshold_usd': 100000
        },
        'model_weights': {
            'lstm': 0.3,
            'transformer': 0.3,
            'xgb': 0.2,
            'lgb': 0.2
        }
    }
    
    # 初始化预测引擎
    engine = PredictionEngine(config)
    
    # 初始化 (加载模型)
    # 注意：需要先运行 train_model.py 训练模型
    # engine.initialize(input_size=50)
    
    # 模拟数据源
    data_source = MockDataSource()
    
    # 单次预测
    print("\n执行预测...")
    result = engine.predict(
        data_source.get_market_data(),
        data_source.get_onchain_data(),
        data_source.get_sentiment_data(),
        data_source.get_macro_data(),
        timeframe='5m'
    )
    
    # 打印结果
    print("\n" + "=" * 60)
    print("预测结果")
    print("=" * 60)
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    
    # 获取摘要
    summary = engine.get_prediction_summary()
    print("\n预测摘要:")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    
    return result


if __name__ == '__main__':
    result = main()
