# Third-party sources

SOFT LAB is a personal project made for **study and exchange**, and **not for
commercial use**.

Several of the effects on the site come from other open-source projects. Each is
listed below with its original link, so a reader can trace it further upstream —
there is no need for us to pass legal judgement on someone else's work.

| Where | From | Licence |
|---|---|---|
| `src/experiments/soft-matter/` | [Luffyzhang2016 / soft-matter](https://github.com/Luffyzhang2016/soft-matter) — rigid-body motion, deformable shell, shape generators, HDRI refraction shader | no LICENSE file upstream |
| `src/experiments/soft-matter/vendor/HDRLoader.js` | [three.js](https://github.com/mrdoob/three.js) — the RGBE HDR texture loader, adapted from its `RGBELoader` addon | MIT |
| `src/experiments/canvas-lab/` | [DavidHDev / canvas-ui](https://github.com/DavidHDev/canvas-ui) — the four canvas effects, re-implemented from behaviour | MIT + Commons Clause |
| `src/experiments/cloud-train/scene.frag` | **mdb**, *"Up in the CloudSea"*, via [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex) (MIT) and [incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train) | no redistribution licence supplied upstream |
| `public/studio.hdr` | [Poly Haven](https://polyhaven.com/a/pav_studio_03) — "PAV Studio 03" by Grzegorz Wronkowski | CC0 |
| the **Destroy** section | [Hugo Duprez / Sprite Fusion](https://www.spritefusion.com) — an external game, linked rather than bundled | — |
| **Soft Cat** | visual reference from an unattributed GIF; no assets bundled | — |
| `react` / `react-dom` / `three` and the build tools | npm dependencies | MIT |

The copyright in all of the above belongs to the respective authors.

## On Cloud Train

`scene.frag` is the **starting point** for SOFT LAB's own take on the Cloud Train
scene, not its final form. The parameters, the palette families and the
post-processing grade (`post.frag`, `palettes.ts`) are already this project's own
work, and a rewrite of the scene shader itself is in progress — the goal is an
implementation of our own, rather than keeping someone else's.

## Notes

- The works above are used for **study and research**; they are credited on the
  site and in the source, with links back to their origins.
- This project is **not for commercial use** — please do not use any part of it
  commercially.
- If you are the rights holder and would like the credit changed or the material
  removed, please open an issue and it will be handled promptly.
- The parts SOFT LAB wrote itself (the site shell, hash router, i18n, theme and
  motion token systems, all button effects, Cloud Train's post-processing and
  palettes, the version log) are released under the **MIT** licence — see
  [LICENSE](LICENSE).
