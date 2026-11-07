param(
  [Parameter(Mandatory = $true)][string]$PendingFile
)
# Personel26 — uygulama ici guncelleme yardimcisi.
#
# Panelde "Guncellemeleri denetle" -> "Simdi guncelle" secildiginde API bu
# betigi ayri bir PowerShell surecinde baslatir. Betik:
#   1. Yeni paketi indirir (veya -PendingFile icinde yerel yol verildiyse kopyalar),
#   2. SHA-256 ozetini dogrular,
#   3. Arşivi data\updates\<surum> altina acar,
#   4. Personel26-Yonet.ps1 -Action Update ile yedek alip dosyalari degistirir.
# Ilerleme data\update-status.json dosyasina yazilir; panel bu dosyayi okur.
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Data = if ($env:P26_DATA_DIR) { $env:P26_DATA_DIR } else { Join-Path $Root 'data' }
$UpdatesDir = Join-Path $Data 'updates'
$StatusFile = Join-Path $Data 'update-status.json'
$LogFile = Join-Path $UpdatesDir 'update.log'
New-Item -ItemType Directory -Force -Path $UpdatesDir | Out-Null

function Write-Log([string]$Message) {
  $line = ('[{0}] {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Message)
  Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Get-LogTail([int]$Lines = 20) {
  if (-not (Test-Path $LogFile)) { return $null }
  $tail = Get-Content -LiteralPath $LogFile -Tail $Lines -ErrorAction SilentlyContinue
  if (-not $tail) { return $null }
  return (($tail | Out-String).Trim())
}

function Write-UpdateStatus {
  param(
    [string]$State,
    [string]$Message,
    [int]$Percent = -1
  )
  $status = @{
    state     = $State
    message   = $Message
    updatedAt = (Get-Date).ToString('o')
  }
  if (Test-Path $StatusFile) {
    try {
      $existing = Get-Content -LiteralPath $StatusFile -Raw | ConvertFrom-Json
      foreach ($name in @('startedAt', 'from', 'to')) {
        $property = $existing.PSObject.Properties[$name]
        if ($property -and $property.Value) { $status[$name] = $property.Value }
      }
    } catch { }
  }
  if ($Percent -ge 0) { $status.percent = $Percent }
  if ($State -eq 'done' -or $State -eq 'error') {
    $status.finishedAt = (Get-Date).ToString('o')
    if ($State -eq 'error') {
      $tail = Get-LogTail
      if ($tail) { $status.logTail = $tail }
    }
  }
  # Yarim yazilmis JSON panelde hata vermesin: once gecici dosya, sonra tasima.
  $json = $status | ConvertTo-Json -Depth 5
  $temporary = "$StatusFile.tmp"
  [IO.File]::WriteAllText($temporary, $json, (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $StatusFile -Force
}

function Download-Package {
  param([string]$Url, [string]$Destination, [long]$TotalBytes)
  Add-Type -AssemblyName System.Net.Http
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromMinutes(45)
  try {
    $response = $client.GetAsync($Url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    try {
      if (-not $response.IsSuccessStatusCode) {
        throw ('Paket indirilemedi (HTTP {0}).' -f [int]$response.StatusCode)
      }
      $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
      $file = [IO.File]::Create($Destination)
      try {
        $buffer = New-Object 'byte[]' 1048576
        $written = [long]0
        $lastReport = Get-Date
        while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
          $file.Write($buffer, 0, $read)
          $written += $read
          if (((Get-Date) - $lastReport).TotalSeconds -ge 1) {
            $lastReport = Get-Date
            $percent = -1
            if ($TotalBytes -gt 0) { $percent = [int][Math]::Min(100, [Math]::Floor($written * 100 / $TotalBytes)) }
            Write-UpdateStatus -State 'downloading' -Message ('Paket indiriliyor: {0:N0} MB' -f ($written / 1MB)) -Percent $percent
          }
        }
      } finally {
        $file.Dispose()
        $stream.Dispose()
      }
    } finally {
      $response.Dispose()
    }
  } finally {
    $client.Dispose()
  }
}

function Find-PackageRoot([string]$ExtractPath) {
  if (Test-Path (Join-Path $ExtractPath 'app\server.js')) { return $ExtractPath }
  # Arsiv tek bir ust klasor iceriyorsa (bazi sikistirma araclari) onu bul.
  foreach ($directory in Get-ChildItem -LiteralPath $ExtractPath -Directory -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $directory.FullName 'app\server.js')) { return $directory.FullName }
  }
  throw 'Indirilen pakette app\server.js bulunamadi. Paket gecersiz veya bozuk.'
}

try {
  if (-not (Test-Path $PendingFile)) { throw 'Guncelleme bilgisi (pending.json) bulunamadi.' }
  $pending = Get-Content -LiteralPath $PendingFile -Raw | ConvertFrom-Json
  $toVersion = [string]$pending.to
  if ($toVersion -notmatch '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$') { throw 'Guncelleme surum numarasi gecersiz.' }
  Write-Log ('Guncelleme baslatildi: {0} -> {1}' -f $pending.from, $toVersion)

  $status = @{
    state     = 'downloading'
    message   = 'Guncelleme paketi hazirlaniyor...'
    from      = [string]$pending.from
    to        = $toVersion
    startedAt = (Get-Date).ToString('o')
    updatedAt = (Get-Date).ToString('o')
  }
  # BOM'suz UTF-8: panel JSON dosyasini dogrudan JSON.parse ile okur.
  [IO.File]::WriteAllText($StatusFile, ($status | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))

  $versionDir = Join-Path $UpdatesDir $toVersion
  if (Test-Path $versionDir) { Remove-Item -LiteralPath $versionDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $versionDir | Out-Null
  $fileName = 'Personel26-Portable.zip'
  if ($pending.fileName) { $fileName = [IO.Path]::GetFileName([string]$pending.fileName) }
  if ($fileName -notmatch '\.zip$') { $fileName = 'Personel26-Portable.zip' }
  $zipPath = Join-Path $versionDir $fileName

  if ($pending.path) {
    if (-not (Test-Path ([string]$pending.path))) { throw 'Yerel guncelleme paketi bulunamadi.' }
    Write-Log ('Yerel paket kopyalaniyor: {0}' -f $pending.path)
    Copy-Item -LiteralPath ([string]$pending.path) -Destination $zipPath -Force
  } else {
    if (-not $pending.url) { throw 'Guncelleme paketi adresi eksik.' }
    $size = 0
    if ($pending.size) { $size = [long]$pending.size }
    Write-Log ('Paket indiriliyor: {0}' -f $pending.url)
    Download-Package -Url ([string]$pending.url) -Destination $zipPath -TotalBytes $size
  }

  Write-UpdateStatus -State 'verifying' -Message 'Paket butunlugu dogrulaniyor...'
  if (-not (Test-Path $zipPath) -or (Get-Item -LiteralPath $zipPath).Length -lt 1024) {
    throw 'Indirilen guncelleme paketi bos veya eksik.'
  }
  if ($pending.sha256) {
    $expected = ([string]$pending.sha256).Trim().ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
      Write-Log ('SHA-256 uyusmadi. Beklenen: {0} Bulunan: {1}' -f $expected, $actual)
      throw 'Guncelleme paketi dogrulanamadi (SHA-256 uyusmuyor). Paket bozulmus veya degistirilmis olabilir.'
    }
  } else {
    throw 'Guncelleme paketi icin SHA-256 ozeti eksik.'
  }
  Write-Log 'Paket SHA-256 dogrulamasi basarili.'

  Write-UpdateStatus -State 'extracting' -Message 'Paket aciliyor...'
  $extractDir = Join-Path $versionDir 'package'
  if (Test-Path $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
  $packageRoot = Find-PackageRoot $extractDir
  Write-Log ('Paket acildi: {0}' -f $packageRoot)

  Write-UpdateStatus -State 'installing' -Message 'Veriler yedekleniyor ve yeni surum kuruluyor...'
  $manager = Join-Path $Root 'Personel26-Yonet.ps1'
  if (-not (Test-Path $manager)) { throw 'Personel26-Yonet.ps1 bulunamadi; tam kurulum paketiyle guncelleyin.' }
  # Yonet.ps1 uygulamayi kapatir, SQL guvenlik yedegi alir, dosyalari degistirir,
  # saglik kontrolu yapar ve basarisizlikta eski surume doner.
  & $manager -Action Update -PackagePath $packageRoot -FromVersion ([string]$pending.from) -ToVersion $toVersion

  Write-UpdateStatus -State 'done' -Message ('Personel26 {0} surumune guncellendi. Verileriniz korundu.' -f $toVersion)
  Write-Log 'Guncelleme tamamlandi.'
  Remove-Item -LiteralPath $PendingFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  # Onceki indirmeleri temizle; yalnizca son surum klasoru kalsin.
  Get-ChildItem -LiteralPath $UpdatesDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne $toVersion } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  exit 0
} catch {
  $friendly = $_.Exception.Message
  Write-Log ('HATA: {0}' -f $friendly)
  try { Write-UpdateStatus -State 'error' -Message $friendly } catch { }
  exit 1
}
