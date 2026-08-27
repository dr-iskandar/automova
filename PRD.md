Library
/
PRD_Digital_Work_Instruction_CV_AUTOMOVA.docx
DOC

6/6


75%



PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

PRODUCT REQUIREMENTS DOCUMENT

Digital Work Instruction
& Production Tracking

Aplikasi Produksi Lokal Berbasis LAN

Client

CV AUTOMOVA DETAILING INDONESIA

Lokasi

Kabupaten Pasuruan, Jawa Timur

Prepared by

Dicky Rachmat Iskandar

Dokumen

PRD-DWI-AUTOMOVA-001

Versi

1.0 - Draft for Approval

Tanggal

22 Juli 2026

Klasifikasi Dokumen  Confidential. Dokumen ini digunakan sebagai acuan analisis, desain, development, UAT, dan serah terima aplikasi.


CV AUTOMOVA DETAILING INDONESIA | Confidential | PRD v1.0

PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

Kontrol Dokumen

Product Owner / Sponsor

Bapak Suganda - CV AUTOMOVA DETAILING INDONESIA

Product / System Owner

CV AUTOMOVA DETAILING INDONESIA

Business Analyst / Developer

Dicky Rachmat Iskandar

Status

Draft untuk konfirmasi dan approval

Target platform

Aplikasi web lokal pada jaringan LAN/Wi-Fi internal

Riwayat Versi

Versi

Tanggal

Penyusun

Perubahan

1.0

22 Juli 2026

Dicky Rachmat Iskandar

Dokumen awal PRD lengkap berdasarkan diskusi kebutuhan, proposal, quotation, dan prototype operator/admin.

Daftar Isi

• 1. Ringkasan Produk

• 2. Latar Belakang dan Permasalahan

• 3. Tujuan, Sasaran, dan Indikator Keberhasilan

• 4. Stakeholder dan Peran Pengguna

• 5. Ruang Lingkup

• 6. Alur Bisnis Utama

• 7. Status dan Aturan Bisnis

• 8. Kebutuhan Fungsional

• 9. Kebutuhan Report dan Export

• 10. Kebutuhan UI/UX Responsive

• 11. Arsitektur dan Teknologi

• 12. Model Data Tingkat Tinggi

• 13. Kebutuhan Non-Fungsional

• 14. Keamanan, Audit, Backup, dan Recovery

• 15. Kriteria Penerimaan dan UAT

• 16. Tahapan Delivery

• 17. Risiko dan Mitigasi

• 18. Out of Scope dan Roadmap

• 19. Glosarium

• 20. Approval


CV AUTOMOVA DETAILING INDONESIA | Confidential | PRD v1.0

PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

1.  Ringkasan Produk

Digital Work Instruction & Production Tracking adalah aplikasi produksi lokal yang memandu operator menjalankan Job secara berurutan melalui tablet atau PC. Sistem menampilkan instruksi, bahan, timer, alarm, keputusan YES/NO, catatan operator, dan progress produksi. Admin mengelola Job, step, bahan, versi SOP, operator, batch, histori, serta report melalui dashboard di jaringan internal perusahaan.

Prinsip Deployment  Aplikasi tidak ditempatkan di VPS atau cloud. Satu komputer/mini-PC di lokasi produksi berfungsi sebagai local server. Tablet dan PC mengakses aplikasi melalui browser pada LAN/Wi-Fi yang sama.

2.  Latar Belakang dan Permasalahan

• Instruksi kerja produksi masih berpotensi disampaikan melalui dokumen statis, pesan, atau arahan manual sehingga versi SOP yang digunakan dapat tidak konsisten.

• Operator membutuhkan panduan step-by-step dengan timer dan alarm agar durasi proses lebih terkontrol.

• Riwayat siapa yang memproduksi, kapan dilakukan, bahan yang dipakai, jumlah hasil, dan penyimpangan belum tercatat dalam satu sistem terstruktur.

• Perubahan Job harus dapat dikelola admin dan otomatis tersedia pada perangkat operator tanpa instal ulang.

• Manajemen membutuhkan laporan lengkap yang dapat difilter dan diunduh dalam format Excel, CSV, PDF, serta dicetak.

3.  Tujuan, Sasaran, dan Indikator Keberhasilan

ID

Tujuan

Indikator Keberhasilan

OBJ-01

Mendigitalisasi instruksi kerja produksi

Seluruh Job aktif tersedia dalam sistem dengan versi yang dapat dilacak.

OBJ-02

Menjaga urutan dan waktu proses

Operator hanya dapat melanjutkan setelah aksi/konfirmasi sesuai aturan Job.

OBJ-03

Meningkatkan traceability

Setiap batch memiliki operator, Job version, bahan, waktu, step log, dan catatan.

