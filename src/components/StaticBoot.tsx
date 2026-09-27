"use client";
import { useEffect, useState, type ReactNode } from "react";
import { HeartPulse, AlertTriangle, RotateCcw } from "lucide-react";

/**
 * GitHub Pages sürümü açılış bileşeni:
 *  1) Tarayıcı içi API yönlendiricisini kurar (fetch → route.ts fonksiyonları)
 *  2) PGlite veritabanını açar (ilk açılışta şema + örnek veri)
 *  3) Hazır olunca çocuk bileşeni (uygulamayı) gösterir
 * Ağır modüller dinamik yüklenir; derleme anındaki ön-render sırasında çalışmaz.
 */
export default function StaticBoot({
  children,
  preload,
}: {
  children: (data: unknown) => ReactNode;
  /** Hazır olunca çağrılacak ön yükleme (örn. /api/bootstrap) */
  preload?: () => Promise<unknown>;
}) {
  const [state, setState] = useState<{ ready: boolean; data?: unknown; error?: string; step: string }>({
    ready: false, step: "Veritabanı hazırlanıyor…",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const router = await import("@/lib/static/router");
        router.installFetchShim();
        const { getPGlite } = await import("@/lib/static/pglite");
        if (alive) setState(s => ({ ...s, step: "Tarayıcı veritabanı açılıyor…" }));
        await getPGlite();
        if (alive) setState(s => ({ ...s, step: "Veriler yükleniyor (ilk açılışta örnek veriler kurulur)…" }));
        const data = preload ? await preload() : undefined;
        if (alive) setState({ ready: true, data, step: "" });
      } catch (e) {
        if (alive) setState({ ready: false, step: "", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { alive = false; };
  }, [preload]);

  if (state.ready) return <>{children(state.data)}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/30 to-violet-500/30 border border-white/15 flex items-center justify-center">
          {state.error ? <AlertTriangle className="w-7 h-7 text-rose-400" /> : <HeartPulse className="w-7 h-7 text-sky-400" />}
        </div>
        {state.error ? (
          <>
            <div className="text-rose-300 text-sm font-semibold">Uygulama başlatılamadı</div>
            <div className="text-white/45 text-xs break-words">{state.error}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition flex items-center gap-2"
            ><RotateCcw className="w-4 h-4" /> Tekrar Dene</button>
          </>
        ) : (
          <>
            <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-white/50 text-xs">{state.step}</div>
            <div className="text-white/25 text-[10px]">GitHub Pages sürümü · veriler bu tarayıcıda saklanır</div>
          </>
        )}
      </div>
    </div>
  );
}
