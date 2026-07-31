# FitLog 训练记录本（微信小程序）

用结构化方式记录每一次训练的「动作-组数-次数-重量」，并提供训练计划、数据趋势、打卡日历与身体数据追踪。

- 形态：微信小程序原生 + 微信云开发（CloudBase-only）
- 数据：训练记录、计划、身体数据和训练助手会话全部保存在 CloudBase
- 动作库：内置文字动作库，不依赖 GIF、图片 CDN 或独立后端
- 文档：[开发文档.md](./开发文档.md)（PRD v0.1）

## 快速开始（开发环境）
1. 用「微信开发者工具」导入本目录
2. 开通云开发环境，填入 `env` 配置
3. 见 `开发文档.md` 的 Phase 0 ~ Phase 4 规划

## 本地配置与密钥
- `project.private.config.json` 只放微信开发者工具的本地设置，模板见 `project.private.config.json.example`；该文件已被 `.gitignore` 忽略。
- 云环境 ID 配置在 `utils/config.js` 的 `CLOUD_ENV`，它不是密钥。
- 当前 CloudBase-only 版本使用本地规则训练助手，不读取 LLM/API key。
- 后续若接入 LLM，密钥应放在 CloudBase 云函数环境变量或服务端密钥管理中，不能放进 `project.private.config.json`、小程序 JS、`utils/config.js` 或提交到 Git。

## Git 工作流
- 分支：`main` / `dev` / `feature/<功能>`
- 提交规范：`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `test:` / `chore:`
