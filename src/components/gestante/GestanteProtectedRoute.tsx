// This component is kept for backward compatibility but is no longer used directly.
// The unified ProtectedRoute in src/components/auth/ProtectedRoute.tsx handles all route protection.
// Gestante auth logic is now in the unified AuthContext via the useGestanteAuth compatibility hook.

export { ProtectedRoute as GestanteProtectedRoute } from "@/components/auth/ProtectedRoute";
