import { useAuth } from "@/contexts/AuthContext";
import { InAppNotificationListener } from "@/components/notifications/InAppNotificationListener";

export function NotificationListenerProvider() {
  const { user, role, client, isAdmin, isClient } = useAuth();

  if (!user || !role) return null;

  return (
    <InAppNotificationListener
      userId={user.id}
      role={isClient ? "client" : "admin"}
      clientId={client?.id}
    />
  );
}
