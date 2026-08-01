# THE VAULT

A workout and nutrition tracker. Plan a training rotation, log sets and cardio,
scan food barcodes, track calories, water, sleep and body weight. Bilingual
English/Arabic with full RTL, dark and light, and it works offline.

**Live:** <https://moathdarweesh.github.io/vault/> · **Install (Android):** <https://moathdarweesh.github.io/vault/get/>

Vanilla JavaScript. **No framework, no build step, no bundler.** The files you
edit are the files the browser runs.

---

## Layout

The repository root is also the **GitHub Pages web root**, so the files that
serve the app live at the top level and cannot be moved — every installed app
loads them from those exact paths.

| Path | |
|---|---|
| `index.html` | The shell: markup, script order, and the cache-version markers. |
| `styles.css` | One stylesheet. The identity layer at the end is the authority. |
| `js/` | The application. Load order in `index.html` **is** the dependency graph. |
| `assets/`, `icons/` | Exercise photos and the app mark. |
| `admin.html` | Owner-only console (not in the Android app). |
| `privacy.html`, `get/`, `download/` | Public pages. |
| `manifest.json`, `version.json` | PWA manifest; the update manifest the shell polls. |
| **`backend/`** | Supabase SQL and the Cloudflare Worker — see [`backend/README.md`](backend/README.md). |
| **`docs/`** | Architecture, brand, Android, automation, audits. |
| `scripts/` | Release, build, graph and PDF tooling. |
| `android/` | The Capacitor shell. |
| `CLAUDE.md` | The working guide: invariants, gotchas, and why things are the way they are. Read this before changing anything. |

## How the files talk to each other

There is not a single `import` or `require` in `js/`. The files publish onto
`window` — `DB`, `Cloud`, `Health`, `Notify`, `FoodAI`, `Tables`, `VaultUpdate` —
and **the `<script>` order in `index.html` is what makes that work.** Reordering
those tags breaks the app in ways no tool will warn you about.

- `js/storage.js` — `DB.*`, every read and write. Local-first: one JSON blob in
  `localStorage`, synced whole to Supabase.
- `js/cloud.js` — auth and sync. Publishable key only, never `service_role`.
- `js/app.js` — all 19 views, the router, and both translation tables.
- `js/tables.js` — one-way analytics projection into the normalized tables.

## Running it

```bash
node dev-server.js
```

<http://localhost:8080>, served `no-store` so you never debug a cached file.

There is **no test framework**. "Verified" here means driven in a real browser.

## Releasing

```bash
npm run release
```

That rewrites all 16 cache markers and verifies them; a pre-commit hook refuses
a commit that ships code without them. **Never bump a version by hand** — the
markers live in three files and a missed one means the change reaches nobody.

Push to `main` and GitHub Pages serves it. The Android app is a thin shell over
the same live URL, so a push updates web and phone together — **a new APK is only
needed for native changes.**

## Docs

| | |
|---|---|
| [`docs/LLD.md`](docs/LLD.md) | Low-level design, layer by layer (also as a PDF). |
| [`docs/BRAND.md`](docs/BRAND.md) | The identity. Colour, type, the mark. |
| [`docs/ANDROID.md`](docs/ANDROID.md) | Building and shipping the APK. |
| [`docs/AUTOMATION.md`](docs/AUTOMATION.md) | What runs automatically and what does not. |
| [`docs/CODEBASE_REVIEW.md`](docs/CODEBASE_REVIEW.md) | The hardening audit and the invariants it produced. |
| [`backend/README.md`](backend/README.md) | Which SQL has been applied, in what order, and what has not. |
