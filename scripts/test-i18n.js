#!/usr/bin/env node
// THE ARABIC REGISTER AND THE COUNT FORMS — what contracts 5 and 38 cannot see.
//
// Contract 5 proves every t() key exists in both dictionaries; contract 38
// proves every key has a caller. Neither reads a VALUE, and the 2026-09-25
// review (batch 4) found what that leaves open: dialect in the destructive
// dialogs («بتصير فاضية», «صار خطأ»), a number pasted in front of one fixed
// plural («1 أسابيع», «كل 1 ساعات», «1 weeks ago»), a reminder that printed kg
// to an lb user, and one concept named three ways on neighbouring screens.
//
// Each check REFUSES THE WRONG FORM rather than pinning today's wording, so a
// later rewording stays free — except the count ladders, where the form IS the
// thing under test. It runs the real code: cloud.js + storage.js through
// test-sync-status's harness, then i18n.js, catalog.js and ui.js in the same
// context, and app.js's helpers by slice.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { context } = require('./test-sync-status');
const { JS } = require('./shipped.js');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const { c } = context();
for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js']) vm.runInContext(read(f), c);
const I18N = vm.runInContext('I18N', c);
const app = read('js/app.js'), food = read('js/food.js');

// One top-level function of a file, by name: its declaration up to the first
// closing brace at column 0 (every body is indented). '' when it is absent, so
// a missing helper is a reported problem, not a crash that hides the rest.
const fnSrc = (src, name) => {
  const a = src.search(new RegExp('\\n(?:async )?function ' + name + '\\('));
  return a < 0 ? '' : src.slice(a, src.indexOf('\n}', a) + 2);
};
const load = (name) => { const s = fnSrc(app, name); if (s) vm.runInContext(s, c); return !!s; };

const problems = [];
const bad = (id, msg) => problems.push({ id, msg });
const lang = (l) => c.DB.prefs.setLang(l);
const today = c.todayISO();
// Tashkeel and tatweel off, then WHOLE words: «شيء» is not «شي», «حجم» is not «جم».
const strip = (s) => String(s).replace(/[ً-ٰٟـ]/g, '');
const words = (s) => strip(s).split(/[^ء-غف-ي]+/).filter(Boolean);
const AR = Object.entries(I18N.ar).filter(([, v]) => typeof v === 'string');

// ── A. DIALECT (#1 #2 #3) ───────────────────────────────────────────────────
// A marker refused as a WHOLE word in every Arabic value, a leading و/ف tried
// both ways. The common Levantine, Gulf and Egyptian markers, plus every word
// this review caught by reading — a keyword list alone never finds a family
// (v226's «حاس»/«نشوفك» matched none), so the found words are listed by name.
// Measured before it was written: no formal string trips one.
const DIALECT = {
  Levantine: 'بدك بدي بدنا شو هيك كتير زي هلأ هلق ليش عشان علشان وين هاد هادا هادي هاي هدول هيدا هيدي منيح إيش ايش كمان لسا لسه بس رح هون هنيك مشان انو إنو شوي شوية مبارح بكرة بكرا حاس نشوفك خلي',
  Gulf: 'اللي إللي هذي هذيك وش تبي يبي تبغى يبغى ابغى أبغى الحين مب وايد شلون اشلون دحين شنو مو',
  Egyptian: 'كده عايز عاوز دلوقتي ده إزاي ازاي ليه برضو برضه مش',
  'a colloquial answer': 'تمام أوكي اوكي',
  // formal: حدث/أصبح · سيصبح · سيُحذف · فارغة · شيء · البريد الإلكتروني · الغداء · العشاء · أرز · وجبة خفيفة · بالعربية · طاب يومك
  'colloquial, found by the review': 'صار بتصير بيصير بينحذف بتنحذف فاضية فاضي شي الإيميل إيميل ايميل بالإيميل الغدا العشا رز الرز سناك سناكات بالعربي نهارك',
};
const MARKER = new Map(Object.entries(DIALECT).flatMap(([why, list]) => list.split(' ').map((w) => [w, why])));
const PHRASES = [
  [/سجل دخول(?![ء-ي])/, '«سجّل دخول» without its article — «سجّل الدخول» (or «سجّل دخولك»)'],
  [/(?:^|[^ء-ي])ما [ء-ي]+ بعد(?![ء-ي])/, '«ما … بعد» is colloquial — «لم … بعد»'],
  // «ما زال» and «ما دام» are formal and exempt
  [/(?:^|[.،؛:!؟—-]\s*)ما (?!زال|دام)[ء-ي]+(?:ت|ته|تم)(?![ء-ي])/, 'a clause opening on «ما» + a past verb is colloquial negation — «لم» + the jussive'],
];
const EXCEPTIONS = {
  // key: why this Arabic value may carry a marker (empty is the healthy state)
};
const dialect = (text) => {
  const hits = [];
  for (const w of words(text)) for (const f of (/^[وف]/.test(w) && w.length > 2 ? [w, w.slice(1)] : [w])) if (MARKER.has(f)) hits.push(`«${f}» (${MARKER.get(f)})`);
  for (const [re, why] of PHRASES) if (re.test(strip(text))) hits.push(why);
  return hits;
};
const FINDING = { clear_plan_text: '#1', delete_supplement_text: '#1', reset_data_sub: '#1', reset_text: '#1', ai_error: '#2' };
for (const [k, v] of AR) if (!(k in EXCEPTIONS)) for (const hit of dialect(v)) bad(FINDING[k] || '#3', `${k}: ${hit} in «${v}»`);

