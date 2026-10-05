# Third-party notices

SOFT LAB contains both independently written code and effects that are adapted
from, rebuilt from, or visually informed by the work of others.

The **MIT License** in this repository's root **applies only to content SOFT LAB
wrote itself**. It does not relicense any of the third-party works, code
fragments, adapted shaders, assets or other protected material listed below.

This file records provenance and the current state of verification. **It does
not itself grant any rights.** Where this notice conflicts with an original
licence or an author's terms, the original terms prevail.

**Last updated:** 5 October 2026

> 中文版见 **[THIRD_PARTY.zh-CN.md](THIRD_PARTY.zh-CN.md)**。

---

## Status key

- **Confirmed:** verifiable evidence of provenance and an applicable licence or
  authorisation is on record.
- **Conditional:** a default platform licence may apply, but the specific work
  page and the terms in force at the time still need to be preserved as
  evidence.
- **Unverified:** an author is known or suspected, but redistribution
  authorisation has not been established. **Attribution alone is not
  permission.**
- **Reference only:** implemented independently from publicly shown visuals or
  interaction concepts; no third-party source or assets are included.

## Scope of the project's own rights

- SOFT LAB claims rights only over what it wrote itself: the implementation,
  interface, parameter controls, lifecycle code and other original additions.
- The project claims no ownership over third-party works or over parts derived
  from them. Separable original additions fall under the repository's MIT
  License; that does not change the licence of the underlying or inseparable
  third-party material.
- Mentions of authors, projects and products serve to identify provenance and
  give credit. They **do not imply sponsorship, affiliation, approval or
  endorsement**.
- Every adaptation or rebuild here is an unofficial implementation and must not
  be described as an official release by the original author.
- **Attribution and change notes do not cure a missing licence.**

---

## 1. Soft Matter — `src/experiments/soft-matter/`

| | |
|---|---|
| Original work | soft-matter |
| Author | Luffyzhang2016 |
| Source | https://github.com/Luffyzhang2016/soft-matter |
| **Status** | **Unverified** |

SOFT LAB ports the rigid-body motion, deformable shell, shape generators and
HDRI refraction shader (`vendor/physics.js`, `vendor/shapes.js`), lifting out the
DOM bindings so a React panel can drive them.

**The upstream repository has no LICENSE file.** No licence means all rights
reserved, with no grant of redistribution. Therefore:

> **Until the author grants permission, this notice does not claim that SOFT LAB
> holds a right to publicly redistribute that code.**

**SOFT LAB's changes:** removed the DOM bindings, re-wired the model to a React
parameter panel and the site's theme system, added TypeScript declarations,
adjusted module import paths.

This is an unofficial adaptation. The project does not suggest that
Luffyzhang2016 endorses or is affiliated with SOFT LAB.

**The repository's MIT License does not apply to this experiment's `vendor/`
directory.**

> Exception: `vendor/HDRLoader.js` has a separate origin — it is adapted from
> three.js's `RGBELoader` addon, licensed **MIT**. See section 4. Its original
> copyright header is retained in the file.

## 2. Canvas Lab — `src/experiments/canvas-lab/`

| | |
|---|---|
| Reference work | canvas-ui |
| Author | David Haz (DavidHDev) |
| Source | https://github.com/DavidHDev/canvas-ui |
| Licence | MIT + Commons Clause License Condition v1.0 |
| **Status** | **Conditional** |

The four effects (asciify / decrypt / ripple / glitch) were **re-implemented from
the documented behaviour**, not copied: the upstream source was read to
understand behaviour, and the code here is SOFT LAB's own (see the header
comment in `effects/asciify.ts`).

⚠️ The upstream licence carries a Commons Clause condition. Quoting it:

> you do not sell, sublicense, or redistribute the components themselves —
> whether alone, in a bundle, or **as a ported version**.

The phrase *"as a ported version"* was added by the upstream author; it is not
part of the standard Commons Clause wording. This repository publishes one `.ts`
file per effect; **if a reader considers those files a port of the upstream
components, that condition applies to them.** It is flagged so downstream users
can make that call with their eyes open.

**SOFT LAB's changes:** did not reuse the upstream's experimental-API route;
instead rasterises the text itself and measures per-cell coverage before emitting
characters; wired into this site's duration tokens and parameter panel; the four
effects share one interaction framework.

This is an unofficial implementation. The project does not suggest that David
Haz endorses or is affiliated with SOFT LAB.

## 3. Cloud Train — `src/experiments/cloud-train/scene.frag`

| | |
|---|---|
| Author credit retained in the supplied material | **mdb** |
| Original source | not verified |
| Original licence or authorisation | not verified |
| **Status** | **Unverified** |

