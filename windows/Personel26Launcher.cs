using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("Personel26")]
[assembly: System.Reflection.AssemblyDescription("Personel26 Puantaj ve Nobet Yonetimi")]
[assembly: System.Reflection.AssemblyCompany("Personel26")]
[assembly: System.Reflection.AssemblyProduct("Personel26")]
[assembly: System.Reflection.AssemblyCopyright("Personel26")]

namespace Personel26
{
    internal static class Program
    {
        private const int DefaultPort = 3210;
        private const int StartupTimeoutSeconds = 300;

        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool quiet = Has(args, "--quiet");
            bool startOnly = Has(args, "--start-only");
            // Bu mod otomasyon ve test icindir; hata olsa bile pencere acip beklemez.
            if (startOnly) quiet = true;
            bool noBrowser = startOnly || Has(args, "--no-browser");
            bool forceBrowser = Has(args, "--browser");
            bool smokeTest = Has(args, "--webview-test");
            if (smokeTest) quiet = true;
            string root = Path.GetDirectoryName(Application.ExecutablePath);
            Log(root, "Baslatildi: " + string.Join(" ", args));

            try
            {
                if (Has(args, "--stop")) return Stop(root, quiet);
                if (Has(args, "--backup")) return Backup(root, quiet);
                return Start(root, quiet, noBrowser || startOnly, forceBrowser, smokeTest);
            }
            catch (Exception ex)
            {
                Log(root, "HATA: " + ex);
                if (!quiet && !smokeTest) ShowError("Personel26 baslatilamadi.\n\n" + ex.Message);
                return 1;
            }
        }

        private static int Start(string root, bool quiet, bool noBrowser, bool forceBrowser, bool smokeTest)
        {
            int port = ReadPort(root);
            Log(root, "Start: port=" + port + " noBrowser=" + noBrowser);
            if (Healthy(port))
            {
                Log(root, "Start: sunucu zaten calisiyor");
                if (!noBrowser) return OpenUi(port, forceBrowser, root, smokeTest);
                return 0;
            }

            bool ownsMutex;
            using (Mutex mutex = new Mutex(true, @"Local\Personel26.Startup", out ownsMutex))
            {
                if (!ownsMutex)
                {
                    // Baska bir baslatici aciliyor; panel hazir olunca ayni pencereyi ac.
                    for (int i = 0; i < 240; i++)
                    {
                        if (Healthy(port))
                        {
                            if (!noBrowser) return OpenUi(port, forceBrowser, root, smokeTest);
                            return 0;
                        }
                        Thread.Sleep(500);
                    }
                    if (!quiet) ShowError("Personel26 hâlâ hazırlanıyor. Birkaç saniye sonra tekrar deneyin.");
                    return 1;
                }

                RunResult result = RunManager(root, "Start", null, StartupTimeoutSeconds, !quiet && !noBrowser,
                    "Sunucu ve veritabanı hazırlanıyor…");

                if (result.TimedOut)
                {
                    Log(root, "Start: yonetim zaman asimi");
                    if (!quiet) ShowError("Personel26 zamanında başlatılamadı.\n\nAyrıntılar: " + Path.Combine(root, @"data\app-error.log"));
                    return 1;
                }
                if (result.ExitCode != 0)
                {
                    Log(root, "Start: yonetim basarisiz, kod=" + result.ExitCode + " cikti=" + Tail(result.Output));
                    if (!quiet) ShowError("Personel26 başlatılamadı.\n\n" + Tail(result.Output) +
                        "\n\nGünlükler: " + Path.Combine(root, @"data\app-error.log"));
                    return result.ExitCode == 0 ? 1 : result.ExitCode;
                }

                port = ReadPort(root);
                for (int i = 0; i < 40 && !Healthy(port); i++) Thread.Sleep(250);
                if (!Healthy(port))
                {
                    Log(root, "Start: saglik kontrolu basarisiz");
                    if (!quiet) ShowError("Sunucu açıldı ancak panel yanıt vermiyor.\n\nAyrıntılar: " + Path.Combine(root, @"data\app-error.log"));
                    return 1;
                }
                Log(root, "Start: panel hazir");
                if (!noBrowser) return OpenUi(port, forceBrowser, root, smokeTest);
                return 0;
            }
        }

