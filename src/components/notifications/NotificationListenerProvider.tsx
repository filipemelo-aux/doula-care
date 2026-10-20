import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { InAppNotificationListener } from "@/components/notifications/InAppNotificationListener";
import { AutoPushPrompt } from "@/components/notifications/AutoPushPrompt";
import { InAppAnnouncementListener } from "@/components/notifications/InAppAnnouncementListener";

export function NotificationListenerProvider() {
  const { user, role, client, isClient, isSuperAdmin, organizationId } = useAuth();
  const navigate = useNavigate();

  if (!user || !role) return null;
  // Super Admin não recebe alertas das organizações; doulas só os da própria org.
  if (isSuperAdmin) return null;
  if (!isClient && !organizationId) return <InAppAnnouncementListener key={user.id} userId={user.id} />;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <InAppAnnouncementListener key={user.id} userId={user.id} />
      <InAppNotificationListener
        userId={user.id}
        role={isClient ? "client" : "admin"}
        clientId={client?.id}
        organizationId={organizationId}
        onNavigate={handleNavigate}
      />
      {/* Convite de notificações é exclusivo da doula/equipe — nunca para gestantes. */}
      {!isClient && <AutoPushPrompt userId={user.id} />}
    </>
  );
}
