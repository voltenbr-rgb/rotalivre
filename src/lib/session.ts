/* Sessão do associado: cada login recebe uma chave de acesso própria
   (gerada pelo servidor), guardada só neste aparelho e enviada em todas
   as chamadas de API. */

const KEY = "rl_session_token";
const LEGACY_KEY = "rl_courier_id";
const INSTALL_DISMISSED = "rl_install_dismissed";

export function getToken(): string | null {
  try {
    localStorage.removeItem(LEGACY_KEY); // formato antigo (inseguro), descartado
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch { /* armazenamento indisponível */ }
}

export type Role = "courier" | "store" | "admin";
const ROLE_KEY = "rl_role";

/** Perfil da sessão neste aparelho: entregador, loja ou painel master */
export function getRole(): Role {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    return r === "store" || r === "admin" ? r : "courier";
  } catch {
    return "courier";
  }
}

export function setRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch { /* ignore */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(ROLE_KEY);
  } catch { /* ignore */ }
}

export function isInstallDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(INSTALL_DISMISSED, "1");
  } catch { /* ignore */ }
}

/** fetch com a chave de sessão do associado */
export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
