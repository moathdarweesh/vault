# THE VAULT

A workout and nutrition tracker: a training rotation with a guided run, sets and
cardio, food logging (barcode, photo, voice, recipes), calories, water, sleep and
body weight. Bilingual English/Arabic with full RTL, dark and light, local-first
and usable offline.

**Live:** <https://moathdarweesh.github.io/vault/> · **Android:** <https://moathdarweesh.github.io/vault/get/>

Vanilla JavaScript — **no framework, no build step, no bundler, no runtime
dependency.** The files you edit are the files the browser runs, served by GitHub
Pages straight from `main`.

---

## Quick start

```bash
npm ci                                             # Capacitor only (the Android shell)
npm i --no-save playwright eslint@9 globals        # dev tools, never in package.json
npm run hooks                                      # enable .githooks/ (pre-commit gate)
node dev-server.js                                 # http://localhost:8080, Cache-Control: no-store
```

Node 24 (CI pins it). The `--no-save` install is one command on purpose: a second
`--no-save` install prunes the first. The browser suites and tools drive the
installed Google Chrome through Playwright (`channel: 'chrome'`).

## How it is built

- **Thirteen classic `<script defer>` files share one global scope**, and their
  order in `index.html` *is* the dependency graph: `i18n → catalog → cloud →
  storage → motion → ui → body → food → app → health → notify → foodai → update`.
  `scripts/shipped.js` spells that list once; contract 1 holds `index.html` to it.
  There is no `import`: modules publish onto `window` (`DB`, `Cloud`, `VltMotion`,
  `Health`, `Notify`, `FoodAI`, `VaultUpdate`, `VAULT_KEYS`).
- **Data** is one JSON blob in `localStorage`, read and written only through
  `DB.*` (`js/storage.js`), synced whole to one RLS-protected Supabase row per user
  (`js/cloud.js`, publishable key only). Exercise photos live beside the blob in a
  side store and a private bucket.
- **Views** are `js/ui.js` (the shared vocabulary, the floor of the call graph),
  `js/body.js`, `js/food.js` and `js/app.js` (the shell, the router
  `navigate(view, ctx)` and the remaining domains).
- **Backend:** Supabase (auth, RLS, SQL in `backend/migrations/`) and one
  Cloudflare Worker (`backend/worker/`) that holds the Gemini key server-side,
  checks the caller's session and charges a per-day AI budget (which fails open
  until `backend/pending/30` is applied — see Owner-only actions). The client
  never holds a secret.
- **Android** is a Capacitor shell that loads the live URL, so a web push updates
  phones with no reinstall. A new APK is needed only for native changes.

## The gate

```bash
npm run verify     # npm run check && npm run lint && npm test
```

| | |
|---|---|
| `npm run check` | `scripts/check-contracts.js` — the "X must match Y" agreements between files, each enforced. |
| `npm run lint` | ESLint 9 with the project's own rules (`eslint.config.js`); a missing linter is a loud skip, and `--strict` (CI) makes it a failure. |
| `npm test` | `scripts/test-all.js` — every `scripts/test-*.js` suite (node `vm` suites and real-browser Playwright suites). A suite that did not run is never counted as passing. |

The commands print their own counts; do not trust a count written in a document.
CI (`.github/workflows/ci.yml`) runs the same three plus the release-marker check
on every push.

**A check is trusted only after it has been seen to fail.** Plant the defect it
exists for, watch it go red with a message naming the problem, restore the file.
A change with no intended behaviour change is proved with the fingerprint net —
`node scripts/fingerprint-net.js matrix --tag before` and `modals --tag before`
before the change, the same with `after`, then `diff before after` — plus the
suites. `scripts/ux-audit.js` and `scripts/ux-flows.js` measure the rendered
design and the tap paths of the daily writes.

## Releasing

```bash
npm run verify && npm run release
git add <the files you changed>      # explicitly — never git add -A
git commit && git push
```

