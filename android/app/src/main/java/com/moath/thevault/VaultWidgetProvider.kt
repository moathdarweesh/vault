package com.moath.thevault

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * THE VAULT's home-screen widget: today's workout and today's numbers.
 *
 * ⚠️ REMOTEVIEWS, DELIBERATELY NOT GLANCE. Glance is the modern way to write an
 * Android widget and it would be pleasanter code — it also pulls in Jetpack
 * Compose, and this project's first law is that it has no dependencies and no
 * build step. RemoteViews plus one layout XML needs nothing that is not already
 * in the SDK. The cost is real and is paid here: no arbitrary drawing, a fixed
 * set of view types, and every value set by id.
 *
 * ⚠️ AND EVERY WORD IT DRAWS COMES FROM THE SNAPSHOT, not from strings.xml.
 * The app's language is a preference the user sets inside the app — it is not
 * the system locale — so a widget reading its own resources would sit in
 * English beside an Arabic app, or the reverse, with no way to correct it. The
 * web side already holds both dictionaries and knows which one is chosen, so it
 * sends the eight words this file needs. That also means a copy change reaches
 * the widget on an ordinary web push, with no new APK.
 */
class VaultWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context, manager, ids)
    }

    companion object {

        fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val snap = readSnapshot(context)
            for (id in ids) manager.updateAppWidget(id, build(context, snap))
        }

        private fun readSnapshot(context: Context): JSONObject? = try {
            WidgetBridgePlugin.read(context)?.let { JSONObject(it) }
        } catch (_: Throwable) {
            // A malformed snapshot draws the "open the app" face rather than
            // crashing the launcher's host process, which is what an uncaught
            // throw here would do.
            null
        }

        private fun build(context: Context, snap: JSONObject?): RemoteViews {
            val v = RemoteViews(context.packageName, R.layout.widget_today)

            // The whole widget is one tap target: it opens the app. A widget is
            // read at arm's length on a home screen, so per-region targets would
            // be guesswork about which few pixels were meant.
            v.setOnClickPendingIntent(R.id.widget_root, launchIntent(context))

            if (snap == null) {
                v.setViewVisibility(R.id.widget_body, View.GONE)
                v.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                return v
            }
            v.setViewVisibility(R.id.widget_body, View.VISIBLE)
            v.setViewVisibility(R.id.widget_empty, View.GONE)

            val words = snap.optJSONObject("labels") ?: JSONObject()
            fun word(key: String, fallback: String) = words.optString(key, fallback)

            // ── the day's workout, or the rest day ──────────────────────────
            val workout = snap.optJSONObject("workout")
            v.setTextViewText(R.id.widget_eyebrow, word("today", "Today"))
            if (workout == null) {
                v.setTextViewText(R.id.widget_title, word("rest", "Rest day"))
                v.setTextViewText(R.id.widget_meta, "")
            } else {
                v.setTextViewText(R.id.widget_title, workout.optString("name", ""))
                val count = workout.optInt("count", 0)
                v.setTextViewText(R.id.widget_meta, "$count ${word("exercises", "exercises")}")
            }

            meter(v, R.id.widget_m1_label, R.id.widget_m1_value, R.id.widget_m1_bar,
                word("kcal", "kcal"), snap.optJSONObject("kcal"), "eaten")
            meter(v, R.id.widget_m2_label, R.id.widget_m2_value, R.id.widget_m2_bar,
                word("protein", "protein"), snap.optJSONObject("protein"), "eaten")
            meter(v, R.id.widget_m3_label, R.id.widget_m3_value, R.id.widget_m3_bar,
                word("water", "water"), snap.optJSONObject("water"), "ml")

            // ⚠️ AN AGE, NOT A CLOCK. Android gives a widget a limited update
            // budget, so what is drawn is a state AS OF a moment, never a live
            // reading. Saying when it was taken is the difference between stale
            // and wrong — and it only appears once it is worth saying.
            val ageMinutes = ((System.currentTimeMillis() - snap.optLong("at", 0L)) / 60000L)
            if (snap.optLong("at", 0L) > 0L && ageMinutes >= 120) {
                v.setViewVisibility(R.id.widget_age, View.VISIBLE)
                v.setTextViewText(R.id.widget_age, "${word("since", "since")} ${ageMinutes / 60}${word("hoursShort", "h")}")
            } else {
                v.setViewVisibility(R.id.widget_age, View.GONE)
            }
            return v
        }

        /** One label / value / bar trio. A goal of zero draws an empty track, never a full one. */
        private fun meter(
            v: RemoteViews, labelId: Int, valueId: Int, barId: Int,
            label: String, data: JSONObject?, valueKey: String,
        ) {
            v.setTextViewText(labelId, label)
            if (data == null) {
                v.setTextViewText(valueId, "—")
                v.setProgressBar(barId, 100, 0, false)
                return
            }
            val value = data.optInt(valueKey, 0)
            val goal = data.optInt("goal", 0)
            v.setTextViewText(valueId, value.toString())
            v.setProgressBar(barId, 100, if (goal > 0) (value * 100 / goal).coerceIn(0, 100) else 0, false)
        }

        private fun launchIntent(context: Context): PendingIntent {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // FLAG_IMMUTABLE is required from Android 12 (API 31) and is correct
            // here in any case: nothing may rewrite where this intent points.
            return PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        /** Repaint every placed widget — used by the bridge after a snapshot lands. */
        fun repaintAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, VaultWidgetProvider::class.java))
            if (ids.isNotEmpty()) render(context, manager, ids)
        }
    }
}
