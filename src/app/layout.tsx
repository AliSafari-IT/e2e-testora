import type { Metadata } from "next";
import { SidebarNav } from "@/components/sidebar-nav";
import { RunProvider } from "@/components/run-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "e2e-testora",
  description: "Define, organize and run E2E test suites backed by PostgreSQL and TestCafe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen">
        <RunProvider>
          <SidebarNav />
          {/* pt accounts for the fixed mobile top bar (h-14); reset from md up. */}
          <main className="flex-1 overflow-y-auto p-8 pt-20 md:pt-8">{children}</main>
        </RunProvider>
      </body>
    </html>
  );
}
