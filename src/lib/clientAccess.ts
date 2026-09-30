// Regras únicas de usuário/senha do acesso da gestante (espelhadas nas funções do backend).

export const CLIENT_EMAIL_DOMAIN = "gestante.doula.app";

/** Remove acentos, apelidos entre parênteses e caracteres inválidos. */
export const nameParts = (fullName: string): string[] =>
  (fullName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const suggestUsername = (fullName: string): string => {
  const parts = nameParts(fullName);
  if (parts.length === 0) return "";
  return parts.length < 2 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
};

export const suggestPassword = (dpp?: string | null): string => {
  if (!dpp) return "";
  const p = dpp.split("-");
  const digits = p.length === 3 ? `${p[2]}${p[1]}${p[0].slice(-2)}` : dpp.replace(/\D/g, "").slice(0, 6);
  return `dpp${digits}`;
};

export const sanitizeUsername = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");

export const isValidUsername = (v: string) => /^[a-z0-9][a-z0-9._-]{2,40}$/.test(v);
