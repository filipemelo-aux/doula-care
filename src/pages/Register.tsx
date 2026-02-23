import { useState } from "react";
import logo from "@/assets/logo.png";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!fullName.trim() || !email.trim() || !password) {
      toast.error("Preencha todos os campos");
      setSubmitting(false);
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("register-doula", {
        body: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      });

      if (error) {
        toast.error("Erro ao criar conta", { description: error.message });
        setSubmitting(false);
        return;
      }

      if (data?.error) {
        toast.error("Erro ao criar conta", { description: data.error });
        setSubmitting(false);
        return;
      }

      toast.success("Cadastro enviado com sucesso!", {
        description: "Seu acesso será liberado após aprovação do administrador.",
      });
      navigate("/login");
    } catch (err) {
      toast.error("Erro inesperado ao criar conta");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-[40%] bg-[#FFF5EE] overflow-hidden">
               <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
             </div>
             <CardTitle className="text-2xl font-display font-bold tracking-wide">Doula Care</CardTitle>
          </div>
          <CardDescription>Crie sua conta profissional</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email profissional</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-field lowercase"
                style={{ textTransform: "lowercase" }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-field pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-field pr-10"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
