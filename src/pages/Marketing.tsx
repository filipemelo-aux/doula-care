import { ArrowLeft, Heart, Shield, Bell, Calendar, FileText, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Calendar,
    title: "Agenda inteligente",
    description: "Gerencie consultas, visitas e compromissos com suas gestantes de forma prática.",
  },
  {
    icon: MessageCircle,
    title: "Comunicação direta",
    description: "Envie notificações e mantenha contato próximo com cada cliente.",
  },
  {
    icon: FileText,
    title: "Contratos digitais",
    description: "Crie, envie e colete assinaturas de contratos diretamente pelo app.",
  },
  {
    icon: Heart,
    title: "Diário da gestante",
    description: "Suas clientes registram emoções, sintomas e acompanham a gestação dia a dia.",
  },
  {
    icon: Bell,
    title: "Contador de contrações",
    description: "Ferramenta integrada para monitorar contrações em tempo real.",
  },
  {
    icon: Shield,
    title: "Segurança e privacidade",
    description: "Dados criptografados e protegidos com políticas de segurança em nível de linha.",
  },
];

const Marketing = () => {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>

        {/* Hero */}
        <section className="mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Doula Care</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            A plataforma completa para doulas gerenciarem suas clientes, consultas, finanças e comunicação — tudo em um só lugar.
          </p>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-6 text-center">Recursos principais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <Card key={i}>
                <CardContent className="p-5 flex items-start gap-3">
                  <f.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mb-12 text-center">
          <h2 className="text-lg font-semibold mb-2">Comece gratuitamente</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Cadastre-se e comece a organizar seu trabalho como doula hoje mesmo.
          </p>
          <Link
            to="/registro"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Criar minha conta
          </Link>
        </section>

        {/* Links */}
        <section className="text-center text-sm text-muted-foreground space-y-1">
          <p>
            <Link to="/suporte" className="text-primary underline hover:text-primary/80">Central de Suporte</Link>
            {" · "}
            <Link to="/politica-de-privacidade" className="text-primary underline hover:text-primary/80">Política de Privacidade</Link>
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Doula Care. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default Marketing;