// ── B. ONE TERM PER CONCEPT (#13) ───────────────────────────────────────────
// Anchored on the EN column, which is already consistent: a key whose English
// names the concept must use the ONE Arabic term for it. «التنبيهات» stood for
// Reminders on the reminders sheet and for Notifications three lines down.
const TERMS = [
  [/remind/i, /تذكير|ذكر/, 'a reminder is «تذكير» («تنبيه» is an alert, «إشعار» a notification)'],
  [/notification/i, /إشعار/, 'a notification is «إشعار»'],
  [/\bchat\b/i, /محادث/, 'the chat is «محادثة», not «شات»'],
  [/Health Connect/, /Health Connect/, 'Health Connect keeps its product name, as the other eight keys do'],
  [/\bsession/i, /جلس/, 'a workout session is «جلسة» — «حصّة» is a food serving (rec_serv_*)'],
  [/saved food/i, /طعام|أطعم/, 'a saved food is «طعام» (plural «أطعمة»), not «أكل»'],
];
const TERM_EXCEPTIONS = {
  run_last_weight: 'a column over the weight itself: «أعلى وزن / آخر وزن» name the figure, where EN names its source',
};
for (const [k, en] of Object.entries(I18N.en)) {
  if (typeof en !== 'string' || k in TERM_EXCEPTIONS) continue;
  for (const [enRe, arRe, why] of TERMS) if (enRe.test(en) && !arRe.test(strip(I18N.ar[k] || ''))) bad('#13', `${k}: ${why} — EN «${en}», AR «${I18N.ar[k]}»`);
}
const UNIT_WORDS = { 'جم': 'a gram is «غ», as unit_g, rec_g and notif_food_body write it', 'كغم': 'the weight unit is unitLabel()\'s, as on every screen' };
for (const [k, v] of AR) for (const w of words(v)) if (Object.hasOwn(UNIT_WORDS, w)) bad('#13', `${k}: «${w}» — ${UNIT_WORDS[w]}; «${v}»`);

