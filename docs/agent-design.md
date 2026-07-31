# FitLog AI Agent 设计文档

> 状态：设计评审版（M0）
> 分支：`feature/exercise-anim` 之后另起 `feature/agent`
> 作者：Senior Developer
> 日期：2026-07-29

---

## 1. 背景与现状

FitLog 当前使用**微信云开发（CloudBase）**，但只用了「云数据库」这一层：

- 客户端通过 `wx.cloud.database()` 直接读写 `WORKOUTS / SETS / plans / bodyMetrics` 等集合（`utils/cloud.js` 封装）。
- **没有云函数、没有自有服务器、没有对外 HTTP API**。
- 即：已有「数据库后端」，但还没有「业务逻辑 / AI 后端」。

本次目标：给 FitLog 加入一个 AI agent，覆盖三个角色（见 §2）。所有对大模型的调用必须走**服务端**，因此核心问题不是「要不要写后端」，而是「服务端落在哪」。结论见 §3。

---

## 2. 角色范围（Scope）

本期确定的三个角色：

| 角色 | 说明 | 典型问题 |
|------|------|----------|
| **训练教练问答** | 基于用户真实训练记录答疑 | 「我这周练得怎么样」「深蹲为什么没进步」 |
| **动作库智能搜索** | 自然语言搜动作 / 纠错 | 「练胸的自重动作有哪些」「新手肩推选哪个」 |
| **数据洞察分析** | 分析趋势、短板、风险并解读 | 「我最近有氧够吗」「哪个肌群练得最少」 |

**本期不做**：自动生成训练计划并写回 `plans`（后续阶段再评估）。

---

## 3. 架构决策：服务端落在云函数

### 3.1 微信小程序的硬约束
1. 前端**不能直接调 LLM**：API key 会泄露；`wx.request` 出网必须配「合法域名」（HTTPS + ICP 备案）。
2. 必须有**服务端中转**：key 留在服务端。
3. **云函数天然免域名白名单**：`wx.cloud.callFunction` 走微信内网，不需要在公众平台备案域名。

### 3.2 结论（更新：用户 2026-07-29 拍板）
- **采用统一独立后端**：用户决定另起一个后端服务，把**图片托管（API）和 agent 都放进去**。因此本期不再走「云函数 + 云存储」的纯 CloudBase 路线，改为自有后端。
- 原因：1324 个 GIF 无法打进小程序包（体积超限 + 已 gitignore），图片必须外托；用户选择自建后端统一承载图片与 agent，便于后续图片处理 / 多端复用。
- 代价：需 **HTTPS + ICP 备案域名**，并在微信公众平台配置「request 合法域名」（API 调用）与「downloadFile 合法域名」（图片加载）；前端改走 `wx.request` 调后端。
- 技术栈待定（见 §3.4 / 待确认项）。

> 📝 备注：此前评估过「云函数 + 云存储」纯 CloudBase 路线（免备案、免后台），技术上可行；但用户已选统一后端路线，本文档后续按此推进。

### 3.3 图片（GIF 动图）托管 —— 由统一后端承载
- **约束**：1324 个 GIF 远超小程序包体积上限（主包 2MB / 总包 20MB），且已 `.gitignore` 不进仓库，因此**必须外托 + 网络加载**，不能打进包。
- **方案（已拍板）**：由统一后端提供图片服务 —— 后端把 GIF 存到对象存储（COS / S3）或服务器静态目录 + CDN，暴露 API（如 `GET /api/media/exercise/:id` 或批量 `GET /api/media/map`）返回 `exerciseId → 图片 URL`。前端 `<image src="https://后端域名/...">` 加载，需配「downloadFile 合法域名」。
- **好处**：可顺带做图片处理（多尺寸 / 压缩 / 水印）、多端（小程序 + Web）复用；与 agent 共用一套后端与域名。
- **版权提示**：GIF 来自 © Gymvisual，无论哪种托管都需保留署名、商用须购授权（详见项目 MEMORY.md 动作库动图方案）。若不想碰授权，可只用原创 CSS 动画（option A），零素材零托管。

### 3.4 后端技术栈（已拍板：Spring Boot + MySQL）
- **语言 / 框架**：Java + Spring Boot（用户最熟、简历主栈）。
- **数据库**：MySQL（用户只会 MySQL）。embeddings 存为 `JSON` / `BLOB` 数组字段，RAG 检索在应用内算余弦相似度（1324 条无压力）；**不引入 PGVector**。
- **图片存储**：对象存储（腾讯云 COS / S3）或服务器静态目录 + CDN；后端暴露 `GET /api/media/...` 返回 HTTPS URL。
- **Agent 实现**：Spring Boot 内跑 agent 编排（action 分发 → 检索 / 工具 → LLM），复用 rag-kb-demo 的 RAG 方法论（混合检索 + Rerank 思路），但检索改为 MySQL + 应用内余弦。
- **前端契约**：小程序 `wx.request` → `POST https://域名/api/agent`、`GET https://域名/api/media/...`；需在微信公众平台配 **request + downloadFile 合法域名**。
- **代码位置**：独立模块 `fitlog-backend/`（与小程序 `fitness-miniprogram/` 平级）。

