import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// A first, cheap gate: anyone with no session cookie at all is sent to the
// login page before any page code runs. This only checks that the cookie
// EXISTS — it can't tell a real session from a made-up one. The real check is
// requireUser()/requireAdmin() in src/lib/auth.ts, called by every page and
// Server Action.
//
// The endpoints SiloMon sites call authenticate with their own Bearer API
// keys instead of a login, so they must stay reachable without a session. So
// does the customer reporting API (/api/v1), which uses a customer's own key.
const PUBLIC_PATHS = ["/login", "/api/ingest", "/api/heartbeat", "/api/config", "/api/v1"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (request.cookies.has("silocentral_session")) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's own static files and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
