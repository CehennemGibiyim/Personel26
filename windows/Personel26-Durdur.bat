@echo off
setlocal
cd /d "%~dp0"
"%~dp0Personel26.exe" --stop --quiet
if errorlevel 1 exit /b 1
endlocal
