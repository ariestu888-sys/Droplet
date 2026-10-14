import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    return redirectKeepingCookies(request, response, "/login");
  }
  if (signedIn && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    return redirectKeepingCookies(request, response, "/account");
  }

  return response;
}

const PROTECTED_PATHS = ["/account"];
const SIGNED_OUT_ONLY_PATHS = ["/login", "/signup"];

// Carry over any refreshed session cookies, or the user gets signed out.
function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
