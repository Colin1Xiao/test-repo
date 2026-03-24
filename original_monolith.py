"""
模拟一个600行的单体Python服务，包含用户管理、订单处理、支付功能
"""
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional


class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self, db_path: str = "app.db"):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """初始化数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建用户表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建订单表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # 创建支付表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT NOT NULL,
                transaction_id TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        """)
        
        conn.commit()
        conn.close()


class User:
    """用户实体类"""
    
    def __init__(self, user_id: int = None, username: str = "", email: str = "", 
                 password: str = "", created_at: str = None):
        self.id = user_id
        self.username = username
        self.email = email
        self.password = password
        self.created_at = created_at


class Order:
    """订单实体类"""
    
    def __init__(self, order_id: int = None, user_id: int = None, 
                 total_amount: float = 0.0, status: str = "pending", 
                 created_at: str = None):
        self.id = order_id
        self.user_id = user_id
        self.total_amount = total_amount
        self.status = status
        self.created_at = created_at


class Payment:
    """支付实体类"""
    
    def __init__(self, payment_id: int = None, order_id: int = None, 
                 amount: float = 0.0, payment_method: str = "", 
                 transaction_id: str = "", status: str = "pending", 
                 created_at: str = None):
        self.id = payment_id
        self.order_id = order_id
        self.amount = amount
        self.payment_method = payment_method
        self.transaction_id = transaction_id
        self.status = status
        self.created_at = created_at


class UserRepository:
    """用户仓库类"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_user(self, username: str, email: str, password: str) -> User:
        """创建用户"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                (username, email, password)
            )
            user_id = cursor.lastrowid
            conn.commit()
            
            return User(user_id=user_id, username=username, email=email, password=password)
        except sqlite3.IntegrityError as e:
            raise Exception(f"用户创建失败: {str(e)}")
        finally:
            conn.close()
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """根据ID获取用户"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, email, password, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return User(user_id=row[0], username=row[1], email=row[2], 
                       password=row[3], created_at=row[4])
        return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """根据用户名获取用户"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, email, password, created_at FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return User(user_id=row[0], username=row[1], email=row[2], 
                       password=row[3], created_at=row[4])
        return None
    
    def update_user(self, user_id: int, username: str = None, email: str = None, 
                   password: str = None) -> bool:
        """更新用户信息"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if username:
            updates.append("username = ?")
            params.append(username)
        if email:
            updates.append("email = ?")
            params.append(email)
        if password:
            updates.append("password = ?")
            params.append(password)
        
        if not updates:
            return False
        
        params.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        
        cursor.execute(query, params)
        affected_rows = cursor.rowcount
        conn.commit()
        
        conn.close()
        
        return affected_rows > 0
    
    def delete_user(self, user_id: int) -> bool:
        """删除用户"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        affected_rows = cursor.rowcount
        conn.commit()
        
        conn.close()
        
        return affected_rows > 0


