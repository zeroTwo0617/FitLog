# FitLog 后端详细设计（Spring Boot + MySQL）

> 状态：详细设计评审版（M1b 前）
> 关联文档：`fitness-miniprogram/docs/agent-design.md`（整体架构 / 角色 / 里程碑）
> 作者：Senior Developer
> 日期：2026-07-29

---

## 1. 概述

- **定位**：统一独立后端，承载两类能力——
  1. **图片托管 API**：把 1324 个 GIF 外托，提供 `exerciseId → URL` 映射。
  2. **AI Agent**：`action = chat / search / insight`，复用 rag-kb-demo 的 RAG 方法论。
- **与小程序的关系**：小程序**仍保留 CloudBase 做训练数据读写**；只有「AI 问答 / 图片」走本后端。即前端同时连两套：CloudBase（数据）+ 本后端（AI/图片）。
- **调用方式**：小程序 `wx.request` → `https://域名/api/...`；需在微信公众平台配 **request 合法域名**（API）与 **downloadFile 合法域名**（图片）。
- **技术栈**：Java 17 + Spring Boot 3.x + **MySQL 8（用户只会 MySQL）+ MyBatis（用户写 SQL 习惯）**；图片走对象存储（腾讯云 COS / S3）或服务器静态目录 + CDN。

---

## 2. 模块结构（`fitlog-backend/`）

```
fitlog-backend/
├── src/main/java/com/fitlog/backend/
│   ├── controller/
│   │   ├── AgentController.java      # POST /api/agent
│   │   └── MediaController.java       # GET  /api/media/**
│   ├── service/
│   │   ├── AgentService.java          # action 分发 + 编排
│   │   ├── RagService.java            # 建库 / 检索 / 余弦
│   │   ├── MediaService.java          # 上传 / 取 URL
│   │   └── StatsService.java          # insight 工具层（统计）
│   ├── repository/
│   │   └── *.java                     # MyBatis Mapper 接口
│   ├── model/
│   │   ├── entity/                    # ExercisesMedia / KbChunk / AgentSession
│   │   └── dto/                       # AgentRequest / AgentResponse / MediaDto
│   ├── config/
│   │   ├── WebConfig.java             # CORS / 拦截器
│   │   └── LlmConfig.java             # LLM/Embedding client bean
│   └── util/
│       └── VectorUtil.java           # cosine 相似度
├── src/main/resources/
│   ├── application.yml                # 数据源 / LLM / COS
│   ├── mapper/                        # MyBatis xml
│   └── db/schema.sql                  # 建表
├── scripts/build_kb.py|.js            # 离线建库（读 preset + 嵌向量写库）
├── pom.xml
└── README.md
```

---

## 3. 数据库设计（MySQL 8）

> embedding 用 `JSON` 数组存浮点；检索在应用内算余弦（1324 条无压力），**不引入 PGVector**。

```sql
-- 图片映射：exerciseId -> 存储 key / URL
CREATE TABLE exercises_media (
  exercise_id  VARCHAR(64)  PRIMARY KEY,
  media_type   VARCHAR(16)  NOT NULL DEFAULT 'gif',
  storage_key  VARCHAR(255) NOT NULL,         -- COS key 或静态路径
  url          VARCHAR(512) DEFAULT NULL,     -- 构建/同步时生成
  width        INT          DEFAULT NULL,
  height       INT          DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- RAG 知识块 + 向量
CREATE TABLE kb_chunks (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  source      VARCHAR(16)  NOT NULL,          -- 'exercise' | 'user_history'
  ref_id      VARCHAR(64)  DEFAULT NULL,
  chunk_text  TEXT         NOT NULL,
  embedding   JSON         NOT NULL,          -- [0.12, -0.03, ...]
  meta_json   JSON         DEFAULT NULL,      -- {bodyPart, target, equipment}
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agent 多轮记忆
CREATE TABLE agent_sessions (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  openid      VARCHAR(64)  NOT NULL,
  messages    JSON         NOT NULL,          -- [{role,content,ts}]
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 训练记录（WORKOUTS/SETS）**仍在 CloudBase**，不搬过来；后端仅在需要用户上下文时由小程序传入近期摘要（见 §8、§10-M3b）。

---

## 4. API 契约

Base：`https://api.fitlog.com`（占位，需备案域名）

