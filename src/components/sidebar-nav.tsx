"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Boxes,
  FlaskConical,
  PlayCircle,
  FileBarChart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requirements", label: "Requirements", icon: ListChecks },
  { href: "/suites", label: "Suites", icon: Boxes },
  { href: "/fixtures", label: "Fixtures", icon: FlaskConical },
  { href: "/cases", label: "Test Cases", icon: FlaskConical },
  { href: "/run", label: "Run Tests", icon: PlayCircle },
  { href: "/results", label: "Results", icon: FileBarChart },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card/40 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <span className="text-lg font-semibold">e2e-testora</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 text-xs text-muted-foreground">
        e2e-testing-db &middot; PostgreSQL
      </div>
    </aside>
  );
}
