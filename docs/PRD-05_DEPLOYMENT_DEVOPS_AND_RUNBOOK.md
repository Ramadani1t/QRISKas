# PRD 05: Panduan DevOps, Deployment & Operational Runbook

> 💡 **Penjelasan Singkat Bahasa Manusia**:  
> Dokumen ini menjelaskan cara menyalakan, mempublikasikan, dan merawat website ini agar tetap online:
> - **Ubah PIN / Password**: Cukup ketik perintah satu baris di terminal tanpa perlu bongkar kode program.
> - **Pasang di HP Kasir**: Website siap dibuka di `https://scan.tahunyakrispiya.my.id` dan bisa di-bookmark / dipasang sebagai icon aplikasi HP.
> - **Tanya Jawab Kendala**: Solusi cepat jika kamera tidak mau menyala atau foto tidak muncul.

## 1. Ikhtisar & Prasyarat Sistem
Dokumen ini adalah panduan operasional (*Runbook*) lengkap untuk melakukan setup awal, manajemen secrets, pengembangan lokal (*local dev*), deployment produksi, dan troubleshooting pada infrastruktur Cloudflare Workers & R2.

### Prasyarat Alat (*Prerequisites*):
* **Node.js**: Versi `>= 18.0.0` (Direkomendasikan v20 LTS).
* **NPM**: Versi `>= 9.0.0`.
* **Akun Cloudflare**: Memiliki akses ke Cloudflare Dashboard dengan izin Workers & R2.

---

## 2. Setup Awal & Pengembangan Lokal (*Local Development*)

### A. Instalasi Dependensi
```bash
npm install
```

### B. Menjalankan Server Lokal
```bash
# 1. Kompilasi frontend JavaScript
npm run build

# 2. Jalankan emulator Cloudflare Worker
npm run dev
```

> **Tips Pengembangan Lokal**:
> Jika ingin melewati autentikasi login saat debugging lokal, Anda dapat menyertakan environment variable `DEV_NO_AUTH="true"` di konfigurasi lokal.

---

## 3. Prosedur Konfigurasi Cloudflare Secrets

Worker Secrets disimpan secara terenkripsi di Cloudflare dan tidak boleh dimasukkan ke dalam file kode sumber ataupun `wrangler.toml`.

Jalankan perintah berikut melalui terminal/PowerShell untuk mengkonfigurasi rahasia:

### 1. Username Login Admin
```bash
npx wrangler secret put AUTH_USERNAME
# Masukkan username admin pilihan Anda
```

### 2. Password Login Admin & Verifikasi Hapus
```bash
npx wrangler secret put AUTH_PASSWORD
# Masukkan password admin yang kuat
```

### 3. Kunci Kriptografi Sesi HMAC-SHA256
```bash
npx wrangler secret put AUTH_SECRET
# Masukkan string acak panjang (minimal 32 karakter acak)
```

### 4. PIN Verifikasi Edit & Hapus (6 Digit)
```bash
npx wrangler secret put DELETE_PIN
# Masukkan 6-digit angka PIN (contoh: 123456)
```

> **Catatan Operasional**:
> Setelah perintah `wrangler secret put` berhasil, nilai rahasia langsung aktif secara global di Cloudflare edge tanpa perlu melakukan deploy ulang kode aplikasi.

---

## 4. Konfigurasi Bucket Cloudflare R2 & Custom Domain

### Langkah 1: Buat Bucket R2
1. Buka **Cloudflare Dashboard > R2 Object Storage > Create bucket**.
2. Beri nama bucket: `qris-receips`.
3. Pilih lokasi otomatis (*Automatic*).

### Langkah 2: Hubungkan Custom Domain ke R2 Bucket
1. Di halaman bucket `qris-receips`, buka tab **Settings**.
2. Scroll ke bagian **Custom Domains**, klik **Connect Domain**.
3. Masukkan subdomain: `qrisdata.tahunyakrispiya.my.id`.
4. Cloudflare akan otomatis mengkonfigurasi DNS dan sertifikat SSL/TLS.

### Langkah 3: Sesuaikan `wrangler.toml`
Pastikan variabel `R2_PUBLIC_URL` dan routes telah sesuai:
```toml
name = "qris-nominal-scanner"
main = "worker.js"
compatibility_date = "2026-07-20"

[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = true

[[r2_buckets]]
binding = "RECEIPTS"
bucket_name = "qris-receips"

[vars]
R2_PUBLIC_URL = "https://qrisdata.tahunyakrispiya.my.id"

[[routes]]
pattern = "scan.tahunyakrispiya.my.id"
custom_domain = true
```

---

## 5. Alur Deployment Produksi (*Production Deploy*)

Untuk mengkompilasi frontend dan mempublikasikan Worker ke Cloudflare:

```bash
npm run deploy
```

Perintah di atas menjalankan skrip otomatis:
1. `npm run build`: `esbuild` meminifikasi `src/app.js` menjadi `public/app.js`.
2. `wrangler deploy`: Mengunggah aset statis ke Cloudflare Assets dan mendeploy `worker.js` ke custom domain `scan.tahunyakrispiya.my.id`.

---

## 6. Panduan Pemecahan Masalah (*Troubleshooting & FAQ*)

### Q1: Mengapa kamera tidak bisa dibuka di browser HP?
* **Penyebab**: Browser modern (Chrome, Safari) memblokir akses `navigator.mediaDevices.getUserMedia` jika web tidak diakses melalui protokol HTTPS yang aman.
* **Solusi**: Pastikan web dibuka melalui `https://scan.tahunyakrispiya.my.id`. Periksa juga izin kamera (*Camera Permission*) di pengaturan browser atau sistem operasi HP Anda.

### Q2: Gambar bukti transaksi tidak muncul di riwayat (Broken Image)?
* **Penyebab**: Nilai `R2_PUBLIC_URL` di `wrangler.toml` belum diset atau custom domain R2 belum terhubung.
* **Solusi**: Pastikan `qrisdata.tahunyakrispiya.my.id` sudah berstatus *Active* di Cloudflare Dashboard R2 Settings dan dapat diakses publik.

### Q3: Sesi login sering keluar sendiri atau error 401?
* **Penyebab**: Masa berlaku cookie sesi 7 hari telah habis, atau nilai secret `AUTH_SECRET` baru saja diubah sehingga signature cookie lama menjadi tidak valid.
* **Solusi**: Cukup login ulang di halaman `/login`.

### Q4: Lupa PIN Hapus / Ingin Mengganti PIN?
* **Solusi**: Jalankan perintah berikut di PowerShell tanpa perlu mengubah kode:
  ```powershell
  npx wrangler secret put DELETE_PIN
  ```
  Ketikkan PIN baru Anda, tekan Enter, dan PIN baru langsung berlaku detik itu juga.
