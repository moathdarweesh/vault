# شات السعرات — الباك إند (Cloudflare Worker)

سيرفر صغير مجاني يحمل مفتاح Gemini كـ **سرّ**، فالتطبيق ما يشوف المفتاح أبداً —
المستخدم يشوف الشات فقط.

## النشر خطوة بخطوة

1. **مفتاح Gemini مجاني:** افتح https://aistudio.google.com/apikey → **Create API key** → انسخه واحتفظ فيه (لا تنشره).

2. **حساب Cloudflare مجاني:** https://dash.cloudflare.com → Sign up.

3. **أنشئ Worker:**
   - من القائمة: **Compute (Workers)** → **Workers & Pages** → **Create** → **Create Worker**.
   - أعطه اسم (مثلاً `vault-calories`) → **Deploy**.

4. **الصق الكود:**
   - اضغط **Edit code**.
   - امسح المحتوى والصق كامل ملف [`gemini-worker.js`](gemini-worker.js).
   - **Deploy**.

5. **أضف المفتاح كسرّ:**
   - ارجع لصفحة الـ Worker → **Settings** → **Variables and Secrets**.
   - **Add** → النوع **Secret** → الاسم بالضبط `GEMINI_KEY` → القيمة = مفتاح Gemini → **Save/Deploy**.

6. **انسخ رابط الـ Worker:**
   - بيكون شكله: `https://vault-calories.<اسمك>.workers.dev`
   - أعطِ هذا الرابط للمطوّر ليضعه في `js/foodai.js` (المتغيّر `PROXY_URL`). **المفتاح لا يُشارك — الرابط فقط.**

## اختبار سريع (اختياري)
```bash
curl -X POST https://vault-calories.<اسمك>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"text":"رز مع دجاج"}'
```
لازم يرجّع: `{"name":"...","calories":...,"protein":...,"carbs":...,"fat":...}`

## ملاحظات
- **مجاني:** Cloudflare Workers (١٠٠ ألف طلب/يوم) + Gemini Flash (حصّة مجانية).
- **مفتاح واحد للكل:** كل مستخدمي التطبيق يستخدمون نفس المفتاح/الحصّة.
- الرابط عام؛ للاستخدام الشخصي تمام. لو احتجنا لاحقاً، نضيف مفتاح مشترك بسيط بين التطبيق والـ Worker لمنع الاستخدام الخارجي.
