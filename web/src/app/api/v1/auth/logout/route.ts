import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  await supabase.auth.signOut();

  const origin = req.headers.get("origin") || "https://fhafha.netlify.app";
  const loginUrl = new URL("/login", origin);
  const response = NextResponse.redirect(loginUrl);

  // Clear all Supabase auth cookies
  const cookies = req.cookies.getAll();
  for (const cookie of cookies) {
    if (cookie.name.startsWith("sb-") || cookie.name.startsWith("supabase-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
