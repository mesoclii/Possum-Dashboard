import type { ReactNode } from "react";
import Link from "next/link";
import PossumSidebar from "@/components/possum/PossumSidebar";
import DashboardAccessGate from "@/components/possum/DashboardAccessGate";
import GuildNameBootstrap from "@/components/possum/GuildNameBootstrap";
import DashboardBanner from "@/components/possum/DashboardBanner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen possum-bg text-red-300">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b possum-divider bg-black/60 p-3 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4 possum-scroll max-h-[46vh] overflow-y-auto">
          <PossumSidebar />
        </aside>

        <main className="min-w-0 flex-1">
          <GuildNameBootstrap />
          <header className="possum-header sticky top-0 z-20 border-b possum-divider bg-black/75 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] possum-soft">Control Surface</p>
                <Link href="/dashboard" prefetch={false} className="possum-title text-base font-extrabold uppercase tracking-[0.12em]">
                  Possum Dashboard
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/guilds"
                  prefetch={false}
                  className="rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase tracking-[0.08em] possum-red possum-btn"
                >
                  Change Guild
                </Link>
                <Link
                  href="/"
                  prefetch={false}
                  className="rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase tracking-[0.08em] possum-red possum-btn possum-btn-green"
                >
                  Exit
                </Link>
              </div>
            </div>
          </header>

          <DashboardBanner />

          <section className="px-3 py-4 sm:px-5 sm:py-5 2xl:px-8">
            <DashboardAccessGate>{children}</DashboardAccessGate>
          </section>
        </main>
      </div>
    </div>
  );
}