---
name: summarize-task-log
description: 总结任务日志
whenToUse: 任务完成后需要生成摘要、归档记录时
allowedTools:
  - fs.read
  - task.output
  - task.list
agent: main_assistant
userInvocable: true
executionContext: default
effort: low
memoryScope: session
tags:
  - summary
  - log
  - task
---

# 任务日志总结

## 适用场景

- 任务完成后生成摘要
- 归档执行记录
- 生成工作报告
- 知识沉淀

## 总结内容

### 执行概览

- 任务 ID 和名称
- 开始/结束时间
- 执行时长
- 最终状态

### 关键事件

- 重要操作步骤
- 权限审批记录
- 异常和恢复

### 输出摘要

- 主要产出物
- 关键数据
- 变更文件列表

### 后续行动

- 待跟进事项
- 遗留问题
- 建议优化

## 输出格式

- 结构化摘要（JSON）
- 人类可读总结（Markdown）
