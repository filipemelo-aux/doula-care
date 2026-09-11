// Validação de e-mail profissional: bloqueia domínios descartáveis, endereços
// obviamente de teste e domínios sem servidor de e-mail (MX) configurado.

const BLOCKED_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "test.org",
  "teste.com", "mailinator.com", "guerrillamail.com", "tempmail.com",
  "temp-mail.org", "tempail.com", "throwaway.email", "yopmail.com",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "dispostable.com",
  "trashmail.com", "fakeinbox.com", "maildrop.cc", "10minutemail.com",
  "10minutemail.net", "mohmal.com", "getnada.com", "nada.email",
  "emailondeck.com", "mintemail.com", "spamgourmet.com", "mytemp.email",
  "tempmailo.com", "moakt.com", "tmail.ws", "inboxkitten.com",
  "burnermail.io", "anonaddy.me", "mail-temporaire.fr", "jetable.org",
  "spam4.me", "trashmail.de", "discard.email", "mailnesia.com",
  "tempinbox.com", "cs.email", "dropmail.me", "linshiyouxiang.net",
  "minuteinbox.com", "tempr.email", "1secmail.com", "1secmail.net",
  "1secmail.org", "harakirimail.com", "byom.de", "correotemporal.org",
]);

const BLOCKED_LOCAL_PARTS = new Set([
  "test", "teste", "admin", "root", "user", "usuario", "example", "fake",
  "aaa", "abc", "asdf", "qwerty", "noreply", "no-reply", "nobody",
]);

export interface EmailCheck {
  ok: boolean;
  error?: string;
  email: string;
  domain: string;
}

export async function validateProfessionalEmail(raw: string): Promise<EmailCheck> {
  const email = String(raw || "").trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const localPart = email.split("@")[0] ?? "";

  const shape = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
  if (!shape.test(email)) {
    return { ok: false, error: "E-mail inválido", email, domain };
  }

  if (BLOCKED_DOMAINS.has(domain) || domain.endsWith(".test") || domain.endsWith(".invalid") || domain.endsWith(".local")) {
    return { ok: false, error: "Este endereço de e-mail não é aceito. Use um e-mail real e ativo.", email, domain };
  }

  if (BLOCKED_LOCAL_PARTS.has(localPart)) {
    return { ok: false, error: "Use um e-mail profissional válido (não um endereço de teste).", email, domain };
  }

  // Checagem de DNS: o domínio precisa aceitar e-mails.
  try {
    const mx = await Deno.resolveDns(domain, "MX");
    if (!mx || mx.length === 0) {
      return { ok: false, error: "Este domínio de e-mail não recebe mensagens. Verifique o endereço.", email, domain };
    }
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    // NXDOMAIN / sem registros = domínio inexistente. Outros erros (permissão,
    // timeout) não devem bloquear um cadastro legítimo.
    if (/NXDOMAIN|no records found|NoRecordsFound|name not found/i.test(message)) {
      return { ok: false, error: "Este domínio de e-mail não existe. Verifique o endereço.", email, domain };
    }
    console.warn("[email-guard] MX check indisponível:", message);
  }

  return { ok: true, email, domain };
}
