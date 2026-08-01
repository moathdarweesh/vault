# THE VAULT — نسخ احتياطي واستعادة قاعدة البيانات (Backup & Restore Runbook)

> القاعدة الذهبية: **النسخة الاحتياطية التي لم تُجرَّب استعادتها = غير موجودة.**
> كل من فقد بياناته كان عنده نسخ احتياطية؛ ما لم يكن عنده هو استعادة سبق أن نجّحها.
> لذلك القسم (2) — التحقق بالاستعادة — **إلزامي، وليس اختيارياً.**

هذا الدليل مكتوب لمالك واحد غير متخصص، على خطة **Supabase المجانية**.
خطوة بخطوة، بالضغطات والأوامر الجاهزة للنسخ.

---

## 0) الوضع الحالي وحدود الخطة المجانية (اقرأه أولاً)

- **المنصة:** Supabase (Postgres + Auth + Storage)، الخطة **Free**.
- **البيانات الحية اليوم:** جدول واحد فقط `public.vault_data` (صف واحد لكل مستخدم يحوي كل حالته كـ JSON). هذا هو **الجدول الحرِج الوحيد** قبل الترحيل.
- **`schema-v2.sql` إضافي بالكامل (ADDITIVE):** ينشئ 16 جدولاً جديداً بـ `create table if not exists`، ولا يلمس `vault_data` ولا `auth.users`. لهذا **التراجع سهل** (قسم 4): نحذف الجداول الجديدة فقط، وبيانات المستخدمين تبقى سليمة.

### حدود الخطة المجانية (حقائق يجب أن تعرفها)
| الميزة | على الخطة المجانية |
|---|---|
| **PITR** (استعادة لأي لحظة، RPO بالدقائق) | ❌ **غير متوفر.** يتطلب خطة Pro (~25$/شهر) + إضافة PITR. |
| **نسخ يومية تلقائية تُنزَّل من اللوحة** | ❌ غير متوفرة على المجاني (ميزة مدفوعة). |
| **إيقاف المشروع (pause)** | ⚠️ يتوقف المشروع بعد **~7 أيام خمول**؛ لا يمكن أخذ نسخة منه وهو متوقف حتى تُعيد تشغيله، والخمول الطويل قد يؤدي لحذفه. |
| **الحل الوحيد الحقيقي** | ✅ نسخ منطقية يدوية بـ `pg_dump` تأخذها **أنت** وتحفظها **خارج Supabase**. |

### الهدف المُعلَن (RPO / RTO)
- **RPO (كم بيانات يُسمح بفقدها):** مع النسخ اليدوية فقط = **حتى 24 ساعة** (تفقد ما بين آخر نسخة والكارثة). *قبل أي ترحيل، RPO = صفر* لأننا نأخذ نسخة طازجة قبله مباشرة. للوصول إلى RPO بالدقائق تحتاج Pro + PITR.
- **RTO (كم يستغرق الاسترجاع):** قاعدة صغيرة → **دقائق إلى ساعة** عبر الاستعادة المنطقية. مقبول.

---

## 1) قبل تطبيق `schema-v2.sql` أو أي ترحيل: خذ نسختين

نأخذ نسختين معاً (الحزام + الحمّالة): واحدة فورية بالضغطات، وواحدة حقيقية قابلة للاستعادة.

### أ) نسخة فورية بالضغطات فقط — تصدير CSV (بدون تثبيت أي أداة)
هذه أسرع أمان، ولأن `vault_data` هو الجدول الوحيد الذي يحمل بياناتٍ، فهي تلتقط **كل** بيانات المستخدمين:

1. لوحة Supabase → **Table Editor** (من القائمة اليسرى).
2. اختر جدول **`vault_data`**.
3. أعلى الجدول → زر **Export** (أو قائمة `...`) → **Export as CSV**.
4. احفظ الملف باسم واضح، مثل `vault_data_2026-07-10.csv`.
5. **انسخه فوراً إلى Google Drive** (مجلد `G:\ملفاتي`) — هذه هي النسخة **خارج المنصة**.

> هذه نسخة قراءة بشرية للطوارئ. النسخة الحقيقية القابلة للاستعادة الكاملة هي (ب).

### ب) النسخة الحقيقية القابلة للاستعادة — `pg_dump -Fc`

**مرة واحدة فقط: ثبّت أدوات Postgres** (تعطيك `pg_dump.exe` و`pg_restore.exe` وأيضاً خادم Postgres محلي نستعمله في التحقق):
- افتح PowerShell ونفّذ: `winget install PostgreSQL.PostgreSQL.16`
  (أو نزّل مُثبِّت PostgreSQL 16+ من postgresql.org). أثناء التثبيت ستضع **كلمة سر محلية للمستخدم `postgres`** — احفظها؛ سنحتاجها في قسم 2. الأدوات في `C:\Program Files\PostgreSQL\16\bin`.

