import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2,
  Smile,
  Frown,
  Meh,
  Heart,
  Sparkles,
  AlertCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendPushNotification } from "@/lib/pushNotifications";

interface DiaryEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess: () => void;
  isPuerpera?: boolean;
}

const emotions = [
  { value: "feliz", icon: Smile, label: "Feliz", color: "text-green-500 bg-green-50 border-green-200 hover:bg-green-100" },
  { value: "triste", icon: Frown, label: "Triste", color: "text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { value: "ansiosa", icon: AlertCircle, label: "Ansiosa", color: "text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
  { value: "calma", icon: Heart, label: "Calma", color: "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10" },
  { value: "animada", icon: Sparkles, label: "Animada", color: "text-purple-500 bg-purple-50 border-purple-200 hover:bg-purple-100" },
  { value: "cansada", icon: Meh, label: "Cansada", color: "text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100" },
];

const pregnancySymptoms = [
  "Enjoo",
  "Azia",
  "Dor nas costas",
  "Inchaço",
  "Cansaço",
  "Insônia",
  "Dor de cabeça",
  "Contrações",
  "Movimento do bebê",
  "Fome excessiva",
];

const puerperiumSymptoms = [
  "Dor ao amamentar",
  "Ingurgitamento mamário",
  "Mastite",
  "Fissuras no mamilo",
  "Cansaço extremo",
  "Privação de sono",
  "Baby blues",
  "Ansiedade pós-parto",
  "Cólica uterina",
  "Sangramento vaginal",
  "Dor na cesárea",
  "Dor no períneo",
  "Inchaço nas pernas",
  "Queda de cabelo",
  "Suor noturno",
  "Fome excessiva",
  "Sede constante",
  "Dificuldade na pega",
  "Baixa produção de leite",
  "Vazamento de leite",
];

export function DiaryEntryDialog({ open, onOpenChange, clientId, onSuccess, isPuerpera = false }: DiaryEntryDialogProps) {
  const { organizationId } = useAuth();
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  
  const currentSymptoms = isPuerpera ? puerperiumSymptoms : pregnancySymptoms;

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Escreva algo no seu diário");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("pregnancy_diary")
        .insert({
          client_id: clientId,
          content: content.trim(),
          emotion,
          symptoms: symptoms.length > 0 ? symptoms : null,
          observations: observations.trim() || null,
          organization_id: organizationId || null,
        });

      if (error) throw error;

      // Notify admin about new diary entry
      sendPushNotification({
        send_to_admins: true,
        title: "📔 Novo Registro no Diário",
        message: `Nova entrada no diário de gestação.`,
        url: "/dashboard",
        tag: "diary-entry",
      });

      toast.success("Registro salvo com sucesso!");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving diary entry:", error);
      toast.error("Erro ao salvar registro");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setContent("");
    setEmotion(null);
    setSymptoms([]);
    setObservations("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Novo Registro</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Content */}
          <div className="space-y-2">
            <Label>Como foi seu dia?</Label>
            <Textarea
              placeholder="Conte como você está se sentindo, o que aconteceu de especial..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Emotions */}
          <div className="space-y-2">
            <Label>Como você está se sentindo?</Label>
            <div className="grid grid-cols-3 gap-2">
              {emotions.map((em) => {
                const Icon = em.icon;
                const isSelected = emotion === em.value;
                return (
                  <button
                    key={em.value}
                    type="button"
                    onClick={() => setEmotion(isSelected ? null : em.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                      isSelected 
                        ? em.color + " border-current" 
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", isSelected && em.color.split(" ")[0])} />
                    <span className="text-xs font-medium">{em.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptoms */}
          <div className="space-y-2">
            <Label>{isPuerpera ? "Sintomas do puerpério (opcional)" : "Sintomas do dia (opcional)"}</Label>
            <div className="flex flex-wrap gap-2">
              {currentSymptoms.map((symptom) => {
                const isSelected = symptoms.includes(symptom);
                return (
                  <Badge
                    key={symptom}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected && "bg-primary"
                    )}
                    onClick={() => toggleSymptom(symptom)}
                  >
                    {symptom}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observações adicionais (opcional)</Label>
            <Textarea
              placeholder="Consultas, exames, dúvidas para a doula..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
