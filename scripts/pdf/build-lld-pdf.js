// LLD.md -> print-quality PDF, in two passes.
//
// Pass 1 renders to learn which page each heading LANDED on; pass 2 rebuilds the
// contents page with those numbers filled in. A TOC cannot be produced in one
// pass because its own height shifts everything after it.
//
// puppeteer-core drives the ALREADY-INSTALLED Chrome, so nothing is downloaded.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const SRC = process.argv[2] || 'C:/Users/moath/vault/docs/LLD.md';
const OUT = process.argv[3] || 'C:/Users/moath/vault/docs/LLD.pdf';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HERE = __dirname;

const md = fs.readFileSync(SRC, 'utf8');

// Pull mermaid blocks out BEFORE marked runs: marked escapes the arrow syntax
// inside a fenced block into entities and mermaid then fails on its own diagram.
const diagrams = [];
const staged = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, b) => {
  diagrams.push(b);
  return `\n@@MERMAID_${diagrams.length - 1}@@\n`;
});

marked.setOptions({ gfm: true, breaks: false });

// Collect the section headings for the contents page, and give each one an id.
const sections = [];
const renderer = new marked.Renderer();
const origHeading = renderer.heading.bind(renderer);
renderer.heading = function (tok) {
  const text = this.parser.parseInline(tok.tokens);
  const plain = text.replace(/<[^>]+>/g, '').trim();
  // The DISPLAY string keeps its entities (it goes back into HTML), but the
  // needle used to find this heading in the extracted PDF text must be DECODED
  // — the PDF holds "&" and "'", not "&amp;" and "&#39;". Five headings failed
  // to locate on the first attempt for exactly this reason.
  const needle = plain
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
  if (tok.depth === 2 || tok.depth === 3) {
    const id = 'sec-' + sections.length;
    sections.push({ id, depth: tok.depth, text: plain, needle });
    return `<h${tok.depth} id="${id}">${text}</h${tok.depth}>\n`;
  }
  return origHeading(tok);
};

let body = marked.parse(staged, { renderer });
body = body.replace(/<p>@@MERMAID_(\d+)@@<\/p>/g, (_, i) =>
  `<div class="diagram"><pre class="mermaid">${diagrams[i]
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>`);

