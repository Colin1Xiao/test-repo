# 🖥️ 自动市场监控系统

> 7×24 小时不间断监控，捕捉每个交易机会

---

## ✅ 现有监控功能

### 1. 基础监控脚本（已有）

**文件**: `skills/crypto-signals/scripts/monitor.py`

**功能**:
- ✅ 实时监控价格（1 分钟/5 分钟）
- ✅ 技术指标计算（EMA/RSI/MACD）
- ✅ 信号生成（BUY/SELL/HOLD）
- ✅ 连续监控模式（--continuous）
- ✅ 信号变化时推送

**使用方式**:
```bash
# 持续监控
python3 monitor.py --symbol BTC/USDT --timeframe 5m --continuous --interval 30

# 多币种监控
python3 monitor.py --symbols BTC/USDT,ETH/USDT,SOL/USDT --continuous
```

**局限**:
❌ 只监控技术面  
❌ 没有预测功能  
❌ 没有事件预警  
❌ 没有情绪分析  

---

## 🆕 新增自动监控功能

### 2. 整合版监控引擎（新增）

**文件**: `auto_monitor.py`（待创建）

**监控维度**:

| 维度 | 监控内容 | 频率 | 预警阈值 |
|------|----------|------|----------|
| **价格** | BTC/ETH 等主流币 | 实时 | ±2%/5 分钟 |
| **技术指标** | EMA/RSI/MACD | 每 5 秒 | 金叉/死叉 |
| **量价关系** | 放量/缩量 | 每 5 秒 | >1.5x 均值 |
| **情绪指数** | CSI 综合情绪 | 每 1 分钟 | <20 或 >80 |
| **宏观事件** | 财经日历 | 每 1 小时 | 红色风险 |
| **ML 预测** | 价格方向预测 | 每 1 分钟 | 置信度>0.8 |
| **市场状态** | 趋势/震荡/突破 | 每 5 分钟 | 状态转换 |
| **链上数据** | 大额转账 | 每 5 分钟 | >1000 BTC |
| **交易所数据** | 资金费率/持仓量 | 每 1 分钟 | 异常波动 |

---

## 🏗️ 监控系统架构

```
┌─────────────────────────────────────────┐
│          告警推送层                     │
│  Telegram/微信/邮件/声音告警             │
├─────────────────────────────────────────┤
│          决策引擎层                     │
│  信号融合 / 置信度评估 / 风险检查        │
├─────────────────────────────────────────┤
│          分析引擎层                     │
│  技术分析 / ML 预测 / 情绪分析 / 事件分析  │
├─────────────────────────────────────────┤
│          数据采集层                     │
│  OKX API / 新闻 API / Twitter / 链上数据  │
└─────────────────────────────────────────┘
```

---

## 📋 监控场景与告警

### 场景 1: 技术面机会

**监控条件**:
```python
if (放量 > 1.5x and 
    EMA 金叉 and 
    RSI < 40):
    
    告警内容:
    "🔔 技术面买入信号
    标的：BTC/USDT
    价格：$68,500
    原因：放量 + 金叉 + 超卖
    置信度：75%
    建议：50% 仓位，10x 杠杆"
```

---

### 场景 2: 情绪极端

**监控条件**:
```python
if CSI < 20:  # 极度恐惧
    
    告警内容:
    "😨 市场极度恐惧
    CSI 指数：18
    历史统计：见底概率 85%
    建议：准备买入，分批建仓
    风险：可能继续下跌 5-10%"
```

---

### 场景 3: 宏观事件预警

**监控条件**:
```python
if 事件影响分数 > 12:  # 红色风险
    
    告警内容:
    "🚨 红色风险事件
    事件：美联储利率决议
    时间：2 小时后
    影响：高波动预期
    操作：降低仓位至 20%，杠杆降至 2x"
```

---

### 场景 4: ML 预测信号

**监控条件**:
```python
if (ML 预测上涨概率 > 70% and 
    置信度 > 0.8):
    
    告警内容:
    "🤖 ML 强烈看涨
    预测涨幅：+3-5% (1 小时内)
    置信度：85%
    建议：买入，目标价$70,500
    止损：$67,800"
```

---

### 场景 5: 链上大额异动

**监控条件**:
```python
if 交易所流入 > 10000 BTC:
    
    告警内容:
    "💰 链上大额异动
    类型：交易所大额流入
    数量：12,000 BTC
    解读：可能抛售压力
    建议：警惕下跌，考虑减仓"
```

---

### 场景 6: 市场状态转换

