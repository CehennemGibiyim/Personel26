using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Personel26")]
[assembly: System.Reflection.AssemblyDescription("Personel26 Puantaj ve Nobet Yonetimi baslaticisi")]
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
            bool noBrowser = startOnly || Has(args, "--no-browser");
            bool forceBrowser = Has(args, "--browser");
            string root = Path.GetDirectoryName(Application.ExecutablePath);

            try
            {
                if (Has(args, "--stop")) return Stop(root, quiet);
                if (Has(args, "--backup")) return Backup(root, quiet);
                return Start(root, quiet, noBrowser || startOnly, forceBrowser);
            }
            catch (Exception ex)
            {
                if (!quiet) ShowError("Personel26 baslatilamadi.\n\n" + ex.Message);
                return 1;
            }
        }

        private static int Start(string root, bool quiet, bool noBrowser, bool forceBrowser)
        {
            int port = ReadPort(root);
            if (Healthy(port))
            {
                if (!noBrowser) OpenUi(port, forceBrowser);
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
                            if (!noBrowser) OpenUi(port, forceBrowser);
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
                    if (!quiet) ShowError("Personel26 zamanında başlatılamadı.\n\nAyrıntılar: " + Path.Combine(root, @"data\app-error.log"));
                    return 1;
                }
                if (result.ExitCode != 0)
                {
                    if (!quiet) ShowError("Personel26 başlatılamadı.\n\n" + Tail(result.Output) +
                        "\n\nGünlükler: " + Path.Combine(root, @"data\app-error.log"));
                    return result.ExitCode == 0 ? 1 : result.ExitCode;
                }

                port = ReadPort(root);
                for (int i = 0; i < 40 && !Healthy(port); i++) Thread.Sleep(250);
                if (!Healthy(port))
                {
                    if (!quiet) ShowError("Sunucu açıldı ancak panel yanıt vermiyor.\n\nAyrıntılar: " + Path.Combine(root, @"data\app-error.log"));
                    return 1;
                }
                if (!noBrowser) OpenUi(port, forceBrowser);
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

                    process.Start();
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
                        result.TimedOut = true;
                        lock (gate) result.Output = output.ToString();
                        return result;
                    }

                    process.WaitForExit();
                    result.ExitCode = process.ExitCode;
                    lock (gate) result.Output = output.ToString();
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

        private static void OpenUi(int port, bool forceBrowser)
        {
            string url = "http://127.0.0.1:" + port + "/";
            if (!forceBrowser)
            {
                foreach (string edge in EdgePaths())
                {
                    if (!File.Exists(edge)) continue;
                    try
                    {
                        ProcessStartInfo info = new ProcessStartInfo(edge,
                            "--app=" + url + " --window-size=1440,920 --no-first-run --disable-features=Translate");
                        info.UseShellExecute = false;
                        Process.Start(info);
                        return;
                    }
                    catch { }
                }
            }
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }

        private static string[] EdgePaths()
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return new string[]
            {
                Path.Combine(programFilesX86, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(programFiles, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            };
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
                    Process.Start("explorer.exe", "\"" + Path.GetDirectoryName(file ?? "") + "\"");
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