class OrderRepository:
    """订单仓库类"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_order(self, user_id: int, total_amount: float) -> Order:
        """创建订单"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO orders (user_id, total_amount) VALUES (?, ?)",
            (user_id, total_amount)
        )
        order_id = cursor.lastrowid
        conn.commit()
        
        conn.close()
        
        return Order(order_id=order_id, user_id=user_id, total_amount=total_amount)
    
    def get_order_by_id(self, order_id: int) -> Optional[Order]:
        """根据ID获取订单"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, user_id, total_amount, status, created_at FROM orders WHERE id = ?",
            (order_id,)
        )
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return Order(order_id=row[0], user_id=row[1], total_amount=row[2], 
                        status=row[3], created_at=row[4])
        return None
    
    def get_orders_by_user(self, user_id: int) -> List[Order]:
        """获取用户的所有订单"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, user_id, total_amount, status, created_at FROM orders WHERE user_id = ?",
            (user_id,)
        )
        rows = cursor.fetchall()
        
        conn.close()
        
        return [
            Order(order_id=row[0], user_id=row[1], total_amount=row[2], 
                  status=row[3], created_at=row[4])
            for row in rows
        ]
    
    def update_order_status(self, order_id: int, status: str) -> bool:
        """更新订单状态"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
        affected_rows = cursor.rowcount
        conn.commit()
        
        conn.close()
        
        return affected_rows > 0


class PaymentRepository:
    """支付仓库类"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_payment(self, order_id: int, amount: float, payment_method: str) -> Payment:
        """创建支付记录"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO payments (order_id, amount, payment_method) VALUES (?, ?, ?)",
            (order_id, amount, payment_method)
        )
        payment_id = cursor.lastrowid
        conn.commit()
        
        conn.close()
        
        return Payment(payment_id=payment_id, order_id=order_id, amount=amount, 
                      payment_method=payment_method)
    
    def get_payment_by_id(self, payment_id: int) -> Optional[Payment]:
        """根据ID获取支付记录"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, order_id, amount, payment_method, transaction_id, status, created_at FROM payments WHERE id = ?",
            (payment_id,)
        )
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return Payment(payment_id=row[0], order_id=row[1], amount=row[2], 
                          payment_method=row[3], transaction_id=row[4], 
                          status=row[5], created_at=row[6])
        return None
    
    def update_payment_status(self, payment_id: int, status: str, transaction_id: str = None) -> bool:
        """更新支付状态"""
        conn = sqlite3.connect(self.db_manager.db_path)
        cursor = conn.cursor()
        
        if transaction_id:
            cursor.execute(
                "UPDATE payments SET status = ?, transaction_id = ? WHERE id = ?",
                (status, transaction_id, payment_id)
            )
        else:
            cursor.execute("UPDATE payments SET status = ? WHERE id = ?", (status, payment_id))
        
        affected_rows = cursor.rowcount
        conn.commit()
        
        conn.close()
        
        return affected_rows > 0


class UserService:
    """用户服务类"""
    
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
    
    def register_user(self, username: str, email: str, password: str) -> Dict:
        """注册用户"""
        # 验证输入
        if not username or not email or not password:
            return {"success": False, "message": "用户名、邮箱和密码不能为空"}
        
        if len(password) < 6:
            return {"success": False, "message": "密码长度不能少于6位"}
        
        # 检查用户名是否已存在
        existing_user = self.user_repo.get_user_by_username(username)
        if existing_user:
            return {"success": False, "message": "用户名已存在"}
        
        # 创建用户
        try:
            user = self.user_repo.create_user(username, email, password)
            return {
                "success": True, 
                "message": "用户注册成功", 
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "created_at": user.created_at
                }
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def login(self, username: str, password: str) -> Dict:
        """用户登录"""
        user = self.user_repo.get_user_by_username(username)
        if not user or user.password != password:
            return {"success": False, "message": "用户名或密码错误"}
        
        return {
            "success": True,
            "message": "登录成功",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "created_at": user.created_at
            }
        }
    
    def get_user_profile(self, user_id: int) -> Dict:
        """获取用户资料"""
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "用户不存在"}
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "created_at": user.created_at
            }
        }
    
    def update_user_info(self, user_id: int, username: str = None, 
                         email: str = None, password: str = None) -> Dict:
        """更新用户信息"""
        # 如果提供了新用户名，检查是否已存在
        if username:
            existing_user = self.user_repo.get_user_by_username(username)
            if existing_user and existing_user.id != user_id:
                return {"success": False, "message": "用户名已存在"}
        
        success = self.user_repo.update_user(user_id, username, email, password)
        if success:
            return {"success": True, "message": "用户信息更新成功"}
        else:
            return {"success": False, "message": "用户信息更新失败"}


