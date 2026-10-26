import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createHost, updateHost } from "../../api/endpoints";
import type { Host } from "../../types";
import { Modal } from "../ui/Modal";
import { apiErrorMessage } from "../../lib/apiError";
import { useI18n } from "../../lib/i18n";

const MODE_KEYS = ["agentless", "agent", "ssh"] as const;
/** Valeur renvoyée par le backend à la place d'un secret (jamais le clair). */
const REDACTED = /^[•*]+$/;

interface FormState {
  name: string; hostname_or_ip: string; description: string; environment: string;
  monitoring_mode: string; ssh_port: string; ssh_user: string; ssh_password: string;
  parent_host_id: number; location: string; latitude: string; longitude: string;
}

const EMPTY: FormState = {
  name: "", hostname_or_ip: "", description: "", environment: "production", monitoring_mode: "agentless",
  ssh_port: "", ssh_user: "", ssh_password: "", parent_host_id: 0, location: "", latitude: "", longitude: "",
};

function fromHost(h: Host): FormState {
  return {
    name: h.name,
    hostname_or_ip: h.hostname_or_ip,
    description: h.description ?? "",
    environment: h.environment,
    monitoring_mode: h.monitoring_mode ?? "agentless",
    ssh_port: h.ssh_config?.port != null ? String(h.ssh_config.port) : "",
    ssh_user: (h.ssh_config?.user as string) ?? "",
    ssh_password: "", // jamais réaffiché : vide = mot de passe enregistré conservé
    parent_host_id: h.parent_host_id ?? 0,
    location: h.location ?? "",
    latitude: h.latitude != null ? String(h.latitude) : "",
    longitude: h.longitude != null ? String(h.longitude) : "",
  };
}

