#!/usr/bin/env python3
"""
Exchange Connection Manager
统一交易所连接管理
"""

import sys

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 ccxt - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt", file=sys.stderr)
    sys.exit(1)


def init_exchange(config):
    """
    初始化交易所连接
    
    Args:
        config: 配置字典（来自 load_config）
    
    Returns:
        ccxt.Exchange: 交易所实例
    
    Raises:
        ValueError: 不支持的交易所
        ccxt.AuthenticationError: API 密钥无效
        ccxt.NetworkError: 网络错误
    """
    exchange_id = config.get('exchange', 'okx').lower()
    
    # 获取交易所类
    exchange_class = getattr(ccxt, exchange_id, None)
    if not exchange_class:
        raise ValueError(f"不支持的交易所：{exchange_id}\n支持的交易所：okx, binance, bybit, gateio")
    
    # 构建配置
    exchange_config = {
        'enableRateLimit': config.get('enableRateLimit', True),
        'timeout': config.get('timeout', 30000),  # 30 秒超时
        'options': {
            'defaultType': 'future',  # 合约交易
        }
    }
    
    # API 密钥（可选）
    if config.get('apiKey'):
        exchange_config['apiKey'] = config['apiKey']
        exchange_config['secret'] = config.get('secret', '')
        if config.get('password'):
            exchange_config['password'] = config['password']
    
    # 创建交易所实例
    exchange = exchange_class(exchange_config)
    
    # 测试网模式
    if config.get('testnet', False):
        if exchange_id == 'okx':
            exchange.set_sandbox_mode(True)
            print("ℹ️  OKX 测试网模式已启用")
        elif exchange_id == 'binance':
            # 币安测试网
            exchange.urls['api'] = {
                'public': 'https://testnet.binancefuture.com/fapi/v1',
                'private': 'https://testnet.binancefuture.com/fapi/v1',
            }
            print("ℹ️  币安测试网模式已启用")
        elif exchange_id == 'bybit':
            exchange.set_sandbox_mode(True)
            print("ℹ️  Bybit 测试网模式已启用")
    
    # 验证连接
    try:
        # 尝试加载市场数据
        exchange.load_markets()
    except ccxt.AuthenticationError as e:
        print(f"错误：API 密钥认证失败 - {e}", file=sys.stderr)
        print("请检查配置文件中的 apiKey, secret, password 是否正确", file=sys.stderr)
        raise
    except ccxt.NetworkError as e:
        print(f"警告：网络连接失败 - {e}", file=sys.stderr)
        print("可能原因：防火墙限制、交易所 API 不可用", file=sys.stderr)
        # 不抛出异常，允许继续（可能只是公共数据请求）
    except Exception as e:
        print(f"警告：加载市场数据失败 - {e}", file=sys.stderr)
    
    return exchange


def test_connection(exchange):
    """
    测试交易所连接
    
    Args:
        exchange: 交易所实例
    
    Returns:
        dict: 连接测试结果
    """
    result = {
        'connected': False,
        'api_working': False,
        'balance_accessible': False,
        'errors': []
    }
    
    try:
        # 测试公共 API
        ticker = exchange.fetch_ticker('BTC/USDT')
        result['api_working'] = True
        result['connected'] = True
    except Exception as e:
        result['errors'].append(f"公共 API 测试失败：{e}")
    
    # 测试私有 API（如果有密钥）
    if exchange.apiKey:
        try:
            balance = exchange.fetch_balance()
            result['balance_accessible'] = True
        except Exception as e:
            result['errors'].append(f"账户 API 测试失败：{e}")
    
    return result
