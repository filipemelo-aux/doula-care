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
import { toast } from "sonner";
import { Baby } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const birthSchema = z.object({
  birth_date: z.string().min(1, "Data do parto é obrigatória"),
  birth_time: z.string().optional(),
  birth_weight: z.string().optional(),
  birth_height: z.string().optional(),
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
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: BirthFormData) => {
      if (!client) throw new Error("Cliente não encontrada");

      const { error } = await supabase
        .from("clients")
        .update({
          birth_occurred: true,
          birth_date: data.birth_date,
          birth_time: data.birth_time || null,
          birth_weight: data.birth_weight ? parseFloat(data.birth_weight) : null,
          birth_height: data.birth_height ? parseFloat(data.birth_height) : null,
          status: "lactante", // Automatically change status to lactante
        })
        .eq("id", client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
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
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="3.500"
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
                name="birth_height"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Estatura (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="50.00"
                        {...field}
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
