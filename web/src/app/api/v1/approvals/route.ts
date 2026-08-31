import { NextResponse } from "next/server";

// GET /api/v1/approvals?plotId=&approvalNumber= — API.md:20, SECURITY.md:33
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plotId = searchParams.get("plotId");
  const approvalNumber = searchParams.get("approvalNumber") ?? "FHA/DEV/2024/1056";
  // TODO: auth + approval.read + query approvals table
  return NextResponse.json({
    success: true,
    data: {
      approvalNumber,
      plotId,
      status: "APPROVED",
      verification: { result: "RECORD_FOUND", checkedAt: new Date().toISOString() },
      note: "DEMO — system verification result, not legal determination (AGENTS.md:7)",
    },
  });
}
