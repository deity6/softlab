# 第三方声明

SOFT LAB 同时包含独立编写的代码，以及基于第三方作品进行改编、重建或视觉参考的效果。

本仓库根目录中的 **MIT License 仅适用于 SOFT LAB 独立创作的内容**，不对下文所列的第三方作品、代码片段、改编 Shader、素材或其他受保护内容进行重新授权。

本文件用于记录来源及目前的核验状态，**本身不产生任何授权**。如果本声明与原始许可证或原作者条款冲突，应以原始条款为准。

**最后更新：** 2026 年 10 月 5 日

---

## 状态说明

- **已确认：** 已保存可以核验的来源证据及适用许可证或授权。
- **有条件适用：** 可能适用默认许可证，但仍需保存具体作品页面及当时有效的条款作为证据。
- **未确认：** 已知或疑似存在原作者，但尚未确认再分发授权。**署名本身不等于获得授权。**
- **仅作参考：** 仅根据公开的视觉、截图或交互概念独立实现，项目无意包含第三方源码或素材。

## 修改内容与权利边界

- SOFT LAB 仅对其独立完成的实现、界面、参数控制、生命周期代码及其他原创新增内容主张相应权利。
- 本项目不对第三方原作品或源自原作品的部分主张所有权。可以分离的原创部分适用仓库的 MIT License，但这不改变底层或不可分离第三方材料的许可证。
- 对作者、项目、产品、平台的提及仅用于识别来源与署名，**不表示其赞助、关联、批准或认可**。
- 每项改编或重建均为非官方实现，不得描述为原作者发布的官方版本。
- **署名和修改说明不能弥补授权缺失。**

---

## 1. 软体物质 Soft Matter — `src/experiments/soft-matter/`

| | |
|---|---|
| 原始作品 | soft-matter |
| 原作者 | Luffyzhang2016 |
| 来源 | https://github.com/Luffyzhang2016/soft-matter |
| **状态** | **未确认** |

SOFT LAB 移植了其中的刚体运动、可变形外壳、形状生成器与 HDRI 折射着色器（`vendor/physics.js`、`vendor/shapes.js`），剥离 DOM 绑定后改由 React 参数面板驱动。

**该上游仓库根目录没有 LICENSE 文件。** 无许可证即默认「保留所有权利」，不授予再分发权。因此：

> **在取得原作者授权之前，本声明不表示 SOFT LAB 已获得该部分代码的公开再分发权。**

**SOFT LAB 的修改内容：** 移除 DOM 绑定、改接 React 参数面板与主题系统、补充 TypeScript 类型声明、调整模块导入路径。

这是非官方修改实现。本项目不表示 Luffyzhang2016 对 SOFT LAB 作出认可或背书。

**仓库的 MIT License 不适用于该实验的 `vendor/` 目录。**

> 例外：`vendor/HDRLoader.js` 另有独立来源 —— 它改编自 three.js 的 `RGBELoader` addon，以 **MIT** 授权，见第 4 节。该文件头部已保留原始版权说明。

## 2. 画布实验 Canvas Lab — `src/experiments/canvas-lab/`

| | |
|---|---|
| 参考作品 | canvas-ui |
| 原作者 | David Haz（DavidHDev） |
| 来源 | https://github.com/DavidHDev/canvas-ui |
| 许可证 | MIT + Commons Clause License Condition v1.0 |
| **状态** | **有条件适用** |

四个效果（asciify / decrypt / ripple / glitch）是**照着行为重新实现**的，不是复制：阅读上游源码是为了弄清行为，本仓库的代码是 SOFT LAB 自己写的（做法见 `effects/asciify.ts` 的头部注释）。

⚠️ 上游许可证带一条 Commons Clause 附加条款，原文为：

> you do not sell, sublicense, or redistribute the components themselves — whether alone, in a bundle, or **as a ported version**.

「`as a ported version`」这一句是上游自行加入的，不是标准 Commons Clause 自带的措辞。本仓库为每个效果发布了一个 `.ts` 文件；**若读者认为这些文件构成上游组件的移植版，则该条款适用于它们。** 把这一点标明，是为了让下游使用者在知情前提下自行判断。

**SOFT LAB 的修改内容：** 不复用上游的实验性 API 路线，改为自行栅格化文本、逐格测量覆盖率再输出字符；接入本站的时长令牌与参数面板；四种效果共用一套交互框架。

这是非官方实现。本项目不表示 David Haz 对 SOFT LAB 作出认可或背书。

## 3. 落日云间列车 Cloud Train — `src/experiments/cloud-train/scene.frag`

| | |
|---|---|
| 所提供材料中保留的作者署名 | **mdb** |
| 原始来源 | 尚未核验 |
| 原始许可证或授权 | 尚未核验 |
| **状态** | **未确认** |

**传递链：** mdb（"Up in the CloudSea"）→ [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex) 的「Cloud Train Background」插件（MIT）→ [incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) → 本仓库

`scene.frag` **逐字保留**。全文件只有一处改动：前景多次采样循环里的时间展开常数 `4.` 改为 `4./3.`（对应差异在 `engine.ts` 中标注）。

