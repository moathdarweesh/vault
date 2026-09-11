# Startup performance — v313

The v312 live cold-load trace in isolated Chrome with 4x CPU throttling showed sequential requests for all seven application scripts. Cloud started at 732ms, storage at 972ms, app at 1207ms, and update at 2494ms. Page load completed at 2729ms. These are one measured network run, not a device-wide guarantee.

The scripts now use `defer` in the document head. They download together, are discovered before the inline body theme script waits for the stylesheet, and execute in their original dependency order after the DOM is parsed. No bundler, dependency, data migration, authentication change, or removal of features was needed. The pre-paint theme mirror and ancient service-worker cleanup remain intact.

`scripts/test-startup.js` compares the former blocking body placement with the new placement using the same current source, synthetic 10,000-session store, isolated Chrome, 4x CPU slowdown, and 200ms local JS/CSS response delays. It blocks external requests. Three cold contexts per variant produced these medians:

| Metric | Serial body scripts | Deferred head scripts |
| --- | ---: | ---: |
| Home DOM ready | 1747ms | 1144ms |
| Window load complete | 2636ms | 1196ms |

Home became ready 35% sooner and load completed 55% sooner in this controlled scenario. Home readiness measures rendered DOM availability, not LCP. The test verifies all modules load and all 10,000 sessions remain available without page errors. Actual phone/network timings will vary. `scripts/check-contracts.js` now guards ordered deferred startup against regression.

Validation: `node scripts/test-startup.js`, `node scripts/test-sync-status-ui.js`, `npm run check`, and `npm run release:check`. The existing browser suite covers Arabic/dark and English/light mobile layouts, convenience features, and save-status states.
