package com.moath.thevault

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

/**
 * Health Connect opens this screen when the user taps the privacy link inside
 * the permission dialog. It must explain why the app reads each data type.
 * Keep this text in sync with the privacy policy you publish on Google Play.
 */
class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = TextView(this).apply {
            setPadding(56, 72, 56, 56)
            textSize = 16f
            text = buildString {
                append("THE VAULT — Health data\n\n")
                append("THE VAULT reads the following from Health Connect only to show your ")
                append("fitness stats inside the app:\n\n")
                append("• Steps\n• Heart rate\n• Blood oxygen (SpO₂)\n• Sleep\n\n")
                append("This data stays on your device and is never uploaded or shared with anyone. ")
                append("You can revoke access at any time from the Health Connect settings.")
            }
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
