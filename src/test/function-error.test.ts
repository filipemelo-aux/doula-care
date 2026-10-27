import { describe, expect, it } from "vitest";
import { getFunctionError } from "@/lib/functionError";

describe("function error response handling", () => {
  it("reads the actual duplicate-account response instead of the generic HTTP failure", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ code: "duplicate_email", error: "duplicate" }), { status: 409 }),
    });
    const result = await getFunctionError(error);
    expect(result.message).not.toBe(error.message);
    expect(await error.context.json()).toEqual({ code: "duplicate_email", error: "duplicate" });
  });

  it("preserves the server validation reason", async () => {
    const error = { context: new Response(JSON.stringify({ error: "Senha rejeitada" }), { status: 400 }) };
    expect((await getFunctionError(error)).message).toBe("Senha rejeitada");
  });

  it("handles non-JSON failures without leaking parser errors", async () => {
    const error = Object.assign(new Error("Network failure"), { context: new Response("Unavailable", { status: 503 }) });
    expect((await getFunctionError(error)).message).toBe("Network failure");
  });
});