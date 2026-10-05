# SOFT LAB

**数字物质标本馆**

[English](README.md) · **简体中文**

*看到新奇的东西就收进来：会流动的、会撕裂的、会回弹的、会被撕开又拼回去的。  
每个都拆开看清楚它到底怎么做到的，再做成能上手玩的页面。*

[**线上站点 →**](https://doit.loc.cc/)

![SOFT LAB 首页](docs/screenshots/home-light.png)

---

## 这是什么

SOFT LAB 是个人整理的前端视觉交互项目。它存在的意义是研究视觉效果、并把它们分享出来  
—— 可以看、可以玩、代码也可以读。它不是具体的线上产品，也没有任何东西是准备当产品发布的。

有三条定义它的规矩：

- **不使用具体的图或ai生成式内容作为动效效果展示。** 页面上所有效果 —— 首屏那层场、那颗果冻、那片云海、十六个按钮状态 ——  
  都由 WebGL、canvas 或 CSS 等实时渲染算出来。不生成图或帧生成视频然后假装的动效效果。
- **慢慢收录，渐进式展示内容。** 每个实验带 `live` / `wip` 状态。04 号在源码里就标着  
  `wip`，页面上也照实显示，而不是悄悄藏掉。
- 规则与时俱进....

整站目前是纯静态的。没有想法也没内容可以结合后端、数据库、调接口、统计脚本等。

## 目前站点有什么

| #  | 分区                 | 是什么                                                        |
| -- | ------------------ | ---------------------------------------------------------- |
| 01 | **Experiments 实验** | 几个能上手交互的东西：可拖拽的软体lab、排版字体效果lab、视觉爆炸云海列车，更新中...             |
| 02 | **Buttons 按钮**     | 几个按钮微动效，分四组（paint / motion / click / state）                |
| 03 | **Destroy 拆掉一个站**  | 一个外部游戏的入口：[把任意网址变成能拆的地图](https://destroy.spritefusion.com) |
| —  | **Growth 它怎么长起来**  | 收集 → 拆开 → 做成能玩的                                            |
| —  | **Dev log 更新记录**   | 完整版本历史，最新的在最上面                                             |

![实验面板](docs/screenshots/experiments.png)

> **目前就是3个项目整理，后两个不编号**。`growth` 和 `log` 是讲这个站自己的栏目，不是作品本身 ——  
> 他们不占用编号。规矩写在 `src/lib/sections.ts` 里。

## 四个实验

### 01 · 软体物质 Soft Matter — `live`

一颗能抓、能拉长、松手会回弹的果冻。按住表面会陷下去，抓住边缘能整个掀起来。  
六种形状，一个可拖的颜色盘，真实 HDRI 折射。

![软体物质](docs/screenshots/soft-matter.png)

### 02 · 画布实验 Canvas Lab — `live`

四种作用在**真 HTML** 上的效果，不是作用在它的图片上：文字被采样成亮度网格，  
再重绘成 ASCII、解密乱码、涟漪、或撕裂的帧。底下那段字全程可选中、可点击。

![画布实验](docs/screenshots/canvas-lab.png)

### 03 · 落日云间列车 Cloud Train — `live`

十四层云海按各自的视差速度往后淌，一列火车从悬索桥上过去。  
速度、视角、起伏、噪声都能调；二十三套分级配色，换一套等于同一天换了个时辰。

![云间列车](docs/screenshots/cloud-train.png)

最新的一族配色叫**「云海」**：三套色都绕着**同一个色相**转，只靠明度把云一层层拉开，  
从 0.25 到 1.0。

### 04 · 软体猫 Soft Cat — `wip`

仅冒出想法。它只在仓库里提及，**真实的状态还等待后续更新**。

## 按钮墙

十六个微动效，四组，共用同一套时长与缓动 —— 所以摆在一起是一整副手感，  
而不是十六个各玩各的。每张卡都是真按钮：悬停、点击、按住再松手。

![按钮墙](docs/screenshots/buttons.png)

## 暗色模式

站点有一整套暗色令牌，和浅色走的是同一批 CSS 自定义属性。  
canvas 那几层不跟 CSS 走，所以色值是显式传进去的 —— 见 `src/lib/theme.ts`。

![首页 · 深色](docs/screenshots/home-dark.png)

## 本地跑起来

需要 **Node 20.19+ 或 22.12+**（Vite 8 的要求）。

```bash
npm install
npm run dev        # 开发服务器
npm run build      # tsc --noEmit && vite build  →  dist/
npm run preview    # 把构建产物跑在 :4173
```

`dist/` 就是一堆静态文件。路由是手写的 hash 路由，所以**不需要配 SPA 回退规则** ——  
扔到任何静态托管上都能跑。

### 关于mobile以及平板等非标准电脑端横板屏幕尺寸的排版优化-响应式排版

断点轴是 `orientation` + `height`，**不是 `width`**。手机横过来宽 926px ——  
比那条本该拦住小屏的 720px 守卫还宽 —— 于是它会悄悄套用桌面版排版，  
交互面板把整个画面盖住。真正能区分这两种情况的是高度。  
高度用 `svh`（稳定），定位原点用 `dvh`：`vh` 在 iOS 上永远偏大，  
而 `dvh` 会随地址栏收起重算、让布局跳。手机上交互面板变成底部抽屉 ——  
屏幕上方 38% 永远留给画面 —— 横屏时再回到右侧栏。

## 目录结构

```
src/
├── home/          标签卡组与五个面板
├── shell/         站点头尾、首屏场、光球
├── experiments/   一个实验一个目录 + registry.ts
├── buttons/       按钮注册表，一个效果一条
├── motion/        共用的时长与缓动令牌
├── lib/           hash 路由、i18n、主题、更新记录、webgl 工具
└── styles/        按组件切分的 CSS
```

读代码前值得先知道三件事：

- **时长是令牌，不是数字。** 每个效果只报一个档位（`fast` / `base` / `slow` / `lazy` /  
  `tide` / `glacial`），界面上显示的秒数是从令牌**推**出来的，两边不可能对不上。
- **注册表是数据，不是标签。** 实验和按钮自己描述自己；目录编号来自  
  `findExperiment(slug)?.no`，不是手打在页面标题里的。
- **更新记录是历史的唯一出处。** `src/lib/changelog.ts` 一个版本一条，  
  站上的更新记录页就是从它渲染出来的。

## 版本历史

更新记录在站上的 `#/log`，也在 **[CHANGELOG.md](CHANGELOG.md)** —— 34 条，一版一条，  
每条都记了改了什么**以及为什么**。两处读的是同一个源  
[`src/lib/changelog.ts`](src/lib/changelog.ts)：那个文件是这个项目真实的历史，  
本仓库是它当前的状态。

## 来源与许可

**MIT** —— 见 [LICENSE](LICENSE)。

根目录的 MIT 许可**只覆盖 SOFT LAB 自己编写的部分**。每一处来自别处的材料，
都连同它的授权核验状态记在 **[THIRD_PARTY.zh-CN.md](THIRD_PARTY.zh-CN.md)** 里。
其中有几条标着「**未确认**」—— 那就是字面意思。

## 致谢

- **[Luffyzhang2016/soft-matter](https://github.com/Luffyzhang2016/soft-matter)** —— 软体。
- **[DavidHDev/canvas-ui](https://github.com/DavidHDev/canvas-ui)** —— 画布效果。
- **mdb** —— 原作 shader《Up in the CloudSea》，经  
  [Rice-dog/code-codex](https://github.com/Rice-dog/code-codex) 与  
  [incarnation-gem/sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) 流传。
- **[Hugo Duprez / Sprite Fusion](https://www.spritefusion.com)** —— 拆站的那个游戏。
- **[Poly Haven](https://polyhaven.com/a/pav_studio_03)** —— CC0 的摄影棚 HDRI。

---

*Est. 2026 · 一直在收*