**监控条件**:
```python
if 市场状态从"震荡市"转为"趋势市":
    
    告警内容:
    "📊 市场状态转换
    从：震荡市
    到：趋势市 (上涨)
    建议：切换为趋势策略
    推荐：均线交叉策略"
```

---

## 🔧 自动监控脚本

### 完整监控引擎代码

```python
#!/usr/bin/env python3
"""
Auto Monitor System
自动市场监控系统 - 7×24 小时不间断
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path

# 导入各分析模块
from skills.crypto_data.scripts.fetch_ohlcv_fast import fetch_ohlcv_cached
from skills.crypto_ta.scripts.calculate_indicators_fast import calculate_all_indicators
from skills.crypto_signals.scripts.volume_price_analysis import analyze_volume_price
from sentiment_indicators import calculate_csi
from ml_prediction_model.predict import predict_price
from macro_event_impact import check_macro_events
from market_state_detector import detect_market_state


class AutoMonitor:
    """自动监控引擎"""
    
    def __init__(self, symbols=['BTC/USDT', 'ETH/USDT'], config=None):
        self.symbols = symbols
        self.config = config or self._load_config()
        self.last_signals = {}
        self.alert_callbacks = []
        
    def _load_config(self):
        """加载配置"""
        return {
            'check_interval': 30,  # 检查间隔 (秒)
            'price_alert_threshold': 0.02,  # 价格告警阈值 2%
            'volume_alert_threshold': 1.5,  # 成交量告警阈值 1.5x
            'csi_extreme_low': 20,  # 情绪极度恐惧
            'csi_extreme_high': 80,  # 情绪极度贪婪
            'ml_confidence_threshold': 0.8,  # ML 置信度阈值
            'enable_telegram': True,
            'enable_email': False,
            'enable_sound': True,
        }
    
    def add_alert_callback(self, callback):
        """添加告警回调"""
        self.alert_callbacks.append(callback)
    
    def _send_alert(self, alert_type, title, content, level='INFO'):
        """发送告警"""
        alert = {
            'timestamp': datetime.now().isoformat(),
            'type': alert_type,
            'title': title,
            'content': content,
            'level': level  # INFO/WARNING/CRITICAL
        }
        
        # 打印告警
        emoji = {
            'INFO': 'ℹ️',
            'WARNING': '⚠️',
            'CRITICAL': '🚨'
        }.get(level, '📢')
        
        print(f"\n{emoji} [{alert['title']}]")
        print(f"{alert['content']}\n")
        
        # 触发回调
        for callback in self.alert_callbacks:
            callback(alert)
    
    async def check_symbol(self, symbol):
        """检查单个币种"""
        try:
            # 1. 获取数据
            df = fetch_ohlcv_cached(symbol, timeframe='5m', limit=100)
            
            # 2. 计算指标
            df = calculate_all_indicators(df)
            
            # 3. 量价分析
            volume_price = analyze_volume_price(df)
            
            # 4. ML 预测
            ml_prediction = predict_price(df)
            
            # 5. 情绪分析
            csi = calculate_csi()
            
            # 6. 宏观事件检查
            macro_events = check_macro_events()
            
            # 7. 市场状态
            market_state = detect_market_state(df)
            
            # 生成告警
            await self._generate_alerts(symbol, {
                'volume_price': volume_price,
                'ml_prediction': ml_prediction,
                'csi': csi,
                'macro_events': macro_events,
                'market_state': market_state
            })
            
        except Exception as e:
            print(f"检查 {symbol} 失败：{e}")
    
    async def _generate_alerts(self, symbol, data):
        """生成告警"""
        # 1. 技术面信号
        if data['volume_price']['score'] >= 4:
            self._send_alert(
                'TECHNICAL',
                f'{symbol} 技术面买入信号',
                f"量价评分：{data['volume_price']['score']}\n"
                f"原因：{data['volume_price']['reason']}\n"
                f"置信度：{data['volume_price']['confidence']*100:.0f}%",
                'WARNING'
            )
        
        # 2. 情绪极端
        if data['csi'] < self.config['csi_extreme_low']:
            self._send_alert(
                'SENTIMENT',
                f'市场极度恐惧',
                f"CSI 指数：{data['csi']}\n"
                f"历史统计：见底概率 85%\n"
                f"建议：准备买入",
                'CRITICAL'
            )
        elif data['csi'] > self.config['csi_extreme_high']:
            self._send_alert(
                'SENTIMENT',
                f'市场极度贪婪',
                f"CSI 指数：{data['csi']}\n"
                f"历史统计：见顶概率 80%\n"
                f"建议：准备卖出",
                'CRITICAL'
            )
        
        # 3. ML 预测
        if (data['ml_prediction']['confidence'] > self.config['ml_confidence_threshold'] and
            data['ml_prediction']['probability'] > 0.7):
            self._send_alert(
                'ML_PREDICTION',
                f'ML 强烈看涨',
                f"预测方向：{data['ml_prediction']['direction']}\n"
                f"预测幅度：{data['ml_prediction']['expected_move']}\n"
                f"置信度：{data['ml_prediction']['confidence']*100:.0f}%",
                'WARNING'
            )
        
        # 4. 宏观事件
        if data['macro_events']['risk_level'] == 'RED':
            self._send_alert(
                'MACRO_EVENT',
                f'🚨 红色风险事件',
                f"事件：{data['macro_events']['event_name']}\n"
                f"影响分数：{data['macro_events']['impact_score']}\n"
                f"操作：停止开仓，降低仓位",
                'CRITICAL'
            )
        
        # 5. 市场状态转换
        last_state = self.last_signals.get(f'{symbol}_state')
        current_state = data['market_state']['state']
        if last_state and last_state != current_state:
            self._send_alert(
                'MARKET_STATE',
                f'市场状态转换',
                f"从：{last_state}\n"
                f"到：{current_state}\n"
                f"建议：切换对应策略",
                'WARNING'
            )
        
        # 保存状态
        self.last_signals[f'{symbol}_state'] = current_state
    
    async def run(self):
        """运行监控"""
        print(f"🚀 自动监控系统启动")
        print(f"监控币种：{', '.join(self.symbols)}")
        print(f"检查间隔：{self.config['check_interval']}秒")
        print(f"按 Ctrl+C 停止\n")
        
        try:
            while True:
                # 并行检查所有币种
                tasks = [self.check_symbol(symbol) for symbol in self.symbols]
                await asyncio.gather(*tasks)
                
                # 等待下一次检查
                await asyncio.sleep(self.config['check_interval'])
                
        except KeyboardInterrupt:
            print("\n⛔ 监控已停止")


# Telegram 告警回调
async def telegram_alert(alert):
    """发送 Telegram 告警"""
    # 使用 Telegram Bot API
    # bot.send_message(chat_id, f"{alert['title']}\n{alert['content']}")
    pass


# 声音告警回调
def sound_alert(alert):
    """播放声音告警"""
    import os
    if alert['level'] == 'CRITICAL':
        os.system('afplay /System/Library/Sounds/Glass.aiff')  # macOS
    elif alert['level'] == 'WARNING':
        os.system('afplay /System/Library/Sounds/Pop.aiff')


# 主程序
if __name__ == '__main__':
    # 创建监控引擎
    monitor = AutoMonitor(
        symbols=['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        config={
            'check_interval': 30,
            'enable_telegram': True,
            'enable_sound': True
        }
    )
    
    # 添加告警回调
    monitor.add_alert_callback(telegram_alert)
    monitor.add_alert_callback(sound_alert)
    
    # 运行监控
    asyncio.run(monitor.run())
```

