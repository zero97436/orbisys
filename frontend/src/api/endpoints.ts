import { api } from "./client";
import type {
  Check,
  CheckResult,
  CheckStatus,
  DashboardSummary,
  EventLog,
  Host,
  HostMetric,
  HostMetricHourly,
  Incident,
  Maintenance,
  NotificationChannel,
  User,
} from "../types";

// --- Auth ---
export const login = (email: string, password: string) =>
  api.post<{ access_token: string }>("/auth/login", { email, password });
export const getMe = () => api.get<User>("/auth/me");
export const changePassword = (current_password: string, new_password: string) =>
  api.post<{ ok: boolean }>("/auth/change-password", { current_password, new_password });
export const forgotPassword = (email: string) =>
  api.post<{ ok: boolean; message: string }>("/auth/forgot-password", { email });
export const resetPassword = (token: string, new_password: string) =>
  api.post<{ ok: boolean }>("/auth/reset-password", { token, new_password });

// --- Hosts ---
export interface LicenseInfo {
  plan: string;
  max_hosts: number | null;
  features: string[];
  used: number;
  customer: string | null;
  expires: string | null;
  /** État de la clé configurée sur le serveur (jamais la clé elle-même). */
  key_status?: "none" | "valid" | "expired" | "invalid";
}
export const getLicense = () => api.get<LicenseInfo>("/hosts/license");
export const listHosts = () => api.get<Host[]>("/hosts");
export const getHost = (id: number) => api.get<Host>(`/hosts/${id}`);
export const createHost = (data: Partial<Host>) => api.post<Host>("/hosts", data);
export const updateHost = (id: number, data: Partial<Host>) =>
  api.put<Host>(`/hosts/${id}`, data);
export const deleteHost = (id: number) => api.delete(`/hosts/${id}`);
export interface HostEnrollment {
  host_id: number;
  hostname: string;
  monitoring_mode: string;
  api_base: string;
  metrics_url: string;
  ingest_key_required: boolean;
  install_command: string;
  systemd_unit: string;
}
export const getHostEnrollment = (id: number) =>
  api.get<HostEnrollment>(`/hosts/${id}/enrollment`);

// --- Checks ---
export const listChecks = (hostId?: number) =>
  api.get<Check[]>("/checks", { params: hostId ? { host_id: hostId } : {} });
export const getCheck = (id: number) => api.get<Check>(`/checks/${id}`);
export const createCheck = (data: Partial<Check>) => api.post<Check>("/checks", data);
export const updateCheck = (id: number, data: Partial<Check>) =>
  api.put<Check>(`/checks/${id}`, data);
export const deleteCheck = (id: number) => api.delete(`/checks/${id}`);
export const runCheck = (id: number) => api.post<CheckResult>(`/checks/${id}/run`);
/** Disponibilité agrégée côté serveur (tous les checks visibles, toute la fenêtre). */
export interface AvailabilityReport {
  window_hours: number;
  ok: number;
  total: number;
  /** null : aucun résultat dans la fenêtre. */
  availability: number | null;
  buckets: { start: string; end: string; ok: number; total: number }[];
}
export const getAvailability = (hours = 24, buckets = 24, checkId?: number) =>
  api.get<AvailabilityReport>("/dashboard/availability", { params: { hours, buckets, ...(checkId ? { check_id: checkId } : {}) } });

export const listResults = (id: number, limit = 100, offset = 0) =>
  api.get<CheckResult[]>(`/checks/${id}/results`, { params: { limit, offset } });

// --- Recherche globale (Ctrl+K) ---
export interface SearchResults {
  hosts: { id: number; name: string; hostname_or_ip: string }[];
  checks: { id: number; name: string; type: string; host_name: string; last_status: string | null }[];
  tickets: { id: number; title: string; status: string; priority: string }[];
  events: { id: number; message: string; level: string; created_at: string | null }[];
}
export const globalSearch = (q: string) =>
  api.get<SearchResults>("/search", { params: { q } });

