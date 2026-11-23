import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS, persistAuthCookieOptions } from "@/lib/supabase/cookies";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/access-pending"];

function withAuthCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value, persistAuthCookieOptions(cookie.value));
  }
  const pathname = from.headers.get("x-pathname");
  if (pathname) to.headers.set("x-pathname", pathname);
  return to;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("x-pathname", request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set("x-pathname", request.nextUrl.pathname);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, persistAuthCookieOptions(value, options as Record<string, unknown>));
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  const isAsset = request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.startsWith("/api/auth");

  if (!user && !isPublic && !isAsset) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return withAuthCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user && request.nextUrl.pathname === "/login") {
    return withAuthCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
