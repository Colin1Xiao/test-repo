# 规划类新技能架构设计

## 概述

本架构设计用于创建一类"规划类"技能，支持项目管理、任务规划、目标追踪等场景。设计遵循 OpenClaw 技能规范，具备分层存储、状态管理、模板化输出等特性。

---

## 1. 技能定位

### 1.1 功能定位

| 维度 | 说明 |
|------|------|
| **核心能力** | 项目/任务规划、里程碑管理、进度追踪、资源分配 |
| **触发场景** | "帮我规划XXX项目"、"制定XXX计划"、"分解XXX任务" |
| **权限级别** | 常开但只读（默认）/ 按需开启（写入操作） |
| **数据存储** | 本地 SQLite + Markdown 文件混合存储 |

### 1.2 与其他技能的关系

```
规划类技能 (planning-pro)
    ├── 读取: gcal-pro (日历事件)
    ├── 读取: apple-reminders (提醒事项)
    ├── 调用: skill-mermaid-diagrams (甘特图/流程图)
    ├── 调用: chart-image (进度图表)
    ├── 调用: lite-sqlite (数据存储)
    └── 可选: notion (同步到 Notion 数据库)
```

---

## 2. 目录结构

```
planning-pro/
├── SKILL.md                    # 主技能文档
├── README.md                   # 快速开始指南
├── _meta.json                  # 技能元数据
├── package.json               # Node.js 依赖（如需要）
│
├── assets/                    # 静态资源
│   ├── templates/             # 规划模板
│   │   ├── project-plan.md    # 项目规划模板
│   │   ├── sprint-plan.md     # 迭代规划模板
│   │   ├── goal-tracker.md    # 目标追踪模板
│   │   └── weekly-review.md   # 周回顾模板
│   ├── examples/              # 示例文件
│   │   ├── example-project.json
│   │   └── example-gantt.mmd
│   └── schema/                # JSON Schema 定义
│       ├── project.schema.json
│       └── task.schema.json
│
├── scripts/                   # 可执行脚本
│   ├── init.mjs              # 初始化项目数据库
│   ├── plan.mjs              # 生成规划文档
│   ├── track.mjs             # 进度追踪更新
│   ├── export.mjs            # 导出报告
│   └── sync.mjs              # 同步外部日历
│
├── src/                      # 源代码（如需要复杂逻辑）
│   ├── core/
│   │   ├── Project.js        # 项目模型
│   │   ├── Task.js           # 任务模型
│   │   └── Milestone.js      # 里程碑模型
│   ├── storage/
│   │   ├── SQLiteStore.js    # SQLite 存储层
│   │   └── FileStore.js      # 文件存储层
│   └── utils/
│       ├── date.js           # 日期工具
│       └── template.js       # 模板渲染
│
├── references/               # 参考文档
│   ├── planning-guide.md     # 规划方法论
│   └── api-reference.md      # API 文档
│
└── tests/                    # 测试用例
    ├── fixtures/
    └── integration/
```

---

## 3. 数据模型

### 3.1 核心实体

```typescript
// 项目 (Project)
interface Project {
  id: string;                    // UUID
  name: string;                  // 项目名称
  description: string;           // 项目描述
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: Date;
  targetDate: Date;
  actualEndDate?: Date;
  progress: number;              // 0-100
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 任务 (Task)
interface Task {
  id: string;
  projectId: string;
  parentId?: string;             // 支持子任务
  name: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  dependencies: string[];        // 依赖的其他任务ID
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 里程碑 (Milestone)
interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: Date;
  completedDate?: Date;
  status: 'pending' | 'achieved' | 'missed';
  criteria: string[];            // 达成标准
}

// 时间记录 (TimeEntry)
interface TimeEntry {
  id: string;
  taskId: string;
  date: Date;
  hours: number;
  description: string;
}
```

### 3.2 数据库 Schema (SQLite)

```sql
-- 项目表
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning',
    priority TEXT DEFAULT 'medium',
    start_date INTEGER,
    target_date INTEGER,
    actual_end_date INTEGER,
    progress REAL DEFAULT 0,
    tags TEXT,  -- JSON array
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 任务表
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    priority TEXT DEFAULT 'medium',
    assignee TEXT,
    estimated_hours REAL,
    actual_hours REAL DEFAULT 0,
    start_date INTEGER,
    due_date INTEGER,
    completed_at INTEGER,
    dependencies TEXT,  -- JSON array of task IDs
    tags TEXT,  -- JSON array
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 里程碑表
CREATE TABLE milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_date INTEGER NOT NULL,
    completed_date INTEGER,
    status TEXT DEFAULT 'pending',
    criteria TEXT,  -- JSON array
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 时间记录表
CREATE TABLE time_entries (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    hours REAL NOT NULL,
    description TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_milestones_project ON milestones(project_id);
```

