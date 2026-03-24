#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型训练模块 - 机器学习价格预测模型

支持多种模型架构:
- LSTM/GRU (深度学习)
- Transformer (注意力机制)
- XGBoost/LightGBM (集成学习)
- Stacking 集成

作者：小龙
日期：2026-03-11
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from typing import Dict, List, Tuple, Optional, Union
from datetime import datetime
import json
import os
import warnings
warnings.filterwarnings('ignore')

# 机器学习库
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.preprocessing import StandardScaler

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    print("Warning: XGBoost not installed, skipping XGBoost models")

try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False
    print("Warning: LightGBM not installed, skipping LightGBM models")

try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    print("Warning: Optuna not installed, using default hyperparameters")


# ==================== 深度学习模型 ====================

class LSTMModel(nn.Module):
    """LSTM 价格预测模型"""
    
    def __init__(self, input_size: int, hidden_size: int = 256, 
                 num_layers: int = 2, dropout: float = 0.2,
                 output_size: int = 1):
        super(LSTMModel, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_size,
            num_heads=8,
            dropout=dropout
        )
        
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_size)
        )
        
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, x):
        # x shape: (batch, seq_len, features)
        lstm_out, _ = self.lstm(x)  # (batch, seq_len, hidden)
        
        # Attention
        lstm_out = lstm_out.permute(1, 0, 2)  # (seq_len, batch, hidden)
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out)
        attn_out = attn_out.permute(1, 0, 2)  # (batch, seq_len, hidden)
        
        # 全局池化 (取最后一个时间步)
        pooled = attn_out[:, -1, :]  # (batch, hidden)
        
        # 输出
        output = self.fc(pooled)
        
        return self.sigmoid(output) if output.shape[1] == 1 else output


class TransformerModel(nn.Module):
    """Transformer 价格预测模型"""
    
    def __init__(self, input_size: int, d_model: int = 256, 
                 nhead: int = 8, num_layers: int = 6,
                 dim_feedforward: int = 512, dropout: float = 0.1,
                 output_size: int = 1):
        super(TransformerModel, self).__init__()
        
        self.input_projection = nn.Linear(input_size, d_model)
        
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer=nn.TransformerEncoderLayer(
                d_model=d_model,
                nhead=nhead,
                dim_feedforward=dim_feedforward,
                dropout=dropout,
                activation='gelu',
                batch_first=True
            ),
            num_layers=num_layers
        )
        
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        
        self.output_layer = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_size)
        )
        
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, x):
        # x shape: (batch, seq_len, features)
        x = self.input_projection(x)  # (batch, seq_len, d_model)
        
        # Transformer encoder
        x = self.transformer_encoder(x)  # (batch, seq_len, d_model)
        
        # 全局池化
        x = x.permute(0, 2, 1)  # (batch, d_model, seq_len)
        x = self.global_pool(x).squeeze(-1)  # (batch, d_model)
        
        # 输出
        output = self.output_layer(x)
        
        return self.sigmoid(output) if output.shape[1] == 1 else output


