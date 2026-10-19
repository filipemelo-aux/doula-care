import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/pushNotifications";

// Read back the changed row: RLS may otherwise return a successful no-op.
export async function startClientLabor(clientId: string) {
  const { data, error } = await supabase.from("clients")
    .update({ labor_started_at: new Date().toISOString(), labor_started_by: "doula" })
    .eq("id", clientId).is("labor_started_at", null)
    .or("birth_occurred.is.null,birth_occurred.eq.false")
    .select("id, full_name, labor_started_at, organization_id, user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível iniciar: confira se o trabalho de parto já foi registrado ou o nascimento ocorreu.");
  const { error: notificationError } = await supabase.from("client_notifications").insert({
    client_id: data.id,
    organization_id: data.organization_id,
    title: "💕 Seu bebê está a caminho!",
    message: "Sua Doula registrou que o trabalho de parto começou. Respire fundo, confie no seu corpo. Estarei com você!",
  });
  if (notificationError) console.error("Erro ao avisar a cliente sobre início do trabalho de parto", notificationError);
  if (data.user_id) void sendPushNotification({
    user_ids: [data.user_id], title: "💕 Seu bebê está a caminho!",
    message: "Sua Doula registrou que o trabalho de parto começou. Respire fundo!",
    url: "/gestante", tag: "labor-started-client", type: "labor_started",
    priority: "critica", require_interaction: true,
  });
  return data;
}

export async function acknowledgeContractions(clientId: string) {
  const { error } = await supabase.from("contractions")
    .update({ read_by_admin: true }).eq("client_id", clientId).eq("read_by_admin", false);
  if (error) throw error;
}

export async function removeContraction(id: string, clientId: string) {
  const { data, error } = await supabase.from("contractions").delete()
    .eq("id", id).eq("client_id", clientId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível excluir esta contração. Atualize o histórico e tente novamente.");
}

export const laborQueryKeys = [
  "birth-alert-clients", "clients", "all-clients-lookup", "recent-clients",
  "client-quick-view", "top-notification-banner", "recent-contractions",
  "client-contractions", "admin-in-labor-count",
];