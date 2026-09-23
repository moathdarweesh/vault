package com.moath.thevault;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must register before super.onCreate so the bridge knows the plugin.
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(GoogleSignInPlugin.class);
        super.onCreate(savedInstanceState);
        applyLegacyBarColors();
        pinTextZoom();
    }

    /**
     * NO ZOOM, the native half (owner decision, 2026-09-23: no zoom at all).
     *
     * Pinch and double-tap zoom were NEVER possible in this shell, so nothing
     * here touches them: Capacitor's `zoomEnabled` defaults to false
     * (CapConfig.java:287), Bridge.initWebView() therefore calls
     * settings.setBuiltInZoomControls(false) (Bridge.java:612), and Chromium's
     * AwSettings gates every gesture zoom on that flag
     * (supportsMultiTouchZoomLocked = mSupportZoom && mBuiltInZoomControls;
     * double-tap additionally needs mUseWideViewport, which Capacitor never sets).
     *
     * What CAN enlarge the app in this shell is TEXT ZOOM. AwSettings' constructor
     * reads the phone's Font size slider: "By default, scale the text size by the
     * system font scale factor. Embedders may override this by invoking
     * setTextZoom()", and updateFontScaleLocked() re-applies it on every context
     * change EXCEPT when the embedder has called setTextZoom(), which sets
     * mTextZoomSetByEmbedder and makes the re-apply return early. So this one
     * call pins text at 100% for the life of the WebView, whatever the phone's
     * accessibility font size says. Layout is in CSS px and never followed that
     * slider anyway, which is why a raised font scale reads as a broken zoom:
     * the text grows and the boxes do not. The accessible route is the in-app
     * larger-text setting (body.text-lg, v380), which scales the eleven type
     * tokens and is untouched by this.
     *
     * NATIVE: reaches a phone only with a NEW APK. Until then the web layer's
     * viewport meta already stops pinch in Chrome, and the WebView never pinched.
     */
    private void pinTextZoom() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;   // the no_webview fallback layout
        bridge.getWebView().getSettings().setTextZoom(100);
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