// --- Templates de checks ---
export interface CheckTemplateItem {
  name: string;
  type: string;
  config_json?: Record<string, unknown>;
  interval_seconds?: number;
  timeout_seconds?: number;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
}
export interface CheckTemplate {
  id: number;
  name: string;
  description: string | null;
  items: CheckTemplateItem[];
}
export const listCheckTemplates = () => api.get<CheckTemplate[]>("/check-templates");
export const createTemplateFromHost = (host_id: number, name: string, description?: string) =>
  api.post<CheckTemplate>("/check-templates/from-host", { host_id, name, description });
export const applyCheckTemplate = (templateId: number, host_id: number) =>
  api.post<{ created: string[]; skipped: string[] }>(`/check-templates/${templateId}/apply`, { host_id });
export const deleteCheckTemplate = (id: number) => api.delete(`/check-templates/${id}`);

// --- Metrics (agent ingestion) ---
export const getHostMetrics = (hostId: number, hours = 24, limit = 1000) =>
  api.get<HostMetric[]>(`/metrics/hosts/${hostId}`, { params: { hours, limit } });
export const getHostMetricsHourly = (hostId: number, days = 30) =>
  api.get<HostMetricHourly[]>(`/metrics/hosts/${hostId}/hourly`, { params: { days } });
export const getSnmpInterfaces = (host: string, community = "public", version = "2c") =>
  api.get<{ interfaces: { index: number | string; name: string }[] }>(
    "/metrics/snmp/interfaces", { params: { host, community, version } });

// --- Discovery (découverte réseau) ---
export interface DiscoveredHost {
  ip: string;
  open_ports: number[];
  already_monitored: boolean;
  suggested_checks: { name: string; type: string; config_json?: Record<string, unknown> }[];
}
export const scanNetwork = (target: string) =>
  api.post<{ results: DiscoveredHost[] }>("/discovery/scan", { target });
export const importDiscovered = (
  items: { name: string; hostname_or_ip: string; environment?: string; checks: unknown[] }[],
) => api.post<{ imported: number; hosts: { host_id: number; name: string }[] }>("/discovery/import", { items });

// --- BAM (services métier) ---
export interface BamComponent {
  id: number;
  label: string;
  status: CheckStatus;
  check_id: number | null;
  host_id: number | null;
}
export interface BamService {
  id: number;
  name: string;
  description: string | null;
  rule: "worst" | "percent";
  status: CheckStatus;
  category: string;
  icon: string | null;
  pos_x: number | null;
  pos_y: number | null;
  ok_count: number;
  total: number;
  components: BamComponent[];
}
export const listBam = () => api.get<BamService[]>("/bam");
export const createBamService = (data: { name: string; description?: string; rule: string; warning_threshold?: number | null; critical_threshold?: number | null; category?: string; icon?: string | null }) =>
  api.post<{ id: number }>("/bam", data);
export const updateBamService = (id: number, data: Partial<{ name: string; description: string; rule: string; category: string; icon: string | null; pos_x: number | null; pos_y: number | null }>) =>
  api.patch<{ id: number }>(`/bam/${id}`, data);
export const saveBamLayout = (positions: { id: number; pos_x: number | null; pos_y: number | null }[]) =>
  api.post<{ updated: number }>("/bam/layout", { positions });
export const deleteBamService = (id: number) => api.delete(`/bam/${id}`);
export const addBamComponent = (bsId: number, data: { check_id?: number; host_id?: number; label?: string }) =>
  api.post<{ id: number }>(`/bam/${bsId}/components`, data);
export const removeBamComponent = (compId: number) => api.delete(`/bam/components/${compId}`);

// --- Events (historique global) ---
export const listEvents = (params?: { type?: string; level?: string; host_id?: number; check_id?: number; limit?: number; offset?: number }) =>
  api.get<EventLog[]>("/events", { params });