---

## 4. 核心功能模块

### 4.1 项目规划 (Planning)

**功能:**
- 创建新项目
- 定义项目目标、范围、时间线
- 分解工作结构 (WBS)
- 生成项目章程文档

**输入:**
```json
{
  "name": "网站重构项目",
  "description": "将旧网站迁移到新架构",
  "targetDate": "2026-06-01",
  "phases": [
    {"name": "需求分析", "duration": "2周"},
    {"name": "设计", "duration": "3周"},
    {"name": "开发", "duration": "8周"},
    {"name": "测试", "duration": "3周"},
    {"name": "上线", "duration": "1周"}
  ]
}
```

**输出:**
- 项目规划文档 (Markdown)
- 甘特图 (Mermaid)
- 任务清单 (可导入到日历/提醒)

### 4.2 任务管理 (Task Management)

**功能:**
- 创建/编辑/删除任务
- 任务分解 (支持无限层级)
- 设置依赖关系
- 分配责任人
- 估算工时

**命令示例:**
```bash
# 添加任务
node scripts/plan.mjs task add --project "网站重构" --name "设计首页原型" --due "2026-04-01"

# 更新进度
node scripts/track.mjs update --task "task-id" --progress 50 --hours 4

# 查看今日任务
node scripts/plan.mjs list --today
```

### 4.3 进度追踪 (Tracking)

**功能:**
- 更新任务状态
- 记录实际工时
- 计算项目进度
- 识别延期风险
- 生成燃尽图/燃起图

**追踪视图:**
```
项目: 网站重构 (67% 完成)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

本周完成:
  ✅ 完成数据库设计
  ✅ 搭建开发环境
  
进行中:
  🔄 API 接口开发 (3/5)
  
即将到期:
  ⚠️ 首页设计 (2天后截止)
  
已延期:
  ❌ 用户调研 (延期3天)
```

### 4.4 报告生成 (Reporting)

**报告类型:**
- 项目状态报告
- 周/月进度报告
- 时间追踪报告
- 资源利用率报告
- 风险分析报告

**输出格式:**
- Markdown 文档
- PDF (通过转换)
- 图表 (PNG/SVG)

---

## 5. 集成能力

### 5.1 日历集成

```javascript
// 同步里程碑到日历
await planning.syncToCalendar({
  provider: 'gcal-pro',  // 或 'apple-calendar-macos'
  projectId: 'project-id',
  includeTasks: true,    // 是否同步具体任务
  reminderDays: [1, 3]   // 提前1天和3天提醒
});
```

### 5.2 图表生成

```javascript
// 生成甘特图
await planning.generateGantt({
  projectId: 'project-id',
  output: 'diagrams/gantt.mmd'
});

// 生成进度图表
await planning.generateChart({
  type: 'burndown',
  sprint: 'sprint-1',
  output: 'charts/burndown.png'
});
```

### 5.3 Notion 同步 (可选)

```javascript
// 双向同步到 Notion 数据库
await planning.syncToNotion({
  databaseId: 'notion-db-id',
  projectId: 'project-id',
  direction: 'bidirectional'  // 'to_notion' | 'from_notion'
});
```

---

## 6. 使用模式

### 6.1 快速规划模式

```
用户: "帮我规划一个3个月的APP开发项目"

Agent:
1. 询问关键信息（团队规模、主要功能、截止日期）
2. 创建项目结构和任务分解
3. 生成甘特图和里程碑
4. 输出项目规划文档
5. 可选：同步到日历
```

### 6.2 日常追踪模式

```
用户: "今天完成了登录功能开发，花了6小时"

Agent:
1. 找到对应任务
2. 更新任务状态为 "done"
3. 记录实际工时
4. 更新项目进度
5. 显示更新后的项目状态
```

### 6.3 周回顾模式

```
用户: "生成本周项目报告"

Agent:
1. 统计本周完成的任务
2. 计算工时和进度
3. 识别延期任务和风险
4. 生成周报告文档
5. 可选：生成燃尽图
```

### 6.4 目标追踪模式

```
用户: "设定一个学习新语言的目标"

Agent:
1. 创建目标项目
2. 分解为阶段性里程碑
3. 设置每周学习任务
4. 建立追踪机制
5. 定期提醒和进度检查
```

---

## 7. 权限与安全

### 7.1 权限分级

