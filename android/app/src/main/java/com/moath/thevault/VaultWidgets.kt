package com.moath.thevault

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Everything the four widgets share: the snapshot, the words, the meters and
 * the tap targets. Each provider is a thin class over this.
 *
 * ⚠️ EVERY WORD A WIDGET DRAWS COMES FROM THE SNAPSHOT, not from strings.xml.
 * The app's language is a preference the user sets INSIDE the app — it is not
 * the system locale — so a widget reading its own resources would sit in
 * English beside an Arabic app, or the reverse, with no way to correct it. The
 * web side holds both dictionaries and knows which is chosen, so it sends the
 * words. That also means a copy change reaches the widget on an ordinary web
 * push, with no new APK. res/values only holds the launcher's picker labels.
 *
 * ⚠️ AND THE LAYOUT DIRECTION FOLLOWS THE APP, NOT THE PHONE. A widget inflated
 * in the launcher's process takes the launcher's locale, so an Arabic app on an
 * English phone would draw its Arabic words left-to-right. setLayoutDirection
 * on the root, from the snapshot's own `lang`, is what keeps them together.
 */
object VaultWidgets {

    /** Every provider, so one save repaints them all. */
    private val PROVIDERS = listOf(
        VaultWidgetProvider::class.java,
        CaloriesWidgetProvider::class.java,
        StreakWidgetProvider::class.java,
        QuickWidgetProvider::class.java,
    )

    fun snapshot(context: Context): JSONObject? = try {
        WidgetBridgePlugin.read(context)?.let { JSONObject(it) }
    } catch (_: Throwable) {
        // A malformed snapshot draws the empty face rather than throwing inside
        // the launcher's host process, which is what an uncaught throw here
        // would take down.
        null
    }

    /** Repaint every placed widget of every kind. */
    fun repaintAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (cls in PROVIDERS) {
            val ids = manager.getAppWidgetIds(ComponentName(context, cls))
            if (ids.isEmpty()) continue
            val intent = Intent(context, cls).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    /** How many placed widgets there are, all kinds counted. */
    fun placedCount(context: Context): Int {
        val manager = AppWidgetManager.getInstance(context)
        return PROVIDERS.sumOf { manager.getAppWidgetIds(ComponentName(context, it)).size }
    }

    fun word(snap: JSONObject?, key: String, fallback: String): String {
        val words = snap?.optJSONObject("labels") ?: return fallback
        val v = words.optString(key, "")
        return if (v.isEmpty()) fallback else v
    }

    /** The whole tile opens the app; a widget is read at arm's length, so one target. */
    fun launchIntent(context: Context, action: String? = null): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        // The action travels as a URI the web side reads at boot (?ql=…). The
        // widget cannot write into the app itself: the data lives in the
        // WebView's own storage, which nothing outside it may open.
        if (action != null) intent.data = Uri.parse("thevault://quick/$action")
        return PendingIntent.getActivity(
            context,
            action?.hashCode() ?: 0,   // a distinct request code per action, or they collide
            intent,
            // FLAG_IMMUTABLE is required from API 31 and correct anyway: nothing
            // may rewrite where this intent points.
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** Apply the app's own reading direction to the root. */
    fun applyDirection(v: RemoteViews, rootId: Int, snap: JSONObject?) {
        val rtl = (snap?.optString("lang") ?: "") == "ar"
        v.setInt(rootId, "setLayoutDirection", if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
    }

    /**
     * The five-bar meter, the app's own shape.
     *
     * ⚠️ NOT a ProgressBar. The system bar is a different object with a
     * different silhouette; five segments with a 3dp gap and a 2dp radius is
     * what the app draws, and the only way to have it here is five views whose
     * background is swapped. A goal of zero fills none of them — never all.
     */
    fun meter(v: RemoteViews, bars: IntArray, value: Int, goal: Int) {
        val on = if (goal > 0) Math.round(bars.size * (value.toFloat() / goal)).coerceIn(0, bars.size) else 0
        for (i in bars.indices) {
            v.setInt(bars[i], "setBackgroundResource", if (i < on) R.drawable.widget_bar_on else R.drawable.widget_bar_off)
        }
    }

    /** A grouped integer in the app's own style (1,660). */
    fun num(n: Int): String = String.format("%,d", n)

    /** Show the empty face when the app has never written a snapshot. */
    fun showEmpty(v: RemoteViews, snap: JSONObject?): Boolean {
        if (snap != null) {
            v.setViewVisibility(R.id.widget_body, View.VISIBLE)
            v.setViewVisibility(R.id.widget_empty, View.GONE)
            return false
        }
        v.setViewVisibility(R.id.widget_body, View.GONE)
        v.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        // No snapshot means no words either, so this one string is the launcher's.
        v.setTextViewText(R.id.widget_empty, "VAULT")
        return true
    }
}
