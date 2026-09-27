# THE VAULT — Brand & Design System

> The identity is **flat edges, a strict grid, pure black, and one colour that
> leads.** It is carried by two marks, and which one you see depends on where you
> are standing: **the LOCKUP inside the app**, and **THE BARBELL on everything that
> represents the app from outside it** — the app icon, the launcher, the status
> bar, the notification badge and the splash (owner decision, v403). The cut
> wordmark survives on the two public pages only.
> Every rule here is enforceable and was derived by measuring the codebase, not asserted.

---

## 1. The marks — THE LOCKUP (in the app), THE BARBELL (outside), THE CUT (two pages)

> ⚠️ **THIS SECTION DESCRIBED ONE MARK FOR 158 RELEASES WHILE THE APP SHIPPED
> TWO.** It said the in-app mark was the cut wordmark and pointed at a `.cut`
> class in `styles.css`. That class was **deleted at v227** — the stylesheet says
> so in its own words (`/* --- THE CUT is retired --- */`) — and the top bar has
> drawn the LOCKUP ever since. v348 recorded that three documents agreed with
> each other and disagreed with the app; v367 then designed a whole widget family
> against this page and had to throw it away. **Measure the app, not the
> document.** (v403 then changed the OUTSIDE mark from the cut V to the barbell —
> and wrote contract 72 so the document and the five surfaces cannot part again.)

### 1a. Inside the app — THE LOCKUP

`brandLockup(size)` in **`js/ui.js`** is the mark, and the only mark, on every
in-app surface. Since v413 (owner: «ليش ما تم تغيير اللوقو») it is **the whole
ember barbell** — `barbellMark()`, the five rectangles of `ICONS.dumbbell` in
the icon's three role fills — followed by `VAULT` in Archivo 800 at `.2em` over
`TRAIN` in JetBrains Mono at `.3em`. Until v412 it was two cropped, all-orange
plate halves flanking the name: v403 changed every outside surface and left this
one, so the top bar still wore the old look. Contract 72 now holds its
rectangles and fills to the glyph like every other surface.