// ── C. GRAMMAR, KEY BY KEY (#11 #15) ────────────────────────────────────────
// Each pattern is the WRONG form, so any correct rewording passes.
const GRAMMAR = {
  add_exercise: [/^أضف تمرين$/, 'an indefinite object takes the accusative: «أضف تمريناً»'],
  add_food_log: [/^أضف أكل$/, 'the accusative, and the food word: «أضف طعاماً»'],
  apply_template: [/^طبق قالب$/, 'the accusative: «طبّق قالباً»'],
  rest_day_muscles: [/لا يوجد عضلات/, 'a feminine plural takes «لا توجد»'],
  conflict_title: [/^يوجد /, '«بيانات» is a feminine plural: «توجد»'],
  translate_ex_off: [/^إنجليزي$/, 'its siblings «معرّبة» / «عربية كاملة» are feminine: «إنجليزية»'],
  nutri_left: [/^متبقي$/, 'an indefinite manqūṣ drops its ي: «متبقٍّ»'],
  prev_day: [/^يوم سابق$/, 'the day before THIS one is definite: «اليوم السابق»'],
  next_day: [/^يوم تالي$/, 'definite, and the manqūṣ: «اليوم التالي»'],
  tmpl_name_full_body: [/^الجسم كامل$/, '«الجسم كامل» is a sentence («the body is whole»): «كامل الجسم»'],
  reset_confirm: [/^تعيين$/, '«تعيين» alone means «assign» — on the wipe-everything button: «إعادة التعيين»'],
};
for (const [k, [re, why]] of Object.entries(GRAMMAR)) {
  if (!(k in I18N.ar)) bad('#15', `${k} is gone from the Arabic dictionary`);
  else if (re.test(strip(I18N.ar[k]))) bad(k === 'reset_confirm' ? '#11' : '#15', `${k}: «${I18N.ar[k]}» — ${why}`);
}

// ── D. ONE DIGIT SCRIPT PER PHRASE (#16) ────────────────────────────────────
// Digits inside Arabic prose are Arabic-Indic (last_7_days «آخر ٧ أيام»); a
// sentence whose {n} arrives from fmtNum is Latin throughout.
for (const k of ['muscle_focus_sub', 'avg_7d', 'pg_volume_30d', 'pg_sessions_30d']) if (/[0-9]/.test(I18N.ar[k] || '')) bad('#16', `${k}: «${I18N.ar[k]}» — a Latin digit in Arabic prose, beside last_7_days «${I18N.ar.last_7_days}»`);
if (/[٠-٩]/.test(I18N.ar.sug_deload_reason || '')) bad('#16', `sug_deload_reason: «${I18N.ar.sug_deload_reason}» — its {n} is fmtNum's Latin figure, so one sentence shows both scripts`);

// ── E. THE COUNT LADDERS (#4 #6 #7) ─────────────────────────────────────────
// Arabic says one, two, 3–10 and 11+ differently («يوم» «يومان» «أيام» «يوماً»),
// and a number pasted in front of ONE fixed plural is wrong in three of the
// four. Each ladder runs through the real code at values its caller passes.
const AGO = {
  ar: { 2: 'منذ يومين', 3: 'منذ 3 أيام', 6: 'منذ 6 أيام', 7: 'منذ أسبوع', 13: 'منذ أسبوع', 14: 'منذ أسبوعين', 21: 'منذ 3 أسابيع', 28: 'منذ 4 أسابيع',
    30: 'منذ شهر', 59: 'منذ شهر', 60: 'منذ شهرين', 90: 'منذ 3 أشهر', 300: 'منذ 10 أشهر', 330: 'منذ 11 شهراً', 400: 'منذ 13 شهراً' },
  en: { 2: '2 days ago', 3: '3 days ago', 6: '6 days ago', 7: '1 week ago', 13: '1 week ago', 14: '2 weeks ago', 21: '3 weeks ago', 28: '4 weeks ago',
    30: '1 month ago', 59: '1 month ago', 60: '2 months ago', 90: '3 months ago', 300: '10 months ago', 330: '11 months ago', 400: '13 months ago' },
};
for (const l of ['ar', 'en']) {
  lang(l);
  for (const [d, want] of Object.entries(AGO[l])) {
    const got = c.daysAgoLocalized(c.addDaysISO(today, -Number(d)));
    if (got !== want) bad('#4', `daysAgoLocalized, ${d} days back (${l}): «${got}» — want «${want}»`);
  }
}
const ladder = (id, fn, now, want) => {
  if (!load(fn)) { bad(id, `app.js has no ${fn}(n) — ${now}`); return; }
  for (const l of ['ar', 'en']) {
    lang(l);
    for (const [n, w] of Object.entries(want[l])) { const got = c[fn](Number(n)); if (got !== w) bad(id, `${fn}(${n}) (${l}): «${got}» — want «${w}»`); }
  }
};
ladder('#7', 'streakUnitLabel', 'the Home chip and the progress card pick streak_one_day for 1 and streak_days for any other count («2 يوم», «12 يوم»)',
  { ar: { 1: 'يوم واحد', 2: 'يومان', 5: 'أيام', 12: 'يوماً' }, en: { 1: 'day', 2: 'days', 5: 'days', 12: 'days' } });
