"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Inbox,
  Gauge,
  Building2,
  ClipboardList,
  Clock,
  BookOpen,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import type { Business, Role } from "@/lib/types";

const NAV = [
  { href: "/action-center", label: "Action Center", icon: Inbox },
  { href: "/dashboard", label: "Nate-ification", icon: Gauge },
];

const SOON_NAV = [
  { href: "/review-center", label: "Review Center", icon: ClipboardList },
  { href: "/timesheet", label: "Genie's Timesheet", icon: Clock },
  { href: "/sop-library", label: "SOP Library", icon: BookOpen },
];

export function AppShell({
  displayName,
  role,
  businesses,
  children,
}: {
  displayName: string;
  role: Role;
  businesses: Business[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <button
        onClick={() => setPaletteOpen(true)}
        className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
      >
        <span className="flex items-center gap-2.5">
          <Search size={16} />
          Search
        </span>
        <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>
      <div className="space-y-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Businesses</p>
        <Link
          href="/businesses"
          onClick={() => setMobileOpen(false)}
          className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/businesses" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Building2 size={16} />
          All businesses
        </Link>
        <div className="space-y-0.5">
          {businesses.map((b) => {
            const href = `/businesses/${b.id}`;
            const active = pathname === href;
            return (
              <Link
                key={b.id}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 pl-4 text-sm transition-colors ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="truncate">{b.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">More</p>
        <div className="space-y-0.5">
          {SOON_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-zinc-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <SidebarHeader />
        {nav}
        <UserFooter displayName={displayName} role={role} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <SidebarHeader compact />
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
            <Menu size={20} />
          </button>
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex bg-black/30" onClick={() => setMobileOpen(false)}>
            <div className="flex h-full w-72 flex-col bg-white" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3">
                <SidebarHeader compact />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>
              {nav}
              <UserFooter displayName={displayName} role={role} onLogout={handleLogout} />
            </div>
          </div>
        )}
      </div>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function SidebarHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? "" : "border-b border-zinc-100 px-4 py-4"}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-sm font-semibold text-white">
        N
      </div>
      <span className="text-sm font-semibold text-zinc-900">Nate OS</span>
    </div>
  );
}

function UserFooter({
  displayName,
  role,
  onLogout,
}: {
  displayName: string;
  role: Role;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{displayName}</p>
        <p className="text-xs capitalize text-zinc-400">{role}</p>
      </div>
      <button onClick={onLogout} title="Log out" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
        <LogOut size={16} />
      </button>
    </div>
  );
}
