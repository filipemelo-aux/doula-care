import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Shield, Database, Bell } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-description">
          Gerencie as configurações do seu dashboard
        </p>
      </div>

      {/* Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Perfil Profissional</CardTitle>
                <CardDescription>
                  Informações sobre você e sua prática
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure suas informações profissionais, especialidades e dados de contato.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>
                  Autenticação e controle de acesso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure login, senha e permissões de acesso ao sistema.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-info" />
              </div>
              <div>
                <CardTitle className="text-lg">Backup de Dados</CardTitle>
                <CardDescription>
                  Exportar e importar dados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Faça backup dos seus dados ou exporte relatórios em diferentes formatos.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações</CardTitle>
                <CardDescription>
                  Alertas e lembretes
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure lembretes de consultas, vencimentos e alertas importantes.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="card-glass border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Doula Care Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Versão 1.0 • Desenvolvido com ❤️ para profissionais de doula
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
