import { NextResponse } from "next/server";

// GET /api/v1/plots?search=&blockId=&estateId=&page=&limit= — API.md:13
// MVP: requires auth (SECURITY.md:5) — stub returns demo data until Supabase wired
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  // TODO: createClient server → auth → RLS → plots query with is_demo filter
  return NextResponse.json({
    success: true,
    data: {
      items: [
        { id: "demo-A-003", plotNumber: "003", block: "A", estate: "FHA Festac Estate", status: "APPROVED" },
      ],
      query: { search },
      note: "DEMO DATA — replace with Supabase query",
    },
  });
}
