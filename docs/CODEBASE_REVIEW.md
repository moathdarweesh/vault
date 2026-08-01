# THE VAULT — Codebase Evaluation & Enhancement Roadmap

_Build v188 · 6 parallel reviewers → 47 findings · **all 24 critical/high findings adversarially verified against the real files**._

## The single most important number in this report

**24 of 24 verified findings were DOWNGRADED. Zero survived at their claimed severity.**

Not one "critical" was actually critical. The reviewers systematically inflate severity — so this document reports **verified** severities, not claimed ones. Where a verifier corrected a reviewer's facts, the correction is included.

Two proposed fixes were also found to be **wrong** (they would ship a no-op or a regression). Those are flagged inline — do not apply them as written.

---

## What is genuinely good here

A list of 47 problems misrepresents this codebase. The verifiers, who were instructed to be hostile, repeatedly ended up defending it.

- **The data-loss postmortem produced real engineering.** The `blobHasUserData` push guard (`js/cloud.js:235`), the dirty-flag invariant, optimistic concurrency on an integer `version`, and the separate-batch rule in `tables.js` that stops a `null` `custom_image_path` from blanking a live pointer. These name the failure they prevent.
- **57 consecutive clean releases.** A verifier replayed all 12 version markers across every release from v132 to v188 and found **zero drift**. The manual ritual that looks fragile has, in fact, never broken in a way that shipped.
- **Security posture is correct where it counts.** No `service_role` key in any client. Privileged writes only through `SECURITY DEFINER` RPCs that re-check `is_admin()` and refuse self-target. `image/svg+xml` deliberately excluded from the storage mime allowlist.
- **The self-destructing service worker in `index.html:81-96` is evidence of good instincts** — a cache layer previously pinned users to a stale build, and the eviction stub is still there doing its job.
- **`styles.css` should NOT be split** — checked and rejected; it is well-organized.

---

## 1. Fix now

### 1.1 Boot-time housekeeping writes can trigger a false "conflict" that overwrites the newer cloud blob
**`js/cloud.js:384`** · **HIGH** _(claimed critical)_ · effort **M** · proposal sound ✅

**The only finding in the report whose mechanism was confirmed end to end.** The verifier traced the full chain and found the reviewer had *understated* the timing — it is not a race, it is structurally biased:

- `js/storage.js:555` — `save()` unconditionally calls `Cloud.onLocalChange()`
- `js/cloud.js:316` — sets the dirty flag **before** the first `await`; nothing clears it at boot
- `js/storage.js:672` — `DB.health.setData` writes with **zero change detection**, so even an identical Health Connect read dirties the blob
- `init()` reaches `Health.bindHomeSection()` → `silentSync()` at `js/app.js:2419`, while `bootCloud()` isn't called until `js/app.js:8600` and then awaits a ~200KB SDK fetch plus a Supabase round-trip
- `js/cloud.js:383` sees `remoteNewer && isDirty()` → `'conflict'` → user picks "Keep this device" → `chooseLocal()` → `push({force:true})`, which **skips both the empty-blob guard and the concurrency compare**

There is also a non-racy route: an offline foreground `silentSync` sets dirty, the debounced push throws and is swallowed, and dirty persists to the next boot.