        private static int Stop(string root, bool quiet)
        {
            RunResult result = RunManager(root, "Stop", null, 120, !quiet, "Personel26 kapatılıyor…");
            if (result.TimedOut)
            {
                if (!quiet) ShowError("Personel26 zamanında kapatılamadı.");
                return 1;
            }
            if (result.ExitCode != 0)
            {
                if (!quiet) ShowError("Personel26 kapatılamadı.\n\n" + Tail(result.Output));
                return result.ExitCode;
            }
            if (!quiet)
            {
                MessageBox.Show("Personel26 kapatıldı.\n\nKapanış yedeği kurulum klasöründeki backups dizinine alındı.",
                    "Personel26", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            return 0;
        }

        private static int Backup(string root, bool quiet)
        {
            RunResult result = RunManager(root, "Backup", null, 180, !quiet, "SQL yedeği alınıyor…");
            if (result.TimedOut)
            {
                if (!quiet) ShowError("Yedek zamanında tamamlanamadı.");
                return 1;
            }
            if (result.ExitCode != 0)
            {
                if (!quiet) ShowError("SQL yedeği alınamadı.\n\n" + Tail(result.Output));
                return result.ExitCode;
            }

            string file = NewestBackup(root);
            if (!quiet)
            {
                string message = file != null
                    ? "SQL yedeğiniz hazır.\n\n" + file
                    : "SQL yedeği alındı.\n\nKlasör: " + BackupDirectory(root);
                DialogResult answer = MessageBox.Show(message + "\n\nYedek klasörünü açmak ister misiniz?",
                    "Personel26 — Yedek hazır", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (answer == DialogResult.Yes) OpenBackupFolder(file);
            }
            return 0;
        }

        private class RunResult
        {
            public int ExitCode;
            public string Output = "";
            public bool TimedOut;
        }

        private static RunResult RunManager(string root, string action, string[] extra, int timeoutSeconds, bool showSplash, string status)
        {
            string script = Path.Combine(root, "Personel26-Yonet.ps1");
            if (!File.Exists(script)) throw new FileNotFoundException("Personel26-Yonet.ps1 bulunamadı.", script);

            string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                @"WindowsPowerShell\v1.0\powershell.exe");
            if (!File.Exists(powershell)) powershell = "powershell.exe";

            StringBuilder arguments = new StringBuilder();
            arguments.Append("-NoProfile -ExecutionPolicy Bypass -File \"");
            arguments.Append(script);
            arguments.Append("\" -Action ").Append(action).Append(" -NoBrowser");
            if (extra != null)
            {
                foreach (string item in extra)
                {
                    arguments.Append(" \"").Append(item.Replace("\"", "\\\"")).Append('"');
                }
            }

            ProcessStartInfo info = new ProcessStartInfo(powershell, arguments.ToString());
            info.WorkingDirectory = root;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            StringBuilder output = new StringBuilder();
            object gate = new object();
            RunResult result = new RunResult();

            using (Process process = new Process())
            {
                process.StartInfo = info;
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (e.Data == null) return;
                    lock (gate) { if (output.Length < 30000) output.AppendLine(e.Data); }
                };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (e.Data == null) return;
                    lock (gate) { if (output.Length < 30000) output.AppendLine(e.Data); }
                };

                SplashForm splash = null;
                try
                {
                    if (showSplash)
                    {
                        splash = new SplashForm(status);
                        splash.Show();
                        splash.Refresh();
                        Application.DoEvents();
                    }

                    Log(root, "Yonetim basliyor: " + action);
                    process.Start();
                    Log(root, "Yonetim PID: " + process.Id);
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    Stopwatch watch = Stopwatch.StartNew();
                    int port = ReadPort(root);
                    DateTime nextHealth = DateTime.UtcNow;
                    while (!process.HasExited && watch.Elapsed.TotalSeconds < timeoutSeconds)
                    {
                        if (splash != null)
                        {
                            if (DateTime.UtcNow >= nextHealth)
                            {
                                nextHealth = DateTime.UtcNow.AddSeconds(2);
                                if (Healthy(port)) splash.SetStatus("Panel hazırlanıyor…");
                            }
                            splash.Pump();
                        }
                        Thread.Sleep(150);
                    }

                    if (!process.HasExited)
                    {
                        Log(root, "Yonetim zaman asimi: " + action);
                        result.TimedOut = true;
                        lock (gate) result.Output = output.ToString();
                        return result;
                    }

                    // Parametresiz WaitForExit, alt sureclerin miras aldigi cikti
                    // borularini bekleyebilir. Surec zaten bitmis; kisa ve sinirli
                    // bekleme yeterli, aksi halde baslatici sonsuza kadar asili kalir.
                    try { process.CancelOutputRead(); } catch { }
                    try { process.CancelErrorRead(); } catch { }
                    process.WaitForExit(2000);
                    result.ExitCode = process.ExitCode;
                    lock (gate) result.Output = output.ToString();
                    Log(root, "Yonetim bitti: " + action + " kod=" + result.ExitCode);
                    if (splash != null) splash.SetStatus(result.ExitCode == 0 ? "Hazır." : "İşlem tamamlanamadı.");
                    return result;
                }
                finally
                {
                    if (splash != null)
                    {
                        if (!splash.IsDisposed)
                        {
                            splash.Close();
                            splash.Dispose();
                        }
                    }
                }
            }
        }

