package id.qriskas.mobile

import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * JavaScript Bridge antara WebView dan Android native.
 * Dipanggil dari JavaScript via: window.QriskasAndroid.methodName()
 */
class WebAppInterface(private val activity: MainActivity) {

    /**
     * Dipanggil dari JS untuk meminta kamera native Android (level hardware).
     * Contoh: window.QriskasAndroid.openHardwareCamera()
     */
    @JavascriptInterface
    fun openHardwareCamera() {
        activity.runOnUiThread {
            activity.launchNativeCamera()
        }
    }

    /**
     * Alias openNativeCamera untuk kompatibilitas.
     */
    @JavascriptInterface
    fun openNativeCamera() {
        activity.runOnUiThread {
            activity.launchNativeCamera()
        }
    }

    /**
     * Haptic feedback getar native saat scan berhasil.
     */
    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        activity.runOnUiThread {
            try {
                val vibrator = activity.getSystemService(android.content.Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        vibrator.vibrate(
                            android.os.VibrationEffect.createOneShot(
                                durationMs,
                                android.os.VibrationEffect.DEFAULT_AMPLITUDE
                            )
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(durationMs)
                    }
                }
            } catch (_: Exception) {}
        }
    }

    /**
     * Cek status koneksi jaringan saat ini dari sisi native Android.
     */
    @JavascriptInterface
    fun isNetworkAvailable(): Boolean {
        return activity.isNetworkAvailable()
    }

    /**
     * Dipanggil dari JS untuk share teks ke WhatsApp.
     * Contoh: window.QriskasAndroid.shareWhatsApp("Rekap hari ini: Rp 100.000")
     */
    @JavascriptInterface
    fun shareWhatsApp(text: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    setPackage("com.whatsapp")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                // WhatsApp tidak terinstall, fallback ke share biasa
                val fallback = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                activity.startActivity(Intent.createChooser(fallback, "Bagikan via"))
            }
        }
    }

    /**
     * Dipanggil dari JS untuk cek versi Android.
     * Contoh: window.QriskasAndroid.getAndroidVersion()
     */
    @JavascriptInterface
    fun getAndroidVersion(): String {
        return android.os.Build.VERSION.SDK_INT.toString()
    }

    /**
     * Dipanggil dari JS untuk buka URL di browser external.
     */
    @JavascriptInterface
    fun openExternalUrl(url: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                activity.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(activity, "Tidak dapat membuka URL", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Toast native Android.
     */
    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Alias toast untuk kompatibilitas dengan DStock pos.html
     */
    @JavascriptInterface
    fun toast(message: String) {
        showToast(message)
    }

    /**
     * Overload vibrate dengan Int
     */
    @JavascriptInterface
    fun vibrate(durationMs: Int) {
        vibrate(durationMs.toLong())
    }

    /**
     * Info bahwa ini adalah Android WebView (bukan browser biasa).
     * JS bisa cek: if (window.QriskasAndroid) { ... }
     */
    @JavascriptInterface
    fun isAndroidApp(): Boolean = true
}