// ONE AND TWO ARE WORDS IN ARABIC (batch 6). v399's chip read «2 يومان» — a
// numeral before a dual that already says «two». Formal Arabic names one and
// two with the noun alone («يوم واحد», «يومان») and writes a figure from three.
// The chip and the progress card print streakFigure(n) before the unit.
ladder('B6', 'streakFigure', 'the chip and the progress card print the figure at every count («2 يومان», «1 يوم»)',
  { ar: { 1: '', 2: '', 3: '3', 12: '12' }, en: { 1: '1', 2: '2', 3: '3', 12: '12' } });
for (const [site, re] of [['the Home streak chip', /<span class="num">\$\{streak\}<\/span><span class="streak-chip-unit">/], ['the progress streak card', /<span class="pg-streak-value num" dir="ltr">\$\{fmtNum\(streak\)\}<\/span>/]]) {
  if (re.test(app)) bad('B6', `${site} still prints the streak's figure at every count — «2 يومان» / «1 يوم واحد» in Arabic; print streakFigure(streak)`);
}
ladder('#6', 'suppStreakLabel', "the supplement card edits t('days_ago') into a unit («1 أيام سلسلة», «1 days streak»)",
  { ar: { 1: 'سلسلة يوم واحد', 2: 'سلسلة يومين', 5: 'سلسلة 5 أيام', 12: 'سلسلة 12 يوماً' }, en: { 1: '1-day streak', 2: '2-day streak', 5: '5-day streak', 12: '12-day streak' } });
if (/\d/.test(I18N.en.streak_one_day)) bad('#7', `EN streak_one_day «${I18N.en.streak_one_day}» repeats the figure the chip already prints — «1 1 day» on every first day`);
if (app.includes("streak === 1 ? t('streak_one_day') : t('streak_days')")) bad('#7', 'app.js still picks the streak unit inline, one form for every count above one');
if (app.includes("t('days_ago').replace(")) bad('#6', "app.js builds the supplement streak by editing another key's English: t('days_ago').replace('ago', '')");

// The reminder copy (#5), through the real DB.notif.text, in both languages.
const outputs = [];
const note = (item, mode) => { const r = c.DB.notif.text(item, mode); outputs.push(r.title, r.body); return r; };
const cupsMax = Math.ceil(c.DB.water.GOAL_ML / c.DB.water.CUP_ML);
if (cupsMax > 10) bad('#5', `the water goal is ${cupsMax} cups — the cup forms stop at ten; add a _many form («{cups} كوباً»)`);
const CUPS = { 1000: { ar: 'نحو 6 أكواب.', en: 'about 6 cups.' }, 2000: { ar: 'نحو كوبين.', en: 'about 2 cups.' }, 2400: { ar: 'نحو كوب واحد.', en: 'about 1 cup.' } };
let drunk = 0;
for (const [ml, want] of Object.entries(CUPS)) {
  c.DB.water.add(today, Number(ml) - drunk); drunk = Number(ml);
  for (const l of ['ar', 'en']) {
    lang(l);
    const { body } = note({ channel: 'water', date: today });
    if (!body.includes(want[l])) bad('#5', `water reminder at ${ml} of ${c.DB.water.GOAL_ML} ml (${l}): «${body}» — want «${want[l]}»`);
  }
}
const planCups = { ar: cupsMax === 1 ? 'نحو كوب واحد' : cupsMax === 2 ? 'نحو كوبين' : `نحو ${cupsMax} أكواب`, en: `About ${cupsMax} cup${cupsMax === 1 ? '' : 's'}` };
const STREAK_TITLE = { ar: { 7: 'سلسلة 7 أيام', 12: 'سلسلة 12 يوماً' }, en: { 7: '7-day streak', 12: '12-day streak' } };
for (const l of ['ar', 'en']) {
  lang(l);
  const plan = note({ channel: 'water', date: c.addDaysISO(today, 1) }, 'plan').body;
  if (!plan.includes(planCups[l])) bad('#5', `water reminder armed ahead (${l}): «${plan}» — want «${planCups[l]}»`);
  for (const [n, w] of Object.entries(STREAK_TITLE[l])) {
    const { title } = note({ channel: 'streak', date: today, payload: { n: Number(n) } });
    if (!title.includes(w)) bad('#5', `streak reminder, ${n} days (${l}): «${title}» — want «${w}»`);
  }
  const { title } = note({ channel: 'summary', date: today });
  const one = l === 'ar' ? 'تذكير واحد اليوم' : '1 reminder today';
  if (title !== one) bad('#5', `the one-reminder summary (${l}): «${title}» — want «${one}»`);
}

