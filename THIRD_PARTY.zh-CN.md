# 第三方来源

SOFT LAB 是为**学习与交流**而做的个人项目，**不用于商业用途**。

站点上的效果有若干来自其他开源项目。下面逐条列出，并给出原始链接 ——
读者可以顺着链接自行往上溯源，不需要我们替原作者做法律定性。

| 位置 | 来源 | 许可 |
|---|---|---|
| `src/experiments/soft-matter/` | [Luffyzhang2016 / soft-matter](https://github.com/Luffyzhang2016/soft-matter) —— 刚体运动、可变形外壳、形状生成器、HDRI 折射 shader | 上游未写 LICENSE |
| `src/experiments/soft-matter/vendor/HDRLoader.js` | [three.js](https://github.com/mrdoob/three.js) —— RGBE HDR 贴图加载器，改编自 `RGBELoader` addon | MIT |
| `src/experiments/canvas-lab/` | [DavidHDev / canvas-ui](https://github.com/DavidHDev/canvas-ui) —— 四个画布效果，照着行为重新实现 | MIT + Commons Clause |
| `src/experiments/cloud-train/scene.frag` | **mdb**《Up in the CloudSea》，经 [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex)（MIT）与 [incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) 流传 | 上游未附再分发许可 |
| `public/studio.hdr` | [Poly Haven](https://polyhaven.com/a/pav_studio_03)「PAV Studio 03」，作者 Grzegorz Wronkowski | CC0 |
| 拆站分区 | [Hugo Duprez / Sprite Fusion](https://www.spritefusion.com) —— 外部游戏，只放链接、不打包代码 | — |
| 软体猫 | 视觉参考自一张无署名 GIF，未打包任何素材 | — |
| `react` / `react-dom` / `three` 及构建工具 | npm 依赖 | MIT |

以上作品的版权归各自作者所有。

## 关于「云间列车」

`scene.frag` 是 SOFT LAB 从原作出发的**二次创作起点**，不是最终形态。参数、配色族与
后处理分级（`post.frag`、`palettes.ts`）都已是本站自研，场景 shader 的改写方案也在推进 ——
目标是有自己的一套实现，而不是留着别人的那一版。

## 说明

- 对以上作品的使用出于**学习与研究**目的，已在站点与源码中署名并给出原始出处。
- 本项目**不做商业用途**；请勿将其中任何部分用于商业目的。
- 如果你是相关权利人，希望调整署名或移除内容，请提交 issue，我们会尽快处理。
- 本项目自己编写的部分（站点外壳、hash 路由、i18n、主题与动效令牌体系、全部按钮效果、
  云间列车的后处理与配色、更新记录等）以 **MIT** 许可发布，见 [LICENSE](LICENSE)。