class OrderService:
    """订单服务类"""
    
    def __init__(self, order_repo: OrderRepository, user_repo: UserRepository):
        self.order_repo = order_repo
        self.user_repo = user_repo
    
    def create_order(self, user_id: int, items: List[Dict]) -> Dict:
        """创建订单"""
        # 验证用户是否存在
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "用户不存在"}
        
        # 计算总金额
        total_amount = sum(item.get('price', 0) * item.get('quantity', 1) for item in items)
        
        if total_amount <= 0:
            return {"success": False, "message": "订单金额必须大于0"}
        
        # 创建订单
        order = self.order_repo.create_order(user_id, total_amount)
        
        return {
            "success": True,
            "message": "订单创建成功",
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "total_amount": order.total_amount,
                "status": order.status,
                "created_at": order.created_at
            }
        }
    
    def get_order_details(self, order_id: int) -> Dict:
        """获取订单详情"""
        order = self.order_repo.get_order_by_id(order_id)
        if not order:
            return {"success": False, "message": "订单不存在"}
        
        return {
            "success": True,
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "total_amount": order.total_amount,
                "status": order.status,
                "created_at": order.created_at
            }
        }
    
    def get_user_orders(self, user_id: int) -> Dict:
        """获取用户所有订单"""
        orders = self.order_repo.get_orders_by_user(user_id)
        
        return {
            "success": True,
            "orders": [
                {
                    "id": order.id,
                    "user_id": order.user_id,
                    "total_amount": order.total_amount,
                    "status": order.status,
                    "created_at": order.created_at
                }
                for order in orders
            ]
        }
    
    def cancel_order(self, order_id: int, user_id: int) -> Dict:
        """取消订单"""
        order = self.order_repo.get_order_by_id(order_id)
        if not order:
            return {"success": False, "message": "订单不存在"}
        
        if order.user_id != user_id:
            return {"success": False, "message": "无权限操作此订单"}
        
        if order.status == "cancelled":
            return {"success": False, "message": "订单已取消"}
        
        if order.status == "completed":
            return {"success": False, "message": "已完成的订单无法取消"}
        
        success = self.order_repo.update_order_status(order_id, "cancelled")
        if success:
            return {"success": True, "message": "订单已取消"}
        else:
            return {"success": False, "message": "订单取消失败"}


class PaymentService:
    """支付服务类"""
    
    def __init__(self, payment_repo: PaymentRepository, order_repo: OrderRepository):
        self.payment_repo = payment_repo
        self.order_repo = order_repo
    
    def process_payment(self, order_id: int, payment_method: str) -> Dict:
        """处理支付"""
        # 验证订单
        order = self.order_repo.get_order_by_id(order_id)
        if not order:
            return {"success": False, "message": "订单不存在"}
        
        if order.status != "pending":
            return {"success": False, "message": "订单状态不允许支付"}
        
        # 创建支付记录
        payment = self.payment_repo.create_payment(order_id, order.total_amount, payment_method)
        
        # 这里应该调用实际的支付网关
        # 模拟支付处理
        transaction_id = f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}{payment.id}"
        
        # 更新支付状态为完成
        self.payment_repo.update_payment_status(payment.id, "completed", transaction_id)
        
        # 更新订单状态为已完成
        self.order_repo.update_order_status(order_id, "completed")
        
        return {
            "success": True,
            "message": "支付处理成功",
            "payment": {
                "id": payment.id,
                "order_id": payment.order_id,
                "amount": payment.amount,
                "payment_method": payment.payment_method,
                "transaction_id": transaction_id,
                "status": "completed",
                "created_at": payment.created_at
            }
        }
    
    def get_payment_details(self, payment_id: int) -> Dict:
        """获取支付详情"""
        payment = self.payment_repo.get_payment_by_id(payment_id)
        if not payment:
            return {"success": False, "message": "支付记录不存在"}
        
        return {
            "success": True,
            "payment": {
                "id": payment.id,
                "order_id": payment.order_id,
                "amount": payment.amount,
                "payment_method": payment.payment_method,
                "transaction_id": payment.transaction_id,
                "status": payment.status,
                "created_at": payment.created_at
            }
        }


