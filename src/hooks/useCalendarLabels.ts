import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CalendarLabel {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface CalendarDayLabel {
  id: string;
  organization_id: string;
  label_id: string;
  day: string; // yyyy-MM-dd
  note: string | null;
}

export interface DayLabelWithMeta extends CalendarDayLabel {
  label?: CalendarLabel;
}

/** Palette suggestions for label creation. */
export const LABEL_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#84CC16", // lime
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

export function useCalendarLabels(organizationId: string | null) {
  const queryClient = useQueryClient();

  const labelsQuery = useQuery({
    queryKey: ["calendar-labels", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_labels")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarLabel[];
    },
    enabled: !!organizationId,
  });

  const dayLabelsQuery = useQuery({
    queryKey: ["calendar-day-labels", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_day_labels")
        .select("*")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return (data || []) as CalendarDayLabel[];
    },
    enabled: !!organizationId,
  });

  const labelById = useMemo(() => {
    const m = new Map<string, CalendarLabel>();
    (labelsQuery.data || []).forEach((l) => m.set(l.id, l));
    return m;
  }, [labelsQuery.data]);

  /** Map of yyyy-MM-dd → list of assignments (with label meta). */
  const dayMap = useMemo(() => {
    const m = new Map<string, DayLabelWithMeta[]>();
    (dayLabelsQuery.data || []).forEach((d) => {
      const arr = m.get(d.day) || [];
      arr.push({ ...d, label: labelById.get(d.label_id) });
      m.set(d.day, arr);
    });
    return m;
  }, [dayLabelsQuery.data, labelById]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-labels", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["calendar-day-labels", organizationId] });
  };

  const createLabel = useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { error } = await supabase.from("calendar_labels").insert({
        organization_id: organizationId!,
        name: input.name,
        color: input.color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Etiqueta criada!");
    },
    onError: () => toast.error("Erro ao criar etiqueta"),
  });

  const updateLabel = useMutation({
    mutationFn: async (input: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from("calendar_labels")
        .update({ name: input.name, color: input.color })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Etiqueta atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar etiqueta"),
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Etiqueta removida!");
    },
    onError: () => toast.error("Erro ao remover etiqueta"),
  });

  const assignDayLabel = useMutation({
    mutationFn: async (input: { day: string; labelId: string; note?: string | null }) => {
      const { error } = await supabase.from("calendar_day_labels").upsert(
        {
          organization_id: organizationId!,
          day: input.day,
          label_id: input.labelId,
          note: input.note ?? null,
        },
        { onConflict: "organization_id,day,label_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao aplicar etiqueta"),
  });

  const removeDayLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_day_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao remover etiqueta do dia"),
  });

  const updateDayLabelNote = useMutation({
    mutationFn: async (input: { id: string; note: string | null }) => {
      const { error } = await supabase
        .from("calendar_day_labels")
        .update({ note: input.note })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao salvar anotação"),
  });

  return {
    labels: labelsQuery.data || [],
    dayLabels: dayLabelsQuery.data || [],
    dayMap,
    labelById,
    isLoading: labelsQuery.isLoading || dayLabelsQuery.isLoading,
    createLabel,
    updateLabel,
    deleteLabel,
    assignDayLabel,
    removeDayLabel,
    updateDayLabelNote,
  };
}
