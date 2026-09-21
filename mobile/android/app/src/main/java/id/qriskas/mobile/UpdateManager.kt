package id.qriskas.mobile

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class UpdateInfo(
    val tagName: String,
    val versionName: String,
    val releaseName: String,
    val body: String,
    val apkUrl: String?,
    val apkSize: Long,
    val htmlUrl: String
)

object UpdateManager {

    private const val TAG = "QRISKAS_Update"
    private const val GITHUB_LATEST_RELEASE_URL =
        "https://api.github.com/repos/Ramadani1t/QRISKas/releases/latest"

    /**
     * Ambil versi aplikasi saat ini dari PackageManager.
     */
    fun getCurrentVersionName(context: Context): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    /**
     * Cek ke GitHub Releases apakah ada versi baru yang lebih tinggi dari versi terpasang.
     * Dijalankan di background thread (non-blocking).
     */
    fun checkForUpdate(context: Context, callback: (isAvailable: Boolean, updateInfo: UpdateInfo?) -> Unit) {
        Thread {
            try {
                val url = URL(GITHUB_LATEST_RELEASE_URL)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.setRequestProperty("User-Agent", "QRISKasMobile/${getCurrentVersionName(context)}")
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json")

                val responseCode = conn.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val response = reader.readText()
                    reader.close()

                    val json = JSONObject(response)
                    val tagName = json.optString("tag_name", "")
                    val releaseName = json.optString("name", tagName)
                    val body = json.optString("body", "")
                    val htmlUrl = json.optString("html_url", "")

                    // Bersihkan prefix 'v' dari tag (misal v1.2.0 -> 1.2.0)
                    val latestVersion = tagName.removePrefix("v").trim()
                    val currentVersion = getCurrentVersionName(context).removePrefix("v").trim()

                    // Cari asset file APK
                    var apkUrl: String? = null
                    var apkSize: Long = 0
                    val assets = json.optJSONArray("assets")
                    if (assets != null) {
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            val name = asset.optString("name", "")
                            if (name.endsWith(".apk", ignoreCase = true)) {
                                apkUrl = asset.optString("browser_download_url")
                                apkSize = asset.optLong("size", 0)
                                break
                            }
                        }
                    }

                    val info = UpdateInfo(
                        tagName = tagName,
                        versionName = latestVersion,
                        releaseName = releaseName,
                        body = body,
                        apkUrl = apkUrl,
                        apkSize = apkSize,
                        htmlUrl = htmlUrl
                    )

                    val isNewer = isNewerVersion(latestVersion, currentVersion)
                    (context as? Activity)?.runOnUiThread {
                        callback(isNewer, info)
                    } ?: callback(isNewer, info)
                } else {
                    Log.w(TAG, "GitHub API response: $responseCode")
                    (context as? Activity)?.runOnUiThread {
                        callback(false, null)
                    } ?: callback(false, null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking update from GitHub", e)
                (context as? Activity)?.runOnUiThread {
                    callback(false, null)
                } ?: callback(false, null)
            }
        }.start()
    }

    /**
     * Perbandingan versi semver (misal: 1.2.0 lebih baru dari 1.1.0).
     */
    fun isNewerVersion(latest: String, current: String): Boolean {
        try {
            val latestParts = latest.split(".").map { it.filter { c -> c.isDigit() }.toIntOrNull() ?: 0 }
            val currentParts = current.split(".").map { it.filter { c -> c.isDigit() }.toIntOrNull() ?: 0 }

            val maxLen = maxOf(latestParts.size, currentParts.size)
            for (i in 0 until maxLen) {
                val l = latestParts.getOrElse(i) { 0 }
                val c = currentParts.getOrElse(i) { 0 }
                if (l > c) return true
                if (l < c) return false
            }
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to compare versions: $latest vs $current", e)
            return false
        }
    }

    /**
     * Unduh file APK via DownloadManager dengan notifikasi progress, lalu buka installer paket.
     */
    fun downloadAndInstall(activity: Activity, apkUrl: String, tagName: String = "latest") {
        try {
            val cleanUrl = apkUrl.ifBlank { GITHUB_LATEST_RELEASE_URL }
            val fileName = "QRISKas-Mobile-$tagName.apk"

            val downloadManager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            if (downloadManager == null) {
                // Fallback langsung buka link via browser
                openInBrowser(activity, cleanUrl)
                return
            }

            Toast.makeText(activity, "Mulai mengunduh update...", Toast.LENGTH_SHORT).show()

            val request = DownloadManager.Request(Uri.parse(cleanUrl)).apply {
                setTitle("Mengunduh QRISKas Mobile $tagName")
                setDescription("Memperbarui aplikasi kasir...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName)
                setMimeType("application/vnd.android.package-archive")
            }

            val downloadId = downloadManager.enqueue(request)

            // Daftarkan receiver untuk menangani saat unduhan selesai
            val onComplete = object : BroadcastReceiver() {
                override fun onReceive(ctxt: Context, intent: Intent) {
                    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id == downloadId) {
                        try {
                            activity.unregisterReceiver(this)
                        } catch (_: Exception) {}

                        installDownloadedApk(activity, fileName)
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.registerReceiver(
                    onComplete,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_NOT_EXPORTED
                )
            } else {
                activity.registerReceiver(
                    onComplete,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
                )
            }

        } catch (e: Exception) {
            Log.e(TAG, "DownloadManager failed, falling back to browser", e)
            openInBrowser(activity, apkUrl)
        }
    }

    /**
     * Pasang file APK yang sudah diunduh menggunakan FileProvider.
     */
    private fun installDownloadedApk(activity: Activity, fileName: String) {
        try {
            val downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            val file = File(downloadDir, fileName)

            if (file.exists() && file.length() > 0) {
                val apkUri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    file
                )

                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                activity.startActivity(installIntent)
            } else {
                Toast.makeText(activity, "File APK tidak ditemukan", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch package installer", e)
            Toast.makeText(activity, "Silakan buka unduhan untuk memasang APK", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * Buka link APK langsung di browser default pengguna.
     */
    fun openInBrowser(activity: Activity, url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            activity.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(activity, "Gagal membuka link unduhan", Toast.LENGTH_SHORT).show()
        }
    }
}
