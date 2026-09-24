# STANDAR OPERASIONAL PROSEDUR (SOP)
## Penanganan PC Server AUTOMOVA Saat Listrik Padam (Mati Lampu) & Pemulihan

**Kode Dokumen:** SOP-IT-001  
**Revisi:** 1.0  
**Tanggal Dibuat:** 24 September 2026  
**Target Pengguna:** Operator PC Server & Tim IT Produksi  

---

### 🚨 BAGIAN 1: PROSEDUR SAAT LISTRIK PADAM (MATI LAMPU)

Ketika listrik padam dan PC Server berjalan menggunakan daya cadangan (UPS):

> [!WARNING]
> **Daya UPS biasanya hanya bertahan 10–20 menit.** Jangan menunggu hingga baterai UPS habis total untuk menghindari kerusakan file database SQLite (`automova.db`).

1. **Konfirmasi Kondisi Listrik:**
   - Cek apakah mati lampu sesaat (kurang dari 1 menit) atau pemadaman panjang.
   - Jika indikator UPS berbunyi bip terus-menerus (tanda listrik utama padam), persiapkan prosedur shutdown aman.

2. **Simpan & Hentikan Aplikasi (Shutdown Aman):**
   - Buka jendela **Command Prompt / Terminal** tempat aplikasi `AUTOMOVA` berjalan.
   - Tekan tombol **`Ctrl + C`** pada keyboard untuk menghentikan aplikasi secara aman.
   - Tekan `Y` lalu `Enter` jika muncul konfirmasi *Terminate batch job (Y/N)*.

3. **Matikan PC Server dengan Aman (Graceful Shutdown):**
   - Klik menu **Start Windows** $\rightarrow$ **Power** $\rightarrow$ **Shut down**.
   - Tunggu hingga lampu indikator power pada PC Server dan Monitor benar-benar mati.
   - Matikan sakelar utama **UPS** (jika ada).

---

### 🔄 BAGIAN 2: PROSEDUR PEMULIHAN SAAT LISTRIK KEMBALI MENYALA

Setelah listrik utama kembali stabil dan menyala normal:

#### **Langkah 1: Menyalakan Perangkat Hardware**
1. Nyalakan tombol utama **UPS**.
2. Nyalakan **PC Server** dan **Router Wi-Fi / Switch LAN Pabrik**.
3. Pastikan PC Server dan Router sudah menyala sempurna dan terhubung ke jaringan LAN pabrik.

#### **Langkah 2: Pembersihan Proses Gantung (Opsional jika terjadi port bentrok)**
1. Tekan tombol **Windows**, ketik `cmd`, lalu **Run as Administrator**.
2. Jalankan perintah pembersihan berikut untuk memastikan tidak ada port yang bentrok:
   ```cmd
   taskkill /F /IM node.exe >nul 2>&1
   taskkill /F /IM ngrok.exe >nul 2>&1
   ```

#### **Langkah 3: Menjalankan Aplikasi AUTOMOVA**
1. Buka **Command Prompt** (atau buka folder `C:\automova`).
2. Masuk ke direktori aplikasi (jika di CMD):
   ```cmd
   cd C:\automova
   ```
3. Update kode terbaru jika ada perubahan dari repository (opsional/jika ada instruksi):
   ```cmd
   git pull origin main
   ```
4. Jalankan aplikasi Server LAN:
   ```cmd
   npm run start:lan
   ```
5. Tunggu hingga muncul pesan indikator di layar terminal:
   - `[DATABASE] Database API Server listening on http://0.0.0.0:3100`
   - `[APP] Local: http://localhost:3000`
   - `[APP] Network: http://192.168.100.75:3000` *(alamat IP server)*

#### **Langkah 4: Menjalankan Akses Online / Ngrok**
- Jika autostart Ngrok sudah terpasang, Ngrok akan otomatis menyala di background.
- Jika perlu dinyalakan manual, buka folder `C:\automova` lalu double-click file **`start_ngrok.bat`**, atau jalankan di CMD:
  ```cmd
  C:\automova\start_ngrok.bat
  ```
- **Alamat URL Online Ngrok Static:**  
  `https://shudder-defog-presuming.ngrok-free.dev`

#### **Langkah 5: Verifikasi Sistem**
1. Buka browser di PC Server: `http://localhost:3000`
2. Pastikan halaman Login / Dashboard AUTOMOVA muncul dengan normal.
3. Minta 1 Operator / Supervisor di area produksi untuk mencoba akses dari tablet/PC lokal untuk memastikan koneksi LAN berjalan lancar.

---

### 📋 CHECKLIST SINGKAT UNTUK OPERATOR

| No | Langkah Prosedur Pemulihan | Status |
|---|---|:---:|
| 1 | Listrik & Router Wi-Fi/LAN sudah menyala stabil | [ ] |
| 2 | PC Server menyala & masuk ke Windows | [ ] |
| 3 | Buka CMD Admin $\rightarrow$ `taskkill /F /IM node.exe` | [ ] |
| 4 | Jalankan `npm run start:lan` di folder `C:\automova` | [ ] |
| 5 | Browser Server buka `http://localhost:3000` berhasil | [ ] |
| 6 | Tablet/PC Operator Produksi bisa connect kembali | [ ] |

---

### 📞 KONTAK DARURAT TIM IT
Jika terjadi kendala database corrupt, error port tidak bisa di-kill, atau gagal booting:
- **IT Support Lead:** +62 8xx-xxxx-xxxx
- **System Administrator:** +62 8xx-xxxx-xxxx
