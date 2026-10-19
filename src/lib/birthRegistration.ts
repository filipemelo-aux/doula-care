// Labor and contractions are not prerequisites: a birth may occur without either.
export function canRegisterBirth(client: { birth_occurred: boolean | null } | null | undefined): boolean {
  return Boolean(client && !client.birth_occurred);
}