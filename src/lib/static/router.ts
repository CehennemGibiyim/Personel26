/**
 * GitHub Pages sürümü: tarayıcı içi API yönlendiricisi.
 * Uygulamanın /api/* istekleri ağa gitmez; buradaki eşleme ile mevcut
 * route.ts dosyalarındaki GET/POST/... fonksiyonları doğrudan çalıştırılır.
 * Böylece sunucu sürümüyle birebir aynı iş kuralları kullanılır.
 */
import * as announcements from "@/app/api/announcements/route";
import * as backupId from "@/app/api/backup/[id]/route";
import * as backup from "@/app/api/backup/route";
import * as bootstrap from "@/app/api/bootstrap/route";
import * as departments from "@/app/api/departments/route";
import * as exportIzinler from "@/app/api/export/izinler/route";
import * as exportNobet from "@/app/api/export/nobet/route";
import * as exportPersonel from "@/app/api/export/personel/route";
import * as exportPuantaj from "@/app/api/export/puantaj/route";
import * as leaves from "@/app/api/leaves/route";
import * as overrides from "@/app/api/overrides/route";
import * as personelLookup from "@/app/api/personel-lookup/route";
import * as avatar from "@/app/api/personnel/avatar/[id]/route";
import * as personnel from "@/app/api/personnel/route";
import * as rosterCell from "@/app/api/roster/cell/route";
import * as rosterColumns from "@/app/api/roster/columns/route";
import * as rosterDraft from "@/app/api/roster/draft/route";
import * as roster from "@/app/api/roster/route";
import * as schedules from "@/app/api/schedules/route";
import * as swaps from "@/app/api/swaps/route";
import * as templatesApply from "@/app/api/templates/apply/route";
import * as templatesProcess from "@/app/api/templates/process/route";
import * as templates from "@/app/api/templates/route";
import * as timesheet from "@/app/api/timesheet/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", unknown>>;

// Sıra önemli: daha özel yollar önce
const ROUTES: [RegExp, RouteModule, string[]][] = [
  [/^\/api\/personnel\/avatar\/([^/]+)\/?$/, avatar, ["id"]],
  [/^\/api\/backup\/([^/]+)\/?$/, backupId, ["id"]],
  [/^\/api\/roster\/columns\/?$/, rosterColumns, []],
  [/^\/api\/roster\/cell\/?$/, rosterCell, []],
  [/^\/api\/roster\/draft\/?$/, rosterDraft, []],
  [/^\/api\/roster\/?$/, roster, []],
  [/^\/api\/templates\/apply\/?$/, templatesApply, []],
  [/^\/api\/templates\/process\/?$/, templatesProcess, []],
  [/^\/api\/templates\/?$/, templates, []],
  [/^\/api\/export\/puantaj\/?$/, exportPuantaj, []],
  [/^\/api\/export\/nobet\/?$/, exportNobet, []],
  [/^\/api\/export\/izinler\/?$/, exportIzinler, []],
  [/^\/api\/export\/personel\/?$/, exportPersonel, []],
  [/^\/api\/personel-lookup\/?$/, personelLookup, []],
  [/^\/api\/personnel\/?$/, personnel, []],
  [/^\/api\/announcements\/?$/, announcements, []],
  [/^\/api\/backup\/?$/, backup, []],
  [/^\/api\/bootstrap\/?$/, bootstrap, []],
  [/^\/api\/departments\/?$/, departments, []],
  [/^\/api\/leaves\/?$/, leaves, []],
  [/^\/api\/overrides\/?$/, overrides, []],
  [/^\/api\/schedules\/?$/, schedules, []],
  [/^\/api\/swaps\/?$/, swaps, []],
  [/^\/api\/timesheet\/?$/, timesheet, []],
];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** İstek yolu /api ile başlıyorsa işler; değilse null döner. */
export async function handleApi(req: Request, nativeFetch: typeof fetch): Promise<Response | null> {
  const url = new URL(req.url);
  let path = url.pathname;
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length) || "/";
  if (!path.startsWith("/api/")) return null;

  // Sağlık kontrolü
  if (/^\/api\/health\/?$/.test(path)) return json(200, { ok: true, mode: "tarayici" });

  // Arayüz önizlemesi: statik dosya olarak indirilir
  if (/^\/api\/download\/panel-onizleme\/?$/.test(path)) {
    const r = await nativeFetch(`${BASE}/panel-onizleme.html`);
    return new Response(await r.blob(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": 'attachment; filename="index.html"' },
    });
  }

  for (const [re, mod, names] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    const handler = mod[req.method as keyof RouteModule] as Handler | undefined;
    if (!handler) return json(405, { error: `${req.method} desteklenmiyor` });
    const params: Record<string, string> = {};
    names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
    try {
      return await handler(req, { params: Promise.resolve(params) });
    } catch (e) {
      return json(500, { error: e instanceof Error ? e.message : "Tarayıcı veritabanı hatası" });
    }
  }
  return json(404, { error: "Bulunamadı" });
}

/** window.fetch'i sarar: /api istekleri tarayıcı içinde işlenir, diğerleri ağa gider. */
export function installFetchShim() {
  const w = window as typeof window & { __p26Shim?: boolean };
  if (w.__p26Shim) return;
  w.__p26Shim = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) {
      const req = input instanceof Request && !init ? input : new Request(url.href, init);
      const res = await handleApi(req, nativeFetch);
      if (res) return res;
    }
    return nativeFetch(input, init);
  };
}