**احصل على رابط الاتصال (Connection String):**
1. لوحة Supabase → **Project Settings** (الترس) → **Database**.
2. قسم **Connection string** → اختر تبويب **Session pooler** (مهم: **ليس** *Transaction pooler*؛ أداة `pg_dump` تحتاج اتصال Session على المنفذ **5432**، والمنفذ 6543 لا يعمل معها).
3. شكله: `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`
   - `<ref>` لمشروعك الحالي = `ilmusnuchqlpirywonzx`.
   - `[YOUR-PASSWORD]` = **كلمة سر قاعدة البيانات** التي اخترتها عند إنشاء المشروع (المذكورة في `supabase-setup.md` خطوة 2).

> **لا تكتب كلمة السر داخل أي ملف ولا داخل سطر الأمر** (تبقى في سِجل الأوامر). مرّرها عبر متغير الجلسة `PGPASSWORD` كما بالأسفل. يُشار إليها هنا باسمها فقط: *كلمة سر قاعدة البيانات*.

**خذ النسخة** (PowerShell — استبدل `<region>` بقيمة مشروعك، والصق كلمة السر عند السطر الأول):
```powershell
# 1) عرّف كلمة سر القاعدة لهذه الجلسة فقط
$env:PGPASSWORD = "كلمة-سر-قاعدة-البيانات"

# 2) جهّز مجلد النسخ
New-Item -ItemType Directory -Force "C:\Users\moath\vault-backups" | Out-Null

# 3) خذ نسخة كاملة من مخطط public (كل بيانات التطبيق) بصيغة custom (-Fc)
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
  "host=aws-0-<region>.pooler.supabase.com port=5432 user=postgres.ilmusnuchqlpirywonzx dbname=postgres sslmode=require" `
  --format=custom --no-owner --no-privileges --schema=public `
  --file="C:\Users\moath\vault-backups\vault_$(Get-Date -Format yyyy-MM-dd_HHmm).dump"

# 4) أفرغ المتغير من الذاكرة
$env:PGPASSWORD = $null
```
- `--format=custom` (‎`-Fc`) = صيغة قابلة للاستعادة الانتقائية عبر `pg_restore`.
- `--no-owner --no-privileges` = تُستعاد في أي قاعدة دون الحاجة لأدوار Supabase الخاصة.
- **بعد النجاح: انسخ ملف `.dump` إلى Google Drive (`G:\ملفاتي`)** — النسخة خارج المنصة (القاعدة رقم 4). إن توقّف رفع Drive، أعد تشغيل `GoogleDriveFS`.

---

## 2) تحقّق أن النسخة حقيقية (Test-Restore) — إلزامي

نسخة لم تُستعَد = **غير مُتحقَّق منها (unverified)**، ولا يجوز اعتبار البيانات محميّة بها.
نستعيد في **قاعدة خدش محلية منفصلة** ونقارن **عدد صفوف الجدول الحرِج** بالمصدر.
(نستخدم خادم Postgres المحلي الذي ثُبّت في قسم 1؛ فيه أنت superuser، معزول تماماً عن الإنتاج.)

**الحد الأدنى دائماً — تأكّد أن الملف قابل للقراءة ويحوي بياناتك:**
```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" --list "C:\Users\moath\vault-backups\vault_2026-07-10_XXXX.dump"
```
يجب أن ترى سطراً فيه `TABLE DATA public vault_data`. لو الملف صغير جداً أو القائمة فارغة → النسخة فاشلة، أعِدها.

**الإثبات الحقيقي — استعادة فعلية ومقارنة الأعداد:**
```powershell
$env:PGPASSWORD = "كلمة-سر-postgres-المحلية"   # كلمة السر المحلية من تثبيت PostgreSQL
$bin = "C:\Program Files\PostgreSQL\16\bin"

# 1) أنشئ قاعدة خدش مؤقتة
& "$bin\createdb.exe" -U postgres vault_scratch

# 2) جهّز ما تشير إليه المفاتيح الخارجية (auth.users) + أدوار RLS، حتى تُستعاد البيانات نظيفة محلياً
& "$bin\psql.exe" -U postgres -d vault_scratch -c "create schema if not exists auth; create table if not exists auth.users(id uuid primary key); create role authenticated; create role anon;"

# 3) استعِد (‎--disable-triggers يتجاوز فحص المفاتيح الخارجية أثناء تحميل البيانات)
& "$bin\pg_restore.exe" -U postgres -d vault_scratch --no-owner --no-privileges --disable-triggers "C:\Users\moath\vault-backups\vault_2026-07-10_XXXX.dump"

# 4) عُدّ صفوف الجدول الحرِج في النسخة المستعادة
& "$bin\psql.exe" -U postgres -d vault_scratch -c "select count(*) from public.vault_data;"

# 5) نظّف
& "$bin\dropdb.exe" -U postgres vault_scratch
$env:PGPASSWORD = $null
```
ثم في **Supabase → SQL Editor** نفّذ نفس العدّ على المصدر:
```sql
select count(*) as source_rows from public.vault_data;
```
**النسخة متحقَّق منها فقط إذا تطابق العددان.** سجّل: تاريخ التحقق، الطريقة، ما قُورن، والمدة.

