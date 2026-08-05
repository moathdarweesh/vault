package com.moath.thevault;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must register before super.onCreate so the bridge knows the plugin.
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
    }

    /**
     * Keep the app out from under the status bar.
     *
     * targetSdkVersion is 36, and from Android 15 edge-to-edge is ENFORCED — the
     * window is laid out behind the system bars whether the app asks for it or
     * not, and from Android 16 the opt-out flag is ignored entirely. So the app
     * was drawing underneath the clock, battery and signal icons.
     *
     * The CSS side already accounts for this: `.app` pads by
     * `env(safe-area-inset-top)`. But that only works if the WebView is actually
     * TOLD the inset, which is what this listener guarantees — it pads the
     * content view by the real system-bar insets, so the web layer starts below
     * the status bar regardless of what `env()` reports.
     *
     * No new dependency: androidx.core ships with Capacitor already, whereas the
     * usual fix (@capacitor/status-bar) would have been a new plugin.
     */
    private void applySystemBarInsets() {
        final View content = findViewById(android.R.id.content);
        if (content == null) return;

        // The strip behind each system bar shows the window background, so it has
        // to be the app's own black or it reads as a grey band above the page.
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        // LIGHT icons (white clock/battery). `false` means "do not use DARK
        // icons" — and the page underneath is #000000. Getting this backwards is
        // exactly how a status bar becomes invisible rather than merely
        // overlapped: black icons on a black page.
        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(getWindow(), content);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(content, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            // Returned UNCONSUMED on purpose: the keyboard (ime) inset still has
            // to reach the WebView, or `windowSoftInputMode=adjustResize` stops
            // lifting the focused field above the keyboard.
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(content);
    }
}
