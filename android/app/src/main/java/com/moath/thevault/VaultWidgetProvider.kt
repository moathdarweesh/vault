package com.moath.thevault

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * THE VAULT — today. 4x2: the day's workout and the three numbers.
 *
 * ⚠️ REMOTEVIEWS, DELIBERATELY NOT GLANCE. Glance is the modern way to write an
 * Android widget and it would be pleasanter code — it also pulls in Jetpack
 * Compose, and this project's first law is that it has no dependencies and no
 * build step. RemoteViews plus one layout XML needs nothing that is not already
 * in the SDK. The cost is real and is paid here: no arbitrary drawing, a fixed
 * set of view types, and every value set by id.
 *
 * ⚠️ THE CLASS NAME IS LOAD-BEARING. Build 23 shipped this provider, so a widget
 * the owner already placed is bound to THIS class name. Renaming it would make
 * that widget vanish on update rather than change.
 */
class VaultWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val snap = VaultWidgets.snapshot(context)
        for (id in ids) manager.updateAppWidget(id, build(context, snap))
    }

    companion object {
        fun build(context: Context, snap: JSONObject?): RemoteViews {
            val v = RemoteViews(context.packageName, R.layout.widget_today)
            v.setOnClickPendingIntent(R.id.widget_root, VaultWidgets.launchIntent(context))
            VaultWidgets.applyDirection(v, R.id.widget_root, snap)
            if (VaultWidgets.showEmpty(v, snap)) return v
            val s = snap!!

            // ── the day, and the streak beside it ───────────────────────────
            v.setTextViewText(R.id.widget_eyebrow, VaultWidgets.word(s, "today", "Today"))
            val streak = s.optInt("streak", 0)
            if (streak > 0) {
                v.setViewVisibility(R.id.widget_streak, View.VISIBLE)
                v.setTextViewText(R.id.widget_streak_n, streak.toString())
                v.setTextViewText(R.id.widget_streak_u, VaultWidgets.word(s, "dayUnit", "d"))
            } else {
                v.setViewVisibility(R.id.widget_streak, View.GONE)
            }

            // ── the workout, or the rest day ────────────────────────────────
            val workout = s.optJSONObject("workout")
            if (workout == null) {
                v.setTextViewText(R.id.widget_title, VaultWidgets.word(s, "rest", "Rest day"))
                v.setTextViewText(R.id.widget_meta, "")
            } else {
                v.setTextViewText(R.id.widget_title, workout.optString("name", ""))
                val count = workout.optInt("count", 0)
                v.setTextViewText(R.id.widget_meta, "$count ${VaultWidgets.word(s, "exercises", "exercises")}")
            }

            // ── the three meters ────────────────────────────────────────────
            fill(v, s.optJSONObject("kcal"), "eaten", VaultWidgets.word(s, "kcal", "kcal"),
                R.id.widget_m1_label, R.id.widget_m1_value,
                intArrayOf(R.id.widget_m1_b0, R.id.widget_m1_b1, R.id.widget_m1_b2, R.id.widget_m1_b3, R.id.widget_m1_b4))
            fill(v, s.optJSONObject("protein"), "eaten", VaultWidgets.word(s, "protein", "protein"),
                R.id.widget_m2_label, R.id.widget_m2_value,
                intArrayOf(R.id.widget_m2_b0, R.id.widget_m2_b1, R.id.widget_m2_b2, R.id.widget_m2_b3, R.id.widget_m2_b4))
            fill(v, s.optJSONObject("water"), "ml", VaultWidgets.word(s, "water", "water"),
                R.id.widget_m3_label, R.id.widget_m3_value,
                intArrayOf(R.id.widget_m3_b0, R.id.widget_m3_b1, R.id.widget_m3_b2, R.id.widget_m3_b3, R.id.widget_m3_b4))
            return v
        }

        private fun fill(v: RemoteViews, data: JSONObject?, key: String, label: String, labelId: Int, valueId: Int, bars: IntArray) {
            v.setTextViewText(labelId, label)
            if (data == null) {
                // A dash, not a zero: nothing logged and a goal of nothing are
                // different facts, and a zero states the wrong one.
                v.setTextViewText(valueId, "—")
                VaultWidgets.meter(v, bars, 0, 0)
                return
            }
            val value = data.optInt(key, 0)
            v.setTextViewText(valueId, VaultWidgets.num(value))
            VaultWidgets.meter(v, bars, value, data.optInt("goal", 0))
        }

        /** Kept for the bridge, which repainted through this before there were four. */
        fun repaintAll(context: Context) = VaultWidgets.repaintAll(context)
    }
}
