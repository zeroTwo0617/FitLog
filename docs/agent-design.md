# FitLog 训练助手（CloudBase-only）

## 当前架构

本分支移除 Spring Boot、MySQL、JWT、SSE、图片托管和 GIF 资源链路。小程序只依赖微信云开发：

- 训练记录、组明细、计划、身体数据继续使用现有 CloudBase 集合。
- `utils/agent.js` 读取最近训练、现有计划和身体指标，生成可编辑的计划草案。
- Agent 会话消息写入 `agentSessions`，由 CloudBase `_openid` 做用户隔离。
- 动作库使用内置 `data/exercises.preset.js`，页面只展示文字信息和首字标记，不加载图片。
- 当前 Agent 是本地规则助手，不在前端放模型密钥，也不请求 `localhost` 或外部后端。

## CloudBase 集合

在 CloudBase 控制台创建 `agentSessions` 集合，并将权限设置为“仅创建者可读写”。推荐文档结构：

```js
{
  _openid: "由云开发自动维护",
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

`utils/config.js` 中的 `AGENT_SESSIONS` 是唯一集合名配置。已有集合仍按原权限配置：训练记录、计划和身体数据必须启用创建者隔离。

## Agent 行为

Agent 启动时并行读取：

- `workouts` 最近 10 条；
- `plans` 最近 10 条；
- `bodyMetrics` 最近 3 条。

用户输入包含训练目标、动作或计划意图时，助手根据内置动作库生成 `name + items[]` 草案。草案字段与计划编辑页兼容：

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
2. 创建 `agentSessions` 并设置“仅创建者可读写”。
3. 清除本地缓存后验证训练助手能读取云端数据、保存会话、生成草案并跳转计划编辑。
4. 验证动作库和动作详情页不再发起图片请求。
5. 确认 `application-local.yml`、本地媒体和编译缓存不会进入版本库。

## 后续扩展

如果以后需要真正的 LLM，只新增 CloudBase 云函数作为模型调用边界，密钥放在云函数环境变量中；不要恢复前端直连模型或把密钥放入小程序代码。
