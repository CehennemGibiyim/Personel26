"use client";
import {
  ArrowRight, CalendarClock, CheckCircle2, CircleHelp, DatabaseBackup, Download, FileSpreadsheet,
  FolderOpen, HardDrive, Image as ImageIcon, MonitorDown, MousePointerClick, PlayCircle, RefreshCw,
  ShieldCheck, Sparkles, Users, Video, WifiOff,
} from "lucide-react";
import { APP_VERSION, INSTALLER_URL, REPOSITORY_URL, WEB_APP_URL } from "@/lib/app-info";

const BASE_PATH = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");
const helpAsset = (file: string) => `${BASE_PATH}/help/${file}`;

const QUICK_STEPS = [
  {
    icon: Download,
    title: "Kurulum dosyasını çalıştır",
    text: "Personel26-Kurulum.exe dosyasına çift tıkla. Windows sorarsa “Ek bilgi → Yine de çalıştır” seç.",
    color: "from-sky-500 to-blue-600",
  },
  {
    icon: MousePointerClick,
    title: "Masaüstündeki simgeye tıkla",
    text: "Personel26 simgesi paneli kendi açar. Komut penceresi, .bat dosyası veya teknik bilgi gerekmez.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: ShieldCheck,
    title: "Verin güvende kalsın",
    text: "Kapatırken ve güncellemeden önce SQL yedeği backups klasörüne otomatik alınır.",
    color: "from-emerald-500 to-teal-600",
  },
];

const FIRST_STEPS = [
  {
    icon: Users,
    title: "Kurumunu tanıt",
    text: "Ayarlar → Genel bölümünde kurum adı, kısa ad, telefon ve logoyu gir. Kaydet düğmesine bas.",
    target: "Ayarlar → Genel",
  },
  {
    icon: FileSpreadsheet,
    title: "Personeli ekle",
    text: "Personel Yönetimi’nden tek tek ekleyebilir veya Excel/CSV dosyanı aktarabilirsin. Önce önizle, sonra onayla.",
    target: "Personel Yönetimi",
  },
  {
    icon: CalendarClock,
    title: "İlk nöbet çizelgesini hazırla",
    text: "Servisi ve personel grubunu seç, vardiya şablonunu uygula. İzin ve dinlenme kuralları otomatik denetlenir.",
    target: "Nöbet Çizelgesi",
  },
  {
    icon: DatabaseBackup,
    title: "Yedeğini al",
    text: "Yedekleme → Yedek oluştur. Dosya kurulum klasöründeki backups dizininde oluşur; istersen farklı bir diske kopyala.",
    target: "Yedekleme",
  },
];

const SCREENS = [
  {
    file: "panel.jpg",
    title: "Panel açılışı",
    text: "Sol menüden tüm çalışma alanlarına ulaşılır. Sağ üstte güncelleme rozeti ve bildirimler bulunur.",
  },
  {
    file: "personel.jpg",
    title: "Personel Yönetimi",
    text: "Personel ekle, düzenle, servis ve gruba ata. TC kimlik numarası maskelenebilir.",
  },
  {
    file: "nobet.jpg",
    title: "Nöbet Çizelgesi",
    text: "Ay seç, şablonu uygula ve dağıtımı tek tıkla yap. Çakışmalar ve dinlenme süreleri uyarır.",
  },
  {
    file: "yedek.jpg",
    title: "Yedekleme",
    text: "Manuel yedek al, dosya yolunu aç veya listeden seçtiğin SQL dosyasını tek tıkla geri yükle.",
  },
];

