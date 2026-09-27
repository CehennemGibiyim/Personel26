"use client";
import { Component, type ReactNode } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Btn } from "@/components/ui-kit";

type Props = { children: ReactNode; pageName?: string };
type State = { error: Error | null };

/**
 * Sayfa çökerse tüm uygulamayı öldürmek yerine yakalar ve
 * kullanıcıya ne olduğunu + kurtarma butonu gösterir.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.pageName ? `:${this.props.pageName}` : ""}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel p-8 text-center anim-slide max-w-xl mx-auto">
          <TriangleAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <div className="text-white font-bold">Bu sayfa açılamadı</div>
          <div className="text-rose-300/90 text-xs mt-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 inline-block max-w-full break-words">
            {this.state.error.message || "Bilinmeyen hata"}
          </div>
          <div className="text-white/40 text-xs mt-2">
            Diğer sayfalar çalışmaya devam ediyor. Hatayı ekran görüntüsüyle bildirirseniz hızlıca düzeltirim.
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <Btn small variant="primary" onClick={() => this.setState({ error: null })}>
              <RotateCcw className="w-3.5 h-3.5" /> Tekrar Dene
            </Btn>
            <Btn small onClick={() => window.location.reload()}>Sayfayı Yenile</Btn>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
