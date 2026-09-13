#!/usr/bin/env node
/**
 * `npm run graph` — the whole pipeline, in the one order that works:
 *
 *   enrich  types + community names          (graph-enrich.js, node)
 *   layout  two-level x/y                    (graph-layout.py, python)
 *   viewer  inline the data into the page    (graph-viewer.js, node)
 *
 * Run it after ANY graph rebuild. The post-commit hook rebuilds graphify-out/
 * from scratch, which drops the layout and reclusters — so everything here has
 * to be re-appliable, and the enrich step is keyed on content signatures rather
 * than on community ids for exactly that reason.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'graphify-out');
const PYFILE = path.join(OUT, '.graphify_python');

function step(name, cmd, args) {
  process.stdout.write(`  ${name} … `);
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.log('FAILED');
    process.stderr.write((r.stdout || '') + (r.stderr || '') + (r.error ? r.error.message : '') + '\n');
    process.exit(1);
  }
  const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || 'ok';
  console.log(last.trim());
  const rest = (r.stdout || '').trim().split('\n').slice(0, -1).filter(Boolean);
  for (const l of rest) console.log('     ' + l.trim());
}

if (!fs.existsSync(path.join(OUT, 'graph.json'))) {
  console.error('no graphify-out/graph.json — run /graphify first to build the graph');
  process.exit(1);
}

step('enrich', process.execPath, [path.join(__dirname, 'graph-enrich.js')]);

// The interpreter that actually has graphify/networkx; graphify itself records it.
const py = fs.existsSync(PYFILE) ? fs.readFileSync(PYFILE, 'utf8').trim() : 'python';
step('layout', py, [path.join(__dirname, 'graph-layout.py')]);

step('viewer', process.execPath, [path.join(__dirname, 'graph-viewer.js')]);

console.log('\n  open  graphify-out/vault-graph.html');
