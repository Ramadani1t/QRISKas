# 📌 Panduan Penomoran Versi & Rilis (Versioning Guide) — QRISKas Mobile

Dokumen ini adalah standar operasional untuk manajemen versi aplikasi **QRISKas Mobile** (Android) dan web service.

---

## ⚠️ Aturan Utama (Golden Rule untuk Pengembang & AI Assistant)

> [!IMPORTANT]
> **SETIAP KALI SELESAI MELAKUKAN PERUBAHAN ATAU FITUR BARU**, asisten atau developer **WAJIB BERTANYA** kepada pemilik proyek:
> 
> *"Apakah perubahan ini ingin dinaikkan versinya (version bump)? Contoh: dari `v1.1.0` ke `v1.2.0`?"*

Hal ini penting agar kasir toko yang memasang file APK Android di HP selalu menerima notifikasi pembaruan otomatis tanpa harus mengecek secara manual.

---

## 🏷️ Skema Versi: Semantic Versioning (SemVer)

Format penomoran: **`vMAJOR.MINOR.PATCH`** (contoh: `v1.2.0`)

| Tipe Versi | Kapan Digunakan? | Contoh |
| :--- | :--- | :--- |
| **PATCH** (`+0.0.1`) | Perbaikan bug, typo, penyesuaian CSS/tampilan kecil, atau optimasi internal tanpa menambah fitur baru. | `v1.1.0` ➔ `v1.1.1` |
| **MINOR** (`+0.1.0`) | Penambahan fitur baru yang kompatibel (misal: fitur Auto-Update, Label Revisi, Mode Tukar Cash). | `v1.1.0` ➔ `v1.2.0` |
| **MAJOR** (`+1.0.0`) | Perombakan arsitektur besar, perubahan alur otentikasi/database yang memutus kompatibilitas lama. | `v1.x.x` ➔ `v2.0.0` |

---

## 📝 Langkah-Langkah Melakukan Version Bump

Ketika disetujui untuk menaikkan versi (misal dari `v1.1.0` ke `v1.2.0`), ikuti 3 langkah berikut:

### 1. Update file [`mobile/android/app/build.gradle.kts`](file:///c:/ocr%20gas/mobile/android/app/build.gradle.kts)
Ubah `versionCode` (wajib naik +1) dan `versionName`:
```kotlin
defaultConfig {
    applicationId = "id.qriskas.mobile"
    minSdk = 26
    targetSdk = 33
    versionCode = 2          // Naikkan 1 angka integer
    versionName = "1.2.0"    // Sesuaikan dengan nomor tag
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
}
```

### 2. Commit & Push Perubahan
```bash
git add -A
git commit -m "feat: release v1.2.0 with auto-update method"
git push origin main
```

### 3. Buat dan Push Git Tag untuk Memicu Rilis APK Otomatis
```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Action [`.github/workflows/release-android.yml`](file:///c:/ocr%20gas/.github/workflows/release-android.yml) akan otomatis:
1. Menjalankan kompilasi Gradle (`./gradlew assembleRelease`).
2. Menghasilkan APK bertanda tangan release: `QRISKas-Mobile-v1.2.0.apk`.
3. Mengunggahnya ke halaman **GitHub Releases** repository `Ramadani1t/QRISKas`.

---

## 📡 Bagaimana Aplikasi Mobile Mendeteksi Pembaruan?

1. **Pemeriksaan Latar Belakang (Non-Intrusive)**:
   - Saat kasir membuka aplikasi di HP, [`UpdateManager.kt`](file:///c:/ocr%20gas/mobile/android/app/src/main/java/id/qriskas/mobile/UpdateManager.kt) otomatis memanggil API publik GitHub:
     `https://api.github.com/repos/Ramadani1t/QRISKas/releases/latest`
   - Membandingkan `versionName` terpasang dengan tag rilis terbaru.
2. **Tidak Mengganggu Kasir**:
   - **TIDAK ADA** popup mendadak yang memblokir layar scanner saat kasir sedang sibuk memotret struk pembayaran.
   - Sinyal pembaruan berupa indikator titik kuning/emas halus pada tombol **Pengaturan** (ikon roda gigi).
3. **Verifikasi di Pengaturan**:
   - Saat kasir memiliki waktu luang dan membuka Pengaturan, kotak verifikasi pembaruan akan tampil dengan info:
     - Versi baru yang tersedia.
     - Catatan rilis (changelog).
     - Ukuran file APK (~850 KB).
     - Tombol **"Unduh & Pasang Update"** (langsung mengunduh dan memicu pemasangan APK).
4. **Khusus Mobile Saja**:
   - Logika ini hanya aktif jika dibuka melalui aplikasi Android (`window.__isAndroidApp` / `window.QriskasAndroid`). Pengunjung situs web di browser biasa tidak akan melihat kotak pembaruan ini.
