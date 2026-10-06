import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface SmartBackLinkProps {
  /** Destino usado quando não há histórico para voltar (ex.: link aberto direto). */
  fallback?: string;
  label?: string;
  className?: string;
}

/**
 * Botão "Voltar" para páginas públicas (Política de Privacidade, Termos de Uso, Suporte).
 * Ordem de resolução:
 *  1. Parâmetro `?from=/rota` na URL (definido por quem abriu a página).
 *  2. Histórico do navegador (volta exatamente para a tela anterior).
 *  3. Fallback (normalmente /login).
 */
const SmartBackLink = ({
  fallback = "/login",
  label = "Voltar",
  className = "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8",
}: SmartBackLinkProps) => {
  const { search } = useLocation();
  const navigate = useNavigate();

  const from = new URLSearchParams(search).get("from");
  const fromPath = from && from.startsWith("/") ? from : null;

  const handleClick = (e: React.MouseEvent) => {
    if (fromPath) return; // Link já aponta para a origem correta.
    if (window.history.length > 1) {
      e.preventDefault();
      navigate(-1);
    }
  };

  return (
    <Link
      to={fromPath ?? fallback}
      onClick={handleClick}
      className={className}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Link>
  );
};

export default SmartBackLink;
