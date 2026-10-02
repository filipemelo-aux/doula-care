import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { InAppNotificationListener } from "@/components/notifications/InAppNotificationListener";
import { AutoPushPrompt } from "@/components/notifications/AutoPushPrompt";

export function NotificationListenerProvider() {
  const { user, role, client, isClient, isSuperAdmin, organizationId } = useAuth();
  const navigate = useNavigate();

  if (!user || !role) return null;
  // Super Admin não recebe alertas das organizações; doulas só os da própria org.
  if (isSuperAdmin || (!isClient && !organizationId)) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <InAppNotificationListener
        userId={user.id}
        role={isClient ? "client" : "admin"}
        clientId={client?.id}
        organizationId={organizationId}
        onNavigate={handleNavigate}
      />
      <AutoPushPrompt userId={user.id} />
    </>
  );
}
