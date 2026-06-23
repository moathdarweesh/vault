// Assembles the web app into ./www so Capacitor can bundle it into the APK.
// The root copy stays untouched so GitHub Pages keeps serving the PWA.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www');

// Only the files the running app actually needs — never node_modules/android/.git.
const ITEMS = ['index.html', 'styles.css', 'manifest.json', 'service-worker.js', 'js', 'icons'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const item of ITEMS) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) {
    console.warn('  [skip] missing:', item);
    continue;
  }
  fs.cpSync(src, path.join(OUT, item), { recursive: true });
  console.log('  [copy]', item);
}

console.log('Built www/ for Capacitor.');
