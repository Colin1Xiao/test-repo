---
name: fix-python-imports
description: 修复 Python 项目中的导入错误
whenToUse: 当项目出现 import error、module not found 等问题时
allowedTools:
  - fs.read
  - fs.write
  - grep.search
  - exec.run
agent: code_fixer
userInvocable: true
executionContext: sandbox
effort: medium
memoryScope: project
tags:
  - python
  - imports
  - fix
---

# 修复 Python 导入错误

## 适用场景

- `ModuleNotFoundError: No module named 'xxx'`
- `ImportError: cannot import name 'xxx'`
- 循环导入问题
- 相对导入路径错误

## 执行步骤

1. **识别错误** - 读取错误信息，确定缺失的模块
2. **检查安装** - 使用 `pip list` 确认是否已安装
3. **安装依赖** - 如未安装，使用 `pip install` 安装
4. **检查导入路径** - 确认 `sys.path` 和 `PYTHONPATH`
5. **修复导入语句** - 修正相对/绝对导入

## 注意事项

- 优先使用项目现有的 `requirements.txt`
- 避免全局安装，优先使用虚拟环境
- 修改导入语句前先备份原文件

## 验证

- 重新运行脚本确认导入成功
- 运行相关测试用例
