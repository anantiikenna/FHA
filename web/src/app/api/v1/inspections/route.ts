import { NextResponse } from "next/server";
import { inspectionSchema } from "@/lib/validation/inspection";

// POST /api/v1/plots/{plotId}/inspections — API.md:25,26
// For demo, POST to /api/v1/inspections with plotId in body
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } }, { status: 422 });
  }
  // TODO: createClient server → auth → inspection.create → audit CREATE_INSPECTION → return 201
  return NextResponse.json({ success: true, data: { id: "demo-inspection-id", status: "DRAFT", ...parsed.data } }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ success: true, data: { items: [], note: "DEMO — list via GET /api/v1/plots/{plotId}/inspections" } });
}
