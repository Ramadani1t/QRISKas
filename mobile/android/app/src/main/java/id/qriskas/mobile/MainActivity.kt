package id.qriskas.mobile

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.KeyEvent
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import id.qriskas.mobile.databinding.ActivityMainBinding
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

    // URI foto yang diambil dari kamera native
    private var cameraPhotoUri: Uri? = null

    companion object {
        private const val REQUEST_FILE_CHOOSER = 2001
        private const val REQUEST_NATIVE_CAMERA = 2002
        private const val REQUEST_PERMISSIONS = 1003
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

        setupWebView()
        requestAllPermissionsIfNeeded()
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
            // Hardware acceleration untuk kamera WebRTC
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        // Inject JS bridge
        webView.addJavascriptInterface(WebAppInterface(this), "QriskasAndroid")

        // WebViewClient: handle navigation & errors
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return when {
                    // URL yang boleh dibuka di dalam WebView
                    url.startsWith(APP_URL) -> false
                    url.startsWith("https://scan.tahunyakrispiya.my.id") -> false
                    // WhatsApp deep link → buka di app
                    url.startsWith("whatsapp://") || url.startsWith("https://api.whatsapp.com") -> {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "WhatsApp tidak terinstall", Toast.LENGTH_SHORT).show()
                        }
                        true
                    }
                    // Link eksternal lain → buka di browser
                    url.startsWith("http://") || url.startsWith("https://") -> {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                // Inject helper JS agar web tahu ini Android WebView
                injectAndroidHelperJs()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    // Tampilkan halaman offline sederhana
                    val offlinePage = buildOfflinePage()
                    view.loadDataWithBaseURL(null, offlinePage, "text/html", "UTF-8", null)
                }
            }
        }

        // WebChromeClient: handle kamera permission & file chooser
        webView.webChromeClient = object : WebChromeClient() {

            // Grant permission kamera/mikrofon ke WebView secara otomatis
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (CameraPermissionHelper.hasCameraPermission(this@MainActivity)) {
                        request.grant(request.resources)
                    } else {
                        CameraPermissionHelper.requestCameraPermission(this@MainActivity)
                        // Grant setelah permission diberikan — akan trigger ulang
                        request.grant(request.resources)
                    }
                }
            }

            // Handle <input type="file"> dari WebView (galeri / kamera)
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                // Batalkan callback lama jika ada
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                // Intent untuk galeri
                val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                }

                // Intent untuk kamera belakang (Camera2 via MediaStore)
                val cameraIntent = createCameraIntent()

                // Chooser gabungan: galeri + kamera
                val chooserIntent = Intent.createChooser(galleryIntent, "Pilih Foto atau Ambil Kamera")
                if (cameraIntent != null) {
                    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                }

                startActivityForResult(chooserIntent, REQUEST_FILE_CHOOSER)
                return true
            }

            override fun onProgressChanged(view: WebView, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
            }
        }

        webView.loadUrl(APP_URL)
    }

    /**
     * Buat Camera Intent yang langsung membuka kamera BELAKANG via Camera2.
     * Ini adalah hardware-level access — tidak lewat WebView getUserMedia.
     */
    private fun createCameraIntent(): Intent? {
        return try {
            val photoFile = createTempImageFile()
            val photoUri = FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                photoFile
            )
            cameraPhotoUri = photoUri

            Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                // Paksa kamera belakang via Bundle (hardware-level)
                putExtra("android.intent.extra.USE_FRONT_CAMERA", false)
                putExtra("android.intent.extra.CAMERA_FACING", 0) // 0 = belakang
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Buat file sementara untuk menyimpan foto dari kamera.
     */
    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: cacheDir
        return File.createTempFile("QRISKAS_${timeStamp}_", ".jpg", storageDir)
    }

    /**
     * Dipanggil dari WebAppInterface (JS Bridge) untuk launch kamera native langsung.
     * Ini yang "hardware-level" via Android Camera Intent.
     */
    fun launchNativeCamera() {
        if (!CameraPermissionHelper.hasCameraPermission(this)) {
            CameraPermissionHelper.requestCameraPermission(this)
            return
        }
        val intent = createCameraIntent() ?: run {
            Toast.makeText(this, "Tidak dapat membuka kamera", Toast.LENGTH_SHORT).show()
            return
        }
        startActivityForResult(intent, REQUEST_NATIVE_CAMERA)
    }

    /**
     * Handle hasil dari file chooser atau kamera native.
     */
    @Deprecated("Deprecated but needed for pre-API 30")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        when (requestCode) {
            REQUEST_FILE_CHOOSER -> {
                val result = if (resultCode == Activity.RESULT_OK) {
                    when {
                        // User pilih dari galeri
                        data?.data != null -> arrayOf(data.data!!)
                        // User ambil foto dari kamera (tersimpan di cameraPhotoUri)
                        cameraPhotoUri != null -> arrayOf(cameraPhotoUri!!)
                        else -> null
                    }
                } else null

                fileChooserCallback?.onReceiveValue(result)
                fileChooserCallback = null
            }

            REQUEST_NATIVE_CAMERA -> {
                if (resultCode == Activity.RESULT_OK && cameraPhotoUri != null) {
                    // Kirim URI foto ke WebView via JS
                    val uriString = cameraPhotoUri.toString()
                    val js = """
                        (function() {
                            if (window._qriskasNativeCameraCallback) {
                                window._qriskasNativeCameraCallback('$uriString');
                            } else {
                                // Fallback: inject ke native cam input jika ada
                                var input = document.getElementById('nativeCamInput');
                                if (input) {
                                    // Simulasi file input change
                                    window._androidCameraUri = '$uriString';
                                    input.dispatchEvent(new Event('androidcamera', {bubbles: true}));
                                }
                            }
                        })();
                    """.trimIndent()
                    webView.evaluateJavascript(js, null)
                } else {
                    cameraPhotoUri = null
                }
            }
        }
    }

    /**
     * Inject JavaScript helper ke halaman web agar app bisa mendeteksi
     * bahwa ini berjalan di Android WebView dan menggunakan bridge.
     */
    private fun injectAndroidHelperJs() {
        val js = """
            (function() {
                // Tandai bahwa ini Android WebView
                window.__isAndroidApp = true;
                
                // Override fungsi share WhatsApp jika ada
                if (window.QriskasAndroid) {
                    console.log('[QRISKAS Mobile] Android bridge aktif, versi Android: ' + 
                        window.QriskasAndroid.getAndroidVersion());
                }
                
                // Handle tombol "Buka Kamera Foto HP" agar gunakan kamera native Android
                var nativeCamBtn = document.getElementById('nativeCamBtn');
                var nativeCamInput = document.getElementById('nativeCamInput');
                if (nativeCamBtn && nativeCamInput) {
                    nativeCamInput.setAttribute('capture', 'environment');
                }
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    /**
     * Halaman offline sederhana jika tidak ada koneksi.
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

    private fun requestAllPermissionsIfNeeded() {
        val needsCamera = !CameraPermissionHelper.hasCameraPermission(this)
        val needsStorage = !CameraPermissionHelper.hasStoragePermission(this)
        if (needsCamera || needsStorage) {
            CameraPermissionHelper.requestAllPermissions(this)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            CameraPermissionHelper.REQUEST_CODE_ALL,
            CameraPermissionHelper.REQUEST_CODE_CAMERA -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // Permission granted — WebView sudah bisa akses kamera
                    // Reload hanya jika di halaman utama
                    webView.evaluateJavascript(
                        "console.log('[QRISKAS] Camera permission granted');",
                        null
                    )
                }
            }
        }
    }

    // Handle tombol back: navigasi di dalam WebView
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
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
