import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { usePlanLimits } from "@/hooks/usePlanLimits";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ organizationId: "org-free", user: { id: "doula" }, isSuperAdmin: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
    removeChannel: vi.fn(),
    from: (table: string) => {
      const data = table === "organizations" ? { plan: "free", status: "ativo" }
        : table === "org_promotions" ? { id: "november-test", status: "expired", promotion_type: "trial_15d", trial_ends_at: "2026-11-04T12:54:00Z" }
        : table === "platform_plan_limits" ? { agenda: false, max_clients: 1 }
        : null;
      const result = { data, error: null, count: 0 };
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
        limit: () => chain, or: () => chain, single: async () => result,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));

describe("Término do teste no início do mês", () => {
  it("reconhece o teste já encerrado e mantém a Agenda desativada no Free", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, unmount } = renderHook(() => usePlanLimits(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isTrialExpired).toBe(true);
    expect(result.current.plan).toBe("free");
    expect(result.current.limits.agenda).toBe(false);
    unmount();
    client.clear();
  });
});