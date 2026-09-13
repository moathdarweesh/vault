"""Two-level layout: communities are placed against each other, then members are
laid out inside their own community. A single global spring_layout on 1643 nodes
produces a hairball where nothing reads; separating the two scales is what makes
the community structure visible at a glance."""
import json, math, os
from collections import defaultdict
from pathlib import Path

os.chdir('C:/Users/moath/vault')
import networkx as nx

g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes, links = g['nodes'], g['links']
by_id = {n['id']: n for n in nodes}

comm = defaultdict(list)
for n in nodes:
    comm[str(n['community'])].append(n['id'])

# ---- level 1: the community meta-graph -------------------------------------
meta = nx.Graph()
for cid, members in comm.items():
    meta.add_node(cid, size=len(members))
cross = defaultdict(int)
for e in links:
    a, b = by_id.get(e['source']), by_id.get(e['target'])
    if not a or not b:
        continue
    ca, cb = str(a['community']), str(b['community'])
    if ca != cb:
        cross[tuple(sorted((ca, cb)))] += 1
for (a, b), w in cross.items():
    meta.add_edge(a, b, weight=w)

# k pushes the big clusters apart; seeded so the picture is reproducible.
meta_pos = nx.spring_layout(meta, k=2.6, iterations=600, seed=7, weight='weight')

# ---- level 2: inside each community ----------------------------------------
SPREAD = 5200.0          # world units across the whole canvas
pos = {}
for cid, members in comm.items():
    sub = nx.Graph()
    sub.add_nodes_from(members)
    ms = set(members)
    for e in links:
        if e['source'] in ms and e['target'] in ms:
            sub.add_edge(e['source'], e['target'])
    n = len(members)
    # radius grows with sqrt(n) so density stays roughly constant across clusters
    r = 26 * math.sqrt(n) + 18
    if n == 1:
        local = {members[0]: (0.0, 0.0)}
    elif sub.number_of_edges() == 0:
        local = {m: (math.cos(2 * math.pi * i / n) * r * 0.6,
                     math.sin(2 * math.pi * i / n) * r * 0.6) for i, m in enumerate(members)}
    else:
        local = nx.spring_layout(sub, k=1.1 / math.sqrt(n), iterations=260, seed=11)
        local = {k: (v[0] * r, v[1] * r) for k, v in local.items()}
    cx, cy = meta_pos[cid]
    for nid, (x, y) in local.items():
        pos[nid] = (cx * SPREAD + x, cy * SPREAD + y)

deg = defaultdict(int)
for e in links:
    deg[e['source']] += 1
    deg[e['target']] += 1

for n in nodes:
    x, y = pos.get(n['id'], (0.0, 0.0))
    n['x'] = round(x, 1)
    n['y'] = round(y, 1)
    n['deg'] = deg.get(n['id'], 0)

# community centroids, for the sidebar's "fly to" and the cluster captions
cent = {}
for cid, members in comm.items():
    xs = [by_id[m]['x'] for m in members]
    ys = [by_id[m]['y'] for m in members]
    cent[cid] = {
        'x': round(sum(xs) / len(xs), 1),
        'y': round(sum(ys) / len(ys), 1),
        'n': len(members),
        'name': by_id[members[0]].get('community_name') or f'Community {cid}',
        'r': round(max(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 30, 1),
    }
g['communities'] = cent
Path('graphify-out/graph.json').write_text(json.dumps(g), encoding='utf-8')

xs = [n['x'] for n in nodes]
ys = [n['y'] for n in nodes]
print(f'laid out {len(nodes)} nodes in {len(comm)} communities')
print(f'  world extent: x {min(xs):.0f}..{max(xs):.0f}   y {min(ys):.0f}..{max(ys):.0f}')
print(f'  cross-community edges: {sum(cross.values())} over {len(cross)} community pairs')
