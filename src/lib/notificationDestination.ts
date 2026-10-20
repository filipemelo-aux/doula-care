export function getAdminBannerDestination(type: string): string {
  if (type === "appointment_request") return "/agenda";
  if (type === "community") return "/comunidade";
  return "/notificacoes";
}