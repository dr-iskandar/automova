# AUTOMOVA DWI Production

Aplikasi lokal untuk **Digital Work Instruction & Production Tracking** CV AUTOMOVA DETAILING INDONESIA, dibangun dari PRD v1.0 tanggal 22 Juli 2026.

## Menjalankan aplikasi

Persyaratan: Node.js 22.13 atau lebih baru. Node.js 24 direkomendasikan untuk runtime SQLite bawaan yang digunakan aplikasi.

```bash
npm install
npm run build
npm run start:lan
```

Aplikasi tersedia di `http://localhost:3000` dan database API di port `3100`. Tablet atau PC pada LAN/Wi-Fi yang sama dapat membuka `http://IP-SERVER:3000`. Pastikan firewall Windows mengizinkan port TCP 3000 dan 3100 hanya untuk jaringan lokal/private.

Untuk development dengan hot reload:

```bash
npm run dev:full
```

## Akun demo

Halaman login menyediakan tombol langsung untuk peran Operator, Supervisor, dan Administrator. PIN supervisor demo untuk melanjutkan batch yang dijeda adalah `2468`.

## Fitur yang sudah dapat dicoba

- Login/simulasi role Operator, Supervisor, dan Admin.
- Job Library dengan data contoh Prewash Gen 3.0, Mixing A, dan Rinse Process.
- Database SQLite lokal untuk Job/step, material, user, role-permission, settings, batch, timeline, dan performa operator.
- Editable form dan CRUD untuk Master Material, User, Role/Hak Akses, Job, material Job, step builder, batch, dan konfigurasi report.
- Material di Job Editor dipilih langsung dari Material Master agar referensi dan satuan tetap konsisten.
- Pemilih material pada Job menggunakan card visual dan menampilkan jumlah per batch serta urutan pemakaian.
- Ledger Material mencatat penerimaan, pemakaian, adjustment, waktu, tujuan, referensi, Job/Batch, dan pencatat.
- Batch completed otomatis menghasilkan transaksi pemakaian sesuai kebutuhan material pada Job.
- Start Job dengan nomor batch otomatis dan snapshot Job Version.
- Timer selalu berada pada kondisi Ready dan baru menghitung mundur setelah operator menekan **Mulai Step & Timer**.
- Alert visual/audio berbeda untuk pause, timer habis, dan proses selesai.
- Konfirmasi YES/NO; NO mewajibkan catatan dan membuat batch Paused.
- Supervisor override dengan PIN dan alasan audit.
- Completion dengan input output aktual serta detail history batch dan timeline event.
- Nilai performa setiap operator berdasarkan completion, on-time rate, pause, dan cancellation.
- Tutorial otomatis pada penggunaan pertama setiap master data dan tombol Tutorial untuk membukanya kembali.
- Popup pengingat SOP/doa muncul saat login Operator dan sebelum proses sesuai setting terbaru Admin.
- Notification center tersimpan di database, dengan unread badge, daftar notifikasi, dan aksi tandai dibaca.
- Dashboard, performa operator, Batch History, dan Report berubah dinamis mengikuti tanggal/range tanggal.
- Batch History dapat ditelusuri per tanggal, dibuka detailnya, dikoreksi, atau dibatalkan dengan audit timeline.
- Report dapat disimpan, diedit, dihapus, digunakan kembali, difilter tanggal/status, dan diekspor CSV.
- Report Center memiliki tab Produksi, Material, dan Report Tersimpan, termasuk recap material periodik dan export CSV.
- Operator dapat membatalkan Job hanya dengan PIN Supervisor dan alasan audit. Supervisor/Admin dapat membatalkan langsung dari Batch History.
- UI responsif untuk tablet portrait/landscape dan desktop.

## Database dan backup

Database tersimpan pada `data/automova.sqlite` dengan mode WAL. Salin file database beserta file `-wal`/`-shm` ketika service dihentikan, atau gunakan mekanisme backup SQLite terjadwal sebelum deployment produksi. Password user yang dibuat melalui API disimpan sebagai hash scrypt, bukan teks asli.

`localStorage` hanya digunakan untuk session demo, batch aktif pada perangkat, dan status tutorial. Master data, batch tersimpan, timeline, settings, dan performance menggunakan database server lokal.

## Catatan menuju produksi penuh

Login pada UI masih memakai pemilih role demo. Sebelum go-live, hubungkan form login ke endpoint session server, enforce permission pada setiap endpoint, tambahkan CSRF/rate limit/audit login, backup otomatis, serta export XLSX/PDF server-side sesuai PRD.

Lihat [PRD_REVIEW.md](./PRD_REVIEW.md) untuk keputusan yang perlu dikonfirmasi sebelum fase production build.
