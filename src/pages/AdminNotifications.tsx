import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";
import { MatchRequestsCard } from "@/components/dashboard/MatchRequestsCard";
import { useActiveLaborCount } from "@/hooks/useActiveLaborCount";
import { markAdminNotificationsSeen } from "@/hooks/useAdminUnreadCounts";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminNotifications() {
  const { markAsSeen } = useActiveLaborCount();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mark birth alerts + all admin notifications as seen when this page loads.
  // Persisted in DB so the sidebar badge clears across devices.
  useEffect(() => {
    markAsSeen();
    if (!user?.id) return;
    markAdminNotificationsSeen(user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-last-seen", user.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-unread-diary-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-services-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-in-labor-count"] });
    });
  }, [markAsSeen, user?.id, queryClient]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Notificações</h1>
        <p className="page-description">
          Acompanhe alertas de parto, contrações, diários e solicitações
        </p>
      </div>

      <MatchRequestsCard />
      <NotificationsCenter fullPage />
    </div>
  );
}
