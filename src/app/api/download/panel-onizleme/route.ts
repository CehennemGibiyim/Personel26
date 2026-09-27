import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Statik arayüz önizlemesini index.html olarak indirir. */
export async function GET() {
  const file = await readFile(path.join(process.cwd(), "public", "panel-onizleme.html"));
  const buf = new Uint8Array(file);
  return new Response(buf, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="index.html"; filename*=UTF-8''index.html`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
