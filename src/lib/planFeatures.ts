// Serviços inclusos do plano são salvos como texto: "3x Encontro pré-parto".
// Quantidade 1 é salva só com o nome, preservando registros antigos.
const QTY_RE = /^(\d{1,2})\s*x\s+(.+)$/i;

export function parseFeature(raw: string): { qty: number; name: string } {
  const t = (raw || "").trim();
  const m = t.match(QTY_RE);
  if (m) return { qty: Math.max(1, parseInt(m[1], 10)), name: m[2].trim() };
  return { qty: 1, name: t };
}

export function formatFeature(name: string, qty: number): string {
  const n = name.trim();
  if (!n) return "";
  return qty > 1 ? `${qty}x ${n}` : n;
}

/** Expande "3x Encontro" em "Encontro 1/3", "Encontro 2/3", "Encontro 3/3". */
export function expandFeatures(features: (string | null | undefined)[] | null | undefined): string[] {
  const out: string[] = [];
  for (const f of features || []) {
    const { qty, name } = parseFeature(f || "");
    if (!name) continue;
    if (qty <= 1) out.push(name);
    else for (let i = 1; i <= qty; i++) out.push(`${name} ${i}/${qty}`);
  }
  return out;
}
