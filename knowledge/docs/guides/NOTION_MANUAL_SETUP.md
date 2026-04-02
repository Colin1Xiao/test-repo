# 📊 Notion 交易仪表盘 - 手动创建指南

## ⚠️ 自动创建失败原因

API 无法访问页面，需要**手动分享页面给 Integration**

---

## 🔧 解决方案：手动分享页面

### 步骤 1：打开 Notion 页面

访问：https://www.notion.so/32071d2818c48035919ffbdd05eea938

或直接打开你的 `🐉 小龙交易仪表盘` 页面

---

### 步骤 2：分享页面给 Integration

#### 方法 A：使用 "Connect to"

1. 在页面右上角点击 **`···`** (三个点)
2. 向下滚动找到 **`Connect to`** 或 **`Add connections`**
3. 点击后选择你的 Integration
   - 名称："小龙交易助手" 或你自定义的名称

#### 方法 B：使用 "Share"

1. 在页面右上角点击 **`Share`**
2. 在 "Share with" 部分找到你的 Integration
3. 点击 Integration 名称
4. 确保勾选以下权限：
   - ✅ **Read content**
   - ✅ **Insert content**
   - ✅ **Update content**

---

### 步骤 3：验证分享

分享成功后，页面应该显示：
```
Connected to: 小龙交易助手
```

---

### 步骤 4：重新运行创建脚本

```bash
cd /Users/colin/.openclaw/workspace
python3 create_notion_dashboard_full.py
```

---

## 🎨 备选方案：手动创建数据库

如果自动创建仍然失败，可以手动创建数据库：

### 数据库 1：💰 交易记录

1. 在页面中输入 `/database`
2. 选择 "Database - Inline"
3. 命名为：`💰 交易记录`
4. 添加以下列：
   - **Title** → 名称
   - **Select** → 标的 (BTC/ETH/SOL/UNI/AVAX/INJ)
   - **Select** → 方向 (Long/Short)
   - **Number** → 入场价格 ($ 格式)
   - **Number** → 出场价格 ($ 格式)
   - **Number** → 仓位
   - **Number** → 杠杆
   - **Number** → 盈亏金额 ($ 格式)
   - **Number** → 盈亏比例 (% 格式)
   - **Date** → 入场时间
   - **Date** → 出场时间
   - **Select** → 状态 (持仓中/已平仓/已止损)
   - **Text** → 备注

---

### 数据库 2：📡 信号记录

1. 在页面中输入 `/database`
2. 选择 "Database - Inline"
3. 命名为：`📡 信号记录`
4. 添加以下列：
   - **Title** → 名称
   - **Select** → 标的
   - **Select** → 信号类型 (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
   - **Number** → 置信度 (% 格式)
   - **Number** → 价格 ($ 格式)
   - **Date** → 时间
   - **Text** → 原因
   - **Select** → 结果 (盈利/亏损/持仓中)

---

### 数据库 3：📈 性能统计

1. 在页面中输入 `/database`
2. 选择 "Database - Inline"
3. 命名为：`📈 性能统计`
4. 添加以下列：
   - **Title** → 名称
   - **Date** → 日期
   - **Number** → 总盈亏 ($ 格式)
   - **Number** → 收益率 (% 格式)
   - **Number** → 交易次数
   - **Number** → 胜率 (% 格式)
   - **Number** → 最大回撤 (% 格式)
   - **Number** → 夏普比率
   - **Number** → 最大单笔盈利 ($ 格式)
   - **Number** → 最大单笔亏损 ($ 格式)

---

## 🎯 快速验证

### 检查 Integration 连接

1. 访问：https://www.notion.so/my-integrations
2. 点击你的 Integration
3. 查看 "Connected pages"
4. 应该看到 `🐉 小龙交易仪表盘`

---

## 📱 完成后的样子

```
┌─────────────────────────────────────┐
│ 🐉 小龙交易仪表盘                   │
│ 💡 小龙智能交易系统                 │
├─────────────────────────────────────┤
│ 💰 交易记录 [Database]              │
│ 📡 信号记录 [Database]              │
│ 📈 性能统计 [Database]              │
└─────────────────────────────────────┘
```

---

## ⚠️ 常见问题

### Q1: 找不到 "Connect to"？

**解决**:
- 使用 "Share" 按钮
- 在 "Share with" 中找到 Integration

---

### Q2: Integration 列表为空？

**解决**:
1. 访问：https://www.notion.so/my-integrations
2. 创建新的 Integration
3. 复制 Internal Integration Secret
4. 更新配置文件

---

### Q3: 权限不足？

**解决**:
- 确保 Integration 有 "Read" 和 "Insert" 权限
- 在 notion.so/my-integrations 中检查

---

## 🎊 完成后

1. ✅ 在 Notion 中有 3 个数据库
2. ✅ 交易系统会自动同步数据
3. ✅ 实时查看交易记录
4. ✅ 追踪信号和性能

---

**📖 需要帮助？告诉我具体问题！** 🐉
