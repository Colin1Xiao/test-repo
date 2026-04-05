# MCP 完整生态层架构设计

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标与范围

### 1.1 核心目标

把 OpenClaw 从：

> 能理解和执行代码的系统

升级为：

> 能连接外部工作流的工作操作系统

**一句话定义**:

> Agent Teams 负责分工执行，MCP 负责连接外部工作生态。

### 1.2 核心价值

| 能力 | 获得的外部连接 |
|------|---------------|
| GitHub | PR/Issue/Code Review |
| Browser | 网页自动化/信息获取 |
| Slack/Telegram | 团队协作通知 |
| Docs/Drive | 文档协作 |
| CI/CD | 构建部署 |
| Issue Tracker | 任务管理 |

### 1.3 不做的事情（边界）

| 不做 | 原因 |
|------|------|
| 另起权限体系 | MCP 服从现有 PermissionEngine |
| 独立 Agent 调度 | 通过 Agent Teams 统一调度 |
| 过度抽象 | 先接高价值 Server，再扩展 |

---

## 二、分阶段拆分

### 2.1 阶段划分

```
Sprint 3A: MCP Core Registry
    ↓
Sprint 3B: MCP Policy & Approval
    ↓
Sprint 3C: MCP Resources Layer
    ↓
Sprint 3D: Agent/MCP Integration
```

### 2.2 Sprint 3A: MCP Core Registry

**目标**: 建立基础注册与命名层

**核心模块**:
| 模块 | 职责 |
|------|------|
| `mcp_registry.ts` | Server/Tool/Capability 注册 |
| `mcp_naming.ts` | 统一命名规范 |
| `capability_index.ts` | 能力索引与查询 |

**第一版输出对象**:
```typescript
type McpServerProfile = {
  name: string;
  version: string;
  description: string;
  tools: McpToolProfile[];
  resources?: McpResourceProfile[];
  capabilities: McpCapability[];
  health: ServerHealth;
}

type McpToolProfile = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

type McpCapability = 
  | 'tool_call'
  | 'resource_list'
  | 'resource_read'
  | 'resource_search'
  | 'prompt';
```

**验收标准**:
- [ ] 统一 mcp__{server}__{tool} 命名
- [ ] server/tool/capability 注册
- [ ] agent 可查询可用 MCP 能力

---

### 2.3 Sprint 3B: MCP Policy & Approval

**目标**: 把权限与审批纳入主干

**核心模块**:
| 模块 | 职责 |
|------|------|
| `mcp_policy.ts` | MCP 权限策略 |
| `mcp_approval.ts` | MCP 审批流程 |
| `mcp_access_control.ts` | MCP 访问控制 |

**第一版输出对象**:
```typescript
type McpPermissionPolicy = {
  server: string;
  allowedTools: string[];
  deniedTools: string[];
  requiresApproval: string[];
  resourcePermissions: ResourcePermission[];
}

type ResourcePermission = {
  resourceType: string;
  accessLevel: 'read' | 'write' | 'admin';
  requiresApproval: boolean;
}
```

**验收标准**:
- [ ] server 级权限
- [ ] tool 级权限
- [ ] resource read/write 权限
- [ ] pending server 审批语义

---

### 2.4 Sprint 3C: MCP Resources Layer

**目标**: 把 MCP 从工具调用推进到资源语义

**核心模块**:
| 模块 | 职责 |
|------|------|
| `resource_registry.ts` | 资源注册 |
| `resource_reader.ts` | 资源读取 |
| `resource_search.ts` | 资源搜索 |

**第一版输出对象**:
```typescript
type McpResource = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  server: string;
}

type ResourceQuery = {
  server?: string;
  type?: string;
  query?: string;
}
```

**验收标准**:
- [ ] list resources
- [ ] read resources
- [ ] search resources
- [ ] agent 可把 MCP resource 当成一等上下文来源

---

### 2.5 Sprint 3D: Agent/MCP Integration

**目标**: 把 MCP 变成 Agent Teams 的内生能力

**核心模块**:
| 模块 | 职责 |
|------|------|
| `mcp_context_adapter.ts` | MCP 上下文适配 |
| `agent_mcp_requirements.ts` | Agent MCP 需求声明 |
| `server_health.ts` | Server 健康检查 |

