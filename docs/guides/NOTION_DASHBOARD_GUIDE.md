# 📊 Notion 交易仪表盘配置指南

## 快速开始

### 1. 在 Notion 中创建父页面

1. 打开 Notion
2. 点击 "+ Add a page"
3. 输入页面名称：`小龙交易仪表盘`
4. 选择一个图标（推荐：📊 或 🐉）

### 2. 获取页面 ID

1. 打开刚创建的页面
2. 点击右上角 `···`
3. 选择 `Copy link`
4. 页面 ID 是链接中 `-` 后面的一串字符
   - 例如：`https://notion.so/your-workspace/abc123...xyz`
   - 页面 ID：`abc123...xyz`

### 3. 配置页面 ID

编辑 `notion_config.json`:
```json
{
  "parent_page_id": "你的页面 ID",
  "dashboard_title": "🐉 小龙交易仪表盘"
}
```

### 4. 分享页面给 Integration

1. 在页面中点击右上角 `···`
2. 选择 `Connect to`
3. 选择你的 Integration

### 5. 运行创建脚本

```bash
python3 create_notion_dashboard.py
```

## 仪表盘结构

### 主页展示
- 📊 实时性能概览
- 💰 最新交易记录
- 📡 最新信号
- 📈 收益曲线图

### 数据库
1. **交易记录** - 所有交易详情
2. **信号记录** - 所有交易信号
3. **性能统计** - 每日/周/月性能

## 自动化更新

交易系统会自动:
- ✅ 记录每笔交易
- ✅ 记录每个信号
- ✅ 更新性能统计
- ✅ 同步到 Notion

## 查看仪表盘

访问你的 Notion 工作区，打开 `小龙交易仪表盘` 页面即可查看实时数据！
