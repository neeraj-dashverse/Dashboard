/** Shared cookie settings so the session survives closing the tab, not just this browser session. */
export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
};
