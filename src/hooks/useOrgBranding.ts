import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrgBranding {
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  nome_exibicao: string | null;
}

// Default brand colors (terracotta palette)
const DEFAULT_PRIMARY = "#c34a1c";
const DEFAULT_SECONDARY = "#ebe2dc";

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function generateThemeVariables(primary: string, secondary: string) {
  const p = hexToHSL(primary);
  const s = hexToHSL(secondary);

  return {
    // Primary
    "--primary": `${p.h} ${p.s}% ${p.l}%`,
    "--primary-foreground": "0 0% 100%",
    "--ring": `${p.h} ${p.s}% ${p.l}%`,

    // Secondary from secondary color
    "--secondary": `${s.h} ${s.s}% ${s.l}%`,
    "--secondary-foreground": `${p.h} ${Math.min(p.s, 65)}% 30%`,

    // Accent derived from primary (darker)
    "--accent": `${p.h} ${Math.min(p.s + 2, 100)}% ${Math.max(p.l - 6, 20)}%`,
    "--accent-foreground": "0 0% 100%",

    // Background from secondary (lighter)
    "--background": `${s.h} ${Math.max(s.s - 2, 0)}% 95%`,
    "--foreground": `${p.h} ${Math.min(p.s, 65)}% 25%`,

    // Card
    "--card": `${s.h} ${Math.max(s.s - 2, 0)}% 98%`,
    "--card-foreground": `${p.h} ${Math.min(p.s, 65)}% 25%`,

    // Popover
    "--popover": `${s.h} ${Math.max(s.s - 2, 0)}% 98%`,
    "--popover-foreground": `${p.h} ${Math.min(p.s, 65)}% 25%`,

    // Muted
    "--muted": `${s.h} ${Math.max(s.s - 7, 0)}% 91%`,
    "--muted-foreground": `${p.h} ${Math.min(p.s - 20, 55)}% 48%`,

    // Border/Input
    "--border": `${s.h} ${Math.max(s.s - 5, 0)}% 83%`,
    "--input": `${s.h} ${Math.max(s.s - 5, 0)}% 83%`,

    // Sidebar
    "--sidebar-background": `${s.h} ${s.s}% 92%`,
    "--sidebar-foreground": `${p.h} ${Math.min(p.s, 65)}% 25%`,
    "--sidebar-primary": `${p.h} ${p.s}% ${p.l}%`,
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": `${s.h} ${Math.max(s.s - 2, 0)}% 86%`,
    "--sidebar-accent-foreground": `${p.h} ${Math.min(p.s, 65)}% 30%`,
    "--sidebar-border": `${s.h} ${Math.max(s.s - 5, 0)}% 83%`,
    "--sidebar-ring": `${p.h} ${p.s}% ${p.l}%`,

    // Gradients
    "--gradient-primary": `linear-gradient(135deg, hsl(${p.h} ${p.s}% ${p.l}%), hsl(${p.h} ${Math.max(p.s - 3, 0)}% ${Math.max(p.l - 6, 20)}%))`,
  };
}

function applyThemeToDOM(primary: string, secondary: string) {
  const vars = generateThemeVariables(primary, secondary);
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function clearCustomTheme() {
  const root = document.documentElement;
  const keys = [
    "--primary", "--primary-foreground", "--ring",
    "--secondary", "--secondary-foreground",
    "--accent", "--accent-foreground",
    "--background", "--foreground",
    "--card", "--card-foreground",
    "--popover", "--popover-foreground",
    "--muted", "--muted-foreground",
    "--border", "--input",
    "--sidebar-background", "--sidebar-foreground",
    "--sidebar-primary", "--sidebar-primary-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-border", "--sidebar-ring",
  ];
  keys.forEach((key) => root.style.removeProperty(key));
}

export function useOrgBranding() {
  const { organizationId } = useAuth();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["org-branding", organizationId],
    queryFn: async (): Promise<OrgBranding | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = data as any;
      return {
        primary_color: d.primary_color || null,
        secondary_color: d.secondary_color || null,
        logo_url: d.logo_url || null,
        nome_exibicao: d.nome_exibicao || null,
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Apply theme whenever branding changes
  useEffect(() => {
    if (!organizationId) {
      clearCustomTheme();
      return;
    }

    if (branding?.primary_color || branding?.secondary_color) {
      applyThemeToDOM(
        branding.primary_color || DEFAULT_PRIMARY,
        branding.secondary_color || DEFAULT_SECONDARY
      );
    } else {
      clearCustomTheme();
    }

    return () => {
      clearCustomTheme();
    };
  }, [branding, organizationId]);

  return {
    branding,
    isLoading,
    logoUrl: branding?.logo_url || null,
    displayName: branding?.nome_exibicao || null,
    primaryColor: branding?.primary_color || DEFAULT_PRIMARY,
    secondaryColor: branding?.secondary_color || DEFAULT_SECONDARY,
  };
}

// Export for use in preview
export { applyThemeToDOM, clearCustomTheme, hexToHSL, DEFAULT_PRIMARY, DEFAULT_SECONDARY };
