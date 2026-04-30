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

export async function fetchCoordinatesByCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (res.ok) {
      const data = await res.json();
      const coordinates = data?.location?.coordinates;
      const latitude = Number(coordinates?.latitude);
      const longitude = Number(coordinates?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }
  } catch {
    // Fallback abaixo
  }

  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    const latitude = Number(data?.lat);
    const longitude = Number(data?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
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
