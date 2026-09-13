#!/usr/bin/env node
/**
 * Build graphify-out/vault-graph.html — the standalone graph viewer.
 *
 * The data is INLINED rather than fetched. Chrome blocks fetch() on file://, and
 * the whole point of this file is that the owner double-clicks it. Serving it
 * would work too; needing a server would not.
 *
 * The template lives in scripts/ because it is AUTHORED source; graphify-out/
 * is gitignored build output. Source of truth for the data is graphify-out/graph.json, which already carries x/y (laid
 * out two-level: communities against each other, then members inside each) plus
 * per-node `type` and `community_name`. This script only wraps it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'graphify-out');
const TPL = path.join(__dirname, 'graph-viewer.template.html');
const GRAPH = path.join(OUT, 'graph.json');
const DEST = path.join(OUT, 'vault-graph.html');

if (!fs.existsSync(TPL)) { console.error('missing template: ' + TPL); process.exit(1); }
if (!fs.existsSync(GRAPH)) { console.error('missing graph: ' + GRAPH); process.exit(1); }

const g = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));
if (!g.nodes || !g.nodes.length) { console.error('graph.json has no nodes'); process.exit(1); }
if (g.nodes.some((n) => typeof n.x !== 'number')) {
  console.error('graph.json has no layout — run scripts/graph-layout.py first'); process.exit(1);
}

// Only the fields the viewer reads. graph.json carries metadata and context
// strings the picture never shows; shipping them would double the file.
const slim = {
  nodes: g.nodes.map((n) => ({
    id: n.id, label: n.label, type: n.type, community: n.community,
    source_file: n.source_file, source_location: n.source_location,
    x: n.x, y: n.y, deg: n.deg,
  })),
  links: g.links.map((e) => ({ source: e.source, target: e.target, relation: e.relation })),
  communities: g.communities || {},
  built_at_commit: g.built_at_commit || null,
};

// A literal close-script tag inside the JSON would end the block early. U+2028
// and U+2029 are legal in a JSON string but are line terminators in JS SOURCE,
// so they must be escaped too or the assignment breaks across lines.
const json = JSON.stringify(slim)
  .split('<').join('\u003c')
  .split(String.fromCharCode(0x2028)).join('\u2028')
  .split(String.fromCharCode(0x2029)).join('\u2029');

const tpl = fs.readFileSync(TPL, 'utf8');
const MARK = '<!--GRAPH_DATA-->';
if (!tpl.includes(MARK)) { console.error('template has no ' + MARK + ' marker'); process.exit(1); }
fs.writeFileSync(DEST, tpl.replace(MARK, `<script>window.__GRAPH__=${json};</script>`), 'utf8');

const kb = (p) => Math.round(fs.statSync(p).size / 1024).toLocaleString('en-US');
console.log(`vault-graph.html  ${slim.nodes.length} nodes · ${slim.links.length} edges · ` +
            `${Object.keys(slim.communities).length} clusters  (${kb(DEST)} KB, self-contained)`);
