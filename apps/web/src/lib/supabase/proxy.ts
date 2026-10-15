import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";

// Refreshes the Supabase auth session cookie on each request.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims():
  // it revalidates the session and must happen first.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Quick redirects only; pages still check the user themselves.
  if (!signedIn && PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    // Come back here after logging in.
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectKeepingCookies(request, response, "/login", `?next=${encodeURIComponent(next)}`);
  }
  if (signedIn && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    return redirectKeepingCookies(request, response, safeNextPath(request.nextUrl.searchParams.get("next"), "/home"));
  }

  return response;
}

const PROTECTED_PATHS = ["/home", "/account", "/organizations", "/events"];
const SIGNED_OUT_ONLY_PATHS = ["/", "/login", "/signup"];

// Carry over any refreshed session cookies, or the user gets signed out.
function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  target: string,
  search = "",
) {
  // `target` may carry its own query (a "next" page such as /invite/abc?x=1).
  const url = new URL(target + search, request.nextUrl.origin);
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
