#!/usr/bin/env python3
"""
计算两个数的最大公约数（GCD - Greatest Common Divisor）
使用欧几里得算法（辗转相除法）
"""


def gcd(a: int, b: int) -> int:
    """
    计算两个整数的最大公约数
    
    Args:
        a: 第一个整数
        b: 第二个整数
    
    Returns:
        两个数的最大公约数
    
    Examples:
        >>> gcd(48, 18)
        6
        >>> gcd(100, 25)
        25
        >>> gcd(17, 13)
        1
    """
    # 处理负数，取绝对值
    a, b = abs(a), abs(b)
    
    # 欧几里得算法
    while b != 0:
        a, b = b, a % b
    
    return a


def gcd_recursive(a: int, b: int) -> int:
    """
    计算两个整数的最大公约数（递归版本）
    
    Args:
        a: 第一个整数
        b: 第二个整数
    
    Returns:
        两个数的最大公约数
    """
    a, b = abs(a), abs(b)
    
    if b == 0:
        return a
    
    return gcd_recursive(b, a % b)


if __name__ == "__main__":
    # 测试示例
    test_cases = [
        (48, 18),
        (100, 25),
        (17, 13),
        (0, 5),
        (21, 0),
        (-48, 18),
        (48, -18),
    ]
    
    print("最大公约数计算测试：")
    print("-" * 40)
    
    for a, b in test_cases:
        result = gcd(a, b)
        print(f"gcd({a:4d}, {b:4d}) = {result}")
    
    print("-" * 40)
    print("测试完成 ✓")
