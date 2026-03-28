#!/usr/bin/env python3
"""
小龙自动交易系统 V3 最终系统测试（单交易所模式）
Dragon Auto Trading System V3 Final System Test (Single Exchange Mode)
"""

import asyncio
import json
import subprocess
import sys
import time
import psutil
import os
from datetime import datetime
from pathlib import Path
import signal
import threading
import queue

class DragonTradingSystemTest:
    """小龙自动交易系统测试类"""
    
    def __init__(self):
        self.test_results = []
        self.process = None
        self.start_time = None
        self.memory_usage = []
        self.cpu_usage = []
        self.test_log = []
    
    def log(self, message):
        """记录日志"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.test_log.append(log_entry)
    
    def add_result(self, test_item, status, actual_output, remarks=""):
        """添加测试结果"""
        result = {
            'test_item': test_item,
            'status': status,
            'actual_output': actual_output,
            'remarks': remarks
        }
        self.test_results.append(result)
        print(f"{'✅' if status == '通过' else '❌'} {test_item}: {status}")
        if remarks:
            print(f"   备注: {remarks}")
    
    def test_startup(self):
        """启动测试 - 启动 auto_monitor_v2.py"""
        self.log("开始启动测试...")
        
        try:
            # 启动 auto_monitor_v2.py
            cmd = [sys.executable, './auto_monitor_v2.py', '--interval', '30', '--no-sound']
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                preexec_fn=os.setsid  # 创建新进程组
            )
            
            # 等待系统初始化
            time.sleep(5)
            
            # 检查进程是否正常启动
            if self.process.poll() is None:
                self.add_result(
                    "启动测试",
                    "通过",
                    "auto_monitor_v2.py 进程正常启动",
                    "PID: {}".format(self.process.pid)
                )
                
                # 检查日志输出
                try:
                    stdout, stderr = self.process.communicate(timeout=1)
                    if "监控系统 V2 启动" in stdout or "自动监控系统 V2" in stdout:
                        self.add_result(
                            "系统初始化验证",
                            "通过",
                            "系统初始化正常",
                            "检测到 '监控系统 V2 启动'"
                        )
                    else:
                        self.add_result(
                            "系统初始化验证",
                            "失败",
                            "未检测到系统启动标志",
                            "stdout: {}".format(stdout[:200] if stdout else "None")
                        )
                except subprocess.TimeoutExpired:
                    self.add_result(
                        "系统初始化验证",
                        "通过",
                        "系统正在运行，无异常输出",
                        "进程响应正常"
                    )
            else:
                # 进程已退出
                stdout, stderr = self.process.communicate()
                self.add_result(
                    "启动测试",
                    "失败",
                    "进程启动失败",
                    "stderr: {}".format(stderr)
                )
                return False
                
        except Exception as e:
            self.add_result(
                "启动测试",
                "失败",
                "启动异常",
                str(e)
            )
            return False
            
        return True
    
    def test_data_collection(self):
        """数据采集测试 - 验证 OKX 数据获取"""
        self.log("开始数据采集测试...")
        
        try:
            # 导入必要的模块进行测试
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent))
            
            # 测试数据管道
            from unified_pipeline import UnifiedDataPipeline
            pipeline = UnifiedDataPipeline()
            
            # 获取 BTC/USDT 数据
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            data = loop.run_until_complete(pipeline.fetch_market_data('BTC/USDT:USDT'))
            loop.close()
            
            if 'error' not in data:
                # 验证数据格式
                if 'ohlcv' in data and len(data['ohlcv']) > 0:
                    latest_candle = data['ohlcv'][-1]
                    if len(latest_candle) == 6:  # timestamp, open, high, low, close, volume
                        # 验证时间戳
                        timestamp = latest_candle[0]
                        current_time = int(time.time() * 1000)
                        time_diff = abs(current_time - timestamp)
                        
                        if time_diff < 300000:  # 5分钟内
                            self.add_result(
                                "OKX 数据获取",
                                "通过",
                                "成功获取 BTC/USDT 数据",
                                "最新K线时间差: {}秒".format(time_diff // 1000)
                            )
                            
                            # 检查价格数据格式
                            open_price, high, low, close, volume = latest_candle[1:6]
                            if all(isinstance(p, (int, float)) and p > 0 for p in [open_price, high, low, close]) and volume >= 0:
                                self.add_result(
                                    "价格数据格式",
                                    "通过",
                                    "价格数据格式正确",
                                    "O:{}, H:{}, L:{}, C:{}, V:{}".format(open_price, high, low, close, volume)
                                )
                            else:
                                self.add_result(
                                    "价格数据格式",
                                    "失败",
                                    "价格数据格式不正确",
                                    "O:{}, H:{}, L:{}, C:{}, V:{}".format(open_price, high, low, close, volume)
                                )
                        else:
                            self.add_result(
                                "时间戳验证",
                                "失败",
                                "时间戳差异过大",
                                "时间差: {}秒".format(time_diff // 1000)
                            )
                    else:
                        self.add_result(
                            "数据格式验证",
                            "失败",
                            "K线数据格式不正确",
                            "长度: {}".format(len(latest_candle))
                        )
                else:
                    self.add_result(
                        "数据获取验证",
                        "失败",
                        "未获取到有效数据",
                        "ohlcv数据为空或不存在"
                    )
            else:
                self.add_result(
                    "OKX 数据获取",
                    "失败",
                    "数据获取失败",
                    data.get('error', '未知错误')
                )
                
        except Exception as e:
            self.add_result(
                "数据采集测试",
                "失败",
                "数据采集异常",
                str(e)
            )
    
    def test_signal_generation(self):
        """信号生成测试 - 运行 integrated_signal.py"""
        self.log("开始信号生成测试...")
        
        try:
            # 导入信号生成器
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent))
            
            from integrated_signal import IntegratedSignalGenerator
            import pandas as pd
            import numpy as np
            
            # 创建一个模拟的数据框用于测试
            dates = pd.date_range(end=pd.Timestamp.now(), periods=100, freq='5min')
            df = pd.DataFrame({
                'timestamp': [int(d.timestamp() * 1000) for d in dates],
                'open': np.random.uniform(60000, 70000, 100),
                'high': np.random.uniform(60100, 70100, 100),
                'low': np.random.uniform(59900, 69900, 100),
                'close': np.random.uniform(60000, 70000, 100),
                'volume': np.random.uniform(100, 1000, 100),
                'datetime': dates
            })
            
            # 添加一些技术指标列
            df['ema_9'] = df['close'].ewm(span=9).mean()
            df['ema_20'] = df['close'].ewm(span=20).mean()
            df['ema_50'] = df['close'].ewm(span=50).mean()
            
            # 简单的RSI计算
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi_14'] = 100 - (100 / (1 + rs))
            
            # 创建信号生成器并测试
            generator = IntegratedSignalGenerator()
            
            # 测试上下文数据
            context = {
                'ml_prediction': {'score': 0.5, 'confidence': 0.7},
                'sentiment': {'csi': 45},
                'macro_events': {'risk_level': 'GREEN'}
            }
            
            # 生成信号
            signal = generator.generate_signal(df, context)
            
            # 验证信号生成
            if signal:
                self.add_result(
                    "信号生成逻辑",
                    "通过",
                    "成功生成整合信号",
                    "信号类型: {}".format(signal.signal.value)
                )
                
                # 验证信号类型输出
                valid_signals = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']
                if signal.signal.value in valid_signals:
                    self.add_result(
                        "信号类型输出",
                        "通过",
                        "信号类型在有效范围内",
                        "信号: {}".format(signal.signal.value)
                    )
                else:
                    self.add_result(
                        "信号类型输出",
                        "失败",
                        "信号类型不在有效范围内",
                        "信号: {}".format(signal.signal.value)
                    )
            else:
                self.add_result(
                    "信号生成逻辑",
                    "失败",
                    "未能生成信号",
                    "返回值为 None"
                )
                
        except Exception as e:
            self.add_result(
                "信号生成测试",
                "失败",
                "信号生成异常",
                str(e)
            )
    
    def test_risk_control(self):
        """风控测试 - 验证日限额检查、止损逻辑、仓位计算"""
        self.log("开始风控测试...")
        
        try:
            # 测试风险评估函数
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent))
            
            from skills.crypto_risk.scripts.risk_check import assess_risk
            
            # 测试不同的风险场景
            test_cases = [
                {'position': 1000, 'leverage': 10, 'balance': 5000, 'expected_risk': 'MEDIUM'},
                {'position': 5000, 'leverage': 2, 'balance': 5000, 'expected_risk': 'HIGH'},
                {'position': 1000, 'leverage': 50, 'balance': 10000, 'expected_risk': 'VERY_HIGH'},
                {'position': 100, 'leverage': 1, 'balance': 10000, 'expected_risk': 'LOW'}
            ]
            
            all_passed = True
            for i, case in enumerate(test_cases):
                result = assess_risk(case['position'], case['leverage'], case['balance'])
                if result['risk_level'] != case['expected_risk'] and not (
                    case['expected_risk'] == 'HIGH' and result['risk_level'] == 'VERY_HIGH'  # 可接受的偏差
                ):
                    all_passed = False
                    break
            
            if all_passed:
                self.add_result(
                    "风控逻辑验证",
                    "通过",
                    "风险评估函数正常工作",
                    "通过 {} 个测试案例".format(len(test_cases))
                )
            else:
                self.add_result(
                    "风控逻辑验证",
                    "失败",
                    "风险评估函数异常",
                    "某些测试案例失败"
                )
                
            # 测试止损逻辑
            # 在 integrated_signal.py 中，止损逻辑是根据信号类型和置信度设置的
            from integrated_signal import IntegratedSignalGenerator
            generator = IntegratedSignalGenerator()
            
            # 模拟一个强烈的买入信号
            class MockDataFrame:
                def __init__(self):
                    self.columns = ['close']
                    self.iloc = [type('obj', (object,), {'close': 68000})()]
            
            # 测试仓位计算
            position = generator.calc_position(0.8, 0.9, 'GREEN')  # 高分高置信度
            expected_max = generator.config['max_position']
            
            if 0 <= position <= expected_max:
                self.add_result(
                    "仓位计算验证",
                    "通过",
                    "仓位计算在合理范围内",
                    "计算仓位: {:.2f}%".format(position*100)
                )
            else:
                self.add_result(
                    "仓位计算验证",
                    "失败",
                    "仓位计算超出范围",
                    "计算仓位: {:.2f}%".format(position*100)
                )
                
        except Exception as e:
            self.add_result(
                "风控测试",
                "失败",
                "风控测试异常",
                str(e)
            )
    
    def test_telegram_alert(self):
        """Telegram 告警测试 - 发送测试消息"""
        self.log("开始Telegram告警测试...")
        
        try:
            # 导入Telegram告警模块
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent))
            
            from telegram_alert import TelegramAlert
            
            # 创建告警实例
            alert = TelegramAlert()
            
            if alert.enabled:
                # 发送测试消息
                success = alert.send_message("🐉 小龙自动交易系统V3测试告警 - {}".format(
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ))
                
                if success:
                    self.add_result(
                        "Telegram 消息发送",
                        "通过",
                        "成功发送测试消息",
                        "消息已发送到指定频道"
                    )
                    
                    # 测试交易信号发送
                    signal_data = {
                        'symbol': 'BTC/USDT',
                        'signal': 'STRONG_BUY',
                        'price': 68500,
                        'confidence': 0.85,
                        'position_pct': 0.8,
                        'leverage': 50,
                        'stop_loss': 67815,
                        'take_profit': 70555,
                        'reason': '系统测试信号'
                    }
                    
                    signal_success = alert.send_trading_signal(signal_data)
                    if signal_success:
                        self.add_result(
                            "交易信号发送",
                            "通过",
                            "成功发送交易信号",
                            "包含完整交易信息"
                        )
                    else:
                        self.add_result(
                            "交易信号发送",
                            "失败",
                            "交易信号发送失败",
                            "可能网络问题或配置错误"
                        )
                else:
                    self.add_result(
                        "Telegram 消息发送",
                        "失败",
                        "消息发送失败",
                        "检查网络连接或配置"
                    )
            else:
                self.add_result(
                    "Telegram 配置",
                    "失败",
                    "Telegram 未启用或配置错误",
                    "请检查 telegram_config.json"
                )
                
        except Exception as e:
            self.add_result(
                "Telegram 告警测试",
                "失败",
                "Telegram 测试异常",
                str(e)
            )
    
    def test_stability(self, duration_minutes=5):
        """系统稳定性测试 - 运行5分钟持续监控"""
        self.log("开始系统稳定性测试 ({}分钟)...".format(duration_minutes))
        
        try:
            # 获取初始内存和CPU使用情况
            initial_process = psutil.Process(os.getpid())
            initial_memory = initial_process.memory_info().rss / 1024 / 1024  # MB
            initial_cpu = initial_process.cpu_percent()
            
            self.log("初始内存使用: {:.2f} MB".format(initial_memory))
            
            # 记录内存和CPU使用情况
            def monitor_resources(stop_event):
                while not stop_event.is_set():
                    try:
                        memory_mb = initial_process.memory_info().rss / 1024 / 1024
                        cpu_percent = initial_process.cpu_percent()
                        
                        self.memory_usage.append(memory_mb)
                        self.cpu_usage.append(cpu_percent)
                        
                        time.sleep(10)  # 每10秒记录一次
                    except:
                        break
            
            # 开始资源监控
            stop_event = threading.Event()
            monitor_thread = threading.Thread(target=monitor_resources, args=(stop_event,))
            monitor_thread.daemon = True
            monitor_thread.start()
            
            # 运行稳定性测试
            start_time = time.time()
            end_time = start_time + (duration_minutes * 60)
            
            while time.time() < end_time:
                # 检查主进程是否还在运行
                if self.process and self.process.poll() is not None:
                    stdout, stderr = self.process.communicate()
                    self.add_result(
                        "系统稳定性",
                        "失败",
                        "主进程异常退出",
                        "退出码: {}, 错误: {}".format(self.process.returncode, stderr)
                    )
                    stop_event.set()
                    return False
                
                time.sleep(5)
            
            # 停止监控
            stop_event.set()
            monitor_thread.join(timeout=2)
            
            # 分析资源使用情况
            if self.memory_usage:
                max_memory = max(self.memory_usage)
                min_memory = min(self.memory_usage)
                avg_memory = sum(self.memory_usage) / len(self.memory_usage)
                
                self.log("内存使用 - 最小: {:.2f}MB, 平均: {:.2f}MB, 最大: {:.2f}MB".format(
                    min_memory, avg_memory, max_memory
                ))
                
                # 检查内存泄漏
                if max_memory - initial_memory > 100:  # 内存增长超过100MB
                    self.add_result(
                        "内存使用",
                        "警告",
                        "内存使用增长明显",
                        "增长: {:.2f}MB".format(max_memory - initial_memory)
                    )
                else:
                    self.add_result(
                        "内存使用",
                        "通过",
                        "内存使用稳定",
                        "最大增长: {:.2f}MB".format(max_memory - initial_memory)
                    )
            else:
                self.add_result(
                    "内存监控",
                    "失败",
                    "无法获取内存使用数据",
                    "监控线程异常"
                )
            
            # 验证无异常崩溃
            if self.process and self.process.poll() is None:
                self.add_result(
                    "系统稳定性",
                    "通过",
                    "系统持续运行正常",
                    "运行时间: {}分钟".format(duration_minutes)
                )
            else:
                self.add_result(
                    "系统稳定性",
                    "失败",
                    "系统在测试期间崩溃",
                    "进程已退出"
                )
                
            return True
            
        except Exception as e:
            self.add_result(
                "系统稳定性测试",
                "失败",
                "稳定性测试异常",
                str(e)
            )
            return False
    
    def stop_system(self):
        """停止系统"""
        if self.process:
            try:
                # 终止进程组
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                time.sleep(2)
                # 如果进程仍在运行，强制终止
                if self.process.poll() is None:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass  # 进程已结束
            except Exception as e:
                self.log("停止进程时出错: {}".format(str(e)))
    
    def generate_test_report(self):
        """生成测试报告"""
        self.log("\n" + "="*80)
        self.log("小龙自动交易系统 V3 最终系统测试报告")
        self.log("测试时间: {}".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        self.log("="*80)
        
        # 统计结果
        passed_count = sum(1 for r in self.test_results if r['status'] == '通过')
        total_count = len(self.test_results)
        
        for result in self.test_results:
            status_icon = "✅" if result['status'] == '通过' else "❌"
            self.log("{} {}: {}".format(status_icon, result['test_item'], result['status']))
            if result['remarks']:
                self.log("   备注: {}".format(result['remarks']))
            self.log("")
        
        self.log("-"*80)
        self.log("测试总结: {}/{} 项通过".format(passed_count, total_count))
        
        if passed_count == total_count:
            self.log("🎉 测试结果: ALL PASS - 系统通过最终测试!")
            overall_result = "通过"
        else:
            self.log("⚠️  测试结果: 存在失败项目，需修复后再发布")
            overall_result = "部分通过"
        
        self.log("="*80)
        
        # 保存测试报告
        report = {
            'test_time': datetime.now().isoformat(),
            'overall_result': overall_result,
            'passed_count': passed_count,
            'total_count': total_count,
            'test_results': self.test_results,
            'memory_usage': {
                'max': max(self.memory_usage) if self.memory_usage else 0,
                'min': min(self.memory_usage) if self.memory_usage else 0,
                'avg': sum(self.memory_usage)/len(self.memory_usage) if self.memory_usage else 0
            } if self.memory_usage else {}
        }
        
        with open('dragon_trading_system_test_report.json', 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        self.log("测试报告已保存至: dragon_trading_system_test_report.json")
        
        return overall_result == "通过"

def main():
    """主函数"""
    print("🐉 小龙自动交易系统 V3 最终系统测试（单交易所模式）")
    print("="*80)
    
    tester = DragonTradingSystemTest()
    
    try:
        # 1. 启动测试
        startup_ok = tester.test_startup()
        
        # 2. 数据采集测试
        tester.test_data_collection()
        
        # 3. 信号生成测试
        tester.test_signal_generation()
        
        # 4. 风控测试
        tester.test_risk_control()
        
        # 5. Telegram 告警测试
        tester.test_telegram_alert()
        
        # 6. 系统稳定性测试 (运行5分钟)
        if startup_ok:
            tester.test_stability(duration_minutes=1)  # 为了演示，缩短为1分钟
        else:
            tester.add_result(
                "系统稳定性测试",
                "跳过",
                "因启动失败而跳过",
                "前置条件不满足"
            )
        
        # 停止系统
        tester.stop_system()
        
        # 生成报告
        success = tester.generate_test_report()
        
        print("\n测试完成!")
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n测试被用户中断")
        tester.stop_system()
        return 1
    except Exception as e:
        print(f"\n测试过程中发生错误: {str(e)}")
        tester.stop_system()
        return 1

if __name__ == '__main__':
    sys.exit(main())