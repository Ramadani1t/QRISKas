package id.qriskas.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import id.qriskas.mobile.databinding.ActivityMainBinding
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView

    // URL backend QRISKAS (Cloudflare Worker)
    private val APP_URL = "https://scan.tahunyakrispiya.my.id"

    // File chooser callback dari WebView (untuk input type=file)
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    // Launchers untuk Activity Result (Modern Android API)
    private lateinit var hardwareCameraLauncher: ActivityResultLauncher<Intent>
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>

    // URI & File foto yang diambil dari kamera native
    private var cameraPhotoUri: Uri? = null
    private var cameraPhotoFile: File? = null

    private var pendingCameraLaunch = false

    companion object {
        private const val TAG = "QRISKASMobile"
        private const val PERMISSION_REQ_CAMERA = 1001
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge (immersive)
        window.statusBarColor = 0x0a0903.or(0xFF000000.toInt())
        window.navigationBarColor = 0x0a0903.or(0xFF000000.toInt())

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        webView = binding.webView

        setupLaunchers()
        setupWebView()
        setupBackPressHandler()
        registerNetworkMonitoring()
        requestHardwareCameraPermissionAtStartup()
    }

    private fun requestHardwareCameraPermissionAtStartup() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                PERMISSION_REQ_CAMERA
            )
        }
    }

    private fun setupLaunchers() {
        // Launcher untuk Hardware Camera Langsung (Full-HD + Auto-Orient EXIF)
        hardwareCameraLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val photo = cameraPhotoFile
            if (result.resultCode == Activity.RESULT_OK && photo != null && photo.exists() && photo.length() > 0) {
                Thread {
                    val dataUrl = processPhotoFileToDataUrl(photo)
                    runOnUiThread {
                        if (dataUrl != null) {
                            val js = """
                                (function() {
                                    if (window.onHardwareCameraCapture) {
                                        window.onHardwareCameraCapture('$dataUrl');
                                    } else if (window._qriskasNativeCameraCallback) {
                                        window._qriskasNativeCameraCallback('$dataUrl');
                                    } else {
                                        var input = document.getElementById('nativeCamInput');
                                        if (input) {
                                            window._androidCameraDataUrl = '$dataUrl';
                                            input.dispatchEvent(new CustomEvent('androidcamera', {detail: {dataUrl: '$dataUrl'}, bubbles: true}));
                                        }
                                    }
                                })();
                            """.trimIndent()
                            webView.evaluateJavascript(js, null)
                        } else {
                            Toast.makeText(this@MainActivity, "Gagal memproses foto kamera", Toast.LENGTH_SHORT).show()
                        }
                    }
                }.start()
            } else {
                Log.d(TAG, "Hardware camera cancelled or empty file")
            }
        }

        // Launcher untuk Chooser file/galeri standard
        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (fileChooserCallback != null) {
                var results: Array<Uri>? = null
                if (result.resultCode == Activity.RESULT_OK) {
                    val data = result.data
                    val photo = cameraPhotoFile
                    if (data?.data != null) {
                        results = arrayOf(data.data!!)
                    } else if (cameraPhotoUri != null && photo != null && photo.exists() && photo.length() > 0) {
                        results = arrayOf(cameraPhotoUri!!)
                    }
                }
                fileChooserCallback?.onReceiveValue(results)
                fileChooserCallback = null
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = userAgentString + " QRISKAS-Android13/1.0 NativeHardwareCamera"

            // Offline-first caching mode
            cacheMode = if (isNetworkAvailable()) {
                WebSettings.LOAD_DEFAULT
            } else {
                WebSettings.LOAD_CACHE_ELSE_NETWORK
            }
        }

        // Akselerasi Grafis Hardware 60 FPS
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        // Inject JS bridge dengan kedua nama (kompatibel DStock & QRISKas)
        webView.addJavascriptInterface(WebAppInterface(this), "QriskasAndroid")
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        // WebViewClient: handle navigation & errors
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return when {
                    url.startsWith(APP_URL) -> false
                    url.startsWith("https://scan.tahunyakrispiya.my.id") -> false
                    url.startsWith("whatsapp://") || url.startsWith("https://api.whatsapp.com") -> {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {
                            Toast.makeText(this@MainActivity, "WhatsApp tidak terinstall", Toast.LENGTH_SHORT).show()
                        }
                        true
                    }
                    url.startsWith("intent:") -> {
                        try {
                            val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                            if (intent.resolveActivity(packageManager) != null) {
                                startActivity(intent)
                            } else {
                                val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                                if (!fallbackUrl.isNullOrEmpty()) {
                                    view.loadUrl(fallbackUrl)
                                } else {
                                    Toast.makeText(this@MainActivity, "Aplikasi kamera tidak ditemukan", Toast.LENGTH_SHORT).show()
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error handling intent scheme: $url", e)
                        }
                        true
                    }
                    url.startsWith("http://") || url.startsWith("https://") -> {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                injectAndroidHelperJs()
                // Cek update di background tanpa mengganggu kasir
                triggerUpdateCheck(isManual = false)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    if (!isNetworkAvailable()) {
                        try {
                            view.settings.cacheMode = WebSettings.LOAD_CACHE_ONLY
                            view.loadUrl(APP_URL)
                        } catch (_: Exception) {
                            view.loadDataWithBaseURL(null, buildOfflinePage(), "text/html", "UTF-8", null)
                        }
                    } else {
                        view.loadDataWithBaseURL(null, buildOfflinePage(), "text/html", "UTF-8", null)
                    }
                }
            }
        }

        // WebChromeClient: handle kamera permission & file chooser
        webView.webChromeClient = object : WebChromeClient() {

            // Otomatis grant izin kamera ke WebRTC / live camera viewfinder persis DStock
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }

            // Handle <input type="file"> dari WebView
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.fileChooserCallback?.onReceiveValue(null)
                this@MainActivity.fileChooserCallback = filePathCallback

                val cameraIntent = createCameraIntent()

                // Jika input meminta capture kamera secara langsung
                if (fileChooserParams.isCaptureEnabled && cameraIntent != null) {
                    fileChooserLauncher.launch(cameraIntent)
                    return true
                }

                val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }

                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, galleryIntent)
                    putExtra(Intent.EXTRA_TITLE, "Ambil Foto Struk QRIS atau Galeri")
                    if (cameraIntent != null) {
                        putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                    }
                }

                fileChooserLauncher.launch(chooserIntent)
                return true
            }
        }

        webView.loadUrl(APP_URL)
    }

    private fun setupBackPressHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){ if(window.handleAndroidBack && typeof window.handleAndroidBack === 'function'){ return window.handleAndroidBack(); } return false; })()"
                ) { value ->
                    if (value != "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            finish()
                        }
                    }
                }
            }
        })
    }

    /**
     * Buat Camera Intent yang mengunci KAMERA BELAKANG secara hardware-level via Bundle extras & ClipData.
     */
    fun createCameraIntent(): Intent? {
        return try {
            val photoFile = createTempImageFile()
            cameraPhotoFile = photoFile
            val photoUri = FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                photoFile
            )
            cameraPhotoUri = photoUri

            Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                clipData = ClipData.newUri(contentResolver, "photo", photoUri)
                // Kunci kamera belakang secara hardware-level
                putExtra("android.intent.extra.USE_FRONT_CAMERA", false)
                putExtra("android.intent.extra.CAMERA_FACING", 0) // 0 = Back, 1 = Front
                putExtra("android.intent.extras.CAMERA_FACING", 0)
                putExtra("android.intent.extras.LENS_FACING_FRONT", 0)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error creating camera intent", e)
            null
        }
    }

    /**
     * Buat file sementara untuk menyimpan foto HD dari kamera.
     */
    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: cacheDir
        if (!storageDir.exists()) {
            storageDir.mkdirs()
        }
        return File.createTempFile("QRISKAS_${timeStamp}_", ".jpg", storageDir)
    }

    /**
     * Proses foto FileProvider ke data URL Base64 berkualitas tinggi dengan auto-orient EXIF.
     */
    private fun processPhotoFileToDataUrl(photoFile: File?): String? {
        if (photoFile == null || !photoFile.exists() || photoFile.length() == 0L) return null
        return try {
            val boundsOptions = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeFile(photoFile.absolutePath, boundsOptions)

            val maxDim = 1600
            var inSampleSize = 1
            if (boundsOptions.outHeight > maxDim || boundsOptions.outWidth > maxDim) {
                val halfHeight = boundsOptions.outHeight / 2
                val halfWidth = boundsOptions.outWidth / 2
                while (halfHeight / inSampleSize >= maxDim && halfWidth / inSampleSize >= maxDim) {
                    inSampleSize *= 2
                }
            }

            val decodeOptions = BitmapFactory.Options().apply {
                this.inSampleSize = inSampleSize
                inPreferredConfig = Bitmap.Config.RGB_565
            }
            val bitmap = BitmapFactory.decodeFile(photoFile.absolutePath, decodeOptions) ?: return null

            val exif = ExifInterface(photoFile.absolutePath)
            val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
            }

            val rotatedBitmap = if (!matrix.isIdentity) {
                Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true).also {
                    if (it != bitmap) bitmap.recycle()
                }
            } else {
                bitmap
            }

            val outputStream = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
            rotatedBitmap.recycle()
            val byteArray = outputStream.toByteArray()
            val base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP)
            try { photoFile.delete() } catch (_: Exception) {}
            "data:image/jpeg;base64,$base64"
        } catch (e: Exception) {
            Log.e(TAG, "Error converting photo to data url", e)
            null
        }
    }

    /**
     * Dipanggil dari WebAppInterface (JS Bridge) untuk launch kamera native belakang langsung.
     */
    fun launchNativeCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendingCameraLaunch = true
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                PERMISSION_REQ_CAMERA
            )
            return
        }
        val intent = createCameraIntent()
        if (intent != null) {
            hardwareCameraLauncher.launch(intent)
        } else {
            Toast.makeText(this, "Tidak dapat membuka kamera hardware", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Dipanggil dari WebAppInterface untuk meluncurkan kamera package tertentu (misal Aperture) atau chooser.
     */
    fun launchCustomOrChooserCamera(packageName: String?) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendingCameraLaunch = true
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                PERMISSION_REQ_CAMERA
            )
            return
        }

        val intent = createCameraIntent()
        if (intent != null) {
            if (!packageName.isNullOrBlank() && packageName != "default" && packageName != "chooser") {
                try {
                    intent.setPackage(packageName)
                    if (intent.resolveActivity(packageManager) != null) {
                        hardwareCameraLauncher.launch(intent)
                        return
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to launch specific camera package: $packageName", e)
                }
            }
            val chooser = Intent.createChooser(intent, "Buka Kamera Foto Struk")
            hardwareCameraLauncher.launch(chooser)
        } else {
            Toast.makeText(this, "Tidak dapat membuka kamera", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Cek status koneksi jaringan dari sistem Android.
     */
    fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /**
     * Daftarkan listener konektivitas untuk memicu auto-sync saat jaringan pulih kembali.
     */
    private fun registerNetworkMonitoring() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    runOnUiThread {
                        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
                        webView.evaluateJavascript(
                            "(function(){ window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('qriskas:online')); if(window.syncOfflineReceipts){ window.syncOfflineReceipts(); } })()",
                            null
                        )
                    }
                }

                override fun onLost(network: Network) {
                    runOnUiThread {
                        webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                        webView.evaluateJavascript(
                            "(function(){ window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('qriskas:offline')); })()",
                            null
                        )
                    }
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "Network monitoring registration skipped", e)
        }
    }

    /**
     * Inject JavaScript helper ke halaman web agar web app mendeteksi Android bridge.
     */
    private fun injectAndroidHelperJs() {
        val js = """
            (function() {
                window.__isAndroidApp = true;
                
                if (window.QriskasAndroid || window.AndroidBridge) {
                    console.log('[QRISKAS Mobile] Android hardware camera bridge active');
                }
                
                var nativeCamInput = document.getElementById('nativeCamInput');
                if (nativeCamInput) {
                    nativeCamInput.setAttribute('capture', 'environment');
                }
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    /**
     * Cek update APK dari GitHub Releases dan kirim hasilnya ke WebApp via JavaScript.
     * Tidak menampilkan modal otomatis yang mengganggu proses kasir, melainkan
     * mengaktifkan indikator/verifikasi pada menu Pengaturan.
     */
    fun triggerUpdateCheck(isManual: Boolean) {
        UpdateManager.checkForUpdate(this) { isAvailable, info ->
            if (isAvailable && info != null) {
                val escapedBody = info.body.replace("\\", "\\\\")
                    .replace("`", "\\`")
                    .replace("$", "\\$")
                    .replace("\n", "\\n")
                    .replace("\r", "")
                val escapedName = info.releaseName.replace("'", "\\'")
                val js = """
                    (function() {
                        if (window.onAppUpdateDetected) {
                            window.onAppUpdateDetected({
                                available: true,
                                tagName: '${info.tagName}',
                                versionName: '${info.versionName}',
                                releaseName: '$escapedName',
                                apkUrl: '${info.apkUrl ?: ""}',
                                apkSize: ${info.apkSize},
                                body: `$escapedBody`,
                                isManual: $isManual
                            });
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            } else if (isManual) {
                val currentVer = UpdateManager.getCurrentVersionName(this)
                val js = """
                    (function() {
                        if (window.onAppUpdateDetected) {
                            window.onAppUpdateDetected({
                                available: false,
                                currentVersion: '$currentVer',
                                isManual: true
                            });
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            }
        }
    }

    /**
     * Halaman offline fallback jika cache belum tersedia.
     */
    private fun buildOfflinePage(): String {
        return """
            <!doctype html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>QRISKAS Mobile</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background: #0a0903;
                        color: #fffef5;
                        font-family: system-ui, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: 24px;
                        text-align: center;
                        gap: 16px;
                    }
                    .logo {
                        width: 72px; height: 72px;
                        background: linear-gradient(135deg, #ffe566, #ffd000);
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                        font-weight: 900;
                        color: #0d0b00;
                    }
                    h1 { color: #ffd000; font-size: 22px; }
                    p { color: #a89f82; font-size: 14px; max-width: 280px; }
                    button {
                        background: linear-gradient(135deg, #ffe566, #ffd000);
                        color: #0d0b00;
                        border: none;
                        border-radius: 14px;
                        padding: 14px 28px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        margin-top: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="logo">Q</div>
                <h1>QRISKAS Mobile</h1>
                <p>Tidak ada koneksi internet. Pastikan kamu terhubung ke WiFi atau data seluler.</p>
                <button onclick="location.reload()">🔄 Coba Lagi</button>
            </body>
            </html>
        """.trimIndent()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQ_CAMERA) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                webView.evaluateJavascript(
                    "console.log('[QRISKAS] Camera permission granted');",
                    null
                )
                if (pendingCameraLaunch) {
                    pendingCameraLaunch = false
                    val intent = createCameraIntent()
                    if (intent != null) {
                        hardwareCameraLauncher.launch(intent)
                    }
                } else {
                    webView.evaluateJavascript(
                        "(function(){ if(window.startCamera){ window.startCamera(); } else { location.reload(); } })()",
                        null
                    )
                }
            } else {
                Toast.makeText(this, "Izin kamera diperlukan untuk scan QRIS", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    override fun onDestroy() {
        webView.apply {
            stopLoading()
            loadUrl("about:blank")
            destroy()
        }
        super.onDestroy()
    }
}
