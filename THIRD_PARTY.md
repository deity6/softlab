# Third-party sources

> [中文摘要见下方](#中文摘要)

SOFT LAB is a personal, **non-commercial** project — it exists to study visual
effects and share them, not to be sold or shipped as a product.

This project draws on the work of several other projects. This file records
where each piece came from, so that attribution lands in the right place.
Everything not listed here is this project's own, under [MIT](LICENSE).

| Where | From | Licence |
|---|---|---|
| `src/experiments/soft-matter/` | [Luffyzhang2016 / soft-matter](https://github.com/Luffyzhang2016/soft-matter) — rigid-body motion, deformable shell, shape generators, HDRI refraction shader | no LICENSE file upstream |
| `src/experiments/canvas-lab/` | [DavidHDev / canvas-ui](https://github.com/DavidHDev/canvas-ui) — the four canvas effects, re-implemented | [MIT + Commons Clause](https://github.com/DavidHDev/canvas-ui/blob/main/LICENSE.md) |
| `src/experiments/cloud-train/scene.frag` | **mdb** — *"Up in the CloudSea"*, via [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex) (MIT) and [incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) | see note |
| `public/studio.hdr` | [Poly Haven](https://polyhaven.com/a/pav_studio_03) — "PAV Studio 03" by Grzegorz Wronkowski; the environment map behind the soft body's refraction | CC0 |
| the **Destroy** section | [Hugo Duprez / Sprite Fusion](https://www.spritefusion.com) — an external game, linked rather than bundled | — |

### Notes

- **soft-matter** — the upstream repository ships no LICENSE file. The code is
  used here with attribution.
- **canvas-ui** — MIT, plus a Commons Clause condition that restricts
  redistributing the components themselves *"whether alone, in a bundle, or as a
  ported version"*. The four effects here were re-implemented from the documented
  behaviour rather than copied; the distinction is flagged so it stays visible.
- **mdb shader** — code-codex records that the original author supplied the
  shader *"with no redistribution license"*. `scene.frag` is kept verbatim with
  exactly one documented one-line change, credited to mdb, and carried in the
  same spirit as the intermediate repository it came from.

**Rights holders.** If you are the author of any work referenced here and wish
for it to be removed, or for its attribution to be amended, please open an
issue. Such requests will be handled promptly.

---

# 中文摘要

SOFT LAB 是个人项目，**非商业用途** —— 为了研究视觉效果、并把它们分享出来，
不用于售卖、也不作为产品发布。

这个项目引用了若干其他项目的工作。没列在这里的部分，都是本项目自己写的，走 [MIT](LICENSE)。

| 位置 | 来源 | 许可 |
|---|---|---|
| `src/experiments/soft-matter/` | [Luffyzhang2016 / soft-matter](https://github.com/Luffyzhang2016/soft-matter) —— 刚体运动、可变形外壳、形状生成器、HDRI 折射 shader | 上游无 LICENSE 文件 |
| `src/experiments/canvas-lab/` | [DavidHDev / canvas-ui](https://github.com/DavidHDev/canvas-ui) —— 四个画布效果，重新实现 | [MIT + Commons Clause](https://github.com/DavidHDev/canvas-ui/blob/main/LICENSE.md) |
| `src/experiments/cloud-train/scene.frag` | **mdb**《Up in the CloudSea》，经 [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex)（MIT）与 [incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) 流传 | 见下 |
| `public/studio.hdr` | [Poly Haven](https://polyhaven.com/a/pav_studio_03)「PAV Studio 03」，作者 Grzegorz Wronkowski；软体折射用的环境贴图 | CC0 |
| **Destroy 分区** | [Hugo Duprez / Sprite Fusion](https://www.spritefusion.com) —— 外部游戏，只放链接不打包 | — |

**三点说明**

- **soft-matter** —— 上游仓库没有 LICENSE 文件。这里的代码署名引用。
- **canvas-ui** —— MIT，外加一条 Commons Clause 条件，限制以「alone, in a bundle, or as a **ported version**」再分发组件本身。这里的四个效果是照着行为**重新实现**的，不是复制；把区别标出来，是为了让它一直看得见。
- **mdb 的 shader** —— code-codex 里写明原作者提供时**未附再分发许可**。`scene.frag` 逐字保留，全文件只有一处已记录的改动，署名 mdb，与它来源的那个中间仓库保持同一立场。

**权利人**：如果你是此处引用材料的相关权利人，希望移除该内容或调整署名，
请提交 issue，我们会尽快处理。
