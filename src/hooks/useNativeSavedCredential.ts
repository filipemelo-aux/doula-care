import { useEffect, useState } from "react";
import {
  getSavedNativeCredential,
  rememberLastLoginIdentifier,
  type SavedPasswordCredential,
} from "@/lib/passwordManager";

export function useNativeSavedCredential(enabled = true) {
  const [savedCredential, setSavedCredential] = useState<SavedPasswordCredential | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const loadSavedCredential = async () => {
      const credential = await getSavedNativeCredential();

      if (!credential || cancelled) return;

      rememberLastLoginIdentifier(credential.loginId);
      setSavedCredential(credential);
    };

    void loadSavedCredential();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return savedCredential;
}