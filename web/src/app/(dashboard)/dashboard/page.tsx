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
  let myDraftInspections = 0;
  let mySubmittedInspections = 0;
  let pendingReviews = 0;
  let activeAssignments = 0;
  let totalUsers = 0;
  let pendingApprovals = 0;
  let totalMapAreas = 0;
  let totalInspections = 0;

  try {
    const [plotsResult, approvalsResult] = await Promise.all([
      supabase.from("plots").select("id, approval_status", { count: "exact" }),
      supabase.from("approvals").select("id, status", { count: "exact" }),
    ]);

    totalPlots = plotsResult.count ?? 0;
    approvedPlots = (approvalsResult.data ?? []).filter((a) => a.status === "APPROVED").length;
    pendingPlots = totalPlots - approvedPlots;

    // Engineer stats
    if (role === "ENGINEER" && user) {
      const { data: myInspecs } = await supabase
        .from("inspections")
        .select("id, status")
        .eq("inspector_id", user.id);
      myDraftInspections = (myInspecs ?? []).filter((i) => i.status === "DRAFT").length;
      mySubmittedInspections = (myInspecs ?? []).filter((i) => i.status === "SUBMITTED").length;

      const { count } = await supabase
        .from("inspection_assignments")
        .select("id", { count: "exact" })
        .eq("assigned_to", user.id)
        .in("status", ["ACTIVE", "IN_PROGRESS"]);
      activeAssignments = count ?? 0;
    }

    // Supervisor stats
    if (role === "SUPERVISOR" || role === "ADMIN") {
      const { count } = await supabase
        .from("inspections")
        .select("id", { count: "exact" })
        .eq("status", "SUBMITTED");
      pendingReviews = count ?? 0;

      const { count: activeCount } = await supabase
        .from("inspection_assignments")
        .select("id", { count: "exact" })
        .in("status", ["ACTIVE", "IN_PROGRESS"]);
      activeAssignments = activeCount ?? 0;

      const { count: allInspecs } = await supabase
        .from("inspections")
        .select("id", { count: "exact" });
      totalInspections = allInspecs ?? 0;
    }

    // Admin-only stats
    if (role === "ADMIN") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact" });
      totalUsers = count ?? 0;
    }

    // Approval officer stats
    if (role === "APPROVAL_OFFICER") {
      const { count } = await supabase
        .from("approvals")
        .select("id", { count: "exact" })
        .eq("status", "PENDING");
      pendingApprovals = count ?? 0;
    }

    // GIS officer stats
    if (role === "GIS_OFFICER") {
      const { count } = await supabase
        .from("map_areas")
        .select("id", { count: "exact" });
      totalMapAreas = count ?? 0;
    }
  } catch {
    // Render with zeroed stats on database error
  }

  // Build role-specific stats cards
  const stats = buildStatsForRole(role, {
    totalPlots, approvedPlots, pendingPlots,
    myDraftInspections, mySubmittedInspections, activeAssignments,
    pendingReviews, totalInspections, totalUsers,
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow duration-200">
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

function buildStatsForRole(role: string, data: {
  totalPlots: number; approvedPlots: number; pendingPlots: number;
  myDraftInspections: number; mySubmittedInspections: number; activeAssignments: number;
  pendingReviews: number; totalInspections: number; totalUsers: number;
  pendingApprovals: number; totalMapAreas: number;
}) {
  const P = "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21";
  const C = "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  const T = "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z";
  const I = "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z";
  const U = "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z";
  const M = "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z";

  switch (role) {
    case "ENGINEER":
      return [
        { label: "My Inspections", value: data.myDraftInspections + data.mySubmittedInspections, color: "text-brand", bg: "bg-brand-50", icon: I, sub: `${data.myDraftInspections} draft, ${data.mySubmittedInspections} submitted` },
        { label: "Active Assignments", value: data.activeAssignments, color: "text-info", bg: "bg-info-light", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" },
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
        { label: "Approved", value: data.approvedPlots, color: "text-success", bg: "bg-success-light", icon: C },
      ];
    case "SUPERVISOR":
      return [
        { label: "Pending Reviews", value: data.pendingReviews, color: "text-warning", bg: "bg-warning-light", icon: T, sub: "inspections awaiting review" },
        { label: "Active Assignments", value: data.activeAssignments, color: "text-info", bg: "bg-info-light", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" },
        { label: "Total Inspections", value: data.totalInspections, color: "text-brand", bg: "bg-brand-50", icon: I },
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
      ];
    case "ADMIN":
      return [
        { label: "Total Users", value: data.totalUsers, color: "text-brand", bg: "bg-brand-50", icon: U },
        { label: "Pending Reviews", value: data.pendingReviews, color: "text-warning", bg: "bg-warning-light", icon: T },
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
        { label: "Inspections", value: data.totalInspections, color: "text-info", bg: "bg-info-light", icon: I },
      ];
    case "APPROVAL_OFFICER":
      return [
        { label: "Pending Approvals", value: data.pendingApprovals, color: "text-warning", bg: "bg-warning-light", icon: T, sub: "awaiting your decision" },
        { label: "Approved", value: data.approvedPlots, color: "text-success", bg: "bg-success-light", icon: C },
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
        { label: "Pending", value: data.pendingPlots, color: "text-danger", bg: "bg-danger-light", icon: T },
      ];
    case "GIS_OFFICER":
      return [
        { label: "Map Areas", value: data.totalMapAreas, color: "text-brand", bg: "bg-brand-50", icon: M },
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
        { label: "Approved", value: data.approvedPlots, color: "text-success", bg: "bg-success-light", icon: C },
        { label: "Pending", value: data.pendingPlots, color: "text-warning", bg: "bg-warning-light", icon: T },
      ];
    default:
      return [
        { label: "Properties", value: data.totalPlots, color: "text-foreground", bg: "bg-brand-50", icon: P },
        { label: "Approved", value: data.approvedPlots, color: "text-success", bg: "bg-success-light", icon: C },
        { label: "Pending", value: data.pendingPlots, color: "text-warning", bg: "bg-warning-light", icon: T },
        { label: "Inspections", value: data.totalInspections, color: "text-brand", bg: "bg-brand-50", icon: I },
      ];
  }
}

function buildQuickActionsForRole(role: string) {
  const mapIcon = "M9 6.75V15m6-6v8.25";
  const plotIcon = "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z";
  const approveIcon = "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z";
  const inspIcon = "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z";
  const assignIcon = "M12 4.5v15m7.5-7.5h-15";
  const docIcon = "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z";
  const userIcon = "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z";

  switch (role) {
    case "ENGINEER":
      return [
        { label: "Open Map", href: "/map", icon: mapIcon, primary: true },
        { label: "My Assignments", href: "/my-assignments", icon: assignIcon, primary: false },
        { label: "Inspections", href: "/inspections", icon: inspIcon, primary: false },
        { label: "Properties", href: "/plots", icon: plotIcon, primary: false },
      ];
    case "SUPERVISOR":
      return [
        { label: "Create Assignment", href: "/assignments/new", icon: assignIcon, primary: true },
        { label: "Manage Assignments", href: "/assignments", icon: assignIcon, primary: false },
        { label: "Inspections", href: "/inspections", icon: inspIcon, primary: false },
        { label: "Open Map", href: "/map", icon: mapIcon, primary: false },
      ];
    case "ADMIN":
      return [
        { label: "User Management", href: "/admin/users", icon: userIcon, primary: true },
        { label: "All Assignments", href: "/assignments", icon: assignIcon, primary: false },
        { label: "Open Map", href: "/map", icon: mapIcon, primary: false },
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
      ];
  }
}