// ── F. THE WORKOUT REMINDER SPEAKS THE USER'S UNIT (#12) ────────────────────
// Weights are stored in kg; every screen converts through fmtWeight/unitLabel.
const ex = c.DB.exercises.list()[0];
c.DB.sessions.add({ exerciseId: ex.id, date: today, sets: [{ reps: 5, weight: 100 }] });
const trainBody = () => note({ channel: 'train', date: today, payload: { name: 'Push', n: 2 } }).body;
c.DB.prefs.setUnit('lb');
for (const l of ['ar', 'en']) {
  lang(l);
  const body = trainBody();
  if (!body.includes('220.5 lb') || /\bkg\b|كغم/.test(body)) bad('#12', `workout reminder, an lb user whose last set was 100 kg (${l}): «${body}» — want «220.5 lb»`);
}
c.DB.prefs.setUnit('kg');
if (!trainBody().includes('100 kg')) bad('#12', `workout reminder, a kg user (en): «${trainBody()}» — want «100 kg»`);
for (const s of outputs) if (s.includes('{')) bad('#5', `a reminder left a placeholder unfilled: «${s}»`);

// ── G. A BLANK DAY NAME READS AS THE UI'S OWN WORD (#8) ─────────────────────
// The day editor and DB.plan save a blank label as the literal 'Workout'; the
// render sites' `|| t('workout_label')` never fires because it is never blank.
if (!load('exNamesMode') || !load('planDayName')) bad('#8', 'app.js lost exNamesMode() or planDayName()');
else {
  lang('ar');
  for (const mode of ['translit', 'ar', 'en']) {
    c.DB.prefs.setExNames(mode);
    const got = c.planDayName('Workout');
    if (got !== c.t('workout_label')) bad('#8', `planDayName('Workout'), Arabic UI, ${mode} names: «${got}» — want t('workout_label') «${c.t('workout_label')}»`);
  }
  c.DB.prefs.setExNames('translit');
  const push = vm.runInContext('PLAN_DAY_AR.Push', c);
  if (c.planDayName('Push') !== push) bad('#8', `planDayName('Push') in Arabic: «${c.planDayName('Push')}» — want «${push}»`);
  lang('en');
  if (c.planDayName('Workout') !== 'Workout') bad('#8', `planDayName('Workout') in English: «${c.planDayName('Workout')}»`);
}

