[CmdletBinding()]
param([switch]$SkipBuild, [switch]$NoZip, [string]$NodeVersion = '22.22.3', [string]$PgVersion = '16.13-1', [string]$WebViewVersion = '1.0.3485.44')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
# Gecici ag kesintilerine karsi tekrar deneyen indirme yardimcisi.
function Get-WebWithRetry {
  param([string]$Uri, [string]$OutFile, [int]$Tries = 5)
  for ($i = 1; $i -le $Tries; $i++) {
    try {
      if ($OutFile) {
        if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 600
        return
      }
      return (Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 120)
    } catch {
      if ($OutFile -and (Test-Path $OutFile)) { Remove-Item $OutFile -Force -ErrorAction SilentlyContinue }
      if ($i -eq $Tries) { throw }
      Write-Host "Indirme basarisiz ($i/$Tries): $Uri - $($_.Exception.Message). Tekrar deneniyor..." -ForegroundColor Yellow
      Start-Sleep -Seconds (5 * $i)
    }
  }
}
$Root = Split-Path -Parent $PSScriptRoot
# Surumun tek kaynagi package.json'dir; kurulum dosyasi da ayni degeri kullanir.
$AppVersion = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
if (-not $AppVersion) { throw 'package.json icinde surum numarasi bulunamadi.' }
$Out = Join-Path $Root 'Personel26-Portable'
$Cache = Join-Path $Root '.paket-cache'
New-Item -ItemType Directory -Force -Path $Cache | Out-Null
if (-not $SkipBuild) {
  Push-Location $Root
  try {
    if (Test-Path 'package-lock.json') {
      npm ci --allow-remote=root
      if ($LASTEXITCODE -ne 0) {
        Write-Host 'package-lock.json package.json ile uyumsuz; npm install ile yenileniyor...'
        npm install --allow-remote=root
      }
    } else { npm install --allow-remote=root }
    if ($LASTEXITCODE -ne 0) { throw 'Bagimlilik kurulumu basarisiz.' }
    npx next typegen
    if ($LASTEXITCODE -ne 0) { throw 'Next.js tip uretimi basarisiz.' }
    npx tsc --noEmit --pretty false
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript dogrulamasi basarisiz.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Uretim derlemesi basarisiz.' }
  } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $Root '.next\standalone\server.js'))) { throw 'Next.js standalone sunucu ciktisi bulunamadi.' }
