import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planConsultationsDb, usePlanConsultations } from "@/lib/consultations";

type Row = { name: string; quantity: number; modality: string };

export function PlanConsultationsDialog({ plan, organizationId, onClose }: { plan: { id: string; name: string } | null; organizationId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: all = [] } = usePlanConsultations(organizationId);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!plan) return;
    const current = all.filter((i) => i.plan_setting_id === plan.id).map((i) => ({ name: i.name, quantity: i.quantity, modality: i.modality }));
    setRows(current.length ? current : [{ name: "", quantity: 1, modality: "presencial" }]);
  }, [plan?.id, all.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const move = (i: number, dir: -1 | 1) => setRows((r) => { const n = [...r]; const j = i + dir; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const total = rows.filter((r) => r.name.trim()).reduce((s, r) => s + Math.max(1, r.quantity || 1), 0);

  const save = async () => {
    if (!plan || !organizationId) return;
    setSaving(true);
    try {
      const { error: delErr } = await planConsultationsDb().delete().eq("plan_setting_id", plan.id);
      if (delErr) throw delErr;
      const payload = rows.filter((r) => r.name.trim()).map((r, idx) => ({ organization_id: organizationId, plan_setting_id: plan.id, name: r.name.trim(), quantity: Math.max(1, Number(r.quantity) || 1), modality: r.modality, sort_order: idx }));
      if (payload.length) {
        const { error } = await planConsultationsDb().insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["plan-consultations"] });
      toast.success("Roteiro de consultas salvo");
      onClose();
    } catch {
      toast.error("Não foi possível salvar o roteiro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Roteiro de consultas · {plan?.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Defina, em ordem, as consultas que este plano inclui. Elas formam a linha do tempo de cada acompanhamento.</p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                <Input value={row.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Ex: Encontro pré-parto" />
              </div>
              <div className="flex items-center gap-2 pl-7">
                <Input type="number" min={1} className="w-20" value={row.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} aria-label="Quantidade" />
                <span className="text-xs text-muted-foreground">x</span>
                <Select value={row.modality} onValueChange={(v) => update(i, { modality: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" className="w-full" onClick={() => setRows((r) => [...r, { name: "", quantity: 1, modality: "presencial" }])}><Plus className="mr-2 h-4 w-4" /> Adicionar consulta</Button>
        </div>
        <p className="text-xs text-muted-foreground">Total: <strong className="text-foreground">{total} consulta(s)</strong></p>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={saving}>Salvar roteiro</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
