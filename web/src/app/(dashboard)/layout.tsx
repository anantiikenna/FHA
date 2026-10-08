import { redirect } from "next/navigation";
import Link from "next/link";
import { MobileNav } from "@/components/nav/MobileNav";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" },
  { href: "/map", label: "Estate Map", icon: "M9 6.75V15m6-6v8.25" },
  { href: "/plots", label: "Properties", icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" },
  { href: "/approvals", label: "Approvals", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { href: "/documents", label: "Documents", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

// User Management (/admin/users) is DISABLED by owner decision (AGENTS.md §1.1) —
// keep the page/API in code but out of the UI.
const adminItems = [
  { href: "/audit", label: "Audit Log", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;

  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();

  // FAIL CLOSED: no user = redirect to login
  if (!user) {
    redirect("/login");
  }

  let profile: { role: string; is_active?: boolean } | null = null;

  // Try selecting role + is_active; fall back to role-only if is_active column is missing
  const result = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (result.data) {
    profile = result.data;
  } else if (result.error) {
    // First query failed — try role-only as fallback (is_active column may not exist)
    const fallback = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = fallback.data;
  }

  // FAIL CLOSED: missing profile = no authorized role
  if (!profile) {
    redirect("/login?error=session");
  }

  // FAIL CLOSED: inactive account or unknown is_active = redirect to login
  if (profile.is_active !== true) {
    redirect("/login?error=disabled");
  }

  isAdmin = profile.role === "ADMIN";

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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
        <div className="px-3 py-3 border-t border-border space-y-2">
          <a
            href="/api/v1/auth/logout"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-danger hover:bg-danger-light/50 transition-all duration-150 w-full"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </a>
          <p className="px-3 text-[11px] text-muted-foreground/60">MVP v0.1</p>
        </div>
      </aside>

      {/* Main content — pt clears the fixed mobile top bar (~53px) */}
      <main className="flex-1 bg-muted/40 p-4 md:p-6 lg:p-8 pt-[64px] md:pt-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
