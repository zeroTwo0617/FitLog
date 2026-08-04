# FitLog 变更记录

按提交记录的改动归档。格式：日期 · 提交 · 改动类型。

---

## 2026-08-03 · 日历详情消除 N+1 查询

### 背景

日历页 `tapDay` 和 day-detail 页原先对当天的每个训练**逐条查 sets**（`Promise.all(workouts.map(w => sets(w._id)))`），一天 N 个训练就 N 次查询；day-detail 还用 `listAll()` 全量拉训练只为筛某天。

### 修复

新增 `getDayDetail` 云函数：按 `{ dateStr, _openid }` 一次查当天全部 workouts，再按 `sessionId in [...]` 一次查当天全部 sets（`in` 上限 10 个、按批取），返回 `{ workouts, sets }`。

- 日历页 `tapDay`：从逐条查 sets 改为一次 `workoutRepo.dayDetail(ds)`。
- day-detail 页 `load`：从全量 `listAll()` + N+1 改为 `workoutRepo.dayDetail(date)`。
- repository 新增 `workoutRepo.dayDetail(dateStr)`。

日历详情从 **N+1 次查询 → 2 次查询**（一次 workouts + 一次 sets，超过 10 个训练按批）。

### 验证

- 模拟：8/3 两天训练 + 3 组 sets 正确关联，不含其他日期数据。
- 全部测试套件通过。

### 涉及文件

`cloudfunctions/getDayDetail/`（新增）、`miniprogram/utils/repositories/workout.js`、`miniprogram/pages/calendar/calendar.js`、`miniprogram/pages/day-detail/day-detail.js`。

---

## 2026-08-03 · 移除 seedData 云函数

### 背景

`seedData` 云函数按 `OPENID`（或控制台降级 `seed-test-openid`）灌入 8 周测试数据，含删除本 openid 下 `isSeed:true` 数据的能力，存在越权与生产环境数据污染风险。作为发布前安全收敛，整个删除。

### 删除内容

- `cloudfunctions/seedData/`（index.js、genData.js、config.json、package.json）
- `scripts/test_seed.js`
- 前端入口：`mine.js` 的 `loadSeed()`、`mine.wxml` 的「载入测试数据」菜单行
- `repositories/system.js` 的 `seedData()`（保留 `exportData()`）
- 文档引用：`data-access.md`、`v1-release-plan.md`、`开发文档.md` 中相关条目

`sparkles` 图标保留（仍被「教练」tab 使用）。

---

## 2026-08-03 · 浅色主题配色完善

### 背景

深色主题配色完整，但切到浅色后整体不协调。根因不是 token 缺失，而是两处结构性问题 + 一批绕过 token 的硬编码颜色。

### 根因修复：页面底色不随主题切换

`app.wxss` 里 `page { background: var(--bg) }` 在 `page` 原生元素作用域解析 `--bg`——CSS 变量只能向下继承，`.theme-light` 加在页面内层根 `view` 上，反哺不到祖先 `page`，导致所有页面浅色下底层仍是深黑。

**修复**：`.page`（带 `theme-{{theme}}` 类）改为 `background: var(--bg)`，正确渲染主题底色；`page` 元素保留深色兜底。

### 浅色配色方案（日间训练场）

延续暗夜训练场的绿色设计语言做日间反转，主色从荧光绿转深绿、强调色转深橙，保证白底对比度：

| Token | 深色 | 浅色 |
| --- | --- | --- |
| `--bg` | `#0a0c0b` | `#f6f7f2` |
| `--surface` | `#151915` | `#ffffff` |
| `--text` | `#eff3ec` | `#1a2119` |
| `--text-dim` | `#7e8a81` | `#6a7568` |
| `--primary` | `#c6f24e` | `#3f6b0f` |
| `--primary-strong` | `#d9ff6b` | `#2f5408` |
| `--accent` | `#ff7a45` | `#c2410c` |
| `--teal` | `#5bc8af` | `#0f766e` |