# Masaustu kisayolunun hedefi olan ikonlu baslatici exe'yi derle.
# .bat dosyalari yalnizca geriye donuk uyumluluk icin pakette kalir.
function Build-Launcher {
  $cscCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
  )
  $csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $csc) { throw 'C# derleyicisi (csc.exe) bulunamadi. .NET Framework 4.x gerekli.' }

  # WebView2, paneli tarayici/localhost adresi gostermeden kendi penceresinde
  # acar. NuGet paketindeki yonetilen assembly'ler ve x64 loader pakete girer.
  $webViewPackage = Join-Path $Cache "microsoft.web.webview2.$WebViewVersion.nupkg"
  if (-not (Test-Path $webViewPackage)) {
    Get-WebWithRetry "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$WebViewVersion" $webViewPackage
  }
  $webViewTmp = Join-Path $Cache 'webview2-extract'
  if (Test-Path $webViewTmp) { Remove-Item $webViewTmp -Recurse -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($webViewPackage, $webViewTmp)
  $webViewCore = Join-Path $webViewTmp 'lib\net462\Microsoft.Web.WebView2.Core.dll'
  $webViewForms = Join-Path $webViewTmp 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
  $webViewLoader = Join-Path $webViewTmp 'build\native\x64\WebView2Loader.dll'
  foreach ($file in @($webViewCore, $webViewForms, $webViewLoader)) {
    if (-not (Test-Path $file)) { throw "WebView2 paket dosyasi bulunamadi: $file" }
  }

  $build = Join-Path $env:TEMP ('p26-launcher-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $build | Out-Null
  try {
    Copy-Item (Join-Path $PSScriptRoot 'Personel26Launcher.cs') $build -Force
    Copy-Item (Join-Path $PSScriptRoot 'personel26.ico') $build -Force
    Copy-Item (Join-Path $PSScriptRoot 'Personel26.exe.manifest') $build -Force
    $versionSource = Join-Path $build 'Personel26Launcher.version.cs'
    $assemblyVersion = "$AppVersion.0"
    $versionCode = "using System.Reflection;`r`n[assembly: AssemblyVersion(`"$assemblyVersion`")]`r`n[assembly: AssemblyFileVersion(`"$assemblyVersion`")]`r`n"
    [IO.File]::WriteAllText($versionSource, $versionCode, (New-Object System.Text.UTF8Encoding($false)))
    Push-Location $build
    try {
      & $csc /nologo /target:winexe /platform:x64 /optimize+ /debug- /out:Personel26.exe /win32icon:personel26.ico /win32manifest:Personel26.exe.manifest /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "/r:$webViewCore" "/r:$webViewForms" Personel26Launcher.cs Personel26Launcher.version.cs
      if ($LASTEXITCODE -ne 0) { throw "Baslatici exe derlemesi basarisiz (kod $LASTEXITCODE)." }
    } finally { Pop-Location }
    Copy-Item (Join-Path $build 'Personel26.exe') (Join-Path $Out 'Personel26.exe') -Force
    Copy-Item (Join-Path $PSScriptRoot 'personel26.ico') (Join-Path $Out 'personel26.ico') -Force
    Copy-Item $webViewCore $Out -Force
    Copy-Item $webViewForms $Out -Force
    Copy-Item $webViewLoader $Out -Force
  } finally {
    Remove-Item $build -Recurse -Force -ErrorAction SilentlyContinue
  }
}
$NodeFile = "node-v$NodeVersion-win-x64.zip"
$NodeZip = Join-Path $Cache $NodeFile
if (-not (Test-Path $NodeZip)) { Get-WebWithRetry "https://nodejs.org/dist/v$NodeVersion/$NodeFile" $NodeZip }
# Resmi Node.js SHA-256 kontrolu.
$Checksums = (Get-WebWithRetry "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt").Content
$Line = ($Checksums -split "`n" | Where-Object { $_.Trim().EndsWith($NodeFile) } | Select-Object -First 1)
if (-not $Line) { throw 'Node.js checksum kaydi bulunamadi.' }
$Expected = ($Line.Trim() -split '\s+')[0]
if ((Get-FileHash $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected.ToLowerInvariant()) { throw 'Node.js SHA-256 dogrulamasi basarisiz.' }
$PgZip = Join-Path $Cache "postgresql-$PgVersion-windows-x64-binaries.zip"
if (-not (Test-Path $PgZip)) { Get-WebWithRetry "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip" $PgZip }
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$Out\app", "$Out\node" | Out-Null
Copy-Item "$Root\.next\standalone\*" "$Out\app\" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$Out\app\.next\static" | Out-Null
Copy-Item "$Root\.next\static\*" "$Out\app\.next\static\" -Recurse -Force
if (Test-Path "$Root\public") { Copy-Item "$Root\public" "$Out\app\public" -Recurse -Force }
# Gelistirme ortamina ait baglanti bilgileri pakete ALINMAZ.
Get-ChildItem "$Out\app" -Filter '.env*' -Force -ErrorAction SilentlyContinue | Remove-Item -Force
$NodeTmp = Join-Path $Cache 'node-extract'
$PgTmp = Join-Path $Cache 'pg-extract'
foreach ($dir in @($NodeTmp,$PgTmp)) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force } }
Expand-Archive $NodeZip -DestinationPath $NodeTmp
Copy-Item (Get-ChildItem "$NodeTmp\*\node.exe").FullName "$Out\node\node.exe"
Expand-Archive $PgZip -DestinationPath $PgTmp
New-Item -ItemType Directory -Force -Path "$Out\pgsql" | Out-Null
foreach ($dir in @('bin','lib','share')) { Copy-Item "$PgTmp\pgsql\$dir" "$Out\pgsql\$dir" -Recurse -Force }
foreach ($file in @('Personel26-Baslat.bat','Personel26-Durdur.bat','Personel26-Yedekle.bat','Personel26-Yonet.ps1','Personel26-Guncelle.ps1','schema.sql','schema-update.sql')) { Copy-Item (Join-Path $PSScriptRoot $file) $Out -Force }
Copy-Item (Join-Path $PSScriptRoot 'README-WINDOWS.md') (Join-Path $Out 'BENIOKU.md')
Build-Launcher
@{ application=$AppVersion; schema='2026.01'; node=$NodeVersion; postgresql=$PgVersion; nodeSha256=(Get-FileHash $NodeZip).Hash; postgresqlSha256=(Get-FileHash $PgZip).Hash } | ConvertTo-Json | Set-Content (Join-Path $Out 'manifest.json') -Encoding UTF8
if (-not $NoZip) {
  $Zip = Join-Path $Root 'Personel26-Portable.zip'
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  Compress-Archive -Path "$Out\*" -DestinationPath $Zip
}
Write-Host "Paket hazir: $Out" -ForegroundColor Green
