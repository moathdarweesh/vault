package com.moath.thevault

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * The streak, and today under it. 2x2.
 *
 * ⚠️ NOT A LOCK-SCREEN WIDGET, though the design called it one at first.
 * Android removed lock-screen widgets from phones in 12 and brought them back
 * in 14 for TABLETS only, so a phone cannot host one at all. This is a
 * home-screen identity tile, which is what it always really was.
 */
class StreakWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val snap = VaultWidgets.snapshot(context)
        val v = RemoteViews(context.packageName, R.layout.widget_streak)
        v.setOnClickPendingIntent(R.id.widget_root, VaultWidgets.launchIntent(context))
        VaultWidgets.applyDirection(v, R.id.widget_root, snap)

        if (!VaultWidgets.showEmpty(v, snap)) {
            val s = snap!!
            val streak = s.optInt("streak", 0)
            v.setTextViewText(R.id.widget_big, streak.toString())
            v.setTextViewText(R.id.widget_big_unit, VaultWidgets.word(s, "streakUnit", "day streak"))

            v.setTextViewText(R.id.widget_eyebrow, VaultWidgets.word(s, "today", "Today"))
            val workout = s.optJSONObject("workout")
            v.setTextViewText(
                R.id.widget_title,
                if (workout == null) VaultWidgets.word(s, "rest", "Rest day") else workout.optString("name", ""),
            )
        }
        for (id in ids) manager.updateAppWidget(id, v)
    }
}
