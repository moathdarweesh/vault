# THE VAULT — نسخة أندرويد + Health Connect

تطبيق الويب صار ملفوف بـ **Capacitor** ليشتغل كتطبيق أندرويد، ويقرأ بيانات
**الخطوات / النبض / الأكسجين / النوم** من **Health Connect** (اللي تغذّيه Samsung Health
وساعة Galaxy Watch).

> ⚠️ **الإجهاد (Stress)** غير متاح — نوع خاص بسامسونج وما بينكتب لـ Health Connect.

---

## المتطلّبات (مرّة وحدة)

1. **Android Studio** — حمّله من https://developer.android.com/studio
2. على **جوالك**:
   - ثبّت **Health Connect** من Play Store (أو مدمج بأندرويد 14+).
   - افتح **Samsung Health → الإعدادات → Health Connect** وفعّل المزامنة.
   - البس الساعة (يوم للخطوات/النبض، وليلة للنوم) عشان تتجمّع بيانات.
   - فعّل **وضع المطوّر** + **USB debugging** على الجوال.

---

## البناء والتشغيل

من مجلد المشروع (`C:\Users\moath\vault`):

```bash
npm install            # مرّة وحدة (يثبّت Capacitor)
npm run build:www      # يجمّع ملفات الويب في www/
npx cap sync android   # ينسخها لمشروع أندرويد + يحدّث الإضافات
npx cap open android   # يفتح المشروع في Android Studio
```

بعدين من Android Studio:
1. وصّل جوالك بالـ USB (لازم جهاز حقيقي — Health Connect ما يشتغل على المحاكي).
2. اختر جهازك من القائمة فوق واضغط **Run ▶**.
3. التطبيق بينزّل على جوالك.

> أي تعديل لاحق على ملفات الويب: شغّل `npm run sync` ثم Run من جديد.

---

## تجربة Health Connect داخل التطبيق

1. افتح التطبيق → **Settings (الإعدادات)** → **Health Connect → مزامنة**.
2. أول مرّة بيطلع **طلب أذونات** من Health Connect — اسمح بكل الأنواع.
3. بعد السماح، بتظهر القيم: الخطوات، آخر نبض، الأكسجين، آخر نوم.

إذا طلعت رسالة:
- **"غير مثبّت"** → نزّل Health Connect على الجوال.
- **"لم يتم منح الإذن"** → اضغط **فتح Health Connect** وامنح الأذونات يدوياً.
- **"لا توجد بيانات"** → Samsung Health لسا ما كتبت بيانات لهذه الفترة (البس الساعة وزامن).

---

## بنية الكود الـ native

| الملف | الوظيفة |
|------|---------|
| `android/app/.../HealthConnectPlugin.kt` | الـ plugin: يقرأ الخطوات/النبض/الأكسجين/النوم |
| `android/app/.../PermissionsRationaleActivity.kt` | شاشة سياسة الخصوصية (يتطلّبها Health Connect) |
| `android/app/.../MainActivity.java` | يسجّل الـ plugin |
| `android/app/src/main/AndroidManifest.xml` | الأذونات + إعداد الخصوصية |
| `js/health.js` | الجهة الـ JS اللي تنادي الـ plugin وتعرض النتائج |

---

## ملاحظات النشر على Google Play (لاحقاً)

- Health Connect بتطلب **رابط سياسة خصوصية** بنفس النص اللي بـ `PermissionsRationaleActivity`.
- لازم تملأ نموذج **Health data declaration** في Play Console.
- النوم يعتمد على إنّ Samsung Health فعلاً تكتبه لـ Health Connect (تأكّد بتطبيق Health Connect).
