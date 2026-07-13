import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { useCalendarLabels, LABEL_COLORS, type CalendarLabel } from "@/hooks/useCalendarLabels";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
}

export function CalendarLabelsManager({ open, onOpenChange, organizationId }: Props) {
  const { labels, createLabel, updateLabel, deleteLabel, isLoading } = useCalendarLabels(organizationId);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [editing, setEditing] = useState<CalendarLabel | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(LABEL_COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createLabel.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setNewName("");
          setNewColor(LABEL_COLORS[0]);
        },
      }
    );
  };

  const startEdit = (l: CalendarLabel) => {
    setEditing(l);
    setEditName(l.name);
    setEditColor(l.color);
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    updateLabel.mutate(
      { id: editing.id, name: editName.trim(), color: editColor },
      { onSuccess: () => setEditing(null) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Etiquetas do calendário
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crie etiquetas coloridas para marcar dias especiais (plantão, folga, curso, etc).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Create */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/40">
            <Label className="text-xs">Nova etiqueta</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Plantão"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createLabel.isPending}>
                {createLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <ColorSwatchPicker value={newColor} onChange={setNewColor} />
          </div>

          {/* List */}
          <ScrollArea className="max-h-[45vh]">
            <div className="space-y-2 pr-2">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : labels.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  Nenhuma etiqueta ainda. Crie a primeira acima.
                </p>
              ) : (
                labels.map((l) => (
                  <div key={l.id} className="rounded-lg border border-border/60 p-2.5">
                    {editing?.id === l.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm"
                            maxLength={40}
                          />
                          <Button size="sm" className="h-8 w-8 p-0" onClick={saveEdit} disabled={updateLabel.isPending}>
                            {updateLabel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: l.color }}
                        />
                        <span className="text-sm font-medium truncate flex-1">{l.name}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover a etiqueta "${l.name}"? Ela será removida de todos os dias marcados.`)) {
                              deleteLabel.mutate(l.id);
                            }
                          }}
                          disabled={deleteLabel.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-6 w-6 rounded-full transition-transform",
            value === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
          )}
          style={{ backgroundColor: c }}
          aria-label={`Cor ${c}`}
        />
      ))}
    </div>
  );
}
