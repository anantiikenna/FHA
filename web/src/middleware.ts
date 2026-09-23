import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { AuthLike } from "@/lib/supabase/types";

// Route → required roles (empty = any authenticated user)
const ROLE_MAP: Record<string, string[]> = {
  "/admin": ["ADMIN", "SUPERVISOR"],
  "/assignments": ["SUPERVISOR", "ADMIN", "GIS_OFFICER"],
  "/audit": ["ADMIN", "SUPERVISOR"],
};

function getRequiredRole(pathname: string): string[] | null {
  // Assignment detail pages are open to any authenticated user —
  // the API enforces ownership (engineers see only their assignments).
  // /assignments/new and the list page stay supervisor/GIS/admin only.
  if (
    pathname.startsWith("/assignments/") &&
    pathname !== "/assignments/new" &&
    !pathname.startsWith("/assignments/new/")
  ) {
    return null;
  }
  for (const [prefix, roles] of Object.entries(ROLE_MAP)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return roles;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets — skip
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)) {
    return NextResponse.next();
  }

  // Public paths — exact match for "/", prefix only for intentional prefixes.
  // NEVER use startsWith("/") — it matches every path and disables all gating.
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forbidden" ||
    pathname.startsWith("/api/v1/auth");
  if (isPublic) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Refresh session — this updates the auth cookie if valid
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();

  const isApi = pathname.startsWith("/api/");
  const isProtected = ["/dashboard", "/map", "/plots", "/inspections", "/approvals", "/documents", "/admin", "/assignments", "/my-assignments", "/audit"].some((p) => pathname.startsWith(p));

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

  // Session checks — is_active + role gate (page routes; APIs enforce their own roles)
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", (user as { id: string }).id)
      .single();

    // Deactivated account — fail closed
    if (profile && profile.is_active === false) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/login?error=disabled", req.url));
    }

    if (!isApi && profile) {
      const requiredRoles = getRequiredRole(pathname);
      if (requiredRoles && !requiredRoles.includes(profile.role)) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
