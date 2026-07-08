"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { logoutAction } from "./actions";

export type IconName =
  | "tasks"
  | "egg"
  | "scale"
  | "clipboard"
  | "box"
  | "adjust"
  | "cart"
  | "people"
  | "beaker"
  | "grid"
  | "pill"
  | "shield"
  | "chart"
  | "document"
  | "home"
  | "tag"
  | "ruler"
  | "layers";

const ICONS: Record<IconName, ReactNode> = {
  tasks: (
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  ),
  egg: <path d="M12 3c-3.3 0-6 4.7-6 8.5a6 6 0 0012 0C18 7.7 15.3 3 12 3z" />,
  scale: (
    <path d="M12 3v18M8 21h8M4.5 8h15M7 8l-3 6a3 3 0 006 0L7 8zm10 0l-3 6a3 3 0 006 0l-3-6z" />
  ),
  clipboard: (
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" />
  ),
  box: <path d="M4 7.5L12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  adjust: (
    <path d="M6 4v5m0 6v5M6 9a3 3 0 100 6 3 3 0 000-6zM18 4v3m0 6v7M18 7a3 3 0 100 6 3 3 0 000-6z" />
  ),
  cart: (
    <path d="M4 4h2l1.6 11h9.4l2-8H6M9.5 20a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
  ),
  people: (
    <path d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM17 11a3 3 0 10-2-5.2M21 19v-1a4 4 0 00-2.5-3.7" />
  ),
  beaker: (
    <path d="M9 3h6M10 3v5.5L5.5 17A2.5 2.5 0 008 21h8a2.5 2.5 0 002.5-3.5L14 8.5V3M7.5 15h9" />
  ),
  grid: <path d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 15h6v6H4v-6zm10 0h6v6h-6v-6z" />,
  pill: <path d="M10.8 4.2a4.5 4.5 0 016.4 6.4l-6.6 6.6a4.5 4.5 0 01-6.4-6.4l6.6-6.6zM8 8l7 7" />,
  shield: <path d="M12 3l8 3v6c0 5-3.4 8.2-8 9.5C7.4 20.2 4 17 4 12V6l8-3zm-2.5 8.5L11.5 14 16 9.5" />,
  chart: <path d="M4 20V4M4 20h16M8 20v-6M12 20v-9M16 20v-4M20 20V8" />,
  document: <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6" />,
  home: <path d="M4 11l8-7 8 7M6 9.5V20h4v-6h4v6h4V9.5" />,
  tag: (
    <path d="M3 5v6.6a2 2 0 00.6 1.4l7.4 7.4a2 2 0 002.8 0l5.2-5.2a2 2 0 000-2.8L11.6 5A2 2 0 0010.2 4.4H4a1 1 0 00-1 .6zM7.5 8.5h.01" />
  ),
  ruler: <path d="M4 9l5-5 11 11-5 5L4 9zm4-1l1.5 1.5M11 5l1.5 1.5M14 8l1.5 1.5M17 11l1.5 1.5" />,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { title: string; items: NavItem[] };

/**
 * Responsive app shell: a grouped sidebar (all items visible under headers, no
 * hidden dropdowns) that is static on desktop and a slide-in drawer on phones
 * (SRS §4.1: usable on a 5-inch screen, no horizontal scroll). Big tap targets,
 * clear "you are here" state.
 */
export function AppShell({
  user,
  groups,
  homeHref,
  children,
}: {
  user: { name: string; role: string };
  groups: NavGroup[];
  homeHref: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // drawer closes on link tap (see onClick below)

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href={homeHref} className="font-semibold tracking-tight">
          EggFarm IMS
        </Link>
      </header>

      {open && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 sm:sticky sm:top-0 sm:z-0 sm:h-screen sm:w-60 sm:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <Link href={homeHref} className="font-semibold tracking-tight">
            EggFarm IMS
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 sm:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {group.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
                        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-zinc-200 p-3">
          <div className="px-1 text-sm font-medium text-zinc-700">{user.name}</div>
          <div className="px-1 text-xs text-zinc-400">{user.role}</div>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pt-14 sm:pt-0">{children}</main>
    </div>
  );
}
