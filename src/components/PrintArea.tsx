"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";

/** Tam ekran yazdırma önizlemesini açar (popup engellemesinden bağımsız). */
export function openPrintPreview() {
  document.body.classList.add("print-preview-open");
}
export function closePrintPreview() {
  document.body.classList.remove("print-preview-open");
}

/**
 * Yazdırılacak içeriği document.body seviyesine portal'lar.
 * Ekranda gizlidir; önizleme açıldığında beyaz kağıt görünümü olarak gösterilir,
 * yazdırmada yalnızca bu alan basılır.
 */
export default function PrintArea({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePrintPreview();
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      closePrintPreview();
    };
  }, []);

  if (!host) return null;
  return createPortal(
    <>
      <div id="print-area" className="printdoc">{children}</div>
      <div className="print-toolbar">
        <button onClick={() => window.print()} className="print-toolbar-btn primary">
          <Printer className="w-4 h-4" /> Yazdır / PDF Kaydet
        </button>
        <button onClick={closePrintPreview} className="print-toolbar-btn">
          <X className="w-4 h-4" /> Önizlemeyi Kapat
        </button>
      </div>
    </>,
    host
  );
}
