export async function fetchAddressByCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
  } catch {
    return null;
  }
}

export function formatAddressWithNumber(
  data: { street: string; neighborhood: string; city: string; state: string },
  number: string
) {
  const street = number ? `${data.street}, ${number}` : data.street;
  return [street, data.neighborhood, `${data.city} - ${data.state}`].filter(Boolean).join(" - ");
}