        private static int ReadPort(string root)
        {
            try
            {
                string path = Path.Combine(root, @"data\connection.json");
                if (!File.Exists(path)) return DefaultPort;
                string text = File.ReadAllText(path, Encoding.UTF8).TrimStart('\uFEFF');
                Match match = Regex.Match(text, "\"appPort\"\\s*:\\s*(\\d+)");
                if (match.Success)
                {
                    int value;
                    if (int.TryParse(match.Groups[1].Value, out value) && value > 0 && value < 65536) return value;
                }
            }
            catch { }
            return DefaultPort;
        }

        private static bool Healthy(int port)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                request.Timeout = 1500;
                request.ReadWriteTimeout = 1500;
                request.Proxy = null;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                {
                    string body = reader.ReadToEnd();
                    return response.StatusCode == HttpStatusCode.OK && body.IndexOf("\"ok\":true", StringComparison.OrdinalIgnoreCase) >= 0;
                }
            }
            catch { return false; }
        }

        /**
         * Varsayilan acilis artik tarayici degil, uygulamanin kendi WebView2
         * penceresidir. Adres cubugu, sekme ve localhost adresi kullaniciya
         * gosterilmez. Sunucu yalnizca bu bilgisayarda, 127.0.0.1 uzerinde
         * calisir; disariya acilmaz.
         *
         * --browser yalnizca sorun giderme icin dis tarayiciyi acar.
         */
        private static int OpenUi(int port, bool forceBrowser, string root, bool smokeTest)
        {
            string url = "http://127.0.0.1:" + port + "/";
            if (forceBrowser)
            {
                OpenExternal(url);
                return 0;
            }

            if (!WebView2Available())
            {
                Log(root, "WebView2 runtime bulunamadi");
                if (!smokeTest)
                {
                    DialogResult answer = MessageBox.Show(
                        "Personel26'nın kendi penceresinde açılması için Microsoft Edge WebView2 Runtime gerekir.\n\n" +
                        "Windows 10/11'de bu bileşen genellikle hazırdır. Şimdi indirme sayfasını açmak ister misiniz?",
                        "Personel26 — WebView2 gerekli", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                    if (answer == DialogResult.Yes)
                        OpenExternal("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                }
                return 1;
            }

            using (AppWindow window = new AppWindow(url, root, smokeTest))
            {
                Application.Run(window);
                return window.ExitCode;
            }
        }

        private static bool WebView2Available()
        {
            try
            {
                string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                return !string.IsNullOrEmpty(version);
            }
            catch { return false; }
        }

        internal static bool TryOpenExternal(string target)
        {
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(target);
                info.UseShellExecute = true;
                Process.Start(info);
                return true;
            }
            catch { return false; }
        }

        internal static void OpenExternal(string target)
        {
            TryOpenExternal(target);
        }

        private static string BackupDirectory(string root)
        {
            string custom = Environment.GetEnvironmentVariable("P26_BACKUP_DIR");
            if (!string.IsNullOrEmpty(custom)) return custom;
            return Path.Combine(root, "backups");
        }

        private static string NewestBackup(string root)
        {
            try
            {
                string directory = BackupDirectory(root);
                if (!Directory.Exists(directory)) return null;
                string[] files = Directory.GetFiles(directory, "personel26-*.sql");
                string newest = null;
                DateTime newestTime = DateTime.MinValue;
                foreach (string file in files)
                {
                    DateTime time = File.GetLastWriteTimeUtc(file);
                    if (time > newestTime)
                    {
                        newestTime = time;
                        newest = file;
                    }
                }
                return newest;
            }
            catch { return null; }
        }

        private static void OpenBackupFolder(string file)
        {
            try
            {
                if (file != null && File.Exists(file))
                {
                    Process.Start("explorer.exe", "/select,\"" + file + "\"");
                }
                else
                {
                    string directory = file != null ? Path.GetDirectoryName(file) : BackupDirectory(Path.GetDirectoryName(Application.ExecutablePath));
                    Process.Start("explorer.exe", "\"" + (directory ?? "") + "\"");
                }
            }
            catch { }
        }

        private static string Tail(string output)
        {
            if (string.IsNullOrEmpty(output)) return "Ayrıntılı bilgi günlük dosyalarında.";
            string[] lines = output.Replace("\r", "").Split('\n');
            int start = Math.Max(0, lines.Length - 8);
            StringBuilder tail = new StringBuilder();
            for (int i = start; i < lines.Length; i++)
            {
                if (lines[i].Trim().Length == 0) continue;
                tail.AppendLine(lines[i].Trim());
            }
            return tail.ToString().Trim();
        }

        internal static void Log(string root, string message)
        {
            try
            {
                string directory = Path.Combine(root, "data");
                if (!Directory.Exists(directory)) Directory.CreateDirectory(directory);
                string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine;
                lock (typeof(Program))
                {
                    File.AppendAllText(Path.Combine(directory, "launcher.log"), line, new UTF8Encoding(false));
                }
            }
            catch { }
        }

        private static bool Has(string[] args, string name)
        {
            foreach (string arg in args)
            {
                if (string.Equals(arg, name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static void ShowError(string message)
        {
            MessageBox.Show(message, "Personel26", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    /**
     * Uygulamanin kendi masaustu penceresi. WebView2, paneli tam ekran
     * kullanilabilen normal bir Windows uygulamasi gibi gosterir.
     */
    internal sealed class AppWindow : Form
    {
        private readonly WebView2 view;
        private readonly string startUrl;
        private readonly string root;
        private readonly bool smokeTest;
        private readonly System.Windows.Forms.Timer smokeTimer;
        private bool fullScreen;
        private FormBorderStyle normalBorder;
        private FormWindowState normalState;
        private bool navigationDone;
        public int ExitCode;

        public AppWindow(string url, string root, bool smokeTest)
        {
            this.startUrl = url;
            this.root = root;
            this.smokeTest = smokeTest;
            Text = "Personel26 — Puantaj ve Nöbet Yönetimi";
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = smokeTest ? FormWindowState.Normal : FormWindowState.Maximized;
            if (smokeTest)
            {
                ShowInTaskbar = false;
                Opacity = 0;
                Size = new Size(1280, 800);
            }
            MinimumSize = new Size(1100, 720);
            BackColor = Color.FromArgb(7, 11, 20);
            KeyPreview = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            view = new WebView2();
            view.Dock = DockStyle.Fill;
            view.BackColor = Color.FromArgb(7, 11, 20);
            Controls.Add(view);

            Shown += OnShown;
            FormClosed += delegate { if (smokeTimer != null) smokeTimer.Stop(); };

            if (smokeTest)
            {
                smokeTimer = new System.Windows.Forms.Timer();
                smokeTimer.Interval = 30000;
                smokeTimer.Tick += delegate
                {
                    smokeTimer.Stop();
                    Program.Log(root, "WebView testi zaman asimi");
                    ExitCode = 1;
                    Close();
                };
                smokeTimer.Start();
            }
        }

        private async void OnShown(object sender, EventArgs e)
        {
            try
            {
                string userData = Path.Combine(root, @"data\webview2");
                if (!Directory.Exists(userData)) Directory.CreateDirectory(userData);
                CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions(
                    "--autoplay-policy=no-user-gesture-required --disable-features=Translate");
                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, userData, options);
                await view.EnsureCoreWebView2Async(environment);

                CoreWebView2 core = view.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = true;
                core.Settings.AreBrowserAcceleratorKeysEnabled = true;
                core.Settings.IsZoomControlEnabled = true;

                core.NavigationStarting += OnNavigationStarting;
                core.NavigationCompleted += OnNavigationCompleted;
                core.NewWindowRequested += OnNewWindowRequested;
                core.DownloadStarting += OnDownloadStarting;
                core.ContainsFullScreenElementChanged += OnContainsFullScreenElementChanged;
                core.DocumentTitleChanged += delegate
                {
                    if (!string.IsNullOrEmpty(core.DocumentTitle))
                        Text = core.DocumentTitle + " — Personel26";
                };
                core.ProcessFailed += OnProcessFailed;

                view.Source = new Uri(startUrl);
            }
            catch (Exception ex)
            {
                Program.Log(root, "WebView2 baslatma hatasi: " + ex);
                ExitCode = 1;
                if (!smokeTest)
                    MessageBox.Show("Panel penceresi açılamadı.\n\n" + ex.Message, "Personel26",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            Uri uri;
            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri)) return;
            if (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == "file") return;

            // whatsapp:, mailto:, tel: gibi adresler Windows'ta varsayilan
            // uygulamayla acilir. WebView2'de hata sayfasi gosterilmez.
            e.Cancel = true;
            if (uri.Scheme == "whatsapp")
            {
                // WhatsApp Desktop yoksa web WhatsApp'a dus. Boylece kullanici
                // "hicbir sey olmadi" durumunda kalmez.
                if (!Program.TryOpenExternal(e.Uri)) view.CoreWebView2.Navigate(WhatsAppWebUrl(uri));
                return;
            }
            Program.OpenExternal(e.Uri);
        }

        private static string WhatsAppWebUrl(Uri uri)
        {
            string phone = "";
            string text = "";
            string query = uri.Query.TrimStart('?');
            foreach (string pair in query.Split('&'))
            {
                int split = pair.IndexOf('=');
                if (split <= 0) continue;
                string key = Uri.UnescapeDataString(pair.Substring(0, split));
                string value = Uri.UnescapeDataString(pair.Substring(split + 1));
                if (key == "phone") phone = value;
                else if (key == "text") text = value;
            }
            string target = "https://wa.me/" + phone;
            if (!string.IsNullOrEmpty(text)) target += "?text=" + Uri.EscapeDataString(text);
            return target;
        }

        private async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!smokeTest || navigationDone) return;
            navigationDone = true;
            if (!e.IsSuccess)
            {
                Program.Log(root, "WebView testi navigasyon hatasi: " + e.WebErrorStatus);
                ExitCode = 1;
                Close();
                return;
            }
            try
            {
                // Panelin gercekten render edildigini ve sol menusunun geldigini dogrula.
                string result = await view.CoreWebView2.ExecuteScriptAsync(
                    "document.body.innerText.indexOf('Personel26') >= 0 && document.querySelectorAll('aside nav button').length > 0 ? 'ok' : 'fail'");
                Program.Log(root, "WebView testi sonucu: " + result);
                ExitCode = result.IndexOf("ok", StringComparison.OrdinalIgnoreCase) >= 0 ? 0 : 1;
            }
            catch (Exception ex)
            {
                Program.Log(root, "WebView testi hatasi: " + ex);
                ExitCode = 1;
            }
            Close();
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            Program.OpenExternal(e.Uri);
        }

        private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            if (smokeTest)
            {
                e.Cancel = true;
                return;
            }
            try
            {
                string suggested = Path.GetFileName(e.ResultFilePath);
                if (string.IsNullOrEmpty(suggested)) suggested = "personel26-indirme";
                using (SaveFileDialog dialog = new SaveFileDialog())
                {
                    dialog.Title = "Dosyayı kaydet";
                    dialog.FileName = suggested;
                    dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + @"\Downloads";
                    dialog.Filter = "Tüm dosyalar (*.*)|*.*";
                    dialog.OverwritePrompt = true;
                    if (dialog.ShowDialog(this) == DialogResult.OK)
                    {
                        e.ResultFilePath = dialog.FileName;
                        e.Handled = true;
                    }
                    else
                    {
                        e.Cancel = true;
                    }
                }
            }
            catch
            {
                // WebView2'nin kendi indirme akisina birak.
            }
        }

        private void OnContainsFullScreenElementChanged(object sender, object e)
        {
            try
            {
                if (view.CoreWebView2 != null)
                    SetFullScreen(view.CoreWebView2.ContainsFullScreenElement);
            }
            catch { }
        }

        private void OnProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs e)
        {
            Program.Log(root, "WebView2 surec hatasi: " + e.ProcessFailedKind);
        }

        private void SetFullScreen(bool value)
        {
            if (fullScreen == value) return;
            fullScreen = value;
            if (value)
            {
                normalBorder = FormBorderStyle;
                normalState = WindowState;
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Maximized;
            }
            else
            {
                FormBorderStyle = normalBorder == FormBorderStyle.None ? FormBorderStyle.Sizable : normalBorder;
                WindowState = normalState == FormWindowState.Minimized ? FormWindowState.Normal : normalState;
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F11)
            {
                SetFullScreen(!fullScreen);
                return true;
            }
            if (keyData == Keys.Escape && fullScreen)
            {
                SetFullScreen(false);
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }
    }

    internal sealed class SplashForm : Form
    {
        private readonly Label statusLabel;
        private readonly ProgressBar progress;

        public SplashForm(string status)
        {
            Text = "Personel26";
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            MinimizeBox = false;
            ControlBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(440, 238);
            BackColor = Color.FromArgb(11, 18, 32);
            ForeColor = Color.White;
            TopMost = true;
            ShowInTaskbar = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            PictureBox logo = new PictureBox();
            logo.Location = new Point(26, 28);
            logo.Size = new Size(66, 66);
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            logo.BackColor = Color.Transparent;
            try { logo.Image = Icon.ExtractAssociatedIcon(Application.ExecutablePath).ToBitmap(); } catch { }
            Controls.Add(logo);

            Label title = new Label();
            title.Text = "Personel26";
            title.Font = new Font("Segoe UI", 17F, FontStyle.Bold);
            title.ForeColor = Color.White;
            title.AutoSize = true;
            title.Location = new Point(108, 30);
            Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "Puantaj & Nöbet Yönetimi";
            subtitle.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
            subtitle.ForeColor = Color.FromArgb(148, 163, 184);
            subtitle.AutoSize = true;
            subtitle.Location = new Point(110, 65);
            Controls.Add(subtitle);

            statusLabel = new Label();
            statusLabel.Text = status;
            statusLabel.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(203, 213, 225);
            statusLabel.AutoSize = false;
            statusLabel.Location = new Point(28, 126);
            statusLabel.Size = new Size(384, 24);
            Controls.Add(statusLabel);

            progress = new ProgressBar();
            progress.Location = new Point(28, 154);
            progress.Size = new Size(384, 7);
            progress.Style = ProgressBarStyle.Marquee;
            progress.MarqueeAnimationSpeed = 24;
            Controls.Add(progress);

            Label footer = new Label();
            footer.Text = "Verileriniz bu bilgisayarda kalır · İlk açılış 1-2 dakika sürebilir";
            footer.Font = new Font("Segoe UI", 8.2F, FontStyle.Regular);
            footer.ForeColor = Color.FromArgb(100, 116, 139);
            footer.AutoSize = true;
            footer.Location = new Point(28, 190);
            Controls.Add(footer);
        }

        public void SetStatus(string text)
        {
            if (!IsDisposed && statusLabel != null) statusLabel.Text = text;
        }

        public void Pump()
        {
            if (IsDisposed) return;
            Application.DoEvents();
        }
    }
}