OBJ-04

Mempermudah monitoring

Admin melihat Job aktif, paused, selesai, kendala, dan output harian dari dashboard.

OBJ-05

Mempermudah pelaporan

Report dapat difilter dan diekspor ke XLSX, CSV, PDF, serta print.

OBJ-06

Menjaga operasi lokal

Fungsi utama dapat digunakan tanpa internet selama local server dan jaringan internal aktif.

4.  Stakeholder dan Peran Pengguna

Peran

Tanggung Jawab Utama

Admin

Mengelola user, Job, versi, bahan, pengaturan, dashboard, laporan, backup, dan audit.

Supervisor

Memantau proses, pause/resume, repeat/skip step dengan otorisasi, membatalkan batch, dan memberi catatan.

Operator

Memilih Job, menjalankan step, timer, mengisi catatan, memilih YES/NO, dan menyelesaikan batch.

Manajemen

Melihat dashboard dan laporan produksi sesuai hak akses.

System Maintainer

Melakukan instalasi, backup, recovery, update aplikasi, dan pemeliharaan teknis.

5.  Ruang Lingkup

In Scope - Phase 1 / MVP

• Local server pada Windows PC/mini-PC dan akses melalui LAN/Wi-Fi internal.

• Login, role-based access, master user, dan pengelolaan operator.

• Master Job, material, step/substep, timer, warning, action button, branching YES/NO, draft, publish, archive, dan versioning.

• Operator application responsive untuk tablet Android dan desktop browser.

• Nomor batch otomatis, progress, pause/resume, notes, supervisor override, dan completion.

• History batch, step log, material usage, audit trail, dashboard monitoring, report, export, backup, dan restore dasar.

Out of Scope - Phase 1

• ERP, accounting, purchasing, inventory valuation, dan payroll.

• Integrasi otomatis dengan mesin, PLC, sensor, flow meter, atau timbangan digital.

• Aplikasi native Android/iOS dan publikasi ke Play Store/App Store.

• VPS, cloud hosting, multi-site replication, dan remote access dari internet.

• WhatsApp/Telegram notification, QR/barcode scanner, tanda tangan digital, dan approval QC berlapis kecuali melalui Change Request.

6.  Referensi Tampilan dan Konsep Interaksi

Mockup berikut menjadi referensi arah UI. Detail final dapat berubah saat tahap desain tanpa mengubah requirement inti.



Gambar 1. Operator - pemilihan Job dan Start Job



Gambar 2. Operator - active step, timer, catatan, dan keputusan YES/NO



Gambar 3. Admin - dashboard monitoring produksi



Gambar 4. Admin - Job Editor, material, step builder, dan publish version


CV AUTOMOVA DETAILING INDONESIA | Confidential | PRD v1.0

PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

7.  Alur Bisnis Utama

7.1  Admin Membuat dan Mempublikasikan Job

Admin membuat Job Draft -> menentukan produk, target, unit, area, bahan, step, timer, action, warning, dan branching -> validasi -> Publish -> sistem membuat Job Version baru -> perangkat operator melihat versi terbaru untuk batch baru.

7.2  Operator Menjalankan Produksi

Operator login -> memilih Job -> review ringkasan -> Start Job -> sistem membuat Batch No -> Step 1 aktif dan timer berjalan -> operator menekan action -> konfirmasi YES/NO -> proses berlanjut sampai selesai.

7.3  Kondisi NO / Kendala

Operator mengisi catatan -> memilih NO -> batch berstatus Paused -> timer pengingat berjalan -> supervisor/operator yang berwenang melakukan resume -> log pause, alasan, dan durasi tersimpan.

7.4  Perubahan Job Saat Batch Aktif

Admin publish versi baru -> batch yang sedang aktif tetap menggunakan snapshot versi lama -> versi baru hanya digunakan ketika batch berikutnya dimulai.

7.5  Penyelesaian dan Pelaporan

Step terakhir selesai -> operator konfirmasi final -> batch berstatus Completed -> waktu selesai dan output dicatat -> data muncul pada dashboard, history, dan report.

8.  Status dan Aturan Bisnis

Entitas

Status

Definisi

Job

Draft

Masih dapat diedit dan belum tersedia untuk operator.

Job

Published

Aktif dan dapat digunakan untuk batch baru.

Job

Archived

Tidak dapat dipilih operator; histori tetap tersedia.

Batch

Ready

Batch telah dibuat, belum memulai step.

Batch

In Progress

Minimal satu step sedang berjalan.

Batch

Paused

Proses berhenti sementara karena NO, kendala, atau supervisor.

Batch

Completed

Semua step selesai dan output telah dikonfirmasi.

Batch

Cancelled

