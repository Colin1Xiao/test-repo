# ADR 0001 - 目录重构

## 背景
原始项目结构适合 bot 工程，不适合平台工程扩展。

## 决策
引入 schemas / marketdata / connectors / execution / portfolio / storage / audit / controlplane 等领域目录。

## 原因
- 降低 core 膨胀
- 统一数据模型
- 便于后续接 replay / paper / canary / cockpit

## 影响
- 需要迁移 exchange -> connectors
- 需要迁移 core/executor -> execution
- 需要重排 tests / config / runtime
