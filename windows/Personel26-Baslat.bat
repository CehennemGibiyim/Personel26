@echo off
rem ============================================================
rem  Personel26 - Tasinabilir Baslatici
rem  Ilk calistirmada veritabanini otomatik kurar, sonra sunucuyu
rem  baslatir ve tarayiciyi acar. Kapatmak icin bu pencereyi
rem  kapatmayin; Personel26-Durdur.bat kullanin.
rem ============================================================
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%data\pgdata"
set "PGPORT=5433"
set "APPPORT=3210"
set "PGUSER=personel26"
set "PGPASSWORD=personel26"
set "DBNAME=personel26"
set "DATABASE_URL=postgresql://%PGUSER%:%PGPASSWORD%@127.0.0.1:%PGPORT%/%DBNAME%"
set "PORT=%APPPORT%"
set "HOSTNAME=127.0.0.1"
set "NODE_ENV=production"

if not exist "%PGBIN%\postgres.exe" (
  echo [HATA] pgsql\bin\postgres.exe bulunamadi.
  echo Lutfen once paket-olustur.ps1 ile paketi hazirlayin.
  pause & exit /b 1
)
if not exist "%ROOT%node\node.exe" (
  echo [HATA] node\node.exe bulunamadi.
  pause & exit /b 1
)

rem ---- Ilk kurulum: veritabani kumesi yoksa olustur ----
if not exist "%PGDATA%\PG_VERSION" (
  echo [KURULUM] Veritabani ilk kez hazirlaniyor...
  mkdir "%ROOT%data" 2>nul
  echo %PGPASSWORD%> "%TEMP%\p26pw.txt"
  "%PGBIN%\initdb.exe" -D "%PGDATA%" -U %PGUSER% -A password --pwfile="%TEMP%\p26pw.txt" -E UTF8 --locale=C >nul
  del "%TEMP%\p26pw.txt"
  if errorlevel 1 ( echo [HATA] initdb basarisiz. & pause & exit /b 1 )
)

rem ---- PostgreSQL calisiyorsa dokunma, degilse baslat ----
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p %PGPORT% >nul 2>&1
if errorlevel 1 (
  echo [BILGI] PostgreSQL baslatiliyor...
  "%PGBIN%\pg_ctl.exe" start -D "%PGDATA%" -o "-p %PGPORT% -c listen_addresses=127.0.0.1" -l "%ROOT%data\postgres.log" -w -t 60
  if errorlevel 1 ( echo [HATA] PostgreSQL baslatilamadi. data\postgres.log dosyasina bakin. & pause & exit /b 1 )
)

rem ---- Veritabani ve sema yoksa olustur ----
"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPORT% -U %PGUSER% -d %DBNAME% -c "SELECT 1" >nul 2>&1
if errorlevel 1 (
  echo [KURULUM] Veritabani ve tablolar olusturuluyor...
  "%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PGPORT% -U %PGUSER% %DBNAME%
  "%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPORT% -U %PGUSER% -d %DBNAME% -f "%ROOT%schema.sql" >nul
  if errorlevel 1 ( echo [HATA] Sema kurulamadi. & pause & exit /b 1 )
  echo [TAMAM] Veritabani hazir. Ilk acilista ornek veriler otomatik yuklenecek.
)

rem ---- Uygulamayi baslat ----
echo.
echo ============================================
echo   Personel26 calisiyor!
echo   Adres: http://127.0.0.1:%APPPORT%
echo   Bu pencereyi KAPATMAYIN (simge durumuna kucultebilirsiniz).
echo   Durdurmak icin: Personel26-Durdur.bat
echo ============================================
echo.
start "" "http://127.0.0.1:%APPPORT%"
"%ROOT%node\node.exe" "%ROOT%app\server.js"

rem Sunucu kapaninca PostgreSQL'i de durdur
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1
endlocal