Dibatalkan oleh supervisor/admin dengan alasan wajib.

Step

Locked

Belum dapat dibuka karena step sebelumnya belum selesai.

Step

Running

Timer/aktivitas step sedang berjalan.

Step

Waiting Confirmation

Timer atau action selesai dan menunggu YES/NO.

Step

Completed

Step selesai dan data tersimpan.

Step

Skipped

Dilewati dengan supervisor override dan alasan wajib.

Aturan Bisnis Kritis

• BR-01: Nomor batch harus unik dan dibuat otomatis saat operator menekan Start Job.

• BR-02: Setiap batch menyimpan Job Version snapshot sehingga perubahan master tidak mengubah batch aktif.

• BR-03: Step berikutnya tetap terkunci sampai action dan confirmation pada step aktif terpenuhi.

• BR-04: Pemilihan NO wajib disertai catatan operator.

• BR-05: Skip, repeat, cancel, dan override membutuhkan otorisasi supervisor serta alasan.

• BR-06: Timer menggunakan waktu server sebagai sumber utama agar tidak bergantung pada perubahan jam perangkat tablet.

• BR-07: Menutup browser tidak menghilangkan batch aktif; saat login kembali sistem menampilkan proses terakhir.

• BR-08: Penghapusan Job yang telah dipakai tidak diperbolehkan secara permanen; sistem menggunakan archive/soft delete.

• BR-09: Report hanya menampilkan data sesuai role dan filter yang diizinkan.

• BR-10: Pengubahan data transaksi yang sudah Completed harus dicatat pada audit log dan dibatasi untuk admin.

9.  Kebutuhan Fungsional

9.1  Authentication dan User Management

ID

Requirement

Priority

Acceptance Criteria

FR-001

Sistem menyediakan login menggunakan username dan password.

Must

User valid dapat masuk; user tidak valid menerima pesan error tanpa membocorkan detail akun.

FR-002

Sistem menyediakan role Admin, Supervisor, Operator, dan Viewer/Management.

Must

Menu dan aksi yang tampil mengikuti hak akses role.

FR-003

Admin dapat membuat, mengubah, menonaktifkan, dan reset password user.

Must

Perubahan user tersimpan dan langsung berlaku pada login berikutnya.

FR-004

Sistem mencatat login, logout, gagal login, dan aktivitas penting user.

Should

Audit log menampilkan user, waktu, perangkat/IP lokal, dan aktivitas.

FR-005

Session otomatis berakhir setelah periode idle yang dapat dikonfigurasi.

Should

User diminta login ulang setelah timeout.

9.2  Master Job dan Versioning

ID

Requirement

Priority

Acceptance Criteria

FR-010

Admin dapat membuat Job baru dalam status Draft.

Must

Job tersimpan dengan nama, kode, produk, target, unit, area, line, shift, dan status.

FR-011

Admin dapat edit, duplicate, archive, dan search/filter Job.

Must

Perubahan draft tersimpan; archived Job tidak muncul pada operator.

FR-012

Admin dapat publish Job dan sistem membuat nomor versi baru.

Must

Published version memiliki nomor versi, publisher, dan timestamp.

FR-013

Sistem mempertahankan seluruh riwayat versi Job.

Must

Admin dapat melihat daftar versi dan ringkasan perubahan.

FR-014

Batch aktif menggunakan snapshot Job Version saat Start Job.

Must

Publish baru tidak mengubah step/material/timer batch aktif.

9.3  Material dan Step Builder

ID

Requirement

Priority

Acceptance Criteria

FR-020

Admin dapat menambahkan material, jumlah, dan satuan pada Job.

Must

Material tersimpan berurutan dan dapat diedit sebelum publish.

FR-021

Satuan mendukung Kg, Gram, Liter, Ml, Unit, dan custom unit.

Must

Unit tampil konsisten pada operator, history, dan report.

FR-022

Admin dapat menambah, mengubah, menghapus, dan mengurutkan step/substep.

Must

Urutan dapat disimpan dan tampil sama di operator.

FR-023

Setiap step memiliki judul, instruksi, warning, timer, action label, dan notes rule.

Must

Seluruh atribut tampil pada active job screen.

FR-024

Step mendukung branching YES ke step tujuan dan NO ke Paused/step tertentu.

Must

Flow mengikuti rule yang dikonfigurasi.

FR-025

Admin dapat menentukan catatan wajib atau opsional per step.

Should

Sistem mencegah lanjut ketika catatan wajib belum diisi.

FR-026

Admin dapat menambahkan gambar instruksi pada step.

Could

Gambar tampil responsive tanpa mengganggu timer/action.

9.4  Operator Job Execution

ID

Requirement

Priority

Acceptance Criteria

FR-030

