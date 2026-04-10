import { useEffect } from "react";
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";
import { useActiveLaborCount } from "@/hooks/useActiveLaborCount";

export default function AdminNotifications() {
  const { markAsSeen } = useActiveLaborCount();

  // Mark birth alerts as seen when this page loads
  useEffect(() => {
    markAsSeen();
  }, [markAsSeen]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Notificações</h1>
        <p className="page-description">
          Acompanhe alertas de parto, contrações, diários e solicitações
        </p>
      </div>

      <NotificationsCenter fullPage />
    </div>
  );
}
