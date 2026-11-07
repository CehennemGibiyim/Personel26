[CmdletBinding()]
param(
  [switch]$SkipPackage,
  [switch]$SkipBuild,
  [string]$IsccPath
)
# Personel26 — Windows kurulum dosyasini (.exe) derler.
#
# Onkosul: taşınabilir paket hazir olmali (Personel26-Portable\app\server.js).
# Surum numarasi package.json'dan okunur ve Inno Setup'a /DAppVersion ile verilir.
#
# Ornek:
#   powershell -ExecutionPolicy Bypass -File windows\kurulum-olustur.ps1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
if (-not $Version) { throw 'package.json icinde surum numarasi bulunamadi.' }

if (-not $SkipPackage) {
  # Betik hata verirse durdurucu hata olarak buraya yukselir.
  & (Join-Path $PSScriptRoot 'paket-olustur.ps1') -SkipBuild:$SkipBuild
}
if (-not (Test-Path (Join-Path $Root 'Personel26-Portable\app\server.js'))) {
  throw 'Personel26-Portable paketi bulunamadi. Once windows\paket-olustur.ps1 calistirin.'
}

function Find-Iscc {
  param([string]$Explicit)
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($Explicit) { $candidates.Add($Explicit) }
  if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')) }
  $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if ($programFilesX86) { $candidates.Add((Join-Path $programFilesX86 'Inno Setup 6\ISCC.exe')) }
  if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')) }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  throw 'Inno Setup 6 (ISCC.exe) bulunamadi. https://jrsoftware.org/isdl.php adresinden kurun veya -IsccPath verin.'
}

$compiler = Find-Iscc -Explicit $IsccPath
Write-Host "Inno Setup: $compiler" -ForegroundColor Cyan
Write-Host "Personel26 surumu: $Version" -ForegroundColor Cyan
& $compiler "/DAppVersion=$Version" (Join-Path $PSScriptRoot 'installer.iss')
if ($LASTEXITCODE -ne 0) { throw "Inno Setup derlemesi basarisiz (kod $LASTEXITCODE)." }

$installer = Join-Path $PSScriptRoot 'Personel26-Kurulum.exe'
if (-not (Test-Path $installer)) { throw 'Kurulum dosyasi olusmadi.' }
Write-Host ("Kurulum dosyasi hazir: {0} ({1:N1} MB)" -f $installer, ((Get-Item $installer).Length / 1MB)) -ForegroundColor Green
