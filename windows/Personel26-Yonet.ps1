param(
  [ValidateSet('Start','Stop','Backup','Restore','Update')][string]$Action = 'Start',
  [string]$BackupFile,
  [string]$PackagePath,
  [string]$FromVersion,
  [string]$ToVersion,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Data = Join-Path $Root 'data'
$PgBin = Join-Path $Root 'pgsql\bin'
$PgData = Join-Path $Data 'pgdata'
$RuntimeFile = Join-Path $Data 'runtime.json'
$ConfigFile = Join-Path $Data 'connection.json'
$UpdatesDir = Join-Path $Data 'updates'
$StatusFile = Join-Path $Data 'update-status.json'
$UpdateLog = Join-Path $UpdatesDir 'update.log'
# Yedekler kurulum klasorunde toplanir; kullanici kolayca bulup baska bir diske kopyalayabilir.
$BackupsDir = if ($env:P26_BACKUP_DIR) { [IO.Path]::GetFullPath($env:P26_BACKUP_DIR) } else { Join-Path $Root 'backups' }
$BackupRetentionDays = 7
# Panelin guncelleme ekrani bu dosyayi okur; betik cokerse son durum gorunur.
function Write-UpdateStatus([string]$State, [string]$Message) {
  try {
    New-Item -ItemType Directory -Force -Path $UpdatesDir | Out-Null
    $status = @{ state = $State; message = $Message; updatedAt = (Get-Date).ToString('o') }
    if (Test-Path $StatusFile) {
      try {
        $existing = Get-Content -LiteralPath $StatusFile -Raw | ConvertFrom-Json
        # Bitmis bir onceki guncellemenin bilgileri yeni isleme tasinmaz.
        if ($existing.state -notin @('done','error')) {
          foreach ($name in @('startedAt','from','to')) {
            $property = $existing.PSObject.Properties[$name]
            if ($property -and $property.Value) { $status[$name] = $property.Value }
          }
        }
      } catch { }
    }
    if (-not $status.from -and $FromVersion) { $status.from = $FromVersion }
    if (-not $status.to -and $ToVersion) { $status.to = $ToVersion }
    if ($State -eq 'done' -or $State -eq 'error') { $status.finishedAt = (Get-Date).ToString('o') }
    # BOM'suz UTF-8 yaz: panel JSON'u dogrudan okur.
    [IO.File]::WriteAllText($StatusFile, ($status | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
    Add-Content -LiteralPath $UpdateLog -Value ('[{0}] {1}: {2}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $State, $Message) -Encoding UTF8
  } catch { }
}
function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
  $Executable = Join-Path $PgBin ($Tool + '.exe')
  if (-not (Test-Path $Executable)) { throw "Pakette $Tool bulunamadi." }
  $PreviousPreference = $ErrorActionPreference
  $Code = 0
  try {
    # Windows PowerShell 5.1 stderr NOTICE mesajlarini ErrorRecord'a cevirir.
    # Normal bilgileri kaydet; basarisizligi gercek native exit koduyla belirle.
    $ErrorActionPreference = 'Continue'
    & $Executable @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
    $Code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $PreviousPreference }
  if ($Code -ne 0) { throw "$Tool basarisiz oldu (kod $Code). data klasorundeki loglari inceleyin." }
}
function Stop-App {
  if (Test-Path $RuntimeFile) {
    $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    $expected = [IO.Path]::GetFullPath((Join-Path $Root 'node\node.exe'))
    # Baska uygulamalara ait node.exe sureclerine asla dokunma.
    if ($process -and $process.Path -and [IO.Path]::GetFullPath($process.Path) -eq $expected) {
      Stop-Process -Id $runtime.pid -Force
      Wait-Process -Id $runtime.pid -Timeout 15 -ErrorAction SilentlyContinue
    }
    Remove-Item $RuntimeFile -Force -ErrorAction SilentlyContinue
  }
}
function Stop-All {
  Stop-App
  if (Test-Path (Join-Path $PgData 'PG_VERSION')) {
    & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
    if ($LASTEXITCODE -eq 0) { Invoke-Pg -Tool 'pg_ctl' -Arguments @('stop','-D',$PgData,'-m','fast','-w','-t','60') }
  }
  Write-Host 'Personel26 kapatildi. Veriler data, yedekler backups klasorunde korundu.'
}
New-Item -ItemType Directory -Force -Path $Data | Out-Null
if (-not (Test-Path $ConfigFile)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $config = @{ user = 'personel26'; password = [Convert]::ToBase64String($bytes); database = 'personel26'; pgPort = 5433; appPort = 3210 }
  $config | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
  # Yalnizca mevcut kullanici ve SYSTEM bu yerel baglanti dosyasini okuyabilir.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $ConfigFile /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Baglanti dosyasi izinleri ayarlanamadi.' }
}
$Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$env:PGPASSWORD = $Config.password
$PgArgs = @('-h','127.0.0.1','-p',[string]$Config.pgPort,'-U',$Config.user)

function Start-PgServer {
  # pg_ctl start komutu boru hattina (| Write-Host) baglanirsa, arka planda kalan
  # postgres sureci ayni boruyu miras alir ve PowerShell hic bitmez. Bu yuzden
  # sunucu ayri bir surec olarak baslatilir, hazir olana kadar pg_isready ile beklenir.
  $pgCtl = Join-Path $PgBin 'pg_ctl.exe'
  $isReady = Join-Path $PgBin 'pg_isready.exe'
  $log = Join-Path $Data 'postgres.log'
  $args = @('start','-D',('"' + $PgData + '"'),'-o',('"-p ' + $Config.pgPort + ' -c listen_addresses=127.0.0.1"'),'-l',('"' + $log + '"'))
  Start-Process -FilePath $pgCtl -ArgumentList $args -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    & $isReady -h 127.0.0.1 -p ([string]$Config.pgPort) *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL hazir.'; return }
    Start-Sleep -Seconds 1
  }
  throw 'PostgreSQL 60 saniyede baslamadi. data/postgres.log dosyasini inceleyin.'
}
function Ensure-Database {
  if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    $pwfile = Join-Path $Data ('pw-' + [guid]::NewGuid().ToString() + '.tmp')
    try {
      [IO.File]::WriteAllText($pwfile,$Config.password,[Text.Encoding]::ASCII)
      Invoke-Pg -Tool 'initdb' -Arguments @('-D',$PgData,'-U',$Config.user,'-A','scram-sha-256',"--pwfile=$pwfile",'-E','UTF8','--locale=C')
    } finally { Remove-Item $pwfile -Force -ErrorAction SilentlyContinue }
  }
  & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
  if ($LASTEXITCODE -ne 0) {
    Start-PgServer
  }
  $exists = & (Join-Path $PgBin 'psql.exe') @PgArgs -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='personel26'"
  if ($LASTEXITCODE -ne 0) { throw 'Veritabani baglantisi kurulamadı.' }
  if (-not $exists) { Invoke-Pg -Tool 'createdb' -Arguments ($PgArgs + @($Config.database)) }
  $table = & (Join-Path $PgBin 'psql.exe') @PgArgs -d $Config.database -tAc "SELECT to_regclass('public.personnel')"
  if ($LASTEXITCODE -ne 0) { throw 'Sema kontrol edilemedi.' }
  if (-not $table) { Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',(Join-Path $Root 'schema.sql'))) }
  # Her baslatmada idempotent guncelleme; kayitlari silmez.
  Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','-f',(Join-Path $Root 'schema-update.sql')))
}
function Wait-Health {
  $url = "http://127.0.0.1:$($Config.appPort)/api/health"
  for ($i = 0; $i -lt 60; $i++) {
    try { if ((Invoke-RestMethod $url -TimeoutSec 2).ok) { return } } catch { }
    Start-Sleep -Seconds 1
  }
  throw 'Uygulama saglik kontrolu gecmedi. data/app-error.log dosyasini inceleyin.'
}
function Start-App {
  Ensure-Database
  if (Test-Path $RuntimeFile) {
    $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
    $running = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq (Join-Path $Root 'node\node.exe')) { Wait-Health; return }
  }
  $encoded = [Uri]::EscapeDataString($Config.password)
  $env:DATABASE_URL = "postgresql://$($Config.user):${encoded}@127.0.0.1:$($Config.pgPort)/$($Config.database)"
  $env:PORT = [string]$Config.appPort
  $env:HOSTNAME = '127.0.0.1'
  $env:NODE_ENV = 'production'
  # Panelin guncelleme uclari kurulum ve veri klasorunu buradan ogrenir.
  $env:P26_ROOT = $Root
  $env:P26_DATA_DIR = $Data
  $env:P26_BACKUP_DIR = $BackupsDir
  $app = Start-Process -FilePath (Join-Path $Root 'node\node.exe') -ArgumentList @('server.js') -WorkingDirectory (Join-Path $Root 'app') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Data 'app.log') -RedirectStandardError (Join-Path $Data 'app-error.log')
  @{pid=$app.Id; root=$Root} | ConvertTo-Json | Set-Content $RuntimeFile -Encoding UTF8
  try { Wait-Health } catch { Stop-App; throw }
}
function Remove-OldBackups {
  if (-not (Test-Path $BackupsDir)) { return }
  $limit = (Get-Date).Date.AddDays(-$BackupRetentionDays)
  Get-ChildItem -LiteralPath $BackupsDir -Filter 'personel26-*.sql' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $limit } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
}
function Native-Backup([string]$Destination) {
  Ensure-Database
  if (-not $Destination) {
    New-Item -ItemType Directory -Force -Path $BackupsDir | Out-Null
    $Destination = Join-Path $BackupsDir ('personel26-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.sql')
  }
  Invoke-Pg -Tool 'pg_dump' -Arguments ($PgArgs + @('-d',$Config.database,'--clean','--if-exists','--no-owner','--no-privileges','-f',$Destination))
  if (-not (Test-Path $Destination) -or (Get-Item $Destination).Length -eq 0) { throw 'SQL yedegi olusturulamadi.' }
  Remove-OldBackups
  Write-Host "SQL yedegi: $Destination"
  return $Destination
}
function Backup-BeforeStop {
  # Program kapatilirken (Durdur kisayolu veya kaldirma) veritabani calisiyorsa
  # son bir SQL yedegi alinir. Hata kapanmayi engellemez.
  try {
    if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) { return }
    if (-not (Test-Path (Join-Path $PgBin 'pg_ctl.exe'))) { return }
    & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
    if ($LASTEXITCODE -ne 0) { return }
    Native-Backup '' | Out-Null
    Write-Host 'Kapanmadan once otomatik SQL yedegi alindi.'
  } catch {
    Write-Warning ('Kapanis yedegi alinamadi: ' + $_.Exception.Message)
  }
}
# Kapatma, paket dosyalari eksik olsa bile calisir ve veritabani acikken yedek alir.
# Tum fonksiyonlar tanimlandiktan sonra cagrilmalidir.
if ($Action -eq 'Stop') { Backup-BeforeStop; Stop-All; exit 0 }
if (-not (Test-Path (Join-Path $Root 'node\node.exe')) -or -not (Test-Path (Join-Path $PgBin 'postgres.exe'))) { throw 'Pakette tasinabilir Node.js veya PostgreSQL eksik.' }
switch ($Action) {
  'Start' { Start-App; if (-not $NoBrowser -and $env:P26_NO_BROWSER -ne '1') { Start-Process "http://127.0.0.1:$($Config.appPort)" }; Write-Host 'Personel26 hazir.' }
  'Backup' { Native-Backup $BackupFile | Out-Null }
  'Restore' {
    if (-not $BackupFile -or -not (Test-Path $BackupFile) -or [IO.Path]::GetExtension($BackupFile) -ne '.sql') { throw 'Gecerli bir Personel26 SQL yedegi secin.' }
    Stop-App; Ensure-Database
    $safety = Native-Backup ''
    Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',$BackupFile))
    Start-App
    Write-Host "Geri yukleme tamamlandi. Guvenlik yedegi: $safety"
  }
  'Update' {
    if (-not $PackagePath -or -not (Test-Path (Join-Path $PackagePath 'app\server.js'))) { throw 'Yeni portable paket klasorunu belirtin.' }
    Write-UpdateStatus 'stopping' 'Uygulama kapatiliyor...'
    Stop-App; Ensure-Database
    Write-UpdateStatus 'backing-up' 'Veritabani guvenlik yedegi aliniyor...'
    $safety = Native-Backup ''
    Write-UpdateStatus 'installing' 'Yeni surum dosyalari yerlestiriliyor...'
    $old = Join-Path $Data 'app-before-update'
    $resourcesOld = Join-Path $Data 'resources-before-update'
    $scriptBackup = Join-Path $Data 'root-before-update'
    # Kok dizindeki baslatici/sema dosyalari da yeni surumle gelir; geri donus icin sakla.
    $rootFiles = @('Personel26.exe','personel26.ico','Personel26-Yonet.ps1','Personel26-Guncelle.ps1','Personel26-Baslat.bat','Personel26-Durdur.bat','Personel26-Yedekle.bat','schema.sql','schema-update.sql','BENIOKU.md')
    if (Test-Path $old) { Remove-Item $old -Recurse -Force }
    if (Test-Path $resourcesOld) { Remove-Item $resourcesOld -Recurse -Force }
    if (Test-Path $scriptBackup) { Remove-Item $scriptBackup -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $scriptBackup | Out-Null
    foreach ($file in $rootFiles) {
      $source = Join-Path $Root $file
      if (Test-Path $source) { Copy-Item $source (Join-Path $scriptBackup $file) -Force }
    }
    Move-Item (Join-Path $Root 'app') $old
    $hadResources = Test-Path (Join-Path $Root 'resources')
    if ($hadResources) { Move-Item (Join-Path $Root 'resources') $resourcesOld }
    try {
      Copy-Item (Join-Path $PackagePath 'app') (Join-Path $Root 'app') -Recurse -Force
      if (Test-Path (Join-Path $PackagePath 'resources')) {
        Copy-Item (Join-Path $PackagePath 'resources') (Join-Path $Root 'resources') -Recurse -Force
      }
      foreach ($file in $rootFiles) {
        $source = Join-Path $PackagePath $file
        if (Test-Path $source) { Copy-Item $source (Join-Path $Root $file) -Force }
      }
      Write-UpdateStatus 'restarting' 'Yeni surum baslatiliyor ve saglik kontrolu yapiliyor...'
      Start-App
      Remove-Item $old -Recurse -Force
      Remove-Item $resourcesOld -Recurse -Force -ErrorAction SilentlyContinue
      Remove-Item $scriptBackup -Recurse -Force -ErrorAction SilentlyContinue
      $label = if ($ToVersion) { $ToVersion } else { 'yeni' }
      Write-UpdateStatus 'done' ("Personel26 {0} surumune guncellendi. Veriler korundu." -f $label)
      Write-Host "Guncelleme tamamlandi. Veriler korundu. Guvenlik yedegi: $safety"
    } catch {
      Write-UpdateStatus 'error' 'Guncelleme basarisiz; onceki surum geri yuklendi. Ayrintilar data/updates/update.log dosyasinda.'
      Stop-App
      if (Test-Path (Join-Path $Root 'app')) { Remove-Item (Join-Path $Root 'app') -Recurse -Force }
      Move-Item $old (Join-Path $Root 'app')
      if (Test-Path (Join-Path $Root 'resources')) { Remove-Item (Join-Path $Root 'resources') -Recurse -Force }
      if ($hadResources -and (Test-Path $resourcesOld)) { Move-Item $resourcesOld (Join-Path $Root 'resources') }
      foreach ($file in $rootFiles) {
        $backup = Join-Path $scriptBackup $file
        if (Test-Path $backup) { Copy-Item $backup (Join-Path $Root $file) -Force }
      }
      Start-App
      throw 'Guncelleme basarisiz; onceki uygulama geri alindi. SQL guvenlik yedegi backups klasorunde.'
    }
  }
}
