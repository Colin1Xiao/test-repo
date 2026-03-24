"""
State Integration - 将 StateStore 与 Shadow Integration 连接

核心流程:
每一笔 Shadow 执行 → 更新 StateStore → 重新计算 GO/NO-GO → 通知前端
"""

from typing import Dict, Any
from datetime import datetime
from pathlib import Path
import json

from state_store import get_state_store, GoNoGoStatus


class StateIntegratedShadowRunner:
    """
    集成 StateStore 的 Shadow Runner
    
    每一笔交易完成后，自动更新全局状态
    """
    
    def __init__(self):
        self.state = get_state_store()
        self.logger = DecisionDiffLogger()
        
        # 注册回调（可选：用于日志、通知等）
        self.state.register_callback(self._on_state_change)
        
        print("✅ StateIntegratedShadowRunner 初始化完成")
    
    def _on_state_change(self, event_type: str, data: Dict[str, Any]):
        """状态变化回调"""
        if event_type == 'shadow_trade':
            print(f"📊 Shadow 交易记录: #{data.get('signal_id')} - {data.get('diff_type')}")
            
            # 检查 GO/NO-GO 变化
            go_no_go = self.state.get_go_no_go()
            if go_no_go.status == GoNoGoStatus.GO:
                print(f"🎉 GO/NO-GO 状态变为 GO！可以切换到混合模式")
            elif go_no_go.status == GoNoGoStatus.NO_GO:
                print(f"🚫 GO/NO-GO 状态变为 NO-GO: {go_no_go.reason}")
    
    def execute_shadow(self, signal: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行 Shadow 决策并更新状态
        
        这是关键方法：每一笔交易都在这里驱动状态更新
        """
        # 1. 获取 V2 决策（旧系统）
        old_action = self._get_v2_decision(signal)
        
        # 2. 获取 V3 决策（新系统）
        new_action, new_reason, risk_level = self._get_v3_decision(signal)
        
        # 3. 计算差异
        diff_type = self._calculate_diff(old_action, new_action)
        
        # 4. 构建决策记录
        decision = {
            'timestamp': datetime.utcnow().isoformat(),
            'signal_id': signal.get('id', 'unknown'),
            'old_action': old_action,
            'new_action': new_action,
            'diff_type': diff_type,
            'risk_level': risk_level,
            'new_reason': new_reason
        }
        
        # 5. 记录到日志
        self.logger.log(decision)
        
        # 6. 🎯 关键：更新 StateStore（事件驱动）
        self.state.on_shadow_trade(decision)
        
        # 7. 返回结果
        return {
            'decision': decision,
            'go_no_go': self.state.get_go_no_go().status.value,
            'total_samples': self.state.get_shadow_metrics().total_samples
        }
    
    def _get_v2_decision(self, signal: Dict[str, Any]) -> str:
        """获取 V2 决策（模拟）"""
        # TODO: 调用 V2 系统
        return signal.get('v2_action', 'HOLD')
    
    def _get_v3_decision(self, signal: Dict[str, Any]) -> tuple:
        """获取 V3 决策（模拟）"""
        # TODO: 调用 V3 系统
        return (
            signal.get('v3_action', 'HOLD'),
            signal.get('v3_reason', 'unknown'),
            signal.get('risk_level', 'LOW')
        )
    
    def _calculate_diff(self, old_action: str, new_action: str) -> str:
        """计算决策差异类型"""
        if old_action == new_action:
            return 'SAME'
        
        # 定义激进程度
        aggression_map = {
            'HOLD': 0,
            'PASS': 0,
            'BUY': 1,
            'SELL': 1,
            'CLOSE': 2
        }
        
        old_level = aggression_map.get(old_action, 0)
        new_level = aggression_map.get(new_action, 0)
        
        if new_level > old_level:
            return 'AGGRESSIVE'
        elif new_level < old_level:
            return 'CONSERVATIVE'
        else:
            return 'SAME'
    
    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        return self.state.to_dict()


class DecisionDiffLogger:
    """决策差异日志记录器"""
    
    def __init__(self, log_dir: str = "logs/decision_diff"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.diffs = []
    
    def log(self, decision: Dict[str, Any]):
        """记录决策"""
        # 内存存储
        self.diffs.append(decision)
        
        # 文件存储
        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file = self.log_dir / f"decision_diff_{date_str}.jsonl"
        
        with open(log_file, 'a') as f:
            f.write(json.dumps(decision, ensure_ascii=False) + '\n')
    
    def get_recent(self, limit: int = 20) -> list:
        """获取最近决策"""
        return self.diffs[-limit:][::-1]


# ============ 使用示例 ============

if __name__ == "__main__":
    print("="*60)
    print("🧪 State Integration 测试")
    print("="*60)
    
    # 创建集成 runner
    runner = StateIntegratedShadowRunner()
    
    # 模拟 35 笔交易
    print("\n📊 模拟 35 笔 Shadow 交易...")
    
    import random
    actions = ['HOLD', 'BUY', 'SELL', 'CLOSE', 'PASS']
    
    for i in range(35):
        signal = {
            'id': f"SIG_{i+1:03d}",
            'v2_action': random.choice(actions),
            'v3_action': random.choice(actions),
            'v3_reason': random.choice(['trend_follow', 'mean_reversion', 'breakout']),
            'risk_level': random.choice(['LOW', 'MEDIUM', 'HIGH'])
        }
        
        result = runner.execute_shadow(signal)
        
        # 每 10 笔显示一次状态
        if (i + 1) % 10 == 0:
            status = runner.get_status()
            print(f"\n--- 第 {i+1} 笔后 ---")
            print(f"  Shadow: {status['shadow']}")
            print(f"  GO/NO-GO: {status['go_no_go']['status']} - {status['go_no_go']['reason']}")
    
    print("\n" + "="*60)
    print("✅ 测试完成")
    print("="*60)
    
    # 最终状态
    final = runner.get_status()
    print(f"\n最终状态:")
    print(f"  总样本: {final['shadow']['total']}")
    print(f"  差异率: {final['shadow']['diff_rate_pct']}")
    print(f"  激进决策: {final['shadow']['aggressive']}")
    print(f"  GO/NO-GO: {final['go_no_go']['status']}")
    print(f"  原因: {final['go_no_go']['reason']}")