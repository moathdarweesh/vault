#!/usr/bin/env node
/**
 * Add the object-literal METHOD nodes graphify's JS extractor does not emit.
 *
 *   node scripts/graph-methods.js            # write nodes + edges into the graph
 *   node scripts/graph-methods.js --dry-run  # report only, change nothing
 *
 * WHY THIS EXISTS
 * graphify's JS pass emits a node for every `function foo()` declaration and
 * nothing for `foo() {}` written as a property of an object literal. Measured on
 * this repo: 173/173 top-level functions were in the graph and 70/192 object
 * methods — and for js/storage.js specifically, 2 of 64.
 *
 * That is not a cosmetic gap. `DB.*` IS the domain layer, so the whole
 * persistence API was invisible, including `DB.plan.workoutForDate` — the single
 * source of truth for what workout falls on a date. Worse than absent: every
 * caller's edge collapsed onto the bare `DB` identifier, which is why `DB` came
 * out as the graph's biggest hub with 91 edges. The graph could say "something
 * touches DB" and never which thing, so a query for a real method returned
 * nothing and the nothing looked like an answer.
 *
 * (The Java extractor DOES emit methods — `.useAppContext()` is in the graph —
 * so this is specific to the JS pass, not the model.)
 *
 * WHAT IT DOES, deterministically and with no LLM:
 *   1. find each root API object (`const DB = {`, `window.Cloud = {`, ...);
 *   2. walk it with a brace-depth scanner over a comment/string-masked copy of
 *      the source, tracking the property path, and emit a node per nested object
 *      (`DB.plan`) and per method (`DB.plan.workoutForDate`);
 *   3. link owner -> child with `contains`;
 *   4. scan every JS file for `DB.plan.workoutForDate(` style call sites and
 *      attribute each to its enclosing definition, using the AST's own line
 *      numbers exactly as scripts/graph-crossfile.js does.
 *
 * Only files/roots that exist are touched, ids are derived from the same slug
 * convention graphify uses, and re-running is idempotent (nodes and edges are
 * keyed and de-duplicated against what is already in the graph).
 *
 * Run AFTER `graphify update` and BEFORE scripts/graph-crossfile.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAPH = path.join(ROOT, 'graphify-out', 'graph.json');
const DRY = process.argv.includes('--dry-run');

// Every JS file that can define or call an API method. Files whose export is a
// shorthand list over top-level functions (`window.Health = { open, sync }`)
// need no entry here for DEFINITIONS — those functions are already nodes — but
// they stay in the list because they CALL other files' methods.
const JS_FILES = ['js/app.js', 'js/storage.js', 'js/cloud.js', 'js/tables.js',
  'js/foodai.js', 'js/health.js', 'js/notify.js', 'js/update.js'];

// Words that look like a method definition but are control flow.
const NOT_A_METHOD = new Set(['if', 'for', 'while', 'switch', 'catch', 'return',
  'function', 'typeof', 'do', 'else', 'new', 'delete', 'void', 'in', 'of',
  'try', 'finally', 'await', 'yield', 'case', 'default']);

const norm = (p) => String(p || '').replace(/\\/g, '/');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Blank out comments, strings and template literals, preserving length and line
 * breaks. Brace counting over raw source is wrong the moment a `{` appears in a
 * string or a comment — and this codebase is full of both (template literals
 * build every view).
 */
function mask(src) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  const blank = (a, b) => { for (let k = a; k < b && k < n; k++) if (out[k] !== '\n') out[k] = ' '; };
  // A `/` starts a REGEX (not a division) when the last meaningful token is an
  // operator or opener. This has to be handled, not skipped: js/update.js
  // contains `.replace(/"/g, '&quot;')`, and treating that quote as the start of
  // a string swallowed the remaining 160 lines of the file — which is exactly
  // why `window.VaultUpdate` and `window.Health` were never found.
  const regexCanFollow = () => {
    let k = i - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (k < 0) return true;
    if ('(,=:[!&|?{};+-*%^~<>'.includes(src[k])) return true;
    const word = /[\w$]+$/.exec(src.slice(Math.max(0, k - 9), k + 1));
    return !!word && ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await'].includes(word[0]);
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; blank(i, j); i = j; continue; }
    if (c === '/' && regexCanFollow()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) { j++; break; }
        j++;
      }
      blank(i + 1, j - 1);
      i = j; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      blank(i + 1, j - 1);
      i = j; continue;
    }
    i++;
  }
  return out.join('');
}

