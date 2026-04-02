---
name: triage-runtime-error
description: 诊断运行时错误
whenToUse: 系统出现异常、崩溃、错误时需要排障
allowedTools:
  - fs.read
  - grep.search
  - exec.run
  - task.list
  - task.output
agent: ops_agent
userInvocable: true
executionContext: default
effort: high
memoryScope: session
tags:
  - debug
  - error
  - triage
  - ops
---

# 运行时错误诊断

## 适用场景

- 程序崩溃
- 异常抛出
- 服务不可用
- 性能异常

## 诊断步骤

### 1. 收集错误信息

- 读取错误日志
- 记录错误类型和堆栈
- 确认发生时间和频率

### 2. 定位问题源

- 搜索相关日志
- 检查最近变更
- 确认影响范围

### 3. 分析根因

- 检查资源使用（内存/CPU/磁盘）
- 检查依赖服务状态
- 检查配置文件

### 4. 制定修复方案

- 临时缓解措施
- 永久修复方案
- 回滚计划

## 输出

- 错误根因分析
- 影响评估
- 修复建议
- 预防措施
