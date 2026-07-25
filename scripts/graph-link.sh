#!/bin/sh
# Re-apply the cross-file edges AFTER graphify's background rebuild finishes.
#
# WHY THE WAIT
# The post-commit hook launches graphify's rebuild as a DETACHED process and
# returns immediately. Running scripts/graph-crossfile.js straight away would
# write its edges into a graph.json that the rebuild then overwrites seconds
# later — the links would silently vanish on every commit.
#
# So: watch graph.json's mtime, and once the rebuild has replaced it, add the
# cross-file edges and refresh graph.html. Gives up quietly after ~2 minutes so a
# skipped rebuild (docs-only commit) never leaves a process hanging around.
#
# Invoked backgrounded from .githooks/post-commit.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
GRAPH="graphify-out/graph.json"
[ -f "$GRAPH" ] || exit 0

mtime() { stat -c %Y "$GRAPH" 2>/dev/null || stat -f %m "$GRAPH" 2>/dev/null || echo 0; }

before=$(mtime)
i=0
while [ "$i" -lt 60 ]; do
    sleep 2
    if [ "$(mtime)" != "$before" ]; then
        sleep 3   # let the writer finish flushing
        node scripts/graph-crossfile.js >/dev/null 2>&1 || exit 0
        # refresh the interactive view so it matches the linked graph
        if command -v graphify >/dev/null 2>&1; then
            graphify export html >/dev/null 2>&1
        fi
        exit 0
    fi
    i=$((i + 1))
done
exit 0
