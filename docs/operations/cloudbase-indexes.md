# CloudBase 数据库索引清单

这些索引需要在微信开发者工具的 CloudBase 数据库控制台中创建。索引配置属于云环境资源，当前仓库不能自动确认远端环境是否已经存在对应索引。

## 必需索引

| 集合 | 字段 | 顺序 | 用途 |
| --- | --- | --- | --- |
| `workouts` | `_openid`, `dateStr` | 升序、降序 | 首页、历史、日历按用户和训练日读取 |
| `sets` | `_openid`, `sessionId` | 升序、升序 | 按训练会话读取组明细 |
| `bodyMetrics` | `_openid`, `dateStr` | 升序、降序 | 身体数据趋势和最近记录 |
| `nutritionLogs` | `_openid`, `dateStr` | 升序、降序 | 每日饮食查询 |
| `dietPlans` | `_openid`, `updatedAt` | 升序、降序 | 读取最近饮食计划 |
| `plans` | `_openid`, `updatedAt` | 升序、降序 | 读取用户计划并保持稳定排序 |
| `agentSessions` | `_openid`, `updatedAt` | 升序、降序 | 用户会话查询和排序 |

## 确认步骤

1. 打开当前 `CLOUD_ENV` 对应的 CloudBase 环境。
2. 进入数据库对应集合的索引管理页。
3. 创建上表中的复合索引；若控制台提示已有等价索引，以已有索引为准。
4. 确认所有集合权限为“仅创建者可读写”。
5. 使用开发者工具 Network/云开发日志验证查询没有 `missing index` 或超时错误。

索引不能替代权限配置；所有用户数据仍必须由 `_openid` 隔离。
