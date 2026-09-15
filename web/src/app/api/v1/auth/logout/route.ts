import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_ORIGINS = [
  "https://fhafha.netlify.app",
  "http://localhost:3000",
  "http://localhost:8888",
];

function getAllowedOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) {
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  }
  // Fallback: derive from host header (same-origin requests have no Origin)
  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return ALLOWED_ORIGINS[0];
}

// GET is used by <a href> tags — validate origin
export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  // Manually clear all Supabase auth cookies (cookie-based auth)
  const loginUrl = new URL("/login", getAllowedOrigin(req));
  const response = NextResponse.redirect(loginUrl);

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
  return GET(req);
}
