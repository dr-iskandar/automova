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

:: Configure Ngrok authtoken
"%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\ngrok.exe" config add-authtoken 3JPZx2m4HQVsnhTlQ2tp3HB3nI9_57DCw9Zd62wLN6DKeEGbk >nul 2>&1

:: Create the start_ngrok.bat script that runs Ngrok HTTP 3000 with static domain
echo @echo off > C:\automova\start_ngrok.bat
echo taskkill /f /im ngrok.exe >nul 2>&1
echo timeout /t 2 /nobreak >nul 2>&1
echo start "" "%%USERPROFILE%%\AppData\Local\Microsoft\WindowsApps\ngrok.exe" http 3000 --domain=shudder-defog-presuming.ngrok-free.dev --host-header=rewrite >> C:\automova\start_ngrok.bat

:: Register the task in Windows Task Scheduler to run on boot
schtasks /create /tn "StartNgrokWeb" /tr "C:\automova\start_ngrok.bat" /sc ONSTART /ru "adminpabrik" /rp "pabrik123" /rl HIGHEST /f

echo.
echo ======================================================================
echo BERHASIL: Auto-start Ngrok HTTP (Static Domain) telah didaftarkan!
echo Domain: https://shudder-defog-presuming.ngrok-free.dev
echo Ngrok akan otomatis berjalan di background setiap kali PC Server dinyalakan.
echo ======================================================================
pause
