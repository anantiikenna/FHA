"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface StatusActionsProps {
  plotId: string;
  inspectionStatus: string;
  approvalStatus: string;
  userRole: string;
}

export default function StatusActions({ plotId, inspectionStatus, approvalStatus, userRole }: StatusActionsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function changeStatus(field: "inspection_status" | "approval_status", value: string, reason?: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/plots/${plotId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value, reason }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: `Status updated to ${value.replace(/_/g, " ").toLowerCase()}` });
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage({ type: "error", text: json.error?.message ?? "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
    setLoading(false);
  }

  const canInspect = ["ENGINEER", "SUPERVISOR", "ADMIN"].includes(userRole);
  const canApprove = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"].includes(userRole);

  if (!canInspect && !canApprove) return null;

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <h3 className="font-semibold text-foreground">Status Actions</h3>
        <p className="text-xs text-muted-foreground">Role: <span className="font-medium text-foreground">{userRole.replace(/_/g, " ")}</span></p>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-success-light border border-success/20 text-success-dark"
              : "bg-danger-light border border-danger/20 text-danger"
          }`}>
            {message.type === "success" ? (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            {message.text}
          </div>
        )}

        {/* Engineer actions — inspection status */}
        {canInspect && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">INSPECTION ACTIONS</p>
            <div className="flex flex-wrap gap-2">
              {inspectionStatus === "NOT_INSPECTED" && (
                <button
                  onClick={() => changeStatus("inspection_status", "INSPECTION_IN_PROGRESS")}
                  disabled={loading}
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  Start Inspection
                </button>
              )}
              {inspectionStatus === "INSPECTION_IN_PROGRESS" && (
                <button
                  onClick={() => changeStatus("inspection_status", "INSPECTED")}
                  disabled={loading}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-amber-600 transition-all disabled:opacity-50"
                >
                  Mark Inspected
                </button>
              )}
              {inspectionStatus === "INSPECTED" && (
                <button
                  onClick={() => changeStatus("inspection_status", "AWAITING_REVIEW")}
                  disabled={loading}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand-light transition-all disabled:opacity-50"
                >
                  Submit for Review
                </button>
              )}
              {(inspectionStatus === "AWAITING_REVIEW" || inspectionStatus === "REINSPECTION_REQUIRED") && (
                <button
                  onClick={() => changeStatus("inspection_status", "INSPECTION_IN_PROGRESS")}
                  disabled={loading}
                  className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-purple-600 transition-all disabled:opacity-50"
                >
                  Start Reinspection
                </button>
              )}
            </div>
          </div>
        )}

        {/* Approval Officer actions — approval status */}
        {canApprove && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">APPROVAL ACTIONS</p>
            <div className="flex flex-wrap gap-2">
              {(approvalStatus === "NOT_REVIEWED" || approvalStatus === "PENDING") && inspectionStatus === "AWAITING_REVIEW" && (
                <>
                  <button
                    onClick={() => changeStatus("approval_status", "APPROVED")}
                    disabled={loading}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => changeStatus("approval_status", "APPROVED_WITH_CONDITIONS")}
                    disabled={loading}
                    className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition-all disabled:opacity-50"
                  >
                    Approve with Conditions
                  </button>
                  <button
                    onClick={() => changeStatus("approval_status", "REJECTED")}
                    disabled={loading}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-600 transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      setMessage(null);
                      try {
                        const res1 = await fetch(`/api/v1/plots/${plotId}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ field: "approval_status", value: "PENDING" }),
                        });
                        const res2 = await fetch(`/api/v1/plots/${plotId}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ field: "inspection_status", value: "REINSPECTION_REQUIRED" }),
                        });
                        const j1 = await res1.json();
                        const j2 = await res2.json();
                        if (j1.success && j2.success) {
                          setMessage({ type: "success", text: "Reinspection requested" });
                          setTimeout(() => window.location.reload(), 800);
                        } else {
                          setMessage({ type: "error", text: j1.error?.message ?? j2.error?.message ?? "Failed." });
                        }
                      } catch {
                        setMessage({ type: "error", text: "Network error." });
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-purple-600 transition-all disabled:opacity-50"
                  >
                    Request Reinspection
                  </button>
                </>
              )}
              {(approvalStatus === "NOT_REVIEWED" || approvalStatus === "PENDING") && inspectionStatus !== "AWAITING_REVIEW" && (
                <p className="text-xs text-muted-foreground italic">
                  Waiting for inspection to be submitted for review.
                </p>
              )}
              {approvalStatus === "APPROVED" && (
                <p className="text-xs text-success-dark font-medium">This plot is approved.</p>
              )}
              {approvalStatus === "APPROVED_WITH_CONDITIONS" && (
                <p className="text-xs text-teal-700 font-medium">Approved with conditions.</p>
              )}
              {approvalStatus === "REJECTED" && (
                <p className="text-xs text-danger font-medium">This plot has been rejected.</p>
              )}
            </div>
          </div>
        )}

        {loading && <p className="text-xs text-muted-foreground">Updating...</p>}
      </CardContent>
    </Card>
  );
}
