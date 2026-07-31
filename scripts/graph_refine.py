#!/usr/bin/env python3
"""Refine the community layer of graphify-out/graph.json — deterministically.

    python scripts/graph_refine.py            # rewrite the graph
    python scripts/graph_refine.py --dry-run  # report only

WHY THIS EXISTS
graphify's clustering is a single Louvain pass over the whole graph, and on this
repo it produced a partition that is hard to navigate at both ends:

  * ONE community held 165 of 956 nodes (17%), 159 of them from js/app.js. That
    is not a community, it is a bucket — the biggest file never got partitioned.
  * 18 communities held a single node and 27 held three or fewer, so a third of
    the list was noise you scroll past.
  * Names were partly LLM-written concepts ("Cloud Sync & Auth") and partly raw
    headings lifted out of LLD.md, complete with line counts baked in
    ("6. L5 — UI / View & Router (`js/app.js`, 9513 lines)"). A name with a line
    count in it is stale the next time anyone edits the file — app.js was already
    at 10,400.
  * Two different communities carried the identical name
    "showCenter (centre router)", so the label could not identify either.

Everything here is deterministic and LLM-free, because it runs from a git hook:
splitting uses Louvain on the induced subgraph with a fixed seed, and the sub-
names are taken from each part's own highest-degree member, which is the node a
human would name it after anyway.

Run AFTER graph-methods.js and graph-crossfile.js, BEFORE `graphify export html`.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import networkx as nx

GRAPH = Path(__file__).resolve().parent.parent / "graphify-out" / "graph.json"
DRY = "--dry-run" in sys.argv

SPLIT_OVER = 60      # a community bigger than this gets partitioned again
TINY_MAX = 3         # a community this small gets absorbed by its best neighbour


def clean_name(name: str) -> str:
    """Strip the artefacts of a name lifted from a document heading."""
    n = str(name or "").strip()
    n = re.sub(r"^\d+(\.\d+)*\.?\s+", "", n)            # leading "6. " / "3.5 "
    n = re.sub(r"\s*\([^()]*\b\d[\d,]*\s*lines?\b[^()]*\)", "", n)  # "(app.js, 9513 lines)"
    n = re.sub(r"\s*\(`[^`]+`[^)]*\)", "", n)            # "(`js/app.js`)"
    n = n.replace("`", "").strip(" —-·")
    n = re.sub(r"\s{2,}", " ", n)
    return n or "Unnamed"


def main() -> None:
    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    nodes, links = g["nodes"], g["links"]
    by_id = {n["id"]: n for n in nodes}

    G = nx.Graph()
    G.add_nodes_from(n["id"] for n in nodes)
    for l in links:
        s, t = l.get("source"), l.get("target")
        if s in by_id and t in by_id and s != t:
            G.add_edge(s, t, weight=float(l.get("weight") or 1.0))

    comm = defaultdict(list)
    for n in nodes:
        comm[n.get("community")].append(n["id"])

    before = {
        "communities": len(comm),
        "largest": max(len(v) for v in comm.values()),
        "tiny": sum(1 for v in comm.values() if len(v) <= TINY_MAX),
    }

    # ---- 1. split the oversized buckets ------------------------------------
    next_id = max((c for c in comm if isinstance(c, int)), default=0) + 1
    splits = []
    for cid, members in sorted(comm.items(), key=lambda kv: -len(kv[1])):
        if len(members) <= SPLIT_OVER:
            continue
        sub = G.subgraph(members)
        try:
            parts = nx.community.louvain_communities(sub, seed=7, resolution=1.15)
        except Exception:
            continue
        parts = [p for p in parts if p]
        if len(parts) < 2:
            continue
        parent = clean_name(by_id[members[0]].get("community_name"))
        # Biggest part keeps the parent id/name; the rest become new communities
        parts.sort(key=len, reverse=True)
        for k, part in enumerate(parts[1:], start=0):
            # name it after its own most-connected member
            hub = max(part, key=lambda x: sub.degree(x))
            label = str(by_id[hub].get("label") or hub).rstrip("()")
            name = f"{parent} · {label}"
            for nid in part:
                by_id[nid]["community"] = next_id
                by_id[nid]["community_name"] = name
            splits.append((parent, name, len(part)))
            next_id += 1
        for nid in parts[0]:
            by_id[nid]["community_name"] = parent

    # ---- 2. absorb the tiny ones -------------------------------------------
    comm = defaultdict(list)
    for n in nodes:
        comm[n.get("community")].append(n["id"])
    merged = []
    for cid, members in sorted(comm.items(), key=lambda kv: len(kv[1])):
        if len(members) > TINY_MAX or len(comm) <= 2:
            continue
        # which OTHER community do these nodes touch most?
        votes = Counter()
        for nid in members:
            for nb in G.neighbors(nid):
                c = by_id[nb].get("community")
                if c != cid:
                    votes[c] += 1
        if not votes:
            continue
        target = votes.most_common(1)[0][0]
        tname = next((by_id[x].get("community_name") for x in comm[target]), None)
        for nid in members:
            by_id[nid]["community"] = target
            by_id[nid]["community_name"] = tname
        merged.append((cid, target, len(members)))
        comm[target].extend(members)
        comm[cid] = []

    # ---- 2b. gather the true islands ---------------------------------------
    # Most of the tiny communities are not badly clustered, they are genuinely
    # unconnected: a lone build.gradle, a standalone .sql, a git hook. Step 2
    # rightly refuses to absorb them — there is no neighbour to absorb them INTO,
    # and inventing one would put a false edge's worth of meaning in the graph.
    # But 26 separate one-node entries is exactly the noise that makes the
    # community list unreadable. So collect them under one honest heading: the
    # name states the fact (nothing links here) instead of implying a theme.
    comm = defaultdict(list)
    for n in nodes:
        comm[n.get("community")].append(n["id"])
    islands = []
    for cid, members in comm.items():
        if not members or len(members) > TINY_MAX:
            continue
        outward = sum(1 for nid in members for nb in G.neighbors(nid)
                      if by_id[nb].get("community") != cid)
        if outward == 0:
            islands.extend(members)
    if len(islands) > TINY_MAX:
        for nid in islands:
            by_id[nid]["community"] = next_id
            by_id[nid]["community_name"] = "Unconnected files (no graph edges)"
        next_id += 1

    # ---- 3. name every community from its CONTENT --------------------------
    # graphify persists labels in .graphify_labels.json keyed by community
    # INDEX ("0" -> "App Views & Router"). Any re-clustering renumbers the
    # communities while the file keeps the old mapping, so name 0 lands on
    # whatever group happens to be index 0 next time. That is how the community
    # holding renderHome/renderProgram ended up called "showCenter (centre
    # router)" — after a function in admin.html.
    #
    # So names are derived here from what a community CONTAINS, and looked up by
    # a content signature rather than an index. A curated name survives
    # renumbering; anything uncurated still gets an accurate mechanical name
    # instead of a misleading inherited one.
    comm = defaultdict(list)
    for n in nodes:
        comm[n.get("community")].append(n["id"])

    # Lives in scripts/, not graphify-out/ — that directory is gitignored, so a
    # curated name written there is lost on a fresh clone and the graph silently
    # reverts to mechanical names.
    curated_path = Path(__file__).resolve().parent / "community-names.json"
    curated = {}
    if curated_path.exists():
        try:
            curated = json.loads(curated_path.read_text(encoding="utf-8"))
        except Exception:
            curated = {}

    def signature(members):
        top = sorted(members, key=lambda x: (-(G.degree(x) if x in G else 0), x))[:3]
        return "|".join(sorted(top))

    unnamed = []
    for cid, members in comm.items():
        if not members:
            continue
        sig = signature(members)
        if sig in curated:
            name = curated[sig]
        else:
            files = Counter(by_id[x].get("source_file") or "?" for x in members)
            dom, dom_n = files.most_common(1)[0]
            hub = max(members, key=lambda x: G.degree(x) if x in G else 0)
            hub_label = str(by_id[hub].get("label") or hub).rstrip("()")
            base = str(dom).split("/")[-1]
            inherited = clean_name(by_id[members[0]].get("community_name"))
            # Keep an inherited name only when it is a real concept — not a bare
            # symbol name that clustering happened to pick as the hub.
            looks_derived = inherited.startswith(hub_label) or "(" in inherited
            if inherited and inherited != "Unnamed" and not looks_derived:
                name = inherited
            elif dom_n * 2 >= len(members):
                name = f"{base} · {hub_label}"
            else:
                name = hub_label
            unnamed.append((sig, name, len(members)))
        for nid in members:
            by_id[nid]["community_name"] = name

    seen = {}
    renamed = []
    for cid, members in sorted(comm.items(), key=lambda kv: (-len(kv[1]), str(kv[0]))):
        if not members:
            continue
        name = by_id[members[0]].get("community_name")
        if name in seen:
            # Disambiguate by the community's own busiest node rather than a
            # number: "showCenter (centre router)" twice tells you nothing about
            # which is which.
            hub = max(members, key=lambda x: G.degree(x) if x in G else 0)
            label = str(by_id[hub].get("label") or hub).rstrip("()")
            new = f"{name} · {label}"
            i = 2
            while new in seen:
                new = f"{name} · {label} ({i})"
                i += 1
            for nid in members:
                by_id[nid]["community_name"] = new
            renamed.append((name, new))
            name = new
        seen[name] = cid

    comm = {c: v for c, v in comm.items() if v}
    after = {
        "communities": len(comm),
        "largest": max(len(v) for v in comm.values()),
        "tiny": sum(1 for v in comm.values() if len(v) <= TINY_MAX),
    }

    print(f"  communities : {before['communities']} -> {after['communities']}")
    print(f"  largest     : {before['largest']} -> {after['largest']} nodes "
          f"({after['largest']*100//len(nodes)}% of graph)")
    print(f"  tiny (<={TINY_MAX})  : {before['tiny']} -> {after['tiny']}")
    if splits:
        print(f"  split       : {len(splits)} new communities out of oversized buckets")
        for p, n, sz in splits[:6]:
            print(f"                {n}  ({sz})")
    if merged:
        print(f"  absorbed    : {len(merged)} tiny communities into their strongest neighbour")
    if renamed:
        print(f"  de-duped    : {len(renamed)} name collision(s)")
        for old, new in renamed:
            print(f"                {old!r} -> {new!r}")

    if unnamed:
        print(f"  derived     : {len(unnamed)} community name(s) from content "
              f"(add to community-names.json to override)")

    if DRY:
        print("\n--dry-run: nothing written")
        return
    GRAPH.write_text(json.dumps(g), encoding="utf-8")

    # Re-align graphify's own label store with the partition we just wrote.
    # Left stale it would re-apply the OLD index->name map on the next rebuild
    # and undo every name above.
    labels_path = GRAPH.parent / ".graphify_labels.json"
    final = {}
    for cid, members in comm.items():
        if members:
            final[str(cid)] = by_id[members[0]]["community_name"]
    labels_path.write_text(json.dumps(final, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\ngraph.json rewritten ({len(nodes)} nodes, {len(links)} links)"
          f"; {len(final)} labels re-aligned")


if __name__ == "__main__":
    main()
