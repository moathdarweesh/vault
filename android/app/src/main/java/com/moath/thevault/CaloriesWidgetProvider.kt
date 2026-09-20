package com.moath.thevault

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * What is left to eat today. 2x2.
 *
 * One number, because that is the whole question the owner asks this tile. The
 * mark shrinks to the plates alone here — the app itself drops the wordmark
 * below size 10, and inside a widget the sub-line would land at 6.5px.
 */
class CaloriesWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val snap = VaultWidgets.snapshot(context)
        val v = RemoteViews(context.packageName, R.layout.widget_calories)
        v.setOnClickPendingIntent(R.id.widget_root, VaultWidgets.launchIntent(context))
        VaultWidgets.applyDirection(v, R.id.widget_root, snap)

        if (!VaultWidgets.showEmpty(v, snap)) {
            val s = snap!!
            v.setTextViewText(R.id.widget_eyebrow, VaultWidgets.word(s, "remaining", "Left today"))

            val kcal = s.optJSONObject("kcal")
            if (kcal == null) {
                // No goal set: the number would be an invention, so say nothing
                // and let the eyebrow carry the meaning.
                v.setTextViewText(R.id.widget_big, "—")
                v.setTextViewText(R.id.widget_big_unit, VaultWidgets.word(s, "kcal", "kcal"))
                VaultWidgets.meter(v, BARS, 0, 0)
            } else {
                val eaten = kcal.optInt("eaten", 0)
                val goal = kcal.optInt("goal", 0)
                // Left, not eaten — and never below zero, which would read as a
                // debt the app does not actually track.
                v.setTextViewText(R.id.widget_big, VaultWidgets.num((goal - eaten).coerceAtLeast(0)))
                v.setTextViewText(R.id.widget_big_unit, VaultWidgets.word(s, "kcal", "kcal"))
                VaultWidgets.meter(v, BARS, eaten, goal)
            }

            val protein = s.optJSONObject("protein")
            v.setTextViewText(R.id.widget_m2_label, VaultWidgets.word(s, "protein", "protein"))
            v.setTextViewText(
                R.id.widget_m2_value,
                if (protein == null) "—"
                else VaultWidgets.num(protein.optInt("eaten", 0)) + " / " + VaultWidgets.num(protein.optInt("goal", 0)),
            )
        }
        for (id in ids) manager.updateAppWidget(id, v)
    }

    private companion object {
        val BARS = intArrayOf(R.id.widget_m1_b0, R.id.widget_m1_b1, R.id.widget_m1_b2, R.id.widget_m1_b3, R.id.widget_m1_b4)
    }
}
