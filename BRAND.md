# THE VAULT — Brand & Design System

> The identity is **VAULT Machined**: *precision-made, not politely drawn.*
> Flat edges, a strict grid, pure black, one colour that leads.
> Every rule here is enforceable and was derived by measuring the codebase, not asserted.

---

## 1. The mark

Five vertical bars — the bars of a vault door. **No crossbar**: that belongs to the
`dumbbell` glyph, and for a long time the app icon carried it, so the icon was the
equipment, not the brand.

**There are TWO marks, and they are not interchangeable.**

| Use | Mark | Source |
|---|---|---|
| App icon (PWA + Android launcher) | a solid **V** letterform on a tile | `icons/icon.svg` and `res/drawable/ic_launcher_foreground.xml` |
| In-app logo | the **five bars** | `ICONS.vault`, via `icon('vault', 22)` in `vaultBar()` |
| Status-bar notification | the **five bars**, monochrome | `res/drawable/ic_stat_vault.xml` |

The V is the app icon per the Claude Design brand kit (§01): black tile with an
orange letter in dark, orange tile with a black letter in light. The five bars
appear on it only as the pinstripe texture behind the letter. A v212 pass put the
bars on the tile itself; that was wrong and was corrected at v213.

The bars keep the no-crossbar rule — the crossbar belongs to `dumbbell`.

## 2. Colour

**Brand accent: `#ff6a00` — hot metal.**

Chosen by measurement, not taste:
- **7.31:1** on `#000` (AA for body text, AAA for large).
- Largest RGB separation from the colour it could be confused with — `--cat-arms`
  `#fbbf24` (distance 92). Softer ambers collapsed toward it.

**It is the only pure hue on screen.** The surface ramp sits at H30, five degrees
off the accent's H25, so the orange reads as a signal rather than as its own
surfaces turned up.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#ff6a00` | the one leading colour |
| `--accent-2` / `-3` | `#e05c00` / `#b84a00` | pressed / deeper steps |
| `--accent-soft` | `rgba(255,106,0,.13)` | tinted fills behind icons |
| `--accent-line` | `rgba(255,106,0,.30)` | selected borders |
| `--accent-ink` | `#1a0800` | text **on** the accent — 6.78:1 |
| `--accent-rgb` | `255, 106, 0` | for `rgba(var(--accent-rgb), α)` |
| `--accent-text` | `= --accent`, `#a34400` in light | the accent as **small text** |

**One brand orange, two tokens.** `--accent` is identical in light and dark — the
primary button is `#ff6a00` in both. But `#ff6a00` is only **2.87:1** as 11–13px
text on a white card, so light mode overrides `--accent-text` alone. Use `--accent`
for fills; `color:` and `border-color:` take `--accent-text`.

Light's `--accent-text` is `#a34400`, not the earlier `#b34a00`: that value was
5.39:1 on white but only **4.52:1 on `--surface-3`** and 4.34:1 on an
`--accent-soft` tile — already failing wherever the accent is small text on a tint,
which is exactly where it lives. One step deeper buys 4.91:1 and 4.85:1.

`--accent-text` is declared on **`body`**, never `:root`: `var()` resolves against
the element it is declared on, and the theme classes live on `<body>` — declaring it
on `:root` froze it to the root's orange.

**`light` and `dark` are two MODES of one identity; the other 11 are alternate
skins.** `light` carries the same `#ff6a00`. The eleven skins each define their own
accent — do not push the brand orange into those.

**The other 11 themes are alternate identities, not variations.** Each defines its
own accent set. Do **not** push the brand orange into them — the theme system is the
strongest asset in the codebase precisely because each theme overrides only ~25 of
the 88 tokens and inherits the rest.

**Reserved, never for branding:** `--green` (success/confirm), `--red` (destructive),
the 16 `--cat-*` muscle hues.

### Contrast law
- Text on its background: **≥4.5:1** (≥3:1 at ≥24px, or ≥18.66px bold).
- `--accent-ink` on `--accent`: **≥4.5:1**, in every theme.
- `--text-faint` is decorative only (dots, bars) and measures ~1.4:1 in light **by
  design**. Never use it for a value the user reads — that shipped five times
  (the privacy-policy link, the Health Connect hint, the empty-state line), and the
  fix is to move the rule to `--text-dim`, never to raise the token.
- A styled `<button>` must set `color`. Without it, it inherits the UA `buttontext`
  default; `.settings-action-row` measured **2.23:1** that way.

## 3. Geometry — the 2-unit grid

The signature. The grid still governs the icon set; since v211 the set is FILLED
(two masses per glyph, base + accent) rather than stroked, so the caps/joins rule
below now describes the *silhouettes* rather than a stroke.

- `viewBox 0 0 24 24`, live area 20×20, optical centre 12,12.
- Every endpoint and vertex on an **even** coordinate.
- Angles **0° / 45° / 90°** only.
- Radii from **{1, 2, 3, 4, 6, 8, 10}**. Outer `rx=2`, inner `rx=1`.
- **Flat, mitred silhouettes** — no rounded terminals. This is what separates the
  set from Lucide/Feather. (Pre-v211 this was literally `stroke-linecap: butt` /
  `stroke-linejoin: miter`; the filled set carries the same language in outline.)
- Max **5 sub-paths**; min **3 units** between parallel strokes or they merge at 16px.
- One signature element per icon max: a filled `r=1` centre dot.

## 4. Type

Three faces, one job each (brand kit):

| Face | Role |
|---|---|
| **IBM Plex Sans Arabic** | body text, **both scripts** — one face for an EN/AR app |
| **Archivo** 800, `.2em` | the `VAULT` wordmark, and nothing else |
| **JetBrains Mono** | `.num` — every figure, because every figure is a measurement |

