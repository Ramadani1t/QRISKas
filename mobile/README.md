# 📱 QRISKas Mobile — Android App

Aplikasi kasir mobile native untuk **QRISKas (Tahunya Krispiya)** yang dioptimalkan untuk ukuran file sangat ringan, waktu cold-start di bawah 1 detik (**sat-set**), akses langsung ke **hardware kamera belakang** untuk jepret bukti QRIS secara instan dengan resolusi penuh (Full HD), serta **dukungan penuh transaksi offline dengan auto-sinkronisasi saat online**.

---

## 📥 Download APK

| Versi | Link Download | Min Android |
|-------|--------------|-------------|
| Latest | [**Download di GitHub Releases**](https://github.com/Ramadani1t/QRISKas/releases/latest) | Android 8.0+ (Oreo) |

> **Cara Install**: Unduh file `.apk` → Buka file → Izinkan "Install dari sumber tidak dikenal" jika diminta → Selesai!

---

## 🚀 Fitur Utama & Arsitektur Sistem

### 1. Hardware Kamera Belakang Langsung (Level Hardware)
- **Kamera Belakang Fisik Terkunci**: Menggunakan Bundle Extras level hardware untuk memastikan kamera belakang selalu aktif (bukan kamera selfie).
- **FileProvider Full-HD Capture**: Foto jepretan kamera disimpan via `FileProvider` dan dikompresi ke resolusi tinggi (1600px, JPEG 85%) dengan auto-orientasi EXIF.
- **Live In-App Viewfinder**: Layar scanner kamera langsung di dalam aplikasi dengan izin kamera otomatis.

### 2. Offline-First Caching & Auto-Sync
- **Service Worker & WebView Cache**: Aset web dicache secara lokal, sehingga aplikasi tetap bisa digunakan saat koneksi internet terputus.
- **Offline Queue**: Transaksi disimpan di memori lokal HP saat offline.
- **Auto-Sync Otomatis**: Begitu online, transaksi otomatis dikirim ke server.

### 3. Performa Sat-Set & Haptic Feedback
- Hardware acceleration WebView aktif.
- Respon getar haptic native saat foto struk berhasil diproses.
- Smart Back Button: Tutup modal/dialog dulu sebelum keluar aplikasi.

### 4. Fitur Transaksi Lengkap
- **Mode Surplus**: Catat kelebihan uang kas
- **Tukar QRIS ke Cash**: Potong laci kasir (tidak masuk omset)
- **Label Revisi / Susulan**: Tandai transaksi koreksi agar bos bisa verifikasi mutasi bank

---

## 🛠️ Cara Build (Developer)

### Prasyarat
- **Android Studio** (Hedgehog / Iguana / Jellyfish / Ladybug atau versi terbaru)
- Android SDK Platform 34 & Build-Tools 34.0.0
- JDK 17

### Buka Proyek di Android Studio
1. Buka **Android Studio**
2. Pilih **File** → **Open...**
3. Arahkan ke folder `mobile/android`
4. Tunggu **Gradle Sync** selesai

### Menjalankan di HP Android
1. Sambungkan HP Android via USB (pastikan *USB Debugging* aktif)
2. Pilih perangkat HP di toolbar atas
3. Klik tombol **Run 'app'** (`Shift + F10`)

### Build APK Rilis via Terminal
```bash
cd mobile/android
./gradlew assembleRelease
```
File APK rilis → `mobile/android/app/build/outputs/apk/release/`

### Build APK via GitHub Actions CI
Setiap push ke `main` (path `mobile/android/**`), workflow CI otomatis mengompilasi APK.

### Membuat Release di GitHub
```bash
# Buat tag versi dan push
git tag v1.0.0
git push origin v1.0.0
```
Workflow `release-android.yml` akan otomatis:
1. Build APK rilis
2. Membuat **GitHub Release** dengan APK siap download

---

## 🍎 iOS Support?

Saat ini **QRISKas Mobile hanya tersedia untuk Android**. Namun, versi web (PWA) di [scan.tahunyakrispiya.my.id](https://scan.tahunyakrispiya.my.id) sudah bisa dipakai di Safari iOS dan bisa di-"Add to Home Screen" sebagai shortcut layaknya aplikasi native.

> Untuk build iOS native diperlukan:
> - Mac dengan macOS + Xcode (tidak bisa build di Windows/Linux)
> - Apple Developer Account ($99/tahun)
> - Signing Certificate & Provisioning Profile
>
> Jika diperlukan di masa depan, bisa dipertimbangkan menggunakan framework cross-platform seperti **Kotlin Multiplatform** atau **React Native**.

---

## 📄 Lisensi
Hak Cipta © 2026 **Tahunya Krispiya**. Seluruh hak cipta dilindungi undang-undang.
