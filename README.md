# FitLog 训练记录本（微信小程序）

用结构化方式记录每一次训练的「动作-组数-次数-重量」，并提供训练计划、数据趋势、打卡日历与身体数据追踪。

- 形态：微信小程序原生 + 微信云开发（CloudBase-only）
- 数据：训练记录、计划、身体数据、训练/饮食会话和营养记录全部保存在 CloudBase
- 动作库：内置文字动作库，不依赖 GIF、图片 CDN 或独立后端
- 文档：[开发文档.md](./开发文档.md)（PRD v0.1）

## 快速开始（开发环境）
1. 用「微信开发者工具」导入本目录
2. 开通云开发环境，填入 `env` 配置
3. 见 `开发文档.md` 的 Phase 0 ~ Phase 4 规划

## 本地配置与密钥
- `project.private.config.json` 只放微信开发者工具的本地设置，模板见 `project.private.config.json.example`；该文件已被 `.gitignore` 忽略。
- 云环境 ID 配置在 `utils/config.js` 的 `CLOUD_ENV`，它不是密钥。
- 训练 Agent 在云函数配置完成后调用大模型；模型不可用时保留本地规则训练建议作为降级。
- 文档索引见 [docs/README.md](./docs/README.md)，数据库索引和集合权限需要在对应 CloudBase 环境中确认。
- 后续若接入 LLM，密钥应放在 CloudBase 云函数环境变量或服务端密钥管理中，不能放进 `project.private.config.json`、小程序 JS、`utils/config.js` 或提交到 Git。

## Agent 云函数
1. 在微信开发者工具中部署 `cloudfunctions/agent`，修改云函数代码后需要再次部署。
2. 在 CloudBase 云函数环境变量中配置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 和可选的 `LLM_VISION_MODEL`。
3. 创建 `agentSessions`、`nutritionLogs`、`dietPlans` 集合，并将权限设置为“仅创建者可读写”。
4. 图片通过按用户隔离的临时路径上传；`analyzeMeal` 会在识别完成后删除原始图片，只把用户确认后的结构化营养结果写入 `nutritionLogs`。

如果页面提示模型不可用，优先查看提示中的错误码。`MODEL_CONFIG_MISSING` 表示环境变量没有注入到云函数实例；`.env.example` 只是模板，`project.private.config.json` 也不会注入云函数环境变量。部署后的页面会显示一行脱敏配置诊断，不会显示 API Key。

## 数据写入云函数
- `cloudfunctions/saveWorkout`：以事务方式写入一条 `workouts` 和全部 `sets`。
- `cloudfunctions/ensureUser`：按当前用户 openid 幂等创建用户档案。
- 修改这两个目录后，需要在微信开发者工具中重新部署对应云函数。

## Git 工作流
- 分支：`main` / `dev` / `feature/<功能>`
- 提交规范：`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `test:` / `chore:`