This replaced Inter + Tajawal at v213. There is no longer an RTL font override:
the app used to change typeface when you changed language.

| Token | px | Role |
|---|---|---|
| `--fs-hero` | 40 | one number, hero only |
| `--fs-display` | 32 | headline stat values |
| `--fs-page` | 26 | page titles |
| `--fs-title` | 24 | section headline |
| `--fs-h2` | 19 | sub-heading |
| `--fs-body` | 15 | body, buttons |
| `--fs-label` | 14 | list titles |
| `--fs-sub` | 13 | secondary text |
| `--fs-meta` | 12 | meta, small actions |
| `--fs-caption` | 11 | eyebrows, labels — **the floor** |

**Nothing renders below 11px.** `--fs-page`, `--fs-label` and `--fs-meta` were added
after measuring: 12px (49 uses) and 14px (34 uses) were the 2nd and 4th most-used
sizes in the stylesheet and had no token at all, which is most of why `--fs-*`
adoption sat at 9%.

Do **not** unify 12/13/14/15 — they carry 157 declarations in distinct roles.

## 5. Layout

- One section-header system per screen. `.rot-section-title` (+ `.rot-section-head`
  for a trailing action, `.rot-section-sub` for context). `.section-title` draws a
  `::after` rule and must not be mixed in beside it.
- **A control group and the action beneath it are never flush.** Group → action is
  22px; header → content is 12px; section → section is 24px.
- `text-align: start`, never `left`, unless a `body[dir="rtl"]` override exists for
  that exact selector.
- Buttons are rounded rectangles, medium-to-small. **Never a large circular FAB.**

## 6. Voice

- Arabic: **formal MSA (فصحى)**. No dialect. `كيلوغرام` not `كيلوجرام`; `رطل` not
  `باوند`; `ليس لديك حساب؟` not `ما عندك حساب؟`.
- English: plain and direct. No exclamation marks, no cheerleading.
- Every user-facing string goes through `t()` and exists in **both** languages.
- Follow platform convention over invention: the sign-in ⇄ sign-up switch is a small
  line under the form because that is where every sign-in page puts it.

## 7. Light & dark

**Two modes, not thirteen skins.** The eleven alternate palettes were deleted in
v210: each defined its own accent, so switching away from `dark` dropped the brand.
Dark and light are the same object under two lights.

**The generating rule: *elevation is temperature*.** The page is a void; anything
lifted toward the viewer is heated metal, so the surface ramp climbs in warmth as
well as lightness (H30, S~30%: `#0d0a07 → #17120d → #231b13 → #30251a`). `--bg`
stays **pure black** — it matches the icon tile and is the OLED win on the phone
this runs on; warming the void reads as a sepia filter, not as a brand. Light
inverts the story rather than repeating it: bone ground `#faf5f0`, warm ink
`#1a1512`, near-white sheets. Pure white would read blue against a warm ground.

**Both modes measure zero contrast failures** across 15 views plus the modals
(v210) — verified by a scrim-aware sweep, i.e. one that knows a gradient overlay
counts as the real backdrop. A naive checker reports the bento cards as 1.10:1 when
their text actually sits on a 0.92-black scrim; don't "fix" those. Two cautions
learned the hard way: sweep with transitions disabled (a `transition` on a
`var()`-backed `color` makes `getComputedStyle` report the PREVIOUS mode's value
after a programmatic swap), and render every view — the failures that survived
longest were on screens the earlier sweeps never reached.

- A fresh install picks the mode from the device (`detectTheme()`,
  `prefers-color-scheme`) — the same principle as language: never ask for
  something the device already knows.
- Semantic hues (`--up`, `--down`, `--red`, `--red-bg`, `--green`) and **all eight**
  `--cat-*` have light overrides. The earlier claim that the category hues "only
  paint over the bento scrim" was false: `.pill.cat-*`, `.data-icon.*` and the food
  log's macro totals all paint them as text on a light surface, where `--cat-arms`
  measured 1.63:1. The `--cat-*-bg` tints keep the ORIGINAL bright hue — they are
  backgrounds, and a 14% wash of the darkened value reads as mud.
- `--text-mute` / `--text-dim` are calibrated against **`--surface-3`**, the worst
  surface they land on, not against `--bg`. They sit on tinted tiles, and that is
  where they were failing.
- Elevation is a token, not a hand-tuned shadow: `--bevel` is a single warm
  hairline on the **lit** edge (top in dark, bottom in light — same token, inverted
  physics), and `--elev-1/-2/-3` are the whole vocabulary. A black shadow on a
  black page is invisible, which is why dark had no working elevation before.

## 8. Known gaps (measured, not yet fixed)

| Gap | Size |
|---|---|
| Spacing token adoption | **6%** — 563 hardcoded px. 43% would be a pure find-replace; the rest is off the 4px scale (6, 10, 14, 18 dominate), so the scale needs a 2px grid first |
| Font-size adoption | **9%** — 276 hardcoded, now 56% mechanically replaceable |
| Radius / motion adoption | 34% / 25% |
| Three parallel stat systems | `.stat-box-*`, `.stat-cell-*`, `.stat-tile`/`-grid`/`-row` |
| Nav icon stroke weight | Nav renders at 22px but hard-codes `stroke-width: 2`; the band for that size is 1.75 |
| Coloured shadows | 13 of 41 `box-shadow` lines are `rgba(0,0,0,α)` and could take a warm token; the other ~24 are deliberately accent- or category-coloured (the `.ms-thumb` rings are the only thing colour-coding those thumbnails), so any conversion must be explicit, never mechanical |
