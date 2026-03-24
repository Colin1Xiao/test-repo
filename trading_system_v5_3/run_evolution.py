#!/usr/bin/env python3
"""
演化引擎独立运行器
让演化引擎在后台持续运行，驱动策略进化
"""

import sys
import time
import json
import random
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.evolution_engine import EvolutionEngine, StrategyConfig, BehaviorScorer

# 数据目录
DATA_DIR = Path(__file__).parent / 'data'
LOGS_DIR = Path(__file__).parent / 'logs'
DATA_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# 演化日志
EVOLUTION_LOG = LOGS_DIR / 'evolution_logs.jsonl'
SYSTEM_STATE_LOG = LOGS_DIR / 'system_state.jsonl'


class EvolutionRunner:
    """演化引擎运行器"""
    
    def __init__(self):
        self.engine = EvolutionEngine()
        self.scorer = BehaviorScorer()
        self.generation = 1
        self.best_fitness = 0.74
        self.total_mutations = 0
        self.running = True
        
        print("="*60)
        print("🧬 演化引擎启动")
        print("="*60)
        print(f"初始适应度: {self.best_fitness:.2%}")
        print(f"日志文件: {EVOLUTION_LOG}")
        print("="*60)
    
    def load_current_params(self) -> dict:
        """加载当前参数"""
        try:
            if EVOLUTION_LOG.exists():
                with open(EVOLUTION_LOG, 'r') as f:
                    lines = [l for l in f.readlines() if l.strip()]
                    if lines:
                        latest = json.loads(lines[-1])
                        return latest.get('new_params', {
                            'score_threshold': 84.6,
                            'volume_threshold': 1.33
                        })
        except: pass
        return {'score_threshold': 84.6, 'volume_threshold': 1.33}
    
    def save_evolution_record(self, record: dict):
        """保存演化记录"""
        try:
            with open(EVOLUTION_LOG, 'a') as f:
                f.write(json.dumps(record) + '\n')
        except Exception as e:
            print(f"保存记录失败: {e}")
    
    def mutate_params(self, params: dict) -> dict:
        """参数变异"""
        new_params = params.copy()
        
        # 随机选择变异参数
        if random.random() < 0.5:
            # 变异 score_threshold
            delta = random.uniform(-2, 2)
            new_params['score_threshold'] = max(60, min(95, 
                params['score_threshold'] + delta))
        else:
            # 变异 volume_threshold
            delta = random.uniform(-0.1, 0.1)
            new_params['volume_threshold'] = max(0.5, min(2.0, 
                params['volume_threshold'] + delta))
        
        return new_params
    
    def simulate_performance(self, params: dict) -> dict:
        """模拟性能评估"""
        # 基于参数计算模拟性能
        base_score = params['score_threshold'] / 100
        base_vol = params['volume_threshold'] / 2
        
        # 随机波动
        pnl_pct = random.uniform(-0.005, 0.01) * base_score
        execution_quality = min(1.0, 0.85 + random.uniform(0, 0.15) * base_score)
        signal_quality = min(1.0, 0.80 + random.uniform(0, 0.20) * base_vol)
        
        return {
            'pnl_pct': pnl_pct,
            'execution_quality': execution_quality,
            'signal_quality': signal_quality,
            'score': (pnl_pct * 50 + execution_quality * 0.3 + signal_quality * 0.2)
        }
    
    def run_evolution_step(self):
        """执行一次演化步骤"""
        # 1. 加载当前参数
        current_params = self.load_current_params()
        
        # 2. 变异
        new_params = self.mutate_params(current_params)
        self.total_mutations += 1
        
        # 3. 评估性能
        performance = self.simulate_performance(new_params)
        
        # 4. 决定是否接受
        if performance['score'] > self.best_fitness:
            decision = "ACCEPTED"
            self.best_fitness = performance['score']
            current_params = new_params
        else:
            decision = "TESTING"
        
        # 5. 记录
        record = {
            'timestamp': datetime.now().isoformat(),
            'generation': self.generation,
            'action': 'mutation',
            'old_params': self.load_current_params(),
            'new_params': new_params,
            'performance': performance,
            'decision': decision,
            'best_fitness': self.best_fitness
        }
        
        self.save_evolution_record(record)
        
        # 6. 推进代数
        self.generation += 1
        
        # 7. 输出
        status = "✅" if decision == "ACCEPTED" else "🔄"
        print(f"{status} Gen {self.generation} | 适应度: {self.best_fitness:.2%} | "
              f"评分阈值: {new_params['score_threshold']:.1f} | "
              f"量能阈值: {new_params['volume_threshold']:.2f} | "
              f"决策: {decision}")
        
        return record
    
    def run(self):
        """主循环"""
        print("\n🚀 开始演化...")
        
        while self.running:
            try:
                self.run_evolution_step()
                time.sleep(5)  # 每5秒演化一次
                
            except KeyboardInterrupt:
                print("\n⏹ 演化引擎停止")
                self.running = False
            except Exception as e:
                print(f"❌ 演化错误: {e}")
                time.sleep(5)


def main():
    runner = EvolutionRunner()
    runner.run()


if __name__ == '__main__':
    main()