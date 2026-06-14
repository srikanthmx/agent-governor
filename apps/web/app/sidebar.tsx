"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WebAppMode } from "./deployment";

const nav = [
  {
    href: "/",
    label: "Home",
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 5.5L7.5 1.5l5.5 4v8h-4v-4h-3v4H2v-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  },
  {
    href: "/repos",
    label: "Repos",
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M5 1.5v12M2 1.5h9a1.5 1.5 0 011.5 1.5v7a1.5 1.5 0 01-1.5 1.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 1.5A1.5 1.5 0 00.5 3v9A1.5 1.5 0 002 13.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    href: "/settings/agents",
    label: "Runtimes",
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5l5 3v6l-5 3-5-3v-6l5-3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5.25 7.5h4.5M7.5 5.25v4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    href: "/setup",
    label: "Setup",
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 1.5v2M7.5 11.5v2M1.5 7.5h2M11.5 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
];

const controlPlaneNav = [
  nav[0],
  {
    href: "/tasks/6",
    label: "Task Room",
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 3.5h10M2.5 7.5h10M2.5 11.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  nav[2],
];

export function Sidebar({ mode = "local" }: { mode?: WebAppMode }) {
  const pathname = usePathname();
  const items = mode === "control-plane" ? controlPlaneNav : nav;

  return (
    <aside className="ag-sidebar">
      {/* Logo */}
      <div className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-[var(--ag-blue)] flex items-center justify-center transition-transform group-hover:scale-105">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5v6l-5 3-5-3V5l5-3z" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--ag-text-1)] leading-none">Agent Governor</div>
            <div className="mt-0.5 text-[10px] text-[var(--ag-text-4)]">Runtime OS</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 mt-2">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} data-active={active} className="ag-sidebar-link relative">
              <span className={active ? "text-[var(--ag-text-1)]" : ""}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-[var(--ag-border)]">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-green)] shadow-[0_0_6px_var(--ag-green)]" />
          <span className="text-[var(--ag-text-4)]">{mode === "control-plane" ? "Control plane" : "Running"}</span>
        </div>
      </div>
    </aside>
  );
}
