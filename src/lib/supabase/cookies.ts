/** Keep the session cookie in Chrome for months. Supabase still decides when the login is actually valid. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: AUTH_COOKIE_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

export function persistAuthCookieOptions(
  value: string,
  options?: Record<string, unknown>
): typeof AUTH_COOKIE_OPTIONS & { expires: Date } {
  const clearing = !value;
  const maxAge = clearing ? 0 : AUTH_COOKIE_MAX_AGE;
  return {
    ...AUTH_COOKIE_OPTIONS,
    ...options,
    path: "/",
    sameSite: "lax",
    maxAge,
    expires: clearing ? new Date(0) : new Date(Date.now() + maxAge * 1000),
    secure: process.env.NODE_ENV === "production",
  };
}
