import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Loading } from "./components/States";
import LoginPage from "./pages/LoginPage";
import { BrandingProvider } from "./lib/branding";
import { I18nProvider } from "./lib/i18n";
import { ToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/Confirm";

// Code splitting : chaque page est chargée à la demande.
const StatusPage = lazy(() => import("./pages/StatusPage"));
const TvPage = lazy(() => import("./pages/TvPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"));
const HostsPage = lazy(() => import("./pages/HostsPage"));
const HostDetailPage = lazy(() => import("./pages/HostDetailPage"));
const ChecksPage = lazy(() => import("./pages/ChecksPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const CheckDetailPage = lazy(() => import("./pages/CheckDetailPage"));
const IncidentCenterPage = lazy(() => import("./pages/IncidentCenterPage"));
const TopologyPage = lazy(() => import("./pages/TopologyPage"));
const GeoMapPage = lazy(() => import("./pages/GeoMapPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const BamPage = lazy(() => import("./pages/BamPage"));
const OperationsMapPage = lazy(() => import("./pages/OperationsMapPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const ApmPage = lazy(() => import("./pages/ApmPage"));
const ContainersPage = lazy(() => import("./pages/ContainersPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const TenantsPage = lazy(() => import("./pages/TenantsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));

export default function App() {
  return (
    <I18nProvider>
    <ToastProvider>
    <ConfirmProvider>
    <BrandingProvider>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/status" element={<Suspense fallback={null}><StatusPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
        <Route path="/tv" element={<ProtectedRoute><Suspense fallback={null}><TvPage /></Suspense></ProtectedRoute>} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/*"
            element={
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/monitoring" element={<MonitoringPage />} />
                  <Route path="/hosts" element={<HostsPage />} />
                  <Route path="/hosts/:id" element={<HostDetailPage />} />
                  <Route path="/checks" element={<ChecksPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/checks/:id" element={<CheckDetailPage />} />
                  <Route path="/incidents" element={<IncidentCenterPage />} />
                  <Route path="/topology" element={<TopologyPage />} />
                  <Route path="/geo" element={<GeoMapPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/operations" element={<OperationsMapPage />} />
                  <Route path="/bam" element={<BamPage />} />
                  <Route path="/apm" element={<ApmPage />} />
                  <Route path="/containers" element={<ContainersPage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                  <Route path="/tenants" element={<TenantsPage />} />
                  <Route path="/assistant" element={<ChatPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
    </BrandingProvider>
    </ConfirmProvider>
    </ToastProvider>
    </I18nProvider>
  );
}