// --- Reports (SLA / MTTR) ---
export interface SlaReport {
  days: number;
  global_availability: number;
  hosts: { host_id: number; host_name: string; samples: number; availability: number }[];
}
export interface MttrReport {
  days: number;
  incidents: number;
  resolved: number;
  active: number;
  mttr_seconds: number | null;
  longest_seconds: number | null;
}
export const getSlaReport = (days = 30) => api.get<SlaReport>("/reports/sla", { params: { days } });
export const getMttrReport = (days = 30) => api.get<MttrReport>("/reports/mttr", { params: { days } });
export const downloadReportPdf = (days = 30) =>
  api.get(`/reports/pdf`, { params: { days }, responseType: "blob" });

// --- APM (métriques applicatives) ---
export interface ApmApp {
  app_name: string;
  window_minutes: number;
  requests: number;
  errors: number;
  error_rate: number;
  rpm: number;
  latency_ms: number | null;
  last_seen: string | null;
}
export interface ApmPoint {
  t: string;
  rpm: number;
  error_rate: number;
  latency_ms: number | null;
}
export const listApmApps = (minutes = 15) =>
  api.get<ApmApp[]>("/apm/apps", { params: { minutes } });
export const getApmSeries = (app: string, hours = 24, buckets = 48) =>
  api.get<ApmPoint[]>(`/apm/apps/${encodeURIComponent(app)}/series`, { params: { hours, buckets } });

// --- Docker (conteneurs) ---
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  health: string | null;
  cpu_percent: number | null;
  mem_percent: number | null;
  mem_usage_mb: number | null;
}
export const listContainers = (stats = true) =>
  api.get<{ available: boolean; error?: string; containers: DockerContainer[] }>(
    "/docker/containers", { params: { stats } });

// --- Tickets (ITSM) ---
export interface TicketTask {
  id: number;
  label: string;
  done: boolean;
}
export interface TicketComment {
  id: number;
  author: string | null;
  body: string;
  created_at: string | null;
}
export interface Ticket {
  id: number;
  alert_id: number | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  provider: string;
  external_id: string | null;
  external_url: string | null;
  created_by: string | null;
  created_at: string | null;
  assigned_to_id: number | null;
  assigned_to: string | null;
  tasks: TicketTask[];
  comments: TicketComment[];
}
export interface TicketAssignee {
  id: number;
  email: string;
  full_name: string | null;
}
export const listTicketAssignees = () => api.get<TicketAssignee[]>("/tickets/assignees");
export interface TicketConfig {
  provider: string;
  configured: boolean;
  auto_create: boolean;
  target: string;
}
export const listTickets = (status?: string) =>
  api.get<Ticket[]>("/tickets", { params: status ? { status } : {} });
export const getTicketConfig = () => api.get<TicketConfig>("/tickets/config");
export const createTicket = (data: { title?: string; description?: string; priority?: string; alert_id?: number }) =>
  api.post<Ticket>("/tickets", data);
export const setTicketStatus = (id: number, status: string) =>
  api.patch<Ticket>(`/tickets/${id}`, { status });
export const updateTicket = (id: number, data: { title?: string; description?: string; priority?: string; status?: string; assigned_to_id?: number | null }) =>
  api.patch<Ticket>(`/tickets/${id}`, data);
export const addTicketComment = (ticketId: number, body: string) =>
  api.post<TicketComment>(`/tickets/${ticketId}/comments`, { body });
export const deleteTicketComment = (commentId: number) =>
  api.delete(`/tickets/comments/${commentId}`);
export const deleteTicket = (id: number) => api.delete(`/tickets/${id}`);
export const addTicketTask = (ticketId: number, label: string) =>
  api.post<TicketTask>(`/tickets/${ticketId}/tasks`, { label });
export const updateTicketTask = (taskId: number, data: { done?: boolean; label?: string }) =>
  api.patch<TicketTask>(`/tickets/tasks/${taskId}`, data);
