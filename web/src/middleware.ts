import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Route → required roles (empty = any authenticated user)
const ROLE_MAP: Record<string, string[]> = {
  "/admin": ["ADMIN", "SUPERVISOR"],
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

  // Static assets — skip
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)) {
    return NextResponse.next();
  }

  // Public paths — no auth required
  const publicPaths = ["/", "/login", "/forbidden", "/api/v1/auth"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Refresh session — this updates the auth cookie if valid
  const { data: { user } } = await supabase.auth.getUser();

  const isApi = pathname.startsWith("/api/");
  const isProtected = ["/dashboard", "/map", "/plots", "/inspections", "/approvals", "/documents", "/admin", "/assignments", "/my-assignments"].some((p) => pathname.startsWith(p));

  // Not logged in → block
  if (!user && (isProtected || isApi)) {
    if (isApi) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based gate (page routes only — API routes handle their own checks)
  if (user && !isApi) {
    const requiredRoles = getRequiredRole(pathname);
    if (requiredRoles) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", (user as { id: string }).id)
        .single();

      if (!profile || !requiredRoles.includes(profile.role)) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