/** Index of the `}` that closes the `{` at `open`, or -1. */
function matchingBrace(masked, open) {
  let d = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') d++;
    else if (masked[i] === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}

/** Walk one root object literal, returning [{path:[...], line, isMethod}]. */
function walkObject(masked, startBrace) {
  const found = [];
  const stack = [];             // property names of the objects we are inside
  // Start INSIDE the root brace. Letting the loop consume it would push an
  // anonymous frame (the root's own `const DB = {` line matches no property
  // pattern), and every path below would then carry a leading null and be
  // discarded by the filter at the end — the walk returned nothing at all.
  let depth = 1;
  let i = startBrace + 1;
  let lineNo = masked.slice(0, startBrace).split('\n').length;
  // depth at which each stacked name was opened, so we pop at the right brace
  const openedAt = [];
  while (i < masked.length) {
    const ch = masked[i];
    if (ch === '\n') { lineNo++; i++; continue; }
    if (ch === '{') {
      // Is this brace opening a NAMED property or a method body? Look back at
      // the text since the previous line break / delimiter.
      const lineStart = masked.lastIndexOf('\n', i - 1) + 1;
      const head = masked.slice(lineStart, i);
      let m;
      if ((m = /(?:^|[,{;]|\bconst\b|\blet\b|\bvar\b)\s*(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*$/.exec(head))
          && !NOT_A_METHOD.has(m[1])) {
        found.push({ path: stack.concat(m[1]), line: lineNo, isMethod: true });
        stack.push(m[1]); openedAt.push(depth);
      } else if ((m = /(?:^|[,{;])\s*([A-Za-z_$][\w$]*)\s*:\s*$/.exec(head))
                 && !NOT_A_METHOD.has(m[1])) {
        found.push({ path: stack.concat(m[1]), line: lineNo, isMethod: false });
        stack.push(m[1]); openedAt.push(depth);
      } else {
        stack.push(null); openedAt.push(depth);      // anonymous block
      }
      depth++; i++; continue;
    }
    if (ch === '}') {
      depth--;
      if (openedAt.length && openedAt[openedAt.length - 1] === depth) { stack.pop(); openedAt.pop(); }
      if (depth <= 0) break;                          // root object closed
      i++; continue;
    }
    i++;
  }
  // Anonymous blocks (function bodies inside a method) push null; anything whose
  // path contains a null is a local, not part of the public shape.
  return found.filter((f) => f.path.every((p) => p !== null));
}

function main() {
  if (!fs.existsSync(GRAPH)) { console.error('no graph.json — build the graph first'); process.exit(1); }
  const graph = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));

  const byFile = new Map();
  for (const n of graph.nodes) {
    const f = norm(n.source_file);
    if (!f) continue;
    const m = /^L(\d+)/.exec(n.source_location || '');
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push({ id: n.id, label: n.label || n.id, line: m ? Number(m[1]) : 0 });
  }
  for (const arr of byFile.values()) arr.sort((a, b) => a.line - b.line);
  const fileKey = (rel) => {
    for (const k of byFile.keys()) if (k === rel || k.endsWith('/' + rel) || rel.endsWith(k)) return k;
    return null;
  };

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const newNodes = [];
  const newLinks = [];
  const existingLink = new Set(graph.links.map((l) => l.source + ' ' + l.target + ' ' + (l.relation || '')));
  // full dotted path -> node id, for the call-site pass
  const methodId = new Map();
  let exportEdges = 0;

  // ---- 1. define ------------------------------------------------------------
  for (const rel of JS_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const fk = fileKey(rel);
    if (!fk) continue;
    const src = fs.readFileSync(abs, 'utf8');
    const masked = mask(src);

    // Roots: `const NAME = {` or `window.NAME = {`.
    const rootRe = /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{|(?:^|\n)\s*window\.([A-Za-z_$][\w$]*)\s*=\s*\{/g;
    let r;
    while ((r = rootRe.exec(masked)) !== null) {
      const rootName = r[1] || r[2];
      // Only objects that are an API surface — one that defines methods.
      const braceAt = masked.indexOf('{', r.index + r[0].length - 1);
      const members = walkObject(masked, braceAt);
      const isShorthand = !members.some((m) => m.isMethod);
      const close = matchingBrace(masked, braceAt);
      if (isShorthand && close < 0) continue;
      // A shorthand root is only an API surface if it actually re-exports this
      // file's functions; otherwise it is an ordinary data object (ICONS,
      // EXERCISE_MUSCLES) and must not become a node.
      const own = byFile.get(fk) || [];
      const shorthandTargets = [];
      if (isShorthand) {
        const body = masked.slice(braceAt + 1, close);
        const ids = new Set();
        for (const mm of body.matchAll(/(?:^|[,{])\s*(?:[A-Za-z_$][\w$]*\s*:\s*)?([A-Za-z_$][\w$]*)\s*(?=[,}]|$)/g)) ids.add(mm[1]);
        for (const nm of ids) {
          const tgt = own.find((e) => e.label.replace(/\(\)$/, '') === nm);
          if (tgt) shorthandTargets.push(tgt);
        }
        if (shorthandTargets.length < 2) continue;
      }

      // The owner node, CREATED IF MISSING. Six of the seven runtime globals
      // (Cloud, Notify, Health, FoodAI, Tables, VaultUpdate) had no node at all,
      // because graphify's JS pass names a node for `const X = {` but not for
      // `window.X = {` — and these files all export the second way, from inside
      // an IIFE. Since CLAUDE.md documents those globals AS the wiring between
      // files, the graph was missing the app's entire inter-file vocabulary.
      const rootNode = own.find((e) => e.label.replace(/\(\)$/, '') === rootName);
      const rootId = rootNode ? rootNode.id : slug(fk) + '_' + slug(rootName);
      if (!nodeById.has(rootId)) {
        const nn = {
          label: rootName, file_type: 'code', source_file: fk,
          source_location: 'L' + masked.slice(0, braceAt).split('\n').length,
          _origin: 'methods', id: rootId, norm_label: rootName.toLowerCase(),
          metadata: { kind: 'api_surface' },
        };
        newNodes.push(nn); nodeById.set(rootId, nn);
      }

      // SHORTHAND EXPORT SURFACE — `window.Cloud = { push, pull, sync }`. These
      // name top-level functions that are ALREADY nodes, so re-creating them
      // would duplicate. What is missing is that they form Cloud's public API,
      // so link the owner to each one instead.
      if (isShorthand) {
        for (const tgt of shorthandTargets) {
          if (tgt.id === rootId) continue;
          const key = rootId + ' ' + tgt.id + ' contains';
          if (existingLink.has(key)) continue;
          existingLink.add(key);
          newLinks.push({
            relation: 'contains', context: 'definition', confidence: 'EXTRACTED',
            confidence_score: 1.0, source_file: fk,
            source_location: 'L' + masked.slice(0, braceAt).split('\n').length,
            weight: 1.0, _origin: 'methods', source: rootId, target: tgt.id,
          });
          exportEdges++;
        }
        continue;
      }

      for (const mem of members) {
        const dotted = rootName + '.' + mem.path.join('.');
        const id = rootId + '_' + mem.path.map(slug).join('_');
        if (nodeById.has(id)) { if (mem.isMethod) methodId.set(dotted, id); continue; }
        const label = dotted + (mem.isMethod ? '()' : '');
        const nn = {
          label, file_type: 'code', source_file: fk,
          source_location: 'L' + mem.line, _origin: 'methods', id,
          norm_label: label.toLowerCase(),
          metadata: { kind: mem.isMethod ? 'method' : 'namespace', owner: rootName },
        };
        newNodes.push(nn); nodeById.set(id, nn);
        if (mem.isMethod) methodId.set(dotted, id);

        // contains: parent (root or intermediate namespace) -> this
        const parentId = mem.path.length > 1
          ? rootId + '_' + mem.path.slice(0, -1).map(slug).join('_')
          : rootId;
        const key = parentId + ' ' + id + ' contains';
        if (!existingLink.has(key)) {
          existingLink.add(key);
          newLinks.push({
            relation: 'contains', context: 'definition', confidence: 'EXTRACTED',
            confidence_score: 1.0, source_file: fk, source_location: 'L' + mem.line,
            weight: 1.0, _origin: 'methods', source: parentId, target: id,
          });
        }
      }
    }
  }

  // ---- 2. call sites --------------------------------------------------------
  // Longest paths first so `DB.plan.setRest` wins over a hypothetical `DB.plan`.
  const paths = [...methodId.keys()].sort((a, b) => b.length - a.length);
  let callEdges = 0;
  for (const rel of JS_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const fk = fileKey(rel);
    if (!fk) continue;
    const defs = byFile.get(fk) || [];
    const ownDefs = newNodes.filter((n) => n.source_file === fk && /^L(\d+)/.test(n.source_location))
      .map((n) => ({ id: n.id, label: n.label, line: Number(/^L(\d+)/.exec(n.source_location)[1]) }));
    const all = defs.concat(ownDefs).sort((a, b) => a.line - b.line);
    const lines = mask(fs.readFileSync(abs, 'utf8')).split(/\r?\n/);
    const enclosing = (lineNo) => {
      let best = null;
      for (const d of all) { if (d.line && d.line <= lineNo) best = d; else break; }
      return best;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      for (const p of paths) {
        const idx = line.indexOf(p);
        if (idx === -1) continue;
        // must be a call, and not a substring of a longer identifier
        const before = idx === 0 ? '' : line[idx - 1];
        if (/[\w$.]/.test(before)) continue;
        if (!new RegExp('\\' + '.' + p.split('.').slice(1).join('\\.') + '\\s*\\(').test(line)
            && !new RegExp(p.replace(/\./g, '\\.') + '\\s*\\(').test(line)) continue;
        const from = enclosing(i + 1);
        const target = methodId.get(p);
        if (!from || !target || from.id === target) continue;
        const key = from.id + ' ' + target + ' calls';
        if (existingLink.has(key)) continue;
        existingLink.add(key);
        newLinks.push({
          relation: 'calls', context: 'call', confidence: 'EXTRACTED',
          confidence_score: 1.0, source_file: fk, source_location: 'L' + (i + 1),
          weight: 1.0, _origin: 'methods', source: from.id, target,
        });
        callEdges++;
        break;                       // one (longest) match per line is enough
      }
    }
  }

  const methods = newNodes.filter((n) => (n.metadata || {}).kind === 'method').length;
  const spaces = newNodes.filter((n) => (n.metadata || {}).kind === 'namespace').length;
  console.log('methods added : %d   namespaces: %d   (total new nodes %d)', methods, spaces, newNodes.length);
  console.log('edges added   : %d contains + %d calls + %d export-surface',
    newLinks.length - callEdges - exportEdges, callEdges, exportEdges);
  const sample = newNodes.filter((n) => (n.metadata || {}).kind === 'method').slice(0, 6);
  console.log('  samples: ' + sample.map((n) => n.label).join(', '));

  if (DRY) { console.log('\n--dry-run: nothing written'); return; }
  if (!newNodes.length && !newLinks.length) { console.log('nothing to add (already current)'); return; }

  // New nodes inherit the community of their root so the graph stays valid even
  // if the refine pass below is skipped; graph_refine.py re-partitions properly.
  for (const n of newNodes) {
    if (n.community !== undefined) continue;
    const rootId = String(n.id).split('_').slice(0, 3).join('_');
    const host = nodeById.get(rootId) || graph.nodes.find((x) => x.source_file === n.source_file);
    if (host) { n.community = host.community; n.community_name = host.community_name; }
  }
  graph.nodes.push(...newNodes);
  graph.links.push(...newLinks);
  fs.writeFileSync(GRAPH, JSON.stringify(graph));
  console.log('\ngraph.json: %d nodes, %d links', graph.nodes.length, graph.links.length);
}

main();
