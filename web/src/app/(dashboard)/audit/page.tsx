"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: { display_name: string; email: string } | null;
}

const ACTION_COLORS: Record<string, "success" | "danger" | "warning" | "info" | "muted"> = {
  CREATE_INSPECTION: "info",
  UPDATE_INSPECTION_STATUS: "warning",
  DELETE_INSPECTION: "danger",
  CREATE_ASSIGNMENT: "info",
  DELETE_ASSIGNMENT: "danger",
  INVITE_USER: "info",
  UPDATE_USER: "warning",
  DEACTIVATE_USER: "danger",
  CREATE_MAP_AREA: "info",
  UPDATE_MAP_AREA: "warning",
  DELETE_MAP_AREA: "danger",
  LIST_USERS: "muted",
};

function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (entityFilter) params.set("entityType", entityFilter);

    fetch(`/api/v1/audit?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.items) setLogs(json.data.items);
        else setError(json.error?.message ?? "Failed to load.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [entityFilter, page]);

  const entityTypes = [...new Set(logs.map((l) => l.entity_type))];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track system activity and user actions.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-brand hover:underline shrink-0">Dashboard</Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option value="">All entity types</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>
        <button
          onClick={() => { setEntityFilter(""); setPage(0); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filter
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No audit entries found.</div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={ACTION_COLORS[log.action] ?? "muted"} className="shrink-0">
                      {formatAction(log.action)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{log.user?.display_name ?? "System"}</span>
                        {" "}&mdash;{" "}
                        <span className="text-muted-foreground">{log.entity_type}</span>
                        {" "}
                        <span className="font-mono text-xs text-muted-foreground">{log.entity_id.slice(0, 8)}...</span>
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {JSON.stringify(log.metadata)}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-sm text-brand hover:underline disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={logs.length < limit}
          className="text-sm text-brand hover:underline disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
