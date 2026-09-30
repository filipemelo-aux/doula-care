import { supabase } from "@/integrations/supabase/client";

/** Registra um atendimento já lançado em Contas a Receber (sem etapa de previsão). */
export async function createServiceRecordWithReceivable(rec: {
  organization_id: string | null;
  client_id: string | null;
  service_name: string;
  amount: number;
  service_date: string;
  notes?: string | null;
  created_by?: string | null;
}) {
  let transactionId: string | null = null;
  if (rec.amount > 0) {
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        type: "receita",
        description: `Atendimento - ${rec.service_name}`,
        amount: rec.amount,
        amount_received: 0,
        date: rec.service_date,
        client_id: rec.client_id,
        notes: rec.notes || null,
        installments: 1,
        installment_value: rec.amount,
        owner_id: rec.created_by || null,
        organization_id: rec.organization_id,
      })
      .select("id")
      .single();
    if (error) throw error;
    transactionId = tx.id;
  }
  const { error } = await (supabase.from("service_records" as any) as any).insert({
    ...rec,
    notes: rec.notes || null,
    status: transactionId ? "invoiced" : "forecast",
    transaction_id: transactionId,
  });
  if (error) throw error;
}
