import { NextResponse } from "next/server";

/**
 * HTML kabuğunun tarayıcı/ara önbelleklerde bayat kalmasını engeller.
 * Bayat kabuk + yeni JS paketi eşleşmezliği, React'in hiç başlayamamasına
 * (ekranda donmuş "yükleniyor" görüntüsüne) yol açabiliyordu.
 */
export function middleware() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/", "/personel"],
};
