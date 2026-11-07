#define AppName "Personel26"
; Surum numarasi windows\kurulum-olustur.ps1 tarafindan /DAppVersion ile verilir.
; Kurulum dosyasini bu betikle derleyin; dogrudan ISCC kullanmayin.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define PortableDir "..\Personel26-Portable"
[Setup]
AppId={{7E1B2A64-9C3D-4B8F-A2E5-P26PUANTAJ01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Personel26
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
OutputDir=.
OutputBaseFilename=Personel26-Kurulum
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
SetupIconFile=personel26.ico
UninstallDisplayName={#AppName} — Puantaj ve Nöbet Yönetimi
UninstallDisplayIcon={app}\Personel26.exe
UninstallFilesDir={app}\uninstall
CloseApplications=no
[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
[Files]
Source: "{#PortableDir}\*"; DestDir: "{app}"; Excludes: "data\*,backups\*"; Flags: recursesubdirs createallsubdirs ignoreversion
[Dirs]
; Kullanici yedekleri burada toplanir; kaldirma/guncelleme bu dosyalara dokunmaz.
Name: "{app}\backups"
[Icons]
; Tum kisayollar ikonlu Personel26.exe'yi acar; .bat dosyasi kullaniciya gosterilmez.
Name: "{group}\{#AppName}"; Filename: "{app}\Personel26.exe"; WorkingDir: "{app}"; Comment: "Personel26 panelini ac"
Name: "{group}\{#AppName} — Yedek Al"; Filename: "{app}\Personel26.exe"; Parameters: "--backup"; WorkingDir: "{app}"; Comment: "SQL yedegi olustur"
Name: "{group}\{#AppName} — Durdur"; Filename: "{app}\Personel26.exe"; Parameters: "--stop"; WorkingDir: "{app}"; Comment: "Personel26'yi kapat"
Name: "{group}\{#AppName} Kaldır"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\Personel26.exe"; WorkingDir: "{app}"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Kısayollar:"
[Run]
Filename: "{app}\Personel26.exe"; Description: "{#AppName} şimdi başlatılsın"; Flags: postinstall nowait skipifsilent
[UninstallRun]
Filename: "{app}\Personel26.exe"; Parameters: "--stop --quiet"; Flags: runhidden; RunOnceId: "StopP26"
[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  Launcher: String;
begin
  Result := '';
  Launcher := ExpandConstant('{app}\Personel26.exe');
  if FileExists(Launcher) then
  begin
    // Onceki surumun ikonlu baslaticisi kapanis yedegini de alarak uygulamayi kapatir.
    if not Exec(Launcher, '--stop --quiet', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := 'Güncelleme öncesinde Personel26 kapatılamadı.'
    else if ResultCode <> 0 then
      Result := 'Personel26 kapatma işlemi başarısız. Uygulamayı kapatıp tekrar deneyin.';
  end
  else if FileExists(ExpandConstant('{app}\Personel26-Durdur.bat')) then
  begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\Personel26-Yonet.ps1') + '" -Action Stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := 'Güncelleme öncesinde Personel26 kapatılamadı.'
    else if ResultCode <> 0 then
      Result := 'Personel26 kapatma işlemi başarısız. Uygulamayı kapatıp tekrar deneyin.';
  end;
end;
// Veritabanı sonradan data/ içinde oluşur ve Inno Setup tarafından kaydedilmez.
// Kaldırma veya güncelleme sırasında data/ asla silinmez.
