# 📱 QRISKAS Mobile — Android App (Hardware-Level Camera & Offline-First Sync)

Aplikasi kasir mobile native untuk **QRISKAS (Tahunya Krispi-ya!)** yang dioptimalkan untuk ukuran file sangat ringan, waktu cold-start di bawah 1 detik (**sat-set**), akses langsung ke **hardware kamera belakang** untuk jepret bukti QRIS secara instan dengan resolusi penuh (Full HD), serta **dukungan penuh transaksi offline dengan auto-sinkronisasi saat online**.

---

## 🚀 Fitur Utama & Arsitektur Sistem

1. **Hardware Kamera Belakang Langsung (Level Hardware)**:
   - **Kamera Belakang Fisik Terkunci**: Menggunakan Bundle Extras level hardware (`android.intent.extra.CAMERA_FACING = 0`, `android.intent.extra.USE_FRONT_CAMERA = false`, `LENS_FACING_FRONT = 0`) untuk memastikan kamera belakang selalu aktif (bukan kamera selfie).
   - **FileProvider Full-HD Capture**: Foto jepretan kamera pihak ketiga / kamera bawaan HP disimpan via `androidx.core.content.FileProvider` (`Pictures/` directory) dan dikompresi ke citra resolusi tinggi (1600px, JPEG 85%) dengan auto-orientasi EXIF, bukan thumbnail buram/mini.
   - **Live In-App Viewfinder (WebRTC / getUserMedia)**: Layar scanner kamera langsung di dalam aplikasi dengan izin kamera otomatis via `WebChromeClient.onPermissionRequest`.

2. **Offline-First Caching & Auto-Sync saat Online**:
   - **Service Worker & WebView Cache**: Aset web (`/`, `/style.css`, `/history.css`, `/app.js`) dicache secara lokal (`LOAD_CACHE_ELSE_NETWORK`), sehingga aplikasi tetap terbuka mulus tanpa layar putih/error saat koneksi internet terputus.
   - **Offline Queue**: Jika kasir mencatat transaksi/surplus saat offline, data tersimpan di memori lokal HP (`localStorage`).
   - **Auto-Sync Otomatis**: Begitu koneksi internet tersambung kembali, Android `ConnectivityManager` dan event `online` secara otomatis mengirim antrean transaksi ke backend `/api/receipts`.

3. **Performa Sat-Set & Haptic Feedback**:
   - Hardware acceleration WebView aktif (`android:hardwareAccelerated="true"` dan `setLayerType(View.LAYER_TYPE_HARDWARE, null)`).
   - Respon getar haptic native saat foto struk berhasil diproses (`window.QriskasAndroid.vibrate(100)`).
   - Smart Back Button: Tombol back fisik Android menutup modal kamera/dialog terlebih dahulu sebelum keluar aplikasi.

---

## 🛠️ Langkah Menjalankan di Android Studio

### 1. Prasyarat:
- **Android Studio** (Hedgehog / Iguana / Jellyfish / Ladybug atau versi terbaru).
- Android SDK Platform 34 & Build-Tools 34.0.0.
- JDK 17.

### 2. Buka Proyek di Android Studio:
1. Buka aplikasi **Android Studio**.
2. Pilih menu **File** $\to$ **Open...**
3. Arahkan dan pilih folder:
   ```
   c:\ocr gas\mobile\android
   ```
4. Tunggu proses **Gradle Sync** selesai mengunduh dependensi dan mengindeks proyek.

### 3. Menjalankan di HP Android:
1. Sambungkan HP Android via kabel USB (pastikan *USB Debugging* aktif).
2. Di Android Studio, pilih perangkat HP Anda di toolbar atas.
3. Klik tombol hijau **Run 'app'** (`Shift + F10`).

---

## 📦 Cara Build File APK Rilis

### Cara 1: Lewat Terminal
```bash
cd c:\ocr gas\mobile\android
./gradlew assembleRelease
```
File APK rilis akan berada di folder:
`mobile/android/app/build/outputs/apk/release/`

### Cara 2: Lewat GitHub Actions CI Otomatis
Setiap kali ada push ke branch `main`, workflow `.github/workflows/build-android.yml` di repository `Ramadani1t/QRISKas` akan otomatis mengompilasi APK dan mengunggahnya ke tab **GitHub Actions Artifacts** dengan nama **`qriskas-mobile-apk`**.
