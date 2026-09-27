; ============================================================
;  Personel26 — Windows Kurulum Paketi (Inno Setup 6)
;  Kullanım:
;   1) Önce taşınabilir paketi üretin:  windows\paket-olustur.ps1
;   2) Inno Setup'ı kurun: https://jrsoftware.org/isdl.php
;   3) Bu dosyayı Inno Setup Compiler ile açıp "Compile" deyin.
;  Çıktı: Personel26-Kurulum.exe  (masaüstü + başlat menüsü
;  kısayolları, kaldırma desteği, veriler korunur)
; ============================================================

#define AppName "Personel26"
#define AppVersion "1.0.0"
#define AppPublisher "Personel26"
#define PortableDir "..\Personel26-Portable"

[Setup]
AppId={{7E1B2A64-9C3D-4B8F-A2E5-1F26A0B3C4D5}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
; Kullanıcı klasörüne kurulur (%LOCALAPPDATA%\Programs\Personel26):
; veritabanı data\ klasörüne yazabilmek için yönetici izni gerekmez.
; (Program Files'a kurulursa normal kullanıcı data\ oluşturamaz.)
DefaultDirName={userpf}\{#AppName}
DefaultGroupName={#AppName}
OutputDir=.
OutputBaseFilename=Personel26-Kurulum
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayName={#AppName} — Puantaj ve Nöbet Yönetimi
; Kaldırırken veritabanını SİLME (data\ klasörü korunur)
UninstallFilesDir={app}\uninstall

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Files]
; Taşınabilir paketin tamamı kurulur (data\ hariç — o ilk çalıştırmada oluşur)
Source: "{#PortableDir}\*"; DestDir: "{app}"; \
  Excludes: "data\*"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName} Başlat";  Filename: "{app}\Personel26-Baslat.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} Durdur";  Filename: "{app}\Personel26-Durdur.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} Kaldır";  Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}";   Filename: "{app}\Personel26-Baslat.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Kısayollar:"

[Run]
Filename: "{app}\Personel26-Baslat.bat"; Description: "{#AppName} şimdi başlatılsın"; \
  Flags: postinstall nowait skipifsilent shellexec

[UninstallRun]
; Kaldırmadan önce servisleri durdur
Filename: "{app}\Personel26-Durdur.bat"; Flags: runhidden; RunOnceId: "StopP26"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if MsgBox('Veritabanı (puantaj, nöbet, personel kayıtları) da silinsin mi?' + #13#10 +
              'HAYIR derseniz verileriniz ' + ExpandConstant('{app}') + '\data içinde korunur.',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec('cmd.exe', '/c rmdir /s /q "' + ExpandConstant('{app}') + '\data"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
