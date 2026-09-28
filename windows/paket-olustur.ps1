# ============================================================
#  Personel26 — Windows Taşınabilir Paket Oluşturucu
#  Windows makinede proje kök klasöründen çalıştırın:
#    powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
#
#  Yaptıkları:
#   1) Uygulamayı derler (next build, standalone çıktı)
#   2) Taşınabilir Node.js indirir
#   3) Taşınabilir PostgreSQL indirir
#   4) Hepsini Personel26-Portable\ klasöründe birleştirir
#   5) İsteğe bağlı: ZIP arşivi üretir
#  Çıkan klasörü herhangi bir Windows PC'ye kopyalayıp
#  Personel26-Baslat.bat ile çalıştırabilirsiniz. Kurulum gerekmez.
# ============================================================
$ErrorActionPreference = "Stop"

$NodeVersion = "22.14.0"
$PgVersion   = "16.4-1"
$Root  = Split-Path -Parent $PSScriptRoot   # proje kökü
$Out   = Join-Path $Root "Personel26-Portable"
$Cache = Join-Path $Root ".paket-cache"

Write-Host "==> Personel26 taşınabilir paket oluşturucu" -ForegroundColor Cyan
Write-Host "    Proje: $Root"

# ---- 0) Ön kontrol ----
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Bu makinede Node.js kurulu olmalı (paketi DERLEMEK için). https://nodejs.org"
}
New-Item -ItemType Directory -Force -Path $Cache | Out-Null

# ---- 1) Uygulamayı derle ----
Write-Host "==> [1/5] Uygulama derleniyor (npm ci + next build)..." -ForegroundColor Cyan
Push-Location $Root
if (Test-Path "package-lock.json") { npm ci } else { npm install }
# Derleme sırasında API route'ları veritabanı modülünü import eder.
# Derleme DB'ye bağlanmamalı: paket için yalnızca geçici build URL'i ver.
# Portable kullanıcı veritabanı, uygulama BAŞLADIĞINDA kendi pg klasöründe kurulur.
$PreviousDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = "postgresql://build:build@127.0.0.1:1/personel26_build_only"
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Derleme başarısız." }
} finally {
  if ($null -eq $PreviousDatabaseUrl) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $PreviousDatabaseUrl
  }
}
if (-not (Test-Path ".next\standalone\server.js")) {
  throw "standalone çıktı bulunamadı. next.config.ts içinde output:'standalone' olmalı."
}
Pop-Location

# ---- 2) Taşınabilir Node.js ----
$NodeZip = Join-Path $Cache "node-v$NodeVersion-win-x64.zip"
if (-not (Test-Path $NodeZip)) {
  Write-Host "==> [2/5] Node.js v$NodeVersion indiriliyor..." -ForegroundColor Cyan
  Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $NodeZip
} else { Write-Host "==> [2/5] Node.js önbellekten kullanılıyor." -ForegroundColor Cyan }

# ---- 3) Taşınabilir PostgreSQL (EDB binaries) ----
$PgZip = Join-Path $Cache "postgresql-$PgVersion-windows-x64-binaries.zip"
if (-not (Test-Path $PgZip)) {
  Write-Host "==> [3/5] PostgreSQL $PgVersion indiriliyor (~300 MB)..." -ForegroundColor Cyan
  Invoke-WebRequest "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip" -OutFile $PgZip
} else { Write-Host "==> [3/5] PostgreSQL önbellekten kullanılıyor." -ForegroundColor Cyan }

# ---- 4) Paket klasörünü birleştir ----
Write-Host "==> [4/5] Paket birleştiriliyor: $Out" -ForegroundColor Cyan
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$Out\app", "$Out\node" | Out-Null

# 4a) Uygulama (standalone + static + public)
Copy-Item "$Root\.next\standalone\*" "$Out\app\" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$Out\app\.next\static" | Out-Null
Copy-Item "$Root\.next\static\*" "$Out\app\.next\static\" -Recurse -Force
if (Test-Path "$Root\public") { Copy-Item "$Root\public" "$Out\app\public" -Recurse -Force }

# 4b) Node (yalnızca node.exe yeterli)
$NodeTmp = Join-Path $Cache "node-extract"
if (Test-Path $NodeTmp) { Remove-Item $NodeTmp -Recurse -Force }
Expand-Archive $NodeZip -DestinationPath $NodeTmp
Copy-Item (Get-ChildItem "$NodeTmp\*\node.exe").FullName "$Out\node\node.exe"

# 4c) PostgreSQL (bin + lib + share yeterli)
$PgTmp = Join-Path $Cache "pg-extract"
if (Test-Path $PgTmp) { Remove-Item $PgTmp -Recurse -Force }
Expand-Archive $PgZip -DestinationPath $PgTmp
New-Item -ItemType Directory -Force -Path "$Out\pgsql" | Out-Null
foreach ($d in "bin","lib","share") {
  Copy-Item "$PgTmp\pgsql\$d" "$Out\pgsql\$d" -Recurse -Force
}

# 4d) Başlatıcılar + şema
Copy-Item "$Root\windows\Personel26-Baslat.bat" $Out
Copy-Item "$Root\windows\Personel26-Durdur.bat" $Out
Copy-Item "$Root\windows\schema.sql" $Out
Copy-Item "$Root\windows\README-WINDOWS.md" "$Out\BENIOKU.md" -ErrorAction SilentlyContinue

# ---- 5) ZIP ----
Write-Host "==> [5/5] ZIP arşivi oluşturuluyor..." -ForegroundColor Cyan
$Zip = Join-Path $Root "Personel26-Portable.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path "$Out\*" -DestinationPath $Zip

Write-Host ""
Write-Host "✅ TAMAMLANDI!" -ForegroundColor Green
Write-Host "   Klasör : $Out"
Write-Host "   Arşiv  : $Zip"
Write-Host ""
Write-Host "Kullanım: Klasörü/ZIP'i hedef bilgisayara kopyalayın,"
Write-Host "Personel26-Baslat.bat dosyasına çift tıklayın. Hepsi bu."
