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
import Plans from "./pages/Plans";
import Financial from "./pages/Financial";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import InstallAppBanner from "./components/pwa/InstallAppBanner";
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
          <NotificationListenerProvider />
          <Routes>
            {/* Single login page */}
            <Route path="/login" element={<Login />} />
            {/* Legacy routes redirect to unified login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/gestante/login" element={<Navigate to="/login" replace />} />

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
              <Route path="/clientes" element={<Clients />} />
              <Route path="/planos" element={<Plans />} />
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
