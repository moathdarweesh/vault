package com.moath.thevault

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * Quick log. 4x1: start today's workout · weight · a cup of water.
 *
 * ⚠️ THE WIDGET DOES NOT WRITE INTO THE APP, AND CANNOT. Everything the app
 * owns lives in the WebView's own storage, which is a LevelDB the platform does
 * not expose to anything outside it — that is the whole reason DB.widget.push()
 * hands out a snapshot in the first place. So a button here OPENS the app on
 * the action rather than performing it: each PendingIntent carries
 * `thevault://quick/<action>`, and the web side reads it once at boot and does
 * the thing. One tap from the home screen either way; the difference is that
 * nothing here pretends to have written anything.
 *
 * ⚠️ AND EACH PENDINGINTENT NEEDS ITS OWN REQUEST CODE. Intents that differ
 * only by their DATA are "the same" to PendingIntent.getActivity, so three
 * buttons sharing a request code collapse into whichever was created last —
 * three buttons, one action, silently. VaultWidgets.launchIntent hashes the
 * action into the request code for exactly this reason.
 */
class QuickWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val snap = VaultWidgets.snapshot(context)
        val v = RemoteViews(context.packageName, R.layout.widget_quick)
        VaultWidgets.applyDirection(v, R.id.widget_root, snap)

        // The words come from the snapshot; the fallbacks are only for a device
        // that has installed the app but never opened it.
        v.setTextViewText(R.id.widget_q1, VaultWidgets.word(snap, "qWorkout", "Workout"))
        v.setTextViewText(R.id.widget_q2, VaultWidgets.word(snap, "qWeight", "Weight"))
        v.setTextViewText(R.id.widget_q3, VaultWidgets.word(snap, "qWater", "+250"))

        v.setOnClickPendingIntent(R.id.widget_q1, VaultWidgets.launchIntent(context, "workout"))
        v.setOnClickPendingIntent(R.id.widget_q2, VaultWidgets.launchIntent(context, "weight"))
        v.setOnClickPendingIntent(R.id.widget_q3, VaultWidgets.launchIntent(context, "water250"))

        for (id in ids) manager.updateAppWidget(id, v)
    }
}
