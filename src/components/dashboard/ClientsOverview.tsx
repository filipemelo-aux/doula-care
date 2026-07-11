import { useMemo, useState } from "react";
import { ClientQuickViewDialog } from "./ClientQuickViewDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Baby, Heart, ChevronRight } from "lucide-react";
import { cn, formatBrazilDate } from "@/lib/utils";
import {
  calculateCurrentPregnancyWeeks,
  calculateCurrentPregnancyDays,
} from "@/lib/pregnancy";

type ClientRow = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  user_id: string | null;
  status: string;
  dpp: string | null;
  pregnancy_weeks: number | null;
  pregnancy_weeks_set_at: string | null;
  labor_started_at: string | null;
  birth_occurred: boolean | null;
  birth_date: string | null;
  companion_name: string | null;
  baby_names: string[] | null;
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0];
}

function displayName(c: ClientRow) {
  const p = c.preferred_name?.trim();
  if (p) return p;
  return firstName(c.full_name);
}

function gestationLabel(c: ClientRow) {
  if (c.status === "lactante") return "Puérpera";
  const weeks = calculateCurrentPregnancyWeeks(
    c.pregnancy_weeks,
    c.pregnancy_weeks_set_at,
    c.dpp,
  );
  if (weeks === null) return "Gestante";
  const days = calculateCurrentPregnancyDays(c.dpp);
  const post = weeks >= 40;
  return (
    <span className={cn(post && "text-destructive font-semibold")}>
      {weeks}s {days}d
    </span>
  );
}

function babyName(c: ClientRow) {
  const names = (c.baby_names || []).filter(Boolean);
  if (names.length === 0) return null;
  return names.join(", ");
}

export function ClientsOverview() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["dashboard-clients-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, full_name, preferred_name, user_id, status, dpp, pregnancy_weeks, pregnancy_weeks_set_at, labor_started_at, birth_occurred, birth_date, companion_name, baby_names",
        )
        .in("status", ["gestante", "lactante"])
        .order("dpp", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ClientRow[];
    },
  });

  const userIds = useMemo(
    () => (clients || []).map((c) => c.user_id).filter((v): v is string => !!v),
    [clients],
  );

  const { data: avatars } = useQuery({
    queryKey: ["dashboard-clients-avatars", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", userIds);
      if (error) throw error;
      const map = new Map<string, string | null>();
      (data || []).forEach((p) => map.set(p.user_id, p.avatar_url));
      return map;
    },
  });

  const clientIds = useMemo(
    () => (clients || []).map((c) => c.id),
    [clients],
  );

  const { data: badgeMap } = useQuery({
    queryKey: ["dashboard-clients-badges", clientIds],
    enabled: clientIds.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const [messagesRes, diaryRes, servicesRes, apptReqRes] = await Promise.all([
        supabase
          .from("client_notifications")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("read", false)
          .like("title", "Mensagem de %"),
        supabase
          .from("pregnancy_diary")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("read_by_admin", false),
        supabase
          .from("service_requests")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("status", "pending"),
        supabase
          .from("appointment_requests")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("status", "pending"),
      ]);

      const map = new Map<string, number>();
      const add = (rows: { client_id: string }[] | null) => {
        (rows || []).forEach((r) => {
          map.set(r.client_id, (map.get(r.client_id) || 0) + 1);
        });
      };
      add(messagesRes.data as any);
      add(diaryRes.data as any);
      add(servicesRes.data as any);
      add(apptReqRes.data as any);
      return map;
    },
  });

  const sorted = useMemo(() => {
    const list = [...(clients || [])];
    // Puérperas depois; gestantes por DPP asc; sem DPP no fim
    return list.sort((a, b) => {
      const aPuer = a.status === "lactante" ? 1 : 0;
      const bPuer = b.status === "lactante" ? 1 : 0;
      if (aPuer !== bPuer) return aPuer - bPuer;
      if (!a.dpp && !b.dpp) return 0;
      if (!a.dpp) return 1;
      if (!b.dpp) return -1;
      return a.dpp.localeCompare(b.dpp);
    });
  }, [clients]);

  return (
    <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-lg text-foreground leading-tight">
            Suas clientes
          </h2>
          <p className="text-xs text-muted-foreground">
            Gestantes por DPP mais próxima · puérperas ao final
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          Nenhuma gestante ou puérpera cadastrada ainda
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => {
            const badge = badgeMap?.get(c.id) || 0;
            const avatarUrl = c.user_id ? avatars?.get(c.user_id) : null;
            const isPuer = c.status === "lactante";
            return (
              <li key={c.id}>
                <button
                  onClick={() => setOpenId(c.id)}
                  className="w-full flex items-center gap-3 rounded-xl bg-muted/40 hover:bg-muted p-3 text-left transition-all active:scale-[0.98]"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12 shadow-sm">
                      <AvatarImage
                        src={avatarUrl || undefined}
                        alt={displayName(c)}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                        {isPuer ? (
                          <Heart className="w-5 h-5 text-primary" />
                        ) : (
                          <Baby className="w-5 h-5 text-primary" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {badge > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-card"
                        aria-label={`${badge} novidades`}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {displayName(c)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {gestationLabel(c)}
                      {c.labor_started_at && !c.birth_occurred && (
                        <span className="ml-2 inline-flex items-center gap-1 text-destructive font-semibold">
                          · Em trabalho de parto
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ClientQuickViewDialog
        open={!!openId}
        onOpenChange={(o) => !o && setOpenId(null)}
        clientId={openId}
      />
    </div>
  );
}
