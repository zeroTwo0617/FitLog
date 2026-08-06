# FitLog 训练助手（CloudBase-only）

## 当前架构

本分支移除 Spring Boot、MySQL、JWT、SSE、图片托管和 GIF 资源链路。小程序依赖微信云开发，模型调用放在 CloudBase 云函数：

- 训练记录、组明细、计划、身体数据继续使用现有 CloudBase 集合。
- `cloudfunctions/agent` 负责模型调用、结构化输出校验、按用户隔离的临时图片上传路径、饮食图片识别和用户确认结果保存。
- `utils/agent.js` 保留训练规则助手作为模型不可用时的降级方案。
- Agent 会话消息写入 `agentSessions`，由 CloudBase `_openid` 做用户隔离，并用 `mode` 区分训练和饮食。
- `nutritionLogs` 保存已确认的餐次和营养数据，`dietPlans` 保存已确认的饮食方案。
- `agentUploads` 只登记当前用户临时图片的 `fileID` 和服务端时间。上传成功后先登记，再执行识别；识别成功、失败或超时都会尝试删除文件并清理登记，异常退出时由删除用户数据流程清理仍登记的文件。
- 动作库使用内置 `data/exercises.preset.js`，页面只展示文字信息和首字标记，不加载图片。
- 前端不保存模型密钥，不请求 `localhost` 或独立后端；大模型密钥只存在云函数环境变量。

## CloudBase 集合

在 CloudBase 控制台创建 `agentSessions`、`agentUploads`、`nutritionLogs`、`dietPlans` 集合，并将权限设置为“仅创建者可读写”。

`agentSessions` 推荐文档结构：

```js
{
  _openid: "由云开发自动维护",
  mode: "training",
  title: "训练助手会话",
  messages: [
    { role: "user", content: "安排一个 3 天增肌计划" },
    { role: "assistant", content: "..." }
  ],
  context: {
    recentWorkouts: [],
    existingPlans: [],
    bodyMetrics: null
  },
  createdAt: Date,
  updatedAt: Date
}
```

`utils/config.js` 中的 `COLLECTIONS.AGENT_SESSIONS` 和 `COLLECTIONS.AGENT_UPLOADS` 是客户端集合名配置；云函数使用各自的服务端常量。已有集合仍按原权限配置：训练记录、计划和身体数据必须启用创建者隔离。

`nutritionLogs` 只保存结构化结果，不保存原始图片：

```js
{
  _openid,
  dateStr: "2026-08-01",
  mealType: "lunch",
  foods: [],
  calories: 620,
  protein: 32,
  carbs: 74,
  fat: 18,
  source: "photo",
  confidence: 0.82,
  note: "热量为估算值，仅供饮食记录参考。",
  createdAt: Date,
  updatedAt: Date
}
```

## Agent 行为

Agent 启动时并行读取：

- `workouts` 最近 10 条；
- `plans` 最近 10 条；
- `bodyMetrics` 最近 3 条。

用户输入包含训练目标、动作或计划意图时，云函数调用可配置的 OpenAI-compatible 模型，并校验其输出，再生成与计划编辑页兼容的 `name + items[]` 草案。模型不可用时前端降级到本地规则助手。

```js
{
  name,
  items: [{
    exerciseId,
    exerciseName,
    targetSets,
    targetReps,
    targetWeight
  }]
}
```

点击“确认并编辑计划”后，草案只进入本地编辑页；最终仍由 `pages/plan-edit/plan-edit` 写入 CloudBase，不由助手直接写入 `plans`。

涉及疼痛、受伤或康复的问题不会生成计划，只给出停止动作和咨询专业人员的提示。

## 上线检查

1. 在微信开发者工具确认云环境 ID 与 `utils/config.js` 一致。
2. 部署 `cloudfunctions/agent`，配置模型环境变量，不把真实 Key 放入仓库。
3. 创建 `agentSessions`、`agentUploads`、`nutritionLogs`、`dietPlans` 并设置“仅创建者可读写”，同时按索引清单配置 `agentUploads`。
4. 清除本地缓存后验证训练/饮食助手、计划保存、拍照识别和日历热量。
5. 验证食物识别完成或失败后原始图片都会被删除。
6. 验证动作库和动作详情页不再发起图片请求。

## 动作库搜索工具

训练 Agent 现在同时具备模型调用和动作目录工具，不再只依赖模型记忆：

- `cloudfunctions/agent/exercises.index.js` 是由 `scripts/build_agent_exercise_index.js` 从 `miniprogram/data/exercises.preset.js` 生成的精简索引，只保留动作匹配所需字段。
- `searchExercises` action 供小程序或调试端调用；查询需要服务端 CloudBase 身份，最多返回 12 条结果，并且只返回 `exerciseId`、名称、部位、目标肌群和器械。
- 训练对话会向 OpenAI-compatible 模型声明 `search_exercises` function tool。模型请求具体动作时，云函数执行本地真实目录搜索，把结果作为 tool message 回传模型，再生成最终 JSON。
- 如果模型供应商不支持 function calling，云函数会对 400/404/422 降级为普通 JSON 对话；计划 schema 仍会拒绝不在动作目录中的 `exerciseId`。

修改动作源后重新生成索引：

```text
node scripts/build_agent_exercise_index.js
```

## 后续扩展

模型接口通过 `cloudfunctions/agent/.env.example` 说明的环境变量配置；不要恢复前端直连模型或把密钥放入小程序代码。