同步更新 `utils/theme.js` 顶栏配置：浅色导航栏 `#000000` 黑字 + `#f6f7f2` 浅底。

### 修复的问题点

- **深色文字叠浅色主色底看不清**（首页/日历/记录/我的）：`color: #12160a` 批量替换为 `var(--on-primary)`（深色=深字、浅色=白字）。
- **固定 Volt 亮绿渐变浅色下突兀**（首页 hero/营养卡/agent 气泡）：`.theme-light` 提供更柔和的绿色渐变。
- **首页 start-button 对比崩**：`#12160a` 底 + 深绿字 → 改为 `var(--text)` 底 + 主题适配文字色。
- **我的页开关旋钮深叠深**：旋钮改 `var(--on-primary)`。
- **白斑马纹浅色消失**（两个详情页 `rgba(255,255,255,0.02)`）→ `var(--surface-2)`。
- **anim-figure 舞台白对白**：`.theme-light .stage` 浅灰底 + 深描边。
- **SVG 图标浅色对比不足**：生成 16 个 `-light.svg` 深色版（描边替换为浅色对应色），WXML 按 `theme === 'light'` 拼接 `-light` 后缀。
- **阴影/网格线过重或过浅**：换用 token（`--shadow-card`、`--border`）。

### 底部导航栏与顶栏适配

- `custom-tab-bar` 是独立组件（样式隔离），内部 `var(--primary)`/`var(--text-dim)`/`var(--card-border)` **解析不到页面变量**。改为显式颜色 + `.theme-light` 覆盖。
- `theme.setTheme` 增加 `getTabBar().setData({ theme })` 广播：切主题时底部导航栏立即跟随，无需切 tab。
- `theme.syncNavBar` 去掉 `syncedNavTheme` 缓存，每次 onShow 强制设置导航栏颜色，避免停留在 app.json 深色默认。

### 涉及文件

`app.wxss`、`utils/theme.js`、`custom-tab-bar/index.{wxml,wxss}`、`components/anim-figure/anim-figure.wxss`、`pages/{index,mine,calendar,record,nutrition,agent,stats,day-detail,history-detail}/` 相关 wxss/wxml、`assets/icons/*-light.svg`（新增 16 个）。

---

## 2026-08-03 · 云函数更新/删除「假成功」修复

### 背景

`savePlan`、`saveNutritionLog`、`deletePlan`、`deleteNutritionLog` 四个云函数在执行更新/删除后**不检查实际影响条数**：当 ID 不存在或不属于当前用户时（`where` 带 `_openid` 过滤后匹配 0 条），仍返回 `ok: true`，前端表现为「假成功」。

### 修复

微信云函数端 `update` 返回 `{ stats: { updated: N } }`、`remove` 返回 `{ stats: { removed: N } }`。修复后：

- `savePlan` / `saveNutritionLog`：`updated === 0` 时返回 `{ ok: false, code: 'NOT_FOUND', message: '…不存在或无权修改' }`。
- `deletePlan` / `deleteNutritionLog`：`removed === 0` 时返回 `{ ok: false, code: 'NOT_FOUND', message: '…不存在或无权删除' }`。

前端经 `utils/cloud.js` 的 `callFunction` 检测 `ok === false` 抛错，`.catch` 正常处理，不崩。

**未修改**（语义正确）：`updateUserActive`（自己的 lastActiveAt，无用户时无需报错）、`agent` 会话更新（先查到 `current` 才更新，必然存在）。

### 涉及文件

`cloudfunctions/{savePlan,saveNutritionLog,deletePlan,deleteNutritionLog}/index.js`。

---

## 2026-08-03 · 云函数日期真实性与未来日期校验

### 背景

`saveWorkout`、`saveBodyMetric`、`saveNutritionLog`、`agent`（照片饮食识别）的 `dateStr` 只做正则格式校验，`2026-99-99` 这类非法日期会被接受。

### 修复

统一新增 `isDateStr` 校验（各云函数内联，云函数独立部署无法跨目录 require）：

