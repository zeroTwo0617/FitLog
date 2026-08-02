# 动作演示 GIF（测试素材 · 不入库）

本目录下的 `*.gif` 是**本地预览/验证用的测试素材**，**已被 `.gitignore` 排除，不会进入版本库**。

## 来源与授权
- 出处：[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)（底层为 free-exercise-db 数据集，与本项目的 `data/exercises.preset.js` 同源）。
- 版权：**© Gymvisual（gymvisual.com）**。仓库 LICENSE 仅授权以 **180×180** 分辨率转分发，且**每次使用必须保留署名**「© Gymvisual — gymvisual.com」。
- 克隆该仓库**不等于**获得媒体授权；**商用需自行向 Gymvisual 购买独立许可**。

## 命名规则（1:1 全量对应）
- 数据集文件名形如 `videos/<id>-<hash>.gif`，其中 `<id>` 前缀与 `data/exercises.preset.js` 的动作 `id` **完全 1:1 对应**。
- 已把全部 1324 个 GIF 重命名为 `<id>.gif`（如 `0001.gif`），由此实现 **100% 覆盖**：每个动作都能显示自己的动图。
- 运行时映射见 `data/exercise-gif-map.js` 的 `gifForId(id)` → `/assets/exercise-gif/<id>.gif`。

## 如何重新生成（如需刷新）
1. 下载数据集 tar 包：`curl -L https://codeload.github.com/hasaneyldrm/exercises-dataset/tar.gz/refs/heads/main -o ds.tar.gz`
2. 解压 `videos/`：`tar -xzf ds.tar.gz exercises-dataset-main/videos`
3. 按 `<id>-<hash>.gif` 重命名为 `<id>.gif` 移入本目录。

## 上线路径（重要）
1. **不要**把这些 GIF 直接随包发布——180×180 放大到大图会糊，且涉及授权。
2. 正式上线请：自购 Gymvisual 授权（或换用原创/CC0 素材）→ 下载高清版 → 传至**自有 CloudBase 存储 / CDN** → 把 `data/exercise-gif-map.js` 改为返回 CDN 绝对地址 → 小程序后台「downloadFile 合法域名」白名单**只配该一个域名**。
3. 详情页已保留「© Gymvisual」署名；列表卡片右上有 `GIF` 角标。

> 当前阶段（个人学习 / 简历 Demo 展示）可保留署名直接使用，仅限非商业用途。