Operator melihat daftar Published Job yang aktif.

Must

Daftar menampilkan nama, produk, target, jumlah step, versi, dan update terakhir.

FR-031

Operator dapat membuka detail dan menekan Start Job.

Must

Sistem membuat batch unik dan mencatat operator/waktu mulai.

FR-032

Operator hanya melihat satu active step utama dengan instruksi yang jelas.

Must

Step lain berstatus locked/preview sesuai konfigurasi.

FR-033

Sistem menampilkan progress step dan status batch.

Must

Progress berubah setelah step completed.

FR-034

State batch dapat dipulihkan setelah browser ditutup atau perangkat reconnect.

Must

Login ulang membuka active batch pada state terakhir.

FR-035

Operator dapat mengisi hasil produksi aktual pada akhir Job.

Must

Nilai dan unit output tersimpan pada batch.

9.5  Timer, Alarm, dan Confirmation

ID

Requirement

Priority

Acceptance Criteria

FR-040

Timer countdown berjalan berdasarkan konfigurasi step.

Must

Sisa waktu diperbarui per detik dan tidak reset saat refresh.

FR-041

Sistem membunyikan alarm visual/audio saat timer selesai.

Must

Alarm muncul minimal sekali dan dapat diakui operator.

FR-042

Action button dapat memulai substep/timer berikutnya.

Must

Klik action tercatat dengan timestamp dan mengaktifkan rule terkait.

FR-043

Setelah aktivitas selesai sistem meminta YES/NO.

Must

YES mengikuti branching; NO membutuhkan catatan dan melakukan pause.

FR-044

Paused Job menjalankan reminder timer berulang.

Should

Pengingat tampil/bunyi sesuai interval konfigurasi.

FR-045

Supervisor dapat repeat, skip, resume, atau cancel dengan PIN/password.

Must

Aksi membutuhkan alasan dan tercatat pada audit.

9.6  Batch, History, dan Audit

ID

Requirement

Priority

Acceptance Criteria

FR-050

Sistem menghasilkan nomor batch otomatis dengan format configurable.

Must

Tidak ada duplikasi nomor batch.

FR-051

Sistem menyimpan waktu mulai/selesai dan durasi per step serta total.

Must

Durasi dapat dilihat pada detail batch dan report.

FR-052

Sistem menyimpan material plan dan material actual per batch.

Should

Report dapat membandingkan planned vs actual.

FR-053

History dapat dicari berdasarkan batch, Job, produk, operator, tanggal, dan status.

Must

Filter mengembalikan hasil sesuai parameter.

FR-054

Detail batch menampilkan timeline seluruh aktivitas.

Must

Timeline memuat step, action, pause, notes, override, dan completion.

FR-055

Audit log tidak dapat diedit oleh operator.

Must

Operator hanya dapat melihat data yang diizinkan; admin dapat melakukan review.

9.7  Dashboard dan Settings

ID

Requirement

Priority

Acceptance Criteria

FR-060

Dashboard menampilkan produksi hari ini, active Job, completed batch, dan paused Job.

Must

KPI mengikuti filter tanggal/area jika tersedia.

FR-061

Dashboard menampilkan grafik produksi dan daftar batch terbaru.

Should

Grafik dapat difilter per periode dan produk.

FR-062

Dashboard menampilkan kendala produksi dan perubahan Job terbaru.

Should

Paused/warning terbaru tampil dengan waktu dan operator.

FR-063

Admin dapat mengatur format batch, interval reminder, default unit, dan identitas perusahaan.

Must

Perubahan setting tersimpan dan digunakan transaksi berikutnya.

FR-064

Admin dapat melakukan backup manual dan melihat status backup terakhir.

Must

File backup dapat dibuat dan diunduh/disalin ke media lokal.


CV AUTOMOVA DETAILING INDONESIA | Confidential | PRD v1.0

PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

10.  Kebutuhan Report dan Export

Modul report harus menyediakan filter, tampilan tabel, ringkasan KPI, detail transaksi, dan export. Semua report harus dapat digunakan pada jaringan lokal tanpa layanan cloud.

ID

Nama Report

Filter Utama

Isi Utama

RPT-01

Ringkasan Produksi

Tanggal/periode, produk, Job, status

Total batch, total hasil, average duration, completed/paused/cancelled

RPT-02

Detail Batch

Batch No, Job, produk, operator

Versi Job, start/end, output, material, timeline step, notes, override

RPT-03

Produktivitas Operator

Periode, operator, shift

Jumlah batch, output, durasi rata-rata, pause, completion rate

RPT-04

Kinerja Job

Periode, Job, version

Jumlah batch, avg total duration, avg step duration, delay frequency

RPT-05

Durasi Step & Keterlambatan