### 4.1 图片
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/media/exercise/:exerciseId` | 返回 `{ url }`（或直接 302 重定向到图片） |
| GET | `/api/media/map?ids=a,b,c` | 批量：`{ "a":"url", "b":"url" }` |
| GET | `/api/media/list?bodyPart=&equipment=` | 按条件筛选返回列表 |
| POST | `/api/admin/media/sync` | 管理端：上传 GIF 到存储并写 `exercises_media`（也可由离线脚本完成） |

### 4.2 Agent
`POST /api/agent`
```jsonc
// 请求
{
  "openid": "oABC...",          // 小程序传入
  "action": "chat" | "search" | "insight",
  "query": "我这周练得怎么样",
  "sessionId": "可选，多轮用",
  "range": "month" | "30d" | "all",   // insight
  "filters": { "bodyPart": "胸", "equipment": "哑铃" }, // search
  "recentSummary": "可选，近期训练摘要（MVP 由小程序传入）"
}
// 响应
// chat  -> SSE text/event-stream，逐 token 推送
// search-> { "results": [ {exerciseId, name, score, reason} ] }
// insight-> { "stats": {...}, "report": "..." }
// 错误  -> { "ok": false, "code": "EMBED_FAIL|LLM_FAIL|NO_DATA|BAD_ACTION", "msg": "..." }
```

### 4.3 健康 / 自检
- `GET /api/health`
- `GET /api/agent/llm-status` → `{ available: true/false }`（确认 key 已加载，复用 rag-kb-demo 思路）

---

## 5. RAG 检索实现（MySQL + 应用内余弦）

- **Embedding**：调可插拔 embedding 接口 → `float[]`。
- **建库（离线脚本 `scripts/build_kb`）**：
  1. 读 `fitness-miniprogram/data/exercises.preset.js`（1324 条）→ 每条 chunk（名称/目标肌群/做法/注意事项）。
  2. （可选）读用户历史快照 → `source='user_history'` chunk。
  3. 批量 embed → `INSERT kb_chunks(source, ref_id, chunk_text, embedding, meta_json)`。
- **查询**：
  1. embed query。
  2. `SELECT * FROM kb_chunks [WHERE source=?]` 载入内存。
  3. `VectorUtil.cosine(queryVec, row.embedding)` → 排序取 top-k。
  4. （进阶，复用 rag-kb-demo）**混合检索**：关键词（LIKE chunk_text / meta）+ 向量 → RRF 融合(k=60) → Rerank（启发式 / LLM）。
  5. 拼 context → LLM 生成。
- `VectorUtil.cosine(float[] a, float[] b)`：点积 / (|a|·|b|)。

> 1324 条全量载入内存算余弦，单次查询毫秒级，无需向量索引。

---

## 6. 图片存储方案

- **对象存储（推荐，腾讯云 COS）**：上传 GIF → 拿到对象公网 URL（或私有桶 + 临时签名 URL）。前端 `<image src="https://域名/...">` 加载，需配 downloadFile 合法域名。
- **或静态目录 + CDN**：GIF 放服务器 `static/exercises/`，`/api/media/...` 返回 `/static/...` 路径，由同域名 CDN 提供。
- **映射写入** `exercises_media`（exercise_id ↔ storage_key/url）。
- **上传脚本**：本地读 `fitness-miniprogram/assets/exercise-gif/*.gif` → 上传 → 写映射。
- ⚠️ **版权**：GIF 来自 © Gymvisual，无论哪种托管都需保留署名、商用须购授权。若不想碰授权，小程序侧只用原创 CSS 动画（option A），后端图片 API 可暂不上线。

---

## 7. LLM / Embedding 集成

- **可插拔 provider**：`application.yml` 配 `llm.provider / llm.api-key / llm.base-url`、`embedding.provider`。
- **Key 管理**：放环境变量或 `application-local.yml`，**必须激活 local profile 才读**（rag-kb-demo 已踩坑：默认不加载 local）。建议用 OpenAI-compatible 接口（DeepSeek / 通义 / 混元多兼容），统一 client。
- **内容安全**：用户输入先过微信内容安全 API（或后端校验）再送 LLM。

---

## 8. 与小程序前端对接要点

- 小程序**同时连两套**：CloudBase（训练数据读写，沿用现有 `utils/cloud.js`）+ 本后端（agent / 图片）。
- `wx.request` 调后端域名 → 配 **request 合法域名**；`<image src="https://域名/...">` → 配 **downloadFile 合法域名**。
- `openid` 获取：MVP 由小程序直接传入（用户数据在 CloudBase，openid 小程序侧已有）；进阶可改后端用 `code2session` 校验。
- 动作库列表：原本地 preset 仍可渲染，图片改成后端 URL（`<image src="{{item.mediaUrl}}">`）。

---

## 9. 部署

- Spring Boot 打 jar → 云服务器 / 容器 / 云托管。
- 必须 **HTTPS（证书）+ ICP 备案域名**。
- 微信公众平台配置 **request + downloadFile 合法域名**。
- MySQL 用云数据库 MySQL 实例。

---

## 10. 后端侧里程碑（对应 agent-design 的 M1~M6）

| 阶段 | 内容 | 交付 |
|------|------|------|
| M1b | Spring Boot 骨架 + MySQL 三表 + 图片 API + agent 端点 echo | 打通链路 |
| M2b | 动作库 RAG `search`（建库脚本 + 检索 + 返回列表） | 可搜动作 |
| M3b | `chat`（需用户上下文）：**MVP 由小程序传入近期训练摘要**，避免后端跨云读 CloudBase；进阶后端用 CloudBase 服务端 SDK | 能答疑 |
| M4b | `insight`（StatsService 工具层 + LLM 解读） | 能分析 |
| M5b | SSE 流式 + 前端 UI + 记忆持久化（agent_sessions） | 完整体验 |
| M6b | 图片处理（多尺寸/压缩）+ 多端复用 | 平台化 |

---

## 11. 待确认 / 风险

1. **备案域名**：你有无已备案的 HTTPS 域名？（无则需先备案，周期数天~数周）
2. **openid 传递**：MVP 小程序直传 vs 后端 code2session。
3. **用户训练数据进 agent**：MVP 传摘要 vs 后端连 CloudBase。
4. **LLM / Embedding 选型与 key 来源**。
5. **内容安全**：是否接微信内容安全 API。
6. **成本**：LLM / embedding / 存储 / 流量预算。
7. **图片版权**：GIF 署名与商用授权如何处理。
