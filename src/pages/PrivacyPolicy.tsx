import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Última atualização: 26 de fevereiro de 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Introdução</h2>
            <p>
              A plataforma <strong>Doula Care</strong> ("nós", "nosso") valoriza a privacidade de
              todos os seus usuários — tanto as <strong>profissionais de doula</strong> (doulas,
              administradoras) quanto as <strong>gestantes, tentantes e lactantes</strong> (clientes).
              Esta política descreve quais dados pessoais coletamos, como os utilizamos, armazenamos
              e protegemos, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei
              nº 13.709/2018).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Dados Coletados</h2>

            <h3 className="font-medium text-foreground mt-4 mb-1">2.1 Doulas (Administradoras)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome completo e e-mail profissional</li>
              <li>Dados financeiros para gestão de cobranças (chave PIX, valores de planos)</li>
              <li>Logotipo e identidade visual da organização</li>
              <li>Registros de acesso e uso da plataforma</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-1">2.2 Gestantes / Clientes</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome completo, CPF, telefone e endereço</li>
              <li>Data provável do parto (DPP) e semanas gestacionais</li>
              <li>Informações de saúde: contrações, registros do diário gestacional, sintomas e emoções</li>
              <li>Dados do(a) acompanhante (nome e telefone)</li>
              <li>Informações de nascimento: data, hora, peso e altura do bebê</li>
              <li>Dados de pagamento e status financeiro</li>
              <li>Foto de perfil (quando enviada)</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Finalidade do Tratamento</h2>
            <p>Utilizamos os dados pessoais para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Prestar o serviço de acompanhamento gestacional entre doula e cliente</li>
              <li>Gerenciar agendamentos, notificações e comunicações</li>
              <li>Controlar cobranças, pagamentos e relatórios financeiros</li>
              <li>Enviar lembretes de consultas e alertas de trabalho de parto</li>
              <li>Permitir o registro do diário gestacional e monitoramento de contrações</li>
              <li>Gerar relatórios gerenciais para a doula</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Base Legal</h2>
            <p>
              O tratamento dos dados pessoais é realizado com base no <strong>consentimento</strong> do
              titular (art. 7º, I da LGPD), na <strong>execução de contrato</strong> de prestação de
              serviços (art. 7º, V) e no <strong>legítimo interesse</strong> do controlador para
              melhoria dos serviços (art. 7º, IX).
            </p>
            <p className="mt-2">
              Dados sensíveis de saúde são tratados com base no consentimento específico do titular
              (art. 11, I da LGPD).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Compartilhamento de Dados</h2>
            <p>
              Os dados das gestantes são compartilhados <strong>exclusivamente</strong> com a doula
              responsável (organização à qual a cliente está vinculada). Não vendemos, alugamos ou
              compartilhamos dados pessoais com terceiros para fins de marketing.
            </p>
            <p className="mt-2">
              Podemos compartilhar dados com provedores de infraestrutura tecnológica
              estritamente necessários para o funcionamento da plataforma, sempre sob
              obrigações contratuais de confidencialidade e segurança.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Armazenamento e Segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Todos os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL)</li>
              <li>O acesso aos dados é controlado por políticas de segurança em nível de linha (RLS), garantindo que cada organização acesse apenas seus próprios dados</li>
              <li>Senhas são armazenadas com hash criptográfico e nunca em texto puro</li>
              <li>Notificações push utilizam chaves VAPID seguras</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Direitos do Titular</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a eliminação de dados desnecessários ou tratados em desconformidade</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato com sua doula responsável ou envie
              uma solicitação pelo canal de suporte da plataforma.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Exclusão de Conta e Dados</h2>
            <p>
              Você pode solicitar a exclusão da sua conta e de todos os seus dados pessoais a
              qualquer momento. Ao solicitar a exclusão, todos os dados associados à sua conta
              serão permanentemente removidos dos nossos servidores, incluindo registros do
              diário gestacional, contrações, agendamentos, pagamentos e informações de perfil.
            </p>
            <p className="mt-2">
              Para solicitar a exclusão da sua conta e dados, acesse:
            </p>
            <p className="mt-2">
              <Link
                to="/excluir-conta"
                className="text-primary underline hover:text-primary/80 font-medium"
              >
                Solicitar exclusão de conta e dados →
              </Link>
            </p>
            <p className="mt-2 text-xs">
              A exclusão será processada em até 30 dias úteis após a confirmação da solicitação.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Retenção de Dados</h2>
            <p>
              Os dados pessoais serão mantidos enquanto houver relação ativa entre a doula e a
              cliente ou enquanto necessário para cumprimento de obrigações legais. Após o
              encerramento da relação, os dados poderão ser eliminados mediante solicitação do
              titular.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Cookies e Tecnologias</h2>
            <p>
              Utilizamos armazenamento local (localStorage) para manter a sessão de autenticação
              e preferências do usuário. Não utilizamos cookies de rastreamento de terceiros.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Alterações nesta Política</h2>
            <p>
              Esta política poderá ser atualizada periodicamente. Notificaremos os usuários sobre
              alterações significativas por meio da plataforma. Recomendamos a revisão periódica
              deste documento.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Contato</h2>
            <p>
              Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de
              seus dados pessoais, entre em contato com a administração da plataforma pelo
              e-mail disponível nas configurações da sua organização.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Doula Care. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
