"use client";
import { useEffect, useState } from "react";
import { TriangleAlert, X, Copy, Check } from "lucide-react";

/**
 * Yakalanmamış istemci hatalarını (JS runtime, promise) görünür bir
 * bant olarak gösterir — sessiz donma yerine ne olduğu anlaşılır.
 */
export default function ClientErrorBanner() {
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const push = (msg: string) => {
      if (!msg || /ResizeObserver|Script error/i.test(msg)) return;
      setErrors(prev => (prev.includes(msg) ? prev : [...prev.slice(-2), msg]));
    };
    const onError = (e: ErrorEvent) => push(e.message || "Bilinmeyen istemci hatası");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as unknown;
      push(r instanceof Error ? r.message : typeof r === "string" ? r : "Beklenmeyen söz hatası");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!errors.length) return null;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(errors.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano yoksa sessiz geç */
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[min(560px,calc(100vw-2rem))] anim-slide">
      <div className="bg-[#1a0f14]/95 border border-rose-500/50 rounded-xl px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
        <div className="flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-rose-200 text-xs font-bold">Bir hata oluştu — ekran görüntüsü alıp bildirin:</div>
            {errors.map((m, i) => (
              <div key={i} className="text-rose-300/80 text-[11px] mt-1 break-words font-mono">{m}</div>
            ))}
          </div>
          <button onClick={copyAll} className="p-1.5 text-white/50 hover:text-white transition shrink-0" title="Hatayı kopyala">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setErrors([])} className="p-1.5 text-white/50 hover:text-white transition shrink-0" title="Kapat">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
