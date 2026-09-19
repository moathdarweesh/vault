package com.moath.thevault

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The one door between the WebView and the home-screen widget.
 *
 * ⚠️ A WIDGET CANNOT READ THE WEBVIEW'S localStorage. It is native code in the
 * same package but a different process surface, and the WebView keeps its
 * storage in a LevelDB the platform does not expose. Everything else in this
 * app lives in that localStorage, so the widget is handed a small JSON snapshot
 * here instead — written on every save by DB.widget.push() in js/storage.js.
 *
 * ⚠️ AND IT IS DELIBERATELY NOT @capacitor/preferences. That plugin would do the
 * job, but it owns the SharedPreferences file name and could change it; the
 * widget reads that exact file, so a rename upstream would silently stop the
 * widget updating with nothing to see. Thirty lines here own the name instead,
 * and add no npm dependency to a project whose first law is that it has none.
 *
 * The snapshot carries numbers and the plan slot's own name — never a photo, a
 * session token or a log. See DB.widget.snapshot() for what may be in it and
 * why the list is short: this file survives the app being closed and is drawn
 * on the least private surface the phone has.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    companion object {
        /** Must match VAULT_KEYS.widget in js/cloud.js — contract 40 proves it does. */
        const val PREFS = "vault_widget_v1"
        const val KEY = "snapshot"

        /** The snapshot, or null when the app has never written one. */
        fun read(context: Context): String? =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
    }

    /**
     * Store the snapshot and repaint every placed widget.
     *
     * The repaint is not optional. Without it a widget keeps whatever it drew
     * last until Android's own update period comes round — up to half an hour —
     * so logging a set would leave the home screen stating the old number for
     * long enough to be read as wrong rather than as stale.
     */
    @PluginMethod
    fun set(call: PluginCall) {
        val json = call.getString("value")
        if (json == null) {
            call.reject("value is required")
            return
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, json).apply()
        repaint()
        call.resolve()
    }

    /**
     * ⚠️ CALLED ON LOGOUT, AND IT IS NOT HOUSEKEEPING. This file outlives the
     * WebView, so without it the next account on a shared phone finds the
     * previous user's weight and calories drawn on the HOME SCREEN.
     */
    @PluginMethod
    fun clear(call: PluginCall) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(KEY).apply()
        repaint()
        call.resolve()
    }

    /** What the app can see of the bridge, so the web side never has to guess. */
    @PluginMethod
    fun status(call: PluginCall) {
        val manager = AppWidgetManager.getInstance(context)
        val placed = manager.getAppWidgetIds(ComponentName(context, VaultWidgetProvider::class.java)).size
        val result = JSObject()
        result.put("available", true)
        result.put("placed", placed)
        result.put("hasSnapshot", read(context) != null)
        call.resolve(result)
    }

    private fun repaint() {
        try {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, VaultWidgetProvider::class.java))
            if (ids.isNotEmpty()) VaultWidgetProvider.render(context, manager, ids)
        } catch (_: Throwable) {
            // A widget that fails to repaint must never take a save down with it.
        }
    }
}
