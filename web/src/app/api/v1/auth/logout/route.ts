import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { AuthLike } from "@/lib/supabase/types";

const ALLOWED_ORIGINS = [
  "https://fhafha.netlify.app",
  "http://localhost:3000",
  "http://localhost:8888",
];

function getAllowedOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;

  // Never trust an arbitrary Host header for redirect target (open-redirect).
  const host = req.headers.get("host");
  if (host) {
    const isLocal =
      host.startsWith("localhost:") ||
      host.startsWith("127.0.0.1:") ||
      host === "localhost" ||
      host === "127.0.0.1";
    const proto = isLocal ? "http" : "https";
    const candidate = `${proto}://${host}`;
    if (ALLOWED_ORIGINS.includes(candidate) || isLocal) return candidate;
  }
  return ALLOWED_ORIGINS[0];
}

// GET is used by <a href> tags — validate origin
export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", getAllowedOrigin(req)));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Revoke server-side session (best effort), then clear auth cookies
  try {
    const auth = supabase.auth as unknown as AuthLike;
    await auth.signOut();
  } catch {
    // Cookie clear below still logs the user out of the browser
  }

  const cookies = req.cookies.getAll();
  for (const cookie of cookies) {
    if (cookie.name.startsWith("sb-") || cookie.name.startsWith("supabase-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

// POST from forms
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid origin." } },
      { status: 403 }
    );
  }
  return GET(req);
}
