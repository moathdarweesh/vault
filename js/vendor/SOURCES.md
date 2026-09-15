# Vendored libraries — what they are, and how to prove it

This app ships **no build step and no npm dependencies**, which is most of why the
highest-rate supply-chain risk for an AI-built project does not exist here: there
is no install step for a hallucinated or typosquatted package to ride in on.

Two files are the exception. They are third-party code, committed to this repo,
executed with full privileges in the app's own origin, with access to
`localStorage` — where the session token lives.

> ⚠️ **Before this file existed, nobody could say WHICH VERSION was running.**
> Neither bundle carries a filename version, `package.json` lists no dependency,
> and the commits that added them recorded no source. So "is the library in my app
> clean?" was unanswerable — not "probably yes", *unanswerable*. That is the gap
> this file closes, and **contract 33 is what keeps it closed**: it recomputes
> each hash on every commit and refuses one where a byte has moved or a new file
> has appeared in this folder without a row here.

Both were verified against the published upstream artifact by **downloading it and
comparing SHA-256** — not by trusting a filename, and not by reading a version
string out of the bundle (the bundle is the thing under suspicion).

## @supabase/supabase-js

```
file:    js/vendor/supabase.js
sha256:  c123f7e874934778b7d89fee7dce8de26c858a2c3a92fd7a3f870394a6a2f91f
```

| | |
|---|---|
| package | `@supabase/supabase-js` |
| version | **2.108.2** |
| artifact | `dist/umd/supabase.js` (the UMD build, not `.min.js`) |
| source | https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.js |
| size | 204,619 bytes |
| upstream | https://github.com/supabase/supabase-js |
| licence | MIT |
| used by | `js/cloud.js` (auth + the `vault_data` blob), `admin.html` |

**Byte-identical to the published artifact** — the vendored copy carries no local
edit. Loaded from `index.html` with the `?v=` marker, preloaded there too.

## @zxing/library

```
file:    js/vendor/zxing.min.js
sha256:  d7cc8f69dd70bdcf3ac00c9ae572bf2acb9f4132ba379c72df842e4db918652d
```

| | |
|---|---|
| package | `@zxing/library` |
| version | **0.21.3** |
| artifact | `umd/index.min.js` |
| source | https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js |
| size | 336,008 bytes |
| upstream | https://github.com/zxing-js/library |
| licence | Apache-2.0 |
| used by | `js/app.js` — the barcode scanner's engine B, **lazy-loaded** (`loadZXing()`), so it is never on the boot path |

**Byte-identical to the published artifact.** Identified by hashing 22 candidate
artifacts across 11 versions until one matched; nothing in the file itself names
its version.

## Known vulnerabilities — as of 2026-09-15

`npm audit` against exactly these two pinned versions (and everything they
resolve): **0 critical · 0 high · 0 moderate · 0 low.**

Both are behind the current release (`supabase-js` 2.116.0, `@zxing/library`
0.23.0). Neither gap is a security one today. **Being behind is only safe while
someone is checking** — see the re-check below.

## How to re-verify, and when

Re-run this at every APK build and whenever either file is replaced. It answers
"is what I ship still what upstream published?", which no other check in this
repo can:

```bash
sha256sum js/vendor/supabase.js js/vendor/zxing.min.js
curl -sL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.js | sha256sum
curl -sL https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js | sha256sum
```

For the advisory half, build a throwaway `package.json` naming just these two
versions and run `npm install --package-lock-only --no-audit && npm audit`. It
writes a lockfile and downloads no code, so it never brings a dependency near
this project — which is the whole point of having none.

**Upgrading either one means replacing the file, re-running the two hashes above,
and updating the block here in the same commit.** Contract 33 fails the commit
otherwise, which is deliberate: a hash that does not match the file is worse than
no hash, because it tells the reader a tampered file is genuine.
