import { Capacitor } from "@capacitor/core";
import { SavePassword } from "@capgo/capacitor-autofill-save-password";

type PasswordCredentialConstructor = new (
  data: HTMLFormElement | { id: string; password: string; name?: string }
) => Credential;

type CredentialNavigator = Navigator & {
  credentials?: {
    store?: (credential: Credential) => Promise<Credential | null>;
    create?: (options: { password: HTMLFormElement }) => Promise<Credential | null>;
  };
};

interface SavePasswordParams {
  form?: HTMLFormElement | null;
  loginId: string;
  password: string;
}

export interface SavedPasswordCredential {
  loginId: string;
  password: string;
}

const LAST_LOGIN_IDENTIFIER_KEY = "auth:last-login-identifier";
const IOS_SHARED_WEB_CREDENTIAL_DOMAIN = "doulacare.app.br";

const normalizeLoginId = (loginId: string) => loginId.trim().toLowerCase();

async function saveCredentialOnWeb({ form, loginId, password }: SavePasswordParams) {
  if (!window.isSecureContext) return;

  try {
    const credentialNavigator = navigator as CredentialNavigator;
    const passwordCredential = (window as Window & {
      PasswordCredential?: PasswordCredentialConstructor;
    }).PasswordCredential;

    let credential: Credential | null = null;

    if (passwordCredential && form) {
      credential = new passwordCredential(form);
    } else if (credentialNavigator.credentials?.create && form) {
      credential = await credentialNavigator.credentials.create({ password: form });
    } else if (passwordCredential) {
      credential = new passwordCredential({
        id: loginId,
        password,
        name: loginId,
      });
    }

    if (credential && credentialNavigator.credentials?.store) {
      await credentialNavigator.credentials.store(credential);
    }
  } catch {
    // Best effort only: browsers/password managers may ignore unsupported flows.
  }
}

async function saveCredentialOnNative({ loginId, password }: SavePasswordParams) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await SavePassword.promptDialog({
      username: loginId,
      password,
      url: IOS_SHARED_WEB_CREDENTIAL_DOMAIN,
    });
  } catch (error) {
    console.error("[PasswordManager] Native credential save failed:", error);
  }
}

export async function getSavedNativeCredential(): Promise<SavedPasswordCredential | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const credential = await SavePassword.readPassword();

    if (!credential?.username || !credential.password) {
      return null;
    }

    return {
      loginId: normalizeLoginId(credential.username),
      password: credential.password,
    };
  } catch {
    return null;
  }
}

export function rememberLastLoginIdentifier(loginId: string) {
  if (!loginId) return;
  localStorage.setItem(LAST_LOGIN_IDENTIFIER_KEY, normalizeLoginId(loginId));
}

export function getRememberedLoginIdentifier() {
  const saved = localStorage.getItem(LAST_LOGIN_IDENTIFIER_KEY);
  return saved ? normalizeLoginId(saved) : null;
}

export async function promptToSavePassword(params: SavePasswordParams) {
  const loginId = normalizeLoginId(params.loginId);

  if (!loginId || !params.password) return;

  await saveCredentialOnNative({ ...params, loginId });
  await saveCredentialOnWeb({ ...params, loginId });
}

export async function promptToSaveUpdatedPassword(password: string, fallbackLoginId?: string | null) {
  const loginId = getRememberedLoginIdentifier() ?? (fallbackLoginId ? normalizeLoginId(fallbackLoginId) : null);

  if (!loginId || !password) return;

  await promptToSavePassword({ loginId, password });
}