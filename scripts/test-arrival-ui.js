// THE ARRIVAL, MEASURED (v432) — what the browser actually runs when a screen
// comes in, read from the computed styles of the arriving cards, in real Chrome.
//
//   node scripts/test-arrival-ui.js            # ar/dark + en/light, 375px
//   QA_ONLY=<words> node scripts/test-arrival-ui.js
//
// WHY THIS EXISTS. Contract 79 holds the ARITHMETIC of the arrival budget in
// the tokens; this suite holds the BEHAVIOUR those tokens are supposed to
// produce — because the tokens were right on paper for 180 releases while
// Back and a repeat tap took the ceremonial step and every card ran 400ms, and
// nothing measured it. Each case reads the delay and duration the cards were
// given at the instant they arrived (before any frame), which is the one
// moment the stagger's choice is on the DOM.
//
// Also here, because they were found in the same review and are cheap to hold:
// a sheet that hands over to another swaps in place; Home's figures count up
// once per arrival and never on a re-render; the status-bar inset is paid by
// the shell, not the scroller; color-scheme follows the theme on <body>.
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';

async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme, timezoneId: 'Asia/Riyadh', locale: lang === 'ar' ? 'ar-SA' : 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && window.__vltReady, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 9000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked(); DB.prefs.setUnit('kg');
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    const ex = DB.exercises.list()[0];
    DB.sessions.add({ exerciseId: ex.id, date: addDaysISO(todayISO(), -2), sets: [{ reps: 8, weight: 40 }] });
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // Nothing animating under the active view: the moment the stagger has rested.
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter') && !document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.view.active')), null, { timeout: 4000 });
  return { ctx, page, ev, settled, errors, guard, lang, theme };
}

// The arriving host and the delay/duration its LAST real child was given — read
// in the same evaluate as the trigger, so no frame has passed and nothing is spent.
const arriveSrc = `
  const v = document.querySelector('.view.active');
  let host = v;
  while (host.children.length === 1 && host.firstElementChild.children.length > 1) host = host.firstElementChild;
  const kids = [...host.children].filter((k) => !k.classList.contains('vault-bar') && !k.classList.contains('detail-top') && !k.classList.contains('run-nav'));
  const last = kids[kids.length - 1];
  const cs = getComputedStyle(last);
  return { view: v.dataset.view, enter: host.classList.contains('enter'), kids: kids.length, i: Number(last.style.getPropertyValue('--i')), delay: cs.animationDelay, duration: cs.animationDuration, name: cs.animationName };
`;
const tokens = (kit) => kit.ev(() => { const r = getComputedStyle(document.body); const ms = (n) => parseFloat(r.getPropertyValue(n)); return { stagger: ms('--stagger'), fast: ms('--stagger-fast'), durFast: ms('--dur-fast') }; });
const sec = (ms) => (ms / 1000) + 's';

