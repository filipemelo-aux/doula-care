import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Bloqueia a tela com um indicador de carregamento enquanto houver
 * gravações em andamento no banco (cadastros, edições e exclusões).
 * Intercepta o fetch e conta apenas requisições que alteram dados.
 */
const IGNORED_TABLES = [
  "notification_seen",
  "org_access_log",
  "push_subscriptions",
  "contractions",
];

// Funções de servidor que também devem mostrar o overlay de gravação
// (ex.: criar/editar/excluir membro da equipe em Configurações → Usuários).
const TRACKED_FUNCTIONS = [
  "/functions/v1/create-admin-user",
  "/functions/v1/manage-admin-user",
  "/functions/v1/reset-client-password",
];

let pending = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((l) => l(pending));

function isMutating(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/rest/v1/")) {
    // Chamadas a funções de servidor rastreadas (equipe, senha de cliente)
    if (TRACKED_FUNCTIONS.some((f) => url.includes(f))) return true;
    return false;
  }
  if (url.includes("/rest/v1/rpc/")) return false;
  if (IGNORED_TABLES.some((t) => url.includes(`/rest/v1/${t}`))) return false;
  return true;
}

if (typeof window !== "undefined" && !(window as any).__savingFetchPatched) {
  (window as any).__savingFetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const track = isMutating(input, init);
    if (track) { pending++; emit(); }
    try {
      return await original(input, init);
    } finally {
      if (track) { pending = Math.max(0, pending - 1); emit(); }
    }
  };
}

export function GlobalSavingOverlay() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    listeners.add(setCount);
    return () => { listeners.delete(setCount); };
  }, []);

  useEffect(() => {
    if (count > 0) {
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [count]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in pointer-events-auto"
      role="alert"
      aria-busy="true"
      aria-live="assertive"
      onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-8 py-6 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">Salvando, aguarde…</span>
      </div>
    </div>
  );
}