**第一版输出对象**:
```typescript
type AgentSpec = {
  // ... 现有字段
  requiredMcpServers: string[];
  optionalMcpServers: string[];
}

type McpContext = {
  serverContexts: Record<string, ServerContext>;
  resourceContexts: ResourceContext[];
  toolContexts: ToolContext[];
}
```

**验收标准**:
- [ ] AgentSpec 支持 requiredMcpServers
- [ ] AgentSpec 支持 optionalMcpServers
- [ ] planner/reviewer/release 等角色可声明 MCP 依赖
- [ ] server health 与治理接入 runtime

---

## 三、统一命名规范

### 3.1 MCP 命名格式

```
mcp__{server}__{tool}
mcp__{server}__resource__{resourceType}
mcp__{server}__prompt__{promptName}
```

**示例**:
```
mcp__github__create_issue
mcp__github__resource__pull_request
mcp__browser__navigate
mcp__slack__send_message
```

### 3.2 Server 命名规范

| Server | 命名 | 工具前缀 |
|--------|------|---------|
| GitHub | `github` | `github__` |
| Browser | `browser` | `browser__` |
| Slack | `slack` | `slack__` |
| Telegram | `telegram` | `telegram__` |
| Google Drive | `gdrive` | `gdrive__` |
| CI/CD | `cicd` | `cicd__` |

### 3.3 Tool 命名规范

**格式**: `{action}_{target}`

**示例**:
```
create_issue
get_pull_request
list_files
send_message
navigate_page
```

---

## 四、注册流程

### 4.1 Server 注册流程

```
1. Server 启动
   ↓
2. 调用 MCP Registry 注册
   ↓
3. 注册 tools/resources/capabilities
   ↓
4. 设置权限策略
   ↓
5. 健康检查
   ↓
6. 可供 Agent 查询使用
```

### 4.2 注册接口

```typescript
interface IMcpRegistry {
  // Server 注册
  registerServer(server: McpServerProfile): Promise<void>;
  
  // Server 注销
  unregisterServer(serverName: string): Promise<void>;
  
  // 查询 Server
  getServer(serverName: string): Promise<McpServerProfile | null>;
  
  // 列出所有 Server
  listServers(): Promise<McpServerProfile[]>;
  
  // 查询工具
  getTool(serverName: string, toolName: string): Promise<McpToolProfile | null>;
  
  // 查询能力
  hasCapability(serverName: string, capability: McpCapability): Promise<boolean>;
}
```

---

## 五、与 PermissionEngine 集成

### 5.1 权限检查流程

```
Agent 请求 MCP Tool
   ↓
PermissionEngine 检查
   ├─ 检查 server 级权限
   ├─ 检查 tool 级权限
   ├─ 检查 resource 权限
   └─ 检查是否需要审批
   ↓
允许/拒绝/pending
```

### 5.2 权限策略

```typescript
type McpPermissionRule = {
  server: string;
  tool?: string;
  resource?: string;
  action: 'allow' | 'deny' | 'ask';
  conditions: PermissionCondition[];
}

type PermissionCondition = {
  type: 'role' | 'team' | 'context';
  value: string;
}
```

### 5.3 与现有 PermissionEngine 对接

```typescript
// 在 PermissionEngine 中添加 MCP 规则评估
class PermissionEngine {
  async evaluate(input: PermissionCheckInput): Promise<PermissionDecision> {
    // 现有逻辑...
    
    // MCP 规则评估
    if (input.tool?.startsWith('mcp__')) {
      const mcpDecision = await this.evaluateMcpRule(input);
      if (mcpDecision) {
        return mcpDecision;
      }
    }
    
    // 默认逻辑...
  }
}
```

---

## 六、与 AgentSpec 集成

### 6.1 AgentSpec 扩展

```typescript
type AgentSpec = {
  // 现有字段
  id: string;
  role: string;
  allowedTools: string[];
  forbiddenTools: string[];
  budget: BudgetSpec;
  
  // MCP 字段（新增）
  requiredMcpServers: string[];
  optionalMcpServers: string[];
  mcpPermissions: McpPermissionSpec;
}

type McpPermissionSpec = {
  allowedServers: string[];
  deniedServers: string[];
  requiresApproval: string[];
}
```

