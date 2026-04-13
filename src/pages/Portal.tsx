import { Baby, Calendar, MessageCircle, FileText, Heart, Bell, Shield, BarChart3, Users, Smartphone, Star, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: Calendar,
    title: "Agenda inteligente",
    description: "Organize consultas, visitas domiciliares e compromissos com suas gestantes. Receba lembretes automáticos e gerencie sua rotina com eficiência.",
  },
  {
    icon: MessageCircle,
    title: "Comunicação direta",
    description: "Envie notificações push personalizadas para cada cliente. Mantenha um canal de comunicação próximo e seguro durante toda a gestação.",
  },
  {
    icon: FileText,
    title: "Contratos digitais",
    description: "Crie, personalize e envie contratos para assinatura digital. Tudo documentado e com validade jurídica, sem papel e sem burocracia.",
  },
  {
    icon: Heart,
    title: "Diário da gestante",
    description: "Suas clientes registram emoções, sintomas e marcos diariamente. Você acompanha tudo em tempo real para oferecer o melhor suporte.",
  },
  {
    icon: Bell,
    title: "Contador de contrações",
    description: "Ferramenta integrada para suas clientes monitorarem contrações. Você recebe alertas em tempo real quando o trabalho de parto começar.",
  },
  {
    icon: BarChart3,
    title: "Gestão financeira",
    description: "Controle receitas, despesas, parcelas e inadimplência. Tenha visibilidade total do seu faturamento com relatórios detalhados.",
  },
  {
    icon: Users,
    title: "Gestão de clientes",
    description: "Cadastre gestantes com todos os dados relevantes: DPP, plano de parto, equipe pré-natal, alergias, comorbidades e muito mais.",
  },
  {
    icon: Smartphone,
    title: "App para gestantes",
    description: "Suas clientes têm acesso a um painel exclusivo com diário, contrações, documentos, consultas e comunicação — tudo na palma da mão.",
  },
  {
    icon: Shield,
    title: "Segurança e privacidade",
    description: "Dados criptografados com políticas de segurança em nível de linha (RLS). Cada profissional só acessa os dados de suas próprias clientes.",
  },
];

const plans = [
  {
    name: "Free",
    price: "Grátis",
    period: "",
    description: "Ideal para começar",
    features: ["Até 1 cliente", "Agenda", "Gestão de clientes", "Gestão financeira", "Despesas", "Push notifications"],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "R$ 41,25",
    period: "/mês",
    description: "Para doulas em crescimento",
    features: ["Até 10 clientes", "Tudo do Free", "Notificações", "Mensagens", "Relatórios", "Exportação de relatórios"],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "R$ 50,41",
    period: "/mês",
    description: "Para profissionais consolidadas",
    features: ["Clientes ilimitados", "Tudo do Pro", "Até 5 colaboradores", "Push notifications", "Suporte prioritário"],
    highlighted: false,
  },
];

const testimonials = [
  {
    name: "Camila R.",
    role: "Doula de parto — SP",
    text: "O Doula Care transformou minha rotina. Antes eu perdia horas organizando agendas e contratos. Agora tudo está em um só lugar.",
  },
  {
    name: "Fernanda L.",
    role: "Doula pós-parto — RJ",
    text: "Minhas gestantes amam o diário e o contador de contrações. A comunicação ficou muito mais próxima e profissional.",
  },
  {
    name: "Juliana M.",
    role: "Doula e educadora perinatal — MG",
    text: "A gestão financeira me deu clareza sobre meu negócio. Recomendo para toda doula que quer crescer profissionalmente.",
  },
];