上游 code-codex 的第三方声明将该 Shader 列为「未确认」，并写明：

> 在保存权威来源许可证或取得相关版权所有者直接授权之前，本声明不表示项目已经取得所提供 Shader 的公开再分发权。**署名本身不等于授权。**

**本仓库持同样的立场：在取得适用许可证或直接授权之前，本声明不表示 SOFT LAB 已获得该 Shader 的公开再分发权。**

**SOFT LAB 的修改内容：** 将 Shader 接入双 pass 渲染管线（离屏纹理 + 后处理分级）、自行编写 `post.frag` 配色分级、二十余套光色预设、参数面板与导出功能。**仓库的 MIT License 不适用于 `scene.frag` 及其衍生部分**（`post.frag`、`palettes.ts` 为 SOFT LAB 独立编写，适用 MIT）。

这是非官方修改实现。本项目不表示 mdb 或任何可能的来源作者对 SOFT LAB 作出认可或背书。

## 4. three.js — 已确认

| | |
|---|---|
| 来源 | https://github.com/mrdoob/three.js |
| 许可证 | **MIT** — Copyright © 2010-2025 three.js authors |
| **状态** | **已确认** |

使用范围：软体物质的 3D 渲染器；以及 `src/experiments/soft-matter/vendor/HDRLoader.js`（RGBE HDR 贴图加载器，改编自 three.js 的 `RGBELoader` addon）。该文件头部已保留原始版权与许可说明。

同时是运行时依赖（`package.json` 的 `three`）。

## 5. Poly Haven — "PAV Studio 03" — 已确认

| | |
|---|---|
| 来源 | https://polyhaven.com/a/pav_studio_03 |
| 作者 | Grzegorz Wronkowski |
| 许可证 | **CC0 1.0** |
| **状态** | **已确认** |

使用范围：`public/studio.hdr` —— 软体物质折射所用的环境贴图。（CC0 不要求署名，此处为主动致谢。）

## 6. 拆站分区 — 仅作参考

| | |
|---|---|
| 作品 | destroy-the-web（外部游戏） |
| 作者 | Hugo Duprez / Sprite Fusion |
| 来源 | https://www.spritefusion.com |
| **状态** | **仅作参考** |

`src/lib/destroy.ts` 只保存了游戏的入口 URL 与链接参数构造逻辑，**不包含该游戏的任何代码或素材**。链接会在新标签页打开对方站点。

## 7. 软体猫 Soft Cat — 仅作参考

| | |
|---|---|
| 视觉参考 | 一张无署名的 GIF（手按进猫形身体） |
| **状态** | **仅作参考** |

`src/experiments/soft-cat/` 的实现（Canvas 2D 上的分段弹簧链、碰撞与形变）由 SOFT LAB 独立编写，未包含该 GIF 的任何素材或代码。记在这里，是因为它表现的效果来自别处。

## 8. 运行时依赖

| 包 | 许可证 | 状态 |
|---|---|---|
| `react` / `react-dom` | MIT | 已确认 |
| `three` | MIT | 已确认（见第 4 节） |
| `vite` / `typescript` / `tailwindcss` / `@tailwindcss/vite` / `@vitejs/plugin-react` | MIT | 已确认（仅构建期） |

## 9. 字体

仓库不附带任何字体文件，也不向字体 CDN 发起请求。站点使用系统字体栈（`Inter`、`PingFang SC`、`Microsoft YaHei` 等），由访客本机解析。

## 10. 自主实现的部分

以下部分由 SOFT LAB 独立编写，未包含第三方材料，适用仓库的 MIT License：

- 站点外壳、hash 路由、分区与面板结构
- i18n 双语层、主题令牌体系
- 动效时长令牌系统与全部按钮效果（`src/motion/`、`src/buttons/`）
- 云间列车的 `post.frag` 配色分级、`palettes.ts` 光色预设、导出单文件 HTML
- 更新记录（`changelog.ts`）与本文档

---

## 分发要求

如果你分发本仓库的源码或其构建产物：

1. 一并提供本声明及所有适用许可证的全文。
2. 在可行范围内保留源码中的作者、作品名称、来源链接与许可证说明。
3. 明确标注 SOFT LAB 所作修改。
4. **不得将状态为「未确认」的材料描述为 MIT 授权。**
5. 若无法核验某项效果的来源或授权，应从分发中移除或禁用该效果。

## 仓库许可证适用范围

仓库根目录的 MIT License **仅适用于 SOFT LAB 原创内容**（见第 10 节）。第 1、3 节所列材料、以及第 2 节所称可能构成移植的部分，仍分别受其适用许可证、版权条款或授权的约束。

## 联系方式

如果你是上述作品的版权所有者，认为本项目中的署名、来源、分类或许可证说明需要修正，请在仓库提交 Issue，我们会尽快处理。

本声明仅用于记录来源与许可证范围，不构成法律意见。项目不保证当前信息已经完整；在商业分发前，或任何重要材料来源仍不明确时，应寻求具备资质的法律专业意见。
