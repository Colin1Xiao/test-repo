"""
WebSocket 连接管理器
"""

import asyncio
import json
import logging
from typing import Dict, List, Set

from fastapi import WebSocket

from app.core.events import Event, event_bus

logger = logging.getLogger(__name__)


class WebSocketManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_subscriptions: Dict[str, Set[str]] = {}
        
        # 事件订阅
        if event_bus:
            event_bus.subscribe(self._handle_event)
        
        logger.debug("WebSocket 管理器初始化完成")
    
    async def connect(self, websocket: WebSocket, client_id: str = None):
        """连接 WebSocket"""
        await websocket.accept()
        
        # 生成客户端 ID
        if client_id is None:
            import uuid
            client_id = str(uuid.uuid4())[:8]
        
        self.active_connections[client_id] = websocket
        self.connection_subscriptions[client_id] = set()
        
        logger.info(f"WebSocket 连接建立：{client_id}")
        
        # 发送欢迎消息
        await self.send_personal(
            client_id,
            {
                "type": "connection_established",
                "client_id": client_id,
                "message": "WebSocket 连接已建立",
                "timestamp": asyncio.get_event_loop().time(),
            },
        )
    
    def disconnect(self, websocket: WebSocket):
        """断开 WebSocket 连接"""
        # 查找客户端 ID
        client_id = None
        for cid, ws in self.active_connections.items():
            if ws == websocket:
                client_id = cid
                break
        
        if client_id:
            del self.active_connections[client_id]
            del self.connection_subscriptions[client_id]
            logger.info(f"WebSocket 连接断开：{client_id}")
    
    async def send_personal(self, client_id: str, message: dict):
        """向特定客户端发送消息"""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"发送消息到客户端 {client_id} 失败：{e}")
                self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """广播消息到所有客户端"""
        disconnected = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"广播消息到客户端 {client_id} 失败：{e}")
                disconnected.append(websocket)
        
        # 清理断开连接的客户端
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def broadcast_to_subscribers(self, subscription_type: str, message: dict):
        """向订阅了特定类型事件的客户端广播消息"""
        disconnected = []
        
        for client_id, websocket in self.active_connections.items():
            if subscription_type in self.connection_subscriptions.get(client_id, set()):
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"发送订阅消息到客户端 {client_id} 失败：{e}")
                    disconnected.append(websocket)
        
        # 清理断开连接的客户端
        for websocket in disconnected:
            self.disconnect(websocket)
    
    def subscribe(self, client_id: str, subscription_type: str):
        """客户端订阅特定类型事件"""
        if client_id in self.connection_subscriptions:
            self.connection_subscriptions[client_id].add(subscription_type)
            logger.debug(f"客户端 {client_id} 订阅：{subscription_type}")
    
    def unsubscribe(self, client_id: str, subscription_type: str):
        """客户端取消订阅特定类型事件"""
        if client_id in self.connection_subscriptions:
            self.connection_subscriptions[client_id].discard(subscription_type)
            logger.debug(f"客户端 {client_id} 取消订阅：{subscription_type}")
    
    def unsubscribe_all(self, client_id: str):
        """客户端取消所有订阅"""
        if client_id in self.connection_subscriptions:
            self.connection_subscriptions[client_id].clear()
            logger.debug(f"客户端 {client_id} 取消所有订阅")
    
    def get_subscriptions(self, client_id: str) -> List[str]:
        """获取客户端的所有订阅"""
        return list(self.connection_subscriptions.get(client_id, set()))
    
    async def _handle_event(self, event: Event):
        """处理事件，转换为 WebSocket 消息"""
        try:
            # 构建消息
            message = {
                "type": "event",
                "event_type": event.event_type.value,
                "source": event.source,
                "data": event.data,
                "metadata": event.metadata,
                "timestamp": event.timestamp.isoformat(),
            }
            
            # 广播事件
            await self.broadcast_to_subscribers(event.event_type.value, message)
            
            # 同时广播给订阅了 "all_events" 的客户端
            await self.broadcast_to_subscribers("all_events", message)
            
        except Exception as e:
            logger.error(f"处理事件失败：{e}", exc_info=True)
    
    async def handle_message(self, client_id: str, message: dict):
        """处理客户端消息"""
        try:
            message_type = message.get("type")
            
            if message_type == "subscribe":
                subscription_type = message.get("subscription_type")
                if subscription_type:
                    self.subscribe(client_id, subscription_type)
                    await self.send_personal(
                        client_id,
                        {
                            "type": "subscription_confirmed",
                            "subscription_type": subscription_type,
                            "message": f"已订阅 {subscription_type}",
                            "timestamp": asyncio.get_event_loop().time(),
                        },
                    )
            
            elif message_type == "unsubscribe":
                subscription_type = message.get("subscription_type")
                if subscription_type:
                    self.unsubscribe(client_id, subscription_type)
                    await self.send_personal(
                        client_id,
                        {
                            "type": "unsubscription_confirmed",
                            "subscription_type": subscription_type,
                            "message": f"已取消订阅 {subscription_type}",
                            "timestamp": asyncio.get_event_loop().time(),
                        },
                    )
            
            elif message_type == "ping":
                await self.send_personal(
                    client_id,
                    {
                        "type": "pong",
                        "timestamp": asyncio.get_event_loop().time(),
                    },
                )
            
            elif message_type == "get_subscriptions":
                subscriptions = self.get_subscriptions(client_id)
                await self.send_personal(
                    client_id,
                    {
                        "type": "subscriptions_list",
                        "subscriptions": subscriptions,
                        "timestamp": asyncio.get_event_loop().time(),
                    },
                )
            
            else:
                logger.debug(f"未知消息类型：{message_type}")
                await self.send_personal(
                    client_id,
                    {
                        "type": "error",
                        "message": f"未知消息类型：{message_type}",
                        "timestamp": asyncio.get_event_loop().time(),
                    },
                )
        
        except Exception as e:
            logger.error(f"处理客户端消息失败：{e}", exc_info=True)
            await self.send_personal(
                client_id,
                {
                    "type": "error",
                    "message": f"处理消息失败：{str(e)}",
                    "timestamp": asyncio.get_event_loop().time(),
                },
            )