export const deleteTicketTask = (taskId: number) => api.delete(`/tickets/tasks/${taskId}`);

// --- Maintenances ---
export const listMaintenances = () => api.get<Maintenance[]>("/maintenances");
export const createMaintenance = (data: {
  host_id?: number | null;
  reason?: string;
  starts_at: string;
  ends_at: string;
}) => api.post<Maintenance>("/maintenances", data);
export const deleteMaintenance = (id: number) => api.delete(`/maintenances/${id}`);

// --- Dashboard ---
export interface LayoutSection {
  id: string;
  visible: boolean;
}
export const getDashboardLayout = () =>
  api.get<{ sections: LayoutSection[]; custom: boolean }>("/dashboard/layout");
export const saveDashboardLayout = (sections: LayoutSection[]) =>
  api.put<{ sections: LayoutSection[] }>("/dashboard/layout", { sections });
export const resetDashboardLayout = () => api.delete("/dashboard/layout");
export const getSummary = () => api.get<DashboardSummary>("/dashboard/summary");
export const getIncidents = () => api.get<Incident[]>("/dashboard/incidents");
export const ackIncident = (alertId: number) =>
  api.post<Incident>(`/dashboard/incidents/${alertId}/ack`);
export const unackIncident = (alertId: number) =>
  api.post<Incident>(`/dashboard/incidents/${alertId}/unack`);
export interface RemediationAction {
  id: string;
  label: string;
  description: string;
}
export const analyzeIncident = (alertId: number) =>
  api.post<{
    analysis: string;
    model: string;
    suggested_action: string | null;
    available_actions: RemediationAction[];
  }>(`/dashboard/incidents/${alertId}/analyze`);
export const remediateIncident = (alertId: number, action: string) =>
  api.post<{ action: string; status: string; detail: string; command_id?: number }>(
    `/dashboard/incidents/${alertId}/remediate`,
    { action },
  );
export const getAgentCommand = (id: number) =>
  api.get<{ id: number; action: string; status: string; result: string | null }>(
    `/agent/commands/${id}`,
  );
export const getAiSummary = () =>
  api.post<{ summary: string; model: string }>("/dashboard/ai-summary");
export interface PlanOperation {
  op: string;
  description: string;
  destructive: boolean;
  [key: string]: unknown;
}
export interface AiPlan {
  operations: PlanOperation[];
}
export interface ApplyResult {
  applied: number;
  total: number;
  results: { op: string; status: string; detail: string; host_id?: number }[];
}
export interface RagSource { id: number; title: string; score: number; }
export const chatAI = (question: string, history: { role: string; content: string }[]) =>
  api.post<{ answer: string; model: string; plan: AiPlan | null; sources?: RagSource[] }>("/ai/chat", { question, history });

// --- Base de connaissances (RAG) ---
export interface KnowledgeDoc {
  id: number; title: string; source: string | null; chars: number;
  embedded: boolean; content: string; created_at: string | null;
}
export const listKnowledge = () => api.get<KnowledgeDoc[]>("/knowledge");
export const addKnowledge = (title: string, content: string, source?: string) =>
  api.post<KnowledgeDoc>("/knowledge", { title, content, source });
export const deleteKnowledge = (id: number) => api.delete(`/knowledge/${id}`);
export const reindexKnowledge = () => api.post<{ embedded: number }>("/knowledge/reindex");
export const importKnowledge = (data: { documents?: { title: string; content: string; source?: string }[]; markdown?: string; source?: string }) =>
  api.post<{ imported: number }>("/knowledge/import", data);
export const importStarterPack = () => api.post<{ imported: number }>("/knowledge/starter-pack");
/** Disponibilité du modèle local (Ollama). */
export interface AiStatus { available: boolean; model: string; model_installed: boolean }
export const getAiStatus = () => api.get<AiStatus>("/ai/status");

export const applyPlan = (plan: AiPlan) => api.post<ApplyResult>("/ai/apply-plan", plan);

