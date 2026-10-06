import SmartBackLink from "@/components/SmartBackLink";
import { Link } from "react-router-dom";

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. Aceitação dos termos",
    body: [
      "Ao criar uma conta, acessar ou utilizar o aplicativo Doula Care, você concorda com estes Termos de Uso (Contrato de Licença de Usuário Final – EULA) e com a nossa Política de Privacidade. Se não concordar, não utilize o aplicativo.",
    ],
  },
  {
    title: "2. Sobre o serviço",
    body: [
      "O Doula Care é uma plataforma de gestão para doulas e de acompanhamento para suas clientes (gestantes e puérperas), com agenda, mensagens, diário, contratos, controle financeiro e outros recursos.",
      "O aplicativo não substitui acompanhamento médico. As informações exibidas têm caráter de apoio e organização.",
    ],
  },
  {
    title: "3. Licença de uso",
    body: [
      "Concedemos a você uma licença pessoal, limitada, não exclusiva, intransferível e revogável para usar o aplicativo em dispositivos de sua propriedade ou controle, conforme estes termos e as regras das lojas de aplicativos (App Store e Google Play).",
      "É proibido copiar, modificar, distribuir, vender, fazer engenharia reversa ou tentar acessar áreas restritas do sistema.",
    ],
  },
  {
    title: "4. Conta e responsabilidades",
    body: [
      "Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta. A doula é responsável pelos dados das clientes que cadastra e pelo uso adequado dessas informações.",
    ],
  },
  {
    title: "5. Assinaturas com renovação automática",
    body: [
      "Os planos pagos (Pro e Premium, mensais ou anuais) são assinaturas com renovação automática. O valor e o período de cada plano são exibidos na tela de assinatura antes da compra.",
      "O pagamento é cobrado na sua conta Apple ID (App Store) ou Google Play na confirmação da compra.",
      "A assinatura é renovada automaticamente pelo mesmo período e valor, a menos que seja cancelada pelo menos 24 horas antes do fim do período atual. A cobrança da renovação ocorre nas 24 horas anteriores ao término do período.",
      "Você pode gerenciar ou cancelar a assinatura a qualquer momento nos Ajustes da sua conta da loja (no iPhone/iPad: Ajustes > seu nome > Assinaturas). O cancelamento passa a valer ao fim do período já pago.",
      "Qualquer parte não utilizada de um período de teste gratuito, se oferecido, é perdida ao contratar uma assinatura.",
      "Reembolsos seguem as políticas da Apple ou do Google, conforme a loja em que a compra foi feita.",
    ],
  },
  {
    title: "6. Privacidade",
    body: [
      "O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (LGPD) e está descrito na nossa Política de Privacidade.",
    ],
  },
  {
    title: "7. Suspensão e encerramento",
    body: [
      "Podemos suspender ou encerrar contas que violem estes termos. Você pode solicitar a exclusão da sua conta a qualquer momento pela página de exclusão de conta.",
    ],
  },
  {
    title: "8. Limitação de responsabilidade",
    body: [
      "O aplicativo é fornecido \"no estado em que se encontra\". Não nos responsabilizamos por danos indiretos decorrentes do uso ou da impossibilidade de uso do serviço, nos limites permitidos pela lei.",
    ],
  },
  {
    title: "9. Alterações",
    body: [
      "Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no aplicativo. O uso contínuo após a atualização significa concordância com a nova versão.",
    ],
  },
  {
    title: "10. Contato e foro",
    body: [
      "Dúvidas: suporte@doulacare.app.br. Fica eleito o foro da comarca do domicílio do usuário, conforme o Código de Defesa do Consumidor.",
    ],
  },
];

const TermsOfUse = () => (
  <div className="h-[100dvh] overflow-y-auto bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <SmartBackLink label="Voltar" />
      <h1 className="text-3xl font-bold mb-2">Termos de Uso (EULA)</h1>
      <p className="text-muted-foreground text-sm mb-10">
        Última atualização: outubro de 2026
      </p>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold mb-2">{s.title}</h2>
            <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
        <section className="text-sm text-muted-foreground space-y-2">
          <p>
            Também se aplica o{" "}
            <a
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Contrato de Licença padrão da Apple (EULA)
            </a>{" "}
            para compras feitas pela App Store.
          </p>
          <p>
            Veja também a{" "}
            <Link to="/politica-de-privacidade" className="text-primary underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </div>
      <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Doula Care. Todos os direitos reservados.
      </div>
    </div>
  </div>
);

export default TermsOfUse;
