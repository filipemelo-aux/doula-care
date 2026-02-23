import { useAuth } from "@/contexts/AuthContext";
import { InAppNotificationListener } from "@/components/notifications/InAppNotificationListener";
import { AutoPushPrompt } from "@/components/notifications/AutoPushPrompt";

export function NotificationListenerProvider() {
  const { user, role, client, isAdmin, isClient, organizationId } = useAuth();

  if (!user || !role) return null;

  return (
    <>
      <InAppNotificationListener
        userId={user.id}
        role={isClient ? "client" : "admin"}
        clientId={client?.id}
        organizationId={organizationId}
      />
      <AutoPushPrompt userId={user.id} />
    </>
  );
}
