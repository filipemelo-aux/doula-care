import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateCurrentPregnancyWeeks } from "@/lib/pregnancy";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { maskPhone, maskCPF, maskCEP, maskCurrency, parseCurrency } from "@/lib/masks";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const clientSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  phone: z.string().optional().default(""),
  cpf: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  companion_name: z.string().optional(),
  companion_phone: z.string().optional(),
  status: z.enum(["gestante", "lactante", "outro"]).optional().default("gestante"),
  custom_status: z.string().optional(),
  pregnancy_weeks: z.number().min(0).max(42).optional().nullable(),
  dpp: z.string().optional().default(""),
  baby_names: z.string().optional(),
  birth_location: z.string().optional(),
  plan_setting_id: z.string().min(1, "Selecione um plano"),
  payment_method: z.enum(["pix", "cartao", "dinheiro", "transferencia"]).optional().default("pix"),
  payment_type: z.enum(["a_vista", "parcelado"]).optional().default("a_vista"),
  discount_percent: z.number().min(0).max(100).optional(),
  payment_date_avista: z.string().optional(),
  installments: z.number().min(1).max(24).optional(),
  installment_frequency: z.enum(["semanal", "quinzenal", "mensal", "manual"]).optional(),
  custom_interval_days: z.number().min(1).max(365).optional(),
  first_due_date: z.string().optional(),
  plan_value: z.number().min(0).optional(),
  prenatal_type: z.string().optional(),
  prenatal_high_risk: z.boolean().optional(),
  comorbidades: z.string().optional(),
  alergias: z.string().optional(),
  restricao_aromaterapia: z.string().optional(),
  has_fotografa: z.boolean().optional(),
  fotografa_name: z.string().optional(),
  fotografa_phone: z.string().optional(),
  instagram_gestante: z.string().optional(),
  instagram_acompanhante: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

const STEPS = [
  { id: 1, title: "Dados Pessoais", shortTitle: "Pessoal" },
  { id: 2, title: "Endereço", shortTitle: "Endereço" },
  { id: 3, title: "Gestação e Pré-natal", shortTitle: "Gestação" },
  { id: 4, title: "Saúde e Restrições", shortTitle: "Saúde" },
  { id: 5, title: "Rede de Apoio", shortTitle: "Apoio" },
  { id: 6, title: "Plano e Pagamento", shortTitle: "Plano" },
];