const Portal = () => {
  return (
    <div className="h-[100dvh] bg-background text-foreground overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Doula Care" className="h-7 w-7 rounded-lg object-contain" />
            <span className="text-lg font-bold text-foreground">Doula Care</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm">Criar conta</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full mb-6">
            <Star className="h-3.5 w-3.5" />
            Plataforma #1 para Doulas no Brasil
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4">
            Gerencie suas gestantes com
            <span className="text-primary"> carinho e tecnologia</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            O Doula Care é a plataforma completa para doulas organizarem clientes, consultas, finanças, contratos e comunicação — tudo em um só lugar, com um app exclusivo para suas gestantes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/cadastro">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Começar gratuitamente <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#recursos">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Conhecer recursos
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 px-4 sm:px-6 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: "500+", label: "Doulas cadastradas" },
            { value: "2.000+", label: "Gestantes atendidas" },
            { value: "99,9%", label: "Disponibilidade" },
            { value: "4.9★", label: "Avaliação média" },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Tudo que você precisa em um só lugar</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              Ferramentas pensadas por e para doulas, para que você possa focar no que realmente importa: cuidar.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5 sm:p-6">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-sm mb-1">{f.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Como funciona?</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Em 3 passos simples você já está no ar</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Crie sua conta", desc: "Cadastre-se gratuitamente em menos de 2 minutos. Sem cartão de crédito." },
              { step: "2", title: "Cadastre suas clientes", desc: "Adicione gestantes com todos os dados relevantes. Elas recebem acesso ao app automaticamente." },
              { step: "3", title: "Gerencie tudo", desc: "Agenda, finanças, contratos, comunicação — tudo integrado e acessível de qualquer dispositivo." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client app section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">App exclusivo para suas gestantes</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              Suas clientes têm acesso a um painel completo e intuitivo, fortalecendo o vínculo e a experiência de cuidado.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Heart, text: "Diário emocional com registro de sintomas" },
              { icon: Bell, text: "Contador de contrações em tempo real" },
              { icon: FileText, text: "Visualização e assinatura de contratos" },
              { icon: Calendar, text: "Consultas agendadas e solicitações" },
              { icon: MessageCircle, text: "Notificações e comunicação direta" },
              { icon: Shield, text: "Dados protegidos e privados" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                <item.icon className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">O que dizem nossas doulas</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <Card key={i}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed italic">"{t.text}"</p>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Planos e preços</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Comece gratuitamente e evolua conforme seu negócio cresce</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((plan, i) => (
              <Card key={i} className={plan.highlighted ? "ring-2 ring-primary relative" : ""}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Mais popular
                  </div>
                )}
                <CardContent className="p-5 sm:p-6 pt-6">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro">
                    <Button variant={plan.highlighted ? "default" : "outline"} className="w-full" size="sm">
                      {plan.price === "Grátis" ? "Começar grátis" : "Assinar agora"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Economize até 10% no plano anual. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-card border-y border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Perguntas frequentes</h2>
          <div className="space-y-4">
            {[
              { q: "Preciso pagar para começar?", a: "Não! O plano Free é totalmente gratuito e permite cadastrar até 3 clientes. Você pode evoluir para um plano pago quando quiser." },
              { q: "Minhas clientes precisam baixar algum app?", a: "Não é necessário baixar nada. Suas clientes podem acessar diretamente pelo navegador ou, se preferirem, instalar o app na tela inicial do celular para uma experiência ainda mais prática." },
              { q: "Meus dados estão seguros?", a: "Sim. Utilizamos criptografia de ponta a ponta e políticas de segurança em nível de linha (RLS), garantindo que cada profissional só acesse os dados de suas próprias clientes." },
              { q: "Posso cancelar a qualquer momento?", a: "Sim. Não há fidelidade ou multa. Você pode cancelar sua assinatura quando quiser diretamente pelo app." },
              { q: "O sistema funciona no celular?", a: "Sim! O Doula Care é totalmente responsivo e funciona perfeitamente em smartphones, tablets e computadores." },
            ].map((faq, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-background">
                <p className="font-semibold text-sm mb-1">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Pronta para transformar seu trabalho?
          </h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            Junte-se a centenas de doulas que já organizam suas vidas com o Doula Care. Comece gratuitamente hoje.
          </p>
          <Link to="/cadastro">
            <Button size="lg" className="gap-2">
              Criar minha conta grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo.png" alt="Doula Care" className="h-6 w-6 rounded-lg object-contain" />
                <span className="font-bold">Doula Care</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A plataforma completa para doulas gerenciarem suas clientes, consultas, finanças e comunicação.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Links úteis</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground transition-colors">Entrar</Link></li>
                <li><Link to="/cadastro" className="hover:text-foreground transition-colors">Criar conta</Link></li>
                <li><Link to="/suporte" className="hover:text-foreground transition-colors">Central de Suporte</Link></li>
                <li><Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>larissamacieldoula@gmail.com</li>
              </ul>
            </div>
          </div>
          <Separator className="mb-6" />
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Doula Care — Todos os direitos reservados.
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              FSM COMÉRCIO INTERMEDIAÇÃO E SERVIÇOS LTDA — CNPJ 50.722.182/0001-82
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Portal;
