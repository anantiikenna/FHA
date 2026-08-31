import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// SECURITY.md:5-6, WORKFLOWS.md:4 — protect dashboard + API
export async function middleware(req: NextRequest) {
  const publicPaths = ["/", "/login", "/api/v1/auth"];
  if (publicPaths.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (req.nextUrl.pathname.startsWith("/_next") || req.nextUrl.pathname.startsWith("/favicon")) {
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
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  const isProtected = ["/dashboard", "/map", "/plots", "/inspections", "/approvals", "/documents"].some((p) => req.nextUrl.pathname.startsWith(p));

  if (!user && (isProtected || isApi)) {
    if (isApi) {
      return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