const FAQ = [
  {
    q: "Personel26.exe açılmıyor, ne yapmalıyım?",
    a: "Önce masaüstündeki Personel26 simgesini bir kez daha aç. Pencere “başlatılıyor” deyip kapanıyorsa data\\app-error.log ve data\\app.log dosyalarına bak. Kurulum klasörünü taşıdıysan simgeyi yeni klasördeki Personel26.exe ile yenile.",
  },
  {
    q: "Windows “bilinmeyen yayıncı” uyarısı veriyor",
    a: "Bu, kod imzası sertifikası olmayan yerel kurulumlarda görülür. “Ek bilgi” bağlantısına, ardından “Yine de çalıştır”a bas. Dosyayı yalnızca bu deponun sürümler sayfasından indirdiysen devam et.",
  },
  {
    q: "Verilerim nerede tutuluyor?",
    a: "Tüm veriler bu bilgisayarda, kurulum klasöründeki data dizininde ve yerel PostgreSQL’de tutulur. Bulut hesabına veya internete gönderilmez. Yedekler backups dizinindedir.",
  },
  {
    q: "Uygulamayı nasıl kapatırım?",
    a: "Başlat menüsündeki “Personel26 — Durdur” kısayolunu kullan. Kapanmadan önce otomatik SQL yedeği alınır. Pencereyi kapatmak sunucuyu durdurmaz; bir sonraki açılışta panel yine hazır olur.",
  },
  {
    q: "Güncelleme nasıl yapılır?",
    a: "Ayarlar → Hakkında & Güncelleme bölümünde “Güncellemeleri denetle”ye bas. Yeni sürüm varsa paket indirilir, SHA-256 ile doğrulanır, önce yedek alınır ve kurulum otomatik yapılır. Ara sürümler atlanmaz.",
  },
  {
    q: "İnternet olmadan çalışır mı?",
    a: "Evet. Panel, veritabanı ve yedekleme tamamen yerel çalışır. Yalnızca güncelleme denetimi ve indirme için internet gerekir.",
  },
  {
    q: "Yedeği geri nasıl yüklerim?",
    a: "Yedekleme sayfasındaki yerel yedek listesinde dosyanın yanındaki “Geri yükle” düğmesine bas. Onaydan sonra önce güvenlik yedeği alınır, sonra seçilen SQL dosyası uygulanır.",
  },
  {
    q: "Başka bir bilgisayara taşıyabilir miyim?",
    a: "Yeni bilgisayara aynı sürümü kur, eski bilgisayarda güncel bir SQL yedeği al ve yeni kurulumda Yedekleme sayfasından geri yükle. data klasörünü elle kopyalamak yerine bu yolu kullanmak daha güvenlidir.",
  },
];

