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
import { Briefcase, CheckCircle, Star, Loader2, Camera, X, Image as ImageIcon } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["scheduled-services", clientId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, responded_at, completed_at, scheduled_date, rating, rating_comment, rating_photos")
        .eq("client_id", clientId)
        .eq("status", "accepted");

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
    mutationFn: async ({ id, rating, comment, photos }: { id: string; rating: number; comment: string; photos: string[] }) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ rating, rating_comment: comment || null, rating_photos: photos.length > 0 ? photos : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-services"] });
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

  if (!services || services.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            <h2 className="font-display font-semibold text-base">Serviços Agendados</h2>
          </div>

          {/* Active/scheduled services */}
          {services.filter(s => !s.completed_at).length > 0 && (
            <div className="space-y-2">
              {services.filter(s => !s.completed_at).map((svc) => (
                <div key={svc.id} className="bg-background/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{svc.service_type}</p>
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Agendado</Badge>
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

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed/finalized services - reduced & opaque */}
          {services.filter(s => !!s.completed_at).length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs font-medium text-muted-foreground/70 px-1">Serviços Finalizados</p>
              {services.filter(s => !!s.completed_at).map((svc) => (
                <div key={svc.id} className="bg-background/30 rounded-lg p-2.5 space-y-1.5 opacity-60">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-xs">{svc.service_type}</p>
                    <Badge className="bg-muted text-muted-foreground text-[10px] border-0">Concluído</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    {svc.budget_value ? (
                      <p className="text-xs text-muted-foreground">
                        R$ {svc.budget_value.toFixed(2).replace(".", ",")}
                      </p>
                    ) : <span />}
                    {svc.scheduled_date ? (
                      <p className="text-[10px] text-muted-foreground">
                        📅 {formatBrazilDateTime(svc.scheduled_date, "dd/MM/yyyy")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex gap-2 flex-wrap items-center">
                    {!svc.rating && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-6 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() => {
                          setRatingDialog(svc);
                          setSelectedRating(0);
                          setRatingComment("");
                          setSelectedPhotos([]);
                          setPhotoPreviewUrls([]);
                        }}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Avaliar
                      </Button>
                    )}

                    {svc.rating && (
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${s <= svc.rating! ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                        {svc.rating_photos && svc.rating_photos.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-5 px-1"
                            onClick={() => setViewingPhotos(svc.rating_photos!)}
                          >
                            <ImageIcon className="h-3 w-3 mr-0.5" />
                            {svc.rating_photos.length}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {svc.rating_comment && (
                    <p className="text-[10px] text-muted-foreground italic">"{svc.rating_comment}"</p>
                  )}
                </div>
              ))}
            </div>
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
                    <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border">
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
