import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Briefcase, CheckCircle, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatBrazilDateTime } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  responded_at: string | null;
  completed_at: string | null;
  rating: number | null;
  rating_comment: string | null;
}

interface ScheduledServicesCardProps {
  clientId: string;
}

export function ScheduledServicesCard({ clientId }: ScheduledServicesCardProps) {
  const [ratingDialog, setRatingDialog] = useState<ServiceRequest | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["scheduled-services", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, responded_at, completed_at, rating, rating_comment")
        .eq("client_id", clientId)
        .eq("status", "accepted")
        .order("responded_at", { ascending: false });

      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!clientId,
    refetchInterval: 30000,
  });

  const completeMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-services"] });
      toast.success("Serviço marcado como concluído!");
    },
    onError: () => toast.error("Erro ao marcar serviço"),
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, comment }: { id: string; rating: number; comment: string }) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ rating, rating_comment: comment || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-services"] });
      setRatingDialog(null);
      setSelectedRating(0);
      setRatingComment("");
      toast.success("Avaliação enviada! Obrigada 💕");
    },
    onError: () => toast.error("Erro ao enviar avaliação"),
  });

  if (!services || services.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            <h2 className="font-display font-semibold text-base">Serviços Agendados</h2>
          </div>

          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="bg-background/60 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{svc.service_type}</p>
                  {svc.completed_at ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">Concluído</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Agendado</Badge>
                  )}
                </div>

                {svc.budget_value && (
                  <p className="text-sm text-muted-foreground">
                    R$ {svc.budget_value.toFixed(2).replace(".", ",")}
                  </p>
                )}

                <div className="flex gap-2">
                  {!svc.completed_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => completeMutation.mutate(svc.id)}
                      disabled={completeMutation.isPending}
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      Marcar Concluído
                    </Button>
                  )}

                  {svc.completed_at && !svc.rating && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        setRatingDialog(svc);
                        setSelectedRating(0);
                        setRatingComment("");
                      }}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Avaliar
                    </Button>
                  )}

                  {svc.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= svc.rating! ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rating Dialog */}
      <Dialog open={!!ratingDialog} onOpenChange={(o) => !o && setRatingDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Avaliar Serviço</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Como foi o serviço de <strong>{ratingDialog?.service_type}</strong>?
            </p>

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedRating(s)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-8 w-8 ${s <= selectedRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Comentário (opcional)"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={selectedRating === 0 || rateMutation.isPending}
              onClick={() => {
                if (ratingDialog) {
                  rateMutation.mutate({
                    id: ratingDialog.id,
                    rating: selectedRating,
                    comment: ratingComment,
                  });
                }
              }}
            >
              {rateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Enviar Avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