| 操作 | 权限级别 | 说明 |
|------|----------|------|
| 查看项目/任务 | 常开 | 只读操作，无需确认 |
| 创建项目 | 按需开启 | 需用户明确授权 |
| 修改任务状态 | 按需开启 | 需用户明确授权 |
| 删除数据 | 按需开启 | 需二次确认 |
| 同步到外部服务 | 按需开启 | 需用户配置和授权 |

### 7.2 数据安全

- 所有数据存储在本地 SQLite 数据库
- 不自动上传敏感项目信息到云端
- 支持导出/备份到用户指定位置
- 遵循技能策略中的文件白名单规则

---

## 8. SKILL.md 模板

```yaml
---
name: Planning Pro
slug: planning-pro
version: 1.0.0
description: 专业项目规划与任务管理技能，支持项目创建、任务分解、进度追踪、报告生成。适用于个人项目管理、团队协作、目标追踪等场景。
triggers: ["规划项目", "制定计划", "任务管理", "进度追踪", "生成报告", "创建里程碑"]
metadata:
  clawdbot:
    emoji: "📋"
    requires:
      bins: ["node"]
    os: ["linux", "darwin", "win32"]
    configPaths: ["~/.openclaw/planning/"]
---

# Planning Pro

专业项目规划与任务管理技能。

## 功能特性

- 📁 **项目管理**: 创建、编辑、归档项目
- ✅ **任务管理**: 支持层级任务、依赖关系
- 📅 **里程碑追踪**: 关键节点管理
- 📊 **进度可视化**: 甘特图、燃尽图
- ⏱️ **时间追踪**: 记录实际工时
- 📄 **报告生成**: 多格式导出

## 快速开始

### 初始化

```bash
node scripts/init.mjs --name "我的项目"
```

### 创建任务

```bash
node scripts/plan.mjs task add \
  --project "我的项目" \
  --name "设计原型" \
  --due "2026-04-01"
```

### 更新进度

```bash
node scripts/track.mjs update \
  --task "task-id" \
  --status "done" \
  --hours 6
```

### 生成报告

```bash
node scripts/export.mjs report \
  --project "我的项目" \
  --type weekly \
  --output reports/week-12.md
```

## 详细用法

[...详细文档...]

## 集成

### 日历同步

支持同步到 Google Calendar 或 Apple Calendar。

### Notion 同步

支持双向同步到 Notion 数据库。

### 图表生成

调用 skill-mermaid-diagrams 生成甘特图。

## 数据存储

默认存储位置: `~/.openclaw/planning/projects.db`

## 安全

- 本地存储，不上传云端
- 支持加密备份
- 遵循最小权限原则
```

---

## 9. 实现路线图

### Phase 1: 基础功能 (MVP)
- [ ] 项目 CRUD 操作
- [ ] 任务 CRUD 操作
- [ ] 基础进度计算
- [ ] Markdown 报告导出

### Phase 2: 进阶功能
- [ ] 甘特图生成
- [ ] 里程碑管理
- [ ] 时间追踪
- [ ] 日历集成

### Phase 3: 智能化
- [ ] AI 辅助任务分解
- [ ] 延期风险预测
- [ ] 资源分配建议
- [ ] 自然语言交互

### Phase 4: 生态集成
- [ ] Notion 双向同步
- [ ] 多用户协作
- [ ] Webhook 通知
- [ ] 移动端支持

---

## 10. 命名建议

| 候选名称 | 说明 |
|----------|------|
| `planning-pro` | 专业规划，简洁明了 |
| `project-manager` | 项目管理，功能明确 |
| `task-master` | 任务大师，强调任务管理 |
| `goal-tracker` | 目标追踪，侧重目标导向 |
| `milestone` | 里程碑，强调关键节点 |

**推荐**: `planning-pro` - 简洁、专业、易于理解

---

## 11. 与其他技能的协作示例

### 场景: 规划新项目并同步到日历

```
用户: "帮我规划一个2个月的博客改版项目，并添加到日历"

Agent 执行流程:
1. 使用 planning-pro 创建项目和任务
2. 使用 skill-mermaid-diagrams 生成甘特图
3. 使用 gcal-pro 同步里程碑到日历
4. 使用 apple-reminders 创建关键任务提醒
5. 使用 markdown-formatter 美化输出报告
```

### 场景: 周回顾并生成图表

```
用户: "生成本周项目进度报告，包含图表"

Agent 执行流程:
1. 使用 planning-pro 查询本周数据
2. 使用 chart-image 生成进度图表
3. 使用 skill-mermaid-diagrams 生成燃尽图
4. 使用 summarize-pro 生成摘要
5. 整合输出完整报告
```

---

*架构设计完成 - 2026-03-14*