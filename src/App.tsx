import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GestanteProtectedRoute } from "@/components/gestante/GestanteProtectedRoute";
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

// Gestante pages
import GestanteLogin from "./pages/gestante/GestanteLogin";
import GestanteChangePassword from "./pages/gestante/GestanteChangePassword";
import GestanteDashboard from "./pages/gestante/GestanteDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Gestante routes - Main entry point */}
            <Route path="/" element={<GestanteLogin />} />
            <Route path="/gestante/login" element={<GestanteLogin />} />
            <Route
              path="/gestante/alterar-senha"
              element={
                <GestanteProtectedRoute>
                  <GestanteChangePassword />
                </GestanteProtectedRoute>
              }
            />
            <Route
              path="/gestante"
              element={
                <GestanteProtectedRoute>
                  <GestanteDashboard />
                </GestanteProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
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
