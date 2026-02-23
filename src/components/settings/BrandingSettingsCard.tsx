import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, Upload, X, Eye, RotateCcw, Heart, Baby, Check } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { applyThemeToDOM, clearCustomTheme, DEFAULT_PRIMARY, DEFAULT_SECONDARY, hexToHSL } from "@/hooks/useOrgBranding";
import { cn } from "@/lib/utils";
import { ColorPickerGradient } from "@/components/settings/ColorPickerGradient";

// Curated color palettes
const COLOR_PALETTES = [
  { name: "Terracota", primary: "#c34a1c", secondary: "#ebe2dc" },
  { name: "Rosa Suave", primary: "#d4577b", secondary: "#f5e6ec" },
  { name: "Lavanda", primary: "#7c5cbf", secondary: "#eee8f5" },
  { name: "Azul Sereno", primary: "#3b82c4", secondary: "#e4eef8" },
  { name: "Verde Menta", primary: "#2a9d6e", secondary: "#e2f3ec" },
  { name: "Dourado", primary: "#b8860b", secondary: "#f5eeda" },
  { name: "Coral", primary: "#e06050", secondary: "#fce8e5" },
  { name: "Berinjela", primary: "#6b3a6b", secondary: "#f0e4f0" },
];

export function BrandingSettingsCard() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery({
    queryKey: ["org-branding", organizationId],
    queryFn: async () => {
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
  });

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primary_color || DEFAULT_PRIMARY);
      setSecondaryColor(branding.secondary_color || DEFAULT_SECONDARY);
      setNomeExibicao(branding.nome_exibicao || "");
      setLogoUrl(branding.logo_url || null);
    }
  }, [branding]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("organizations")
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          nome_exibicao: nomeExibicao || null,
          logo_url: logoUrl,
        } as any)
        .eq("id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-branding"] });
      applyThemeToDOM(primaryColor, secondaryColor);
      setPreviewing(false);
      toast.success("Identidade visual salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar identidade visual"),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${organizationId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("org-logos")
        .getPublicUrl(path);

      setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar logo");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  const handlePreview = () => {
    applyThemeToDOM(primaryColor, secondaryColor);
    setPreviewing(true);
  };

  const handleResetPreview = () => {
    if (branding?.primary_color || branding?.secondary_color) {
      applyThemeToDOM(
        branding.primary_color || DEFAULT_PRIMARY,
        branding.secondary_color || DEFAULT_SECONDARY
      );
    } else {
      clearCustomTheme();
    }
    setPrimaryColor(branding?.primary_color || DEFAULT_PRIMARY);
    setSecondaryColor(branding?.secondary_color || DEFAULT_SECONDARY);
    setPreviewing(false);
  };

  const handleResetToDefault = () => {
    setPrimaryColor(DEFAULT_PRIMARY);
    setSecondaryColor(DEFAULT_SECONDARY);
    clearCustomTheme();
    setPreviewing(false);
  };

  const handleSelectPalette = (palette: typeof COLOR_PALETTES[0]) => {
    setPrimaryColor(palette.primary);
    setSecondaryColor(palette.secondary);
    applyThemeToDOM(palette.primary, palette.secondary);
    setPreviewing(true);
  };

  const isSelectedPalette = (palette: typeof COLOR_PALETTES[0]) =>
    primaryColor.toLowerCase() === palette.primary.toLowerCase() &&
    secondaryColor.toLowerCase() === palette.secondary.toLowerCase();

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const pHsl = hexToHSL(primaryColor);

  return (
    <div className="space-y-6">
      <Card className="card-glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Identidade Visual</CardTitle>
              <CardDescription>Personalize as cores e logo da sua organização</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome de exibição */}
          <div className="space-y-2">
            <Label>Nome de Exibição</Label>
            <Input
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Ex: Doula Maria - Acompanhamento Gestacional"
              className="input-field"
            />
            <p className="text-xs text-muted-foreground">
              Nome que suas clientes verão no app. Se vazio, será usado o nome da organização.
            </p>
          </div>

          {/* Palette Selection */}
          <div className="space-y-3">
            <Label>Escolha uma paleta de cores</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COLOR_PALETTES.map((palette) => {
                const selected = isSelectedPalette(palette);
                return (
                  <button
                    key={palette.name}
                    onClick={() => handleSelectPalette(palette)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all hover:scale-[1.03] active:scale-[0.97]",
                      selected
                        ? "border-foreground shadow-md"
                        : "border-transparent bg-muted/40 hover:bg-muted/70"
                    )}
                  >
                    <div className="flex gap-1">
                      <div
                        className="w-8 h-8 rounded-full border border-black/10 shadow-sm"
                        style={{ background: palette.primary }}
                      />
                      <div
                        className="w-8 h-8 rounded-full border border-black/10 shadow-sm"
                        style={{ background: palette.secondary }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-foreground/80">{palette.name}</span>
                    {selected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="w-3 h-3 text-background" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>


          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo da Organização</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 rounded-[40%] border-2 border-border">
                {logoUrl ? (
                  <AvatarImage src={logoUrl} alt="Logo" className="object-cover" />
                ) : (
                  <AvatarFallback className="rounded-[40%] bg-primary/10">
                    <Heart className="w-6 h-6 text-primary" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {logoUrl ? "Trocar logo" : "Enviar logo"}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive">
                    <X className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG ou WebP. Máximo 2MB.</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {previewing && (
              <Button variant="ghost" size="sm" onClick={handleResetPreview} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Desfazer preview
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="gap-2 text-muted-foreground"
            >
              Restaurar padrão
            </Button>
            <div className="flex-1" />
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview Card */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl overflow-hidden border"
            style={{
              background: `hsl(${hexToHSL(secondaryColor).h} ${Math.max(hexToHSL(secondaryColor).s - 2, 0)}% 95%)`,
            }}
          >
            {/* Mini header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ background: `hsl(${hexToHSL(secondaryColor).h} ${hexToHSL(secondaryColor).s}% 92%)` }}
            >
              {logoUrl ? (
                <div className="w-8 h-8 rounded-[40%] overflow-hidden bg-white/50">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-[40%] bg-white/50 flex items-center justify-center">
                  <Heart className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
              )}
              <span className="text-sm font-semibold" style={{ color: `hsl(${pHsl.h} ${Math.min(pHsl.s, 65)}% 25%)` }}>
                {nomeExibicao || "Sua Organização"}
              </span>
            </div>
            {/* Mini content */}
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: primaryColor }}
                >
                  Botão Primário
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: secondaryColor,
                    color: `hsl(${pHsl.h} ${Math.min(pHsl.s, 65)}% 30%)`,
                  }}
                >
                  Botão Secundário
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg p-3 border" style={{ background: `hsl(${hexToHSL(secondaryColor).h} ${Math.max(hexToHSL(secondaryColor).s - 2, 0)}% 98%)` }}>
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4" style={{ color: primaryColor }} />
                    <span className="text-xs font-medium" style={{ color: `hsl(${pHsl.h} ${Math.min(pHsl.s, 65)}% 25%)` }}>
                      Card de exemplo
                    </span>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: `hsl(${pHsl.h} ${Math.min(pHsl.s - 20, 55)}% 48%)` }}>
                    Assim ficará para suas clientes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