class TCNModel(nn.Module):
    """Temporal Convolutional Network"""
    
    def __init__(self, input_size: int, num_channels: List[int] = [64, 128, 256],
                 kernel_size: int = 3, dropout: float = 0.2,
                 output_size: int = 1):
        super(TCNModel, self).__init__()
        
        layers = []
        for i, num_ch in enumerate(num_channels):
            dilation = 2 ** i
            layers.append(self._create_block(
                input_size if i == 0 else num_channels[i-1],
                num_ch, kernel_size, dilation, dropout
            ))
        
        self.tcn = nn.Sequential(*layers)
        
        self.output_layer = nn.Sequential(
            nn.Linear(num_channels[-1], 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_size)
        )
        
        self.sigmoid = nn.Sigmoid()
    
    def _create_block(self, in_ch: int, out_ch: int, 
                      kernel_size: int, dilation: int, dropout: float):
        block = nn.Sequential(
            nn.Conv1d(in_ch, out_ch, kernel_size, 
                     padding=(kernel_size - 1) * dilation // 2,
                     dilation=dilation),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Conv1d(out_ch, out_ch, kernel_size,
                     padding=(kernel_size - 1) * dilation // 2,
                     dilation=dilation),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        return block
    
    def forward(self, x):
        # x shape: (batch, seq_len, features)
        x = x.permute(0, 2, 1)  # (batch, features, seq_len)
        x = self.tcn(x)  # (batch, channels, seq_len)
        
        # 全局池化
        x = x.mean(dim=-1)  # (batch, channels)
        
        # 输出
        output = self.output_layer(x)
        
        return self.sigmoid(output) if output.shape[1] == 1 else output


# ==================== 数据集 ====================

class TimeSeriesDataset(Dataset):
    """时间序列数据集"""
    
    def __init__(self, features: np.ndarray, labels: np.ndarray,
                 seq_length: int = 60):
        self.features = features
        self.labels = labels
        self.seq_length = seq_length
        
        # 创建序列样本
        self.X = []
        self.y = []
        
        for i in range(len(features) - seq_length):
            self.X.append(features[i:i + seq_length])
            self.y.append(labels[i + seq_length])
        
        self.X = np.array(self.X)
        self.y = np.array(self.y)
    
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, idx):
        return (
            torch.FloatTensor(self.X[idx]),
            torch.FloatTensor([self.y[idx]])
        )


# ==================== 训练器 ====================