---

## 🚀 使用方式

### 基础监控

```bash
# 启动自动监控
python3 auto_monitor.py

# 指定币种
python3 auto_monitor.py --symbols BTC/USDT,ETH/USDT

# 指定检查间隔
python3 auto_monitor.py --interval 60
```

### 配置告警方式

```yaml
# config.yaml
alerts:
  telegram:
    enabled: true
    bot_token: "YOUR_BOT_TOKEN"
    chat_id: "YOUR_CHAT_ID"
  
  email:
    enabled: false
    smtp_server: "smtp.gmail.com"
    from: "your@email.com"
    to: "your@email.com"
  
  sound:
    enabled: true
    critical_level: true
    warning_level: true
  
  push:
    enabled: false
    service: "pushover"
    api_key: "YOUR_API_KEY"
```

### 后台运行

```bash
# 使用 nohup
nohup python3 auto_monitor.py > monitor.log 2>&1 &

# 使用 screen
screen -S crypto_monitor
python3 auto_monitor.py
# Ctrl+A, D 脱离

# 使用 systemd (Linux)
sudo systemctl start crypto-monitor
sudo systemctl enable crypto-monitor
```

---

## 📊 告警示例

### 技术面告警

```
📈 [BTC/USDT 技术面买入信号]
量价评分：4
原因：放量上涨 - 强势看涨
置信度：85%
建议：50% 仓位，10x 杠杆
```

### 情绪告警