- 格式必须 `YYYY-MM-DD`。
- 月份 1-12、日期在该月合法天数内；用 `new Date(y, m-1, d)` 归一化后反查年/月/日一致性，拦截 `2026-02-30`、非闰年 `2026-02-29` 等。
- 业务规则：**不允许未来日期**（`dateStr > 今天` 拒绝），允许补录过去日期。
- `createdAt` 保持云函数服务端时间，`dateStr` 为用户选择的业务日期。

`saveWorkout` / `saveBodyMetric` / `saveNutritionLog` 失败返回 `INVALID_DATE`；`agent` 返回 `INVALID_DATE`。

已用 16 个边界用例验证（非法月份/日期、闰年、今天/明天、过去日期等全部符合预期）。

### 涉及文件

`cloudfunctions/{saveWorkout,saveBodyMetric,saveNutritionLog,agent}/index.js`。

---

## 2026-08-03 · saveNutritionLog 字段白名单化

### 背景

`saveNutritionLog` 的 `normalize` 用 `Object.assign({}, event, ...)` 会把客户端附带的**未知字段**透传写入数据库（如 `_id`、`createdAt`、`mealLabel` 派生字段、任意附加字段）。手动录入/编辑走此云函数，有污染数据和越权写入风险。

### 修复

`normalize` 改为只构造白名单字段，与 `agent/schemas.js` 的 `validateMeal` 对齐：`dateStr`、`mealType`、`foods`、`calories`、`protein`、`carbs`、`fat`、`source`、`confidence`、`note`。`foods` 子项同样白名单化（name/portion/calories/protein/carbs/fat/confidence）。

验证：带 `_id`、`_openid`、`createdAt`、`mealLabel` 等恶意字段输入，输出仅含 10 个白名单字段。

**其他云函数已确认安全**：`savePlan`/`saveBodyMetric`/`saveWorkout` 均显式构造字段；agent 的 `validateMeal` 本就白名单化。

### 涉及文件

`cloudfunctions/saveNutritionLog/index.js`。

---

## 2026-08-03 · agent 会话并发覆盖修复

### 背景

`agent` 云函数的 `saveSession` 是「读-改-写」：先 `sessionOf` 读当前 `messages`，再拼接新消息后 `update` 写回。同一会话两个请求并发时，各自读到同一份旧 `messages`，后写入的覆盖先写入的，**丢失先到请求的消息**。

### 修复

会话已存在时改用 `db.runTransaction` 事务：事务内重新 `doc.get()` 读**最新** `messages` → 追加用户提问 + 助手回复 → `doc.update` 写回。云数据库对同一文档的并发更新会检测写冲突，外层最多重试 3 次。

会话不存在时走 `add` 创建（首次创建各自独立，无互相覆盖问题）。

### 验证

模拟对比：
- 旧方案（请求开始就读）：两个并发请求各自追加，消息数 3，**丢了先到的那条**。
- 事务方案（写入时读最新）：消息数 5，**两条都保留**。

`test_agent.js`（前端纯函数工具）不受影响，通过。

### 涉及文件

`cloudfunctions/agent/index.js`。

---

## 2026-08-03 · 身体数据每天一条 Upsert

### 背景

`saveBodyMetric` 每次 `add` 新记录，同一天可写多条；`bodyRepo.latest()` 和 body 页列表只按 `dateStr` 排序，同日多条时「最新记录」不稳定。

### 修复

采用「每天一条 + Upsert」：

- `saveBodyMetric` 改为事务内按 `{ dateStr, _openid }` 查当天记录：存在则 `update` 覆盖（返回 `created: false`），不存在则 `add`（返回 `created: true`）。事务保证并发保存同一天时不会产生两条。
- body 页 `load()` 对存量重复数据按日期去重（保留 `updatedAt`/`createdAt` 最新一条），列表与趋势图展示稳定。

### 验证

- 同日多条（早/中/晚）去重后只保留最晚一条；无 `updatedAt` 的旧数据用 `createdAt` 兜底。
- `node --check` 语法正确，`test_stats.js` 50 项通过。

