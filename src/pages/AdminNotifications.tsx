import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";

export default function AdminNotifications() {
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
