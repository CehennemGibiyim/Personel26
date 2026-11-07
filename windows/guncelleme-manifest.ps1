[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Tag,
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [string]$Repository = 'CehennemGibiyim/Personel26',
  [string]$OutputPath = 'update.json',
  [string]$SchemaVersion = '2026.01',
  [string]$ChangelogPath,
  # Surum notu dosyada yoksa yayini durdurmamak icin disaridan verilebilir.
  [string]$Title,
  [string]$Kind,
  [AllowEmptyCollection()][string[]]$Notes
)
# Personel26 — GitHub surumune yuklenecek update.json dosyasini uretir.
#
# Panel bu dosyayi su adresten okur:
#   https://github.com/<depo>/releases/latest/download/update.json
#
# Surum notlari depodaki updates\surum-notlari.json dosyasindan gelir. Atlanan
# ara surumlerin notlari da ayni dosyada tutuldugu icin 1.1.0 -> 1.4.0 gecisinde
# kullanici tum duzeltmeleri gorebilir.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not $ChangelogPath) { $ChangelogPath = Join-Path $Root 'updates\surum-notlari.json' }
if (-not (Test-Path $ChangelogPath)) { throw "Surum notlari bulunamadi: $ChangelogPath" }
if (-not (Test-Path $ZipPath)) { throw "Tasinabilir paket bulunamadi: $ZipPath" }
if ($Version -notmatch '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$') { throw 'Surum numarasi X.Y.Z biciminde olmali.' }

$changelog = Get-Content -LiteralPath $ChangelogPath -Raw | ConvertFrom-Json
$releases = @($changelog.releases)
$entry = $releases | Where-Object { $_.version -eq $Version } | Select-Object -First 1

# Kurulum paketi her zaman uretilir; surum notu eksikse yayini durdurmak yerine
# cagiran is akisinin (git log) verdigi notlarla devam edilir.
if ($Notes -and $Notes.Count -gt 0) { $effectiveNotes = @($Notes) }
elseif ($entry -and $entry.notes) { $effectiveNotes = @($entry.notes) }
else { throw ("{0} surumu icin surum notu bulunamadi. -Notes ile not verin." -f $Version) }
$effectiveTitle = if ($Title) { $Title } elseif ($entry -and $entry.title) { $entry.title } else { 'Bakim surumu' }
$effectiveKind = if ($Kind) { $Kind } elseif ($entry -and $entry.kind) { $entry.kind } else { 'maintenance' }
if (-not $entry) {
  $releases = @([pscustomobject]@{
    version = $Version
    kind    = $effectiveKind
    title   = $effectiveTitle
    date    = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
    notes   = $effectiveNotes
  }) + $releases
  Write-Warning ("{0} surum notu dosyada yok; saglanan notlarla yayina eklendi." -f $Version)
}

$hash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$assetUrl = "https://github.com/$Repository/releases/download/$Tag/Personel26-Portable.zip"
$manifest = [ordered]@{
  schema        = 1
  app           = 'Personel26'
  version       = $Version
  releasedAt    = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
  kind          = $effectiveKind
  title         = $effectiveTitle
  notes         = @($effectiveNotes)
  schemaVersion = $SchemaVersion
  releases      = $releases
  package       = [ordered]@{
    url      = $assetUrl
    sha256   = $hash
    size     = (Get-Item -LiteralPath $ZipPath).Length
    fileName = 'Personel26-Portable.zip'
  }
}

$fullOutput = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $Root $OutputPath }
$directory = Split-Path -Parent $fullOutput
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
# BOM'suz UTF-8: panel JSON'u dogrudan okur.
[IO.File]::WriteAllText($fullOutput, ($manifest | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Guncelleme bildirimi hazir: $fullOutput" -ForegroundColor Green
Write-Host ("Surum: {0} | SHA-256: {1}" -f $Version, $hash) -ForegroundColor Cyan