### 涉及文件

`cloudfunctions/saveBodyMetric/index.js`、`miniprogram/pages/body/body.js`。

---

## 2026-08-03 · 图表数据修复与加载提速

### 背景

统计页和历史页的数据读取在真实设备上暴露出两类问题：

1. **历史页读不到今天保存的训练记录**（数据在云端、打卡日历能看到，但历史列表为空）。
2. **统计页图表每次进入都加载慢**，横轴日期跳着显示。

根因都在数据访问层和图表展示逻辑，本次一并修复。

### 提交 3e92be5 · 图表数据修复

修复「训练历史读不到今天记录」：`utils/cloud.js` 的 `getAll()` 分页判断有误。

- 微信小程序端 SDK 单次 `get()` 上限 **20 条**（无论 `limit` 请求多大）。
- 原实现用「返回条数(20) < 请求条数(100)」判断是否继续翻页，条件恒为真，**只读第一页就停止**。
- 数据超过 20 条时，默认排序（按 `_id`）下靠后的记录（如当天新保存的训练）被静默截断，历史列表自然看不到。
- 修复：`size` 限制到安全值 20，用「是否满页」决定是否继续翻页。

同时完成统计页展示优化：

| 文件 | 改动 |
| --- | --- |
| `pages/stats/stats.js` | 训练量窗口 14 → 7 天；1RM 趋势同样 7 天；1RM 指标过滤为三大项（卧推/硬拉/深蹲），按最大重量降序、重项在前并默认选中 |
| `pages/stats/stats.wxml` | 柱状图横轴标签全标（7 个）；「动作最大重量」区块移到第一位；标题「近 14 天」→「近 7 天」 |
| `pages/stats/stats.wxss` | 柱列从固定 `7.14%` 改为 `flex: 1` 均分铺满；0 值日期不显示柱子（去掉 `min-height: 6rpx`）；柱子宽度 `60%` 自适应 |
| `utils/lineChart.js` | 折线图横轴标签最多 6 个 → 7 个全标 |

**横轴标签格式**：从纯日数字（`19`、`1`）改为「月/日」（`7/28`、`8/1`），跨月日期在横轴上可分辨。

**1RM 三大项过滤规则**：关键词匹配「卧推/深蹲/硬拉」；硬拉排除罗马尼亚/单腿/直腿/相扑等辅助变体，只取传统硬拉。验证：种子数据下得到 传统硬拉(121.5) → 杠铃深蹲(105) → 杠铃卧推(71.25)，按 max 降序。

**柱子点击交互**：点击训练量柱子，柱顶浮现当日容量（`xxx kg`）；再点收起；点其他柱子切换。

### 提交 db4b90b · getAll 并行分页读取

`utils/cloud.js` 的 `getAll()` 从串行分页改为并行分页，减少大数据量下的加载时间。

- 原实现逐页串行读（每页 20 条），N 条数据要 N/20 次串行往返。
- 改为第一页判断是否还有更多，后续**每批 5 页并行**请求再合并；批内出现不满页即到底。
- 所有走 `getAll` 的页面（历史、日历、统计、身体、营养）全部受益。
- 已验证数据量 0~250 条均读全、无重复。

`scripts/test_stats.js` 的「趋势 14 天」断言同步更新为「趋势 7 天」。

### 涉及文件汇总

| 提交 | 文件 |
| --- | --- |
| 3e92be5 | `miniprogram/pages/stats/stats.js`、`stats.wxml`、`stats.wxss`、`miniprogram/utils/cloud.js`、`miniprogram/utils/lineChart.js` |
| db4b90b | `miniprogram/utils/cloud.js`、`scripts/test_stats.js` |

### 相关背景（同一会话中发现并解决）

- 排查初期发现「历史页看不到记录」是 `getAll` 分页 bug，而非页面读取逻辑错误。
- 确认开发环境打开的是主目录（`codex/cloudbase-only` 分支），与 worktree 分支是两套独立文件，调试日志需落在主目录才生效。
