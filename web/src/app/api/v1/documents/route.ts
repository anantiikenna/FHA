import { NextResponse } from "next/server";

// GET /api/v1/documents/{id}/access — SECURITY.md:27, API.md:22
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      documents: [
        { id: "doc-1", fileName: "Approval_Letter.pdf", documentType: "APPROVAL_LETTER" },
        { id: "doc-2", fileName: "Approved_Building_Plan.pdf", documentType: "BUILDING_PLAN" },
      ],
      note: "DEMO — private storage, signed URL requires document.read + audit VIEW_DOCUMENT",
    },
  });
}
