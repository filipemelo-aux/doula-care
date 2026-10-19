import { beforeEach, describe, expect, it, vi } from "vitest";
const { chain, supabase } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["insert", "update", "delete", "eq", "is", "or", "select", "maybeSingle"]) chain[method] = vi.fn();
  return { chain, supabase: { from: vi.fn() } };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase }));
vi.mock("@/lib/pushNotifications", () => ({ sendPushNotification: vi.fn() }));
import { removeContraction, startClientLabor, acknowledgeContractions } from "@/lib/laborActions";

beforeEach(() => {
  vi.clearAllMocks();
  supabase.from.mockReturnValue(chain);
  Object.values(chain).forEach(method => method.mockReturnValue(chain));
});
describe("Ações de trabalho de parto", () => {
  it("inicia o trabalho de parto sem registrar nascimento", async () => {
    chain.maybeSingle.mockResolvedValue({ data: { id: "client", full_name: "Teste", labor_started_at: "2026-10-19" }, error: null });
    await startClientLabor("client");
    expect(chain.update).toHaveBeenCalledWith({ labor_started_at: expect.any(String), labor_started_by: "doula" });
    expect(chain.is).toHaveBeenCalledWith("labor_started_at", null);
    expect(chain.or).toHaveBeenCalledWith("birth_occurred.is.null,birth_occurred.eq.false");
  });
  it("Aguardar apenas marca contrações como lidas e preserva o início", async () => {
    await acknowledgeContractions("client");
    expect(supabase.from).toHaveBeenCalledWith("contractions");
    expect(chain.update).toHaveBeenCalledWith({ read_by_admin: true });
    expect(chain.eq).toHaveBeenCalledWith("client_id", "client");
    expect(chain.delete).not.toHaveBeenCalled();
  });
  it("exclui somente a contração escolhida da cliente", async () => {
    chain.maybeSingle.mockResolvedValue({ data: { id: "chosen" }, error: null });
    await removeContraction("chosen", "client");
    expect(chain.eq).toHaveBeenCalledWith("id", "chosen");
    expect(chain.eq).toHaveBeenCalledWith("client_id", "client");
    expect(chain.delete).toHaveBeenCalledTimes(1);
  });
  it("não informa sucesso quando nenhuma contração foi excluída", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(removeContraction("chosen", "client")).rejects.toThrow("Não foi possível excluir");
  });
});