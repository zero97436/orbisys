import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { createCheck, updateCheck } from "../../api/endpoints";
import type { Check, CheckType, Host } from "../../types";
import { Modal } from "../ui/Modal";
import { PlanTag } from "../ui/UpgradeNotice";
import { CHECK_TYPES } from "../../lib/format";
import { CHECK_META, metaFor } from "../../lib/checkMeta";
import { useLicense } from "../../lib/license";
import { apiErrorMessage } from "../../lib/apiError";
import { useI18n } from "../../lib/i18n";

interface FormState {
  host_id: number; name: string; type: CheckType; interval_seconds: string; timeout_seconds: string;
  warning_threshold: string; critical_threshold: string; config_json: string; executor_host_id: number;
}

function Field({ id, label, hint, error, children, className }: {
  id: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

/** Création / modification d'un check, en panneau latéral. Validation locale (hôte, JSON,
 *  nombres) puis erreurs serveur affichées dans le formulaire. Les règles de supervision
 *  (seuils, intervalle) sont transmises telles quelles au backend. */
export function CheckForm({ open, check, hosts, defaultHostId, onClose, onSaved }: {
  open: boolean;
  check: Check | null;
  hosts: Host[];
  defaultHostId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const { has, loading: licLoading } = useLicense();
  const distributed = licLoading || has("distributed");
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setTouched(false);
    setForm(check ? {
      host_id: check.host_id,
      name: check.name,
      type: check.type,
      interval_seconds: String(check.interval_seconds),
      timeout_seconds: String(check.timeout_seconds),
      warning_threshold: check.warning_threshold?.toString() ?? "",
      critical_threshold: check.critical_threshold?.toString() ?? "",
      config_json: JSON.stringify(check.config_json ?? {}, null, 2),
      executor_host_id: check.executor_host_id ?? 0,
    } : {
      host_id: defaultHostId ?? 0, name: "", type: "ping", interval_seconds: "60", timeout_seconds: "10",
      warning_threshold: "", critical_threshold: "", config_json: metaFor("ping", lang).config, executor_host_id: 0,
    });
  }, [open, check, defaultHostId, lang]);

  if (!form) return null;
  const meta = metaFor(form.type, lang);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // Changer de type : pré-remplit l'exemple de config, sauf si l'utilisateur l'a modifié.
  const changeType = (type: CheckType) => setForm((f) => {
    if (!f) return f;
    const compact = f.config_json.replace(/\s/g, "");
    const wasExample = !compact || compact === "{}" || Object.values(CHECK_META).some((m) => m.config.replace(/\s/g, "") === compact);
    return { ...f, type, config_json: wasExample ? metaFor(type, lang).config : f.config_json };
  });

  let parsed: Record<string, unknown> | null = null;
  let jsonError: string | null = null;
  try {
    const v = JSON.parse(form.config_json || "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) parsed = v; else jsonError = t("chk.badJson");
  } catch { jsonError = t("chk.badJson"); }
  const intErr = (v: string, min: number) => (Number.isInteger(Number(v)) && Number(v) >= min ? null : t("chk.intMin").replace("{min}", String(min)));
  const intervalErr = intErr(form.interval_seconds, 5); // mêmes bornes que le backend (ge=5)
  const timeoutErr = intErr(form.timeout_seconds, 1);
  const numErr = (v: string) => (v === "" || Number.isFinite(Number(v)) ? null : t("chk.numInvalid"));
  const warnErr = numErr(form.warning_threshold);
  const critErr = numErr(form.critical_threshold);
  const hostErr = form.host_id ? null : t("chk.hostRequired");
  const invalid = !!(jsonError || intervalErr || timeoutErr || warnErr || critErr || hostErr || !form.name.trim());
  const show = (e: string | null) => (touched ? e : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || !parsed) return;
    const payload = {
      host_id: form.host_id,
      name: form.name.trim(),
      type: form.type,
      interval_seconds: Number(form.interval_seconds),
      timeout_seconds: Number(form.timeout_seconds),
      warning_threshold: form.warning_threshold === "" ? null : Number(form.warning_threshold),
      critical_threshold: form.critical_threshold === "" ? null : Number(form.critical_threshold),
      config_json: parsed,
      executor_host_id: form.executor_host_id || null,
    };
    setBusy(true);
    setServerError(null);
    try {
      if (check) await updateCheck(check.id, payload);
      else await createCheck(payload);
      onSaved();
    } catch (err) {
      setServerError(apiErrorMessage(err, t("common.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      variant="drawer"
      size="lg"
      title={check ? t("chk.edit") : t("chk.new")}
      description={check ? check.name : t("chk.newHint")}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</button>
          <button type="submit" form={id("form")} className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {check ? t("common.save") : t("chk.createBtn")}
          </button>
        </>
      }
    >
      <form id={id("form")} onSubmit={submit} className="space-y-6" noValidate>
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden /> {serverError}
          </div>
        )}

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="eyebrow mb-2">{t("chk.sec.what")}</legend>
          <Field id={id("host")} label={t("chk.hostToMonitor")} error={show(hostErr)}>
            <select id={id("host")} className="input w-full" value={form.host_id} onChange={(e) => set("host_id", Number(e.target.value))} aria-invalid={!!show(hostErr)}>
              <option value={0}>{t("chk.chooseHost")}</option>
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.hostname_or_ip})</option>)}
            </select>
          </Field>
          <Field id={id("type")} label={t("chk.controlType")}>
            <select id={id("type")} className="input w-full" value={form.type} onChange={(e) => changeType(e.target.value as CheckType)}>
              {CHECK_TYPES.map((ty) => <option key={ty} value={ty}>{metaFor(ty, lang).label}</option>)}
            </select>
          </Field>
          <Field id={id("name")} label={t("chk.nameLabel")} className="sm:col-span-2" error={show(form.name.trim() ? null : t("chk.nameRequired"))}>
            <input id={id("name")} className="input w-full" value={form.name} autoComplete="off"
              placeholder={`${t("chk.namePhPre")} ${meta.label} ${t("chk.namePhPost")}`} onChange={(e) => set("name", e.target.value)} />
          </Field>
          {meta.desc && (
            <p className="flex items-start gap-2 rounded-lg border border-brand/25 bg-brand/5 p-3 text-xs text-ink-soft sm:col-span-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span>
                {meta.desc}
                {meta.thresholds && <> {t("chk.thresholdsWarnCrit")} {meta.thresholds}.</>}
              </span>
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">{t("chk.configLabel")}</legend>
          <Field id={id("cfg")} label={<>{t("chk.configJson")} <span className="font-normal text-ink-faint">{meta.config === "{}" ? t("chk.noConfig") : t("chk.replaceEmpty")}</span></>}
            error={jsonError} hint={check ? t("chk.secretsKept") : undefined}>
            <textarea id={id("cfg")} className="input w-full font-mono text-xs" spellCheck={false}
              rows={Math.min(10, Math.max(3, form.config_json.split("\n").length))}
              value={form.config_json} onChange={(e) => set("config_json", e.target.value)} aria-invalid={!!jsonError} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
          <legend className="eyebrow mb-2">{t("chk.sec.when")}</legend>
          <Field id={id("int")} label={t("chk.interval")} error={show(intervalErr)}>
            <input id={id("int")} inputMode="numeric" className="input w-full" value={form.interval_seconds} onChange={(e) => set("interval_seconds", e.target.value)} aria-invalid={!!show(intervalErr)} />
          </Field>
          <Field id={id("to")} label={t("chk.maxDelay")} error={show(timeoutErr)}>
            <input id={id("to")} inputMode="numeric" className="input w-full" value={form.timeout_seconds} onChange={(e) => set("timeout_seconds", e.target.value)} aria-invalid={!!show(timeoutErr)} />
          </Field>
          <Field id={id("warn")} label={<>{t("chk.warnThreshold")} {!meta.thresholds && <span className="font-normal text-ink-faint">{t("chk.optional")}</span>}</>} error={warnErr}>
            <input id={id("warn")} inputMode="decimal" className="input w-full" placeholder="—" value={form.warning_threshold} onChange={(e) => set("warning_threshold", e.target.value.replace(",", "."))} aria-invalid={!!warnErr} />
          </Field>
          <Field id={id("crit")} label={<>{t("chk.critThreshold")} {!meta.thresholds && <span className="font-normal text-ink-faint">{t("chk.optional")}</span>}</>} error={critErr}>
            <input id={id("crit")} inputMode="decimal" className="input w-full" placeholder="—" value={form.critical_threshold} onChange={(e) => set("critical_threshold", e.target.value.replace(",", "."))} aria-invalid={!!critErr} />
          </Field>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">{t("chk.sec.where")}</legend>
          <Field id={id("exec")} label={<span className="inline-flex items-center gap-2">{t("chk.executedBy")} {!distributed && <PlanTag feature="distributed" />}</span>}
            hint={distributed ? t("chk.executorHint") : t("chk.executorLocked")}>
            <select id={id("exec")} className="input w-full" value={form.executor_host_id} onChange={(e) => set("executor_host_id", Number(e.target.value))}
              disabled={!distributed && !form.executor_host_id}>
              <option value={0}>{t("chk.centralDefault")}</option>
              {(distributed || form.executor_host_id) ? hosts.map((h) => <option key={h.id} value={h.id}>{t("chk.probeAgent")} {h.name}</option>) : null}
            </select>
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
