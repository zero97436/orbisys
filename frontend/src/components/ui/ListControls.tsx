import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

/** Champ de recherche avec icône et libellé accessible. */
export function SearchInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder} className="input w-full pl-9" />
    </div>
  );
}

/** Groupe de filtres à choix unique (puces), avec compteur facultatif. */
export function FilterChips<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { v: T; label: string; count?: number; tone?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className={cn("chip transition", value === o.v ? "border-brand bg-brand/15 text-ink" : "hover:text-ink")}>
          {o.tone && <span className={cn("h-2 w-2 rounded-full", o.tone)} aria-hidden />}
          {o.label}
          {o.count != null && <span className="tabular-nums text-ink-faint">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const PAGE_SIZE = 25;

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): T[] {
  return items.slice((page - 1) * size, page * size);
}

/** Pagination : « 26–50 sur 312 » + précédent / suivant. Masquée s'il n'y a qu'une page. */
export function Pagination({ page, total, onPage, size = PAGE_SIZE }: {
  page: number; total: number; onPage: (p: number) => void; size?: number;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav aria-label={t("list.pagination")} className="flex items-center justify-between gap-3 text-xs text-ink-soft">
      <span className="tabular-nums">{t("list.range").replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total))}</span>
      <span className="flex items-center gap-1">
        <button type="button" className="icon-btn h-8 w-8" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t("list.prev")}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="min-w-[4.5rem] text-center tabular-nums" aria-current="page">{page} / {pages}</span>
        <button type="button" className="icon-btn h-8 w-8" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t("list.next")}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </span>
    </nav>
  );
}
