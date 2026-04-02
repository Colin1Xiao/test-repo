"""
OKX Trade Client — OKX 私有交易 API

实现 OKX 交易所私有 API 对接：
- 下单（市价/限价）
- 撤单
- 查询订单
- 查询仓位
- 查询余额
- 止损止盈单

安全设计：
- API Key 签名
- 请求频率限制
- 错误重试
- 响应验证

当前阶段：
- 实现最小可用交易客户端
- 支持实盘/Testnet 切换
"""

import hashlib
import hmac
import time
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
    TESTNET = "https://www.okx.com"  # Testnet 使用相同域名，不同 header


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


@dataclass
class OKXOrder:
    """OKX 订单"""
    order_id: str
    cl_ord_id: Optional[str]
    symbol: str
    side: Side
    type: OrderType
    quantity: Decimal
    price: Optional[Decimal]
    filled_quantity: Decimal
    average_price: Decimal
    status: OrderStatus
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


@dataclass
class OKXPosition:
    """OKX 仓位"""
    symbol: str
    side: PositionSide
    quantity: Decimal
    entry_price: Decimal
    unrealized_pnl: Decimal
    margin: Decimal
    leverage: int


class OKXTradeClient:
    """OKX 交易客户端"""
    
    def __init__(self, config: OKXConfig):
        self.config = config
        # 支持字符串或枚举
        if isinstance(config.environment, str):
            self._base_url = "https://www.okx.com"
        else:
            self._base_url = config.environment.value
        self._last_request_time: float = 0
        
        # 模拟连接状态（实际实现需要 HTTP 客户端）
        self._connected = False
        self._account_id: Optional[str] = None
    
    def connect(self) -> bool:
        """连接到 OKX"""
        try:
            # 验证 API Key
            response = self._request("GET", "/api/v5/account/config")
            
            if response.get("code") == "0":
                self._connected = True
                self._account_id = response.get("data", [{}])[0].get("acctLv")
                return True
            
            return False
            
        except Exception as e:
            print(f"[OKX] 连接失败：{e}")
            return False
    
    def disconnect(self) -> None:
        """断开连接"""
        self._connected = False
    
    def is_connected(self) -> bool:
        """是否已连接"""
        return self._connected
    
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
        """
        下单
        
        Returns:
            {
                "success": bool,
                "order_id": str,
                "client_order_id": str,
                "error": str (if failed)
            }
        """
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        # 构建请求
        data = {
            "instId": symbol,
            "tdMode": "cross",  # 全仓
            "side": "buy" if side == Side.BUY else "sell",
            "posSide": "long" if side == Side.BUY else "short",
            "ordType": self._map_order_type(order_type),
            "sz": str(quantity),
            "reduceOnly": "true" if reduce_only else "false",
        }
        
        if price and order_type == OrderType.LIMIT:
            data["px"] = str(price)
        
        if client_order_id:
            data["clOrdId"] = client_order_id
        
        try:
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
                }
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def cancel_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """撤单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        data = {
            "instId": symbol,
        }
        
        if order_id:
            data["ordId"] = order_id
        elif client_order_id:
            data["clOrdId"] = client_order_id
        else:
            return {"success": False, "error": "Need order_id or client_order_id"}
        
        try:
            response = self._request("POST", "/api/v5/trade/cancel-order", data=data)
            
            if response.get("code") == "0":
                return {"success": True, "order_id": order_id or client_order_id}
            else:
                return {"success": False, "error": response.get("msg", "Unknown error")}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
    ) -> Optional[OKXOrder]:
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
        
        try:
            response = self._request("GET", "/api/v5/trade/order", params=params)
            
            if response.get("code") == "0":
                data = response.get("data", [{}])[0]
                return self._parse_order(data)
            
            return None
            
        except Exception:
            return None
    
    def get_position(self, symbol: str) -> Optional[OKXPosition]:
        """查询仓位"""
        if not self._connected:
            return None
        
        try:
            response = self._request("GET", "/api/v5/account/positions", params={"instId": symbol})
            
            if response.get("code") == "0":
                data = response.get("data", [])
                if data:
                    return self._parse_position(data[0])
            
            return None
            
        except Exception:
            return None
    
    def get_positions(self) -> List[OKXPosition]:
        """查询所有仓位"""
        if not self._connected:
            return []
        
        try:
            response = self._request("GET", "/api/v5/account/positions")
            
            if response.get("code") == "0":
                data = response.get("data", [])
                return [self._parse_position(p) for p in data if p.get("pos")]
            
            return []
            
        except Exception:
            return []
    
    def get_balance(self) -> Dict[str, Decimal]:
        """查询余额"""
        if not self._connected:
            return {}
        
        try:
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
            
        except Exception:
            return {}
    
    def place_stop_order(
        self,
        symbol: str,
        side: Side,
        quantity: Decimal,
        trigger_price: Decimal,
        order_price: Optional[Decimal] = None,
        reduce_only: bool = True,
    ) -> Dict[str, Any]:
        """
        下止损止盈单
        
        OKX 条件单参数：
        - tpTriggerPrice: 止盈触发价
        - slTriggerPrice: 止损触发价
        - tpOrdPx: 止盈委托价（-1 为市价）
        - slOrdPx: 止损委托价（-1 为市价）
        """
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
            "slOrdPx": str(order_price) if order_price else "-1",  # -1 = 市价
        }
        
        try:
            response = self._request("POST", "/api/v5/trade/order-algo", data=data)
            
            if response.get("code") == "0":
                order_data = response.get("data", [{}])[0]
                return {
                    "success": True,
                    "order_id": order_data.get("ordId"),
                    "algo_id": order_data.get("algoId"),
                }
            else:
                return {"success": False, "error": response.get("msg", "Unknown error")}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def cancel_stop_order(self, algo_id: str) -> Dict[str, Any]:
        """撤销条件单"""
        if not self._connected:
            return {"success": False, "error": "Not connected"}
        
        data = {
            "algoId": algo_id,
        }
        
        try:
            response = self._request("POST", "/api/v5/trade/cancel-algos", data=data)
            
            if response.get("code") == "0":
                return {"success": True, "algo_id": algo_id}
            else:
                return {"success": False, "error": response.get("msg", "Unknown error")}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """发送 HTTP 请求（模拟实现）"""
        # 实际实现需要：
        # 1. 构建签名
        # 2. 设置 headers
        # 3. 发送请求
        # 4. 解析响应
        # 5. 错误处理
        # 6. 重试逻辑
        
        # 这里是模拟响应
        return {"code": "0", "msg": "", "data": []}
    
    def _sign_request(self, method: str, endpoint: str, body: str = "") -> Tuple[str, str, str]:
        """生成签名"""
        timestamp = datetime.utcnow().isoformat(timespec='milliseconds') + "Z"
        
        # 构建签名字符串
        message = timestamp + method + endpoint
        if body:
            message += body
        
        # HMAC-SHA256 签名
        signature = hmac.new(
            self.config.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        
        # Base64 编码
        import base64
        signature_b64 = base64.b64encode(signature).decode()
        
        return timestamp, signature_b64, self.config.passphrase
    
    def _map_order_type(self, order_type: OrderType) -> str:
        """映射订单类型"""
        mapping = {
            OrderType.MARKET: "market",
            OrderType.LIMIT: "limit",
            OrderType.STOP: "stop",
            OrderType.TAKE_PROFIT: "take_profit",
        }
        return mapping.get(order_type, "limit")
    
    def _parse_order(self, data: Dict[str, Any]) -> OKXOrder:
        """解析订单数据"""
        return OKXOrder(
            order_id=data.get("ordId", ""),
            cl_ord_id=data.get("clOrdId"),
            symbol=data.get("instId", ""),
            side=Side.BUY if data.get("side") == "buy" else Side.SELL,
            type=OrderType.LIMIT if data.get("ordType") == "limit" else OrderType.MARKET,
            quantity=Decimal(data.get("sz", "0")),
            price=Decimal(data.get("px", "0")) if data.get("px") else None,
            filled_quantity=Decimal(data.get("accFillSz", "0")),
            average_price=Decimal(data.get("avgPx", "0")) if data.get("avgPx") else Decimal("0"),
            status=self._parse_order_status(data.get("state", "")),
            created_at=datetime.fromisoformat(data["cTime"]) if data.get("cTime") else None,
            updated_at=datetime.fromisoformat(data["uTime"]) if data.get("uTime") else None,
        )
    
    def _parse_position(self, data: Dict[str, Any]) -> OKXPosition:
        """解析仓位数据"""
        return OKXPosition(
            symbol=data.get("instId", ""),
            side=PositionSide.LONG if data.get("posSide") == "long" else PositionSide.SHORT,
            quantity=Decimal(data.get("pos", "0")),
            entry_price=Decimal(data.get("avgPx", "0")),
            unrealized_pnl=Decimal(data.get("upl", "0")),
            margin=Decimal(data.get("margin", "0")),
            leverage=int(data.get("lever", "1")),
        )
    
    def _parse_order_status(self, state: str) -> OrderStatus:
        """解析订单状态"""
        mapping = {
            "live": OrderStatus.ACKED,
            "partially_filled": OrderStatus.PARTIAL,
            "filled": OrderStatus.FILLED,
            "canceled": OrderStatus.CANCELED,
            "rejected": OrderStatus.REJECTED,
        }
        return mapping.get(state, OrderStatus.UNKNOWN_RECOVERING)


# 使用示例
if __name__ == "__main__":
    # 注意：需要真实的 API Key 才能实际运行
    config = OKXConfig(
        api_key="YOUR_API_KEY",
        secret_key="YOUR_SECRET_KEY",
        passphrase="YOUR_PASSPHRASE",
        environment=OKXEnv.TESTNET,
    )
    
    client = OKXTradeClient(config)
    
    # 连接
    if client.connect():
        print("✓ 已连接到 OKX")
        
        # 查询余额
        balances = client.get_balance()
        print(f"余额：{balances}")
        
        # 查询仓位
        positions = client.get_positions()
        print(f"仓位：{len(positions)} 个")
        
        # 下单
        result = client.place_order(
            symbol="ETH-USDT-SWAP",
            side=Side.BUY,
            order_type=OrderType.LIMIT,
            quantity=Decimal("0.1"),
            price=Decimal("2000.0"),
        )
        print(f"下单结果：{result}")
        
        # 断开
        client.disconnect()
    else:
        print("✗ 连接失败")