// --- Users (admin) ---
export const listUsers = () => api.get<User[]>("/users");
export const createUser = (data: {
  email: string;
  password: string;
  full_name?: string;
  role: string;
}) => api.post<User>("/users", data);
export const updateUser = (id: number, data: Partial<{ role: string; is_active: boolean; password: string; full_name: string }>) =>
  api.put<User>(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);

// --- Rôles personnalisés (RBAC par section, admin) ---
export interface RoleSection { key: string; label: string }
export interface RoleDef {
  id?: number;
  name: string;
  builtin: boolean;
  description?: string | null;
  permissions: string[];
}
export const listRoles = () =>
  api.get<{ sections: RoleSection[]; roles: RoleDef[] }>("/roles");
export const createRole = (data: { name: string; description?: string; permissions: string[] }) =>
  api.post<{ id: number; name: string }>("/roles", data);
export const updateRole = (id: number, data: { description?: string; permissions: string[] }) =>
  api.put(`/roles/${id}`, { name: "", ...data });
export const deleteRole = (id: number) => api.delete(`/roles/${id}`);

// --- Admin (rétention / volumétrie) ---
export interface TableStat {
  count: number;
  oldest: string | null;
}
export interface DbStats {
  check_results: TableStat;
  host_metrics: TableStat;
  host_metrics_hourly: TableStat;
  alerts: TableStat;
  retention_days: {
    check_results: number;
    host_metrics: number;
    host_metrics_hourly: number;
    resolved_alerts: number;
  };
}
export const getDbStats = () => api.get<DbStats>("/admin/stats");
export interface SystemHealth {
  status: "ok" | "degraded";
  components: Record<string, { ok: boolean; [k: string]: unknown }>;
}
export const getSystemHealth = () => api.get<SystemHealth>("/admin/system");
export const runRetention = () =>
  api.post<{ deleted: Record<string, number>; total: number }>("/admin/retention/run");

// --- Branding (plan Professional) ---
export interface BrandingSettings {
  display_name: string;
  tagline: string;
  logo_url: string | null;
  accent_color: string | null;
  custom: boolean;
}
export const getBrandingSettings = () => api.get<BrandingSettings>("/branding");
export const saveBranding = (data: { display_name?: string; tagline?: string; logo_url?: string | null; accent_color?: string | null }) =>
  api.put<BrandingSettings>("/branding", data);
export const resetBranding = () => api.delete("/branding");

// --- Tenants (multi-tenant MSP, Business) ---
export interface Tenant {
  id: number;
  name: string;
  slug: string;
  hosts: number;
  users: number;
}
export const listTenants = () => api.get<Tenant[]>("/tenants");
export const createTenant = (name: string, slug?: string) =>
  api.post<{ id: number }>("/tenants", { name, slug });
export const deleteTenant = (id: number) => api.delete(`/tenants/${id}`);
export const assignHostTenant = (host_id: number, tenant_id: number | null) =>
  api.post("/tenants/assign-host", { host_id, tenant_id });
export const assignUserTenant = (user_id: number, tenant_id: number | null) =>
  api.post("/tenants/assign-user", { user_id, tenant_id });

// --- Audit (Enterprise) ---
export interface AuditEntry {
  id: number;
  user_email: string | null;
  method: string;
  path: string;
  action: string;
  status_code: number;
  ip: string | null;
  created_at: string | null;
}
export const listAudit = (params?: { user?: string; action?: string; q?: string; limit?: number; offset?: number }) =>
  api.get<AuditEntry[]>("/audit", { params });

// --- Settings ---
export const listChannels = () =>
  api.get<NotificationChannel[]>("/settings/notification-channels");
export const createChannel = (data: Partial<NotificationChannel>) =>
  api.post<NotificationChannel>("/settings/notification-channels", data);
export const testChannel = (id: number) =>
  api.post<{ sent: boolean }>(`/settings/notification-channels/${id}/test`);
