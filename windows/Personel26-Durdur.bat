@echo off
rem Personel26'yi guvenli sekilde durdurur (once uygulama, sonra veritabani).
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%data\pgdata"

echo Uygulama sunucusu durduruluyor...
taskkill /f /im node.exe >nul 2>&1

echo PostgreSQL durduruluyor...
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1

echo Tamamlandi. Verileriniz data\ klasorunde guvende.
timeout /t 3 >nul
endlocal
