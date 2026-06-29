import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// First-pass auth gate (CLAUDE.md §5.5: "Middleware may redirect unauthenticated
// users, but real enforcement is in the server function"). Runs on the Edge
// runtime, so it only checks the cookie's signature/expiry — it cannot hit the DB.
// The DB-backed session (logout, deactivation) is enforced in `getSessionUser`.

const COOKIE_NAME = "eggfarm_session";

async function hasValidToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await hasValidToken(req.cookies.get(COOKIE_NAME)?.value);
  const isLogin = pathname === "/login";

  if (!authed && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (authed && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/warehouse";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on every route except Next internals, the API, and static asset files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
