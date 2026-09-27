"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Printer, X } from "lucide-react";

export function openPrintPreview() {
  if (typeof document !== "undefined") {
    document.body.classList.add("print-preview-open");
  }
}

export function closePrintPreview() {
  if (typeof document !== "undefined") {
    document.body.classList.remove("print-preview-open");
  }
}

/**
 * Yazdırma alanı: SSR ve hydrasyon dostu doğrudan render.
 * Portal yerine doğrudan DOM içinde kalır; CSS (@media print ve .print-preview-open)
 * ile ekran ve baskı davranışını yönetir.
 */
export default function PrintArea({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePrintPreview();
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      closePrintPreview();
    };
  }, []);

  return (
    <>
      <div id="print-area" className="printdoc">{children}</div>
      {mounted && (
        <div className="print-toolbar">
          <button type="button" onClick={() => window.print()} className="print-toolbar-btn primary">
            <Printer className="w-4 h-4" /> Yazdır / PDF Kaydet
          </button>
          <button type="button" onClick={closePrintPreview} className="print-toolbar-btn">
            <X className="w-4 h-4" /> Önizlemeyi Kapat
          </button>
        </div>
      )}
    </>
  );
}