| Rule | Value |
|---|---|
| Sizes | **exactly two** — `header` (VAULT 11px) and `splash` (32px). A caller cannot invent a third; anything that is not `'splash'` is the header. |
| Mark height | `round(v × 1.35)` — 14.9px at header, 43.2px at splash |
| Mark width | `markH × 21/12` (the glyph's ink box) — 26.1px / 75.6px: as wide as the two old plates and their second gap, so the lockup's footprint did not move |
| Sub-line | `round(v × 0.5)`, drawn only at `v ≥ 10` |
| Gap | `round(v × 0.57)` |
| Colour | the mark: outer plates `--mark-outer` (#b84a00), inner plates `--mark-inner` (the accent; `--accent-2` on bone), the shaft `--text` — exactly icons/icon.svg's two variants; `TRAIN` in `--accent`; `VAULT` in `--text` |
**Three call sites**, all in `js/app.js`: the top bar (`vaultBar`, on five
screens), the sign-in gate, and onboarding step 0.

> `admin.html` hand-inlines the barbell twice (the console is dark-only, so its
> fills are the dark icon's literals) rather than calling `brandLockup` — it is a
> standalone page with no access to `js/ui.js`. Contract 72 refuses a cropped
> plate half coming back there.

### 1b. Outside the app — THE BARBELL (v403)

The logo is the mark the splash has always opened with, made the app's own:
**`ICONS.dumbbell`** in `js/catalog.js` — five rectangles on the 24 grid, two
**outer plates** 3×6 (r 1.2), two **inner plates** 4×12 (r 1.6) and the **shaft**
5×3.2 between them. Small plate, large plate, shaft: that rhythm is the mark. It
is drawn once, there, and every surface redraws exactly those five boxes —
**contract 72** holds each of them to the glyph within 0.02 units, corners
included — and the in-app LOCKUP crops the same glyph's two halves, so the whole
identity is one path set. Nobody draws the barbell by hand.

**The fills — «الجمر», the embers (the owner's choice over the lead's proposal):**

| Surface | Outer plates | Inner plates | Shaft | Ground |
|---|---|---|---|---|
| Dark: icon, launcher, splash, touch icon | `#b84a00` | `#ff6a00` | `#fdfaf7` | `#000000` |
| Light: `icons/icon.svg` under `prefers-color-scheme: light` | `#b84a00` | `#e05c00` | `#1a1512` | `#faf5f0` |
| Alpha-only: themed icon, status bar, badge | ink | ink | ink | transparent |

Why these: the accent stays the one pure hue, on the two masses that carry the
weight; the outer plates step down to the ember so the mark reads as depth
rather than as one orange block; the shaft is bone because it is the part the
splash throws — light, not heat. On the bone tile the inner plates take the
accent's second step, `#e05c00` (3.40:1), because the raw accent measures
2.65:1 there — the same move the macro bars make on light (§2). Every plate holds
≥ 3:1 on its tile and the shaft ≥ 4.5:1; `scripts/test-brand-icon.js` renders
both variants at 512/192/48 and checks fills, contrast, the maskable circle and
the two PNGs. The trade-off the lead recorded and the owner accepted: this
spends the accent on four blocks instead of one, so inside the app the accent's
signal is carried by the controls; the lockup wears the same three fills as the icon.

**Geometry on each surface.** `icons/icon.svg`: the glyph at scale 15, inset 76
in the 512 tile — ink 61.5% wide, farthest corner 181 px from the centre, inside
the maskable safe circle (radius 204.8 px; `manifest.json` declares `maskable`).
Launcher foreground: scale 2.1, moved 28.8 on the 108 dp canvas — ink 44 dp, 61%
of the 72 dp safe zone, farthest corner 25.4 dp from the centre. Status bar and
badge: the silhouette at .95 about the centre, inside the 2..22 safe area. Splash:
one glyph unit is 1 vmin (`--vs-g`), so the ink is 21% of the short edge, exactly
the width the five bolts had.

### 1c. The two public pages — THE CUT

On `get/index.html` and `privacy.html` the wordmark is cut: a single horizontal
line through the name — the door, and the line only you cross. The line
detaches from the name and still works alone, which is what makes it survive
down to 16px. It ships nowhere else since v403 (the icon carried a cut **V**
from v216 to v402).

The cut is **two layers, never one**: a **slot** the colour of the surface behind the
text, and an **accent hairline** sitting inside it. A single orange line is not the
mark; it is the DON'T at the bottom of this section.

### The law of the cut

| Rule | Value | Why |
|---|---|---|
| Slot height | **7% of the type size**, floor **2px** | proportional so the mark survives being resized; the floor because a slot is still a slot |
| Hairline | **1.5px minimum** | below this it stops being a line inside a slot |
| Position | **50%** Latin, **52%** Arabic | optical, not arithmetic: an Arabic line carries its mass high because of the dots and marks |
| Tracking | **0.02em** | wide tracking turns the cut into a line lying beside some letters |
| Wordmark floor | **24px** (9mm print) | at 24px the slot is already on its 2px floor with a 1.5px hairline inside it |
| Clear space | **slot height × 6** | measured in slots, so it scales itself |
| Hairline colour | **`#ff6a00` in both modes** | one identity, not two — see the exception below |

### Where each form ships

| Use | Form | Source |
|---|---|---|
| App icon, PWA / browser tab | the barbell on a black tile; bone tile under a light scheme | `icons/icon.svg` |
| iOS home screen | the dark tile, opaque and square (iOS rounds it) | `icons/apple-touch-icon-180.png` — **rendered** by `node scripts/build-brand-assets.js` |
| Android launcher | the barbell, three fills, over the black background layer | `res/drawable/ic_launcher_foreground.xml` + `values/ic_launcher_background.xml` (APK) |
| Android themed icon | the same five boxes as one white silhouette | `res/drawable/ic_launcher_monochrome.xml` (APK) |
| Status-bar notification | the silhouette at .95 | `res/drawable/ic_stat_vault.xml` (APK) |
| Web notification badge | the same silhouette, white on transparent | `icons/badge-96.png` — **rendered** from `ICONS.dumbbell` by `node scripts/build-notif-icons.js` |
| Web splash | the barbell alone — NO word (v409): one rep (the row lifts and settles as one object), the bloom, then the door opens from the VERTICAL middle — a left and a right leaf, the barbell split through its shaft, each half leaving with its leaf — and the page drops in from above; no keyframe may resize a bolt (contract 72) | `index.html` + `styles.css` `.vs-*` |
| **Home-screen widgets** | the whole barbell in the dark icon's fills, one image at the glyph's 21:12 box (APK 25; until build 24 the old two plate halves) | `res/drawable/widget_mark.xml`, used once by each `res/layout/widget_*.xml` holder (contract 72) |
| Native splash | frame 0 of the web splash, at each PNG's own size | `res/drawable-*/splash.png` — **rendered** from the live stylesheet by `node scripts/build-brand-assets.js` (APK) |
| **In-app top bar, login, first run** | **the LOCKUP — the ember barbell + VAULT/TRAIN (v413)** | **`brandLockup()` / `barbellMark()` in `js/ui.js`** |
| **Admin console** | the same lockup, hand-inlined | `admin.html` (two copies, not from `js/ui.js`) |
| Download page | the cut wordmark, masked | `get/index.html` |
| **Privacy page** | the cut wordmark, painted | **`privacy.html`** — its own `--cut-slot` / `--cut-hair` |

Four of those are **baked into the APK** (the launcher layers, the status icon,
the widgets' mark, the native splash): editing the file changes nothing on a
phone until a new build is installed. When the glyph or its fills change, run the
two build scripts, run `node scripts/test-brand-icon.js`, and ship a new APK
(build 25 carries the barbell).

**Two ways to draw the slot, and the surface decides which.** On a flat surface,
paint it in that surface's own token — `privacy.html` does this with its own
`--cut-slot` / `--cut-hair`, and every context that moves the mark onto a
different surface MUST override it or the slot reads as a bar laid on top. (The
shared `.cut` class and its `--cut-bg` that this paragraph used to name were
deleted from `styles.css` at v227; the two surviving cut implementations each
carry their own, which is why neither drifted when the class went.) On a surface that is a gradient, an image, or
anything translucent, no single colour can match it: mask the band away instead, so
whatever is behind shows through. `get/index.html` is the masked case, and its
hairline lives on the parent because a mask also erases the element's own pseudo
elements.

### The barbell is the mark again (owner decision, v403)

Until v215 the app shipped five bars in the top bar and a V on the icon — two
marks competing for one job. v216 made the cut the identity and reduced the bars
to texture (the icon's pinstripe, the section tick). v403 reverses that for the
OUTSIDE surfaces: the splash's five bolts were the one thing every user saw at
every launch, and the owner asked for them to become the logo — refined from five
equal bolts into a barbell (small plate, large plate, shaft), and into one glyph
the app already owned. The pinstripe is gone from the icon; the section tick
stays as texture. The V is retired everywhere. The cut survives on the two public
pages, and nowhere else.

### The hairline's contrast exception (owner decision, v216)

The Claude Design spec sets the hairline to `#a34400` on light, and `--accent-text`
encodes that split already. The owner chose `#ff6a00` in **both** modes instead, so
the mark is one colour everywhere rather than two.

The cost, stated plainly: `#ff6a00` measures **2.87:1** on the bone ground. Where the
hairline crosses the gaps *between* letters it is therefore decorative, not a
readable element. It stays legible because most of its length overlaps the near-black
wordmark, and because it is a brand device rather than information — nothing is lost
if a reader cannot resolve it.

**This is the only place `--accent` is permitted under 4.5:1 on light.** It is not a
precedent — the icon's inner plates step down to `#e05c00` on the bone tile for
exactly that reason. Small accent text everywhere else takes `--accent-text`, which
is the entire reason that token exists (§2).

### DON'T

- All-orange plates, grey plates, or an orange shaft: the three fills ARE the mark.
- A circle, a rounded blob, or five equal bars — the barbell has a small / large / shaft rhythm.
- The V, on anything, ever again.
- Drawing the five boxes by hand: every surface copies `ICONS.dumbbell`, and contract 72 refuses a copy that drifted.
- A hand-exported PNG: the touch icon, the badge and the native splash are rendered by scripts.
- On the cut: a slot thick enough to sever the letters, or a hairline thick enough to fill it; the slot anywhere but the optical middle; wide tracking under a cut; a gradient wordmark, or a hairline that is not the accent — never white, never gold.

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

**`light` and `dark` are the only two modes, and they are one identity under two
lights.** Both carry the same `#ff6a00`. There is nothing else to keep the brand out
of: the eleven alternate skins were deleted in v210 precisely because each defined
its own accent, so switching away from `dark` silently dropped the brand. `THEMES` is
`['dark','light']` and §7 is the authority on the pair.

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

The grid governs the icon set. (The *signatures* are §1 — the lockup inside the
app, the cut outside it. This section is
about the icons, which are a supporting system, not the mark.) Since v211 the set is
FILLED — two masses per glyph, base plus accent — rather than stroked, so the
caps/joins rule below describes the *silhouettes* rather than a stroke.

- `viewBox 0 0 24 24`, live area 20×20, optical centre 12,12.
- Every endpoint and vertex on an **even** coordinate.
- Angles **0° / 45° / 90°** only.
- **Flat, mitred silhouettes** — no rounded terminals. This is what separates the
  set from Lucide/Feather. (Pre-v211 this was literally `stroke-linecap: butt` /
  `stroke-linejoin: miter`; the filled set carries the same language in outline.)
- Max **5 sub-paths**; min **3 units** between parallel strokes or they merge at 16px.
- One signature element per icon max: a filled `r=1` centre dot.

**On corner radii, this doc used to lie.** It published "radii from
{1, 2, 3, 4, 6, 8, 10}, outer `rx=2`, inner `rx=1`" — and **not one** of the 39 `rx`
declarations in the shipped set is a member of that set. The real distribution,
measured: `1.4`×9, `.9`×4, `1.2`×4, `1.6`×4, `2.4`×4, `1.3`×3, `.8`×3, `.7`×3,
`2.6`×2, and one each of `1.8`, `3.4`, `5`. The stated set belonged to the STROKED
set that v211 replaced; the filled set softens each mass in proportion to its own
width instead, which is why the values are fractional and continuous.

That is a description, not yet a law. Either derive the real rule and write it here,
or normalise the 39 values onto a stated scale — but do not restore the old sentence,
which described nothing that has shipped since v211. Tracked in §8.

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
| Icon corner radii have no law | 39 `rx` values across 12 distinct numbers, none in the set §3 used to claim. Needs either a derived rule or a normalisation pass |
