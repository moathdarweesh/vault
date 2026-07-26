# THE VAULT — Brand & Design System

> The identity is **VAULT Machined**: *precision-made, not politely drawn.*
> Flat edges, a strict grid, pure black, one colour that leads.
> Every rule here is enforceable and was derived by measuring the codebase, not asserted.

---

## 1. The mark

Five vertical bars — the bars of a vault door. **No crossbar**: that belongs to the
`dumbbell` glyph, and for a long time the app icon carried it, so the icon was the
equipment, not the brand.

| Use | Source |
|---|---|
| App icon (PWA / home screen) | `icons/icon.svg` — 512px, black `rx=96` tile, `#ff6a00` bars, `stroke-width=40` |
| In-app logo | `ICONS.vault`, rendered by `icon('vault', 22)` in `vaultBar()` |

The two must stay the same shape. `ICONS.vault` has no crossbar; neither does the icon.

## 2. Colour

**Brand accent: `#ff6a00` — hot metal.**

Chosen by measurement, not taste:
- **7.31:1** on `#000` (AA for body text, AAA for large).
- Largest RGB separation from the two colours it could be confused with — the
  `sunset` theme's own accent `#fb923c` (distance 72) and `--cat-arms` `#fbbf24`
  (distance 92). Softer ambers made `dark` and `sunset` near-duplicates.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#ff6a00` | the one leading colour |
| `--accent-2` / `-3` | `#e05c00` / `#b84a00` | pressed / deeper steps |
| `--accent-soft` | `rgba(255,106,0,.13)` | tinted fills behind icons |
| `--accent-line` | `rgba(255,106,0,.30)` | selected borders |
| `--accent-ink` | `#1a0800` | text **on** the accent — 6.78:1 |
| `--accent-rgb` | `255, 106, 0` | for `rgba(var(--accent-rgb), α)` |
| `--accent-text` | `= --accent`, `#b34a00` in light | the accent as **small text** |

**One brand orange, two tokens.** `--accent` is identical in light and dark — the
primary button is `#ff6a00` in both. But `#ff6a00` is only 2.82:1 as 11–13px text
on a white card, so light mode overrides `--accent-text` alone. Use `--accent` for
fills; `color:` and `border-color:` take `--accent-text`.

`--accent-text` is declared on **`body`**, never `:root`: `var()` resolves against
the element it is declared on, and the theme classes live on `<body>` — declaring it
on `:root` froze it to the root's orange and handed `frost` and `sand` an
accent-text belonging to a different theme.

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
- `--text-faint` is decorative only (dots, bars). Never use it for a value the user
  reads — that shipped once, at 3.97:1.
- A styled `<button>` must set `color`. Without it, it inherits the UA `buttontext`
  default; `.settings-action-row` measured **2.23:1** that way.

## 3. Geometry — the 2-unit grid

The signature. Already enforced across all 53 icons and verified by script.

- `viewBox 0 0 24 24`, live area 20×20, optical centre 12,12.
- Every endpoint and vertex on an **even** coordinate.
- Angles **0° / 45° / 90°** only.
- Radii from **{1, 2, 3, 4, 6, 8, 10}**. Outer `rx=2`, inner `rx=1`.
- **Flat caps, mitre joins** (`stroke-linecap: butt`, `stroke-linejoin: miter`).
  This is what separates the set from Lucide/Feather.
- Max **5 sub-paths**; min **3 units** between parallel strokes or they merge at 16px.
- One signature element per icon max: a filled `r=1` centre dot.

## 4. Type

**Inter** (Latin) · **Tajawal** (Arabic). Weights 400–900.

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

Both are first-class. **All 13 themes measure zero contrast failures** across 12
views (v205) — verified by a scrim-aware sweep, i.e. one that knows a gradient
overlay counts as the real backdrop. A naive checker reports the bento cards as
1.10:1 when their text actually sits on a 0.92-black scrim; don't "fix" those.

- A fresh install picks the theme from the device (`detectTheme()`,
  `prefers-color-scheme`) — the same principle as language: never ask for
  something the device already knows. All 13 stay available in Settings.
- Semantic hues (`--up`, `--down`, `--red`, `--green`) and the three category
  hues used as **text** (`--cat-chest/-legs/-shoulders`) have light-theme
  overrides. The other 13 `--cat-*` are deliberately untouched — they only paint
  over the bento scrim, where the light hues are correct.
- `--text-mute` / `--text-dim` are calibrated against each theme's **`--surface-3`**,
  not against `--bg`. They sit on tinted tiles, and that is where they were failing.

## 8. Known gaps (measured, not yet fixed)

| Gap | Size |
|---|---|
| Spacing token adoption | **6%** — 563 hardcoded px. 43% would be a pure find-replace; the rest is off the 4px scale (6, 10, 14, 18 dominate), so the scale needs a 2px grid first |
| Font-size adoption | **9%** — 276 hardcoded, now 56% mechanically replaceable |
| Radius / motion adoption | 34% / 25% |
| Three parallel stat systems | `.stat-box-*`, `.stat-cell-*`, `.stat-tile`/`-grid`/`-row` |
| Nav icon stroke weight | Nav renders at 22px but hard-codes `stroke-width: 2`; the band for that size is 1.75 |
