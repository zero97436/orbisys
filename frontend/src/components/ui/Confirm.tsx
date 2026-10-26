import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Modal } from "./Modal";
import { useI18n } from "../../lib/i18n";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Détail technique affiché tel quel (commande, cible, nombre d'éléments…). */
  details?: ReactNode;
  confirmLabel?: string;
  /** "danger" : action destructive ou irréversible (bouton rouge). */
  tone?: "danger" | "primary";
  /** Texte à retaper pour confirmer (actions irréversibles à fort impact). */
  requireText?: string;
}

type Ask = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<Ask>(async () => false);

/** Confirmation explicite, accessible, remplaçant window.confirm.
 *  Usage : const confirm = useConfirm(); if (!(await confirm({...}))) return; */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<(v: boolean) => void>();

  const ask = useCallback<Ask>((o) => {
    setTyped("");
    setOpts(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  }, []);

  const danger = opts?.tone !== "primary";
  const blocked = !!opts?.requireText && typed.trim() !== opts.requireText;
  const Icon = danger ? ShieldAlert : AlertTriangle;

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <Icon className={danger ? "h-5 w-5 text-status-critical" : "h-5 w-5 text-status-warning"} aria-hidden />
            {opts?.title}
          </span>
        }
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => close(false)} data-autofocus>
              {t("common.cancel")}
            </button>
            <button type="button" className={danger ? "btn-danger" : "btn-primary"} disabled={blocked} onClick={() => close(true)}>
              {opts?.confirmLabel ?? t("common.confirm")}
            </button>
          </>
        }
      >
        {opts && (
          <div className="space-y-3 text-sm text-ink-soft">
            {opts.message && <div>{opts.message}</div>}
            {opts.details && (
              <div className="rounded-lg border border-border bg-bg-soft px-3 py-2 font-mono text-xs text-ink">{opts.details}</div>
            )}
            {opts.requireText && (
              <div>
                <label className="label" htmlFor="confirm-type">
                  {t("confirm.typeToConfirm")} <b className="font-mono text-ink">{opts.requireText}</b>
                </label>
                <input id="confirm-type" className="input w-full" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
