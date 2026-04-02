---
name: safe-git-status
description: 安全地检查 Git 仓库状态
whenToUse: 需要了解代码变更、提交历史、分支状态时
allowedTools:
  - exec.run
  - fs.read
  - grep.search
agent: code_reviewer
userInvocable: true
executionContext: default
effort: low
memoryScope: project
tags:
  - git
  - status
  - read-only
---

# 安全 Git 状态检查

## 适用场景

- 查看未提交的变更
- 检查分支状态
- 查看提交历史
- 对比文件差异

## 安全命令（只读）

```bash
git status
git diff
git log --oneline -10
git branch -a
git show --stat
```

## 禁止命令（需要额外审批）

```bash
git push
git commit
git merge
git rebase
git reset --hard
```

## 输出内容

- 修改的文件列表
- 新增/删除的文件
- 最近提交记录
- 当前分支信息