Periode, Job, step

Planned duration, actual duration, variance, late count

RPT-06

Kendala dan Penyimpangan

Periode, status, operator, Job

NO reason, pause duration, warning, supervisor action, resolution

RPT-07

Penggunaan Material

Periode, material, Job, batch

Planned qty, actual qty, variance, total penggunaan per unit

RPT-08

Traceability Batch

Batch No

Produk, operator, Job version, material, semua timestamps, output

RPT-09

History Versi Job

Job, version, publisher

Perubahan, tanggal publish, status, jumlah batch pengguna versi

RPT-10

Audit Aktivitas

Periode, user, action

Login, master changes, publish, override, edit transaction, backup

Format Download dan Aturan Export

ID

Requirement

Priority

Acceptance Criteria

REP-001

Setiap report dapat diunduh sebagai Excel Workbook (.xlsx).

Must

File dapat dibuka di Microsoft Excel/LibreOffice dan memiliki header, tipe data, serta format tanggal/angka yang benar.

REP-002

Report dapat diunduh sebagai CSV UTF-8.

Must

Delimiter dan encoding menjaga karakter Indonesia serta dapat dibuka di Excel.

REP-003

Report dapat diunduh sebagai PDF A4 portrait/landscape sesuai report.

Must

PDF memiliki judul, periode, filter, nomor halaman, dan tidak terpotong.

REP-004

Report menyediakan mode Print dari browser.

Should

Layout print menyembunyikan menu dan tombol yang tidak diperlukan.

REP-005

Excel detail batch dapat memiliki multi-sheet: Summary, Steps, Materials, Notes, Audit.

Should

Workbook memuat sheet sesuai data dan nama sheet mudah dipahami.

REP-006

Nama file export mengikuti pola ReportName_YYYYMMDD_HHMM.[ext].

Must

Nama file konsisten dan tidak menggunakan karakter ilegal.

REP-007

Filter aktif dan waktu generate dicantumkan pada export.

Must

Penerima file mengetahui konteks data.

REP-008

User dapat memilih kolom untuk report tabel tertentu.

Could

Kolom yang dipilih tercermin pada layar dan export.

REP-009

Export data besar diproses tanpa membuat UI hang.

Should

Sistem memberikan indikator proses dan file berhasil dibuat.

Ketentuan Excel

• Header diberi format tebal dan freeze pane pada baris header.

• Kolom tanggal menggunakan format tanggal/waktu, bukan teks mentah.

• Kolom jumlah dan durasi menggunakan tipe numerik agar dapat dihitung ulang.

• Auto-filter aktif pada tabel report.

• Total atau summary ditempatkan pada bagian atas atau sheet Summary.

• File tidak mengandung macro dan dapat dibuka tanpa koneksi internet.

11.  Kebutuhan UI/UX Responsive

Framework UI  Frontend menggunakan Bootstrap 5.x sebagai framework responsive utama, Bootstrap Icons untuk ikon, komponen tabel responsive/DataTables-compatible, dan Chart.js untuk grafik. Seluruh library dikemas lokal agar aplikasi tidak bergantung pada CDN atau internet.

ID

Requirement

Priority

Acceptance Criteria

UI-001

Layout menggunakan responsive grid Bootstrap dan mendukung tablet portrait, tablet landscape, desktop, serta laptop.

Must

Tidak ada horizontal scroll pada form utama di viewport standar; tabel dapat responsive/scroll terkontrol.

UI-002

Ukuran tombol operator minimum 44x44 px dan action utama dibuat besar.

Must

Operator dapat menggunakan layar sentuh dengan nyaman.

UI-003

Timer, instruksi, warning, dan progress memiliki hirarki visual kuat.

Must

Informasi kritis terbaca dari jarak kerja normal.

UI-004

Warna status konsisten: biru in-progress, hijau completed, oranye paused/warning, merah error/cancelled.

Must

Status mudah dibedakan tanpa hanya mengandalkan teks.

UI-005

Form admin menggunakan validasi inline, modal konfirmasi, dan toast notification.

Must

User memahami field error dan hasil action.

UI-006

Tabel report mendukung search, sort, pagination, column visibility, dan responsive details.

Must

Report tetap dapat digunakan pada desktop dan tablet.

UI-007

Mode fullscreen tersedia pada operator app.

Should

Browser dapat digunakan seperti kiosk selama produksi.

UI-008

Navigasi operator maksimal empat menu utama: Home, Active Job, History, Account.

Should

Alur operator sederhana dan tidak membingungkan.

UI-009

Admin dashboard memakai sidebar collapsible.

Should

Ruang layar dapat dioptimalkan pada laptop/tablet landscape.

UI-010