> **أخطاء متوقّعة يمكن تجاهلها** أثناء الاستعادة المحلية: رسائل عن أدوار مثل `authenticated`/`anon`، أو الدالة `auth.uid()`، أو سياسات RLS، أو امتدادات Supabase غير الموجودة محلياً. هذه كائنات نظام Supabase — لا تؤثر على جداول بياناتك ولا على عدد الصفوف. المهم أن يتطابق العدد.

**بعد الترحيل**، الجداول الحرِجة التي تُقارَن أعدادها تصبح المُطبَّعة:
`workout_sessions`, `workout_sets`, `cardio_logs`, `food_logs`, `foods`, `sleep_logs`,
`supplements`, `supplement_logs`, `plan_days`, `plan_day_exercises`, والصفوف المخصّصة في `exercises` (‎`is_custom = true`).

**تمرين استعادة دوري (Restore Drill):** كرّر هذا التحقق كل **ربع سنة** على الأقل، وبعد أي تغيير في إعداد النسخ. تمرينٌ أقدم من 3 أشهر = افتراض قديم لا يُعتمد عليه.

---

## 3) الاحتفاظ و PITR على الخطة المجانية (Retention & limits)

- **PITR: غير مُفعَّل وغير متاح** على المجاني (نافذة الاستعادة اللحظية = لا شيء). النافذة الوحيدة هي: *منذ آخر ملف `pg_dump` أخذته*.
- **سُلّم احتفاظ مقترح** (ملفاتك على Google Drive — التخزين أرخص من البيانات، لا تحذف لتوفير مساحة):
  - **يومي:** آخر 7 نسخ.
  - **أسبوعي:** آخر 4 أسابيع.
  - **شهري:** آخر 12 شهراً.
  المُحرِّك الحقيقي للاحتفاظ ليس الامتثال، بل **كم قد يمرّ من الوقت قبل أن تكتشف فساداً صامتاً** (ترحيل خاطئ). يجب أن يتجاوز الاحتفاظُ زمنَ الاكتشاف.
- **نسخة خارج المنصة (إلزامية):** كل `.dump` و`.csv` إلى `G:\ملفاتي` (Google Drive). نسخة تعيش في نفس حساب Supabase فقط لا تنجو من تعليق الحساب أو حذف المشروع.
- **مع إطلاق منتج متعدّد المستخدمين**: RPO بيوم كامل يعني احتمال فقد يوم من بيانات مستخدمين حقيقيين. عند وصول مستخدمين فعليين، فكّر جدياً في ترقية Supabase إلى **Pro + PITR** (~25$/شهر) لتقليل RPO إلى دقائق. اذكرها كقرار واعٍ بتكلفته.

---

## 4) التراجع لو فشل التطبيق (Rollback)

**الوضع المريح:** `schema-v2.sql` إضافي فقط ولا يلمس `vault_data`. فحتى لو فشل التطبيق في منتصفه، بيانات المستخدمين الحيّة سليمة والتطبيق يظل يعمل على `vault_data`. التراجع = **حذف الجداول الجديدة فقط**.

