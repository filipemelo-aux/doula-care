import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { promptToSaveUpdatedPassword } from "@/lib/passwordManager";

export default function AdminChangePassword() {
  const { user, refreshMustChangePassword, role } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 8) return toast.error("Use pelo menos 8 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.from("profiles").update({ must_change_password: false } as any).eq("user_id", user!.id);
      await promptToSaveUpdatedPassword(password, user?.email);
      await refreshMustChangePassword();
      toast.success("Senha atualizada com sucesso!");
      navigate(role === "moderator" || role === "admin" ? "/admin" : "/", { replace: true });
    } catch (e) {
      toast.error("Erro ao atualizar senha", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Defina sua nova senha</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Por segurança, troque a senha temporária antes de continuar.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a nova senha" />
          </div>
          <Button onClick={submit} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar nova senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