export default function HelpPage() {
  return <div className="px-4 sm:px-5 lg:px-8 py-6 max-w-[1240px] help-root">
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1930] via-[#0b1220] to-[#1b1236] p-6 sm:p-8 lg:p-10">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] text-sky-200">
          <CircleHelp className="h-3.5 w-3.5" /> Kullanım kılavuzu · v{APP_VERSION}
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-white" style={{ fontFamily: "var(--font-grotesk)" }}>
          Personel26’yı aç, kullan ve verini koru.
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-white/60">
          Kurulumdan ilk nöbet çizelgesine kadar kısa adımlar. Masaüstündeki <b className="text-white/85">Personel26</b> simgesine çift tıkla;
          panel kendi açılır. Terminal, komut satırı veya .bat dosyası yok.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <a href="#video" className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-400">
            <PlayCircle className="h-4 w-4" /> Videoyu izle
          </a>
          <a href="#kurulum" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 py-2.5 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white">
            <MonitorDown className="h-4 w-4" /> Kurulum adımları
          </a>
          <a href={INSTALLER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/15">
            <Download className="h-4 w-4" /> Son Windows kurulumu
          </a>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["1 tık", "Masaüstünden açılış"],
            ["Otomatik", "Kapanış + güncelleme yedeği"],
            ["Yerel", "Veri bu bilgisayarda"],
            ["Tek tık", "SQL geri yükleme"],
          ].map(([big, small]) => <div key={small} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            <div className="text-sm font-black text-white">{big}</div>
            <div className="mt-0.5 text-[9.5px] font-medium leading-snug text-white/40">{small}</div>
          </div>)}
        </div>
      </div>
    </section>

    <section className="mt-5 grid gap-3 md:grid-cols-3">
      {QUICK_STEPS.map((step, index) => <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[.045] p-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} text-white shadow-lg`}><step.icon className="h-5 w-5" /></span>
          <span className="text-[10px] font-black tracking-[2px] text-white/30">ADIM {index + 1}</span>
        </div>
        <h2 className="mt-3 text-sm font-bold text-white">{step.title}</h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">{step.text}</p>
      </article>)}
    </section>

    <section id="kurulum" className="mt-8 scroll-mt-24">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-sky-300/80">WINDOWS KURULUMU</span>
          <h2 className="mt-1 text-xl font-black text-white">Masaüstünde normal bir uygulama gibi</h2>
          <p className="mt-1 text-xs text-white/45">Kurulumdan sonra hiçbir betik dosyasına dokunman gerekmez.</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" /> İmzalı sürüm akışı</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]">
          <img src={helpAsset("kurulum.jpg")} alt="Personel26 kurulum ve masaüstü kısayolu" className="w-full object-cover" />
          <figcaption className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-[10px] text-white/40"><ImageIcon className="h-3.5 w-3.5" /> Masaüstünde tek simge · Personel26.exe</figcaption>
        </figure>
        <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5">
          <ol className="space-y-4">
            {[
              ["Kurulumu başlat", "Personel26-Kurulum.exe dosyasını çalıştır. Kurulum tamamlanınca masaüstünde Personel26 simgesi oluşur."],
              ["Simgeye çift tıkla", "Kısa bir “Personel26 başlatılıyor” penceresi görünür. İlk açılışta yerel veritabanı hazırlanır; 1-2 dakika sürebilir."],
              ["Panel açılır", "Panel, Edge’in uygulama penceresinde açılır. Edge yoksa varsayılan tarayıcı kullanılır. Adres çubuğu ve sekme kalabalığı yoktur."],
              ["Kapatırken yedek alınır", "Başlat menüsünde “Personel26 — Durdur” kısayolu vardır. Kapatmadan önce SQL yedeği backups klasörüne yazılır."],
            ].map(([title, text], i) => <li key={title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[10px] font-black text-sky-300 ring-1 ring-sky-400/30">{i + 1}</span>
              <div><b className="block text-xs text-white/90">{title}</b><p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{text}</p></div>
            </li>)}
          </ol>
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[.07] p-3 text-[10.5px] leading-relaxed text-amber-100/70">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p>Windows “bilinmeyen yayıncı” uyarısı gösterirse <b>Ek bilgi → Yine de çalıştır</b> seç. Dosyayı yalnızca bu deponun sürümler sayfasından indir.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="mt-8">
      <span className="text-[10px] font-bold uppercase tracking-[2px] text-violet-300/80">İLK 10 DAKİKA</span>
      <h2 className="mt-1 text-xl font-black text-white">Panelde ilk yapılacaklar</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FIRST_STEPS.map((step, index) => <article key={step.title} className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 transition hover:border-sky-400/25 hover:bg-white/[.055]">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-sky-300 ring-1 ring-white/10"><step.icon className="h-4 w-4" /></span>
            <span className="text-2xl font-black text-white/[.06]">0{index + 1}</span>
          </div>
          <h3 className="mt-3 text-xs font-bold text-white">{step.title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">{step.text}</p>
          <div className="mt-3 inline-flex items-center gap-1 text-[9.5px] font-bold text-sky-300/70"><FolderOpen className="h-3 w-3" /> {step.target}</div>
        </article>)}
      </div>
    </section>

    <section className="mt-8">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-emerald-300/80">GÖRSEL REHBER</span>
          <h2 className="mt-1 text-xl font-black text-white">Ekranlarla adım adım</h2>
        </div>
        <span className="hidden items-center gap-1.5 text-[10px] text-white/30 sm:flex"><Sparkles className="h-3.5 w-3.5" /> Panel görünümleri</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {SCREENS.map((screen, i) => <figure key={screen.file} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]">
          <div className="relative">
            <img src={helpAsset(screen.file)} alt={screen.title} className="w-full object-cover" loading="lazy" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-[9px] font-bold text-white/80 backdrop-blur"><MousePointerClick className="h-3 w-3" /> 0{i + 1}</span>
          </div>
          <figcaption className="border-t border-white/10 p-4">
            <b className="text-xs text-white/90">{screen.title}</b>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/45">{screen.text}</p>
          </figcaption>
        </figure>)}
      </div>
    </section>

    <section id="video" className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/50">
          <video controls playsInline preload="metadata" poster={helpAsset("tanitim-poster.jpg")} className="aspect-video w-full bg-black">
            <source src={helpAsset("personel26-tanitim.mp4")} type="video/mp4" />
            Tarayıcınız videoyu oynatamıyor. Görsel rehberdeki adımları takip edebilirsiniz.
          </video>
        </div>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[9.5px] font-bold uppercase tracking-[2px] text-violet-200"><Video className="h-3.5 w-3.5" /> Video anlatım</span>
          <h2 className="mt-3 text-lg font-black text-white">Kurulumdan yedeğe, 42 saniyede</h2>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Videoda masaüstü simgesinden panelin açılışı, ilk ayarlar, personel ekleme, nöbet çizelgesi ve yedekleme ekranı gösterilir.
            Seslendirme yoktur; adımlar ekran üzerinde yazılı olarak anlatılır.
          </p>
          <div className="mt-4 space-y-2">
            {["Masaüstü simgesi ve ilk açılış", "Personel ve servis seçimi", "Nöbet dağıtımı ve yedek"].map(item => <div key={item} className="flex items-center gap-2 text-[11px] text-white/60"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {item}</div>)}
          </div>
          <a href={WEB_APP_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-sky-300 hover:text-sky-200">Tarayıcı sürümünü aç <ArrowRight className="h-3.5 w-3.5" /></a>
        </div>
      </div>
    </section>

    <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[2px] text-sky-300/80">SIK SORULANLAR</span>
        <h2 className="mt-1 text-xl font-black text-white">Takıldığında</h2>
        <div className="mt-4 space-y-2">
          {FAQ.map(item => <details key={item.q} className="group rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 open:border-sky-400/25 open:bg-sky-400/[.045]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11.5px] font-bold text-white/80 marker:content-none">
              {item.q}
              <span className="text-white/30 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">{item.a}</p>
          </details>)}
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25"><HardDrive className="h-4 w-4" /></span>
          <h3 className="mt-3 text-xs font-bold text-white">Dosya konumları</h3>
          <dl className="mt-2 space-y-2 text-[10.5px]">
            <div><dt className="font-bold text-white/60">Veritabanı</dt><dd className="text-white/35">Kurulum klasörü\data</dd></div>
            <div><dt className="font-bold text-white/60">Yedekler</dt><dd className="text-white/35">Kurulum klasörü\backups</dd></div>
            <div><dt className="font-bold text-white/60">Günlükler</dt><dd className="text-white/35">data\app.log · data\app-error.log</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25"><WifiOff className="h-4 w-4" /></span>
          <h3 className="mt-3 text-xs font-bold text-white">İnternetsiz çalışır</h3>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/45">Panel ve veritabanı yereldir. Yalnızca güncelleme denetimi internet ister.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25"><RefreshCw className="h-4 w-4" /></span>
          <h3 className="mt-3 text-xs font-bold text-white">Güncel kal</h3>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/45">Ayarlar → Hakkında &amp; Güncelleme bölümünden yeni sürümü denetle. Kurulumdan önce yedek otomatik alınır.</p>
        </div>
        <a href={REPOSITORY_URL + "/issues"} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] p-4 text-[11px] font-bold text-white/70 transition hover:bg-white/[.06] hover:text-white">
          Destek ve hata bildirimi <ArrowRight className="h-4 w-4" />
        </a>
      </aside>
    </section>

    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] text-white/25">
      <span className="inline-flex items-center gap-1.5"><CircleHelp className="h-3.5 w-3.5" /> Personel26 · v{APP_VERSION} · Yerel kurulum kılavuzu</span>
      <span>Bu kılavuz uygulama içinde çevrimdışı açılır.</span>
    </footer>
  </div>;
}