Loading, empty, error, offline/LAN disconnected, dan permission denied state tersedia.

Must

User menerima feedback yang jelas pada semua kondisi.

Breakpoint dan Target Device

Kategori

Lebar Referensi

Perilaku

Tablet Portrait

768-899 px

Konten satu kolom, action sticky/bottom, table menjadi card/details.

Tablet Landscape

900-1199 px

Dua kolom, sidebar admin collapsible, timer dan instruksi berdampingan.

Desktop/Laptop

>=1200 px

Dashboard multi-column dan tabel penuh.

Mobile terbatas

<768 px

Fungsi review/emergency; bukan target utama area produksi.

Accessibility dan Usability

• Kontras warna minimal memadai untuk teks normal dan status kritis.

• Input memiliki label yang jelas, bukan hanya placeholder.

• Tombol memiliki teks dan ikon; ikon tidak menjadi satu-satunya indikator.

• Alur dapat digunakan dengan keyboard pada desktop.

• Pesan alarm audio selalu disertai indikator visual.

• Konfirmasi destructive action seperti Cancel, Archive, dan Edit Completed Batch harus eksplisit.


CV AUTOMOVA DETAILING INDONESIA | Confidential | PRD v1.0

PRODUCT REQUIREMENTS DOCUMENT - DWI PRODUCTION TRACKING

12.  Arsitektur dan Teknologi

Topologi Deployment Lokal

Komponen

Rekomendasi

Local Server

Windows PC/mini-PC di lokasi produksi, IP lokal statis, berjalan saat jam operasional.

Web Server

Apache atau Nginx melalui Laragon/XAMPP/Docker lokal sesuai keputusan implementasi.

Backend

PHP dengan Laravel stable release pada awal proyek.

Database

MariaDB/MySQL lokal untuk akses multi-user dan integritas transaksi.

Frontend

Blade/HTML5, Bootstrap 5.x, Bootstrap Icons, JavaScript, Chart.js, tabel responsive.

Excel Export

PhpSpreadsheet atau library Laravel Excel yang kompatibel.

PDF Export

Dompdf/Snappy-compatible library yang dikemas lokal.

Client

Google Chrome/Microsoft Edge desktop dan Chrome Android tablet.

Network

LAN/Wi-Fi internal; tablet membuka URL IP/hostname local server.

Prinsip Arsitektur

• Server menjadi source of truth untuk timer, batch state, version snapshot, dan audit log.

• Frontend responsive tetapi business rule kritis divalidasi kembali di backend.

• Seluruh asset CSS/JS/font/library tersedia lokal dan tidak menggunakan CDN.

• File upload dibatasi ukuran/tipe dan disimpan pada storage lokal terstruktur.

• Export dibuat di server lokal dan dikirim ke browser sebagai download.

• Backup database dan file storage dibuat terjadwal ke folder backup dan media eksternal/network share bila tersedia.

Kebutuhan Jaringan Lokal

• Local server menggunakan IP statis atau hostname lokal yang mudah diingat.

• Wi-Fi produksi harus memiliki jangkauan memadai dan akses ke server.

• Port aplikasi dibuka hanya pada jaringan internal.

• Admin dapat mengakses dashboard dari PC pada jaringan yang sama.

• Akses dari luar lokasi tidak termasuk; bila dibutuhkan dapat ditambahkan melalui VPN pada fase berikutnya.

13.  Model Data Tingkat Tinggi

Entity

Data Utama

users

Akun, role, status, credential, last login

roles_permissions

Hak akses per role

jobs

Identitas master Job dan status

job_versions

Snapshot versi, publisher, publish time

job_steps

Step/substep, urutan, timer, action, warning

step_branches

Rule YES/NO dan target state/step

materials

Master bahan dan default unit

job_materials

Material plan per Job version

batches

Batch No, Job version, operator, status, output, waktu

batch_steps

State dan timestamps per step

batch_materials

Planned dan actual material per batch

operator_notes

Catatan per step/batch

batch_events

Timeline action, pause, resume, alarm, override

audit_logs

Perubahan master, transaksi, login, backup

system_settings

Format batch, reminder, company identity, export settings

Data Integrity  Job Version dan data transaksi batch tidak boleh bergantung pada master yang dapat berubah. Snapshot versi dan material plan disimpan agar histori tetap konsisten.

14.  Kebutuhan Non-Fungsional

ID

Kategori

Requirement

Priority

NFR-001

Performance

Halaman utama dan daftar normal tampil <= 3 detik pada LAN; action operator menerima respons <= 1 detik pada kondisi normal.

Must

NFR-002

Concurrency

Mendukung minimal 20 user aktif bersamaan pada satu local server yang memenuhi spesifikasi.

Should

NFR-003

Timer Accuracy

