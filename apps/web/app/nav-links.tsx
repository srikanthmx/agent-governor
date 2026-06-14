"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tasks" },
  { href: "/repos", label: "Repos" },
  { href: "/settings/agents", label: "Agents" },
  { href: "/setup", label: "Setup" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--ag-panel-2)] text-[var(--ag-heading)]"
                : "text-[var(--ag-muted)] hover:text-[var(--ag-soft)] hover:bg-[var(--ag-panel)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
