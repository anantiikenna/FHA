"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLES = ["ADMIN", "ENGINEER", "APPROVAL_OFFICER", "GIS_OFFICER", "SUPERVISOR"] as const;

const ROLE_META: Record<string, { label: string; desc: string; color: "default" | "success" | "warning" | "danger" | "info" | "muted" }> = {
  ADMIN: { label: "Administrator", desc: "Full system access. Manages users, settings, and all data.", color: "danger" },
  SUPERVISOR: { label: "Supervisor", desc: "Creates assignments, reviews inspections, manages engineers.", color: "muted" },
  ENGINEER: { label: "Field Engineer", desc: "Conducts site inspections, captures GPS and photos.", color: "info" },
  APPROVAL_OFFICER: { label: "Approval Officer", desc: "Reviews and approves/rejects property applications.", color: "success" },
  GIS_OFFICER: { label: "GIS Officer", desc: "Manages map data, plot boundaries, and spatial areas.", color: "warning" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [forbidden, setForbidden] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("ENGINEER");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Bulk form
  const [bulkRole, setBulkRole] = useState<string>("APPROVAL_OFFICER");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkCreating, setBulkCreating] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users");
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.success) setUsers(json.data.items);
      else setError(json.error?.message ?? "Failed to load users.");
    } catch {
      setError("Failed to load users.");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/users");
        if (cancelled) return;
        if (res.status === 403 || res.status === 401) {
          setForbidden(true);
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setUsers(json.data.items);
        else setError(json.error?.message ?? "Failed to load users.");
      } catch {
        if (!cancelled) setError("Failed to load users.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (forbidden) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        You do not have permission to manage users. Ask an Administrator for access.
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    byRole: ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r).length })),
  };

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, displayName: inviteName || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to create user.");
      } else {
        setSuccess(`User ${inviteEmail} created as ${ROLE_META[inviteRole]?.label ?? inviteRole}. They can now sign in with email PIN.`);
        setInviteEmail("");
        setInviteName("");
        setShowInvite(false);
        fetchUsers();
      }
    } catch {
      setError("Network error.");
    }
    setInviting(false);
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setBulkCreating(true);
    setError(null);
    setSuccess(null);

    const emails = bulkEmails.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (emails.length === 0) {
      setError("Enter at least one email.");
      setBulkCreating(false);
      return;
    }

    let created = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const res = await fetch("/api/v1/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: bulkRole }),
        });
        const json = await res.json();
        if (json.success) created++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setSuccess(`Created ${created} user(s) as ${ROLE_META[bulkRole]?.label ?? bulkRole}.${failed > 0 ? ` ${failed} failed.` : ""}`);
    setBulkEmails("");
    setShowBulk(false);
    fetchUsers();
    setBulkCreating(false);
  }

  async function toggleActive(u: User) {
    const verb = u.is_active ? "Deactivate" : "Activate";
    if (!window.confirm(`${verb} ${u.display_name || u.email}?`)) return;
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, isActive: !u.is_active }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Failed to update account status.");
        return;
      }
      setError(null);
      fetchUsers();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function changeRole(u: User, newRole: string) {
    if (newRole === u.role) return;
    const ok = window.confirm(
      `Change ${u.display_name || u.email} from ${ROLE_META[u.role]?.label ?? u.role} to ${ROLE_META[newRole]?.label ?? newRole}?`
    );
    if (!ok) {
      // Cancelled — resync the controlled select back to the stored role.
      setUsers((prev) => [...prev]);
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, role: newRole }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Failed to update role.");
        fetchUsers(); // revert the select to the server's value
        return;
      }
      setError(null);
      fetchUsers();
    } catch {
      setError("Network error. Please try again.");
      fetchUsers();
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create accounts, assign roles, and manage system access.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => { setShowRoles(!showRoles); setShowInvite(false); setShowBulk(false); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
            Roles
          </Button>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => { setShowBulk(!showBulk); setShowInvite(false); setShowRoles(false); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Bulk Create
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { setShowInvite(!showInvite); setShowBulk(false); setShowRoles(false); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-danger">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.byRole.find((r) => r.role === "ENGINEER")?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Engineers</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 3h7.5" />
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3">
          <svg className="w-4 h-4 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-danger flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-danger/50 hover:text-danger transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl bg-success-light/50 border border-success/15 px-4 py-3">
          <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-success-dark flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-success/50 hover:text-success transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Role reference */}
      {showRoles && (
        <Card className="border-brand/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Role Permissions Reference</h2>
              <button onClick={() => setShowRoles(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.map((r) => {
                const meta = ROLE_META[r];
                return (
                  <div key={r} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.color}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{r}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meta.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      {showInvite && (
        <Card className="border-brand/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Create New User</h2>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-muted-foreground">The user will be able to sign in immediately using their email and a one-time PIN.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="officer@fha.gov.ng"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Role *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label} ({r})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              </div>
              {inviteRole && (
                <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium">Permissions:</span> {ROLE_META[inviteRole]?.desc}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={inviting}>
                  {inviting ? "Creating..." : "Create User"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk create form */}
      {showBulk && (
        <Card className="border-brand/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Bulk Create Users</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Paste emails — one per line or comma-separated. All will get the same role.</p>
              </div>
              <button onClick={() => setShowBulk(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid sm:grid-cols-[1fr_220px] gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Emails *</label>
                  <textarea
                    required
                    rows={6}
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder={"officer1@fha.gov.ng\nofficer2@fha.gov.ng\nofficer3@fha.gov.ng"}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Assign Role *</label>
                    <select
                      value={bulkRole}
                      onChange={(e) => setBulkRole(e.target.value)}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Preview</p>
                    <p>{bulkEmails.split(/[\n,]+/).filter((s) => s.trim()).length} user(s) will be created as <Badge variant={ROLE_META[bulkRole]?.color ?? "muted"}>{ROLE_META[bulkRole]?.label}</Badge></p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={bulkCreating}>
                  {bulkCreating ? "Creating..." : "Create All Users"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowBulk(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-foreground">All Users ({filtered.length})</h2>
            <div className="relative w-full sm:w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? "No users match your search." : "No users found."}
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Created</th>
                    <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                            {(u.display_name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.display_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          aria-label={`Role of ${u.display_name || u.email}`}
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/40"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => toggleActive(u)}
                          className={`text-sm font-medium px-3.5 py-2 rounded-lg transition-colors ${
                            u.is_active
                              ? "text-danger hover:bg-danger-light"
                              : "text-success hover:bg-success-light"
                          }`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards — no horizontal scroll, 44px+ targets */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                      {(u.display_name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{u.display_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Joined {new Date(u.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <Badge variant={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      aria-label={`Role of ${u.display_name || u.email}`}
                      className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                    <button
                      onClick={() => toggleActive(u)}
                      className={`shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
                        u.is_active
                          ? "border-danger/30 text-danger bg-danger-light/40 active:bg-danger-light"
                          : "border-success/30 text-success bg-success-light/40 active:bg-success-light"
                      }`}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
