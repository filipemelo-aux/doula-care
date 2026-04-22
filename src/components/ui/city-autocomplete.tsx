import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { searchCities, type IBGECity } from "@/lib/ibgeCities";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  value: string;
  state: string;
  onChange: (city: string, state: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({
  value,
  state,
  onChange,
  placeholder = "Digite a cidade...",
  className,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<IBGECity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    onChange(q, state);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await searchCities(q, 8);
        setResults(r);
        setHighlight(0);
      } finally {
        setLoading(false);
      }
    }, 180);
  };

  const select = (c: IBGECity) => {
    onChange(c.nome, c.uf);
    setQuery(c.nome);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            select(results[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                i === highlight ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{c.nome}</span>
              <span className="text-xs text-muted-foreground">{c.uf}</span>
            </button>
          ))}
        </div>
      )}
      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg p-3 text-xs text-muted-foreground">
          Nenhuma cidade encontrada
        </div>
      )}
    </div>
  );
}