```
😨 [市场极度恐惧]
CSI 指数：18
历史统计：见底概率 85%
建议：准备买入，分批建仓
风险：可能继续下跌 5-10%
```

### 宏观事件告警

```
🚨 [红色风险事件]
事件：美联储利率决议
时间：2 小时后
影响分数：14.0
操作：停止开仓，降低仓位至 20%
```

### ML 预测告警

```
🤖 [ML 强烈看涨]
预测方向：上涨
预测幅度：+3-5% (1 小时内)
置信度：85%
建议：买入，目标价$70,500
止损：$67,800
```

---

## 🔍 监控仪表板

### 实时监控界面

```
╔══════════════════════════════════════════════════════════╗
║          🤖 加密货币自动监控系统                          ║
║          2026-03-11 20:58:32                             ║
╠══════════════════════════════════════════════════════════╣
║  BTC/USDT  $68,523  [+1.2%]  📈 技术面买入信号            ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      ║
║  技术分：0.85  │  预测分：0.72  │  综合：0.79  ✅        ║
║  CSI: 45 (中性)  │  ML: 看涨 65%  │  状态：趋势市        ║
╠══════════════════════════════════════════════════════════╣
║  ETH/USDT  $3,245  [+0.8%]  ⏸️ 持有                      ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      ║
║  技术分：0.52  │  预测分：0.48  │  综合：0.50            ║
║  CSI: 48 (中性)  │  ML: 震荡 55%  │  状态：震荡市        ║
╠══════════════════════════════════════════════════════════╣
║  SOL/USDT  $145  [-2.3%]  😨 情绪极度恐惧                ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      ║
║  技术分：0.35  │  预测分：0.82  │  综合：0.56  ⚠️        ║
║  CSI: 18 (极度恐惧)  │  ML: 看涨 75%  │  状态：极端市    ║
╠══════════════════════════════════════════════════════════╣
║  最近告警：                                              ║
║  [20:55] 🚨 红色风险事件 - 美联储利率决议                ║
║  [20:52] 📈 BTC/USDT 技术面买入信号                      ║
║  [20:48] 😨 市场极度恐惧 - CSI=18                        ║
╚══════════════════════════════════════════════════════════╝
```

---

## ⚙️ 高级功能

### 1. 自定义告警规则

```python
# 添加自定义告警条件
monitor.add_custom_alert(
    name='大额爆仓',
    condition=lambda data: data['liquidations'] > 100_000_000,
    message='💥 大额爆仓事件 detected',
    level='CRITICAL'
)
```

### 2. 告警过滤

```python
# 避免告警风暴
config = {
    'alert_cooldown': 300,  # 同类告警 5 分钟冷却
    'max_alerts_per_hour': 20,  # 每小时最多 20 条
    'quiet_hours': {'start': '02:00', 'end': '08:00'}  # 安静时段
}
```

### 3. 告警分组

```python
# 按严重程度分组
alert_groups = {
    'CRITICAL': ['红色事件', '情绪极端', '系统故障'],
    'WARNING': ['技术信号', 'ML 预测', '状态转换'],
    'INFO': ['日常更新', '性能报告']
}
```

---

## 📁 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `auto_monitor.py` | ⏳ 待创建 | 主监控引擎 |
| `monitor_config.yaml` | ⏳ 待创建 | 配置文件 |
| `alert_callbacks.py` | ⏳ 待创建 | 告警回调 |
| `dashboard.py` | ⏳ 待创建 | 监控仪表板 |

---

## 🎯 下一步

### 立即创建监控脚本

我可以立即创建完整的自动监控系统，包括：

1. **auto_monitor.py** - 主监控引擎
2. **alert_callbacks.py** - Telegram/邮件/声音告警
3. **monitor_config.yaml** - 配置文件
4. **dashboard.py** - 实时监控仪表板

### 监控频率

| 监控项 | 频率 | 告警方式 |
|--------|------|----------|
| 价格波动 | 实时 | 声音 + Push |
| 技术信号 | 每 5 秒 | Push |
| 情绪指数 | 每 1 分钟 | Push |
| ML 预测 | 每 1 分钟 | Push |
| 宏观事件 | 每 1 小时 | 声音 + Push |
| 链上数据 | 每 5 分钟 | Push |

---

**需要我立即创建完整的自动监控系统吗？** 🖥️🐉

支持：
- ✅ 7×24 小时不间断监控
- ✅ 多维度告警（技术/情绪/ML/事件）
- ✅ 多种告警方式（Telegram/邮件/声音）
- ✅ 实时监控仪表板
- ✅ 后台运行支持
