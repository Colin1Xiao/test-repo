#!/usr/bin/env python3
"""
加密货币交易策略回测示例
双均线交叉策略 + RSI 策略

注意：这是学习用途的示例代码，不用于真实交易
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# 检查依赖
try:
    import pandas_ta as ta
    HAS_TA = True
except ImportError:
    HAS_TA = False
    print("提示：安装 pandas-ta 可获得更好的技术指标支持")
    print("pip install pandas-ta")

try:
    import vectorbt as vbt
    HAS_VBT = True
except ImportError:
    HAS_VBT = False
    print("提示：安装 vectorbt 可进行专业回测")
    print("pip install vectorbt")


def generate_sample_data(days=365, timeframe='1h'):
    """
    生成模拟的 BTC/USDT 价格数据
    实际使用时应从交易所 API 获取真实数据
    """
    np.random.seed(42)  # 可重现结果
    
    # 生成时间序列
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    if timeframe == '1h':
        dates = pd.date_range(start=start_date, end=end_date, freq='1h')
    else:
        dates = pd.date_range(start=start_date, end=end_date, freq='1d')
    
    n = len(dates)
    
    # 模拟价格（随机游走 + 趋势）
    base_price = 30000  # 基础价格
    trend = np.linspace(0, 0.5, n)  # 长期上涨趋势
    noise = np.cumsum(np.random.randn(n) * 0.02)  # 随机波动
    
    close = base_price * (1 + trend + noise)
    
    # 生成 OHLCV 数据
    data = pd.DataFrame(index=dates)
    data['open'] = close * (1 + np.random.randn(n) * 0.005)
    data['high'] = close * (1 + np.abs(np.random.randn(n) * 0.01))
    data['low'] = close * (1 - np.abs(np.random.randn(n) * 0.01))
    data['close'] = close
    data['volume'] = np.random.uniform(1000, 10000, n)
    
    return data


def calculate_indicators(data):
    """
    计算技术指标
    """
    df = data.copy()
    
    if HAS_TA:
        # 使用 pandas-ta 计算
        df['MA20'] = ta.sma(df['close'], length=20)
        df['MA50'] = ta.sma(df['close'], length=50)
        df['RSI'] = ta.rsi(df['close'], length=14)
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        df['MACD'] = macd['MACD_12_26_9']
        df['MACD_signal'] = macd['MACDs_12_26_9']
        
        # 布林带
        bbands = ta.bbands(df['close'], length=20, std=2)
        df['BB_upper'] = bbands['BBU_20_2.0']
        df['BB_middle'] = bbands['BBM_20_2.0']
        df['BB_lower'] = bbands['BBL_20_2.0']
    else:
        # 简单实现
        df['MA20'] = df['close'].rolling(20).mean()
        df['MA50'] = df['close'].rolling(50).mean()
        
        # 简单 RSI 实现
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
    
    return df


def ma_cross_strategy(data, short_period=20, long_period=50):
    """
    双均线交叉策略
    
    入场:
    - 做多：短期均线上穿长期均线
    - 做空：短期均线下穿长期均线
    
    出场:
    - 反向交叉时平仓
    """
    df = data.copy()
    
    # 计算均线
    df['MA_short'] = df['close'].rolling(short_period).mean()
    df['MA_long'] = df['close'].rolling(long_period).mean()
    
    # 生成交叉信号
    df['cross_up'] = (df['MA_short'] > df['MA_long']) & \
                     (df['MA_short'].shift(1) <= df['MA_long'].shift(1))
    df['cross_down'] = (df['MA_short'] < df['MA_long']) & \
                       (df['MA_short'].shift(1) >= df['MA_long'].shift(1))
    
    # 持仓状态
    df['position'] = 0
    position = 0
    
    for i in range(len(df)):
        if df['cross_up'].iloc[i] and position <= 0:
            position = 1  # 做多
        elif df['cross_down'].iloc[i] and position >= 0:
            position = -1  # 做空
        df['position'].iloc[i] = position
    
    # 计算收益
    df['returns'] = df['close'].pct_change()
    df['strategy_returns'] = df['position'].shift(1) * df['returns']
    
    # 累计收益
    df['cumulative_returns'] = (1 + df['returns']).cumprod()
    df['cumulative_strategy'] = (1 + df['strategy_returns']).cumprod()
    
    return df


def rsi_strategy(data, rsi_period=14, oversold=30, overbought=70):
    """
    RSI 超买超卖策略
    
    入场:
    - 做多：RSI < 30 (超卖)
    - 做空：RSI > 70 (超买)
    
    出场:
    - RSI 回归 50 中性区域
    """
    df = data.copy()
    
    # 计算 RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(rsi_period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(rsi_period).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # 生成信号
    df['oversold'] = df['RSI'] < oversold
    df['overbought'] = df['RSI'] > overbought
    df['neutral'] = (df['RSI'] >= 40) & (df['RSI'] <= 60)
    
    # 持仓状态
    df['position'] = 0
    position = 0
    
    for i in range(len(df)):
        if df['oversold'].iloc[i] and position <= 0:
            position = 1  # 做多
        elif df['overbought'].iloc[i] and position >= 0:
            position = -1  # 做空
        elif df['neutral'].iloc[i]:
            position = 0  # 平仓
        
        df['position'].iloc[i] = position
    
    # 计算收益
    df['returns'] = df['close'].pct_change()
    df['strategy_returns'] = df['position'].shift(1) * df['returns']
    
    # 累计收益
    df['cumulative_returns'] = (1 + df['returns']).cumprod()
    df['cumulative_strategy'] = (1 + df['strategy_returns']).cumprod()
    
    return df


def calculate_metrics(df, strategy_col='strategy_returns'):
    """
    计算策略绩效指标
    """
    returns = df[strategy_col].dropna()
    
    # 基础指标
    total_return = (1 + returns).prod() - 1
    n_days = len(returns) / 24  # 假设小时数据
    annual_return = (1 + total_return) ** (365 / n_days) - 1 if n_days > 0 else 0
    
    # 胜率
    trades = (df['position'].diff() != 0).sum()
    winning_trades = (returns > 0).sum()
    win_rate = winning_trades / len(returns[returns != 0]) if len(returns[returns != 0]) > 0 else 0
    
    # 波动性和风险
    volatility = returns.std() * np.sqrt(365 * 24)  # 年化波动率
    max_drawdown = ((1 + returns).cumprod().cummax() - (1 + returns).cumprod()).max()
    
    # Sharpe 比率 (假设无风险利率为 0)
    sharpe = annual_return / volatility if volatility > 0 else 0
    
    metrics = {
        '总收益率': f'{total_return:.2%}',
        '年化收益率': f'{annual_return:.2%}',
        '交易次数': int(trades),
        '胜率': f'{win_rate:.2%}',
        '年化波动率': f'{volatility:.2%}',
        '最大回撤': f'{max_drawdown:.2%}',
        'Sharpe 比率': f'{sharpe:.2f}',
    }
    
    return metrics


def print_report(strategy_name, metrics):
    """
    打印回测报告
    """
    print("\n" + "=" * 60)
    print(f"📊 {strategy_name} 回测报告")
    print("=" * 60)
    
    for key, value in metrics.items():
        print(f"{key:15} : {value}")
    
    print("=" * 60)


def main():
    """
    主函数：运行回测
    """
    print("🐉 加密货币交易策略回测系统")
    print("=" * 60)
    
    # 生成模拟数据
    print("\n📈 生成模拟数据 (365 天，1 小时 K 线)...")
    data = generate_sample_data(days=365, timeframe='1h')
    print(f"   数据范围：{data.index[0]} 至 {data.index[-1]}")
    print(f"   数据点数：{len(data)}")
    print(f"   价格范围：${data['close'].min():.2f} - ${data['close'].max():.2f}")
    
    # 计算技术指标
    print("\n🔧 计算技术指标...")
    data = calculate_indicators(data)
    print("   已计算：MA20, MA50, RSI, MACD, 布林带")
    
    # 运行双均线策略
    print("\n📉 运行双均线交叉策略 (MA20/MA50)...")
    ma_data = ma_cross_strategy(data)
    ma_metrics = calculate_metrics(ma_data)
    print_report("双均线交叉策略", ma_metrics)
    
    # 运行 RSI 策略
    print("\n📈 运行 RSI 超买超卖策略 (RSI 14, 30/70)...")
    rsi_data = rsi_strategy(data)
    rsi_metrics = calculate_metrics(rsi_data)
    print_report("RSI 超买超卖策略", rsi_metrics)
    
    # 对比报告
    print("\n📊 策略对比")
    print("=" * 60)
    print(f"{'指标':15} | {'双均线':12} | {'RSI':12}")
    print("-" * 60)
    for key in ma_metrics.keys():
        ma_val = ma_metrics[key]
        rsi_val = rsi_metrics[key]
        print(f"{key:15} | {ma_val:12} | {rsi_val:12}")
    print("=" * 60)
    
    # 保存结果
    output_file = '/Users/colin/.openclaw/workspace/research/backtest_results.csv'
    ma_data.to_csv(output_file)
    print(f"\n💾 回测结果已保存至：{output_file}")
    
    print("\n⚠️  免责声明:")
    print("   - 本回测使用模拟数据，不代表真实市场表现")
    print("   - 历史表现不代表未来收益")
    print("   - 仅供学习研究，不构成投资建议")
    print("   - 加密货币交易风险极高，请谨慎参与")
    
    return ma_data, rsi_data


if __name__ == '__main__':
    main()
