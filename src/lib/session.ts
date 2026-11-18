/* Sessão do associado (multiusuário): o id do entregador logado fica no
   navegador e é enviado em todas as chamadas de API. */

const KEY = "rl_courier_id";
const INSTALL_DISMISSED = "rl_install_dismissed";

export function getSessionId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSessionId(id: number) {
  try {
    localStorage.setItem(KEY, String(id));
  } catch { /* armazenamento indisponível */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
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

/** fetch com header de sessão do associado */
export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const id = getSessionId();
  if (id) headers.set("x-courier-id", id);
  return fetch(input, { ...init, headers });
}
