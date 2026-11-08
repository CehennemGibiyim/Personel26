@echo off
setlocal
cd /d "%~dp0"
"%~dp0Personel26.exe" --backup --quiet
if errorlevel 1 exit /b 1
echo SQL yedeginiz kurulum klasorundeki backups dizininde hazir.
if not "%P26_NONINTERACTIVE%"=="1" pause
endlocal
