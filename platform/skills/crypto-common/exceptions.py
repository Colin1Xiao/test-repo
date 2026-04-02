#!/usr/bin/env python3
"""
Custom Exceptions
自定义异常类
"""


class CryptoAPIError(Exception):
    """API 相关错误"""
    pass


class CryptoNetworkError(Exception):
    """网络相关错误"""
    pass


class CryptoRateLimitError(CryptoAPIError):
    """速率限制错误"""
    pass


class CryptoAuthenticationError(CryptoAPIError):
    """认证错误"""
    pass


class CryptoInsufficientBalanceError(CryptoAPIError):
    """余额不足错误"""
    pass


class CryptoOrderError(CryptoAPIError):
    """订单错误"""
    pass
