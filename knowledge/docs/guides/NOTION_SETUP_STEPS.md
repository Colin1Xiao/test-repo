# 📊 Notion 全新交易仪表盘创建指南

## 方案 2：创建独立仪表盘

---

## 🎯 步骤 1：在 Notion 中创建新页面

### 1.1 打开 Notion

访问：https://www.notion.so

### 1.2 创建新页面

1. 点击左侧边栏 **"+ Add a page"**
2. 或点击右上角 **"+ New page"**

### 1.3 设置页面信息

**页面名称**: 
```
🐉 小龙交易仪表盘 | Trading Dashboard
```

**页面图标**: 
- 点击 "Add icon"
- 搜索并选择：📊 或 🐉

**页面封面**（可选）:
- 点击 "Add cover"
- 选择渐变或上传图片

### 1.4 选择页面位置

**推荐位置**:
- 放在工作区根目录（方便访问）
- 或放在 "Colin's Home" 下

---

## 🎯 步骤 2：获取页面 ID

### 2.1 打开刚创建的页面

在 Notion 中找到并打开 `🐉 小龙交易仪表盘`

### 2.2 复制页面链接

1. 点击右上角 **`···`** (三个点)
2. 选择 **"Copy link"** 或 **"Copy link to page"**

### 2.3 提取页面 ID

链接格式：
```
https://www.notion.so/your-workspace/abc123def456...xyz
```

**页面 ID** 是最后一段：
```
abc123def456...xyz
```

**示例**:
```
链接：https://www.notion.so/colin-home/1c371d2818c48079a550ffdbc30acbb3
页面 ID: 1c371d2818c48079a550ffdbc30acbb3
```

---

## 🎯 步骤 3：配置页面 ID

### 3.1 编辑配置文件

```bash
cd /Users/colin/.openclaw/workspace
nano notion_config.json
```

### 3.2 填入页面 ID

```json
{
  "parent_page_id": "你的页面 ID（不带横线）",
  "dashboard_title": "🐉 小龙交易仪表盘",
  "use_existing_page": false
}
```

**示例**:
```json
{
  "parent_page_id": "1c371d2818c48079a550ffdbc30acbb3",
  "dashboard_title": "🐉 小龙交易仪表盘",
  "use_existing_page": false
}
```

### 3.3 保存文件

按 `Ctrl+O` 保存，按 `Ctrl+X` 退出

---

## 🎯 步骤 4：分享页面给 Integration

### 4.1 在 Notion 中打开页面

确保打开刚创建的 `🐉 小龙交易仪表盘` 页面

### 4.2 连接 Integration

1. 点击右上角 **`···`** (三个点)
2. 向下滚动找到 **"Connect to"**
3. 在弹出窗口中选择你的 Integration
   - 名称可能是："小龙交易助手" 或你自定义的名称

### 4.3 确认权限

确保 Integration 有以下权限：
- ✅ 读取页面内容
- ✅ 创建子页面
- ✅ 创建数据库
- ✅ 编辑内容

---

## 🎯 步骤 5：运行创建脚本

### 5.1 打开终端

```bash
cd /Users/colin/.openclaw/workspace
```

### 5.2 运行脚本

```bash
python3 create_notion_dashboard.py
```

### 5.3 等待完成

脚本会：
1. ✅ 验证页面 ID
2. ✅ 创建交易记录数据库
3. ✅ 创建信号记录数据库
4. ✅ 创建性能统计数据库
5. ✅ 添加美观的页面内容

---

## 🎨 创建的仪表盘内容

### 主页布局

```
┌─────────────────────────────────────────┐
│  🐉 小龙交易仪表盘                      │
│  📊 实时性能概览                        │
├─────────────────────────────────────────┤
│  💰 最新交易记录 (Database)             │
│  📡 最新信号 (Database)                 │
│  📈 性能统计 (Database)                 │
└─────────────────────────────────────────┘
```

### 数据库 1: 💰 交易记录

**13 个字段**:
- 标的、方向、入场价格、出场价格
- 仓位、杠杆、盈亏金额、盈亏比例
- 入场时间、出场时间、状态、备注

**视图**:
- 📊 Table View（表格视图）
- 📈 Board View（按状态分组）
- 📅 Calendar View（按日期）

---

### 数据库 2: 📡 信号记录

**8 个字段**:
- 标的、信号类型、置信度、价格
- 时间、原因、结果

**视图**:
- 📊 Table View（表格视图）
- 🔔 Filtered View（仅 STRONG 信号）

---

### 数据库 3: 📈 性能统计

**10 个字段**:
- 日期、总盈亏、收益率
- 交易次数、胜率、最大回撤
- 夏普比率、最大单笔盈利/亏损

**视图**:
- 📊 Table View（表格视图）
- 📈 Timeline View（时间线）
- 📊 Gallery View（卡片视图）

---

## 🎯 步骤 6：验证创建

### 6.1 在 Notion 中查看

1. 打开 `🐉 小龙交易仪表盘` 页面
2. 应该看到：
   - ✅ 欢迎标题
   - ✅ 3 个数据库
   - ✅ 使用说明

### 6.2 测试数据库

1. 点击任意数据库
2. 尝试添加一条记录
3. 确认所有字段正常

---

## ⚠️ 常见问题

### Q1: 找不到页面 ID？

**解决**:
- 页面 ID 在链接的最后一段
- 去掉所有横线 `-`
- 例如：`abc-123-def` → `abc123def`

---

### Q2: "Connect to" 找不到 Integration？

**解决**:
1. 确认已创建 Integration
2. 刷新 Notion 页面
3. 检查 Integration 是否激活

---

### Q3: 脚本报错 "Unauthorized"？

**解决**:
1. 检查 API 密钥是否正确
2. 确认页面已分享给 Integration
3. 重新运行脚本

---

### Q4: 数据库创建失败？

**解决**:
1. 检查页面权限
2. 确认 Integration 有创建数据库权限
3. 重新分享页面给 Integration

---

## 🎊 完成后效果

### 主页展示

```
🐉 小龙交易仪表盘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

欢迎使用小龙智能交易系统！

📊 实时性能
- 总盈亏：$X,XXX
- 收益率：XX%
- 胜率：XX%

💰 最新交易
[交易记录数据库]

📡 最新信号
[信号记录数据库]

📈 性能趋势
[性能统计数据库]
```

---

## 📱 自动化同步

交易系统会自动：
- ✅ 记录每笔交易到 Notion
- ✅ 记录每个信号到 Notion
- ✅ 每日更新性能统计
- ✅ 实时同步数据

---

## 🎯 快速命令

```bash
# 创建仪表盘
python3 create_notion_dashboard.py

# 查看配置
cat notion_config.json

# 测试连接
python3 -c "import requests; r=requests.get('https://api.notion.com/v1/users', headers={'Authorization': 'Bearer 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'}); print(r.json())"
```

---

## 📖 相关文档

- `NOTION_DASHBOARD_GUIDE.md` - 完整配置指南
- `create_notion_dashboard.py` - 创建脚本
- `notion_config.json` - 配置文件

---

**🎉 准备好创建专业交易仪表盘了！** 📊🐉

**下一步**: 在 Notion 创建页面并获取页面 ID！