const CASES = [
  ['a deliberate opening: the last card is delayed min(i,5) × --stagger and runs --dur-fast; nothing runs past 600 ms', async (kit) => {
    const tk = await tokens(kit);
    assert.ok(tk.stagger <= 80 && tk.fast <= 60 && tk.durFast <= 300, `tokens inside the budget: ${JSON.stringify(tk)}`);
    const a = await kit.ev(`(() => { navigate('settings'); ${arriveSrc} })()`);
    assert.equal(a.enter, true, 'the view arrives under the stagger host');
    assert.ok(a.kids >= 6, `settings has six or more cards (${a.kids})`);
    assert.equal(a.delay, sec(Math.min(a.i, 5) * tk.stagger), 'the last card waits min(i,5) × --stagger');
    assert.equal(a.duration, sec(tk.durFast), 'and runs --dur-fast, not --dur-base');
    assert.ok(Math.min(a.i, 5) * tk.stagger + tk.durFast <= 600, 'the whole arrival rests inside 600 ms');
    await kit.settled();
  }],
  ['Back takes the fast step: returning to Home rests at min(i,5) × --stagger-fast + --dur-fast', async (kit) => {
    const tk = await tokens(kit);
    await kit.ev(() => navigate('home'));
    await kit.settled();
    await kit.ev(() => navigate('settings'));
    await kit.settled();
    const a = await kit.ev(`(() => { goBack(); ${arriveSrc} })()`);
    assert.equal(a.enter, true, 'Back arrives under the stagger host');
    assert.equal(a.view, 'home', 'setup: Back landed on Home');
    assert.equal(a.delay, sec(Math.min(a.i, 5) * tk.fast), `Back waits the fast step (${tk.fast} ms), not the ceremonial one`);
    assert.equal(a.duration, sec(tk.durFast), 'and the card runs --dur-fast');
    await kit.settled();
  }],
  ['the lit tab tapped again takes the fast step', async (kit) => {
    const tk = await tokens(kit);
    await kit.ev(() => navigate('home'));
    await kit.settled();
    const a = await kit.ev(`(() => { document.querySelector('#bottom-nav [data-view="home"]').click(); ${arriveSrc} })()`);
    assert.equal(a.enter, true, 'a repeat tap still arrives (the owner: every arrival is the stagger)');
    assert.equal(a.delay, sec(Math.min(a.i, 5) * tk.fast), 'but on the fast step');
    await kit.settled();
  }],
  ['a tab switch: the fast step, and the tab glyph answers in --dur-fast and lets go', async (kit) => {
    const tk = await tokens(kit);
    await kit.ev(() => navigate('home'));
    await kit.settled();
    const a = await kit.ev(`(() => { document.querySelector('#bottom-nav [data-view="workouts"]').click(); ${arriveSrc} })()`);
    assert.equal(a.delay, sec(Math.min(a.i, 5) * tk.fast), 'the tab switch waits the fast step');
    const glyph = await kit.ev(() => { const b = document.querySelector('#bottom-nav [data-view="workouts"]'); const svg = b.querySelector('svg'); return { pulse: b.classList.contains('vlt-pulse'), dur: getComputedStyle(svg).transitionDuration, prop: getComputedStyle(svg).transitionProperty }; });
    assert.equal(glyph.pulse, true, 'the tab answers the touch');
    assert.equal(glyph.dur, sec(tk.durFast), 'its press runs --dur-fast (it was a literal 500 ms)');
    await kit.page.waitForTimeout(tk.durFast + 150);
    assert.equal(await kit.ev(() => document.querySelector('#bottom-nav [data-view="workouts"]').classList.contains('vlt-pulse')), false, 'and lets go after one duration');
    await kit.settled();
  }],
  ['a sheet handed over to another swaps in place; a fresh sheet still rises', async (kit) => {
    await kit.ev(() => { navigate('home'); });
    await kit.settled();
    await kit.ev(() => openWeightSheet());
    await kit.page.waitForTimeout(500);
    const swap = await kit.ev(() => { openRecentChanges(); const o = document.querySelector('#modal-root .modal-overlay:not(.is-out)'); const m = o.querySelector('.modal'); return { cls: o.classList.contains('vlt-swap'), overlay: getComputedStyle(o).animationName, modal: getComputedStyle(m).animationName }; });
    assert.deepEqual(swap, { cls: true, overlay: 'none', modal: 'none' }, 'the second sheet replaces the first without replaying the scrim or the rise');
    await kit.ev(() => closeModal());
    await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 2000 });
    const fresh = await kit.ev(() => { openRecentChanges(); const o = document.querySelector('#modal-root .modal-overlay:not(.is-out)'); const m = o.querySelector('.modal'); return { cls: o.classList.contains('vlt-swap'), overlay: getComputedStyle(o).animationName, modal: getComputedStyle(m).animationName }; });
    assert.deepEqual(fresh, { cls: false, overlay: 'overlayIn', modal: 'sheetUp' }, 'a sheet opened over nothing still fades the scrim and rises');
    // The handover the app actually makes (the import's review → the editor):
    // closeModal() FIRST, then the next open in the same tick — the leaving
    // overlay is still in the root, so it counts as a handover too.
    const handover = await kit.ev(() => { closeModal(); openWeightSheet(); const o = document.querySelector('#modal-root .modal-overlay:not(.is-out)'); const m = o.querySelector('.modal'); return { cls: o.classList.contains('vlt-swap'), overlay: getComputedStyle(o).animationName, modal: getComputedStyle(m).animationName, leaving: document.querySelectorAll('#modal-root .modal-overlay').length }; });
    assert.deepEqual([handover.cls, handover.overlay, handover.modal], [true, 'none', 'none'], 'closeModal() then an open in the same tick swaps in place');
    await kit.ev(() => closeModal());
    await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 2000 });
  }],
  ['behind the splash door Home writes its figures and hands the count to the drop', async (kit) => {
    await kit.ev(() => navigate('workouts'));
    await kit.settled();
    const shut = await kit.ev(() => {
      window.__vltSplash = 1;                       // the door is shut: no arrival is seen
      navigate('home');
      const n = document.querySelector('.view.active .anim[data-count]');
      return { text: n.textContent, want: fmtNum(Number(n.dataset.count)), handed: typeof window.__vltSplashCount === 'function' };
    });
    assert.equal(shut.text, shut.want, 'behind the door the figure is written, not counted');
    assert.equal(shut.handed, true, 'and the count is handed to the door');
    const opened = await kit.ev(async () => {
      window.__vltSplash = 0;
      const host = document.querySelector('.view.active');
      delete host.dataset.entered;
      VltMotion.stagger(host, 0, true);             // the drop, as index.html's clock fires it
      await new Promise((r) => setTimeout(r, 60));
      const n = document.querySelector('.view.active .anim[data-count]');
      return { early: n.textContent, want: fmtNum(Number(n.dataset.count)), spent: window.__vltSplashCount === null };
    });
    assert.notEqual(opened.early, opened.want, 'the drop starts the count (the figure is climbing 60 ms in)');
    assert.equal(opened.spent, true, 'the hand-off is spent once');
    await kit.page.waitForTimeout(800);
    assert.equal(await kit.ev(() => document.querySelector('.view.active .anim[data-count]').textContent), opened.want, 'and it lands on the figure');
    await kit.settled();
  }],
  ['Home counts its figures up on an arrival and writes them at once on a re-render', async (kit) => {
    await kit.ev(() => navigate('workouts'));
    await kit.settled();
    const arrival = await kit.ev(() => { navigate('home'); const n = document.querySelector('.view.active .anim[data-count]'); return { text: n.textContent, target: Number(n.dataset.count) }; });
    assert.ok(arrival.target > 0, 'setup: a figure to count (a session two days ago)');
    assert.equal(arrival.text, '0', 'an arrival starts the count at 0');
    await kit.page.waitForTimeout(800);
    assert.equal(await kit.ev(() => document.querySelector('.view.active .anim[data-count]').textContent), await kit.ev((t) => fmtNum(t), arrival.target), 'and lands on the figure');
    const redraw = await kit.ev(() => { renderHome(document.querySelector('.view.active')); const n = document.querySelector('.view.active .anim[data-count]'); return { text: n.textContent, want: fmtNum(Number(n.dataset.count)) }; });
    assert.equal(redraw.text, redraw.want, 'a re-render writes the figure straight away — no count-up on a screen that did not change');
  }],
  ['the status-bar inset is paid by the shell: a sticky top bar never sits under the clock', async (kit) => {
    try {
      const m = await kit.ev(() => {
        // On body, not :root: the tokens are declared on `:root, body.theme-dark`, so a
        // :root override is shadowed by body's own declaration in the dark theme.
        document.body.style.setProperty('--safe-t', '40px');
        const main = document.querySelector('.main'), app = document.querySelector('.app');
        return { mainTop: Math.round(main.getBoundingClientRect().top), mainPad: getComputedStyle(main).paddingTop, appPad: getComputedStyle(app).paddingTop };
      });
      assert.deepEqual(m, { mainTop: 40, mainPad: '0px', appPad: '40px' }, 'the scrollport starts below the inset; the inset is the shell\'s padding, not the scroller\'s');
      await kit.ev(() => navigate('settings'));
      await kit.settled();
      const bar = await kit.ev(() => { const main = document.querySelector('.main'); main.scrollTop = 400; main.dispatchEvent(new Event('scroll')); const t = document.querySelector('.view.active .detail-top'); return { pos: getComputedStyle(t).position, top: Math.round(t.getBoundingClientRect().top), scrolled: main.scrollTop }; });
      assert.equal(bar.pos, 'sticky', 'setup: the child screen\'s top bar is sticky');
      assert.ok(bar.scrolled > 0, 'setup: the screen scrolled');
      assert.ok(bar.top >= 40, `the stuck bar sits below the inset (top ${bar.top}, inset 40)`);
    } finally {
      await kit.ev(() => { document.body.style.removeProperty('--safe-t'); document.querySelector('.main').scrollTop = 0; navigate('home'); });
    }
  }],
  ['color-scheme follows the theme on <body>, so an empty native box is drawn in the theme', async (kit) => {
    assert.equal(await kit.ev(() => getComputedStyle(document.body).colorScheme), kit.theme, `body computes color-scheme: ${kit.theme}`);
    const other = kit.theme === 'dark' ? 'light' : 'dark';
    const flipped = await kit.ev((th) => { applyTheme(th); return getComputedStyle(document.body).colorScheme; }, other);
    await kit.ev((th) => applyTheme(th), kit.theme);
    assert.equal(flipped, other, 'and follows a theme switch');
  }],
];

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;
        try { await fn(kit); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  arrival UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  arrival UI (${passed} cases, AR/dark + EN/light, 375px): a deliberate opening waits min(i,5) × --stagger and runs --dur-fast inside 600 ms; Back, the lit tab tapped again and a tab switch take the fast step; the tab glyph answers in --dur-fast and lets go; a sheet handed over to another — open over open, or closeModal() then open — swaps in place while a fresh one rises; Home counts up once per arrival, writes at once on a re-render, and behind the splash door hands the count to the drop; the status-bar inset is the shell's padding so a stuck top bar sits below it; color-scheme follows the theme on <body>`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