### 6.2 角色 MCP 依赖示例

```typescript
// Planner Agent
const plannerSpec: AgentSpec = {
  id: 'planner',
  role: 'planner',
  requiredMcpServers: ['github'],
  optionalMcpServers: ['slack', 'cicd'],
  // ...
};

// Release Agent
const releaseSpec: AgentSpec = {
  id: 'release_agent',
  role: 'release_agent',
  requiredMcpServers: ['github', 'cicd'],
  optionalMcpServers: ['slack', 'telegram'],
  // ...
};
```

---

## 七、支持语言优先级

### 7.1 第一批 (P0)

| Server | 优先级 | 说明 |
|--------|--------|------|
| GitHub | P0 | PR/Issue/Code Review |
| Browser | P0 | 网页自动化 |
| Slack | P0 | 团队通知 |
| Telegram | P0 | 个人通知 |

### 7.2 第二批 (P1)

| Server | 优先级 | 说明 |
|--------|--------|------|
| Google Drive | P1 | 文档协作 |
| CI/CD | P1 | 构建部署 |

### 7.3 第三批 (P2)

| Server | 优先级 | 说明 |
|--------|--------|------|
| Issue Tracker | P2 | 任务管理 (Jira/Linear) |
| Notion | P2 | 知识库 |

---

## 八、MVP 验收标准

### 8.1 Sprint 3A MVP

- [ ] 统一 mcp__{server}__{tool} 命名
- [ ] server/tool/capability 注册
- [ ] agent 可查询可用 MCP 能力
- [ ] 支持 GitHub/Browser/Slack 注册

### 8.2 Sprint 3B MVP

- [ ] server 级权限
- [ ] tool 级权限
- [ ] resource read/write 权限
- [ ] pending server 审批语义

### 8.3 Sprint 3C MVP

- [ ] list resources
- [ ] read resources
- [ ] search resources
- [ ] agent 可消费 MCP resource

### 8.4 Sprint 3D MVP

- [ ] AgentSpec 支持 requiredMcpServers
- [ ] AgentSpec 支持 optionalMcpServers
- [ ] planner/release 可声明 MCP 依赖
- [ ] server health 接入 runtime

---

## 九、目录结构

```
src/mcp/
  # 3A: Core Registry
  mcp_registry.ts
  mcp_naming.ts
  capability_index.ts
  
  # 3B: Policy & Approval
  mcp_policy.ts
  mcp_approval.ts
  mcp_access_control.ts
  
  # 3C: Resources Layer
  resource_registry.ts
  resource_reader.ts
  resource_search.ts
  
  # 3D: Agent Integration
  mcp_context_adapter.ts
  agent_mcp_requirements.ts
  server_health.ts
  
  # Servers (实现)
  servers/
    github/
      index.ts
      tools/
        create_issue.ts
        get_pull_request.ts
        list_files.ts
    browser/
      index.ts
      tools/
        navigate.ts
        screenshot.ts
        extract_content.ts
    slack/
      index.ts
      tools/
        send_message.ts
        list_channels.ts
  
  # Types
  types.ts
  index.ts
```

---

## 十、依赖关系

### 10.1 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|------|
| `@modelcontextprotocol/sdk` | MCP SDK | P0 |
| `octokit` | GitHub API | P0 |
| `playwright` | Browser 自动化 | P0 |
| `@slack/web-api` | Slack API | P0 |

### 10.2 内部依赖

| 模块 | 依赖 |
|------|------|
| MCP Registry | PermissionEngine |
| MCP Policy | PermissionEngine |
| Agent Integration | Agent Teams (types) |
| Server Health | Runtime (health check) |

---

## 十一、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| MCP Server 不稳定 | 中 | health check + fallback |
| 权限模型复杂 | 中 | 先做简单规则，再扩展 |
| 外部 API 限流 | 低 | rate limiting + cache |
| 认证管理复杂 | 中 | 统一认证层 + 密钥管理 |

---

**下一步**: 开始 Sprint 3A 实现

---

_MCP 完整生态层是让 Agent Teams 进入真实工作环境的关键。_
