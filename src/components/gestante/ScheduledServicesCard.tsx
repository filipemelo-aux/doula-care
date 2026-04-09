import { useState, useRef } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Briefcase, CheckCircle, Star, Loader2, Camera, X, Image as ImageIcon, ChevronDown, Clock } from "lucide-react";
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
  scheduled_date: string | null;
  rating: number | null;
  rating_comment: string | null;
  rating_photos: string[] | null;
}

interface ScheduledServicesCardProps {
  clientId: string;
  organizationId?: string | null;
}

export function ScheduledServicesCard({ clientId, organizationId }: ScheduledServicesCardProps) {
  const [ratingDialog, setRatingDialog] = useState<ServiceRequest | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Active (accepted, not completed, future)
  const { data: services } = useQuery({
    queryKey: ["scheduled-services", clientId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, responded_at, completed_at, scheduled_date, rating, rating_comment, rating_photos")
        .eq("client_id", clientId)
        .eq("status", "accepted")
        .is("completed_at", null)
        .or(`scheduled_date.is.null,scheduled_date.gte.${new Date().toISOString()}`);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query.order("responded_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!clientId,
    refetchInterval: 30000,
  });

  // Completed services history
  const { data: completedServices } = useQuery({
    queryKey: ["completed-services-history", clientId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, responded_at, completed_at, scheduled_date, rating, rating_comment, rating_photos")
        .eq("client_id", clientId)
        .not("completed_at", "is", null);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query.order("completed_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!clientId,
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, comment, photos }: { id: string; rating: number; comment: string; photos: string[] }) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ rating, rating_comment: comment || null, rating_photos: photos.length > 0 ? photos : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-services"] });
      queryClient.invalidateQueries({ queryKey: ["completed-services-history"] });
      closeRatingDialog();
      toast.success("Avaliação enviada! Obrigada 💕");
    },
    onError: () => toast.error("Erro ao enviar avaliação"),
  });

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedPhotos.length + files.length > 5) {
      toast.error("Máximo de 5 fotos");
      return;
    }
    setSelectedPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setPhotoPreviewUrls(prev => [...prev, url]);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (serviceId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of selectedPhotos) {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${serviceId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("rating-photos")
        .upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("rating-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const handleSubmitRating = async () => {
    if (!ratingDialog || selectedRating === 0) return;
    setUploading(true);
    try {
      const photoUrls = selectedPhotos.length > 0 ? await uploadPhotos(ratingDialog.id) : [];
      rateMutation.mutate({
        id: ratingDialog.id,
        rating: selectedRating,
        comment: ratingComment,
        photos: photoUrls,
      });
    } catch {
      toast.error("Erro ao enviar fotos");
    } finally {
      setUploading(false);
    }
  };

  const closeRatingDialog = () => {
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setRatingDialog(null);
    setSelectedRating(0);
    setRatingComment("");
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
  };

  const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null);

  const hasActive = services && services.length > 0;
  const hasCompleted = completedServices && completedServices.length > 0;

  if (!hasActive) return null;

  return (
    <>
      <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-success" />
          </div>
          <h2 className="font-semibold text-base text-foreground">Serviços Agendados</h2>
        </div>

          {/* Active/scheduled services */}
          {hasActive && (
            <div className="space-y-2">
              {services!.map((svc) => (
                <div key={svc.id} className="bg-background/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{svc.service_type}</p>
                    <Badge variant="outline" className="text-[10px] text-amber-700">Agendado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    {svc.budget_value ? (
                      <p className="text-sm text-muted-foreground">
                        R$ {svc.budget_value.toFixed(2).replace(".", ",")}
                      </p>
                    ) : <span />}
                    {svc.scheduled_date ? (
                      <p className="text-xs text-primary font-medium">
                        📅 {formatBrazilDateTime(svc.scheduled_date, "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    ) : svc.responded_at ? (
                      <p className="text-xs text-muted-foreground">
                        📅 {formatBrazilDateTime(svc.responded_at, "dd/MM/yyyy")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed services - collapsible compact list */}
          {hasCompleted && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className={hasActive ? "mt-3" : ""}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Histórico ({completedServices!.length})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0 divide-y divide-border/50">
                  {completedServices!.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between py-2 px-1 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate">{svc.service_type}</p>
                          {svc.rating ? (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-2.5 w-2.5 ${s <= svc.rating! ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRatingDialog(svc);
                                setSelectedRating(0);
                                setRatingComment("");
                                setSelectedPhotos([]);
                                setPhotoPreviewUrls([]);
                              }}
                              className="text-[10px] text-amber-600 hover:text-amber-700 font-medium flex-shrink-0"
                            >
                              Avaliar
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {svc.completed_at && formatBrazilDateTime(svc.completed_at, "dd/MM/yyyy")}
                          {svc.budget_value ? ` · R$ ${svc.budget_value.toFixed(2).replace(".", ",")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {svc.rating_photos && svc.rating_photos.length > 0 && (
                          <button
                            onClick={() => setViewingPhotos(svc.rating_photos!)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            <ImageIcon className="h-3 w-3" />
                            {svc.rating_photos.length}
                          </button>
                        )}
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Rating Dialog */}
      <Dialog open={!!ratingDialog} onOpenChange={(o) => !o && closeRatingDialog()}>
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

            {/* Photo upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Fotos (opcional)</p>
                <span className="text-xs text-muted-foreground">{selectedPhotos.length}/5</span>
              </div>

              {photoPreviewUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {photoPreviewUrls.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-0 right-0 bg-black/60 rounded-bl-md p-0.5"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedPhotos.length < 5 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  Adicionar foto
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddPhotos}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={selectedRating === 0 || rateMutation.isPending || uploading}
              onClick={handleSubmitRating}
            >
              {(rateMutation.isPending || uploading) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Enviar Avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewingPhotos} onOpenChange={(o) => !o && setViewingPhotos(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Fotos da Avaliação</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {viewingPhotos?.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Foto ${idx + 1}`}
                className="w-full rounded-md object-cover aspect-square"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
