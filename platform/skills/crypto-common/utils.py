#!/usr/bin/env python3
"""
Utility Functions
通用工具函数
"""

from datetime import datetime


def format_price(price, symbol='USDT', decimals=2):
    """
    格式化价格显示
    
    Args:
        price: 价格
        symbol: 货币符号
        decimals: 小数位数
    
    Returns:
        str: 格式化后的价格字符串
    """
    if price is None:
        return 'N/A'
    
    try:
        price_float = float(price)
        if price_float >= 1000:
            return f"{price_float:,.{decimals}f} {symbol}"
        elif price_float >= 1:
            return f"{price_float:.{decimals}f} {symbol}"
        else:
            return f"{price_float:.6f} {symbol}"
    except (ValueError, TypeError):
        return str(price)


def format_volume(volume, decimals=2):
    """
    格式化成交量显示
    
    Args:
        volume: 成交量
        decimals: 小数位数
    
    Returns:
        str: 格式化后的成交量字符串
    """
    if volume is None:
        return 'N/A'
    
    try:
        volume_float = float(volume)
        if volume_float >= 1_000_000:
            return f"{volume_float / 1_000_000:.{decimals}f}M"
        elif volume_float >= 1_000:
            return f"{volume_float / 1_000:.{decimals}f}K"
        else:
            return f"{volume_float:.{decimals}f}"
    except (ValueError, TypeError):
        return str(volume)


def format_timestamp(timestamp_ms):
    """
    格式化时间戳
    
    Args:
        timestamp_ms: 毫秒时间戳
    
    Returns:
        str: 格式化后的时间字符串
    """
    if timestamp_ms is None:
        return 'N/A'
    
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError, OSError):
        return str(timestamp_ms)


def calculate_pnl(entry_price, exit_price, size, leverage, side='long'):
    """
    计算盈亏
    
    Args:
        entry_price: 入场价格
        exit_price: 出场价格
        size: 仓位大小 (USDT)
        leverage: 杠杆倍数
        side: 'long' 或 'short'
    
    Returns:
        dict: 盈亏信息
    """
    if side == 'long':
        pnl_pct = (exit_price - entry_price) / entry_price
    else:
        pnl_pct = (entry_price - exit_price) / entry_price
    
    pnl = size * pnl_pct * leverage
    
    return {
        'pnl': pnl,
        'pnl_pct': pnl_pct * 100,
        'entry_price': entry_price,
        'exit_price': exit_price,
        'side': side
    }


def parse_symbol(symbol):
    """
    解析交易对符号
    
    Args:
        symbol: 交易对 (e.g., "BTC/USDT", "BTCUSDT")
    
    Returns:
        dict: 解析结果
    """
    if '/' in symbol:
        base, quote = symbol.split('/')
    elif 'USDT' in symbol:
        base = symbol.replace('USDT', '')
        quote = 'USDT'
    elif 'USD' in symbol:
        base = symbol.replace('USD', '')
        quote = 'USD'
    else:
        base = symbol
        quote = 'USDT'
    
    return {
        'base': base.upper(),
        'quote': quote.upper(),
        'symbol': f"{base.upper()}/{quote.upper()}"
    }
