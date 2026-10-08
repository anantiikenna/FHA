"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" },
  { href: "/map", label: "Estate Map", icon: "M9 6.75V15m6-6v8.25" },
  { href: "/plots", label: "Properties", icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" },
  { href: "/approvals", label: "Approvals", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { href: "/documents", label: "Documents", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

// User Management (/admin/users) is DISABLED by owner decision (AGENTS.md §1.1).
const adminItems = [
  { href: "/audit", label: "Audit Log", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const role = json.data.role;
          if (role === "ADMIN") setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-sm shadow-brand/15">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" />
              </svg>
            </div>
            <span className="text-sm font-bold text-foreground">FHA</span>
          </Link>
          <div className="flex items-center gap-1">
            <a
              href="/api/v1/auth/logout"
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-danger-light text-muted-foreground hover:text-danger transition-colors"
              aria-label="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <nav className="fixed top-[53px] left-2 right-2 z-50 bg-surface rounded-xl border border-border shadow-lg overflow-hidden max-h-[80vh] overflow-y-auto">
            <div className="p-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-brand text-white"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <svg className={`w-5 h-5 shrink-0 ${pathname === item.href ? "text-white" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              ))}

              {isAdmin && (
                <>
                  <div className="my-2 border-t border-border" />
                  <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Admin</p>
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        pathname === item.href
                          ? "bg-brand text-white"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <svg className={`w-5 h-5 shrink-0 ${pathname === item.href ? "text-white" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.label}
                    </Link>
                  ))}
                </>
              )}

              <div className="my-2 border-t border-border" />
              <a
                href="/api/v1/auth/logout"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-light/50 transition-colors w-full"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign out
              </a>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