---

## 4. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│  微信小程序（客户端）                                          │
│  - AI 助手入口（独立页 / 弹层）                                │
│  - 流式渲染（打字机效果）                                      │
│  - 复用全局 theme 体系                                         │
└───────────────┬─────────────────────────────────────────────┘
                │  wx.cloud.callFunction('agentChat', {...})
                ▼
┌─────────────────────────────────────────────────────────────┐
│  云函数 agentChat（Node.js，服务端，key 在环境变量）            │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │ 编排层    │──▶│ 检索层 (RAG)  │──▶│ LLM / Embedding 调用  │  │
│  │ (action) │   │ 工具层 (stats) │   │ （可插拔模型）        │  │
│  └──────────┘   └──────────────┘   └──────────────────────┘  │
└───────┬───────────────────────────┬─────────────────────────┘
        │ 读/写                     │ 读
        ▼                           ▼
┌────────────────────┐     ┌─────────────────────────────────┐
│ 云数据库（现有）     │     │ 云数据库（新增）                 │
│ WORKOUTS / SETS     │     │ kb_chunks（向量）               │
│ exercises / plans   │     │ agent_sessions（记忆）          │
└────────────────────┘     └─────────────────────────────────┘
```

---

## 5. 技术选型

| 项 | 选型 | 说明 |
|----|------|------|
| 运行时 | 云函数 Node.js | 与现有 JS 栈一致；如需 Python embedding 工具亦可 |
| LLM | 可插拔（混元 / DeepSeek / 通义 / GPT） | 通过环境变量 `LLM_PROVIDER` + `LLM_KEY` 切换 |
| Embedding | 与 LLM 同家或独立 | 向量维度需与检索侧一致 |
| 检索（MVP） | 云函数内 cosine 全量计算 | 1324 条 + 个人历史内存计算无压力 |
| 检索（规模化） | CloudBase 向量检索聚合 / 独立向量库 | 数据上万条时再上 |
| key 管理 | 云函数「环境变量」面板 | 不进代码、不进前端 |

---

## 6. API 契约（云函数 `agentChat`）

统一入口，按 `action` 分发。前端 `wx.cloud.callFunction({ name: 'agentChat', data: {...} })`。

### 6.1 通用入参
```js
{
  action: 'chat' | 'search' | 'insight',
  query: string,            // 用户问题 / 搜索词
  sessionId?: string,       // 多轮记忆（chat 用）
  range?: 'month' | '30d' | 'all',  // insight 用
  filters?: {               // search 用
    bodyPart?: string,
    equipment?: string
  }
}
```
> `_openid` 由云函数环境自动注入（`wxContext.OPENID`），无需前端传。

### 6.2 通用出参
```js
{ ok: true, action, type: 'stream' | 'json', ... }
```
- `chat` → `type: 'stream'`，SSE / chunk 流式文本。
- `search` → `type: 'json'`，结构化动作列表。
- `insight` → `type: 'json'`，`{ stats, report }`。

### 6.3 各 action 行为

**action = chat（训练教练问答）**
- 取该用户近期训练（`WORKOUTS/SETS`，按 `_openid` 过滤，取最近 N 条）。
- RAG 检索 `kb_chunks`（user_history + exercise 知识）取 top-k。
- 拼 context 调 LLM，流式返回。可选带 `sessionId` 做多轮。

**action = search（动作库智能搜索）**
- query embedding → 检索 `kb_chunks(source='exercise')` → 可选叠加 `filters` 过滤 → 重排 → 返回：
```js
[{ exerciseId, name, nameZh, bodyPart, target, score, reason }]
```
- 前端点结果可跳 `exercise-detail?exerciseId=`。

**action = insight（数据洞察）**
- 工具层先算统计（见 §8），再把统计结果交给 LLM 生成自然语言解读 `report`。
```js
{ stats: { checkins, byMuscle, trend }, report: "..." }
```

### 6.4 错误码
```js
{ ok: false, code: 'EMBED_FAIL' | 'LLM_FAIL' | 'NO_DATA' | 'BAD_ACTION', msg }
```

---

## 7. 数据模型（云数据库新增集合）

### 7.1 `kb_chunks`（RAG 知识块 + 向量）
```js
{
  _id,
  source: 'exercise' | 'user_history',
  refId: string,            // exerciseId 或 workout _id
  text: string,             // 用于检索/喂给 LLM 的文本
  embedding: [number],      // 向量
  meta: { bodyPart?, target?, equipment? },
  createdAt
}
```

### 7.2 `agent_sessions`（多轮记忆，chat 用）
```js
{
  _id, _openid,
  messages: [{ role: 'user'|'assistant', content, ts }],
  updatedAt
}
```

### 7.3 复用现有集合
`WORKOUTS / SETS / exercises(preset) / plans / bodyMetrics` 只读复用，不改结构。

---

## 8. 工具层（数据洞察 / 可复用统计）

抽成纯函数（可单测，不依赖 `wx`），供 `insight` 与未来 agent 自主调用：

- `getMonthlyCheckins(openid, year, month)` → 当月打卡天数
- `getMaxByExercise(openid)` → 各动作最大重量
- `getMuscleGroupDistribution(openid, range)` → 肌群训练分布
- `getProgressTrend(openid, range)` → 重量/次数趋势

> 与现有 `utils/statsData.js` 的统计逻辑同源，可复用其 `aggregate()`。

---

## 9. RAG 管线细节

### 9.1 建库（离线脚本 `scripts/build_kb.js`，本地 Node 跑）
1. 读 `data/exercises.preset.js`（1324 条）+ 用户历史快照。
2. chunk：每条动作 → 名称/目标肌群/做法/注意事项；用户历史 → 周期摘要。
3. 调 embedding 接口 → 向量。
4. 批量写 `kb_chunks`（云函数或本地脚本通过云 SDK 写入）。

### 9.2 查询
1. query → embedding。
2. 取 `kb_chunks` → 内存 cosine 取 top-k（MVP）；或 CloudBase 向量检索。
3. （进阶）混合检索：关键词（tag/bodyPart ILIKE）+ 向量 → RRF 融合 → Rerank（启发式 / LLM）。复用 `rag-kb-demo` 方法论。
4. 拼 context → LLM。

---

## 10. 前端接入

- 新增「AI 助手」入口：独立页 `pages/agent/agent` 或首页/我的 弹层。
- 调用：`wx.cloud.callFunction({ name: 'agentChat', data })`。
- 流式渲染：云函数返回 chunk，前端打字机效果（或先 json 后文本）。
- 主题适配：页面根挂 `theme-{{theme}}`，复用全局 token。
- 输入校验：调用微信**内容安全 API** 校验用户输入（合规必做）。

---

## 11. 阶段里程碑

| 阶段 | 内容 | 交付 |
|------|------|------|
| M0 | 设计评审（本文档） | 文档 |
| M1 | 后端脚手架：起服务 + 图片 API(exerciseId→URL) + agent 端点骨架(action 分发)；配 HTTPS/备案域名 + 微信合法域名白名单 | 打通链路 |
| M2 | 动作库 RAG `search` 跑通（建库 + 检索 + 返回列表） | 可搜动作 |
| M3 | `chat` 问答（带用户历史 context） | 能答疑 |
| M4 | `insight` 数据洞察（工具层 + LLM 解读） | 能分析 |
| M5 | 流式输出 + 前端 UI + 记忆持久化（`agent_sessions`） | 完整体验 |
| M6（可选） | 独立后端服务化、备案多端复用、向量检索规模化 | 平台化 |

---

## 12. 风险与取舍

- **冷启动**：首次调用几百 ms~1s；可配云函数「最小实例数 / 常驻」缓解。
- **向量规模**：1324 条 + 个人历史内存 cosine 完全够；上万条再上向量索引。
- **出网**：确认云函数环境允许访问公网（默认可配放行）。
- **key 安全**：仅放云函数环境变量。
- **成本**：embedding + LLM 按 token 计费，需设预算/限流。
- **内容安全**：用户输入过微信内容安全 API 后再送 LLM（合规必做）。

---

## 13. 待确认项

1. LLM / Embedding 具体选型与 key 来源（是否已有额度）。
2. 是否需要微信内容安全审核（建议要）。
3. 成本预算 / 是否需要限流。
4. M5 之后是否要「自动生成训练计划写回 plans」（本期不做，但架构预留）。
5. **图片 + agent 托管（已拍板）**：统一独立后端承载，不再走纯 CloudBase 路线；需 HTTPS + 备案域名 + 微信合法域名白名单。
6. **后端技术栈（已拍板）：Spring Boot + MySQL**；embeddings 存 MySQL、应用内余弦检索；图片走对象存储/静态+CDN。rag-kb-demo 的 PGVector 改为 MySQL 向量方案。
