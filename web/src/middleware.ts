import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Route → required roles (empty = any authenticated user)
const ROLE_MAP: Record<string, string[]> = {
  "/admin": ["ADMIN"],
  "/assignments": ["SUPERVISOR", "ADMIN"],
};

function getRequiredRole(pathname: string): string[] | null {
  for (const [prefix, roles] of Object.entries(ROLE_MAP)) {
    if (pathname.startsWith(prefix)) return roles;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — no auth required
  const publicPaths = ["/", "/login", "/forbidden", "/api/v1/auth"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Static assets — skip
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: Parameters<typeof response.cookies.set>[2] }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  const { data: { user } } = await (supabase.auth as unknown as { getUser: () => Promise<{ data: { user: unknown } }> }).getUser();
  const isApi = pathname.startsWith("/api/");
  const isProtected = ["/dashboard", "/map", "/plots", "/inspections", "/approvals", "/documents", "/admin", "/assignments", "/my-assignments"].some((p) => pathname.startsWith(p));

  // 1. Not logged in → redirect to /login or 401
  if (!user && (isProtected || isApi)) {
    if (isApi) {
      return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 2. Role-based gate (only for page routes, not API — API has its own checks)
  if (user && !isApi) {
    const requiredRoles = getRequiredRole(pathname);
    if (requiredRoles) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", (user as { id: string }).id)
        .single();

      // Inactive users get logged out
      if (profile && !profile.is_active) {
        if (isApi) {
          return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/login?error=disabled", req.url));
      }

      if (!profile || !requiredRoles.includes(profile.role)) {
        if (isApi) {
          return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
