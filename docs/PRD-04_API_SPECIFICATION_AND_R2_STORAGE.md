# PRD 04: Spesifikasi API & Skema Penyimpanan Cloudflare R2

> 💡 **Penjelasan Singkat Bahasa Manusia**:  
> Dokumen ini menjelaskan bagaimana data dan foto disimpan di lemari brankas digital:
> - **Folder Per Tanggal (`records/2026/08/27/`)**: Catatan penjualan ditata rapi dalam map digital sesuai tanggal hari transaksi sehingga saat dicari sore hari langsung ketemu tanpa loading lama.
> - **Folder Foto (`images/2026/08/27/`)**: Foto struk disimpan dengan kode acak khusus agar link fotonya aman dan tidak bisa diintip sembarang orang.
> - **Hapus Transaksi Sekaligus**: Saat transaksi dihapus, file catatan dan file fotonya dihapus berbarengan agar server tetap bersih.

## 1. Ikhtisar & Pola Penyimpanan Database Objek
Sistem **QRIS Nominal Scanner** tidak menggunakan database SQL/NoSQL tradisional, melainkan memanfaatkan **Cloudflare R2 Object Storage** sebagai *Serverless Document & Asset Store*.

Desain ini memberikan efisiensi biaya maksimal (*zero egress fees*), keandalan tinggi, dan performa query cepat menggunakan skema partisi tanggal hierarkis.

---

## 2. Skema Partisi & Naming Convention R2

Bucket R2 (`qris-receips`) dibagi menjadi dua direktori utama:

```
qris-receips/
├── records/                               # Metadata transaksi dalam format JSON
│   └── 2026/
│       └── 08/
│           └── 27/
│               ├── 081520-18000-a1b2c3d4.json
│               └── 143000-25000-f9e8d7c6.json
└── images/                                # File gambar foto bukti dalam format JPEG
    └── 2026/
        └── 08/
            └── 27/
                ├── 081520-18000-a1b2c3d4.jpg
                └── 143000-25000-f9e8d7c6.jpg
```

### Format Penamaan Kunci Objek (*Object Key Convention*)
Format: `{prefix}/{YYYY}/{MM}/{DD}/{HHmmss}-{amount}-{randomUUID_8char}.{ext}`
* **Prefix**: `records` (untuk JSON) atau `images` (untuk JPG).
* **Tanggal**: `YYYY/MM/DD` berdasarkan zona waktu `Asia/Jakarta`.
* **Waktu & Nominal**: `HHmmss` jam-menit-detik digabung dengan angka `amount` agar file terurut secara kronologis saat dilist.
* **UUID Acak**: 8 karakter acak untuk mencegah tabrakan nama dan mencegah URL gambar ditebak secara sekuensial.

### Skema Dokumen JSON Record
```json
{
  "amount": 18000,
  "savedAt": "2026-08-27T08:15:20+07:00",
  "imageKey": "images/2026/08/27/081520-18000-a1b2c3d4.jpg"
}
```

---

## 3. Spesifikasi Kontrak REST API

### A. Autentikasi

#### 1. `POST /login`
Masuk sebagai Admin menggunakan username dan password.
* **Request Content-Type**: `application/x-www-form-urlencoded` / `multipart/form-data`
* **Form Fields**: `username` (string), `password` (string)
* **Response**:
  * `302 Redirect` ke `/` dengan cookie `qris_session` (jika sukses).
  * `401 Unauthorized` dengan HTML Error Page (jika gagal).

#### 2. `POST /login-guest`
Masuk sebagai Guest (Mode Intip / Read-Only).
* **Request**: Kosong.
* **Response**: `302 Redirect` ke `/` dengan cookie `qris_session` guest.

#### 3. `POST /logout`
Menghapus sesi login.
* **Response**: `302 Redirect` ke `/login` dengan cookie kosong (`Max-Age=0`).

---

### B. Transaksi & Riwayat (`/api/receipts`)

#### 1. Mengambil Daftar Riwayat Transaksi
* **Endpoint**: `GET /api/receipts?date=YYYY-MM-DD`
* **Headers**: Cookie `qris_session`
* **Query Parameters**:
  * `date` (string, required): Format `YYYY-MM-DD`. Default ke tanggal hari ini (WIB).
* **Response `200 OK`**:
```json
{
  "role": "admin",
  "date": "2026-08-27",
  "records": [
    {
      "amount": 18000,
      "savedAt": "2026-08-27T08:15:20+07:00",
      "imageKey": "images/2026/08/27/081520-18000-a1b2c3d4.jpg",
      "recordKey": "records/2026/08/27/081520-18000-a1b2c3d4.json",
      "imageUrl": "https://qrisdata.tahunyakrispiya.my.id/images/2026/08/27/081520-18000-a1b2c3d4.jpg"
    }
  ]
}
```

---

#### 2. Menambah Transaksi Baru
* **Endpoint**: `POST /api/receipts`
* **Headers**: Cookie `qris_session` (Role: `admin`)
* **Request Content-Type**: `multipart/form-data`
* **Form Fields**:
  * `image` (File, required): File foto bukti pembayaran (`image/jpeg`, max 2MB).
  * `amount` (string/number, required): Nominal transaksi (contoh: `"18000"`).
  * `customTime` (string, optional): Jam custom format `HH:mm` atau `HH:mm:ss` (digunakan untuk input dari galeri).
* **Catatan Keamanan**: **TIDAK MEMERLUKAN PIN**.
* **Response `200 OK`**:
```json
{
  "amount": 18000,
  "savedAt": "2026-08-27T08:15:20+07:00",
  "imageUrl": "https://qrisdata.tahunyakrispiya.my.id/images/2026/08/27/081520-18000-a1b2c3d4.jpg"
}
```

---

#### 3. Mengedit Transaksi Tersimpan
* **Endpoint**: `PUT /api/receipts`
* **Headers**:
  * Cookie `qris_session` (Role: `admin`)
  * `x-delete-pin` (string, required): 6-digit PIN yang cocok dengan `env.DELETE_PIN`.
* **Request Content-Type**: `application/json`
* **Request Body**:
```json
{
  "recordKey": "records/2026/08/27/081520-18000-a1b2c3d4.json",
  "newAmount": 20000,
  "newTime": "08:30"
}
```
* **Response `200 OK`**:
```json
{
  "updated": true,
  "record": {
    "amount": 20000,
    "savedAt": "2026-08-27T08:30:00+07:00",
    "imageKey": "images/2026/08/27/081520-18000-a1b2c3d4.jpg"
  }
}
```
* **Response `401 Unauthorized`**: Jika PIN tidak disertakan atau salah.

---

#### 4. Menghapus Transaksi Permanen
* **Endpoint**: `DELETE /api/receipts`
* **Headers**:
  * Cookie `qris_session` (Role: `admin`)
  * `x-delete-pin` (string, required): PIN Hapus (`env.DELETE_PIN`).
  * `x-delete-password` (string, required): Password Admin (`env.AUTH_PASSWORD`).
* **Request Content-Type**: `application/json`
* **Request Body**:
```json
{
  "recordKey": "records/2026/08/27/081520-18000-a1b2c3d4.json"
}
```
* **Eksekusi di Backend**:
  ```javascript
  // Menghapus record JSON dan file foto JPG sekaligus
  await env.RECEIPTS.delete([recordKey, record.imageKey]);
  ```
* **Response `200 OK`**:
```json
{
  "deleted": true
}
```
* **Response `401 Unauthorized`**: Jika Verifikasi 1 (PIN) atau Verifikasi 2 (Password) salah.