نفّذ في **Supabase → SQL Editor** (‎`if exists` + `cascade` تجعله آمناً وقابلاً للتكرار، ولن يمسّ `vault_data` ولا `auth.users`):
```sql
-- تراجع عن schema-v2: حذف الكائنات الجديدة فقط. آمن على vault_data و auth.users.
begin;

drop table if exists public.plan_day_exercises  cascade;
drop table if exists public.plan_days           cascade;
drop table if exists public.workout_sets        cascade;
drop table if exists public.workout_sessions    cascade;
drop table if exists public.supplement_logs     cascade;
drop table if exists public.supplements         cascade;
drop table if exists public.food_logs           cascade;
drop table if exists public.foods               cascade;
drop table if exists public.sleep_logs          cascade;
drop table if exists public.cardio_logs         cascade;
drop table if exists public.cardio_types        cascade;
drop table if exists public.user_exercise_prefs cascade;
drop table if exists public.exercises           cascade;
drop table if exists public.health_prefs        cascade;
drop table if exists public.user_prefs          cascade;
drop table if exists public.profiles            cascade;

-- (احتياط) الجداول الاجتماعية المؤجَّلة — تُحذف فقط إن أنشأها تطبيقٌ خاطئ للمسودّة الكاملة:
drop table if exists public.user_exercise_stats     cascade;
drop table if exists public.coaching_relationships  cascade;
drop table if exists public.friendships             cascade;

-- الدالة المشتركة والأنواع (enums) الجديدة
drop function if exists public.touch_updated_at() cascade;
drop type if exists public.coaching_status;   -- احتياط (مؤجَّل)
drop type if exists public.friendship_status; -- احتياط (مؤجَّل)
drop type if exists public.theme_pref;
drop type if exists public.lang_pref;
drop type if exists public.unit_pref;
drop type if exists public.exercise_category;
-- ملاحظة: امتداد citext يُترك؛ حذفه غير ضروري وقد يستعمله غيرك.

commit;
```
تحقّق بعده أن `vault_data` سليم: `select count(*) from public.vault_data;` يجب أن يبقى كما كان.

**أسوأ الحالات (لو تضرّرت بيانات فعلاً — نادر لأن الترحيل إضافي):** لا تستعِد فوق القاعدة الحيّة. استعِد أولاً في مشروع/قاعدة جديدة، تحقّق (قسم 2)، ثم — **بموافقة بشرية صريحة فقط** — انقل الصفوف. أمر الاستعادة الكامل من النسخة:
```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" `
  "host=aws-0-<region>.pooler.supabase.com port=5432 user=postgres.ilmusnuchqlpirywonzx dbname=postgres sslmode=require" `
  --no-owner --no-privileges --clean --if-exists `
  "C:\Users\moath\vault-backups\vault_2026-07-10_XXXX.dump"
```

---

## 5) بطاقة ما قبل الترحيل (سجّلها في كل مرة)

قبل أي `db-migration-engineer` يلمس الإنتاج، أكّد بصوت عالٍ وسجّل:
1. **البيئة المستهدفة:** إنتاج Supabase، مشروع `ilmusnuchqlpirywonzx`.
2. **مُعرّف النسخة:** اسم ملف `.dump` وتاريخه/وقته (وملف CSV المرافق).
3. **نتيجة التحقق:** تطابق `count(*)` بين المصدر والاستعادة (قسم 2) — أو **"غير متحقَّق منه"** بوضوح إن لم يُجرَ، وعندها **لا يمضي الترحيل**.
4. **أمر التراجع الدقيق:** سكربت الحذف في قسم 4 (تراجع فوري)، وأمر الاستعادة في قسم 4 (لأسوأ الحالات).
5. **موقع النسخة خارج المنصة:** `G:\ملفاتي` (Google Drive).

**البطاقة الآلية (يقرؤها المنسّق ويمرّرها لـ `db-migration-engineer`) — املأها بعد أن تشاهد الاستعادة تنجح:**
```yaml
# verified = true فقط إذا رأيت بنفسك تطابق العددين في القسم (2). خلاف ذلك اتركها false والترحيل يتوقف.
pre_migration_backup:
  backup_id: vault_2026-07-10_XXXX.dump
  timestamp: 2026-07-10T00:00:00Z          # وقت أخذ النسخة (UTC، ISO-8601)
  verified: false                          # حوّلها إلى true فقط بعد تطابق count(*) مصدر=مستعاد
  verify_method: "pg_restore إلى قاعدة خدش محلية vault_scratch؛ قورن count(*) لـ public.vault_data بين المصدر والمستعاد"
  restore_command: "التراجع الفوري = سكربت الحذف في القسم 4 (Supabase SQL Editor). التطبيق إضافي فلا يحتاج vault_data استعادة. لأسوأ الحالات: أمر pg_restore --clean --if-exists في القسم 4."
```

> **حالة التأليف (مهمّة):** هذا الملف كُتب تأليفاً فقط ولم يُلمَس أي قاعدة حيّة، **ولم أشاهد أنا أي استعادة**. لذلك حتى اللحظة **لا توجد نسخة متحقَّق منها**: `verified: false`. البوابة لا تُفتح إلا بعد أن تنفّذ **أنت** القسمين (1) و(2) ويتطابق العددان. حتى ذلك الحين، الترحيل لا يمضي.

> تذكير أمان: البيانات المستعادة لأي مكان خارج الإنتاج يجب أن تمرّ بتمويه (anonymization) عبر `db-seed-engineer` أولاً — لا تنزل بيانات مستخدمين حقيقية على جهاز مطوّر دون تمويه.
