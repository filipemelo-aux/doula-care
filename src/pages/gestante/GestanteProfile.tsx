import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  LogOut,
  Loader2,
  Edit,
  Baby,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { EditContactDialog } from "@/components/gestante/EditContactDialog";
import { getLocalDate } from "@/lib/utils";

type Client = Tables<"clients">;

export default function GestanteProfile() {
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { client, user, signOut } = useGestanteAuth();

  useEffect(() => {
    if (user) {
      fetchClientData();
    }
  }, [user]);

  const fetchClientData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setClientData(data);
    } catch (error) {
      console.error("Error fetching client:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pago: { variant: "default", label: "Pago" },
      pendente: { variant: "destructive", label: "Pendente" },
      parcial: { variant: "secondary", label: "Parcial" },
    };
    return variants[status] || variants.pendente;
  };

  const getPlanLabel = (plan: string) => {
    const plans: Record<string, string> = {
      basico: "Básico",
      intermediario: "Intermediário",
      completo: "Completo",
    };
    return plans[plan] || plan;
  };

  if (loading) {
    return (
      <GestanteLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GestanteLayout>
    );
  }

  return (
    <GestanteLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg">Meu Perfil</h1>
              <p className="text-xs text-muted-foreground">{client?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Plan Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Meu Plano</CardTitle>
              </div>
              <Badge variant={getPaymentStatusBadge(clientData?.payment_status || "pendente").variant}>
                {getPaymentStatusBadge(clientData?.payment_status || "pendente").label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold">{getPlanLabel(clientData?.plan || "basico")}</p>
                <p className="text-sm text-muted-foreground">Plano contratado</p>
              </div>
              {clientData?.plan_value && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-primary">
                    R$ {clientData.plan_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* DPP Info */}
        {clientData?.dpp && (
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Baby className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Data Prevista do Parto</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="font-semibold">
                      {format(getLocalDate(clientData.dpp), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Dados de Contato</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{clientData?.phone || "Não informado"}</span>
            </div>
            {clientData?.street && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p>{clientData.street}{clientData.number && `, ${clientData.number}`}</p>
                  {clientData.neighborhood && <p className="text-muted-foreground">{clientData.neighborhood}</p>}
                  {clientData.city && clientData.state && (
                    <p className="text-muted-foreground">{clientData.city} - {clientData.state}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Companion Info */}
        {clientData?.companion_name && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Acompanhante
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{clientData.companion_name}</p>
              {clientData.companion_phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Phone className="h-3 w-3" />
                  {clientData.companion_phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sign Out Button */}
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da conta
        </Button>
      </div>

      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={clientData}
        onUpdate={fetchClientData}
      />
    </GestanteLayout>
  );
}
