"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "動画" },
  { href: "/generate", label: "生成" },
  { href: "/scripts", label: "お手本" },
  { href: "/patterns", label: "型" },
  { href: "/history", label: "履歴" },
  { href: "/settings", label: "設定" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <Link href="/" className="font-bold text-sm shrink-0">
            🎬 動画マネージャー
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto -mx-1 pb-2">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
