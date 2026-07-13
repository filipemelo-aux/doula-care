import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Encodes/decodes a comma-joined text value into (selected suggestions + free text).
 * Backwards-compatible with existing free-text fields.
 */
export interface SuggestionChipsProps {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  /** Called when a suggestion is toggled; useful for detecting e.g. "Cesárea" selection */
  onToggle?: (suggestion: string, isNowSelected: boolean) => void;
}

export function parseSuggestionValue(value: string, suggestions: string[]) {
  const parts = (value || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const normalizedSuggestions = suggestions.map((s) => s.toLowerCase());
  const selected = new Set<string>();
  const others: string[] = [];
  for (const p of parts) {
    const idx = normalizedSuggestions.indexOf(p.toLowerCase());
    if (idx >= 0) selected.add(suggestions[idx]);
    else others.push(p);
  }
  return { selected, outros: others.join(", ") };
}

export function buildSuggestionValue(selected: Set<string> | string[], outros: string) {
  const sel = Array.isArray(selected) ? selected : Array.from(selected);
  const outrosList = (outros || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...sel, ...outrosList].join(", ");
}

export function SuggestionChips({
  value,
  onChange,
  suggestions,
  placeholder = "Outros (separe por vírgula)",
  onToggle,
}: SuggestionChipsProps) {
  const { selected, outros } = useMemo(
    () => parseSuggestionValue(value, suggestions),
    [value, suggestions]
  );

  const commit = (nextSelected: Set<string>, nextOutros: string) => {
    onChange(buildSuggestionValue(nextSelected, nextOutros));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const isOn = selected.has(s);
          return (
            <button
              type="button"
              key={s}
              onClick={() => {
                const next = new Set(selected);
                if (isOn) next.delete(s);
                else next.add(s);
                commit(next, outros);
                onToggle?.(s, !isOn);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                isOn
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border text-foreground/80"
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      <Input
        value={outros}
        onChange={(e) => commit(selected, e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );
}

export interface ChildEntry {
  name: string;
  age: string;
}

export interface ChildrenListProps {
  value: ChildEntry[];
  onChange: (next: ChildEntry[]) => void;
  label?: string;
}

export function ChildrenList({ value, onChange, label = "Filho(s)" }: ChildrenListProps) {
  const list = value && value.length > 0 ? value : [{ name: "", age: "" }];

  const update = (idx: number, patch: Partial<ChildEntry>) => {
    const next = list.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };
  const add = () => onChange([...list, { name: "", age: "" }]);
  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ name: "", age: "" }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={add}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {list.map((child, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_90px_auto] gap-1.5 items-center">
            <Input
              value={child.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Nome"
              className="h-8 text-xs"
            />
            <Input
              value={child.age}
              onChange={(e) => update(idx, { age: e.target.value })}
              placeholder="Idade"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => remove(idx)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