Timer tidak berubah signifikan akibat refresh atau jam perangkat; deviasi target <= 2 detik per aktivitas normal.

Must

NFR-004

Reliability

State batch disimpan setiap event penting dan dapat dipulihkan setelah browser reconnect.

Must

NFR-005

Availability

Aplikasi tersedia selama server, database, dan jaringan lokal aktif.

Must

NFR-006

Compatibility

Mendukung Chrome/Edge versi yang masih didukung pada saat implementasi dan Android tablet modern.

Must

NFR-007

Maintainability

Kode modular, migration database, configuration file, dan dokumentasi instalasi tersedia.

Must

NFR-008

Scalability

Master Job, batch, material, dan report tidak dibatasi hard-code; pagination digunakan.

Should

NFR-009

Localization

Antarmuka utama berbahasa Indonesia; format tanggal, angka, dan unit konsisten.

Must

NFR-010

Observability

Error log, audit log, backup log, dan health/status sederhana tersedia.

Should

15.  Keamanan, Audit, Backup, dan Recovery

ID

Requirement

Priority

Acceptance Criteria

SEC-001

Password disimpan dalam bentuk hash yang aman; tidak disimpan plain text.

Must

Database tidak mengandung password terbaca.

SEC-002

Semua form mutasi data dilindungi CSRF dan validasi server-side.

Must

Request tidak sah ditolak.

SEC-003

Hak akses diperiksa pada menu dan endpoint/action backend.

Must

Operator tidak dapat membuka fungsi admin melalui URL langsung.

SEC-004

Input dan file upload divalidasi untuk mencegah injection dan file berbahaya.

Must

Tipe, ukuran, nama file, dan konten yang diizinkan dibatasi.

SEC-005

Audit log mencatat perubahan kritis dan tidak dapat dihapus oleh operator.

Must

Log memuat actor, waktu, action, entity, dan perubahan ringkas.

BKP-001

Backup database otomatis minimal harian.

Must

File backup tercipta dan status keberhasilan tercatat.

BKP-002

Admin dapat membuat backup manual sebelum update aplikasi.

Must

Backup dapat dipicu dan file terverifikasi tersedia.

BKP-003

Backup meliputi database, uploaded instruction images, dan configuration yang diperlukan.

Must

Restore menghasilkan data dan file yang konsisten.

BKP-004

Retensi backup default 30 harian dan 12 bulanan atau sesuai keputusan klien.

Should

Backup lama dibersihkan sesuai kebijakan.

BKP-005

Prosedur restore diuji minimal satu kali saat UAT/deployment.

Must

Sample restore berhasil pada environment test.

Skenario Recovery

• Browser/tablet tertutup: operator login kembali dan melanjutkan active batch pada step terakhir.

• Wi-Fi terputus singkat: UI menampilkan disconnected state dan mencoba reconnect; action tidak boleh tersimpan ganda.

• Local server restart: service aplikasi/database berjalan kembali dan batch state tetap tersimpan.

• Database rusak/gagal update: maintainer melakukan restore dari backup tervalidasi.

• Server PC rusak: aplikasi dipasang pada perangkat pengganti dan data direstore dari media backup eksternal.

16.  Kriteria Penerimaan dan UAT

ID

Skenario

Expected Result

UAT-01

Login dan Role

Admin, supervisor, operator memperoleh menu sesuai role; akses langsung yang tidak sah ditolak.

UAT-02

Create/Publish Job

Admin membuat Job lengkap, publish version, dan Job tampil pada operator.

UAT-03

Versioning

Publish perubahan saat batch aktif tidak mengubah batch aktif; batch baru memakai versi terbaru.

UAT-04

Start Batch

Operator menekan Start dan sistem membuat nomor batch unik beserta waktu/operator.

UAT-05

Timer dan Alarm

Timer berjalan, tahan refresh, alarm muncul ketika selesai, dan event tercatat.

UAT-06

Branch YES

YES membuka step target dan progress berubah.

UAT-07

Branch NO

NO tanpa note ditolak; NO dengan note membuat Paused dan reminder aktif.

UAT-08

Supervisor Override

PIN/password supervisor dapat repeat/skip/resume/cancel dan log alasan tersimpan.

UAT-09

Recovery

Browser ditutup dan login kembali menampilkan active Job pada state terakhir.

UAT-10

Completion

Final step menghasilkan Completed batch dengan output, waktu, notes, material, dan timeline.

UAT-11

Report Filter

Filter report menghasilkan data sesuai batch/Job/operator/periode/status.

UAT-12

Excel Export

XLSX dapat dibuka, format data benar, filter tercantum, dan sheet detail tersedia sesuai report.

UAT-13

PDF/CSV/Print