**Why high and not critical:** native-only (`isNative()` gates `silentSync`, so web users can't hit it) and it needs Health Connect granted plus a genuinely stale stamp.

Corrections to the reviewer: `syncExerciseImages()` runs *after* `bootSync` and can't dirty the flag in the same boot; `mergeGlobal` is already change-detected (`storage.js:1100` is `if (added) save()`). The real guaranteed pre-boot write is `DB.prefs.setOnboarded()` at `js/app.js:8596`.

**Fix:** add `saveLocal()` in `storage.js` that persists without calling `Cloud.onLocalChange()`, and route housekeeping writes through it.

### 1.2 `loadState()`'s catch-all can overwrite a good blob with `defaultState()`
**`js/storage.js:545`** · **HIGH** _(claimed critical)_ · effort **S**

Narrow trigger, total blast radius. On parse failure, refuse to save and surface the error instead of silently continuing from defaults.

### 1.3 Mirror reconcile can delete every mirrored row
**`js/tables.js:347` / `:351`** · **HIGH** _(claimed critical)_ · effort **S** · _two reviewers converged_

Analytics-only, so no user-facing loss — but it silently guts the tables the admin console reads. Guard the delete on a non-empty, resolved input set.

### 1.4 `save()` has no `QuotaExceededError` handling
**`js/storage.js:556`** · **MEDIUM** · effort **M**

localStorage fills, the write throws, the app keeps running as if saved. Images already have durable bucket copies, so evicting local base64 is a safe pressure valve.

---

## 2. Worth doing — verified real, bounded impact

### 2.1 Logout can wipe data that was never uploaded
**`js/app.js:8072`** · **MEDIUM** _(claimed high)_ · effort **S** · proposal sound ✅

`Cloud.push()` returns bare `undefined` when there's no session (`js/cloud.js:225`), so `safe = (r !== 'blocked' && r !== 'conflict')` evaluates **true** and the device is cleared.

**This is my own regression** — I introduced it earlier in this session as the "push-first logout" fix.

The verifier narrowed the trigger considerably (it needs the token to lapse in a ~1–2 minute window on a confirmation-gated flow) but found two wider variants: a Settings view left mounted across a background/foreground cycle, and a second tab holding the Web Locks lock through a hung offline refresh. Aggravating detail the reviewer missed: the confirm text at `js/app.js:683` actively reassures the user their data is safe while the unsynced delta is discarded.

**Fix:** `return 'nosession';` at `cloud.js:225` (the other three callers ignore the return value), then treat it as unsafe at the call site. One line.

### 2.2 Two date bugs from `toISOString()` vs `todayISO()`
**`js/storage.js:739`** (supplement streak) and **`js/app.js:3992`** (Food view logs to yesterday after midnight) · **MEDIUM** · effort **S**

The verifier **reproduced the streak bug on this machine**. Display-only, one caller, no data corruption, and fixing two lines retroactively corrects every user with no migration. Only bites UTC offset > 0 — which is most of this app's audience.

Third occurrence of this bug class in the project.

### 2.3 Deleting a custom exercise photo doesn't clear `imagePath`
**`js/app.js:3243`** · **MEDIUM** · effort **S** — `syncExerciseImages()` restores it on the next boot.

### 2.4 Gemini Worker fails open + has no rate limiting
**`backend/gemini-worker.js:161` / `:199`** · **MEDIUM** · effort **M** — any non-401/403 is treated as authorized, and the Worker is usable as a general-purpose Gemini relay against your quota.

### 2.5 Sync tells you it succeeded when it didn't
**`js/cloud.js:332`** (a failed pull is recorded as successful — stamp advanced, dirty cleared), **`:389`** (failures reported as "Synced"), **`:304`**, **`:383`** · **MEDIUM** each

### 2.6 Admin console's `version.json` generator omits the `web` key
**`admin.html:818`** · **MEDIUM** _(claimed high)_ · effort **S** · proposal sound ✅

### 2.7 Zero production error visibility
**`js/app.js:7964`** · **MEDIUM** _(claimed high)_ · effort **M** · proposal sound ✅

The verifier independently re-derived the census: **exactly 77** empty catch blocks (app.js 38, cloud.js 20, foodai.js 7, update.js 7, tables.js 5). The historically dangerous paths are precisely the silent catch sites.

### 2.8 ~22 icon-only buttons with no accessible name
**`js/app.js:6386`** · **MEDIUM** _(claimed high)_ · effort **S** · proposal sound ✅ — all 23 cited lines verified verbatim. Most are destructive; the i18n keys mostly already exist.

---

## 3. Two proposals that are WRONG — do not apply as written

### 3.1 ⛔ The release-automation verifier would fail on every run
**`index.html:97`** · **MEDIUM** _(claimed high)_ · **proposal unsound**

The 12 marker sites are exact and the *write* regexes are correct. But:

- **(A)** The verification pass re-scans for `v\d+`, which matches **SVG path data** (`<path d="M4 9v6"/>` at `index.html:54`, `js/app.js:14`, and hundreds more in `ICONS`) — it would exit non-zero every single time. Only the anchored forms are usable: `\?v=\d+`, `__cleaned_v\d+`, `VAULT_BUILD = 'v\d+'`, `"web": \d+`.
- **(B)** The verifier is **near-tautological** — it re-reads markers the same script just wrote, so it only catches a regex that failed to match. It does **not** catch `ea6c74e` ("v150"), the *only* release failure that has actually occurred here: a commit that touched `js/app.js` and nothing else, after the v150 markers were already consumed. That is "forgot to run the ritual at all".

**What to build instead:** the staged-diff guard — fail the commit if `js/*.js` or `styles.css` is staged while `index.html`'s `?v=` still equals `git show HEAD:index.html`'s. That catches the real failure mode.

Also note: 57 consecutive releases had zero marker drift, and the "proof of drift" the reviewer cited (`CLAUDE.md:38` still saying "Current version: v172") is **documentation** drift — nothing reads that line.

### 3.2 ⛔ The contrast fix's own hex values fail its own bar
**`styles.css:156`** · **MEDIUM** _(claimed high)_ · **proposal unsound**

The verifier wrote its own WCAG relative-luminance script (alpha-compositing `theme-aurora`'s rgba surfaces) and **reproduced the failing-theme list exactly** — the problem is real. But the proposed values are wrong:

- `#64748b` on theme-light `--bg` = **4.47:1**, not the claimed 4.9 — still fails AA. On `--surface-2` it's 4.34:1, failing the proposal's own "AND on --surface-2" requirement.
- `#8593a5` for `--text-faint` = **3.13:1** on white, **2.85:1** on the surface that actually matters for the guided-workout ghost hints (`styles.css:3929`) — nowhere near 4.5.

Applying those two hexes verbatim would leave theme-light broken while believing it fixed. Correct values are roughly `--text-dim: #5b6b80` and `--text-faint: #6b7a8d` or darker.

**Unflagged side effect:** `--text-faint` is not text-only — it's a decorative fill at `styles.css:2221` (`.dot-sep`), 3302, 3380, 3532, 4181, 5362 (8px dots, 2–6px bars). Darkening it to AA text contrast **visibly restyles those separators and rank bars in all 13 themes**, which the "~26 hex values, no structural change" framing hides.

---

## 4. Explicitly NOT worth doing

- **Splitting `styles.css`** — checked and rejected; well-organized, and splitting adds release markers to the most error-prone step.
- **ES modules** — a verifier concluded the module graph would **break the cache-bust guarantee**: `?v=N` on the entry does not propagate to statically-imported dependencies, so phones would silently run mixed-version code. If `app.js` is ever split, use **7 classic `<script>` tags**.
- **A framework or build step** — nothing in these 47 findings is caused by their absence.
- **Extracting a shared `commitSets()` for the PR bug** (`js/app.js:6750`) — downgraded high → **low**. PRs are still stored and shown in four other places; only the guided-mode celebratory toast is missing. The verifier also found the proposed fix would be a **no-op** (the summary-save snapshot already includes the PR set). A ~10-line targeted fix inside `commitExercise` is the right trade.
- **A cache-first service worker** (`index.html:83`) — downgraded critical → **MEDIUM**, and this one deserves care. The mechanism is real (cold start with zero signal shows the WebView error page), but: it is **availability, not integrity**; CLAUDE.md explicitly accepts "needs internet at launch" as the price of the live-URL thin shell; a warm APK keeps working through a dead zone and mid-workout signal loss doesn't interrupt logging at all. Most importantly **the fix's downside is worse than the bug** — a naive cache-first SW re-introduces the one failure you cannot recover from remotely: a fleet pinned to a stale build with no push channel. The repo already contains a self-destructing SW, i.e. evidence this happened before. Do it eventually, network-first for navigation and `version.json`, as its own release, verified twice.

---

## Suggested order

1. **§2.1 logout** — one line, and it's my regression.
2. **§1.1 dirty-flag / false conflict** — the only end-to-end-confirmed data-loss path.
3. **§1.2 + §1.3 + §1.4** — the rest of the data-integrity cluster, all S/M.
4. **§2.2 dates** — two lines, retroactively corrects every user.
5. **The staged-diff commit guard** from §3.1 (not the proposed verifier).
6. **§2.8 aria labels** — S effort, disproportionate real-world impact.
7. Everything else as capacity allows.

---

## Honest limitations

- **All 24 critical/high findings are now verified.** The earlier caveat about 10 unverified findings is resolved — a first run lost them to a session limit combined with a bug in my own workflow script that silently recorded dead verifiers as "REFUTED"; I recovered them from the agent journal and re-ran with that defect fixed.
- **The 23 medium/low findings were never adversarially verified** — only critical/high went through verification. Given that 24 of 24 verified items were downgraded, expect some of those to shrink too.
- **Nothing here was fixed.** This is analysis only; no code was changed.
