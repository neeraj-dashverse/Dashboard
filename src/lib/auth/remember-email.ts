/** Browser-only. Last email used to request a magic link, so the login field is prefilled. */
export const LOGIN_EMAIL_KEY = "ops-login-email";

export function rememberLoginEmail(email: string): void {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || typeof window === "undefined") return;
  window.localStorage.setItem(LOGIN_EMAIL_KEY, trimmed);
}

export function readRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LOGIN_EMAIL_KEY) ?? "";
}
