import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_SCOPED_QUERY_PREFIXES = new Set([
  "clients",
  "recent-clients",
  "financial-metrics",
  "all-clients-lookup",
  "birth-alert-clients",
  "recent-diary-entries",
  "recent-contractions",
  "service-requests-pending",
  "appointment-requests-pending",
  "all-appointments",
  "clients-for-appointments",
  "transactions",
  "payments",
  "monthly-transactions",
  "dashboard-stats",
  "financial-summary",
  "transaction-payments",
]);

function getArea(pathname: string) {
  if (pathname.startsWith("/super-admin")) return "super-admin";
  if (
    pathname === "/admin" ||
    pathname === "/clientes" ||
    pathname === "/agenda" ||
    pathname === "/financeiro" ||
    pathname === "/despesas" ||
    pathname === "/relatorios" ||
    pathname === "/notificacoes" ||
    pathname === "/mensagens" ||
    pathname === "/comunidade" ||
    pathname === "/configuracoes"
  ) {
    return "admin";
  }
  return "other";
}

export function DualRoleAdminCacheGuard() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { roles, organizationId } = useAuth();
  const previousAreaRef = useRef<string>("other");

  useEffect(() => {
    const currentArea = getArea(location.pathname);
    const previousArea = previousAreaRef.current;
    const isDualRoleSuperAdmin =
      roles.includes("super_admin") && (roles.includes("admin") || roles.includes("moderator"));

    if (isDualRoleSuperAdmin && organizationId && currentArea === "admin" && previousArea !== "admin") {
      queryClient.removeQueries({
        predicate: (query) => {
          const firstKey = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined;
          return typeof firstKey === "string" &&
            (ADMIN_SCOPED_QUERY_PREFIXES.has(firstKey) || firstKey.startsWith("admin-unread-"));
        },
      });
    }

    previousAreaRef.current = currentArea;
  }, [location.pathname, organizationId, queryClient, roles]);

  return null;
}