export function ClientDialog({ open, onOpenChange, client }: ClientDialogProps) {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [entryAlreadyPaid, setEntryAlreadyPaid] = useState(false);
  const [entryType, setEntryType] = useState<"equal" | "percentage">("equal");
  const [entryPercentage, setEntryPercentage] = useState<number>(0);
  const [customInstallmentAmounts, setCustomInstallmentAmounts] = useState<number[]>([]);
  const lastEffectivePlanValueRef = useRef<number>(0);
  const [prenatalTeam, setPrenatalTeam] = useState<{name: string; role: string}[]>([]);

  const { data: planSettings } = useQuery({
    queryKey: ["plan-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  // Fetch the auto-generated transaction for the client to get installment info
  const { data: clientTransaction } = useQuery({
    queryKey: ["client-transaction", client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, installments, installment_value, payment_method, date")
        .eq("client_id", client.id)
        .eq("is_auto_generated", true)
        .eq("type", "receita")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  const { data: clientInstallmentPayments } = useQuery({
    queryKey: ["client-installment-payments", client?.id, clientTransaction?.id],
    queryFn: async () => {
      if (!client?.id) return [];

      if (clientTransaction?.id) {
        const { data: byTx, error: byTxErr } = await supabase
          .from("payments")
          .select("amount, amount_paid, due_date, installment_number, total_installments, transaction_id")
          .eq("transaction_id", clientTransaction.id)
          .order("installment_number", { ascending: true });

        if (byTxErr) throw byTxErr;
        if (byTx && byTx.length > 0) return byTx;
      }

      const { data: legacy, error: legacyErr } = await supabase
        .from("payments")
        .select("amount, amount_paid, due_date, installment_number, total_installments, transaction_id")
        .eq("client_id", client.id)
        .is("transaction_id", null)
        .order("installment_number", { ascending: true });

      if (legacyErr) throw legacyErr;
      return legacy || [];
    },
    enabled: !!client?.id && open,
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      cpf: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      zip_code: "",
      companion_name: "",
      companion_phone: "",
      status: "gestante",
      custom_status: "",
      pregnancy_weeks: null,
      dpp: "",
      baby_names: "",
      birth_location: "",
        plan_setting_id: "",
        payment_method: "pix",
        payment_type: "a_vista",
        discount_percent: 0,
        payment_date_avista: "",
        installments: 1,
        installment_frequency: "mensal",
        custom_interval_days: 30,
        first_due_date: "",
        plan_value: 0,
        prenatal_type: "",
        prenatal_high_risk: false,
        comorbidades: "",
        alergias: "",
        restricao_aromaterapia: "",
        has_fotografa: false,
        fotografa_name: "",
        fotografa_phone: "",
        instagram_gestante: "",
        instagram_acompanhante: "",
        notes: "",
      },
  });

  const status = form.watch("status");
  const selectedPlanId = form.watch("plan_setting_id");
  const watchedPaymentType = form.watch("payment_type");
  const watchedFirstDueDate = form.watch("first_due_date");
  const watchedPaymentDateAvista = form.watch("payment_date_avista");
  const watchedInstallments = form.watch("installments") || 1;
  const watchedInstallmentFrequency = form.watch("installment_frequency") || "mensal";
  const watchedPlanValue = form.watch("plan_value") || 0;
  const watchedDiscountPercent = form.watch("discount_percent") || 0;
  const effectivePlanValue = watchedDiscountPercent > 0
    ? Math.round(watchedPlanValue * (1 - watchedDiscountPercent / 100) * 100) / 100
    : watchedPlanValue;

  // Date-based auto-pay logic
  const today = format(new Date(), "yyyy-MM-dd");
  const relevantDate = watchedPaymentType === "parcelado"
    ? (watchedFirstDueDate || today)
    : (watchedPaymentDateAvista || today);
  const isFirstDueDateInPast = relevantDate < today;
  

  // Resolve selected plan setting from ID
  const selectedPlanSetting = useMemo(() => {
    if (!selectedPlanId || selectedPlanId === "avulso") return null;
    return planSettings?.find(p => p.id === selectedPlanId) || null;
  }, [selectedPlanId, planSettings]);

  // Update plan value when plan changes (not for avulso)
  const prevPlanIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (planSettings && selectedPlanId) {
      // On edit mode, only update if the user actually changed the plan selection
      if (client && prevPlanIdRef.current === null) {
        // First render with client data — just record, don't change
        prevPlanIdRef.current = selectedPlanId;
        return;
      }
      if (client && prevPlanIdRef.current === selectedPlanId) {
        return; // No plan change, keep current value
      }
      prevPlanIdRef.current = selectedPlanId;

      if (selectedPlanId === "avulso") {
        form.setValue("plan_value", 0);
      } else if (selectedPlanSetting) {
        form.setValue("plan_value", Number(selectedPlanSetting.default_value));
      }
    }
  }, [selectedPlanId, selectedPlanSetting, planSettings, form, client]);

  // Reset form when client changes or dialog opens fresh
  useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
    if (client) {
      const txInstallments = clientTransaction?.installments ? Number(clientTransaction.installments) : 1;
      const isParcelado = txInstallments > 1;
      const sortedPayments = (clientInstallmentPayments || [])
        .slice()
        .sort((a, b) => Number(a.installment_number || 0) - Number(b.installment_number || 0));
      const hasCustomInstallments = sortedPayments.length > 1 &&
        sortedPayments.some((p, _, arr) => Math.abs(Number(p.amount || 0) - Number(arr[0]?.amount || 0)) > 0.01);
      const firstInstallment = sortedPayments[0];
      const firstDueDate = firstInstallment?.due_date || "";
      const isFirstInstallmentPaid = !!firstInstallment &&
        Number(firstInstallment.amount || 0) > 0 &&
        Number(firstInstallment.amount_paid || 0) >= Number(firstInstallment.amount || 0);

      form.reset({
        full_name: client.full_name,
        phone: client.phone,
        cpf: client.cpf || "",
        street: client.street || "",
        number: client.number || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        zip_code: client.zip_code || "",
        companion_name: client.companion_name || "",
        companion_phone: client.companion_phone || "",
        status: client.status as "gestante" | "lactante" | "outro",
        custom_status: (client as any).custom_status || "",
        pregnancy_weeks: client.pregnancy_weeks,
        dpp: client.dpp || "",
        baby_names: (client as any).baby_names?.join(", ") || "",
        birth_location: (client as any).birth_location || "",
        plan_setting_id: (client as any).plan_setting_id || (planSettings?.find(p => p.plan_type === client.plan)?.id) || (client.plan === "avulso" ? "avulso" : ""),
        payment_method: client.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia",
        payment_type: isParcelado ? "parcelado" : "a_vista",
        discount_percent: 0,
        payment_date_avista: isParcelado ? "" : (clientTransaction?.date || ""),
        installments: txInstallments,
        installment_frequency: hasCustomInstallments ? "manual" : "mensal",
        custom_interval_days: 30,
        first_due_date: firstDueDate,
        plan_value: Number(client.plan_value) || 0,
        prenatal_type: (client as any).prenatal_type || "",
        prenatal_high_risk: (client as any).prenatal_high_risk || false,
        comorbidades: (client as any).comorbidades || "",
        alergias: (client as any).alergias || "",
        restricao_aromaterapia: (client as any).restricao_aromaterapia || "",
        has_fotografa: (client as any).has_fotografa || false,
        fotografa_name: (client as any).fotografa_name || "",
        fotografa_phone: (client as any).fotografa_phone || "",
        instagram_gestante: (client as any).instagram_gestante || "",
        instagram_acompanhante: (client as any).instagram_acompanhante || "",
        notes: client.notes || "",
      });
      setEntryAlreadyPaid(isParcelado ? isFirstInstallmentPaid : false);
      setEntryType("equal");
      setEntryPercentage(0);
      setCustomInstallmentAmounts(
        isParcelado && hasCustomInstallments && sortedPayments.length === txInstallments
          ? sortedPayments.map((p) => Number(p.amount) || 0)
          : []
      );
      const teamData = (client as any).prenatal_team;
      setPrenatalTeam(Array.isArray(teamData) ? teamData : []);
    } else {
      setEntryAlreadyPaid(false);
      setEntryType("equal");
      setEntryPercentage(0);
      setCustomInstallmentAmounts([]);
      setPrenatalTeam([]);
      form.reset({
        full_name: "",
        phone: "",
        cpf: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
        companion_name: "",
        companion_phone: "",
        status: "gestante",
        custom_status: "",
        pregnancy_weeks: null,
        dpp: "",
        baby_names: "",
        birth_location: "",
        plan_setting_id: "",
        payment_method: "pix",
        payment_type: "a_vista",
        discount_percent: 0,
        payment_date_avista: "",
        installments: 1,
        installment_frequency: "mensal",
        custom_interval_days: 30,
        first_due_date: "",
        plan_value: 0,
        prenatal_type: "",
        prenatal_high_risk: false,
        comorbidades: "",
        alergias: "",
        restricao_aromaterapia: "",
        has_fotografa: false,
        fotografa_name: "",
        fotografa_phone: "",
        instagram_gestante: "",
        instagram_acompanhante: "",
        notes: "",
      });
    }
  }, [client, open, form, planSettings, clientTransaction, clientInstallmentPayments]);

  useEffect(() => {
    if (watchedPaymentType !== "parcelado") return;
    // For manual frequency, always sync custom amounts; for others, only when percentage entry is used
    const isManual = watchedInstallmentFrequency === "manual";
    const isPercentageEntry = entryType === "percentage" && entryPercentage > 0 && entryPercentage < 100;
    if (!isManual && !isPercentageEntry) {
      // Clear custom amounts when switching away from percentage on non-manual
      if (customInstallmentAmounts.length > 0 && !isManual) setCustomInstallmentAmounts([]);
      return;
    }
    if (watchedInstallments <= 1) {
      if (customInstallmentAmounts.length > 0) setCustomInstallmentAmounts([]);
      return;
    }

    const needsRecalc = customInstallmentAmounts.length !== watchedInstallments ||
      Math.abs(lastEffectivePlanValueRef.current - effectivePlanValue) > 0.001;

    if (needsRecalc) {
      lastEffectivePlanValueRef.current = effectivePlanValue;
      if (isPercentageEntry) {
        const entryValue = Math.round(effectivePlanValue * (entryPercentage / 100) * 100) / 100;
        const remaining = effectivePlanValue - entryValue;
        const perInstallment = Math.round((remaining / (watchedInstallments - 1)) * 100) / 100;
        const amounts = Array(watchedInstallments).fill(perInstallment);
        amounts[0] = entryValue;
        const sumSoFar = amounts.reduce((a: number, b: number) => a + b, 0);
        const roundingDiff = Math.round((effectivePlanValue - sumSoFar) * 100) / 100;
        if (Math.abs(roundingDiff) > 0.001) amounts[amounts.length - 1] += roundingDiff;
        setCustomInstallmentAmounts(amounts);
      } else {
        const equalValue = watchedInstallments > 0 ? effectivePlanValue / watchedInstallments : 0;
        setCustomInstallmentAmounts(Array(watchedInstallments).fill(equalValue));
      }
    }
  }, [
    watchedPaymentType,
    watchedInstallmentFrequency,
    watchedInstallments,
    effectivePlanValue,
    customInstallmentAmounts.length,
    entryType,
    entryPercentage,
  ]);

  // Recalculate installments when entry percentage changes
  useEffect(() => {
    if (watchedPaymentType !== "parcelado") return;
    if (watchedInstallments <= 1 || entryType !== "percentage") return;
    if (entryPercentage <= 0 || entryPercentage >= 100) return;

    const entryValue = Math.round(effectivePlanValue * (entryPercentage / 100) * 100) / 100;
    const remaining = effectivePlanValue - entryValue;
    const perInstallment = Math.round((remaining / (watchedInstallments - 1)) * 100) / 100;
    const amounts = Array(watchedInstallments).fill(perInstallment);
    amounts[0] = entryValue;
    const sumSoFar = amounts.reduce((a: number, b: number) => a + b, 0);
    const roundingDiff = Math.round((effectivePlanValue - sumSoFar) * 100) / 100;
    if (Math.abs(roundingDiff) > 0.001) amounts[amounts.length - 1] += roundingDiff;
    setCustomInstallmentAmounts(amounts);
  }, [entryType, entryPercentage, effectivePlanValue, watchedInstallments]);

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Apply discount for any payment type
      const discountPercent = data.discount_percent || 0;
      const finalPlanValue = discountPercent > 0 
        ? Math.round((data.plan_value || 0) * (1 - discountPercent / 100) * 100) / 100
        : (data.plan_value || 0);

      const payload = {
        full_name: data.full_name,
        phone: data.phone || "",
        cpf: data.cpf || null,
        street: data.street || null,
        number: data.number || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        companion_name: data.companion_name || null,
        companion_phone: data.companion_phone || null,
        status: data.status || "gestante",
        custom_status: data.status === "outro" ? (data.custom_status || null) : null,
        pregnancy_weeks: data.dpp 
          ? calculateCurrentPregnancyWeeks(null, null, data.dpp) 
          : null,
        dpp: data.dpp || null,
        baby_names: data.baby_names 
          ? data.baby_names.split(",").map(n => n.trim()).filter(n => n.length > 0)
          : [],
        pregnancy_weeks_set_at: data.dpp
          ? new Date().toISOString() 
          : undefined,
        plan: (data.plan_setting_id === "avulso" ? "avulso" : data.plan_setting_id ? (planSettings?.find(p => p.id === data.plan_setting_id)?.plan_type || "basico") : "basico") as any,
        plan_setting_id: data.plan_setting_id && data.plan_setting_id !== "avulso" ? data.plan_setting_id : null,
        payment_method: data.payment_method || "pix",
        plan_value: finalPlanValue,
        birth_location: data.status === "gestante" ? (data.birth_location || null) : null,
        prenatal_type: data.prenatal_type || null,
        prenatal_high_risk: data.prenatal_high_risk || false,
        prenatal_team: data.prenatal_type === "equipe_particular" ? prenatalTeam.filter(m => m.name.trim()) : [],
        comorbidades: data.comorbidades || null,
        alergias: data.alergias || null,
        restricao_aromaterapia: data.restricao_aromaterapia || null,
        has_fotografa: data.has_fotografa || false,
        fotografa_name: data.has_fotografa ? (data.fotografa_name || null) : null,
        fotografa_phone: data.has_fotografa ? (data.fotografa_phone || null) : null,
        instagram_gestante: data.instagram_gestante || null,
        instagram_acompanhante: data.instagram_acompanhante || null,
        notes: data.notes || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      };

      if (client) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", client.id);
        if (error) throw error;

        // Update auto-generated transaction
        const resolvedPlanSetting = data.plan_setting_id !== "avulso" ? planSettings?.find(p => p.id === data.plan_setting_id) : null;
        const planDisplayName = data.plan_setting_id === "avulso" ? "Avulso" : (resolvedPlanSetting?.name || "Plano");
        const newDescription = `Contrato - ${data.full_name} - ${planDisplayName}`;
        const installmentCount = data.payment_type === "parcelado" ? (data.installments || 1) : 1;
        const useCustomAmts = (data.installment_frequency === "manual" || (entryType === "percentage" && entryPercentage > 0)) && customInstallmentAmounts.length === installmentCount;
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const aVistaDate = data.payment_date_avista || clientTransaction?.date || todayStr;
        const autoReceivedForAvista = data.payment_type === "a_vista" && aVistaDate <= todayStr ? finalPlanValue : 0;
        const transactionId = clientTransaction?.id || null;

        // For parcelado, update date to first_due_date (entry date); for à vista use aVistaDate
        const transactionDate = data.payment_type === "parcelado"
          ? (data.first_due_date || todayStr)
          : aVistaDate;

        let transactionUpdateQuery = supabase
          .from("transactions")
          .update({
            description: newDescription,
            amount: finalPlanValue,
            payment_method: data.payment_method as any,
            installments: installmentCount,
            installment_value: finalPlanValue / installmentCount,
            date: transactionDate,
            ...(data.payment_type === "a_vista" ? {
              amount_received: autoReceivedForAvista,
            } : {}),
          });

        transactionUpdateQuery = transactionId
          ? transactionUpdateQuery.eq("id", transactionId)
          : transactionUpdateQuery.eq("client_id", client.id).eq("is_auto_generated", true);

        const { error: transactionError } = await transactionUpdateQuery;

        if (transactionError) {
          console.error("Error updating transaction:", transactionError);
        }

        // Recreate payment records if parcelado with installments > 1
        if (data.payment_type === "parcelado" && installmentCount > 1) {
          // Delete old contract-related payments (current and legacy)
          const deleteOps = transactionId
            ? [
                supabase.from("payments").delete().eq("transaction_id", transactionId),
                supabase.from("payments").delete().eq("client_id", client.id).is("transaction_id", null),
              ]
            : [
                supabase.from("payments").delete().eq("client_id", client.id).is("transaction_id", null),
              ];

          const deleteResults = await Promise.all(deleteOps);
          const deleteErr = deleteResults.find((res) => res.error)?.error;
          if (deleteErr) console.error("Error deleting old payments:", deleteErr);

          const installmentAmount = finalPlanValue / installmentCount;
          const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
          const frequency = data.installment_frequency || "mensal";
          const customDays = data.custom_interval_days || 30;

          const paymentRecords = Array.from({ length: installmentCount }, (_, i) => {
            const dueDate = new Date(firstDueDate);
            if (frequency === "semanal") dueDate.setDate(dueDate.getDate() + (7 * i));
            else if (frequency === "quinzenal") dueDate.setDate(dueDate.getDate() + (15 * i));
            else if (frequency === "manual") dueDate.setDate(dueDate.getDate() + (customDays * i));
            else dueDate.setMonth(dueDate.getMonth() + i);
            const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;
            const isPastDue = dueDateStr < todayStr;
            const thisAmt = useCustomAmts ? customInstallmentAmounts[i] : installmentAmount;
            return {
              client_id: client.id,
              transaction_id: transactionId,
              installment_number: i + 1,
              total_installments: installmentCount,
              amount: thisAmt,
              amount_paid: isPastDue ? thisAmt : 0,
              due_date: dueDateStr,
              status: isPastDue ? "pago" : "pendente",
              paid_at: isPastDue ? `${dueDateStr}T12:00:00` : null,
              owner_id: user?.id || null,
              organization_id: organizationId || null,
            };
          });

          const { error: paymentError } = await supabase
            .from("payments")
            .insert(paymentRecords);
          if (paymentError) console.error("Error creating payments:", paymentError);

          const autoReceivedParcelado = paymentRecords.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
          let txAmountUpdateQuery = supabase
            .from("transactions")
            .update({ amount_received: autoReceivedParcelado });

          txAmountUpdateQuery = transactionId
            ? txAmountUpdateQuery.eq("id", transactionId)
            : txAmountUpdateQuery.eq("client_id", client.id).eq("is_auto_generated", true);

          const { error: txAmountError } = await txAmountUpdateQuery;
          if (txAmountError) console.error("Error updating transaction amount_received:", txAmountError);
        } else {
          // If switched to à vista, delete contract-related payment records
          const deleteOps = transactionId
            ? [
                supabase.from("payments").delete().eq("transaction_id", transactionId),
                supabase.from("payments").delete().eq("client_id", client.id).is("transaction_id", null),
              ]
            : [
                supabase.from("payments").delete().eq("client_id", client.id).is("transaction_id", null),
              ];

          const deleteResults = await Promise.all(deleteOps);
          const deleteErr = deleteResults.find((res) => res.error)?.error;
          if (deleteErr) console.error("Error deleting old payments:", deleteErr);
        }
      } else {
        // Create client and get the ID and created_at
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert(payload)
          .select("id, created_at")
          .single();
        if (clientError) throw clientError;

        // Only create financial records if a plan was selected
        if (data.plan_setting_id) {
        // Get plan settings to find the plan ID
        const resolvedPlanSetting = data.plan_setting_id !== "avulso" ? planSettings?.find(p => p.id === data.plan_setting_id) : null;

        // Create automatic income transaction for the new client using client's created_at date in local timezone
        const planDisplayName = data.plan_setting_id === "avulso" ? "Avulso" : (resolvedPlanSetting?.name || "Plano");
        const getLocalDate = (dateString: string) => {
          const date = new Date(dateString);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const clientCreatedDate = newClient.created_at 
          ? getLocalDate(newClient.created_at)
          : getLocalDate(new Date().toISOString());
        
        // Determine auto-received based on date logic — account for ALL paid installments
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const installmentCount = data.payment_type === "parcelado" ? (data.installments || 1) : 1;
        const useCustomAmounts = (data.installment_frequency === "manual" || (entryType === "percentage" && entryPercentage > 0)) && customInstallmentAmounts.length === installmentCount;
        const installmentVal = useCustomAmounts ? 0 : finalPlanValue / installmentCount;
        let autoReceived = 0;
        const aVistaDate = data.payment_date_avista || clientCreatedDate;

        if (data.payment_type === "parcelado" && installmentCount > 1) {
          const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
          const frequency = data.installment_frequency || "mensal";
          const customDays = data.custom_interval_days || 30;
          for (let i = 0; i < installmentCount; i++) {
            const dueDate = new Date(firstDueDate);
            if (frequency === "semanal") dueDate.setDate(dueDate.getDate() + (7 * i));
            else if (frequency === "quinzenal") dueDate.setDate(dueDate.getDate() + (15 * i));
            else if (frequency === "manual") dueDate.setDate(dueDate.getDate() + (customDays * i));
            else dueDate.setMonth(dueDate.getMonth() + i);
            const dueDateStr = dueDate.toISOString().split("T")[0];
            const isPastDue = dueDateStr < todayStr;
            const thisInstVal = useCustomAmounts ? customInstallmentAmounts[i] : installmentVal;
            if (isPastDue || (entryAlreadyPaid && i === 0)) {
              autoReceived += thisInstVal;
            }
          }
        } else {
          // À vista or single installment
          if (aVistaDate <= todayStr) {
            autoReceived = finalPlanValue;
          }
        }

        const transactionPayload = {
          type: "receita" as const,
          description: `Contrato - ${data.full_name} - ${planDisplayName}`,
          amount: finalPlanValue,
          amount_received: autoReceived,
          date: data.payment_type === "a_vista" ? aVistaDate : clientCreatedDate,
          client_id: newClient.id,
          plan_id: resolvedPlanSetting?.id || null,
          payment_method: data.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto",
          is_auto_generated: true,
          installments: data.payment_type === "parcelado" ? (data.installments || 1) : 1,
          installment_value: useCustomAmounts
            ? finalPlanValue / installmentCount
            : (data.payment_type === "parcelado" && data.installments 
              ? finalPlanValue / data.installments 
              : finalPlanValue),
          notes: `Receita gerada automaticamente ao cadastrar cliente`,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        };

        const { data: createdTransaction, error: transactionError } = await supabase
          .from("transactions")
          .insert([transactionPayload])
          .select("id")
          .single();
        if (transactionError) throw transactionError;

        // Create payment records with due dates if parcelado
        if (data.payment_type === "parcelado" && data.installments && data.installments > 1) {
          const installmentCount = data.installments;
          const useCustomAmts = (data.installment_frequency === "manual" || (entryType === "percentage" && entryPercentage > 0)) && customInstallmentAmounts.length === installmentCount;
          const installmentAmount = finalPlanValue / installmentCount;
          const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
          
          const frequency = data.installment_frequency || "mensal";
          const customDays = data.custom_interval_days || 30;
          
          const paymentRecords = Array.from({ length: installmentCount }, (_, i) => {
            const dueDate = new Date(firstDueDate);
            if (frequency === "semanal") {
              dueDate.setDate(dueDate.getDate() + (7 * i));
            } else if (frequency === "quinzenal") {
              dueDate.setDate(dueDate.getDate() + (15 * i));
            } else if (frequency === "manual") {
              dueDate.setDate(dueDate.getDate() + (customDays * i));
            } else {
              dueDate.setMonth(dueDate.getMonth() + i);
            }
            const dueDateStr = dueDate.toISOString().split("T")[0];
            const isPastDue = dueDateStr < todayStr;
            const thisAmt = useCustomAmts ? customInstallmentAmounts[i] : installmentAmount;
            return {
              client_id: newClient.id,
              transaction_id: createdTransaction.id,
              installment_number: i + 1,
              total_installments: installmentCount,
              amount: thisAmt,
              amount_paid: isPastDue || (entryAlreadyPaid && i === 0) ? thisAmt : 0,
              due_date: dueDateStr,
              status: isPastDue || (entryAlreadyPaid && i === 0) ? "pago" : "pendente",
              paid_at: isPastDue || (entryAlreadyPaid && i === 0) ? new Date().toISOString() : null,
              owner_id: user?.id || null,
              organization_id: organizationId || null,
            };
          });

          const { error: paymentError } = await supabase
            .from("payments")
            .insert(paymentRecords);
          if (paymentError) console.error("Error creating payments:", paymentError);
        }
        } // end if plan_setting_id


        if (data.dpp && (data.status || "gestante") === "gestante") {
          try {
            const response = await supabase.functions.invoke("create-client-user", {
              body: {
                clientId: newClient.id,
                fullName: data.full_name,
                dpp: data.dpp,
                organizationId: organizationId || null,
              },
            });

            if (response.error) {
              console.error("Error creating client user:", response.error);
              toast.info("Cliente cadastrada, mas houve um erro ao criar acesso da gestante");
            } else if (response.data?.email) {
              toast.info(`Acesso criado: ${response.data.email}`);
            }
          } catch (userError) {
            console.error("Error invoking create-client-user:", userError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
      toast.success(client ? "Cliente atualizada!" : "Cliente cadastrada com receita!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao salvar cliente");
    },
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data);
  };

  const validateCurrentStep = async () => {
    const fieldsPerStep: Record<number, (keyof ClientFormData)[]> = {
      1: ["full_name"],
      2: [],
      3: status === "gestante" ? ["dpp"] : [],
      4: [],
      5: [],
      6: ["plan_setting_id"],
      7: [],
    };
    const fields = fieldsPerStep[currentStep] || [];
    if (fields.length === 0) return true;
    const result = await form.trigger(fields);
    return result;
  };

  const handleNext = async () => {
    const valid = await validateCurrentStep();
    if (valid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isEditing = !!client;

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const handleFinalSubmit = async () => {
    // Validate required steps: Dados Pessoais + Plano
    const personalValid = await form.trigger(["full_name"]);
    if (!personalValid) {
      setCurrentStep(1);
      return;
    }
    const planValid = await form.trigger(["plan_setting_id"]);
    if (!planValid) {
      setCurrentStep(6);
      return;
    }
    // Validate gestante needs DPP
    if (form.getValues("status") === "gestante" && !form.getValues("dpp")) {
      form.setError("dpp", { message: "DPP é obrigatória para gestantes" });
      setCurrentStep(3);
      return;
    }
    form.handleSubmit(onSubmit)();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-0 flex-shrink-0">
          <DialogTitle className="font-display text-lg">
            {client ? "Editar Cliente" : "Nova Cliente"}
          </DialogTitle>
          {/* Tab-style step navigation */}
          <div className="flex items-center pt-2 border-b border-border/40">
            {STEPS.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                className={cn(
                  "relative flex-1 px-1 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap text-center",
                  currentStep === step.id
                    ? "text-primary"
                    : step.id < currentStep
                    ? "text-primary/60 hover:text-primary/80"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                {step.shortTitle}
                {currentStep === step.id && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="client-dialog-form flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-1 pr-3 space-y-0 scrollbar-thin pt-3">

              {/* Step 1: Dados Pessoais */}
              {currentStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Nome Completo *</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-9 text-sm" placeholder="Nome da cliente" mask="name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Telefone</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-9 text-sm" 
                              placeholder="(00) 00000-0000"
                              onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">CPF</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-9 text-sm" 
                              placeholder="000.000.000-00"
                              onChange={(e) => field.onChange(maskCPF(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Endereço */}
              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">CEP</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-9 text-sm" 
                            placeholder="00000-000"
                            onChange={(e) => {
                              const value = maskCEP(e.target.value);
                              field.onChange(value);
                              if (value.replace(/\D/g, "").length === 8) {
                                fetch(`https://viacep.com.br/ws/${value.replace(/\D/g, "")}/json/`)
                                  .then(res => res.json())
                                  .then(data => {
                                    if (!data.erro) {
                                      form.setValue("street", data.logradouro || "");
                                      form.setValue("neighborhood", data.bairro || "");
                                      form.setValue("city", data.localidade || "");
                                      form.setValue("state", data.uf || "");
                                    }
                                  })
                                  .catch(() => {});
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="space-y-1 md:col-span-2">
                        <FormLabel className="text-xs">Rua</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Nome da rua" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Número</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="123" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Bairro" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Cidade" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Estado</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="UF" maxLength={2} mask="uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Gestação e Pré-natal */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Situação *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gestante">Gestante</SelectItem>
                              <SelectItem value="lactante">Puérpera</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {status === "outro" && (
                      <FormField
                        control={form.control}
                        name="custom_status"
                        render={({ field }) => (
                          <FormItem className="space-y-1 md:col-span-2">
                            <FormLabel className="text-xs">Definir status</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-9 text-sm"
                                placeholder="Ex: Tentante, Consultoria, etc."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {status === "gestante" && (
                      <>
                        <FormField
                          control={form.control}
                          name="dpp"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">DPP (Data Provável do Parto) *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date" 
                                  className="h-9 text-sm"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value || null)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="baby_names"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Nomes do(s) Bebê(s)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="h-9 text-sm" 
                                  placeholder="Nome1, Nome2..."
                                  mask="name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="birth_location"
                          render={({ field }) => (
                            <FormItem className="space-y-1 md:col-span-3">
                              <FormLabel className="text-xs">Local do Parto</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="h-9 text-sm" 
                                  placeholder="Ex: Hospital São Lucas, Domiciliar..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>

                  {/* Tipo de atendimento e alto risco */}
                  <div className="border-t border-border/30 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="prenatal_type"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Tipo de atendimento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sus">SUS</SelectItem>
                                <SelectItem value="plano">Plano de Saúde</SelectItem>
                                <SelectItem value="particular">Particular</SelectItem>
                                <SelectItem value="equipe_particular">Equipe Particular</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="prenatal_high_risk"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Alto Risco?</FormLabel>
                            <Select 
                              onValueChange={(v) => field.onChange(v === "true")} 
                              value={field.value ? "true" : "false"}
                            >
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="false">Não</SelectItem>
                                <SelectItem value="true">Sim</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Saúde e Restrições */}
              {currentStep === 4 && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="comorbidades"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Comorbidades</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="min-h-[60px] resize-none text-sm" placeholder="Ex: diabetes gestacional, hipertensão..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="alergias"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Alergias</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="min-h-[60px] resize-none text-sm" placeholder="Ex: dipirona, látex, amendoim..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="restricao_aromaterapia"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Restrições em Aromaterapia</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="min-h-[60px] resize-none text-sm" placeholder="Ex: óleo de canela, hortelã-pimenta..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 5: Rede de Apoio */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  {/* Acompanhante */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acompanhante</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="companion_name"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Nome do Acompanhante</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 text-sm" placeholder="Nome do acompanhante" mask="name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="companion_phone"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Telefone do Acompanhante</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="h-9 text-sm" 
                                placeholder="(00) 00000-0000"
                                onChange={(e) => field.onChange(maskPhone(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Fotógrafa */}
                  <div className="border-t border-border/30 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fotógrafa</p>
                    <FormField
                      control={form.control}
                      name="has_fotografa"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Tem fotógrafa?</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(v === "true")}
                            value={field.value ? "true" : "false"}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="false">Não</SelectItem>
                              <SelectItem value="true">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("has_fotografa") && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="fotografa_name"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Nome</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-9 text-sm" placeholder="Nome da fotógrafa" mask="name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fotografa_phone"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Telefone</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-9 text-sm"
                                  placeholder="(00) 00000-0000"
                                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Redes Sociais */}
                  <div className="border-t border-border/30 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Redes Sociais</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="instagram_gestante"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Instagram da Gestante</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 text-sm lowercase" placeholder="@usuario" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="instagram_acompanhante"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Instagram do Acompanhante</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 text-sm lowercase" placeholder="@usuario" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Plano e Pagamento */}
              {currentStep === 6 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <FormField
                      control={form.control}
                      name="plan_setting_id"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Plano *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {planSettings?.filter(p => p.is_active).map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} — {maskCurrency(String(Math.round(Number(plan.default_value) * 100)))}
                                </SelectItem>
                              ))}
                              <SelectItem value="avulso">Avulso</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="plan_value"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">
                            Valor (R$) {selectedPlanId !== "avulso" && selectedPlanId && "(do plano)"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              className="h-9 text-sm"
                              value={field.value ? maskCurrency(String(Math.round(field.value * 100))) : ""}
                              onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                              placeholder="R$ 0,00"
                              readOnly={selectedPlanId !== "avulso" && !!selectedPlanId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Método de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="transferencia">Transferência</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_type"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Tipo de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="a_vista">À Vista</SelectItem>
                              <SelectItem value="parcelado">Parcelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="discount_percent"
                      render={({ field }) => {
                        const planVal = form.watch("plan_value") || 0;
                        const disc = Number(field.value ?? 0);
                        const discountedVal = planVal * (1 - disc / 100);
                        return (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Desconto (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-9 text-sm"
                                value={field.value === 0 || field.value === undefined || field.value === null ? "" : String(field.value)}
                                onChange={(e) => {
                                  const rawValue = e.target.value.replace(/[^0-9.,]/g, "");
                                  if (rawValue === "") {
                                    field.onChange(0);
                                    return;
                                  }
                                  const parsed = parseFloat(rawValue.replace(",", "."));
                                  if (Number.isNaN(parsed)) return;
                                  field.onChange(Math.min(100, Math.max(0, parsed)));
                                }}
                                onBlur={() => {
                                  if (!field.value) field.onChange(0);
                                }}
                                placeholder="0"
                              />
                            </FormControl>
                            {disc > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Valor com desconto: {discountedVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    {form.watch("payment_type") === "a_vista" && (
                      <FormField
                        control={form.control}
                        name="payment_date_avista"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Data do Pagamento</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                className="h-9 text-sm"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {form.watch("payment_type") === "parcelado" && (
                      <>
                        <FormField
                          control={form.control}
                          name="installments"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Parcelas</FormLabel>
                              <Select 
                                onValueChange={(value) => field.onChange(parseInt(value))} 
                                value={String(field.value || 1)}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                                    <SelectItem key={num} value={String(num)}>
                                      {num}x
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="installment_frequency"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Frequência</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "mensal"}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
                                  <SelectItem value="quinzenal">Quinzenal (15 dias)</SelectItem>
                                  <SelectItem value="mensal">Mensal</SelectItem>
                                  <SelectItem value="manual">Personalizado</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {form.watch("installment_frequency") === "manual" && (
                          <FormField
                            control={form.control}
                            name="custom_interval_days"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-xs">Intervalo (dias)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min={1}
                                    max={365}
                                    className="h-9 text-sm"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      field.onChange(val === "" ? "" : (parseInt(val) || 0));
                                    }}
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!val || val < 1) field.onChange(1);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {form.watch("installment_frequency") === "manual" && (form.watch("installments") || 1) > 1 && (
                          <div className="col-span-full space-y-2">
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-xs font-medium">Valores por parcela</FormLabel>
                              <button
                                type="button"
                                className="text-[10px] text-primary hover:underline"
                                onClick={() => {
                                  const count = form.watch("installments") || 1;
                                  setCustomInstallmentAmounts(Array(count).fill(effectivePlanValue / count));
                                }}
                              >
                                Dividir igualmente
                              </button>
                            </div>
                            {(() => {
                              const count = form.watch("installments") || 1;
                              if (customInstallmentAmounts.length !== count) return null;
                              const sumCustom = customInstallmentAmounts.reduce((a, b) => a + b, 0);
                              const diff = Math.abs(sumCustom - effectivePlanValue);
                              return (
                                <div className="space-y-1.5">
                                  {customInstallmentAmounts.map((amt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-8 text-right">{i + 1}ª</span>
                                      <Input
                                        className="h-7 text-xs flex-1"
                                        value={maskCurrency(String(Math.round(amt * 100)))}
                                        onChange={(e) => {
                                          const newAmounts = [...customInstallmentAmounts];
                                          const newVal = parseCurrency(e.target.value);
                                          const oldVal = newAmounts[i];
                                          newAmounts[i] = newVal;
                                          const subsequentCount = newAmounts.length - i - 1;
                                          if (subsequentCount > 0) {
                                            const diff = oldVal - newVal;
                                            const totalRemaining = newAmounts.slice(i + 1).reduce((a, b) => a + b, 0) + diff;
                                            const perSubsequent = Math.round((totalRemaining / subsequentCount) * 100) / 100;
                                            for (let j = i + 1; j < newAmounts.length; j++) {
                                              newAmounts[j] = perSubsequent;
                                            }
                                            const sumSoFar = newAmounts.reduce((a, b) => a + b, 0);
                                            const totalTarget = effectivePlanValue;
                                            const roundingDiff = Math.round((totalTarget - sumSoFar) * 100) / 100;
                                            if (Math.abs(roundingDiff) > 0.001) {
                                              newAmounts[newAmounts.length - 1] = Math.round((newAmounts[newAmounts.length - 1] + roundingDiff) * 100) / 100;
                                            }
                                          }
                                          setCustomInstallmentAmounts(newAmounts);
                                        }}
                                        placeholder="R$ 0,00"
                                      />
                                    </div>
                                  ))}
                                  {diff > 0.01 && (
                                    <p className="text-[10px] text-warning">
                                      Soma das parcelas: {maskCurrency(String(Math.round(sumCustom * 100)))} (diferença de {maskCurrency(String(Math.round(diff * 100)))})
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <FormField
                          control={form.control}
                          name="first_due_date"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">1º Vencimento</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date" 
                                  className="h-9 text-sm"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>

                  {/* Entrada no parcelado */}
                  {watchedPaymentType === "parcelado" && (
                    <div className="rounded-lg p-3 space-y-3">
                      {watchedInstallments > 1 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Valor da entrada</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEntryType("equal");
                                setEntryPercentage(0);
                              }}
                              className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                                entryType === "equal"
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                              }`}
                            >
                              Parcelas iguais
                            </button>
                            <button
                              type="button"
                              onClick={() => setEntryType("percentage")}
                              className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                                entryType === "percentage"
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                              }`}
                            >
                              Entrada em %
                            </button>
                          </div>
                          {entryType === "percentage" && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={99}
                                className="h-8 text-xs w-20"
                                value={entryPercentage || ""}
                                onChange={(e) => {
                                  const val = Math.min(99, Math.max(0, Number(e.target.value)));
                                  setEntryPercentage(val);
                                }}
                                placeholder="Ex: 30"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              {entryPercentage > 0 && effectivePlanValue > 0 && (
                                <span className="text-xs text-foreground font-medium">
                                  = {maskCurrency(String(Math.round(effectivePlanValue * (entryPercentage / 100) * 100)))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isFirstDueDateInPast ? (
                        <p className="text-xs text-success flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          A data é anterior a hoje — entrada será marcada como <strong>Recebida</strong> automaticamente.
                        </p>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entryAlreadyPaid}
                            onChange={(e) => setEntryAlreadyPaid(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-xs font-medium">Entrada já foi recebida?</span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Observações */}
                  <div className="border-t border-border/30 pt-3">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Observações</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="min-h-[70px] resize-none text-sm"
                              placeholder="Anotações sobre a cliente..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Navigation - Fixed at bottom */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40 flex-shrink-0">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 gap-1 text-muted-foreground hover:text-foreground"
                    onClick={handlePrev}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 text-muted-foreground hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    className="h-10 gap-1 px-6"
                    onClick={handleNext}
                  >
                    Próximo
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    className="h-12 sm:h-11 rounded-xl text-[15px] font-semibold px-8"
                    disabled={mutation.isPending}
                    onClick={handleFinalSubmit}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Salvando...
                      </>
                    ) : client ? "Atualizar" : "Cadastrar"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
