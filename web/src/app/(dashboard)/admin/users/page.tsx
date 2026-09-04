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

const roleColors: Record<string, "default" | "success" | "warning" | "danger" | "info" | "muted"> = {
  ADMIN: "danger",
  ENGINEER: "info",
  APPROVAL_OFFICER: "success",
  GIS_OFFICER: "warning",
  SUPERVISOR: "muted",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const json = await res.json();
      if (json.success) setUsers(json.data.items);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

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
        setSuccess(`User ${inviteEmail} created as ${inviteRole}. They can now sign in with email PIN.`);
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

    setSuccess(`Created ${created} user(s) as ${bulkRole}.${failed > 0 ? ` ${failed} failed.` : ""}`);
    setBulkEmails("");
    setShowBulk(false);
    fetchUsers();
    setBulkCreating(false);
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    await fetch("/api/v1/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isActive: !currentActive }),
    });
    fetchUsers();
  }

  async function changeRole(userId: string, newRole: string) {
    await fetch("/api/v1/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    fetchUsers();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage system users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowBulk(!showBulk); setShowInvite(false); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Bulk Create
          </Button>
          <Button onClick={() => { setShowInvite(!showInvite); setShowBulk(false); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Invite User
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-light border border-danger/20 px-4 py-3">
          <svg className="w-4 h-4 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-danger/60 hover:text-danger">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-success-light border border-success/20 px-4 py-3">
          <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-success-dark">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-success/60 hover:text-success">✕</button>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <Card className="border-brand/20">
          <CardHeader>
            <h2 className="font-semibold text-foreground">Create New User</h2>
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
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
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
            <h2 className="font-semibold text-foreground">Bulk Create Users</h2>
            <p className="text-sm text-muted-foreground">Paste emails — one per line or comma-separated. All will get the same role.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid sm:grid-cols-[1fr_200px] gap-4">
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
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium">Preview</p>
                    <p>{bulkEmails.split(/[\n,]+/).filter((s) => s.trim()).length} user(s) will be created as <Badge variant={roleColors[bulkRole] ?? "muted"}>{bulkRole.replace(/_/g, " ")}</Badge></p>
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
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">All Users ({users.length})</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
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
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-foreground">{u.display_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand/40"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
