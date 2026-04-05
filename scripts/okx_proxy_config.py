"""
OKX API 代理配置模块
用于解决 DNS 污染问题，确保交易系统稳定连接

使用方式:
    from okx_proxy_config import OKXProxyConfig, get_session_with_proxy
    
    # 方法 1: 获取配置
    config = OKXProxyConfig()
    print(f"代理：{config.proxy_url}")
    
    # 方法 2: 获取带代理的 Session
    session = get_session_with_proxy()
    response = session.get("https://www.okx.com/api/v5/public/time")
    
    # 方法 3: 测试连接
    if config.test_connection():
        print("OKX 连接正常")

最后更新：2026-04-03
"""

import os
import urllib.request
import json
from typing import Optional, Dict
from dataclasses import dataclass


@dataclass
class OKXProxyConfig:
    """OKX 代理配置类"""
    
    # 代理配置 (ClashX 默认)
    proxy_http: str = "http://127.0.0.1:7890"
    proxy_https: str = "http://127.0.0.1:7890"
    proxy_socks5: str = "socks5://127.0.0.1:7891"
    
    # OKX API 端点
    api_base: str = "https://www.okx.com"
    api_ws: str = "wss://ws.okx.com:8443/ws/v5"
    api_backup: str = "https://okx.com"
    
    # 超时配置 (秒)
    connect_timeout: int = 5
    read_timeout: int = 10
    
    # 重试配置
    max_retries: int = 3
    retry_delay: int = 1
    
    # 是否使用代理
    use_proxy: bool = True
    
    def __post_init__(self):
        """从环境变量加载配置"""
        self.proxy_http = os.getenv("OKX_PROXY_HTTP", self.proxy_http)
        self.proxy_https = os.getenv("OKX_PROXY_HTTPS", self.proxy_https)
        self.proxy_socks5 = os.getenv("OKX_PROXY_SOCKS5", self.proxy_socks5)
        self.api_base = os.getenv("OKX_API_BASE", self.api_base)
        self.api_backup = os.getenv("OKX_API_BASE_BACKUP", self.api_backup)
        self.connect_timeout = int(os.getenv("OKX_CONNECT_TIMEOUT", self.connect_timeout))
        self.read_timeout = int(os.getenv("OKX_READ_TIMEOUT", self.read_timeout))
        self.max_retries = int(os.getenv("OKX_MAX_RETRIES", self.max_retries))
        self.retry_delay = int(os.getenv("OKX_RETRY_DELAY", self.retry_delay))
        self.use_proxy = os.getenv("OKX_USE_PROXY", "true").lower() == "true"
    
    @property
    def proxy_url(self) -> str:
        """获取代理 URL"""
        return self.proxy_https
    
    @property
    def proxies(self) -> Dict[str, str]:
        """获取代理字典"""
        return {
            "http": self.proxy_http,
            "https": self.proxy_https,
        }
    
    def get_opener(self) -> urllib.request.OpenerDirector:
        """获取带代理的 opener"""
        if self.use_proxy:
            proxy = urllib.request.ProxyHandler(self.proxies)
            opener = urllib.request.build_opener(proxy)
        else:
            opener = urllib.request.build_opener()
        
        # 设置超时
        opener.addheaders = [('User-Agent', 'OKX-Trading-System/5.4')]
        return opener
    
    def test_connection(self, verbose: bool = True) -> bool:
        """测试 OKX 连接"""
        url = f"{self.api_base}/api/v5/public/time"
        
        try:
            opener = self.get_opener()
            req = urllib.request.Request(url)
            response = opener.open(req, timeout=self.connect_timeout)
            data = json.loads(response.read().decode())
            
            if data.get('code') == '0':
                ts = data.get('data', [{}])[0].get('ts', '未知')
                if verbose:
                    print(f"✅ OKX 连接成功 - 服务器时间：{ts}")
                return True
            else:
                if verbose:
                    print(f"⚠️ OKX API 返回错误：{data.get('code')}")
                return False
                
        except Exception as e:
            if verbose:
                print(f"❌ OKX 连接失败：{e}")
            return False
    
    def test_backup(self, verbose: bool = True) -> bool:
        """测试备用端点"""
        url = f"{self.api_backup}/api/v5/public/time"
        
        try:
            opener = self.get_opener()
            req = urllib.request.Request(url)
            response = opener.open(req, timeout=self.connect_timeout)
            data = json.loads(response.read().decode())
            
            if data.get('code') == '0':
                ts = data.get('data', [{}])[0].get('ts', '未知')
                if verbose:
                    print(f"✅ OKX 备用端点连接成功 - 服务器时间：{ts}")
                return True
            return False
            
        except Exception as e:
            if verbose:
                print(f"❌ OKX 备用端点连接失败：{e}")
            return False
    
    def diagnose(self) -> Dict:
        """诊断连接问题"""
        result = {
            "proxy_configured": self.use_proxy,
            "proxy_url": self.proxy_url if self.use_proxy else None,
            "api_base": self.api_base,
            "api_backup": self.api_backup,
            "main_endpoint": "未知",
            "backup_endpoint": "未知",
        }
        
        # 测试主端点
        result["main_endpoint"] = "✅ 正常" if self.test_connection(verbose=False) else "❌ 失败"
        
        # 测试备用端点
        result["backup_endpoint"] = "✅ 正常" if self.test_backup(verbose=False) else "❌ 失败"
        
        return result


def get_session_with_proxy():
    """
    获取带代理的 Session (用于 requests 库)
    
    使用方式:
        session = get_session_with_proxy()
        response = session.get("https://www.okx.com/api/v5/public/time")
    """
    try:
        import requests
    except ImportError:
        raise ImportError("需要安装 requests 库：pip install requests")
    
    config = OKXProxyConfig()
    
    if config.use_proxy:
        session = requests.Session()
        session.proxies.update(config.proxies)
    else:
        session = requests.Session()
    
    # 设置超时
    session.timeout = (config.connect_timeout, config.read_timeout)
    
    return session


def apply_proxy_to_urllib():
    """
    将代理应用到 urllib 全局配置
    
    使用方式:
        apply_proxy_to_urllib()
        # 之后所有 urllib.request.urlopen 都会使用代理
    """
    config = OKXProxyConfig()
    
    if config.use_proxy:
        proxy = urllib.request.ProxyHandler(config.proxies)
        opener = urllib.request.build_opener(proxy)
        urllib.request.install_opener(opener)


# 模块级默认配置
default_config = OKXProxyConfig()


if __name__ == "__main__":
    print("=" * 60)
    print("OKX 代理配置诊断")
    print("=" * 60)
    
    config = OKXProxyConfig()
    
    print(f"\n代理配置：{config.use_proxy}")
    print(f"代理地址：{config.proxy_url}")
    print(f"API 端点：{config.api_base}")
    print(f"备用端点：{config.api_backup}")
    
    print("\n" + "=" * 60)
    print("连接测试")
    print("=" * 60)
    
    config.test_connection()
    config.test_backup()
    
    print("\n" + "=" * 60)
    print("诊断结果")
    print("=" * 60)
    
    result = config.diagnose()
    for key, value in result.items():
        print(f"{key}: {value}")