**Chain of custody:** mdb ("Up in the CloudSea") → the "Cloud Train Background"
plugin in [Rice-dog / code-codex](https://github.com/Rice-dog/code-codex) (MIT) →
[incarnation-gem / sunset-cloud-train](https://github.com/incarnation-gem/sunset-cloud-train)
→ this repository.

`scene.frag` is **kept verbatim**. The whole file has exactly one change: the
time-spread constant `4.` in the foreground averaging loop becomes `4./3.`
(the diff is marked in `engine.ts`).

The upstream code-codex third-party notice lists this shader as *Unverified* and
states:

> Until an authoritative source licence is preserved or direct authorisation is
> obtained from the relevant rights holder, this notice does not claim that the
> project holds a right to publicly redistribute the supplied shader.
> **Attribution alone is not permission.**

**This repository takes the same position: until an applicable licence or direct
authorisation is obtained, this notice does not claim that SOFT LAB holds a
right to publicly redistribute that shader.**

**SOFT LAB's changes:** wired the shader into a two-pass pipeline (offscreen
texture + post-process grade), wrote `post.frag` and the colour grading, the
twenty-plus lit palettes, the parameter panel and the single-file HTML export.
**The repository's MIT License does not apply to `scene.frag` or to parts derived
from it** (`post.frag` and `palettes.ts` are SOFT LAB's own and do fall under
MIT).

This is an unofficial adaptation. The project does not suggest that mdb, or any
possible originating author, endorses or is affiliated with SOFT LAB.

## 4. three.js — Confirmed

| | |
|---|---|
| Source | https://github.com/mrdoob/three.js |
| Licence | **MIT** — Copyright © 2010-2025 three.js authors |
| **Status** | **Confirmed** |

Used for: the Soft Matter 3D renderer; and
`src/experiments/soft-matter/vendor/HDRLoader.js` (an RGBE HDR texture loader
adapted from three.js's `RGBELoader` addon, with the original copyright and
licence header retained). Also a runtime dependency (`package.json`).

## 5. Poly Haven — "PAV Studio 03" — Confirmed

| | |
|---|---|
| Source | https://polyhaven.com/a/pav_studio_03 |
| Author | Grzegorz Wronkowski |
| Licence | **CC0 1.0** |
| **Status** | **Confirmed** |

Used as `public/studio.hdr` — the environment map behind the Soft Matter
experiment's refraction. (CC0 requires no attribution; the credit here is
voluntary.)

## 6. The Destroy section — Reference only

| | |
|---|---|
| Work | destroy-the-web (an external game) |
| Author | Hugo Duprez / Sprite Fusion |
| Source | https://www.spritefusion.com |
| **Status** | **Reference only** |

`src/lib/destroy.ts` stores only the game's entry URL and the link-parameter
construction logic. It **contains none of that game's code or assets**; the link
opens the other site in a new tab.

## 7. Soft Cat — Reference only

| | |
|---|---|
| Visual reference | an unattributed GIF (a hand pressing into a cat-shaped body) |
| **Status** | **Reference only** |

`src/experiments/soft-cat/` — a chain of segment springs on Canvas 2D, with
collision and deformation — was written independently by SOFT LAB and includes
none of that GIF's assets or code. It is listed because the effect it depicts
came from elsewhere.

## 8. Runtime dependencies

| Package | Licence | Status |
|---|---|---|
| `react` / `react-dom` | MIT | Confirmed |
| `three` | MIT | Confirmed (see 4) |
| `vite` / `typescript` / `tailwindcss` / `@tailwindcss/vite` / `@vitejs/plugin-react` | MIT | Confirmed (build-time only) |

## 9. Typefaces

No font files are bundled, and no request is made to any font CDN. The site uses
a system font stack (`Inter`, `PingFang SC`, `Microsoft YaHei`, …) resolved by the
visitor's own machine.

## 10. Written by SOFT LAB

The following is the project's own work, contains no third-party material, and
falls under the repository's MIT License:

- the site shell, hash router, section and panel structure
- the i18n layer and the theme token system
- the motion duration tokens and all button effects (`src/motion/`, `src/buttons/`)
- Cloud Train's `post.frag` grading, `palettes.ts` presets, and the single-file
  HTML export
- the version log (`changelog.ts`) and this notice

---

## If you redistribute

If you distribute this repository's source or its built output:

1. Include this notice and the full text of every applicable licence.
2. Where practical, keep the author, work title, source link and licence note in
   the source.
3. Mark clearly what SOFT LAB changed.
4. **Do not describe material listed as "Unverified" as MIT-licensed.**
5. If an effect's provenance or licence cannot be verified, remove or disable
   that effect from your distribution.

## Scope of the repository licence

The MIT License in the repository root **applies only to SOFT LAB's original
work** (section 10). The material in sections 1 and 3, and whatever a reader
deems a ported version in section 2, remains subject to its own licence,
copyright terms or authorisation.

## Contact

If you are the copyright holder of any work referenced here and believe the
credit, provenance, classification or licence note needs correcting, please open
an issue — it will be handled promptly.

This notice records provenance and licence scope; it is not legal advice. The
project does not warrant that the information here is complete; before any
commercial distribution, or while any significant source remains unclear,
qualified legal advice should be sought.
