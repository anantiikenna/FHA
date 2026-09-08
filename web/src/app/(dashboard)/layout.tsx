import Link from "next/link";
import { MobileNav } from "@/components/nav/MobileNav";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" },
  { href: "/map", label: "Estate Map", icon: "M9 6.75V15m6-6v8.25" },
  { href: "/my-assignments", label: "My Assignments", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" },
  { href: "/plots", label: "Properties", icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" },
  { href: "/approvals", label: "Approvals", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { href: "/documents", label: "Documents", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

const supervisorItems = [
  { href: "/assignments/new", label: "Create Assignment", icon: "M12 4.5v15m7.5-7.5h-15" },
];

const adminItems = [
  { href: "/admin/users", label: "User Management", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  let isSupervisor = false;
  try {
    const supabase = await createClient();
    const auth = supabase.auth as unknown as AuthLike;
    const { data: { user } } = await auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      isAdmin = profile?.role === "ADMIN";
      isSupervisor = profile?.role === "SUPERVISOR";
    }
  } catch { /* not logged in or error — just hide admin */ }

  return (
    <div className="flex flex-1">
      <MobileNav />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-surface border-r border-border">
        {/* Brand header */}
        <div className="px-5 py-5 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-md shadow-brand/15">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">FHA</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Property Mapping</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 group"
            >
              <svg className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}

          {/* Supervisor section */}
          {isSupervisor && (
            <>
              <div className="my-3 border-t border-border" />
              <p className="px-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Supervisor</p>
              {supervisorItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 group"
                >
                  <svg className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              ))}
            </>
          )}

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-border" />
              <p className="px-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Admin</p>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 group"
                >
                  <svg className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground">MVP v0.1 — Prototype</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-muted/40 p-4 md:p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
