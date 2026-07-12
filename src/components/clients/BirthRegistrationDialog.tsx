import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Baby } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const BIRTH_TYPE_OPTIONS = [
  { value: "natural", label: "Parto natural" },
  { value: "normal_induzido", label: "Parto normal induzido" },
  { value: "cesarea_intraparto", label: "Cesárea intraparto" },
  { value: "cesarea_eletiva", label: "Cesárea eletiva" },
] as const;

export const BIRTH_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BIRTH_TYPE_OPTIONS.map((o) => [o.value, o.label])
);
import { maskWeight, parseWeight } from "@/lib/masks";

// Local height mask: left-to-right fill, comma after 2 digits (e.g. "5" -> "5", "51" -> "51", "510" -> "51,0", "5100" -> "51,00")
const maskHeightCm = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)},${digits.slice(2)}`;
};
const parseHeightCm = (value: string): number | null => {
  if (!value) return null;
  const n = parseFloat(value.replace(",", "."));
  return isNaN(n) ? null : n;
};

type Client = Tables<"clients">;

const birthSchema = z.object({
  birth_date: z.string().min(1, "Data do parto é obrigatória"),
  birth_time: z.string().optional(),
  birth_weight: z.string().optional(),
  birth_height: z.string().optional(),
  birth_type: z.enum(["natural", "normal_induzido", "cesarea_intraparto", "cesarea_eletiva"], {
    required_error: "Selecione o tipo de parto",
  }),
});

type BirthFormData = z.infer<typeof birthSchema>;

interface BirthRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function BirthRegistrationDialog({
  open,
  onOpenChange,
  client,
}: BirthRegistrationDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<BirthFormData>({
    resolver: zodResolver(birthSchema),
    defaultValues: {
      birth_date: new Date().toISOString().split("T")[0],
      birth_time: "",
      birth_weight: "",
      birth_height: "",
      birth_type: undefined as any,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (client?.birth_occurred) {
      form.reset({
        birth_date: client.birth_date || new Date().toISOString().split("T")[0],
        birth_time: client.birth_time ? client.birth_time.slice(0, 5) : "",
        birth_weight: client.birth_weight != null ? Number(client.birth_weight).toFixed(3) : "",
        birth_height: client.birth_height != null ? Number(client.birth_height).toFixed(2).replace(".", ",") : "",
        birth_type: ((client as any).birth_type ?? undefined) as any,
      });
    } else {
      form.reset({
        birth_date: new Date().toISOString().split("T")[0],
        birth_time: "",
        birth_weight: "",
        birth_height: "",
        birth_type: undefined as any,
      });
    }
  }, [open, client?.id]);

  const mutation = useMutation({
    mutationFn: async (data: BirthFormData) => {
      if (!client) throw new Error("Cliente não encontrada");

      // Update client to lactante status
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          birth_occurred: true,
          birth_date: data.birth_date,
          birth_time: data.birth_time || null,
          birth_weight: parseWeight(data.birth_weight),
          birth_height: parseHeightCm(data.birth_height),
          birth_type: data.birth_type,
          status: "lactante",
          labor_started_at: null, // Clear labor status
        } as any)
        .eq("id", client.id);

      if (updateError) throw updateError;

      // Delete all contractions for this client (no longer relevant after birth)
      const { error: contractionsError } = await supabase
        .from("contractions")
        .delete()
        .eq("client_id", client.id);

      if (contractionsError) {
        console.error("Error deleting contractions:", contractionsError);
        // Don't throw - birth registration is more important
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
      queryClient.invalidateQueries({ queryKey: ["recent-diary-entries"] });
      toast.success("Parto registrado com sucesso!");
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast.error("Erro ao registrar parto");
    },
  });

  const onSubmit = (data: BirthFormData) => {
    mutation.mutate(data);
  };

  if (!client) return null;

  const babyNames = (client as any).baby_names as string[] | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Baby className="h-5 w-5 text-primary" />
            Registrar Parto
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{client.full_name}</p>
          <p className="text-xs text-muted-foreground">{client.phone}</p>
          {babyNames && babyNames.length > 0 && (
            <p className="text-xs text-primary mt-1">
              👶 {babyNames.length > 1 ? "Bebês: " : "Bebê: "}{babyNames.join(", ")}
            </p>
          )}
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Data do Parto *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="input-field h-8 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birth_time"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Hora</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        className="input-field h-8 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="birth_weight"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Peso (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="3.500"
                        {...field}
                        onChange={(e) => {
                          field.onChange(maskWeight(e.target.value));
                        }}
                        className="input-field h-8 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birth_height"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Estatura (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="50,00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(maskHeightCm(e.target.value));
                        }}
                        className="input-field h-8 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Registrar Parto"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