function Field({ label, hint, error, children, id, className }: {
  label: string; hint?: string; error?: string | null; children: ReactNode; id: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-error" id={`${id}-err`}>{error}</p> : hint ? <p className="field-hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}

/** Création / modification d'un hôte, en panneau latéral. Les erreurs serveur
 *  (quota de licence, doublon…) sont affichées dans le formulaire, sans le fermer. */
export function HostForm({ open, host, hosts, environments, onClose, onSaved }: {
  open: boolean;
  host: Host | null;
  hosts: Host[];
  environments: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const hasStoredPassword = !!host?.ssh_config?.password && REDACTED.test(String(host.ssh_config.password));

  useEffect(() => {
    if (!open) return;
    setForm(host ? fromHost(host) : EMPTY);
    setServerError(null);
  }, [open, host]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const coordError = (v: string, max: number) =>
    v === "" ? null : Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max ? null : t("hosts.f.coordInvalid").replace("{max}", String(max));
  const latErr = coordError(form.latitude, 90);
  const lonErr = coordError(form.longitude, 180);
  const portErr = form.ssh_port === "" || (Number.isInteger(Number(form.ssh_port)) && +form.ssh_port > 0 && +form.ssh_port < 65536) ? null : t("hosts.f.portInvalid");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latErr || lonErr || portErr) return;
    const { ssh_port, ssh_user, ssh_password, ...base } = form;
    const payload = {
      ...base,
      // Mot de passe vide : le backend conserve celui déjà enregistré (merge_secret_config).
      ssh_config: form.monitoring_mode === "ssh"
        ? { port: ssh_port === "" ? 22 : Number(ssh_port), user: ssh_user, password: ssh_password }
        : null,
      parent_host_id: form.parent_host_id || null,
      location: form.location || null,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
    };
    setBusy(true);
    setServerError(null);
    try {
      if (host) await updateHost(host.id, payload);
      else await createHost(payload);
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
      title={host ? t("hosts.edit") : t("hosts.new")}
      description={host ? host.name : t("hosts.newHint")}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</button>
          <button type="submit" form={id("form")} className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {host ? t("common.save") : t("hosts.create")}
          </button>
        </>
      }
    >
      <form id={id("form")} onSubmit={submit} className="space-y-6" noValidate={false}>
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />
            {serverError}
          </div>
        )}

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="eyebrow mb-2">{t("hosts.sec.identity")}</legend>
          <Field id={id("name")} label={t("common.name")}>
            <input id={id("name")} required className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
          </Field>
          <Field id={id("addr")} label={t("hosts.f.hostnameIp")} hint={t("hosts.f.hostnameIpHint")}>
            <input id={id("addr")} required className="input w-full font-mono" value={form.hostname_or_ip}
              onChange={(e) => set("hostname_or_ip", e.target.value.trim())} autoComplete="off" spellCheck={false} aria-describedby={`${id("addr")}-hint`} />
          </Field>
          <Field id={id("env")} label={t("hosts.f.environment")}>
            <input id={id("env")} className="input w-full" list={id("envs")} value={form.environment} onChange={(e) => set("environment", e.target.value)} />
            <datalist id={id("envs")}>{environments.map((e) => <option key={e} value={e} />)}</datalist>
          </Field>
          <Field id={id("desc")} label={t("common.description")}>
            <input id={id("desc")} className="input w-full" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="eyebrow mb-2">{t("hosts.sec.supervision")}</legend>
          <Field id={id("mode")} label={t("hosts.f.mode")}>
            <select id={id("mode")} className="input w-full" value={form.monitoring_mode} onChange={(e) => set("monitoring_mode", e.target.value)}>
              {MODE_KEYS.map((k) => <option key={k} value={k}>{t(`hosts.mode.${k}`)}</option>)}
            </select>
          </Field>
          {form.monitoring_mode === "agent" && (
            <p className="rounded-lg border border-border bg-bg-soft/50 px-3 py-2 text-xs text-ink-soft">{t("hosts.agentHint")}</p>
          )}
          {form.monitoring_mode === "ssh" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field id={id("port")} label={t("hosts.f.sshPort")} error={portErr}>
                <input id={id("port")} inputMode="numeric" className="input w-full" value={form.ssh_port} placeholder="22"
                  onChange={(e) => set("ssh_port", e.target.value)} aria-invalid={!!portErr} />
              </Field>
              <Field id={id("user")} label={t("hosts.f.sshUser")}>
                <input id={id("user")} className="input w-full" value={form.ssh_user} onChange={(e) => set("ssh_user", e.target.value)} autoComplete="off" />
              </Field>
              <Field id={id("pwd")} label={t("hosts.f.sshPassword")} hint={hasStoredPassword ? t("hosts.f.pwdKept") : undefined}>
                <input id={id("pwd")} type="password" className="input w-full" value={form.ssh_password}
                  placeholder={hasStoredPassword ? "••••••••" : ""} onChange={(e) => set("ssh_password", e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
          )}
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <legend className="eyebrow mb-2">{t("hosts.sec.location")}</legend>
          <Field id={id("site")} label={t("hosts.f.siteLabel")}>
            <input id={id("site")} className="input w-full" value={form.location} placeholder={t("hosts.f.site")} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field id={id("lat")} label={t("hosts.f.latLabel")} error={latErr}>
            <input id={id("lat")} inputMode="decimal" className="input w-full" value={form.latitude} placeholder="48.8566"
              onChange={(e) => set("latitude", e.target.value.replace(",", "."))} aria-invalid={!!latErr} />
          </Field>
          <Field id={id("lon")} label={t("hosts.f.lonLabel")} error={lonErr}>
            <input id={id("lon")} inputMode="decimal" className="input w-full" value={form.longitude} placeholder="2.3522"
              onChange={(e) => set("longitude", e.target.value.replace(",", "."))} aria-invalid={!!lonErr} />
          </Field>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">{t("hosts.sec.dependency")}</legend>
          <Field id={id("parent")} label={t("hosts.f.parentLabel")} hint={t("hosts.f.parentHint")}>
            <select id={id("parent")} className="input w-full" value={form.parent_host_id} onChange={(e) => set("parent_host_id", Number(e.target.value))}>
              <option value={0}>{t("common.none")}</option>
              {hosts.filter((h) => h.id !== host?.id).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
