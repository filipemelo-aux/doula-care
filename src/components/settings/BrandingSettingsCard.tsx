import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, Upload, X, Eye, RotateCcw, Heart, Baby } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { applyThemeToDOM, clearCustomTheme, DEFAULT_PRIMARY, DEFAULT_SECONDARY, hexToHSL } from "@/hooks/useOrgBranding";

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
  const sHsl = hexToHSL(secondaryColor);

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

          {/* Colors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#c34a1c"
                    className="input-field font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    HSL: {pHsl.h}° {pHsl.s}% {pHsl.l}%
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#ebe2dc"
                    className="input-field font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    HSL: {sHsl.h}° {sHsl.s}% {sHsl.l}%
                  </p>
                </div>
              </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Pré-visualizar
            </Button>
            {previewing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetPreview}
                className="gap-2"
              >
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
