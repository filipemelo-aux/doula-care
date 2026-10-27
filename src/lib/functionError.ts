/** Read structured errors from the Response returned by a failed function call. */
export async function getFunctionError(error: unknown): Promise<Error> {
  const fallback = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const context = error && typeof error === "object" && "context" in error ? error.context : undefined;
  if (context instanceof Response) {
    try {
      const payload: unknown = await context.clone().json();
      if (payload && typeof payload === "object") {
        if ("code" in payload && payload.code === "duplicate_email") {
          return new Error("Este e-mail já está cadastrado. Use a conta existente em vez de criar outra.");
        }
        if ("error" in payload && typeof payload.error === "string") {
          return new Error(payload.error);
        }
      }
    } catch {
      // Non-JSON failures retain the original error rather than a parsing error.
    }
  }
  return new Error(fallback);
}