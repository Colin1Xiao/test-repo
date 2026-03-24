"""
连续亏损保护模块
防止尾部捕获策略在长时间亏损后爆仓
"""
import json
from pathlib import Path
from datetime import datetime

class ConsecutiveLossProtection:
    """连续亏损保护器"""
    
    def __init__(self, max_consecutive_losses: int = 30, state_file: str = None):
        self.max_losses = max_consecutive_losses
        self.state_file = state_file or str(Path(__file__).parent.parent / "logs" / "consecutive_loss_state.json")
        self.consecutive_losses = 0
        self.paused = False
        self.pause_time = None
        self._load_state()
    
    def _load_state(self):
        """加载状态"""
        try:
            if Path(self.state_file).exists():
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.consecutive_losses = data.get('consecutive_losses', 0)
                    self.paused = data.get('paused', False)
                    self.pause_time = data.get('pause_time')
        except:
            pass
    
    def _save_state(self):
        """保存状态"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump({
                    'consecutive_losses': self.consecutive_losses,
                    'paused': self.paused,
                    'pause_time': self.pause_time,
                    'last_update': datetime.now().isoformat()
                }, f, indent=2)
        except:
            pass
    
    def record_trade(self, pnl_pct: float) -> dict:
        """
        记录交易结果
        
        Args:
            pnl_pct: 盈亏百分比
        
        Returns:
            {'should_pause': bool, 'reason': str, 'stats': dict}
        """
        if self.paused:
            return {
                'should_pause': True,
                'reason': f'系统已暂停（连续亏损 {self.consecutive_losses} 笔）',
                'stats': self.get_stats()
            }
        
        if pnl_pct < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
        
        # 检查是否触发暂停
        if self.consecutive_losses >= self.max_losses:
            self.paused = True
            self.pause_time = datetime.now().isoformat()
            self._save_state()
            return {
                'should_pause': True,
                'reason': f'连续亏损 {self.consecutive_losses} 笔，触发保护性暂停',
                'stats': self.get_stats()
            }
        
        self._save_state()
        return {
            'should_pause': False,
            'reason': '',
            'stats': self.get_stats()
        }
    
    def should_trade(self) -> tuple:
        """是否应该继续交易"""
        if self.paused:
            return False, f'连续亏损保护已触发 ({self.consecutive_losses}/{self.max_losses})'
        return True, ''
    
    def reset(self):
        """重置（人工干预后恢复）"""
        self.consecutive_losses = 0
        self.paused = False
        self.pause_time = None
        self._save_state()
        print(f"✅ 连续亏损保护已重置")
    
    def get_stats(self) -> dict:
        """获取统计"""
        return {
            'consecutive_losses': self.consecutive_losses,
            'max_losses': self.max_losses,
            'paused': self.paused,
            'pause_time': self.pause_time,
            'remaining_before_pause': max(0, self.max_losses - self.consecutive_losses)
        }


# 全局实例
_protection = None

def get_protection(max_losses: int = 30) -> ConsecutiveLossProtection:
    global _protection
    if _protection is None:
        _protection = ConsecutiveLossProtection(max_losses)
    return _protection
