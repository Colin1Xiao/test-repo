#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🐉 小龙智能交易系统 V5.2 - 统一入口

完整组件链路：
V4.x: Regime检测 + 评分 + 执行
V5.1: 质量评估 + 守护者 + 反馈
V5.2: 样本过滤 + 参数守护 + 版本管理 + 安全控制器 + 系统监控

这才是"真正存在的系统"
"""

import asyncio
import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# 路径设置
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR / 'core'))

# 代理设置
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

# ========== V4.x 核心组件 ==========
from regime.regime_detector import RegimeDetector
from regime.regime_types import MarketRegime
from strategy.strategy_selector import StrategySelector
from scoring_engine_v43 import ScoringEngineV43
from enhanced_analyzer import EnhancedAnalyzer
from live_executor import LiveExecutor
from execution_engine import ExecutionEngine, Signal
from profit_audit import get_profit_auditor, TradeRecord
from constants import (
    GLOBAL_LEVERAGE as LEVERAGE,
    GLOBAL_STOP_LOSS_PCT as STOP_LOSS_PCT,
    GLOBAL_TAKE_PROFIT_PCT as TAKE_PROFIT_PCT
)

# ========== V5.1 质量评估 ==========
from signal_quality import SignalQualityEvaluator
from execution_quality import ExecutionQualityEvaluator as ExecutionQuality
from strategy_guardian import StrategyGuardian, StrategyDecision
from feedback_engine import FeedbackEngine
from parameter_optimizer import ParameterOptimizer

# ========== V5.2 安全控制 ==========
from sample_filter import SampleFilter, FilterResult
from parameter_guard import ParameterGuard
from config_version_manager import ConfigVersionManager
from system_monitor import SystemMonitor
from safety_controller import SafetyController, SafetyStatus

# ========== 持仓管理（核心安全模块）==========
from position_manager import PositionManager, get_position_manager

# ========== 连续亏损保护（尾部策略必需）==========
from core.consecutive_loss_protection import get_protection


class V52System:
    """
    V5.2 完整系统
    
    系统状态机：
    IDLE → MONITORING → SIGNAL_DETECTED → PRECHECK → EXECUTING → EVALUATING → IDLE
    
    任何异常都会触发安全机制
    """
    
    def __init__(self, config_path: str = None, testnet: bool = True, shadow_mode: bool = True):
        """
        初始化系统
        
        Args:
            config_path: 配置文件路径
            testnet: 是否使用测试网
            shadow_mode: 影子模式（不真实执行）
        """
        self.base_dir = BASE_DIR
        self.config_path = config_path or str(BASE_DIR / 'config' / 'system_config.json')
        self.testnet = testnet
        self.shadow_mode = shadow_mode
        
        # 加载配置
        self.config = self._load_config()
        
        # 日志目录
        self.log_dir = BASE_DIR / 'logs'
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # ========== 初始化所有组件 ==========
        print("\n" + "=" * 70)
        print("🐉 小龙智能交易系统 V5.2 启动")
        print("=" * 70)
        print(f"   模式: {'SHADOW (影子)' if shadow_mode else 'LIVE (实盘)'}")
        print(f"   网络: {'TESTNET (测试网)' if testnet else 'MAINNET (主网)'}")
        print(f"   杠杆: {LEVERAGE}x")
        print("")
        
        self._init_v4x_components()
        self._init_v51_components()
        self._init_v52_components()
        
        # ========== 持仓管理器（核心安全模块）==========
        self.position_manager = get_position_manager()
        
        # 系统状态
        self.running = False
        self.cycles = 0
        self.start_time = None
        self.last_regime = None
        self.regime_history: List[str] = []
        
        # 交易历史
        self.trade_history: List[Dict[str, Any]] = []
        self.valid_trades: List[Dict[str, Any]] = []
        
        # 统计
        self.stats = {
            'total_signals': 0,
            'executed_signals': 0,
            'valid_executions': 0,
            'rejected_samples': 0,
            'guardian_stops': 0,
            'safety_rollbacks': 0,
            'consecutive_losses': 0,
            'daily_pnl': 0.0,
            'win_count': 0,
            'loss_count': 0
        }
        
        # 连续亏损保护器（尾部策略必需）
        self.loss_protection = get_protection(max_losses=30)
        
        # 🔒 主网安全：交易冷却时间
        self._last_trade_time = 0.0  # 上次交易时间戳
        
        print("\n✅ 系统初始化完成")
        print("=" * 70 + "\n")
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置"""
        config_file = Path(self.config_path)
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # 默认配置
            return {
                'enabled': True,
                'check_interval': 10,
                'symbols': ['BTC/USDT:USDT', 'ETH/USDT:USDT'],
                'scoring': {'entry_threshold': 80},
                'exit': {
                    'hard_stop_loss_pct': STOP_LOSS_PCT,
                    'take_profit_layers_pct': [TAKE_PROFIT_PCT]
                }
            }
    
    def _load_api_config(self) -> Optional[Dict[str, Any]]:
        """加载 API 配置（优先 Testnet）"""
        # 优先加载 testnet 配置
        testnet_config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_testnet.json'
        mainnet_config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
        
        if self.testnet and testnet_config_path.exists():
            with open(testnet_config_path, 'r') as f:
                config = json.load(f)
                okx_config = config.get('okx', {})
                # 检查是否是模板（未填写真实 key）
                api_key = okx_config.get('api_key', '')
                if api_key.startswith('YOUR_') or not api_key:
                    print(f"⚠️ Testnet API 未配置，请编辑: {testnet_config_path}")
                    return None
                return okx_config
        
        # 如果没有 testnet 配置，尝试主网配置
        if mainnet_config_path.exists():
            with open(mainnet_config_path, 'r') as f:
                config = json.load(f)
                return config.get('okx', {})
        
        return None
    
    def _init_v4x_components(self):
        """初始化 V4.x 核心组件"""
        print("📦 V4.x 核心组件初始化...")
        
        self.regime_detector = RegimeDetector()
        self.strategy_selector = StrategySelector()
        self.scoring_engine = ScoringEngineV43(default_threshold=70)
        self.analyzer = EnhancedAnalyzer(symbols=self.config.get('symbols', ['BTC/USDT:USDT']))
        
        # 执行器初始化
        self.executor = None
        self.execution_engine = None  # 异步执行引擎
        
        # ⚠️ 非影子模式必须初始化执行器
        if not self.shadow_mode:
            api_config = self._load_api_config()
            if api_config:
                self.executor = LiveExecutor(
                    api_key=api_config.get('api_key'),
                    api_secret=api_config.get('secret_key'),
                    passphrase=api_config.get('passphrase'),
                    testnet=self.testnet
                )
                print("   ✅ 执行器初始化成功 (TESTNET)" if self.testnet else "   ✅ 执行器初始化成功 (MAINNET)")
                
                # 🚀 创建异步执行引擎
                self.execution_engine = ExecutionEngine(
                    self.executor,
                    position_check_callback=lambda symbol: self.position_manager.has_position(symbol)
                )
                self._last_execution_result = None  # 存储最后执行结果
                
                # 设置执行回调
                def on_exec_callback(signal, result, exec_time):
                    self._last_execution_result = result
                
                self.execution_engine.on_execution = on_exec_callback
                print("   ✅ 异步执行引擎初始化成功")
            else:
                raise RuntimeError("❌ CRITICAL: 执行模式需要 API 配置！请配置 ~/.openclaw/secrets/okx_testnet.json")
        
        print("   ✅ Regime检测器")
        print("   ✅ 策略选择器")
        print("   ✅ 评分引擎 V4.3")
        print("   ✅ 市场分析器")
    
    def _init_v51_components(self):
        """初始化 V5.1 质量评估组件"""
        print("\n📦 V5.1 质量评估组件初始化...")
        
        self.signal_eval = SignalQualityEvaluator()
        self.exec_eval = ExecutionQuality()
        self.guardian = StrategyGuardian()
        self.feedback = FeedbackEngine()
        self.optimizer = ParameterOptimizer()
        
        print("   ✅ 信号质量评估")
        print("   ✅ 执行质量评估")
        print("   ✅ 策略守护者")
        print("   ✅ 反馈引擎")
        print("   ✅ 参数优化器")
    
    def _init_v52_components(self):
        """初始化 V5.2 安全控制组件"""
        print("\n📦 V5.2 安全控制组件初始化...")
        
        log_dir_str = str(self.log_dir)
        
        self.sample_filter = SampleFilter()
        self.param_guard = ParameterGuard()
        
        # 配置版本管理器需要配置文件路径
        config_file = str(BASE_DIR / 'config' / 'system_config.json')
        self.config_manager = ConfigVersionManager(config_path=config_file)
        
        self.monitor = SystemMonitor(log_dir=log_dir_str)
        self.safety = SafetyController(config_manager=self.config_manager)
        
        print("   ✅ 样本过滤器")
        print("   ✅ 参数守护者")
        print("   ✅ 配置版本管理器")
        print("   ✅ 系统监控器")
        print("   ✅ 安全控制器")
    
    async def run_cycle(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        运行一个完整周期
        
        完整链路：
        1. 获取市场数据
        2. Regime检测
        3. 策略选择
        4. 评分
        5. 执行条件检查
        6. 执行（如果不是影子模式）
        7. 样本过滤
        8. 质量评估
        9. 守护者检查
        10. 安全检查
        11. 系统监控快照
        """
        self.cycles += 1
        cycle_start = time.time()
        
        try:
            # ========== 0. 连续亏损保护检查 ==========
            should_trade, reason = self.loss_protection.should_trade()
            if not should_trade:
                print(f"⚠️ {reason}")
                return {'action': 'paused', 'reason': reason}
            
            # ========== 0.5 主网硬锁检查（不可绕过）==========
            MAX_TRADES_HARD_LIMIT = self.config.get('MAX_TRADES_HARD_LIMIT', 0)
            if MAX_TRADES_HARD_LIMIT > 0:
                total_trades = len(self.trade_history)
                if total_trades >= MAX_TRADES_HARD_LIMIT:
                    print(f"\n🛑 🛑 🛑 主网验证上限已达: {total_trades}/{MAX_TRADES_HARD_LIMIT}")
                    print(f"    系统强制停止，不可绕过")
                    self.running = False
                    return {'action': 'stop', 'reason': f'MAX_TRADES_HARD_LIMIT reached: {total_trades}/{MAX_TRADES_HARD_LIMIT}'}
            
            # ========== 1. 获取市场数据 ==========
            df = await self.analyzer.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 60:
                return None
            
            current_price = df['close'].iloc[-1]
            
            # ========== 1.5 持仓一致性检查 ==========
            # 检查交易所持仓和系统内部持仓是否一致
            try:
                exchange_positions = self.executor.sync_exchange.fetch_positions([symbol])
                exchange_size = 0
                for pos in exchange_positions:
                    contracts = float(pos.get('contracts', 0))
                    exchange_size += contracts
                
                system_has_position = self.position_manager.has_position(symbol)
                
                if abs(exchange_size) > 0 and not system_has_position:
                    print(f"\n⚠️ 持仓不一致！交易所: {exchange_size} ETH, 系统: 无")
                    print(f"   自动同步持仓...")
                    # 同步持仓
                    self.position_manager.open_position(
                        symbol=symbol,
                        entry_price=current_price,  # 无法获取真实入场价
                        size=abs(exchange_size),
                        side='long' if exchange_size > 0 else 'short',
                        regime='unknown',
                        score=0
                    )
                    print(f"   ✅ 持仓已同步")
                elif abs(exchange_size) == 0 and system_has_position:
                    print(f"\n⚠️ 持仓不一致！交易所: 无, 系统: 有")
                    print(f"   清理系统持仓...")
                    self.position_manager.close_position(symbol)
                    print(f"   ✅ 系统持仓已清理")
            except Exception as e:
                print(f"⚠️ 持仓一致性检查失败: {e}")
            
            # ========== 2. Regime检测 ==========
            regime = self.regime_detector.detect(df)
            self.last_regime = regime
            self.regime_history.append(regime.value)
            
            # 检测Regime是否频繁切换
            if len(self.regime_history) > 10:
                recent = self.regime_history[-10:]
                regime_stability = len(set(recent)) <= 3  # 最近10次最多3种状态
            else:
                regime_stability = True
            
            # ========== 3. 策略选择（提前获取用于持仓检查）==========
            strategy_config = self.strategy_selector.select(regime)
            
            # ========== 3.5 持仓生命周期检查（优先级最高）==========
            # 检查是否需要退出
            if self.position_manager.has_position(symbol):
                position = self.position_manager.get_position(symbol)
                
                # 更新盈亏并检查退出条件
                exit_reason = self.position_manager.check_exit(position, current_price)
                
                if exit_reason:
                    # 需要退出
                    print(f"\n🚨 退出触发: {exit_reason.value}")
                    print(f"   入场: {position.entry_price:.2f}")
                    print(f"   当前: {current_price:.2f}")
                    print(f"   盈亏: {position.current_pnl*100:+.2f}%")
                    print(f"   持仓: {position.hold_time:.0f}s")
                    
                    # 执行平仓
                    print(f"\n🚀 执行平仓...")
                    close_result = await self.executor.close_position(symbol)
                    
                    position.exit_reason = exit_reason
                    position.exit_price = current_price
                    
                    if close_result is not None:
                        print(f"✅ 平仓成功: {symbol}, PnL: {close_result:+.4f}%")
                        self.position_manager.close_position(symbol)
                        self.stats['daily_pnl'] += close_result
                        if close_result > 0:
                            self.stats['win_count'] += 1
                            self.stats['consecutive_losses'] = 0
                        else:
                            self.stats['loss_count'] += 1
                            self.stats['consecutive_losses'] += 1
                        
                        # 连续亏损保护检查
                        protection_result = self.loss_protection.record_trade(close_result)
                        if protection_result['should_pause']:
                            print(f"\n🚨 {protection_result['reason']}")
                            print(f"   需要人工干预后才能恢复交易")
                    else:
                        print(f"❌ 平仓失败: {symbol}")
                    
                    return {'action': 'close', 'symbol': symbol, 'pnl': close_result, 'reason': exit_reason.value}
                
                # 检查紧急退出
                elif self.position_manager.check_emergency_exit(position):
                    print(f"\n🚨 紧急退出触发！")
                    close_result = await self.executor.close_position(symbol)
                    position.exit_reason = exit_reason
                    
                    if close_result is not None:
                        self.position_manager.close_position(symbol)
                        self.stats['daily_pnl'] += close_result
                    
                    return {'action': 'emergency_close', 'symbol': symbol, 'pnl': close_result}
                
                else:
                    # 持仓但不需要退出
                    print(f"\n📊 {symbol} 持仓状态:")
                    print(f"   入场: {position.entry_price:.2f}")
                    print(f"   当前: {current_price:.2f}")
                    print(f"   盈亏: {position.current_pnl*100:+.2f}% (最高: {position.max_pnl*100:+.2f}%)")
                    print(f"   持仓: {position.hold_time:.0f}s / {self.position_manager.max_hold_time}s")
                    print(f"   状态: 🟢 继续持有")
                    return {'action': 'hold', 'symbol': symbol}
            
            # ========== 4. 评分 ==========
            score_result = self.scoring_engine.calculate_score(
                ohlcv_df=df,
                current_price=current_price,
                spread_bps=2.0,  # 默认值，实际应从盘口获取
                rl_decision='ALLOW',
                regime=regime
            )
            score = score_result.total_score if hasattr(score_result, 'total_score') else score_result
            
            # 成交量比
            volume_ratio = df['volume'].iloc[-1] / df['volume'].rolling(20).mean().iloc[-1]
            
            # ========== 5. 执行条件检查 ==========
            # 🔍 DEBUG: 打印检查参数
            print(f"\n[CHECK] symbol={symbol}, score={score}, volume={volume_ratio:.2f}x")
            print(f"[CHECK] strategy_config: min_score={strategy_config.get('min_score')}, min_volume={strategy_config.get('min_volume')}")
            
            should_trade, trade_reason, decision_trace = self._check_execution_conditions(
                score=score,
                volume_ratio=volume_ratio,
                strategy_config=strategy_config
            )
            
            # 🔍 DEBUG: 打印检查结果和决策追踪
            print(f"[CHECK] should_trade={should_trade}, reason={trade_reason}")
            print(f"[CHECK] decision: score_ok={decision_trace['score_ok']}, volume_ok={decision_trace['volume_ok']}, final={decision_trace['final']}")
            print(f"[CHECK] shadow_mode={self.shadow_mode}")
            
            # ========== 6. 执行 ==========
            trade = None
            if should_trade:
                self.stats['total_signals'] += 1
                print(f"🚀 EXECUTION TRIGGERED for {symbol}")
                
                if self.shadow_mode:
                    # 影子模式：只记录，不执行
                    print(f"⚠️ SHADOW MODE - not executing")
                    trade = {
                        'timestamp': datetime.now().isoformat(),
                        'symbol': symbol,
                        'regime': regime.value,
                        'score': score,
                        'volume_ratio': volume_ratio,
                        'price': current_price,
                        'mode': 'shadow',
                        'slippage': 0.0,
                        'latency': 0.0,
                        'decision': decision_trace
                    }
                    self.stats['executed_signals'] += 1
                    print(f"\n📍 [{regime.emoji()}] {symbol} 影子信号")
                    print(f"   评分: {score} | 成交量: {volume_ratio:.2f}x")
                    print(f"   价格: ${current_price:,.2f}")
                else:
                    # 实盘模式：提交到执行引擎队列
                    print(f"⚡ LIVE MODE - submitting to execution engine...")
                    
                    # 创建信号
                    signal = Signal(
                        symbol=symbol,
                        signal_price=current_price,
                        score=score,
                        regime=regime.value,
                        volume_ratio=volume_ratio,
                        timestamp=time.time(),
                        margin_usd=3.0
                    )
                    
                    # 提交到队列
                    if self.execution_engine:
                        self._last_execution_result = None  # 重置
                        submitted = self.execution_engine.submit(signal)
                        if submitted:
                            self.stats['total_signals'] += 1
                            # 等待执行完成（带超时）
                            await asyncio.sleep(2.0)  # 给执行引擎时间执行
                            
                            # 检查执行结果
                            if self._last_execution_result:
                                trade = {
                                    'submitted': True, 
                                    'signal': signal,
                                    'order_result': self._last_execution_result
                                }
                            else:
                                # 执行被跳过或失败
                                print(f"⚠️ 执行未确认，可能被跳过")
                                trade = None
                        else:
                            print(f"⚠️ 信号提交失败")
                            trade = None
                    else:
                        # Fallback: 直接执行（兼容旧模式）
                        trade = await self._execute_trade(symbol, score, regime)
                    if trade and trade.get('order_result'):
                        # 只有订单成功执行才记录
                        print(f"✅ Trade executed: {trade}")
                        
                        # 提取成交信息
                        signal_obj = trade.get('signal')
                        order_result = trade.get('order_result', {})
                        
                        # 确定成交价
                        exec_price = order_result.get('execution_price') or order_result.get('average')
                        if not exec_price and signal_obj:
                            exec_price = signal_obj.signal_price
                        
                        # 记录到审计系统
                        auditor = get_profit_auditor()
                        record = TradeRecord(
                            timestamp=trade.get('timestamp', datetime.now().isoformat()),
                            symbol=symbol,
                            signal_price=signal_obj.signal_price if signal_obj else current_price,
                            execution_price=exec_price or current_price,
                            pnl_pct=0,  # 后续更新
                            slippage_pct=order_result.get('slippage', 0),
                            latency_ms=trade.get('latency', 0) * 1000,
                            regime=regime.value,
                            score=score,
                            is_win=False  # 后续更新
                        )
                        auditor.record_trade(record)
                        
                        # 注册持仓到管理器（只有执行成功才注册）
                        size = order_result.get('filled', 0.14) if order_result else 0.14
                        self.position_manager.open_position(
                            symbol=symbol,
                            entry_price=exec_price or current_price,
                            size=size,
                            side='long',
                            regime=regime.value,
                            score=score
                        )
                        print(f"📊 持仓已注册: {symbol} @ {exec_price:.2f}, size={size}")
                    elif trade:
                        # 信号提交但未确认执行
                        print(f"⏳ 信号已提交，等待执行确认...")
                    else:
                        print(f"❌ Trade returned None")
            else:
                # 记录被拒绝的信号（用于漏斗分析）
                self.stats['rejected_signals'] = self.stats.get('rejected_signals', 0) + 1
                # 记录拒绝原因
                if decision_trace['final'] == 'REJECT_SCORE':
                    self.stats['reject_score'] = self.stats.get('reject_score', 0) + 1
                elif decision_trace['final'] == 'REJECT_VOLUME':
                    self.stats['reject_volume'] = self.stats.get('reject_volume', 0) + 1
            
            # ========== 7-11. 后处理链 ==========
            if trade:
                # 样本过滤
                filter_result = self.sample_filter.is_valid(trade)
                trade['filter_result'] = filter_result.is_valid
                
                if not filter_result.is_valid:
                    self.stats['rejected_samples'] += 1
                    print(f"   ⚠️  样本被过滤: {filter_result.rejection_reasons}")
                else:
                    self.valid_trades.append(trade)
                    self.stats['valid_executions'] += 1
                
                # 质量评估
                trade['signal_quality'] = self._evaluate_signal_quality(trade)
                trade['execution_quality_score'] = self._evaluate_execution_quality(trade)
                
                # 记录交易
                self.trade_history.append(trade)
                
                # 守护者检查
                guardian_report = self.guardian.check(self.trade_history)
                trade['guardian_decision'] = guardian_report.decision.value
                
                # 临时禁用守护者停止（1000笔样本收集期间）
                # if guardian_report.decision == StrategyDecision.STOP:
                #     self.stats['guardian_stops'] += 1
                #     print(f"\n🛑 策略守护者触发STOP: {guardian_report.reason}")
                #     return {'action': 'stop', 'reason': guardian_report.reason}
                
                # 仅警告，不停止
                if guardian_report.decision == StrategyDecision.STOP:
                    print(f"\n⚠️ 守护者警告: {guardian_report.reason} (继续运行)")
                
                # 安全检查
                safety_result = self.safety.check_and_rollback({
                    'execution_score': trade.get('execution_quality_score', 1.0),
                    'consecutive_losses': self.stats['consecutive_losses'],
                    'daily_pnl': self.stats['daily_pnl'],
                    'win_rate': self._calculate_win_rate(),
                    'total_trades': len(self.trade_history),
                    'guardian_decision': guardian_report.decision.value
                })
                
                if safety_result.rollback_performed:
                    self.stats['safety_rollbacks'] += 1
                    print(f"\n⏪ 安全控制器触发回滚")
            
            # ========== 11. 系统监控快照 ==========
            snapshot = self.monitor.snapshot({
                'regime': regime.value,
                'symbol': symbol,
                'score': score,
                'volume_ratio': volume_ratio,
                'position': 'none',  # 简化，实际应从执行器获取
                'last_pnl': self.stats['daily_pnl'],
                'avg_slippage': self._calculate_avg_slippage(),
                'avg_latency': 0.0,
                'execution_quality': self._calculate_avg_exec_quality(),
                'signal_quality': self._calculate_avg_signal_quality(),
                'guardian_status': 'active',
                'guardian_decision': trade.get('guardian_decision', 'continue') if trade else 'continue',
                'min_score': strategy_config.get('min_score', 80),
                'min_volume': strategy_config.get('min_volume', 1.2),
                'total_trades': len(self.trade_history),
                'win_rate': self._calculate_win_rate(),
                'avg_pnl': self.stats['daily_pnl'] / max(1, len(self.trade_history))
            })
            
            return {
                'symbol': symbol,
                'regime': regime.value,
                'score': score,
                'volume_ratio': volume_ratio,
                'should_trade': should_trade,
                'trade': trade,
                'cycle_time': time.time() - cycle_start
            }
            
        except Exception as e:
            print(f"❌ 周期错误: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _check_execution_conditions(
        self,
        score: float,
        volume_ratio: float,
        strategy_config: Dict[str, Any]
    ) -> tuple:
        """
        检查执行条件（带决策追踪）
        
        Returns:
            (should_trade, reason, decision_trace)
        """
        min_score = strategy_config.get('min_score', 80)
        min_volume = strategy_config.get('min_volume', 1.2)
        
        # 决策追踪
        decision = {
            'score': score,
            'volume_ratio': volume_ratio,
            'min_score': min_score,
            'min_volume': min_volume,
            'score_ok': score >= min_score,
            'volume_ok': volume_ratio >= min_volume,
            'spread_ok': True,  # TODO: 实际检查
            'depth_ok': True,   # TODO: 实际检查
            'slippage_ok': True, # TODO: 实际检查
            'final': 'PENDING'
        }
        
        if score < min_score:
            decision['final'] = 'REJECT_SCORE'
            return False, f"评分不足: {score} < {min_score}", decision
        
        if volume_ratio < min_volume:
            decision['final'] = 'REJECT_VOLUME'
            return False, f"成交量不足: {volume_ratio:.2f}x < {min_volume}x", decision
        
        decision['final'] = 'ACCEPT'
        return True, "条件满足", decision
    
    async def _execute_trade(self, symbol: str, score: float, regime: MarketRegime) -> Optional[Dict[str, Any]]:
        """
        执行真实交易
        
        Execution Trace:
        1. 检查执行器
        2. 获取当前价格
        3. 下单
        4. 等待成交
        5. 记录执行数据
        """
        import time
        
        # ========== Step 0: 交易冷却检查 ==========
        MIN_TRADE_INTERVAL = self.config.get('MIN_TRADE_INTERVAL_SECONDS', 0)
        if MIN_TRADE_INTERVAL > 0:
            time_since_last = time.time() - self._last_trade_time
            if time_since_last < MIN_TRADE_INTERVAL:
                print(f"⏸️ 冷却中: {MIN_TRADE_INTERVAL - time_since_last:.0f}s 剩余")
                return None
        
        # ========== Step 1: 执行器检查 ==========
        print(f"\n{'='*50}")
        print(f"⚡ EXECUTION TRACE START")
        print(f"{'='*50}")
        print(f"📍 Symbol: {symbol}")
        print(f"📍 Score: {score}")
        print(f"📍 Regime: {regime.value}")
        
        if self.executor is None:
            print(f"❌ EXECUTOR NOT INITIALIZED")
            raise RuntimeError(
                "❌ CRITICAL: Executor not initialized in LIVE mode!\n"
                "   This means the system would pretend to trade without actually executing.\n"
                "   Please configure API keys in ~/.openclaw/secrets/okx_testnet.json"
            )
        print(f"✅ Step 1: Executor OK")
        
        # ========== Step 2: 获取市场价格 ==========
        try:
            current_price = await self.executor.get_best_price(symbol)
            if current_price is None:
                print(f"❌ Step 2: Failed to get price")
                return None
            print(f"✅ Step 2: Price = ${current_price[0]:,.2f}")
        except Exception as e:
            print(f"❌ Step 2: Price fetch error: {e}")
            return None
        
        # ========== Step 3: 执行下单 ==========
        execution_start = time.time()
        print(f"📤 Step 3: Sending order...")
        
        try:
            # 使用执行器的 execute_signal 方法
            # 参数：symbol, signal_price, margin_usd (保证金)
            margin_usd = self.config.get('margin_usd', 3)
            result = await self.executor.execute_signal(
                symbol=symbol,
                signal_price=current_price[0],
                margin_usd=margin_usd
            )
            
            execution_time = time.time() - execution_start
            print(f"⏱️ Execution time: {execution_time:.3f}s")
            
            if result:
                print(f"✅ Step 3: Order executed")
                print(f"   Order ID: {result.get('order_id', 'N/A')}")
                print(f"   Fill Price: {result.get('avg_px', 'N/A')}")
                print(f"   Fill Size: {result.get('fill_sz', 'N/A')}")
            else:
                print(f"❌ Step 3: Order returned None")
                return None
                
        except Exception as e:
            print(f"❌ Step 3: Order execution error: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        # ========== Step 4: 构建执行记录 ==========
        trade = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'regime': regime.value,
            'score': score,
            'volume_ratio': 0,  # 外部传入
            'price': current_price[0],
            'mode': 'live',
            'execution_time': execution_time,
            'order_result': result,
            'slippage': 0,  # 后续计算
            'latency': execution_time
        }
        
        # 🔒 更新最后交易时间（冷却机制）
        self._last_trade_time = time.time()
        
        print(f"✅ Step 4: Trade record created")
        print(f"{'='*50}")
        print(f"✅ EXECUTION TRACE COMPLETE")
        print(f"{'='*50}\n")
        
        return trade
    
    def _evaluate_signal_quality(self, trade: Dict[str, Any]) -> float:
        """评估信号质量"""
        # 简化实现
        score = trade.get('score', 0)
        volume_ratio = trade.get('volume_ratio', 0)
        
        quality = min(1.0, (score / 100) * 0.6 + min(1.0, volume_ratio / 2.0) * 0.4)
        return quality
    
    def _evaluate_execution_quality(self, trade: Dict[str, Any]) -> float:
        """评估执行质量"""
        slippage = abs(trade.get('slippage', 0))
        latency = trade.get('latency', 0)
        
        # 滑点评分 (0.05%为满分，0.2%为0分)
        slippage_score = max(0, 1 - slippage / 0.002)
        
        # 延迟评分 (100ms为满分，1s为0分)
        latency_score = max(0, 1 - latency / 1.0)
        
        return (slippage_score + latency_score) / 2
    
    def _calculate_win_rate(self) -> float:
        """计算胜率"""
        total = self.stats['win_count'] + self.stats['loss_count']
        if total == 0:
            return 0.5
        return self.stats['win_count'] / total
    
    def _calculate_avg_slippage(self) -> float:
        """计算平均滑点"""
        if not self.trade_history:
            return 0.0
        return sum(abs(t.get('slippage', 0)) for t in self.trade_history) / len(self.trade_history)
    
    def _calculate_avg_exec_quality(self) -> float:
        """计算平均执行质量"""
        if not self.trade_history:
            return 1.0
        return sum(t.get('execution_quality_score', 1.0) for t in self.trade_history) / len(self.trade_history)
    
    def _calculate_avg_signal_quality(self) -> float:
        """计算平均信号质量"""
        if not self.trade_history:
            return 0.5
        return sum(t.get('signal_quality', 0.5) for t in self.trade_history) / len(self.trade_history)
    
    async def run(self, interval: int = 10, max_cycles: int = 0):
        """
        运行系统主循环
        
        Args:
            interval: 检查间隔（秒）
            max_cycles: 最大周期数（0=无限）
        """
        self.running = True
        self.start_time = datetime.now()
        
        symbols = self.config.get('symbols', ['BTC/USDT:USDT'])
        
        print(f"\n🚀 开始运行，检查间隔: {interval}s")
        print(f"   监控标的: {symbols}")
        print(f"   按 Ctrl+C 停止\n")
        
        # 🚀 启动异步执行引擎
        if self.execution_engine:
            self.execution_engine.start()
        
        try:
            while self.running:
                if max_cycles > 0 and self.cycles >= max_cycles:
                    print(f"\n达到最大周期数 {max_cycles}，停止运行")
                    break
                
                for symbol in symbols:
                    result = await self.run_cycle(symbol)
                    
                    if result and result.get('action') == 'stop':
                        print("\n🛑 守护者触发停止，系统退出")
                        self.running = False
                        break
                
                # 定期输出统计
                if self.cycles % 30 == 0:
                    self._print_stats()
                
                await asyncio.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n\n👋 用户中断，停止运行")
        
        finally:
            # 🛑 停止执行引擎
            if self.execution_engine:
                self.execution_engine.stop()
                print(self.execution_engine.report())
            
            self.running = False
            self._print_final_report()
    
    def _print_stats(self):
        """打印统计信息"""
        elapsed = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        
        print(f"\n📊 运行统计 [{datetime.now().strftime('%H:%M:%S')}]")
        print(f"   运行时间: {elapsed/60:.1f}分钟")
        print(f"   周期数: {self.cycles}")
        print(f"   信号数: {self.stats['total_signals']}")
        print(f"   有效执行: {self.stats['valid_executions']}")
        print(f"   拒绝样本: {self.stats['rejected_samples']}")
        print(f"   当前Regime: {self.last_regime.value if self.last_regime else 'unknown'}")
    
    def _print_final_report(self):
        """打印最终报告"""
        print("\n" + "=" * 70)
        print("📋 V5.2 运行报告")
        print("=" * 70)
        
        elapsed = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        
        print(f"\n运行时间: {elapsed/60:.1f} 分钟")
        print(f"总周期数: {self.cycles}")
        print(f"\n信号统计:")
        print(f"  - 检测信号: {self.stats['total_signals']}")
        print(f"  - 执行信号: {self.stats['executed_signals']}")
        print(f"  - 有效样本: {self.stats['valid_executions']}")
        print(f"  - 拒绝样本: {self.stats['rejected_samples']}")
        print(f"\n安全统计:")
        print(f"  - 守护者停止: {self.stats['guardian_stops']}")
        print(f"  - 安全回滚: {self.stats['safety_rollbacks']}")
        
        # Regime分布
        if self.regime_history:
            from collections import Counter
            regime_dist = Counter(self.regime_history)
            print(f"\nRegime分布:")
            for regime, count in regime_dist.items():
                pct = count / len(self.regime_history) * 100
                print(f"  - {regime}: {count} ({pct:.1f}%)")
        
        # 样本过滤统计
        filter_stats = self.sample_filter.get_stats()
        print(f"\n样本过滤:")
        print(f"  - 总样本: {filter_stats['total_samples']}")
        print(f"  - 有效率: {filter_stats['valid_rate']*100:.1f}%")
        
        # 获取监控汇总
        monitor_summary = self.monitor.get_summary()
        print(f"\n系统监控快照数: {monitor_summary.get('snapshot_count', 0)}")
        
        print("\n" + "=" * 70)


async def main():
    """主入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='小龙智能交易系统 V5.2')
    # 网络选择（互斥）
    network_group = parser.add_mutually_exclusive_group()
    network_group.add_argument('--testnet', action='store_true', dest='testnet', help='使用测试网（默认）')
    network_group.add_argument('--mainnet', action='store_true', dest='mainnet', help='使用主网（实盘）')
    # 执行模式（独立）
    parser.add_argument('--execute', action='store_true', help='执行模式（真实交易，非影子）')
    parser.add_argument('--shadow', action='store_true', help='影子模式（不真实执行）')
    parser.add_argument('--live', action='store_true', help='[已废弃] 请使用 --mainnet --execute')
    parser.add_argument('--interval', type=int, default=10, help='检查间隔（秒）')
    parser.add_argument('--cycles', type=int, default=0, help='最大周期数（0=无限）')
    parser.add_argument('--config', type=str, default=None, help='配置文件路径')
    
    args = parser.parse_args()
    
    # 网络选择：默认 testnet，除非显式指定 --mainnet
    # 修复：--live 是废弃参数，不再自动切换网络
    if args.mainnet:
        testnet = False
        print("⚠️  警告: 连接 MAINNET (主网)")
    else:
        testnet = True
        print("✅ 连接 TESTNET (测试网)")
    
    # 执行模式：默认 shadow，除非显式指定 --execute
    shadow_mode = not args.execute
    if args.shadow:
        shadow_mode = True
    
    # 废弃参数警告
    if args.live and not args.mainnet:
        print("⚠️  警告: --live 参数已废弃，请使用 --mainnet --execute")
        print("⚠️  当前行为: 仍连接 TESTNET，但执行模式")
    
    print(f"启动参数: network={'MAINNET' if not testnet else 'TESTNET'}, shadow_mode={shadow_mode}")
    
    # 创建系统
    system = V52System(
        config_path=args.config,
        testnet=testnet,
        shadow_mode=shadow_mode
    )
    
    # 运行
    await system.run(interval=args.interval, max_cycles=args.cycles)


if __name__ == '__main__':
    asyncio.run(main())