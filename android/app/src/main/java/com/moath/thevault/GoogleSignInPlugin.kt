package com.moath.thevault

import android.util.Base64
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.NoCredentialException
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * «متابعة بحساب Google» in the Android shell: Credential Manager → a Google ID
 * token → js/cloud.js hands it to supabase.auth.signInWithIdToken.
 *
 * ⚠️ WHY NOT THE WEB REDIRECT. Google refuses the OAuth authorization request
 * inside an embedded WebView, and Capacitor would throw the navigation out to
 * Chrome — the session would land in a browser this app cannot read. The legacy
 * GoogleSignInClient is not an option either: play-services-auth 22.0.0
 * (2026-08-26) REMOVED it. Credential Manager is the only native door left.
 *
 * ⚠️ THE NONCE HAS TWO FORMS, AND EACH GOES TO ONE PLACE.
 *   · Google gets the SHA-256 of the raw nonce as LOWERCASE HEX, and bakes that
 *     string into the token's `nonce` claim.
 *   · JS gets the RAW nonce, and passes it to Supabase, which hashes it itself —
 *     GoTrue's token_oidc.go: hash := fmt.Sprintf("%x", sha256.Sum256(raw)) and
 *     compares it to the claim ("Nonces mismatch" on a miss). `%x` is lowercase
 *     hex with no separators, which is exactly what sha256Hex() below renders.
 *   Handing Supabase the hash would hash it twice; handing Google the raw value
 *   would make the claim a raw value Supabase can never reproduce.
 *
 * ⚠️ THE CLIENT ID IS THE WEB CLIENT's, NOT THE ANDROID CLIENT's. It becomes the
 * token's `aud`, and Supabase accepts only the audiences configured under
 * Authentication → Providers → Google → Client IDs ("Unacceptable audience in
 * id_token" otherwise). The ANDROID client (package com.moath.thevault + the
 * signing SHA-1) is never named in code: Google matches it by the calling app's
 * package and certificate. It is PUBLIC — the secret lives only in the Supabase
 * dashboard — and it is read from capacitor.config.json →
 * plugins.GoogleSignIn.webClientId, which ships EMPTY until the owner fills it.
 * Empty means signIn() rejects with code "not_configured" and status() says
 * configured:false, so the web side never draws the button; never a crash.
 *
 * Every rejection carries a stable CODE, and JS maps by err.code, never by the
 * message text. The ID token is never logged.
 */
@CapacitorPlugin(name = "GoogleSignIn")
class GoogleSignInPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private fun webClientId(): String =
        (config.getString("webClientId", "") ?: "").trim()

    private fun isWebClientId(id: String): Boolean =
        id.endsWith(".apps.googleusercontent.com") && id.length > ".apps.googleusercontent.com".length

    /**
     * What the web side may draw. `available` proves this build carries the
     * plugin at all (build 24 does not, and has no Capacitor.Plugins.GoogleSignIn);
     * `configured` says the owner has put a web client ID in the config.
     */
    @PluginMethod
    fun status(call: PluginCall) {
        val result = JSObject()
        result.put("available", true)
        result.put("configured", isWebClientId(webClientId()))
        call.resolve(result)
    }

    /**
     * Opens Google's account sheet and resolves { idToken, nonce, email }.
     * `nonce` is the RAW value (see the class comment); `email` is the Google
     * account's address, which JS uses to warn before signing a phone that holds
     * another account's data into a different one.
     */
    @PluginMethod
    fun signIn(call: PluginCall) {
        val clientId = webClientId()
        if (!isWebClientId(clientId)) {
            call.reject("No Google web client ID is configured (capacitor.config.json plugins.GoogleSignIn.webClientId)", "not_configured")
            return
        }
        val act = activity
        if (act == null) {
            call.reject("No activity to show the Google account sheet from", "unexpected")
            return
        }
        val rawNonce = randomNonce()
        val option = GetSignInWithGoogleOption.Builder(clientId)
            .setNonce(sha256Hex(rawNonce))
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()

        scope.launch {
            try {
                val result = CredentialManager.create(act).getCredential(act, request)
                val cred = result.credential
                if (cred is CustomCredential && cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    val google = GoogleIdTokenCredential.createFrom(cred.data)
                    val ret = JSObject()
                    ret.put("idToken", google.idToken)
                    ret.put("nonce", rawNonce)
                    ret.put("email", google.id)
                    call.resolve(ret)
                } else {
                    call.reject("Google returned a credential of an unexpected type", "unexpected")
                }
            } catch (e: GetCredentialCancellationException) {
                // The person closed the sheet. JS says nothing.
                call.reject("cancelled", "cancelled")
            } catch (e: NoCredentialException) {
                call.reject("No Google account is available on this device", "no_credential")
            } catch (e: GetCredentialProviderConfigurationException) {
                call.reject("Google Play services are missing or out of date", "no_play_services")
            } catch (e: GoogleIdTokenParsingException) {
                call.reject("Google returned a token that could not be read", "bad_token")
            } catch (e: GetCredentialException) {
                call.reject(e.message ?: "Google sign-in failed", "unexpected")
            } catch (e: Exception) {
                call.reject(e.message ?: "Google sign-in failed", "unexpected")
            }
        }
    }

    /** 32 random bytes, base64url without padding — the shape Google's own sample uses. */
    private fun randomNonce(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
    }

    /** Lowercase hex SHA-256 of the UTF-8 bytes: Go's fmt.Sprintf("%x", sha256.Sum256(...)). */
    private fun sha256Hex(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
