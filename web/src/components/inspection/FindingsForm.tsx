"use client";
import { useState, useEffect, useCallback } from "react";

type Severity = "INFO" | "REVIEW_REQUIRED" | "HIGH_PRIORITY";

interface Finding {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  severity: Severity;
  recommendation: string | null;
  status: string;
  created_at: string;
}

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; dot: string }> = {
  INFO:             { label: "Info",           color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   dot: "#3b82f6" },
  REVIEW_REQUIRED:  { label: "Review Required", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  dot: "#f59e0b" },
  HIGH_PRIORITY:    { label: "High Priority",   color: "text-red-700",    bg: "bg-red-50 border-red-200",     dot: "#ef4444" },
};

const CATEGORIES = ["Structural", "Setback", "Height/Floors", "Land Use", "Site Condition", "Documentation", "Other"];

export function FindingsForm({
  inspectionId,
  readOnly = false,
}: {
  inspectionId: string;
  readOnly?: boolean;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("INFO");
  const [recommendation, setRecommendation] = useState("");

  const fetchFindings = useCallback(() => {
    fetch(`/api/v1/inspections/${inspectionId}/findings`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setFindings(json.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [inspectionId]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  function resetForm() {
    setTitle("");
    setCategory("");
    setDescription("");
    setSeverity("INFO");
    setRecommendation("");
    setError(null);
    setShowForm(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/inspections/${inspectionId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category || undefined,
          description: description.trim() || undefined,
          severity,
          recommendation: recommendation.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to record finding.");
        return;
      }

      setFindings((prev) => [json.data, ...prev]);
      resetForm();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Inspection Findings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record observations that require attention or follow-up.
          </p>
        </div>
        {!readOnly && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm text-white font-medium hover:bg-brand-light transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Finding
          </button>
        )}
      </div>

      {/* Add finding form */}
      {showForm && !readOnly && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">New Finding</p>

          {/* Severity selector */}
          <div className="flex gap-2">
            {(["INFO", "REVIEW_REQUIRED", "HIGH_PRIORITY"] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  severity === s
                    ? `${SEVERITY_CONFIG[s].bg} ${SEVERITY_CONFIG[s].color} border-current`
                    : "bg-muted/40 text-muted-foreground border-border hover:border-border-strong"
                }`}
              >
                {SEVERITY_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Additional floor observed"
              maxLength={200}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed observations…"
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Recommendation</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Suggested action or follow-up…"
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors disabled:opacity-40 shadow-md shadow-brand/15"
            >
              {saving ? "Saving…" : "Record Finding"}
            </button>
          </div>
        </form>
      )}

      {/* Findings list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <div className="w-4 h-4 rounded-full border-2 border-muted border-t-brand animate-spin" />
          Loading findings…
        </div>
      ) : findings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {readOnly ? "No findings recorded." : 'No findings yet. Use "Add Finding" to record an observation.'}
        </p>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => {
            const cfg = SEVERITY_CONFIG[f.severity as Severity] ?? SEVERITY_CONFIG.INFO;
            return (
              <div
                key={f.id}
                className={`rounded-xl border p-3 ${cfg.bg}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ background: cfg.dot }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${cfg.color}`}>{f.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {f.category && (
                        <span className="text-[10px] text-muted-foreground bg-white/80 border border-border px-1.5 py-0.5 rounded-full">
                          {f.category}
                        </span>
                      )}
                    </div>
                    {f.description && (
                      <p className="text-xs text-foreground/80 mt-1 whitespace-pre-line">{f.description}</p>
                    )}
                    {f.recommendation && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Recommendation:</span> {f.recommendation}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {new Date(f.created_at).toLocaleString()} · Status: {f.status}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Findings are system flags only — not legal determinations. All findings require review by an authorised FHA officer.
      </p>
    </div>
  );
}
