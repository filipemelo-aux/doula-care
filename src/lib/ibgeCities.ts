// IBGE Localidades API — gratuita, sem chave, todas as cidades brasileiras
// https://servicodados.ibge.gov.br/api/docs/localidades

export interface IBGECity {
  id: number;
  nome: string;
  uf: string; // sigla do estado (SP, RJ, etc.)
  ufNome: string;
}

let cache: IBGECity[] | null = null;
let pending: Promise<IBGECity[]> | null = null;

export function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function loadAllCities(): Promise<IBGECity[]> {
  if (cache) return cache;
  if (pending) return pending;
  pending = (async () => {
    const res = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
    );
    const data = await res.json();
    cache = (data || []).map((m: any) => ({
      id: m.id,
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || "",
      ufNome: m.microrregiao?.mesorregiao?.UF?.nome || "",
    }));
    return cache!;
  })();
  return pending;
}

export async function searchCities(query: string, limit = 10): Promise<IBGECity[]> {
  const q = normalize(query);
  if (q.length < 2) return [];
  const all = await loadAllCities();
  const results: IBGECity[] = [];
  for (const c of all) {
    if (normalize(c.nome).includes(q)) {
      results.push(c);
      if (results.length >= limit) break;
    }
  }
  return results;
}