class ModelTrainer:
    """模型训练器"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"使用设备：{self.device}")
        
        self.models = {}
        self.training_history = {}
    
    def create_model(self, model_type: str, input_size: int, 
                    output_size: int = 1) -> nn.Module:
        """创建模型"""
        if model_type == 'lstm':
            model = LSTMModel(
                input_size=input_size,
                hidden_size=self.config.get('hidden_size', 256),
                num_layers=self.config.get('num_layers', 2),
                dropout=self.config.get('dropout', 0.2),
                output_size=output_size
            )
        elif model_type == 'transformer':
            model = TransformerModel(
                input_size=input_size,
                d_model=self.config.get('d_model', 256),
                nhead=self.config.get('nhead', 8),
                num_layers=self.config.get('transformer_layers', 6),
                output_size=output_size
            )
        elif model_type == 'tcn':
            model = TCNModel(
                input_size=input_size,
                num_channels=self.config.get('tcn_channels', [64, 128, 256]),
                output_size=output_size
            )
        else:
            raise ValueError(f"未知模型类型：{model_type}")
        
        return model.to(self.device)
    
    def train_deep_learning(self, model: nn.Module, 
                           train_loader: DataLoader,
                           val_loader: DataLoader,
                           epochs: int = 100,
                           learning_rate: float = 0.001) -> Dict:
        """训练深度学习模型"""
        
        criterion = nn.BCELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', factor=0.5, patience=10
        )
        
        best_val_loss = float('inf')
        best_model_state = None
        patience_counter = 0
        max_patience = 20
        
        history = {
            'train_loss': [],
            'val_loss': [],
            'train_acc': [],
            'val_acc': []
        }
        
        print(f"开始训练，共 {epochs} 轮...")
        
        for epoch in range(epochs):
            # 训练阶段
            model.train()
            train_loss = 0
            train_preds = []
            train_targets = []
            
            for batch_x, batch_y in train_loader:
                batch_x = batch_x.to(self.device)
                batch_y = batch_y.to(self.device)
                
                optimizer.zero_grad()
                outputs = model(batch_x)
                loss = criterion(outputs, batch_y)
                loss.backward()
                
                # 梯度裁剪
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                
                optimizer.step()
                
                train_loss += loss.item()
                train_preds.extend((outputs > 0.5).cpu().numpy().flatten())
                train_targets.extend(batch_y.cpu().numpy().flatten())
            
            train_loss /= len(train_loader)
            train_acc = accuracy_score(train_targets, train_preds)
            
            # 验证阶段
            model.eval()
            val_loss = 0
            val_preds = []
            val_targets = []
            
            with torch.no_grad():
                for batch_x, batch_y in val_loader:
                    batch_x = batch_x.to(self.device)
                    batch_y = batch_y.to(self.device)
                    
                    outputs = model(batch_x)
                    loss = criterion(outputs, batch_y)
                    
                    val_loss += loss.item()
                    val_preds.extend((outputs > 0.5).cpu().numpy().flatten())
                    val_targets.extend(batch_y.cpu().numpy().flatten())
            
            val_loss /= len(val_loader)
            val_acc = accuracy_score(val_targets, val_preds)
            
            # 记录历史
            history['train_loss'].append(train_loss)
            history['val_loss'].append(val_loss)
            history['train_acc'].append(train_acc)
            history['val_acc'].append(val_acc)
            
            # 学习率调整
            scheduler.step(val_loss)
            
            # 打印进度
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}/{epochs} - "
                      f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.4f} - "
                      f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}")
            
            # 早停检查
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_model_state = model.state_dict().copy()
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= max_patience:
                    print(f"早停触发于 epoch {epoch+1}")
                    break
        
        # 恢复最佳模型
        if best_model_state is not None:
            model.load_state_dict(best_model_state)
        
        return history
    
    def train_xgboost(self, X_train: np.ndarray, y_train: np.ndarray,
                     X_val: np.ndarray, y_val: np.ndarray) -> xgb.Booster:
        """训练 XGBoost 模型"""
        if not XGB_AVAILABLE:
            raise ImportError("XGBoost 未安装")
        
        # 转换为 DMatrix
        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval = xgb.DMatrix(X_val, label=y_val)
        
        # 超参数
        params = {
            'objective': 'binary:logistic',
            'max_depth': self.config.get('max_depth', 8),
            'learning_rate': self.config.get('learning_rate', 0.05),
            'n_estimators': self.config.get('n_estimators', 1000),
            'subsample': self.config.get('subsample', 0.8),
            'colsample_bytree': self.config.get('colsample_bytree', 0.8),
            'scale_pos_weight': (y_train == 0).sum() / (y_train == 1).sum(),
            'eval_metric': 'logloss',
            'tree_method': 'hist',
            'seed': 42
        }
        
        # 训练
        evals = [(dtrain, 'train'), (dval, 'val')]
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=params['n_estimators'],
            evals=evals,
            early_stopping_rounds=50,
            verbose_eval=50
        )
        
        return model
    
    def train_lightgbm(self, X_train: np.ndarray, y_train: np.ndarray,
                      X_val: np.ndarray, y_val: np.ndarray) -> lgb.Booster:
        """训练 LightGBM 模型"""
        if not LGB_AVAILABLE:
            raise ImportError("LightGBM 未安装")
        
        # 创建数据集
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        # 超参数
        params = {
            'objective': 'binary',
            'metric': 'binary_logloss',
            'boosting_type': 'gbdt',
            'num_leaves': self.config.get('num_leaves', 31),
            'learning_rate': self.config.get('learning_rate', 0.05),
            'feature_fraction': self.config.get('feature_fraction', 0.8),
            'bagging_fraction': self.config.get('bagging_fraction', 0.8),
            'bagging_freq': 5,
            'scale_pos_weight': (y_train == 0).sum() / (y_train == 1).sum(),
            'verbose': -1,
            'seed': 42
        }
        
        # 训练
        model = lgb.train(
            params,
            train_data,
            num_boost_round=self.config.get('n_estimators', 1000),
            valid_sets=[train_data, val_data],
            valid_names=['train', 'val'],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50),
                lgb.log_evaluation(period=50)
            ]
        )
        
        return model
    
    def hyperparameter_optimization(self, model_type: str,
                                   X_train: np.ndarray, y_train: np.ndarray,
                                   X_val: np.ndarray, y_val: np.ndarray,
                                   n_trials: int = 50) -> Dict:
        """超参数优化 (使用 Optuna)"""
        if not OPTUNA_AVAILABLE:
            print("Optuna 未安装，使用默认超参数")
            return self.config
        
        def objective(trial):
            if model_type in ['lstm', 'transformer', 'tcn']:
                # 深度学习超参数
                params = {
                    'hidden_size': trial.choice('hidden_size', [128, 256, 512]),
                    'num_layers': trial.choice('num_layers', [2, 3, 4]),
                    'dropout': trial.uniform('dropout', 0.1, 0.3),
                    'learning_rate': trial.loguniform('learning_rate', 1e-4, 1e-2)
                }
                
                if model_type == 'transformer':
                    params['nhead'] = trial.choice('nhead', [4, 8, 16])
                    params['transformer_layers'] = trial.choice('transformer_layers', [4, 6, 8])
                
                # 快速训练评估
                temp_config = {**self.config, **params}
                temp_trainer = ModelTrainer(temp_config)
                model = temp_trainer.create_model(model_type, X_train.shape[1])
                
                # 简化训练 (少量 epoch)
                # ... (实际实现需要创建简化版训练循环)
                
                # 返回验证损失 (示例)
                return 0.5  # 占位符
                
            else:
                # 树模型超参数
                if model_type == 'xgboost':
                    params = {
                        'max_depth': trial.randint('max_depth', 3, 10),
                        'learning_rate': trial.loguniform('learning_rate', 0.01, 0.3),
                        'subsample': trial.uniform('subsample', 0.6, 1.0),
                        'colsample_bytree': trial.uniform('colsample_bytree', 0.6, 1.0)
                    }
                else:  # lightgbm
                    params = {
                        'num_leaves': trial.randint('num_leaves', 20, 50),
                        'learning_rate': trial.loguniform('learning_rate', 0.01, 0.3),
                        'feature_fraction': trial.uniform('feature_fraction', 0.6, 1.0),
                        'bagging_fraction': trial.uniform('bagging_fraction', 0.6, 1.0)
                    }
                
                # 训练并评估
                temp_config = {**self.config, **params}
                temp_trainer = ModelTrainer(temp_config)
                
                if model_type == 'xgboost':
                    model = temp_trainer.train_xgboost(X_train, y_train, X_val, y_val)
                else:
                    model = temp_trainer.train_lightgbm(X_train, y_train, X_val, y_val)
                
                # 预测并计算损失
                if model_type == 'xgboost':
                    preds = model.predict(xgb.DMatrix(X_val))
                else:
                    preds = model.predict(X_val)
                
                loss = np.mean((preds - y_val) ** 2)
                return loss
        
        study = optuna.create_study(direction='minimize')
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        
        print(f"最佳超参数：{study.best_params}")
        print(f"最佳验证损失：{study.best_value:.4f}")
        
        return study.best_params


# ==================== 集成学习 ====================

class StackingEnsemble:
    """Stacking 集成模型"""
    
    def __init__(self, base_models: List, meta_model=None):
        self.base_models = base_models
        self.meta_model = meta_model
        self.base_predictions = None
    
    def fit(self, X_train: np.ndarray, y_train: np.ndarray,
           X_val: np.ndarray, y_val: np.ndarray):
        """训练集成模型"""
        n_train = X_train.shape[0]
        n_val = X_val.shape[0]
        n_models = len(self.base_models)
        
        # 训练基模型并生成验证集预测
        train_predictions = np.zeros((n_train, n_models))
        val_predictions = np.zeros((n_val, n_models))
        
        for i, model in enumerate(self.base_models):
            print(f"训练基模型 {i+1}/{n_models}...")
            
            if isinstance(model, nn.Module):
                # 深度学习模型
                # 需要特殊处理 (略)
                pass
            elif XGB_AVAILABLE and isinstance(model, xgb.Booster):
                # XGBoost
                train_predictions[:, i] = model.predict(xgb.DMatrix(X_train))
                val_predictions[:, i] = model.predict(xgb.DMatrix(X_val))
            elif LGB_AVAILABLE and isinstance(model, lgb.Booster):
                # LightGBM
                train_predictions[:, i] = model.predict(X_train)
                val_predictions[:, i] = model.predict(X_val)
        
        # 训练元模型
        if self.meta_model is None:
            # 默认使用 Logistic Regression
            from sklearn.linear_model import LogisticRegression
            self.meta_model = LogisticRegression()
        
        print("训练元模型...")
        self.meta_model.fit(train_predictions, y_train)
        
        # 评估
        val_meta_predictions = self.meta_model.predict_proba(val_predictions)[:, 1]
        val_acc = accuracy_score(y_val, (val_meta_predictions > 0.5).astype(int))
        print(f"集成模型验证准确率：{val_acc:.4f}")
        
        return val_acc
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """预测"""
        n_samples = X.shape[0]
        n_models = len(self.base_models)
        
        predictions = np.zeros((n_samples, n_models))
        
        for i, model in enumerate(self.base_models):
            if isinstance(model, nn.Module):
                # 深度学习模型预测 (略)
                pass
            elif XGB_AVAILABLE and isinstance(model, xgb.Booster):
                predictions[:, i] = model.predict(xgb.DMatrix(X))
            elif LGB_AVAILABLE and isinstance(model, lgb.Booster):
                predictions[:, i] = model.predict(X)
        
        # 元模型预测
        final_predictions = self.meta_model.predict_proba(predictions)[:, 1]
        
        return final_predictions


# ==================== 主训练流程 ====================

def prepare_data(features_df: pd.DataFrame, labels: pd.Series,
                train_ratio: float = 0.7, val_ratio: float = 0.15,
                seq_length: int = 60) -> Dict:
    """准备训练数据"""
    
    # 时间序列分割 (保持时间顺序)
    n = len(features_df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))
    
    X_train = features_df.iloc[:train_end].values
    X_val = features_df.iloc[train_end:val_end].values
    X_test = features_df.iloc[val_end:].values
    
    y_train = labels.iloc[:train_end].values
    y_val = labels.iloc[train_end:val_end].values
    y_test = labels.iloc[val_end:].values
    
    # 标准化
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    # 创建序列数据集 (用于深度学习)
    train_dataset = TimeSeriesDataset(X_train_scaled, y_train, seq_length)
    val_dataset = TimeSeriesDataset(X_val_scaled, y_val, seq_length)
    test_dataset = TimeSeriesDataset(X_test_scaled, y_test, seq_length)
    
    return {
        'X_train': X_train_scaled,
        'X_val': X_val_scaled,
        'X_test': X_test_scaled,
        'y_train': y_train,
        'y_val': y_val,
        'y_test': y_test,
        'train_loader': DataLoader(train_dataset, batch_size=32, shuffle=True),
        'val_loader': DataLoader(val_dataset, batch_size=32, shuffle=False),
        'test_loader': DataLoader(test_dataset, batch_size=32, shuffle=False),
        'scaler': scaler
    }


def evaluate_model(model, X_test: np.ndarray, y_test: np.ndarray,
                  model_type: str = 'sklearn') -> Dict:
    """评估模型"""
    if model_type == 'pytorch':
        model.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X_test).unsqueeze(0) if len(X_test.shape) == 2 else torch.FloatTensor(X_test)
            if len(X_tensor.shape) == 2:
                X_tensor = X_tensor.unsqueeze(0)
            preds = model(X_tensor.to(next(model.parameters()).device)).cpu().numpy().flatten()
    elif model_type == 'xgboost':
        preds = model.predict(xgb.DMatrix(X_test))
    elif model_type == 'lightgbm':
        preds = model.predict(X_test)
    else:
        preds = model.predict(X_test)
    
    # 二分类
    pred_labels = (preds > 0.5).astype(int)
    
    metrics = {
        'accuracy': accuracy_score(y_test, pred_labels),
        'f1_score': f1_score(y_test, pred_labels),
        'precision': np.mean(pred_labels[y_test == 1] == 1) if (y_test == 1).sum() > 0 else 0,
        'recall': np.mean(y_test[pred_labels == 1] == 1) if (pred_labels == 1).sum() > 0 else 0
    }
    
    print(f"\n模型评估结果:")
    print(f"准确率：{metrics['accuracy']:.4f}")
    print(f"F1 分数：{metrics['f1_score']:.4f}")
    print(classification_report(y_test, pred_labels))
    
    return metrics


def main():
    """主训练流程"""
    print("=" * 60)
    print("机器学习价格预测模型 - 训练脚本")
    print("=" * 60)
    
    # 配置
    config = {
        'hidden_size': 256,
        'num_layers': 2,
        'dropout': 0.2,
        'learning_rate': 0.001,
        'd_model': 256,
        'nhead': 8,
        'transformer_layers': 6,
        'tcn_channels': [64, 128, 256],
        'max_depth': 8,
        'n_estimators': 1000,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'seq_length': 60,
        'epochs': 100,
        'batch_size': 32
    }
    
    # 加载数据 (示例 - 实际应从文件加载)
    print("\n加载数据...")
    # 这里应该从特征工程模块加载实际数据
    # features_df = pd.read_csv('features.csv')
    # labels = pd.read_csv('labels.csv')
    
    # 示例数据
    n_samples = 10000
    n_features = 50
    features_df = pd.DataFrame(np.random.randn(n_samples, n_features))
    labels = pd.Series(np.random.randint(0, 2, n_samples))
    
    # 准备数据
    print("准备训练数据...")
    data = prepare_data(features_df, labels, seq_length=config['seq_length'])
    
    # 初始化训练器
    trainer = ModelTrainer(config)
    
    # 训练深度学习模型
    print("\n" + "=" * 60)
    print("训练 LSTM 模型...")
    print("=" * 60)
    lstm_model = trainer.create_model('lstm', input_size=n_features)
    lstm_history = trainer.train_deep_learning(
        lstm_model,
        data['train_loader'],
        data['val_loader'],
        epochs=config['epochs'],
        learning_rate=config['learning_rate']
    )
    
    # 评估
    X_test_seq = data['test_loader'].dataset.X
    y_test_seq = data['test_loader'].dataset.y
    lstm_metrics = evaluate_model(lstm_model, X_test_seq, y_test_seq, model_type='pytorch')
    
    # 训练 XGBoost
    if XGB_AVAILABLE:
        print("\n" + "=" * 60)
        print("训练 XGBoost 模型...")
        print("=" * 60)
        xgb_model = trainer.train_xgboost(
            data['X_train'], data['y_train'],
            data['X_val'], data['y_val']
        )
        xgb_metrics = evaluate_model(xgb_model, data['X_test'], data['y_test'], model_type='xgboost')
    
    # 训练 LightGBM
    if LGB_AVAILABLE:
        print("\n" + "=" * 60)
        print("训练 LightGBM 模型...")
        print("=" * 60)
        lgb_model = trainer.train_lightgbm(
            data['X_train'], data['y_train'],
            data['X_val'], data['y_val']
        )
        lgb_metrics = evaluate_model(lgb_model, data['X_test'], data['y_test'], model_type='lightgbm')
    
    # 保存模型
    print("\n保存模型...")
    os.makedirs('models', exist_ok=True)
    
    # 保存深度学习模型
    torch.save(lstm_model.state_dict(), 'models/lstm_model.pth')
    
    # 保存树模型
    if XGB_AVAILABLE:
        xgb_model.save_model('models/xgb_model.json')
    if LGB_AVAILABLE:
        lgb_model.save_model('models/lgb_model.txt')
    
    # 保存标准化器
    import pickle
    with open('models/scaler.pkl', 'wb') as f:
        pickle.dump(data['scaler'], f)
    
    print("\n训练完成！模型已保存到 models/ 目录")
    
    return {
        'lstm': lstm_metrics,
        'xgb': xgb_metrics if XGB_AVAILABLE else None,
        'lgb': lgb_metrics if LGB_AVAILABLE else None
    }


if __name__ == '__main__':
    metrics = main()
    print(f"\n最终指标：{json.dumps(metrics, indent=2)}")
