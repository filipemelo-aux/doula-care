import { ArrowLeft, Mail, MessageCircle, HelpCircle, Shield, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const faqs = [
  {
    q: "Como faço para acessar minha conta?",
    a: "Use o e-mail e senha fornecidos pela sua doula. Caso tenha esquecido, use a opção 'Recuperar acesso' na tela de login.",
  },
  {
    q: "Como altero minha senha?",
    a: "Acesse seu perfil dentro do app e toque em 'Alterar senha'. Você também pode solicitar uma nova senha pela tela de login.",
  },
  {
    q: "O app é seguro para meus dados de saúde?",
    a: "Sim. Todos os dados são criptografados em trânsito (TLS/SSL) e protegidos por políticas de segurança em nível de linha (RLS). Somente sua doula responsável tem acesso aos seus dados.",
  },
  {
    q: "Como solicito a exclusão da minha conta?",
    a: "Acesse a página de exclusão de conta pelo menu do app ou pelo link na Política de Privacidade. Sua solicitação será processada em até 30 dias úteis.",
  },
  {
    q: "O app funciona offline?",
    a: "O app pode ser instalado na tela inicial e carrega rapidamente, mas precisa de conexão com a internet para sincronizar dados com sua doula.",
  },
  {
    q: "Como minha doula pode começar a usar o Doula Care?",
    a: "Doulas podem se cadastrar gratuitamente pelo app. Basta acessar a tela de login e tocar em 'Cadastre-se'.",
  },
];

const Support = () => {
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

        <h1 className="text-3xl font-bold mb-2">Central de Suporte</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Encontre respostas para dúvidas frequentes ou entre em contato conosco.
        </p>

        {/* Contact */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Entre em contato
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5 flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">E-mail de suporte</p>
                  <a
                    href="mailto:suporte@doulacare.app.br"
                    className="text-sm text-primary underline hover:text-primary/80"
                  >
                    suporte@doulacare.app.br
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">
                    Respondemos em até 48 horas úteis.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Horário de atendimento</p>
                  <p className="text-sm text-muted-foreground">
                    Segunda a sexta, 9h às 18h (horário de Brasília)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <p className="font-medium text-sm mb-1">{faq.q}</p>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Policies */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacidade e segurança
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Levamos a segurança dos seus dados a sério. Leia nossa{" "}
              <Link
                to="/politica-de-privacidade"
                className="text-primary underline hover:text-primary/80"
              >
                Política de Privacidade
              </Link>{" "}
              para mais detalhes sobre como tratamos seus dados.
            </p>
            <p>
              Para solicitar a exclusão da sua conta e dados, acesse{" "}
              <Link
                to="/excluir-conta"
                className="text-primary underline hover:text-primary/80"
              >
                Exclusão de conta
              </Link>
              .
            </p>
          </div>
        </section>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Doula Care. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default Support;
