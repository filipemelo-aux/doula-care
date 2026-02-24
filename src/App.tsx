import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminNotifications from "./pages/AdminNotifications";
import AdminMessages from "./pages/AdminMessages";
import InstallAppBanner from "./components/pwa/InstallAppBanner";
import UpdatePrompt from "./components/pwa/UpdatePrompt";
import { NotificationListenerProvider } from "./components/notifications/NotificationListenerProvider";

// Gestante pages
import GestanteChangePassword from "./pages/gestante/GestanteChangePassword";
import GestanteDashboard from "./pages/gestante/GestanteDashboard";
import GestanteDiary from "./pages/gestante/GestanteDiary";
import GestanteMessages from "./pages/gestante/GestanteMessages";
import GestanteProfile from "./pages/gestante/GestanteProfile";
import GestanteContractions from "./pages/gestante/GestanteContractions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <InstallAppBanner />
          <UpdatePrompt />
          <NotificationListenerProvider />
          <Routes>
            {/* Single login page */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            {/* Legacy routes redirect to unified login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
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
              <Route path="/configuracoes" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