// ── H. RAW ERROR TEXT NEVER REACHES THE SCREEN (#9 #10) ─────────────────────
if (app.includes('t(e.message, e.message)')) bad('#9', 'the delete-account toast is t(e.message, e.message): «offline», «not signed in» and raw Supabase text reach the screen untranslated');
if (!load('deleteAccountErrorText')) bad('#9', "app.js has no deleteAccountErrorText(e) to put Cloud.deleteAccount's throws into words");
else {
  const CASES = [['offline', 'auth_err_network'], ['not signed in', 'auth_not_signed'], ['delete_images_inspect_error', 'delete_images_inspect_error'],
    ['TypeError: Failed to fetch', 'delete_account_failed'], ['delete failed', 'delete_account_failed'], ['', 'delete_account_failed']];
  for (const l of ['ar', 'en']) {
    lang(l);
    for (const [msg, key] of CASES) {
      const got = c.deleteAccountErrorText(new Error(msg));
      if (!(key in I18N.en) || !(key in I18N.ar) || got !== c.t(key)) bad('#9', `delete account failing with «${msg}» (${l}): «${got}» — want t('${key}')`);
    }
  }
}
if (!/\.catch\([\s\S]*friendlyErr/.test(fnSrc(food, 'openCoach'))) bad('#10', "openCoach's .catch prints e.message as it is («Failed to fetch», «unauthorized», «HTTP 500») — every other AI caller maps it through FoodAI.friendlyErr");

// ── I. THE COACH ASKS IN فصحى, AND FOR IT (#14) ──────────────────────────────
// The Worker's chat prompt says "Reply in the language of the message", and a
// model copies the register it is addressed in. Sent as `text`, so it must
// fit the Worker's text cap with every figure at five digits.
const coachAr = (/lang === 'ar'\s*\?\s*`([^`]*)`/.exec(fnSrc(food, 'openCoach')) || [])[1];
const textCap = Number((read('backend/worker/gemini-worker.js').match(/text = String\(body\.text \|\| ''\)\.slice\(0, (\d+)\)/) || [])[1]);
if (!coachAr) bad('#14', 'openCoach has no Arabic prompt literal to read');
else {
  const filled = coachAr.replace(/\$\{[^}]*\}/g, '99999');
  for (const hit of dialect(filled)) bad('#14', `the Arabic coach prompt: ${hit}`);
  if (!/الفصحى/.test(filled)) bad('#14', 'the Arabic coach prompt never asks for الفصحى, so the reply copies whatever register the prompt is in');
  if (!textCap) bad('#14', "could not read the Worker's text cap");
  else if (filled.length > textCap) bad('#14', `the Arabic coach prompt is ${filled.length} chars with five-digit figures — the Worker keeps ${textCap} of \`text\``);
}

