"""
OKX Trade Client - 真实 HTTP 请求实现

使用 requests 库进行真实的 API 调用
"""

import hashlib
import hmac
import base64
import time
import requests
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from schemas.enums import Side, OrderType, OrderStatus, PositionSide


class OKXEnv(Enum):
    """OKX 环境"""
    LIVE = "https://www.okx.com"
    TESTNET = "https://www.okx.com"  # Testnet 使用相同域名，通过 header 区分


@dataclass
class OKXConfig:
    """OKX 配置"""
    api_key: str
    secret_key: str
    passphrase: str
    environment: OKXEnv = OKXEnv.TESTNET
    timeout_seconds: float = 10.0
    max_retries: int = 3
    rate_limit_per_second: int = 10


class OKXTradeClientReal:
    """OKX 交易客户端 (真实 HTTP 请求)"""
    
    def __init__(self, config: OKXConfig):
        self.config = config
        self._base_url = config.environment.value
        self._session = requests.Session()
        self._last_request_time: float = 0
        self._connected = False
        self._account_id: Optional[str] = None
        
        # 测试网需要特殊 header
        self._is_testnet = (config.environment == OKXEnv.TESTNET)
    
    def connect(self) -> bool:
        """连接到 OKX"""
        try:
            # 验证 API Key - 获取账户信息
            response = self._request("GET", "/api/v5/account/config")
            
            if response.get("code") == "0":
                self._connected = True
                data = response.get("data", [{}])[0]
                self._account_id = data.get("acctLv", "unknown")
                print(f"[OKX] 连接成功 - 账户等级：{self._account_id}")
                return True
            else:
                error_msg = response.get("msg", "Unknown error")
                print(f"[OKX] 连接失败：{error_msg}")
                return False
            
        except Exception as e:
            print(f"[OKX] 连接异常：{e}")
            return False
    
    def disconnect(self) -> None:
        """断开连接"""
        self._connected = False
        self._session.close()
    
    def is_connected(self) -> bool:
        """是否已连接"""
        return self._connected
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """发送 HTTP 请求"""
        # 速率限制
        self._enforce_rate_limit()
        
        # 构建请求
        url = self._base_url + endpoint
        
        # 准备请求体
        body = ""
        if data:
            import json
            body = json.dumps(data)
        
        # 生成签名
        timestamp, signature, passphrase = self._sign_request(method, endpoint, body)
        
        # 设置 headers
        headers = {
            "OK-ACCESS-KEY": self.config.api_key,
            "OK-ACCESS-SIGN": signature,
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": passphrase,
            "Content-Type": "application/json",
        }
        
        # 测试网特殊 header
        if self._is_testnet:
            headers["x-simulated-trading"] = "1"
            print(f"[OKX] 使用测试网模式")
        
        # 发送请求
        try:
            if method == "GET":
                response = self._session.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=self.config.timeout_seconds
                )
            elif method == "POST":
                response = self._session.post(
                    url,
                    json=data,
                    params=params,
                    headers=headers,
                    timeout=self.config.timeout_seconds
                )
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # 解析响应
            response.raise_for_status()
            result = response.json()
            
            # 检查业务错误
            if result.get("code") != "0":
                print(f"[OKX] API 错误：{result.get('msg')} (code={result.get('code')})")
            
            return result
            
        except requests.exceptions.RequestException as e:
            print(f"[OKX] 网络错误：{e}")
            return {"code": "-1", "msg": str(e), "data": []}
        except Exception as e:
            print(f"[OKX] 未知错误：{e}")
            return {"code": "-1", "msg": str(e), "data": []}
    
    def _sign_request(self, method: str, endpoint: str, body: str = "") -> Tuple[str, str, str]:
        """生成签名"""
        # 获取 UTC 时间戳
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # 构建签名字符串
        message = timestamp + method + endpoint
        if body:
            message += body
        
        # HMAC-SHA256 签名
        signature = hmac.new(
            self.config.secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        # Base64 编码
        signature_b64 = base64.b64encode(signature).decode('utf-8')
        
        return timestamp, signature_b64, self.config.passphrase
    
    def _enforce_rate_limit(self) -> None:
        """执行速率限制"""
        now = time.time()
        min_interval = 1.0 / self.config.rate_limit_per_second
        
        if now - self._last_request_time < min_interval:
            sleep_time = min_interval - (now - self._last_request_time)
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
    
    # ========== 公共 API 方法 ==========
    
    def get_server_time(self) -> Optional[str]:
        """获取服务器时间"""
        response = self._request("GET", "/api/v5/public/time")
        
        if response.get("code") == "0":
            data = response.get("data", [{}])[0]
            return data.get("ts")
        return None
    
    def get_tickers(self, inst_type: str = "SWAP") -> List[Dict[str, Any]]:
        """获取行情"""
        response = self._request(
            "GET",
            "/api/v5/market/tickers",
            params={"instType": inst_type}
        )
        
        if response.get("code") == "0":
            return response.get("data", [])
        return []
    
    # ========== 账户 API ==========
    
    def get_balance(self) -> Dict[str, Decimal]:
        """查询余额"""
        if not self._connected:
            return {}
        
        response = self._request("GET", "/api/v5/account/balance")
        
        if response.get("code") == "0":
            data = response.get("data", [{}])[0]
            details = data.get("details", [])
            
            balances = {}
            for detail in details:
                currency = detail.get("ccy")
                available = Decimal(detail.get("availEq", "0"))
                balances[currency] = available
            
            return balances
        
        return {}
    
    # ========== 仓位 API ==========
    
    def get_positions(self) -> List[Dict[str, Any]]:
        """查询仓位"""
        if not self._connected:
            return []
        
        response = self._request("GET", "/api/v5/account/positions", params={"instType": "SWAP"})
        
        if response.get("code") == "0":
            data = response.get("data", [])
            return [p for p in data if p.get("pos")]
        
        return []
    
    def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """查询单个仓位"""
        positions = self.get_positions()
        
        for pos in positions:
            if pos.get("instId") == symbol:
                return pos
        
        return None
    
    # ========== 交易 API ==========
    
    def place_order(
        self,
        symbol: str,
        side: Side,
        order_type: OrderType,
        quantity: Decimal,
        price: Optional[Decimal] = None,
        reduce_only: bool = False,
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """下单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        # 构建请求
        data = {
            "instId": symbol,
            "tdMode": "cross",
            "side": "buy" if side == Side.BUY else "sell",
            "posSide": "long" if side == Side.BUY else "short",
            "ordType": "market" if order_type == OrderType.MARKET else "limit",
            "sz": str(quantity),
            "reduceOnly": "true" if reduce_only else "false",
        }
        
        if order_type == OrderType.LIMIT and price:
            data["px"] = str(price)
        
        if client_order_id:
            data["clOrdId"] = client_order_id
        
        # 发送请求
        response = self._request("POST", "/api/v5/trade/order", data=data)
        
        if response.get("code") == "0":
            order_data = response.get("data", [{}])[0]
            return {
                "success": True,
                "order_id": order_data.get("ordId"),
                "client_order_id": client_order_id,
            }
        else:
            return {
                "success": False,
                "error": response.get("msg", "Unknown error"),
                "code": response.get("code"),
            }
    
    def cancel_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """撤单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        data = {"instId": symbol}
        
        if order_id:
            data["ordId"] = order_id
        elif client_order_id:
            data["clOrdId"] = client_order_id
        else:
            return {"success": False, "error": "Need order_id or client_order_id"}
        
        response = self._request("POST", "/api/v5/trade/cancel-order", data=data)
        
        if response.get("code") == "0":
            return {"success": True, "order_id": order_id or client_order_id}
        else:
            return {
                "success": False,
                "error": response.get("msg", "Unknown error"),
            }
    
    def get_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """查询订单"""
        if not self._connected:
            return None
        
        params = {"instId": symbol}
        
        if order_id:
            params["ordId"] = order_id
        elif client_order_id:
            params["clOrdId"] = client_order_id
        else:
            return None
        
        response = self._request("GET", "/api/v5/trade/order", params=params)
        
        if response.get("code") == "0":
            data = response.get("data", [{}])[0]
            return data
        
        return None
    
    # ========== 条件单 API ==========
    
    def place_stop_order(
        self,
        symbol: str,
        side: Side,
        quantity: Decimal,
        trigger_price: Decimal,
        order_price: Optional[Decimal] = None,
        reduce_only: bool = True,
    ) -> Dict[str, Any]:
        """下止损止盈单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        data = {
            "instId": symbol,
            "tdMode": "cross",
            "side": "buy" if side == Side.BUY else "sell",
            "posSide": "long" if side == Side.BUY else "short",
            "sz": str(quantity),
            "reduceOnly": "true" if reduce_only else "false",
            "slTriggerPrice": str(trigger_price),
            "slOrdPx": str(order_price) if order_price else "-1",
        }
        
        response = self._request("POST", "/api/v5/trade/order-algo", data=data)
        
        if response.get("code") == "0":
            order_data = response.get("data", [{}])[0]
            return {
                "success": True,
                "order_id": order_data.get("ordId"),
                "algo_id": order_data.get("algoId"),
            }
        else:
            return {
                "success": False,
                "error": response.get("msg", "Unknown error"),
            }
    
    def cancel_stop_order(self, algo_id: str) -> Dict[str, Any]:
        """撤销条件单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        response = self._request(
            "POST",
            "/api/v5/trade/cancel-algos",
            data={"algoId": algo_id}
        )
        
        if response.get("code") == "0":
            return {"success": True, "algo_id": algo_id}
        else:
            return {
                "success": False,
                "error": response.get("msg", "Unknown error"),
            }


# 使用示例
if __name__ == "__main__":
    import json
    
    # 加载配置
    config_path = Path(__file__).parent.parent.parent / "tests" / "config" / "okx_testnet.json"
    
    with open(config_path, 'r') as f:
        config_data = json.load(f)
    
    config = OKXConfig(
        api_key=config_data["api_key"],
        secret_key=config_data["secret_key"],
        passphrase=config_data["passphrase"],
        environment=OKXEnv.TESTNET,
    )
    
    # 创建客户端
    client = OKXTradeClientReal(config)
    
    print("🔍 测试 OKX Trade Client (真实 HTTP)")
    print("=" * 60)
    
    # 连接
    print("\n[1] 连接 OKX...")
    if client.connect():
        print("✅ 连接成功")
    else:
        print("❌ 连接失败")
        exit(1)
    
    # 获取服务器时间
    print("\n[2] 获取服务器时间...")
    ts = client.get_server_time()
    print(f"服务器时间：{ts}")
    
    # 获取余额
    print("\n[3] 获取余额...")
    balances = client.get_balance()
    print(f"余额：{balances}")
    
    # 获取仓位
    print("\n[4] 获取仓位...")
    positions = client.get_positions()
    print(f"仓位：{len(positions)} 个")
    for pos in positions[:3]:
        print(f"  - {pos.get('instId')}: {pos.get('pos')} {pos.get('posSide')}")
    
    # 获取行情
    print("\n[5] 获取行情...")
    tickers = client.get_tickers("SWAP")
    print(f"行情：{len(tickers)} 个交易对")
    if tickers:
        eth = next((t for t in tickers if 'ETH' in t.get('instId')), None)
        if eth:
            print(f"  ETH: {eth.get('last')} USDT")
    
    print("\n" + "=" * 60)
    print("✅ OKX Trade Client 测试完成！")
    
    # 断开
    client.disconnect()
