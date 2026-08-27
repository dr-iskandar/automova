# Review PRD DWI Production Tracking v1.0

## Kesimpulan

PRD sudah layak menjadi baseline desain dan MVP. Requirement inti memiliki ID, prioritas, acceptance criteria, status lifecycle, aturan bisnis, model data, UAT, dan batas scope yang cukup jelas. Mockup operator dan admin konsisten dengan kebutuhan tablet serta desktop.

## Keputusan yang masih perlu dikunci

1. **Matriks izin per role** - definisikan aksi dan data yang boleh dilihat untuk Admin, Supervisor, Operator, dan Viewer sampai tingkat endpoint.
2. **Format batch final** - tetapkan pola, reset sequence harian/bulanan, kode area/line, serta perilaku ketika nomor gagal dibuat.
3. **SOP/Job awal** - serahkan minimal satu SOP lengkap beserta material, unit, timer, warning, branch, dan expected output untuk UAT.
4. **Aturan timer** - konfirmasi apakah operator boleh menyelesaikan action sebelum timer habis, kebijakan timer saat pause, serta interval reminder default.
5. **Supervisor override** - konfirmasi metode otorisasi produksi: PIN khusus, password akun, atau login ulang; termasuk timeout dan retry limit.
6. **Edit completed batch** - tetapkan field yang boleh diperbaiki, approval yang diperlukan, dan apakah nilai lama wajib tampil di audit.
7. **Material actual** - tentukan kapan operator mengisi actual usage, toleransi variance, dan unit conversion yang diizinkan.
8. **Report** - prioritaskan report pertama untuk MVP dan tentukan batas rentang/ukuran export.
9. **Backup** - tetapkan folder/media tujuan, jadwal, retensi final, enkripsi, dan PIC verifikasi restore.
10. **Spesifikasi server** - kunci OS, CPU/RAM/storage, database (MariaDB atau SQLite), web server, UPS, IP/hostname, serta kebijakan auto-start.

## Catatan arsitektur production

- Timer, batch state, sequence batch, version snapshot, permission, dan audit harus divalidasi di backend lokal.
- Gunakan transaksi database/idempotency key untuk mencegah action ganda ketika Wi-Fi reconnect.
- Password wajib di-hash (Argon2id/bcrypt), session memiliki idle timeout, dan seluruh mutasi memiliki proteksi CSRF serta validasi server-side.
- Job version yang sudah dipakai tidak boleh berubah; publish membuat snapshot immutable baru.
- Backup harus mencakup database, upload instruksi, dan konfigurasi, lalu diuji restore pada environment terpisah.
- Prototype UI ini dapat menjadi acuan UAT visual; production backend tetap perlu dibangun sesuai target LAN pada PRD.

## Default yang dipakai pada prototype

- Format batch: `BATCH-YYYYMMDD-SEQ`.
- Interval reminder contoh: 5 menit.
- PIN supervisor demo: `2468`.
- Job sample: Prewash Gen 3.0 v13, Mixing A v7, dan Rinse Process v4.
- Bahasa UI: Indonesia; status memakai biru/green/orange/red sesuai PRD.