// ── J. A KEY CHOSEN BY COUNT EXISTS IN BOTH DICTIONARIES ─────────────────────
// Contract 5 reads t('key') and storage.js's F('key'); a key picked by a
// ternary — the natural way to write a ladder — is invisible to it.
for (const f of JS.filter((x) => x !== 'js/i18n.js')) {
  for (const m of read(f).matchAll(/['"`]([a-z][a-z0-9_]*_(?:1|2|n|many))['"`]/g)) {
    if (!(m[1] in I18N.en) || !(m[1] in I18N.ar)) bad('J', `${f} names '${m[1]}', which is missing from ${m[1] in I18N.en ? 'the Arabic dictionary' : m[1] in I18N.ar ? 'the English dictionary' : 'both dictionaries'}`);
  }
}

// ── K. THE NOUN FORM AT THE COUNTS EACH SITE CAN SHOW (#5) ──────────────────
// Only the reachable forms: the rest options are 10, 15 and 20 minutes, the
// minimum-effort log 10/20/30, the return card ≥ 7 days, the water picker 1–3 h.
const FORMS = {
  rest_min_go_n: '{n} دقائق', rest_min_go_many: '{n} دقيقة', min_logged_sub_n: '{n} دقائق', min_logged_sub_many: '{n} دقيقة',
  back_sub_n: '{n} أيام', back_sub_many: '{n} يوماً', notif_every_hours_1: 'كل ساعة', notif_every_hours_2: 'كل ساعتين', notif_every_hours_n: '{n} ساعات',
  notif_sum_water_1: 'كل ساعة', notif_sum_water_2: 'كل ساعتين', notif_sum_water_n: '{n} ساعات',
};
for (const [k, form] of Object.entries(FORMS)) {
  if (!(k in I18N.en) || !(k in I18N.ar)) bad('#5', `${k} is missing from ${k in I18N.en ? 'the Arabic dictionary' : k in I18N.ar ? 'the English dictionary' : 'both dictionaries'}`);
  else if (!I18N.ar[k].includes(form)) bad('#5', `${k}: «${I18N.ar[k]}» — want «${form}»`);
}
const BARE = { 'js/app.js': ['rest_min_go', 'min_logged_sub', 'back_sub', 'notif_every_hours', 'notif_sum_water'], 'js/storage.js': ['notif_water_body', 'notif_water_body_plan', 'notif_streak_title', 'notif_summary_title'] };
for (const [f, keys] of Object.entries(BARE)) {
  const s = f === 'js/app.js' ? app : read(f);
  for (const k of keys) if (new RegExp(`\\b(?:t|F)\\('${k}'`).test(s)) bad('#5', `${f} still reads the one-form '${k}' — «${I18N.ar[k]}» at every count`);
}

// ── L. THE TWO ONE-LINERS OUTSIDE THE DICTIONARIES (#17 #18) ────────────────
const admin = read('admin.html');
const digits = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)));
const ph = (admin.match(/id="newpw"[^>]*placeholder="([٠-٩\d]+) أحرف/) || [])[1];
const min = (admin.match(/pw\.length<(\d+)/) || [])[1];
if (!ph || !min || digits(ph) !== Number(min)) bad('#17', `admin.html's new-password placeholder promises «${ph} أحرف على الأقل»; its own check refuses anything under ${min}`);
if (!/has BOTH an EN and an AR entry in `js\/i18n\.js`/.test(read('CLAUDE.md'))) bad('#18', "CLAUDE.md's i18n rule still sends new strings to `app.js` — the dictionaries have lived in js/i18n.js since v333");

// ── M. THE CATALOGUE IS فصحى TOO (batch 6) ──────────────────────────────────
// A–L read the dictionaries. The food names a user actually logs come from
// js/catalog.js and nothing read them: seven presets said «رز» where the
// dictionary already says «أرز» («دجاج وأرز»). Every Arabic string the catalogue
// can put on screen meets the same dialect list.
const catalogAr = [];
for (const p of vm.runInContext('FOOD_PRESETS', c)) catalogAr.push([`FOOD_PRESETS «${p.en}».ar`, p.ar], [`FOOD_PRESETS «${p.en}».sa`, p.sa]);
for (const table of ['PLAN_DAY_AR', 'EXERCISE_NAME_AR', 'EXERCISE_NAME_AR_FULL']) for (const [k, v] of Object.entries(vm.runInContext(table, c))) catalogAr.push([`${table}[«${k}»]`, v]);
let catalogStrings = 0;
for (const [where, v] of catalogAr) {
  if (typeof v !== 'string') continue;
  catalogStrings++;
  for (const hit of dialect(v)) bad('B6', `js/catalog.js ${where}: ${hit} in «${v}»`);
}
if (catalogStrings < 400) bad('B6', `read only ${catalogStrings} Arabic strings from js/catalog.js — this check has gone silent`);

// ── N. AN ICON CHIP IS NAMED IN THE READER'S LANGUAGE (batch 6) ─────────────
// The «new cardio type» sheet named each icon chip with its icon id —
// «heartPulse», «zap» — so a screen reader said code words, in English, on the
// Arabic sheet (batch 5 found it). One name per id, in both languages.
const bodySrc = read('js/body.js');
const iconNameSrc = fnSrc(bodySrc, 'cardioIconName');
if (!iconNameSrc) bad('B6', 'js/body.js has no cardioIconName(id) — the cardio icon chips are named by their raw icon ids');
else {
  vm.runInContext(iconNameSrc, c);
  for (const l of ['ar', 'en']) {
    lang(l);
    for (const id of vm.runInContext('CARDIO_ICON_OPTIONS', c)) {
      const name = c.cardioIconName(id);
      if (!name || name === id || name === c.t('icon') || (l === 'ar' && !/[ء-ي]/.test(name))) bad('B6', `cardioIconName('${id}') (${l}): «${name}» — a chip needs a name a person says, in their language`);
    }
  }
}
if (/aria-label="\$\{nm\}"/.test(bodySrc)) bad('B6', 'js/body.js still names each cardio icon chip aria-label="${nm}" — the raw icon id');

// ── REPORT ─────────────────────────────────────────────────────────────────
if (problems.length) {
  const rank = (id) => parseInt(id.slice(1), 10) || 99;
  console.error(`FAIL  i18n: ${problems.length} problem(s)`);
  for (const p of problems.slice().sort((a, b) => rank(a.id) - rank(b.id))) console.error(`  ${p.id.padEnd(4)} ${p.msg}`);
}
assert.equal(problems.length, 0, `${problems.length} i18n problem(s), listed above`);
console.log(`PASS  i18n: no dialect marker in ${AR.length} Arabic values or ${catalogStrings} catalogue strings; one term per concept; the count ladders (relative dates, streaks, reminders) agree in both languages; reminders speak the user's unit; raw errors never reach the screen`);
