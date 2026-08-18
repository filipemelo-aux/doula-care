import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Supabase recovery links can land on any path (site URL fallback, "/" redirect,
 * unknown route). This catches the recovery tokens anywhere in the app and
 * forwards them, intact, to the reset password page.
 */
export const RecoveryRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/redefinir-senha") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const params = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

    const isRecovery =
      hashParams.get("type") === "recovery" ||
      params.get("type") === "recovery" ||
      (hash.includes("access_token") && hash.includes("recovery"));

    if (!isRecovery) return;

    navigate(`/redefinir-senha${search}${hash}`, { replace: true });
  }, [location.pathname, navigate]);

  return null;
};
