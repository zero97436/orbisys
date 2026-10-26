import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type Tone = "success" | "error" | "info";
interface ToastItem { id: number; tone: Tone; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

const Ctx = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });

const META: Record<Tone, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: "border-status-ok/40 text-status-ok" },
  error: { icon: XCircle, cls: "border-status-critical/40 text-status-critical" },
  info: { icon: Info, cls: "border-status-info/40 text-status-info" },
};

/** Notifications éphémères (remplace window.alert). Annoncées aux lecteurs d'écran
 *  (role="status", ou "alert" pour les erreurs). Les erreurs restent jusqu'à fermeture. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback((tone: Tone, message: string) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, tone, message }]);
    if (tone !== "error") setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((it) => {
          const m = META[it.tone];
          return (
            <div key={it.id} role={it.tone === "error" ? "alert" : "status"}
              className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-pop", m.cls)}>
              <m.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-ink">{it.message}</p>
              <button type="button" onClick={() => dismiss(it.id)} className="text-ink-faint hover:text-ink" aria-label={t("common.close")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
