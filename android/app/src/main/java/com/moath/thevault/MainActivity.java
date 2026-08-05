package com.moath.thevault;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must register before super.onCreate so the bridge knows the plugin.
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
        applyLegacyBarColors();
    }

    /**
     * DO NOT re-add a window-insets listener here. CAPACITOR ALREADY OWNS INSETS.
     *
     * `com.getcapacitor.plugin.SystemBars` is a CORE plugin registered
     * unconditionally (Bridge.java:658), and it installs its own
     * OnApplyWindowInsetsListener on `getWebView().getParent()`. Its
     * `insetsHandling` defaults to "css" (SystemBars.java:58) and
     * capacitor.config.json declares no override, so the framework's contract is
     * that the WEB layer owns layout through env(safe-area-inset-*) — which
     * styles.css already does at 16 call sites, and index.html:10 already sets
     * viewport-fit=cover.
     *
     * v257 added a listener here anyway, on android.R.id.content — the PARENT of
     * the view Capacitor listens on. Two different views, so it did not replace
     * Capacitor's, it STACKED on it, and every inset was paid twice: a
     * status-bar's height of native padding plus `.main { padding-top:
     * var(--safe-t) }` on top. That is the "you made the status bar strip a bit
     * big" report.
     *
     * Padding the WebView is the wrong shape here regardless: `.bottom-nav`
     * deliberately EXTENDS its own surface into the gesture area
     * (`height: calc(var(--nav-h) + var(--safe-b))`, styles.css:585). Native
     * padding lifts the whole WebView instead and leaves a dead strip below the
     * bar — which is exactly what a well-built app does not look like.
     *
     * ICON APPEARANCE IS NOT SET HERE EITHER, and must not be. v257 called
     * setAppearanceLightStatusBars() synchronously in onCreate; that is dead
     * code. SystemBars.initSystemBars() runs during super.onCreate and posts its
     * setStyle() through Bridge.executeOnMainThread, which is
     * `new Handler(getMainLooper()).post(...)` — it ALWAYS posts, never runs
     * inline. So Capacitor's call lands after onCreate returns and overwrites
     * anything set here.
     *
     * The appearance is owned in two places instead:
     *   · capacitor.config.json -> plugins.SystemBars.style, the cold-start default
     *   · applyTheme() in js/app.js, which follows VAULT's OWN theme.
     * That second one is the real fix for the original bug: Capacitor's DEFAULT
     * style resolves from the OS NIGHT MODE (SystemBars.getStyleForTheme reads
     * UI_MODE_NIGHT_MASK), and this project has no values-night, so a phone in
     * system-light mode painted DARK icons over VAULT's #000000 page. The status
     * bar was never hidden — it was camouflaged.
     */
    private void applyLegacyBarColors() {
        // Android 14 and below ONLY. From Android 15 (targetSdk is 36)
        // edge-to-edge is enforced, the bars are forced transparent, and both
        // setters are deprecated no-ops — so on the versions this file exists
        // for, these do nothing at all. Below 15 the window still fits system
        // windows and these paint a real bar: black, to match --bg (#000000).
        //
        // Known residual, accepted: on Android <= 14 with VAULT in LIGHT theme
        // this is a black bar under dark icons. Neither SystemBars (no
        // background-colour API) nor MainActivity can fix that without adding
        // @capacitor/status-bar, and no new dependency is worth it for a case
        // the enforced-edge-to-edge bug never touches.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            getWindow().setStatusBarColor(Color.BLACK);
            getWindow().setNavigationBarColor(Color.BLACK);
        }
    }
}
