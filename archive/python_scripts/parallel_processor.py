#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
并行处理系统
同时分析多个标的，提升速度
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import json

class ParallelProcessor:
    """并行处理器"""
    
    def __init__(self, max_workers=5):
        """
        初始化并行处理器
        
        Args:
            max_workers: 最大线程数，默认 5
        """
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
    
    def process_symbols(self, symbols, process_func, timeout=30):
        """
        并行处理多个标的
        
        Args:
            symbols: 标的列表
            process_func: 处理函数 (接收 symbol 参数)
            timeout: 超时时间 (秒)
        
        Returns:
            结果字典 {symbol: result}
        """
        results = {}
        
        # 提交所有任务
        future_to_symbol = {
            self.executor.submit(process_func, symbol): symbol
            for symbol in symbols
        }
        
        # 收集结果
        for future in as_completed(future_to_symbol, timeout=timeout):
            symbol = future_to_symbol[future]
            try:
                result = future.result()
                results[symbol] = {
                    'success': True,
                    'data': result,
                    'timestamp': datetime.now().isoformat()
                }
            except Exception as e:
                results[symbol] = {
                    'success': False,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }
        
        return results
    
    def analyze_multiple(self, symbols, analyzer_func):
        """
        并行分析多个标的
        
        Args:
            symbols: 标的列表
            analyzer_func: 分析函数
        
        Returns:
            分析结果列表
        """
        results = []
        
        def analyze_wrapper(symbol):
            try:
                result = analyzer_func(symbol)
                return {
                    'symbol': symbol,
                    'success': True,
                    'data': result
                }
            except Exception as e:
                return {
                    'symbol': symbol,
                    'success': False,
                    'error': str(e)
                }
        
        # 并行执行
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            results = list(executor.map(analyze_wrapper, symbols))
        
        return results
    
    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=False)

# 示例：并行获取行情
def fetch_ticker_example(symbol):
    """示例：获取行情"""
    from okx_api_client import OKXClient
    client = OKXClient()
    result = client.fetch_ticker(symbol)
    return result

# 示例：并行分析
def analyze_symbol_example(symbol):
    """示例：分析标的"""
    from okx_api_client import OKXClient
    client = OKXClient()
    
    # 获取 K 线
    ohlcv = client.fetch_ohlcv(symbol, '5m', 20)
    
    # 简单分析
    if ohlcv['success']:
        candles = ohlcv['data']
        first_price = float(candles[-1][4])
        last_price = float(candles[0][4])
        change = (last_price - first_price) / first_price * 100
        
        return {
            'price': last_price,
            'change': change,
            'signal': 'BUY' if change > 0 else 'SELL'
        }
    else:
        return {'error': ohlcv['error']}

if __name__ == '__main__':
    print("🚀 测试并行处理系统...")
    
    symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT']
    
    print(f"\n📊 并行分析 {len(symbols)} 个标的...")
    print(f"   线程数：5")
    print()
    
    processor = ParallelProcessor(max_workers=5)
    
    # 测试并行分析
    start_time = datetime.now()
    results = processor.analyze_multiple(symbols, analyze_symbol_example)
    end_time = datetime.now()
    
    elapsed = (end_time - start_time).total_seconds()
    
    print(f"⏱️  耗时：{elapsed:.2f}秒")
    print(f"   平均：{elapsed/len(symbols):.2f}秒/标的")
    print()
    
    print("📊 分析结果:")
    for result in results:
        if result['success']:
            data = result['data']
            print(f"   ✅ {result['symbol']}: ${data['price']:,.2f} ({data['change']:+.2f}%) → {data['signal']}")
        else:
            print(f"   ❌ {result['symbol']}: {result['error']}")
    
    print()
    print("✅ 并行处理系统测试完成！")
    
    processor.shutdown()
