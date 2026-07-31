# FitLog 后端（fitlog-backend）

统一独立后端，承载两类能力：

1. **图片托管 API** —— 把 1324 个 GIF 外托，提供 `exerciseId → URL` 映射。
2. **AI Agent** —— `action = chat / search / insight`，复用 rag-kb-demo 的 RAG 方法论。

> 小程序**仍保留 CloudBase 做训练数据读写**；只有「AI 问答 / 图片」走本后端。前端同时连两套。

## 技术栈

Java 17 · Spring Boot 3 · MySQL 8 · MyBatis（用户写 SQL 习惯）。embedding 存 MySQL JSON 字段，检索在应用内算余弦，不引入 PGVector。

## 目录与文档

- `docs/backend-design.md` —— 后端详细设计（表结构 / API 契约 / RAG 检索 / 图片存储 / 里程碑）
- `sql/schema.sql` —— 三张表 DDL
- `src/main/java/com/fitlog/backend/` —— 源码

## 运行

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

- `local` profile 才加载含密钥的 `application-local.yml`（默认不加载，避免误提交）。
- 未配置 LLM key 时，Agent 端点自动降级为 echo，图片 API 仍可独立使用。
- 数据源 / LLM / COS 配置走环境变量（见 `application.yml` 的 `${...}` 占位）。

## 分支流（§9）

`feature/backend` → `dev` → `main`，走 merge commit，禁止直推 main。