File PDF tidak terpotong; CSV UTF-8 benar; print layout bersih.

UAT-14

Responsive

Operator screen dapat digunakan di tablet portrait/landscape; admin dapat digunakan di laptop/desktop.

UAT-15

Backup Restore

Backup manual/otomatis tersedia dan sample restore berhasil.

Definition of Done

• Seluruh requirement Must telah dikembangkan dan lulus internal testing.

• UAT kritis lulus dan temuan blocker/critical telah ditutup.

• Deployment pada local server berhasil dan tablet dapat mengakses melalui LAN.

• Data awal user serta minimal satu sample Job telah dikonfigurasi.

• Dokumentasi admin, operator, backup, restore, dan instalasi diserahkan.

• Training online/onsite sesuai quotation telah dilakukan.

• Source code dan credential serah terima mengikuti kesepakatan kontrak/quotation.

17.  Tahapan Delivery

Tahap

Target

Output Utama

Kickoff & Analysis

Minggu 1

Finalisasi PRD, data sample, workflow, dan environment lokal.

UI/UX & Prototype

Minggu 1-2

Responsive operator/admin prototype dan approval flow.

Phase 1 - Core System

Selesai bulan pertama

Login, Job/material/step builder, publish/version, operator execution, timer, YES/NO, batch, history dasar.

Phase 2 - Reporting & Hardening

Minggu 5-7

Dashboard, report lengkap, Excel/CSV/PDF/print, audit, backup, responsive refinements.

UAT & Final Delivery

Minggu 7-8

Bug fixing, deployment, restore test, documentation, training, serah terima.

Dependencies dari Klien

• Daftar Job awal dan contoh SOP produksi.

• Daftar bahan, satuan, target produksi, dan format batch yang diinginkan.

• Daftar operator/admin/supervisor dan role.

• Perangkat local server, tablet, LAN/Wi-Fi, dan akses instalasi.

• Feedback dan approval maksimal 2 hari kerja per tahap untuk menjaga timeline.

• PIC UAT yang memahami proses produksi.

18.  Risiko dan Mitigasi

ID

Risiko

Level

Mitigasi

R-01

Wi-Fi area produksi tidak stabil

High

Survey jaringan, IP statis, reconnect handling, dan access point yang memadai.

R-02

Server PC dimatikan/bermasalah

High

Auto-start service, UPS opsional, backup eksternal, dan SOP restart.

R-03

Scope bertambah selama development

High

PRD approval, backlog, dan Change Request terpisah.

R-04

SOP/data awal belum final

Medium

Gunakan sample Job dan freeze data sebelum UAT.

R-05

Operator belum terbiasa

Medium

UI sederhana, tombol besar, training, dan quick guide.

R-06

Export report sangat besar

Medium

Pagination, filter wajib, background generation, dan batas rentang periode.

R-07

Backup hanya tersimpan di server yang sama

High

Salin backup ke USB/NAS/PC lain secara terjadwal.

R-08

Perubahan jam perangkat

Medium

Timer dan timestamp mengacu waktu server.

19.  Roadmap Pengembangan Berikutnya

• Phase 2+: Secure remote access melalui VPN untuk admin dari luar lokasi.

• Integrasi timbangan digital, flow meter, PLC, atau mesin produksi.

• QR/barcode batch dan scanning material.

• Inventory bahan dan integrasi ERP/accounting.

• Photo evidence dan digital signature per step.

• Approval QC berlapis dan release product.

• WhatsApp/Telegram alert untuk paused, overdue, atau completion.

• Multi-plant dan centralized reporting.

• OEE, yield, waste, downtime, dan advanced analytics.

20.  Glosarium

Istilah

Definisi

DWI

Digital Work Instruction; instruksi kerja digital step-by-step.

Job

Template proses produksi yang memiliki bahan, step, timer, dan aturan.

Job Version

Snapshot Job yang dipublish dan tidak berubah.

Batch

Satu pelaksanaan Job untuk produksi tertentu.

Step/Substep

Tahapan aktivitas yang harus dijalankan operator.

Branching

Aturan alur berdasarkan jawaban YES/NO atau kondisi lain.

Paused

Status berhenti sementara karena kendala/NO/supervisor.

Audit Trail

Riwayat siapa melakukan apa dan kapan.

Local Server

Komputer internal yang menjalankan aplikasi/database.

LAN

Jaringan internal lokasi yang menghubungkan server, PC, dan tablet.

UAT

User Acceptance Test oleh user bisnis sebelum serah terima.

21.  Approval

Dengan persetujuan dokumen ini, para pihak menyatakan bahwa requirement di dalamnya menjadi baseline scope development. Perubahan setelah approval dapat diproses sebagai Change Request dan dapat memengaruhi biaya