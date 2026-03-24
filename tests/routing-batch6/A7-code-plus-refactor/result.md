# 测试用例 A7: 大型代码重构测试

**测试时间:** 2026-03-13 05:58 GMT+8
**路由目标:** CODE-PLUS (qwen3.5-plus)
**测试类型:** 大型代码/重构

---

## 用户输入

```
下面是一段 600 行的 Python 服务代码，请你重构成 controller/service/repository 三层结构，并给出新的目录建议。

[模拟代码：一个包含用户管理、订单处理、支付功能的单体 Python 服务，有 600 行，包含多个类混合在一起，需要按三层架构重构]
```

---

## 模拟代码 (600 行单体服务)

```python
# monolithic_service.py - 600 行单体 Python 服务
# 包含：用户管理、订单处理、支付功能 - 所有类混合在一起

import sqlite3
import hashlib
import json
import requests
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== 数据库连接管理 ====================
class DatabaseManager:
    def __init__(self, db_path: str = "app.db"):
        self.db_path = db_path
        self.connection = None
    
    def connect(self):
        self.connection = sqlite3.connect(self.db_path)
        self.connection.row_factory = sqlite3.Row
        return self.connection
    
    def close(self):
        if self.connection:
            self.connection.close()
    
    def execute(self, query: str, params: tuple = ()):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor

# ==================== 用户相关类 ====================
class User:
    def __init__(self, user_id: int, username: str, email: str, password_hash: str, 
                 created_at: str, is_active: bool = True):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.created_at = created_at
        self.is_active = is_active
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at,
            "is_active": self.is_active
        }

class UserManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_user(self, username: str, email: str, password: str) -> User:
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        created_at = datetime.now().isoformat()
        
        cursor = self.db_manager.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, created_at)
        )
        user_id = cursor.lastrowid
        return User(user_id, username, email, password_hash, created_at)
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        cursor = self.db_manager.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            return User(row['user_id'], row['username'], row['email'], 
                       row['password_hash'], row['created_at'], row['is_active'])
        return None
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        cursor = self.db_manager.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            return User(row['user_id'], row['username'], row['email'],
                       row['password_hash'], row['created_at'], row['is_active'])
        return None
    
    def update_user(self, user_id: int, **kwargs) -> bool:
        allowed_fields = ['username', 'email', 'is_active']
        updates = []
        params = []
        for key, value in kwargs.items():
            if key in allowed_fields:
                updates.append(f"{key} = ?")
                params.append(value)
        if not updates:
            return False
        params.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE user_id = ?"
        self.db_manager.execute(query, tuple(params))
        return True
    
    def delete_user(self, user_id: int) -> bool:
        self.db_manager.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        return True
    
    def list_users(self, limit: int = 100, offset: int = 0) -> List[User]:
        cursor = self.db_manager.execute("SELECT * FROM users LIMIT ? OFFSET ?", (limit, offset))
        users = []
        for row in cursor.fetchall():
            users.append(User(row['user_id'], row['username'], row['email'],
                             row['password_hash'], row['created_at'], row['is_active']))
        return users

# ==================== 订单相关类 ====================
class Order:
    def __init__(self, order_id: int, user_id: int, total_amount: float, status: str,
                 created_at: str, updated_at: str, items: List[Dict] = None):
        self.order_id = order_id
        self.user_id = user_id
        self.total_amount = total_amount
        self.status = status  # pending, paid, shipped, cancelled
        self.created_at = created_at
        self.updated_at = updated_at
        self.items = items or []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "user_id": self.user_id,
            "total_amount": self.total_amount,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "items": self.items
        }

class OrderManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_order(self, user_id: int, items: List[Dict], total_amount: float) -> Order:
        created_at = datetime.now().isoformat()
        updated_at = created_at
        status = "pending"
        
        cursor = self.db_manager.execute(
            "INSERT INTO orders (user_id, total_amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, total_amount, status, created_at, updated_at)
        )
        order_id = cursor.lastrowid
        
        for item in items:
            self.db_manager.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                (order_id, item['product_id'], item['quantity'], item['price'])
            )
        
        return Order(order_id, user_id, total_amount, status, created_at, updated_at, items)
    
    def get_order_by_id(self, order_id: int) -> Optional[Order]:
        cursor = self.db_manager.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        items_cursor = self.db_manager.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (order_id,)
        )
        items = [{"product_id": r['product_id'], "quantity": r['quantity'], "price": r['price']} 
                 for r in items_cursor.fetchall()]
        
        return Order(row['order_id'], row['user_id'], row['total_amount'], row['status'],
                    row['created_at'], row['updated_at'], items)
    
    def get_orders_by_user(self, user_id: int) -> List[Order]:
        cursor = self.db_manager.execute("SELECT * FROM orders WHERE user_id = ?", (user_id,))
        orders = []
        for row in cursor.fetchall():
            items_cursor = self.db_manager.execute(
                "SELECT * FROM order_items WHERE order_id = ?", (row['order_id'],)
            )
            items = [{"product_id": r['product_id'], "quantity": r['quantity'], "price": r['price']}
                     for r in items_cursor.fetchall()]
            orders.append(Order(row['order_id'], row['user_id'], row['total_amount'], row['status'],
                               row['created_at'], row['updated_at'], items))
        return orders
    
    def update_order_status(self, order_id: int, status: str) -> bool:
        valid_statuses = ['pending', 'paid', 'shipped', 'cancelled']
        if status not in valid_statuses:
            return False
        updated_at = datetime.now().isoformat()
        self.db_manager.execute(
            "UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?",
            (status, updated_at, order_id)
        )
        return True
    
    def cancel_order(self, order_id: int) -> bool:
        return self.update_order_status(order_id, 'cancelled')
    
    def delete_order(self, order_id: int) -> bool:
        self.db_manager.execute("DELETE FROM order_items WHERE order_id = ?", (order_id,))
        self.db_manager.execute("DELETE FROM orders WHERE order_id = ?", (order_id,))
        return True

# ==================== 支付相关类 ====================
class Payment:
    def __init__(self, payment_id: int, order_id: int, user_id: int, amount: float,
                 payment_method: str, status: str, transaction_id: str,
                 created_at: str, processed_at: str = None):
        self.payment_id = payment_id
        self.order_id = order_id
        self.user_id = user_id
        self.amount = amount
        self.payment_method = payment_method
        self.status = status  # pending, completed, failed, refunded
        self.transaction_id = transaction_id
        self.created_at = created_at
        self.processed_at = processed_at
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "payment_id": self.payment_id,
            "order_id": self.order_id,
            "user_id": self.user_id,
            "amount": self.amount,
            "payment_method": self.payment_method,
            "status": self.status,
            "transaction_id": self.transaction_id,
            "created_at": self.created_at,
            "processed_at": self.processed_at
        }

class PaymentManager:
    def __init__(self, db_manager: DatabaseManager, api_key: str = ""):
        self.db_manager = db_manager
        self.api_key = api_key
        self.payment_gateway_url = "https://api.payment-gateway.com"
    
    def create_payment(self, order_id: int, user_id: int, amount: float, 
                       payment_method: str = "credit_card") -> Payment:
        created_at = datetime.now().isoformat()
        transaction_id = f"txn_{datetime.now().timestamp()}"
        status = "pending"
        
        cursor = self.db_manager.execute(
            "INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (order_id, user_id, amount, payment_method, status, transaction_id, created_at)
        )
        payment_id = cursor.lastrowid
        return Payment(payment_id, order_id, user_id, amount, payment_method, status, 
                      transaction_id, created_at)
    
    def process_payment(self, payment_id: int) -> bool:
        payment = self.get_payment_by_id(payment_id)
        if not payment or payment.status != 'pending':
            return False
        
        # 模拟支付网关调用
        try:
            # response = requests.post(f"{self.payment_gateway_url}/charge", 
            #                        json={"amount": payment.amount, "transaction_id": payment.transaction_id})
            # if response.status_code == 200:
            processed_at = datetime.now().isoformat()
            self.db_manager.execute(
                "UPDATE payments SET status = 'completed', processed_at = ? WHERE payment_id = ?",
                (processed_at, payment_id)
            )
            self.db_manager.execute(
                "UPDATE orders SET status = 'paid', updated_at = ? WHERE order_id = ?",
                (processed_at, payment.order_id)
            )
            return True
        except Exception as e:
            logger.error(f"Payment processing failed: {e}")
            self.db_manager.execute(
                "UPDATE payments SET status = 'failed' WHERE payment_id = ?",
                (payment_id,)
            )
            return False
    
    def get_payment_by_id(self, payment_id: int) -> Optional[Payment]:
        cursor = self.db_manager.execute("SELECT * FROM payments WHERE payment_id = ?", (payment_id,))
        row = cursor.fetchone()
        if row:
            return Payment(row['payment_id'], row['order_id'], row['user_id'], row['amount'],
                          row['payment_method'], row['status'], row['transaction_id'],
                          row['created_at'], row['processed_at'])
        return None
    
    def get_payments_by_order(self, order_id: int) -> List[Payment]:
        cursor = self.db_manager.execute("SELECT * FROM payments WHERE order_id = ?", (order_id,))
        payments = []
        for row in cursor.fetchall():
            payments.append(Payment(row['payment_id'], row['order_id'], row['user_id'], row['amount'],
                                   row['payment_method'], row['status'], row['transaction_id'],
                                   row['created_at'], row['processed_at']))
        return payments
    
    def refund_payment(self, payment_id: int) -> bool:
        payment = self.get_payment_by_id(payment_id)
        if not payment or payment.status != 'completed':
            return False
        
        try:
            # response = requests.post(f"{self.payment_gateway_url}/refund",
            #                        json={"transaction_id": payment.transaction_id})
            self.db_manager.execute(
                "UPDATE payments SET status = 'refunded' WHERE payment_id = ?",
                (payment_id,)
            )
            return True
        except Exception as e:
            logger.error(f"Refund failed: {e}")
            return False

# ==================== HTTP 控制器 (混合在一起) ====================
class UserController:
    def __init__(self, db_manager: DatabaseManager):
        self.user_manager = UserManager(db_manager)
    
    def handle_register(self, request_data: Dict) -> Dict:
        try:
            user = self.user_manager.create_user(
                request_data['username'],
                request_data['email'],
                request_data['password']
            )
            return {"success": True, "user": user.to_dict()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_login(self, request_data: Dict) -> Dict:
        user = self.user_manager.get_user_by_email(request_data['email'])
        if not user:
            return {"success": False, "error": "User not found"}
        
        password_hash = hashlib.sha256(request_data['password'].encode()).hexdigest()
        if password_hash != user.password_hash:
            return {"success": False, "error": "Invalid password"}
        
        return {"success": True, "user": user.to_dict()}
    
    def handle_get_user(self, user_id: int) -> Dict:
        user = self.user_manager.get_user_by_id(user_id)
        if not user:
            return {"success": False, "error": "User not found"}
        return {"success": True, "user": user.to_dict()}
    
    def handle_update_user(self, user_id: int, request_data: Dict) -> Dict:
        success = self.user_manager.update_user(user_id, **request_data)
        if success:
            user = self.user_manager.get_user_by_id(user_id)
            return {"success": True, "user": user.to_dict()}
        return {"success": False, "error": "Update failed"}
    
    def handle_delete_user(self, user_id: int) -> Dict:
        success = self.user_manager.delete_user(user_id)
        return {"success": success}

class OrderController:
    def __init__(self, db_manager: DatabaseManager):
        self.order_manager = OrderManager(db_manager)
        self.user_manager = UserManager(db_manager)
    
    def handle_create_order(self, request_data: Dict) -> Dict:
        user = self.user_manager.get_user_by_id(request_data['user_id'])
        if not user:
            return {"success": False, "error": "User not found"}
        
        order = self.order_manager.create_order(
            request_data['user_id'],
            request_data['items'],
            request_data['total_amount']
        )
        return {"success": True, "order": order.to_dict()}
    
    def handle_get_order(self, order_id: int) -> Dict:
        order = self.order_manager.get_order_by_id(order_id)
        if not order:
            return {"success": False, "error": "Order not found"}
        return {"success": True, "order": order.to_dict()}
    
    def handle_get_user_orders(self, user_id: int) -> Dict:
        orders = self.order_manager.get_orders_by_user(user_id)
        return {"success": True, "orders": [o.to_dict() for o in orders]}
    
    def handle_cancel_order(self, order_id: int) -> Dict:
        success = self.order_manager.cancel_order(order_id)
        return {"success": success}

class PaymentController:
    def __init__(self, db_manager: DatabaseManager, api_key: str = ""):
        self.payment_manager = PaymentManager(db_manager, api_key)
        self.order_manager = OrderManager(db_manager)
    
    def handle_create_payment(self, request_data: Dict) -> Dict:
        payment = self.payment_manager.create_payment(
            request_data['order_id'],
            request_data['user_id'],
            request_data['amount'],
            request_data.get('payment_method', 'credit_card')
        )
        return {"success": True, "payment": payment.to_dict()}
    
    def handle_process_payment(self, payment_id: int) -> Dict:
        success = self.payment_manager.process_payment(payment_id)
        if success:
            payment = self.payment_manager.get_payment_by_id(payment_id)
            return {"success": True, "payment": payment.to_dict()}
        return {"success": False, "error": "Payment processing failed"}
    
    def handle_refund_payment(self, payment_id: int) -> Dict:
        success = self.payment_manager.refund_payment(payment_id)
        return {"success": success}

# ==================== 应用初始化 ====================
def init_database(db_manager: DatabaseManager):
    db_manager.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    """)
    
    db_manager.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    """)
    
    db_manager.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
    """)
    
    db_manager.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT DEFAULT 'credit_card',
            status TEXT DEFAULT 'pending',
            transaction_id TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            processed_at TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(order_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    """)

def create_app(db_path: str = "app.db", payment_api_key: str = ""):
    db_manager = DatabaseManager(db_path)
    init_database(db_manager)
    
    controllers = {
        'user': UserController(db_manager),
        'order': OrderController(db_manager),
        'payment': PaymentController(db_manager, payment_api_key)
    }
    
    return {
        'db_manager': db_manager,
        'controllers': controllers
    }

if __name__ == "__main__":
    app = create_app()
    print("Application started successfully!")
```

---

## 测试执行

**模型:** bailian/qwen3.5-plus (CODE-PLUS)
**请求内容:** 重构上述 600 行代码为 controller/service/repository 三层架构

---

## 模型响应

*待填充 - 等待模型响应*

---

## 验收标准

- [ ] 模型正确路由到 CODE-PLUS
- [ ] 输出包含完整的三层架构重构代码
- [ ] 提供新的目录结构建议
- [ ] 代码保持原有功能完整性
- [ ] 分层清晰：Controller 层、Service 层、Repository 层

---

## 测试结果

**状态:** ⏳ 执行中
**完成时间:** -
**路由正确:** -
**代码质量:** -
**备注:** -
