import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Boîte de dialogue accessible : role="dialog", aria-modal, piège de focus,
 *  fermeture par Échap ou clic sur le fond, focus rendu à l'élément d'origine. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "center",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** "drawer" : panneau latéral droit (fiches détaillées, formulaires longs). */
  variant?: "center" | "drawer";
  /** false pendant une action en cours (empêche une fermeture accidentelle). */
  dismissible?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const el = panel.current;
    // Focus initial : premier champ, sinon le panneau lui-même.
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("input, select, textarea") ?? el;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      restore.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className={cn("fixed inset-0 z-[80] flex bg-black/60 backdrop-blur-[2px]", variant === "center" ? "items-center justify-center p-4" : "justify-end")}
      onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose(); }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-full w-full flex-col border border-border bg-card shadow-pop outline-none",
          variant === "center" ? cn("rounded-2xl", width) : cn("h-full rounded-none border-y-0 border-r-0", width),
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} className="icon-btn h-8 w-8 shrink-0" aria-label={t("common.close")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
