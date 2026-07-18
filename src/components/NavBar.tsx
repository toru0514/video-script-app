"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useRole } from "@/components/RoleProvider";

const links = [
  { href: "/", label: "動画" },
  { href: "/generate", label: "生成" },
  { href: "/scripts", label: "お手本" },
  { href: "/patterns", label: "型" },
  { href: "/history", label: "履歴" },
  { href: "/narrator", label: "ナレーター" },
  { href: "/editor", label: "動画編集" },
  { href: "/settings", label: "設定" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();

  // ログイン画面では管理ナビを出さない。
  // ナレーター/動画編集ページは、その役割のユーザーには出さないが、
  // 管理者にはページ間を移動できるよう出す。
  if (pathname === "/login") return null;
  if (
    (pathname.startsWith("/narrator") || pathname.startsWith("/editor")) &&
    role !== "admin"
  )
    return null;

  async function logout() {
    try {
      await api.del("/api/login");
    } catch {
      /* noop */
    }
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <Link href="/" className="font-bold text-sm shrink-0">
            🎬 動画マネージャー
          </Link>
          {role === "guest" ? (
            <Link
              href="/login"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ログイン
            </Link>
          ) : (
            <button
              onClick={logout}
              className="text-xs text-neutral-500 hover:text-neutral-800"
            >
              ログアウト
            </button>
          )}
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