`npm run release` rewrites every cache marker (`?v=N` in the pages, the
`FALLBACK` literal, `version.json`, the `Current version` line in `CLAUDE.md`) and
re-reads them. **It runs no tests** — the gate is `npm run verify`. The pre-commit
hook refuses shipped code whose marker was not bumped. A bad push is fixed forward:
`git revert`, then a new release — never a force-push, since devices compare
version numbers and will not downgrade.

## Owner-only actions

These change something outside the repository and are done by the owner, never by
a contributor or an agent on its own:

- **Live SQL.** Anything in `backend/pending/` is written and not applied. It is
  run in the Supabase SQL editor after a backup, then moved to
  `backend/migrations/` with its row in `backend/README.md` — the only record of
  what the live database holds.
- **Worker deploy.** `cd backend/worker && npx wrangler login && npx wrangler deploy`.
  Secrets go in with `npx wrangler secret put GEMINI_KEY` and never into the repo.
- **A new APK.** Bump `versionCode`/`versionName` in `android/app/build.gradle`,
  `npm run sync`, build (`cd android && ./gradlew :app:assembleDebug`), commit it as
  `download/THE-VAULT.apk` with its `.sha256` sidecar, and set `version.json` →
  `apk.build` / `apk.version` / `apk.sha256` (contracts 11 and 11b refuse a
  mismatch). Every shipped APK is signed by the **debug keystore of the build
  machine** (`~/.android/debug.keystore`, certificate SHA-256 `e9472323…c010b4`).
  That file is unique to the machine: keep an encrypted copy off-machine, and on a
  new machine copy it into `~/.android/` before building, or the next APK will not
  install over the current one and every user has to uninstall.
- **Dashboard settings** — Supabase Auth (password floor, leaked-password
  protection, sign-up and email confirmation) and Cloudflare (Turnstile, the Worker).

## Documentation

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The working guide: stack, rules, invariants and the reasons behind them. Read before changing anything. |
| [`docs/RELEASE-NOTES.md`](docs/RELEASE-NOTES.md) | One section per release since v309 — read the one for the feature you touch. |
| [`docs/REVIEW-2026-09-25.md`](docs/REVIEW-2026-09-25.md) | The 211-finding review: what each batch fixed, and every open item by area. |
| [`docs/AUTOMATION.md`](docs/AUTOMATION.md) | The maintainer's Arabic quick reference: what runs automatically and what does not. |
| [`backend/README.md`](backend/README.md) | Which SQL is applied, in what order, and what is pending. |
| [`backend/worker/README.md`](backend/worker/README.md) | The Worker: modes, caps, error codes, deployment. |
| [`docs/BRAND.md`](docs/BRAND.md) · [`docs/ANDROID.md`](docs/ANDROID.md) | The identity; the Android build and Health Connect. |
| [`docs/LLD.md`](docs/LLD.md) · [`docs/CODEBASE_REVIEW.md`](docs/CODEBASE_REVIEW.md) | Historical records (v271 and v188); `CLAUDE.md` describes the current structure. |

## Design rules

Tokens only (`:root` in `styles.css`: colour, the type scale `--fs-*` with
`--fs-scale` for «Larger text», the radius scale, the three button sizes
52/44/36, motion). The identity layer at the end of `styles.css` wins by source
order, so new component CSS goes above its banner. No circles, no capsule on a
control, every tap target at least 44×44, WCAG AA in both modes, `text-align:
start` rather than `left`. A box fits what is in it, and nothing on screen names
what the user can already see. Contracts 35, 41–43, 60–64 and 69 enforce the parts
a file can prove; the rest is measured in the running app.

## Arabic rules

Every user-facing string goes through `t('key')` with an English and an Arabic
entry in `js/i18n.js`. The Arabic is formal Modern Standard Arabic (فصحى), never
dialect; one term per concept; a count has a literal key per form (one, two,
3–10, 11+). Figures that are measurements are Latin digits in JetBrains Mono;
digits inside Arabic prose are Arabic-Indic. Layout is logical (`start`/`end`,
`inset-inline-*`), and a Latin measurement keeps its left-to-right order.
`scripts/test-i18n.js` enforces the register, the terms and the count forms, over
the dictionaries and the catalogue.
