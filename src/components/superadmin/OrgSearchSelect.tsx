import { useState } from "react";
import { Check, ChevronsUpDown, Globe, Loader2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface OrgOption {
  id: string;
  name: string;
  nome_exibicao: string | null;
}

interface OrgSearchSelectProps {
  /** "all" means every organization, or the id of one organization. */
  value: string;
  onChange: (id: string) => void;
  orgs: OrgOption[];
  /** Called the first time the list is opened, so organizations can be loaded lazily. */
  onOpen?: () => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

/** Removes accents and lowercases so "saude" finds "Saúde". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function OrgSearchSelect({
  value,
  onChange,
  orgs,
  onOpen,
  loading = false,
  placeholder = "Todas as organizações",
  className,
}: OrgSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value === "all" ? null : orgs.find((o) => o.id === value);
  const label = selected ? selected.nome_exibicao || selected.name : placeholder;

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      onOpen?.();
    }
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  // Real-time filtering: keeps only items whose text contains what was typed.
  const filter = (_itemValue: string, search: string, keywords?: string[]) => {
    const q = normalize(search);
    if (!q) return 1;
    return normalize((keywords ?? []).join(" ")).includes(q) ? 1 : 0;
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "premium-input flex h-9 w-full items-center justify-between gap-2 px-3 text-sm text-left",
            className,
          )}
        >
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>{label}</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
      >
        <Command filter={filter}>
          <CommandInput
            placeholder="Buscar organização..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando organizações..." : "Nenhuma organização encontrada"}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                keywords={["todas", "todas as organizacoes", "todas as organizações", "todas as organizacoes", "geral", "todas as"]}
                onSelect={() => choose("all")}
              >
                <Globe className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">Todas as organizações</span>
                <Check className={cn("ml-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {orgs.map((org) => {
                const displayName = org.nome_exibicao || org.name;
                return (
                  <CommandItem
                    key={org.id}
                    value={org.id}
                    keywords={[displayName, org.name, org.nome_exibicao ?? ""]}
                    onSelect={() => choose(org.id)}
                  >
                    <span className="flex-1 truncate">{displayName}</span>
                    <Check
                      className={cn("ml-2 h-4 w-4", value === org.id ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
