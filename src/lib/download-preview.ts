"use client";

/**
 * Panel önizleme HTML'ini index.html olarak indirir.
 * fetch → blob → geçici link tıklaması akışı, iframe/önizleme
 * ortamlarında düz <a href> geçişinden daha güvenilir çalışır.
 * Başarısız olursa yeni sekmede açmayı dener (kullanıcı oradan kaydedebilir).
 */
export async function downloadPanelPreview(): Promise<{ ok: boolean; error?: string }> {
  const url = "/api/download/panel-onizleme";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sunucu hatası (${res.status})`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("Boş dosya alındı");
    const objectUrl = URL.createObjectURL(new Blob([blob], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "index.html";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    return { ok: true };
  } catch (e) {
    // Yedek: yeni sekmede statik dosyayı aç (Ctrl/Cmd+S ile kaydedilebilir)
    try {
      window.open(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/panel-onizleme.html`, "_blank", "noopener");
    } catch {
      /* yok say */
    }
    return { ok: false, error: e instanceof Error ? e.message : "İndirme başlatılamadı" };
  }
}
