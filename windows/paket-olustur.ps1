[CmdletBinding()]
param([switch]$SkipBuild, [switch]$NoZip, [string]$NodeVersion = '22.22.3', [string]$PgVersion = '16.13-1')
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
# Personel26.exe artik bir C#/WebView2 baslatici degil, StockManager ile ayni
# Electron masaustu kabugudur. Electron dagitimi kurulum klasorune kopyalanir;
# app klasoru kendi main.cjs dosyamizi yukler. Boylece adres cubugu veya
# tarayici penceresi olmadan gercek bir masaustu uygulamasi acilir.
function Build-DesktopShell {
  $electronDist = Join-Path $Root 'node_modules\electron\dist'
  $electronExe = Join-Path $electronDist 'electron.exe'
  if (-not (Test-Path $electronExe)) {
    # electron paketi 45.x surumunde ikiliyi ilk kullanimda indirir. Paketleme
    # sirasinda bu adimi acikca calistir; npm install tek basina yetmez.
    Push-Location $Root
    try {
      & (Get-Command node.exe -ErrorAction Stop).Source (Join-Path $Root 'node_modules\electron\install.js')
      if ($LASTEXITCODE -ne 0) { throw "Electron ikilisi indirilemedi (kod $LASTEXITCODE)." }
    } finally { Pop-Location }
  }
  if (-not (Test-Path $electronExe)) { throw 'Electron dagitimi bulunamadi; npm install ve electron/install.js calistirin.' }
  $electronVersion = (Get-Content (Join-Path $Root 'node_modules\electron\package.json') -Raw | ConvertFrom-Json).version

  Copy-Item (Join-Path $electronDist '*') $Out -Recurse -Force
  Remove-Item (Join-Path $Out 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
  $copiedElectron = Join-Path $Out 'electron.exe'
  if (Test-Path $copiedElectron) {
    Move-Item $copiedElectron (Join-Path $Out 'Personel26.exe') -Force
  } elseif (-not (Test-Path (Join-Path $Out 'Personel26.exe'))) {
    throw 'Electron exe pakete kopyalanamadi.'
  }

  $desktopApp = Join-Path $Out 'resources\app'
  if (Test-Path $desktopApp) { Remove-Item $desktopApp -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $desktopApp | Out-Null
  Copy-Item (Join-Path $Root 'electron\main.cjs') $desktopApp -Force
  $desktopPackage = @{
    name = 'personel26'
    productName = 'Personel26'
    version = $AppVersion
    description = 'Personel26 Puantaj ve Nobet Yonetimi'
    author = 'Personel26'
    main = 'main.cjs'
  } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $desktopApp 'package.json'), $desktopPackage, (New-Object System.Text.UTF8Encoding($false)))

  $rcedit = Join-Path $Root 'node_modules\rcedit\bin\rcedit-x64.exe'
  if (-not (Test-Path $rcedit)) { throw 'rcedit bulunamadi; npm install calistirin.' }
  & $rcedit (Join-Path $Out 'Personel26.exe') `
    --set-icon (Join-Path $PSScriptRoot 'personel26.ico') `
    --set-file-version "$AppVersion.0" `
    --set-product-version "$AppVersion.0" `
    --set-version-string FileDescription 'Personel26' `
    --set-version-string ProductName 'Personel26' `
    --set-version-string CompanyName 'Personel26' `
    --set-version-string LegalCopyright 'Personel26'
  if ($LASTEXITCODE -ne 0) { throw "Personel26.exe ikon/surum bilgisi yazilamadi (kod $LASTEXITCODE)." }

  Copy-Item (Join-Path $PSScriptRoot 'personel26.ico') (Join-Path $Out 'personel26.ico') -Force
  return $electronVersion
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
$electronVersion = Build-DesktopShell
@{ application=$AppVersion; schema='2026.01'; shell='electron'; electron=$electronVersion; node=$NodeVersion; postgresql=$PgVersion; nodeSha256=(Get-FileHash $NodeZip).Hash; postgresqlSha256=(Get-FileHash $PgZip).Hash } | ConvertTo-Json | Set-Content (Join-Path $Out 'manifest.json') -Encoding UTF8
if (-not $NoZip) {
  $Zip = Join-Path $Root 'Personel26-Portable.zip'
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  Compress-Archive -Path "$Out\*" -DestinationPath $Zip
}
Write-Host "Paket hazir: $Out" -ForegroundColor Green
