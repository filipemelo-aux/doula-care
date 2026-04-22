import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import RecoverCredentials from "./pages/RecoverCredentials";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DeleteAccount from "./pages/DeleteAccount";
import Documentation from "./pages/Documentation";
import Support from "./pages/Support";
import Marketing from "./pages/Marketing";
import Portal from "./pages/Portal";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminNotifications from "./pages/AdminNotifications";
import AdminMessages from "./pages/AdminMessages";
import Subscription from "./pages/Subscription";
import LocationCoverage from "./pages/LocationCoverage";
import RegisterVisitor from "./pages/RegisterVisitor";
import VisitorDashboard from "./pages/visitante/VisitorDashboard";
import VisitorSearch from "./pages/visitante/VisitorSearch";
import VisitorDiary from "./pages/visitante/VisitorDiary";
import VisitorContractions from "./pages/visitante/VisitorContractions";
import VisitorProfile from "./pages/visitante/VisitorProfile";

import UpdatePrompt from "./components/pwa/UpdatePrompt";
import { NotificationListenerProvider } from "./components/notifications/NotificationListenerProvider";
import { ForceUpdateListener } from "./components/ForceUpdateListener";

// Gestante pages
import GestanteChangePassword from "./pages/gestante/GestanteChangePassword";
import GestanteDashboard from "./pages/gestante/GestanteDashboard";
import GestanteDiary from "./pages/gestante/GestanteDiary";
import GestanteMessages from "./pages/gestante/GestanteMessages";
import GestanteProfile from "./pages/gestante/GestanteProfile";
import GestanteContractions from "./pages/gestante/GestanteContractions";
import GestanteBreastfeeding from "./pages/gestante/GestanteBreastfeeding";
import GestanteServices from "./pages/gestante/GestanteServices";
import GestanteDocuments from "./pages/gestante/GestanteDocuments";
import GestanteAppointments from "./pages/gestante/GestanteAppointments";
import GestanteForum from "./pages/gestante/GestanteForum";
import Forum from "./pages/Forum";

const queryClient = new QueryClient();

const LegacySubscriptionRedirect = () => {
  const location = useLocation();

  return <Navigate to={`/admin/assinatura${location.search}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UpdatePrompt />
          <ForceUpdateListener />
          <NotificationListenerProvider />
          <Routes>
            {/* Single login page */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/cadastro-visitante" element={<RegisterVisitor />} />
            <Route path="/recuperar-acesso" element={<RecoverCredentials />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
            <Route path="/excluir-conta" element={<DeleteAccount />} />
            <Route path="/documentacao" element={<Documentation />} />
            <Route path="/suporte" element={<Support />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/portal" element={<Portal />} />
            {/* Legacy routes redirect to unified login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/assinatura" element={<LegacySubscriptionRedirect />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/gestante/login" element={<Navigate to="/login" replace />} />

            {/* Super Admin */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Visitor */}
            <Route
              path="/visitante"
              element={
                <ProtectedRoute allowedRoles={["visitor"]}>
                  <VisitorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitante/buscar"
              element={
                <ProtectedRoute allowedRoles={["visitor"]}>
                  <VisitorSearch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitante/diario"
              element={
                <ProtectedRoute allowedRoles={["visitor"]}>
                  <VisitorDiary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitante/contracoes"
              element={
                <ProtectedRoute allowedRoles={["visitor"]}>
                  <VisitorContractions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitante/perfil"
              element={
                <ProtectedRoute allowedRoles={["visitor"]}>
                  <VisitorProfile />
                </ProtectedRoute>
              }
            />

            {/* Client (Gestante) routes */}
            <Route
              path="/gestante/alterar-senha"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/diario"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteDiary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/mensagens"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/contracoes"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteContractions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/amamentacao"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteBreastfeeding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/servicos"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteServices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/consultas"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteAppointments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/documentos"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/comunidade"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteForum />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestante/perfil"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <GestanteProfile />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["admin", "moderator"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/notificacoes" element={<AdminNotifications />} />
              <Route path="/mensagens" element={<AdminMessages />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/financeiro" element={<Financial />} />
              <Route path="/despesas" element={<Expenses />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/comunidade" element={<Forum />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/localizacao" element={<LocationCoverage />} />
              <Route path="/admin/assinatura" element={<Subscription />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
