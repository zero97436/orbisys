import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, Circle, ListChecks, Rocket, Server, Activity, X } from "lucide-react";
import { listChannels } from "../api/endpoints";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

const KEY = "orbisys_onboarding_hidden";

/** Premiers pas : étapes calculées sur les données réelles (aucune donnée fictive créée).
 *  Masquable ; réapparaît tant que la configuration de base est incomplète et non masquée. */
export function GettingStarted({ hosts, checks, hasResults, canEdit, isAdmin }: {
  hosts: number; checks: number; hasResults: boolean; canEdit: boolean; isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [channels, setChannels] = useState<number | null>(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  useEffect(() => { listChannels().then((r) => setChannels(r.data.length)).catch(() => setChannels(null)); }, []);

  const steps = [
    { id: "host", done: hosts > 0, icon: Server, to: "/hosts", action: canEdit ? t("gs.host.cta") : null },
    { id: "check", done: checks > 0, icon: ListChecks, to: "/checks", action: canEdit && hosts > 0 ? t("gs.check.cta") : null },
    { id: "notify", done: (channels ?? 0) > 0, icon: Bell, to: "/settings#channels", action: isAdmin ? t("gs.notify.cta") : null },
    { id: "results", done: hasResults, icon: Activity, to: "/monitoring", action: checks > 0 ? t("gs.results.cta") : null },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || channels === null || doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);

  const hide = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };

  return (
    <section aria-labelledby="gs-title" className="card relative overflow-hidden border-brand/30 p-5">
      <button type="button" onClick={hide} className="icon-btn absolute right-3 top-3 h-8 w-8" aria-label={t("gs.hide")} title={t("gs.hide")}>
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex flex-wrap items-center gap-3 pr-10">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand"><Rocket className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 id="gs-title" className="text-base font-semibold text-ink">{t("gs.title")}</h2>
          <p className="text-sm text-ink-soft">{t("gs.progress").replace("{n}", String(doneCount)).replace("{total}", String(steps.length))}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => {
          const isNext = s === next;
          return (
            <li key={s.id} className={cn("rounded-lg border p-3", isNext ? "border-brand/50 bg-brand/5" : "border-border bg-bg-soft/40")}>
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {s.done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-status-ok" aria-label={t("gs.done")} />
                  : <Circle className="h-4 w-4 shrink-0 text-ink-faint" aria-label={t("gs.todo")} />}
                <span>{i + 1}. {t(`gs.${s.id}.title`)}</span>
              </p>
              <p className="mt-1 text-xs text-ink-soft">{t(`gs.${s.id}.desc`)}</p>
              {!s.done && (s.action
                ? <Link to={s.to} className={cn("mt-2 inline-flex items-center gap-1.5 text-xs font-medium", isNext ? "btn-primary btn-sm" : "text-brand hover:underline")}>
                    <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.action}
                  </Link>
                : <p className="mt-2 text-[11px] text-ink-faint">{s.id === "notify" ? t("gs.askAdmin") : t("gs.waitPrev")}</p>)}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-ink-faint">
        {t("gs.docs")} <Link to="/docs" className="text-brand underline underline-offset-2">{t("nav.docs")}</Link>
      </p>
    </section>
  );
}
