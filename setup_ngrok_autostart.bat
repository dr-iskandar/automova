@echo off
:: Ensure Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ======================================================================
    echo ERROR: Harap jalankan script ini sebagai Administrator!
    echo (Klik kanan file ini -> pilih "Run as Administrator")
    echo ======================================================================
    pause
    exit /b
)

:: Create the start_ngrok.bat script that runs Ngrok HTTP 80
echo @echo off > C:\automova\start_ngrok.bat
echo taskkill /f /im ngrok.exe >nul 2>&1
echo timeout /t 2 /nobreak >nul 2>&1
echo start "" "%%USERPROFILE%%\AppData\Local\Microsoft\WindowsApps\ngrok.exe" http 127.0.0.1:3000 --host-header=rewrite >> C:\automova\start_ngrok.bat

:: Register the task in Windows Task Scheduler to run on boot
schtasks /create /tn "StartNgrokWeb" /tr "C:\automova\start_ngrok.bat" /sc ONSTART /ru "adminpabrik" /rp "pabrik123" /rl HIGHEST /f

echo.
echo ======================================================================
echo BERHASIL: Auto-start Ngrok HTTP (Akses Rumah) telah didaftarkan!
echo Ngrok akan otomatis berjalan di background setiap kali PC Server dinyalakan.
echo ======================================================================
pause