const mermaidJs = fs.readFileSync(
  path.join(HERE, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8');

const CSS = fs.readFileSync(path.join(HERE, 'print.css'), 'utf8');

function buildHtml(pageOf) {
  const toc = sections.map(s => {
    const n = pageOf ? (pageOf[s.id] || '') : '';
    return `<li class="d${s.depth}"><span class="t">${s.text}</span>` +
           `<span class="leader"></span><span class="pg">${n}</span></li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>THE VAULT — Low-Level Design</title><style>${CSS}</style></head><body>

<section class="cover">
  <div class="eyebrow">Low-Level Design</div>
  <h1>THE VAULT</h1>
  <div class="sub">A local-first, bilingual fitness &amp; nutrition PWA</div>
  <div class="rule"></div>
  <dl>
    <dt>Web build</dt><dd>v217</dd>
    <dt>Android</dt><dd>build 13 · v2.2</dd>
    <dt>Layers</dt><dd>9, from Postgres to the identity layer</dd>
    <dt>Method</dt><dd>Read out of the source, not recalled</dd>
    <dt>Repository</dt><dd>github.com/moathdarweesh/vault</dd>
  </dl>
</section>

<section class="toc">
  <h1>Contents</h1>
  <ol class="toclist">${toc}</ol>
</section>

${body}
</body></html>`;
}

async function render(html, outPath) {
  const htmlPath = path.join(HERE, 'lld.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.addScriptTag({ content: mermaidJs });

  // Render diagrams one at a time. A mermaid parse error is an object puppeteer
  // cannot serialise, so letting it escape evaluate() yields a bare "Object"
  // and no clue which diagram is at fault.
  const results = await page.evaluate(async () => {
    // mermaid 11 ships an esbuild IIFE publishing an ESM NAMESPACE, so
    // window.mermaid is {default:<api>} — calling .initialize() on it is undefined.
    const mermaid = window.mermaid.default || window.mermaid;
    mermaid.initialize({
      startOnLoad: false, theme: 'base',
      fontFamily: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
      themeVariables: {
        primaryColor: '#fff4ec', primaryTextColor: '#14110e', primaryBorderColor: '#c2410c',
        lineColor: '#8a7f73', secondaryColor: '#f7f3ef', tertiaryColor: '#fdfbf9',
        fontSize: '13px',
      },
    });
    const nodes = [...document.querySelectorAll('pre.mermaid')];
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      const src = nodes[i].textContent;
      try {
        const { svg } = await mermaid.render('dg' + i, src);
        const h = document.createElement('div');
        h.innerHTML = svg;
        nodes[i].replaceWith(h.firstElementChild);
        out.push(`${i}: ok`);
      } catch (e) {
        out.push(`${i}: FAILED — ${String(e && (e.message || e.str || e))}` +
                 ` | ${src.split('\n')[0]}`);
      }
    }
    return out;
  });
  if (results.some(r => r.includes('FAILED'))) {
    results.forEach(r => console.error('  diagram ' + r));
    throw new Error('a diagram did not render');
  }

  const stats = await page.evaluate(() => ({
    diagrams: document.querySelectorAll('.diagram svg').length,
    tables: document.querySelectorAll('table').length,
    code: document.querySelectorAll('pre:not(.mermaid)').length,
  }));

  await page.pdf({
    path: outPath, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
    headerTemplate: `<div style="width:100%;font-size:7pt;color:#8a7f73;
      font-family:'Segoe UI',Arial,sans-serif;padding:0 16mm 2mm;display:flex;
      justify-content:space-between;border-bottom:.5px solid #e3dbd1;">
      <span>THE VAULT — Low-Level Design</span><span>v217 · build 13</span></div>`,
    footerTemplate: `<div style="width:100%;font-size:7pt;color:#8a7f73;
      font-family:'Segoe UI',Arial,sans-serif;padding:0 16mm;display:flex;
      justify-content:space-between;">
      <span>Read out of the source, not recalled.</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });

  await browser.close();
  return stats;
}

(async () => {
  const tmp = path.join(HERE, 'pass1.pdf');
  console.log('pass 1 — laying out to discover page numbers…');
  const stats = await render(buildHtml(null), tmp);

  // Locate each heading by searching the rendered text page by page.
  const { PDFExtract } = (() => { try { return require('pdf-parse'); } catch { return {}; } })();
  const pageOf = {};
  {
    const { execFileSync } = require('child_process');
    const py = fs.readFileSync('C:/Users/moath/vault/graphify-out/.graphify_python', 'utf8').trim();
    const script = `
import json,sys
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
pages=[(p.extract_text() or '') for p in r.pages]
secs=json.load(open(sys.argv[2],encoding='utf-8'))
out={}
for s in secs:
    needle=' '.join(s.get('needle',s['text']).split())[:48]
    for i,t in enumerate(pages):
        if needle and needle in ' '.join(t.split()):
            out[s['id']]=i+1; break
print(json.dumps(out))`;
    const sp = path.join(HERE, 'locate.py');
    const jp = path.join(HERE, 'sections.json');
    fs.writeFileSync(sp, script, 'utf8');
    fs.writeFileSync(jp, JSON.stringify(sections), 'utf8');
    const res = execFileSync(py, [sp, tmp, jp], { encoding: 'utf8' });
    Object.assign(pageOf, JSON.parse(res));
  }
  const located = Object.keys(pageOf).length;
  console.log(`pass 1 done — located ${located}/${sections.length} headings`);

  console.log('pass 2 — rebuilding with the contents page filled in…');
  const final = await render(buildHtml(pageOf), OUT);
  fs.unlinkSync(tmp);
  console.log(JSON.stringify({ ...final, headings: sections.length, located }));
  fs.writeFileSync(path.join(HERE, 'pageof.json'), JSON.stringify(pageOf), 'utf8');
})().catch(e => { console.error('BUILD FAILED:', e && (e.stack || e)); process.exit(1); });
