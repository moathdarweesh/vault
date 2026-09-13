"""Layout for the VAULT knowledge graph.

THE SHAPE THIS PRODUCES, and why it is not a single global layout:

    one dense CORE   — the giant connected component, 823 of 1684 nodes
    a RING of stars  — the other 96 components, each its own hub-and-spokes

A single spring_layout over the whole graph cannot draw that: networkx scatters
disconnected components at random, so the satellites land on top of each other
and on the core. Laying the core out on its own and then PACKING the rest around
it in rings is what gives the picture its structure — the core reads as a core
because nothing unrelated is sitting in it.

Each component is laid out with ForceAtlas2 (networkx >= 3.4), which is what
produces the dandelion look: a hub's leaves fall close around it instead of being
pushed out to a uniform distance the way spring_layout does.
"""
import json
import math
import os
from pathlib import Path

os.chdir('C:/Users/moath/vault')
import networkx as nx

g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes, links = g['nodes'], g['links']
by_id = {n['id']: n for n in nodes}

G = nx.Graph()
G.add_nodes_from(n['id'] for n in nodes)
for e in links:
    if e['source'] in by_id and e['target'] in by_id:
        G.add_edge(e['source'], e['target'])

deg = dict(G.degree())


def lay(sub):
    """One component, centred on 0,0 and scaled so its radius is ~1."""
    n = sub.number_of_nodes()
    if n == 1:
        return {list(sub)[0]: (0.0, 0.0)}
    if n == 2:
        a, b = list(sub)
        return {a: (-1.0, 0.0), b: (1.0, 0.0)}
    try:
        # ForceAtlas2 keeps leaves near their hub; spring_layout pushes every
        # node to a similar distance and flattens the hub-and-spoke structure
        # that is most of what this picture is made of.
        pos = nx.forceatlas2_layout(
            sub, max_iter=260, jitter_tolerance=1.0,
            scaling_ratio=6.0, gravity=0.55, strong_gravity=False, seed=7)
    except Exception:
        pos = nx.spring_layout(sub, k=1.6 / math.sqrt(n), iterations=260, seed=7)
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    # The MEDIAN, not the bounding-box midpoint. A handful of far-flung nodes
    # drag a bbox centre with them, which is what pushed the dense mass off to
    # one side of the frame while the empty half was pure outlier.
    cx = sorted(xs)[len(xs) // 2]
    cy = sorted(ys)[len(ys) // 2]
    # Normalise on a PERCENTILE, not the maximum. ForceAtlas2 flings a handful of
    # weakly-tied nodes far out; dividing by the furthest one squeezed the other
    # 800 into a dot in the middle, which is why the core read as a speck instead
    # of as the dense mass it is. The bulk fills the disc now and the few
    # outliers are allowed to sit outside it.
    d = sorted(math.hypot(p[0] - cx, p[1] - cy) for p in pos.values())
    r = d[int(len(d) * 0.75)] or (d[-1] or 1.0)
    out = {}
    for k, v in pos.items():
        x, y = (v[0] - cx) / r, (v[1] - cy) / r
        m = math.hypot(x, y)
        # CLAMP the long tail. ForceAtlas2's density is sharply peaked: the
        # furthest 5% sat three times further out than the mass, so normalising
        # on them left a dead ring — a packed centre, nothing, then the
        # satellites. Folding the stragglers back onto the rim fills the disc.
        if m > 1.30:
            x, y = x / m * 1.30, y / m * 1.30
        out[k] = (float(x), float(y))
    return out


comps = sorted(nx.connected_components(G), key=len, reverse=True)
pos = {}

# ---- the core --------------------------------------------------------------
CORE_R = 2100.0
core = comps[0]
for nid, (x, y) in lay(G.subgraph(core)).items():
    pos[nid] = (x * CORE_R, y * CORE_R)

# ---- scatter the satellites over the disc around it ------------------------
# NOT concentric rings. Ring packing put every satellite on one circle and left a
# dead annulus between them and the core; the eye reads that as two unrelated
# pictures. A golden-angle (phyllotaxis) spiral covers a disc EVENLY at every
# radius — the arrangement sunflowers use — so the satellites fill the space the
# way they do in the reference, with the biggest nearest the core because the
# spiral is walked largest-first.
GOLD = math.pi * (3.0 - math.sqrt(5.0))      # 137.5 degrees
GAP = 90.0
area = math.pi * (CORE_R * 1.42) ** 2        # start just clear of the clamped core
for i, comp in enumerate(comps[1:]):
    n = len(comp)
    r = 30.0 * math.sqrt(n) + 22.0
    # consume the area this component needs, then read the radius back off it:
    # equal area per step is what keeps the density even instead of crowding
    # the middle and thinning out at the edge.
    area += math.pi * ((r + GAP) ** 2) * 1.25
    R = math.sqrt(area / math.pi)
    ang = i * GOLD
    cx, cy = math.cos(ang) * R, math.sin(ang) * R
    for nid, (x, y) in lay(G.subgraph(comp)).items():
        pos[nid] = (cx + x * r, cy + y * r)
ring_r = R

for n in nodes:
    x, y = pos.get(n['id'], (0.0, 0.0))
    n['x'] = round(float(x), 1)
    n['y'] = round(float(y), 1)
    n['deg'] = deg.get(n['id'], 0)

# community centroids, for the rail's "fly to"
from collections import defaultdict
comm = defaultdict(list)
for n in nodes:
    comm[str(n['community'])].append(n)
cent = {}
for cid, members in comm.items():
    xs = [m['x'] for m in members]
    ys = [m['y'] for m in members]
    cent[cid] = {
        'x': round(sum(xs) / len(xs), 1), 'y': round(sum(ys) / len(ys), 1),
        'n': len(members),
        'name': members[0].get('community_name') or f'Community {cid}',
        'r': round(max(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 30, 1),
    }
g['communities'] = cent
Path('graphify-out/graph.json').write_text(json.dumps(g), encoding='utf-8')

xs = [n['x'] for n in nodes]
ys = [n['y'] for n in nodes]
print(f'laid out {len(nodes)} nodes — core {len(core)} + {len(comps) - 1} satellites in rings')
print(f'  outermost ring radius: {ring_r:.0f}')
print(f'  world extent: x {min(xs):.0f}..{max(xs):.0f}   y {min(ys):.0f}..{max(ys):.0f}')