class UserController:
    """用户控制器"""
    
    def __init__(self, user_service: UserService):
        self.user_service = user_service
    
    def register(self, data: Dict) -> str:
        """注册接口"""
        result = self.user_service.register_user(
            data.get('username'), 
            data.get('email'), 
            data.get('password')
        )
        return json.dumps(result, ensure_ascii=False)
    
    def login(self, data: Dict) -> str:
        """登录接口"""
        result = self.user_service.login(
            data.get('username'), 
            data.get('password')
        )
        return json.dumps(result, ensure_ascii=False)
    
    def get_profile(self, user_id: int) -> str:
        """获取用户资料接口"""
        result = self.user_service.get_user_profile(user_id)
        return json.dumps(result, ensure_ascii=False)
    
    def update_profile(self, user_id: int, data: Dict) -> str:
        """更新用户资料接口"""
        result = self.user_service.update_user_info(
            user_id,
            data.get('username'),
            data.get('email'),
            data.get('password')
        )
        return json.dumps(result, ensure_ascii=False)


class OrderController:
    """订单控制器"""
    
    def __init__(self, order_service: OrderService):
        self.order_service = order_service
    
    def create_order(self, user_id: int, data: Dict) -> str:
        """创建订单接口"""
        result = self.order_service.create_order(user_id, data.get('items', []))
        return json.dumps(result, ensure_ascii=False)
    
    def get_order(self, order_id: int) -> str:
        """获取订单详情接口"""
        result = self.order_service.get_order_details(order_id)
        return json.dumps(result, ensure_ascii=False)
    
    def get_user_orders(self, user_id: int) -> str:
        """获取用户订单列表接口"""
        result = self.order_service.get_user_orders(user_id)
        return json.dumps(result, ensure_ascii=False)
    
    def cancel_order(self, order_id: int, user_id: int) -> str:
        """取消订单接口"""
        result = self.order_service.cancel_order(order_id, user_id)
        return json.dumps(result, ensure_ascii=False)


class PaymentController:
    """支付控制器"""
    
    def __init__(self, payment_service: PaymentService):
        self.payment_service = payment_service
    
    def process_payment(self, data: Dict) -> str:
        """处理支付接口"""
        result = self.payment_service.process_payment(
            data.get('order_id'),
            data.get('payment_method')
        )
        return json.dumps(result, ensure_ascii=False)
    
    def get_payment(self, payment_id: int) -> str:
        """获取支付详情接口"""
        result = self.payment_service.get_payment_details(payment_id)
        return json.dumps(result, ensure_ascii=False)


def main():
    """主函数 - 演示应用"""
    # 初始化数据库管理器
    db_manager = DatabaseManager()
    
    # 初始化仓库层
    user_repo = UserRepository(db_manager)
    order_repo = OrderRepository(db_manager)
    payment_repo = PaymentRepository(db_manager)
    
    # 初始化服务层
    user_service = UserService(user_repo)
    order_service = OrderService(order_repo, user_repo)
    payment_service = PaymentService(payment_repo, order_repo)
    
    # 初始化控制器层
    user_controller = UserController(user_service)
    order_controller = OrderController(order_service)
    payment_controller = PaymentController(payment_service)
    
    print("系统初始化完成！")
    
    # 示例：注册用户
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    print("注册结果:", user_controller.register(user_data))
    
    # 示例：创建订单
    order_items = [
        {"name": "商品1", "price": 100.0, "quantity": 2},
        {"name": "商品2", "price": 50.0, "quantity": 1}
    ]
    print("创建订单结果:", order_controller.create_order(1, {"items": order_items}))
    
    # 示例：处理支付
    payment_data = {
        "order_id": 1,
        "payment_method": "credit_card"
    }
    print("支付结果:", payment_controller.process_payment(payment_data))


if __name__ == "__main__":
    main()