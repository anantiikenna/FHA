import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();

  let profile: { role: string; display_name: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const role = profile?.role ?? "ENGINEER";
  const displayName = profile?.display_name ?? "User";

  // Shared stats
  let totalPlots = 0;
  let approvedPlots = 0;
  let pendingPlots = 0;

  // Role-specific stats
  let pendingApprovals = 0;
  let totalMapAreas = 0;

  try {
    // Exact counts via head queries — never filter over the default
    // 1000-row page (counts stay accurate past the row cap).
    const [totalRes, approvedRes, areasRes] = await Promise.all([
      supabase.from("plots").select("id", { count: "exact", head: true }),
      supabase.from("plots")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["APPROVED", "APPROVED_WITH_CONDITIONS"]),
      supabase.from("map_areas").select("id", { count: "exact", head: true }),
    ]);

    totalPlots = totalRes.count ?? 0;
    approvedPlots = approvedRes.count ?? 0;
    pendingPlots = totalPlots - approvedPlots;
    totalMapAreas = areasRes.count ?? 0;

    // Approval officer stats
    if (role === "APPROVAL_OFFICER") {
      const { count } = await supabase
        .from("approvals")
        .select("id", { count: "exact" })
        .eq("status", "PENDING");
      pendingApprovals = count ?? 0;
    }
  } catch {
    // Render with zeroed stats on database error
  }

  // Build role-specific stats cards
  const stats = buildStatsForRole(role, {
    totalPlots, approvedPlots, pendingPlots,
    pendingApprovals, totalMapAreas,
  });

  // Build role-specific quick actions
  const quickActions = buildQuickActionsForRole(role);

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrator",
    SUPERVISOR: "Supervisor",
    ENGINEER: "Field Engineer",
    APPROVAL_OFFICER: "Approval Officer",
    GIS_OFFICER: "GIS Officer",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <Badge variant="info" className="mr-1">{roleLabel[role] ?? role}</Badge>
            FHA Festac Estate — Phase 1
          </p>
        </div>
        <Badge variant="info">Prototype</Badge>
      </div>

      {/* Stats — every card links to its page */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block">
            <Card className="hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <svg className={`w-5 h-5 ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  {stat.sub && <p className="text-xs text-muted-foreground font-medium">{stat.sub}</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-foreground">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={action.primary
                  ? "inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand-light hover:shadow-lg hover:shadow-brand/20 transition-all duration-200"
                  : "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:border-border-strong transition-all duration-200"
                }
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={action.primary ? 2 : 1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                </svg>
                {action.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type StatCard = {
  label: string; href: string; value: number;
  color: string; bg: string; icon: string; sub?: string;
};

function buildStatsForRole(role: string, data: {
  totalPlots: number; approvedPlots: number; pendingPlots: number;
  pendingApprovals: number; totalMapAreas: number;
}): StatCard[] {
  const P = "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21";
  const C = "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  const T = "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z";
  const M = "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z";

  const areaCard = { label: "Map Areas", href: "/map", value: data.totalMapAreas, color: "text-info", bg: "bg-info-light", icon: M };
  const propertiesCard = { label: "Properties", href: "/plots", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P };
  const approvedCard = { label: "Approved", href: "/plots", value: data.approvedPlots, color: "text-success", bg: "bg-success-light", icon: C };
  const pendingCard = { label: "Pending", href: "/plots", value: data.pendingPlots, color: "text-warning", bg: "bg-warning-light", icon: T };

  switch (role) {
    case "APPROVAL_OFFICER":
      return [
        { label: "Pending Approvals", href: "/approvals", value: data.pendingApprovals, color: "text-warning", bg: "bg-warning-light", icon: T, sub: "awaiting your decision" },
        approvedCard,
        propertiesCard,
        { label: "Pending", href: "/plots", value: data.pendingPlots, color: "text-danger", bg: "bg-danger-light", icon: T },
      ];
    case "GIS_OFFICER":
      return [areaCard, propertiesCard, approvedCard, pendingCard];
    default:
      return [propertiesCard, approvedCard, pendingCard, areaCard];
  }
}

function buildQuickActionsForRole(role: string) {
  const mapIcon = "M9 6.75V15m6-6v8.25";
  const plotIcon = "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z";
  const approveIcon = "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z";
  const docIcon = "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z";

  switch (role) {
    case "SUPERVISOR":
      return [
        { label: "Open Map", href: "/map", icon: mapIcon, primary: true },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
        { label: "Documents", href: "/documents", icon: docIcon, primary: false },
      ];
    case "ADMIN":
      return [
        { label: "Open Map", href: "/map", icon: mapIcon, primary: true },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
        { label: "Audit Log", href: "/audit", icon: docIcon, primary: false },
      ];
    case "APPROVAL_OFFICER":
      return [
        { label: "Approvals Queue", href: "/approvals", icon: approveIcon, primary: true },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
        { label: "Documents", href: "/documents", icon: docIcon, primary: false },
        { label: "Open Map", href: "/map", icon: mapIcon, primary: false },
      ];
    case "GIS_OFFICER":
      return [
        { label: "Open Map", href: "/map", icon: mapIcon, primary: true },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
        { label: "Documents", href: "/documents", icon: docIcon, primary: false },
      ];
    default:
      return [
        { label: "Open Map", href: "/map", icon: mapIcon, primary: true },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
        { label: "Approvals", href: "/approvals", icon: approveIcon, primary: false },
      ];
  }
}
