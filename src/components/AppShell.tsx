"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useRole } from "@/components/RoleProvider";

type NavLink = { href: string; label: string; icon: string };
type NavGroup = { heading: string; links: NavLink[] };

const VIDEO_GROUP: NavGroup = {
  heading: "動画",
  links: [
    { href: "/", label: "動画一覧", icon: "▤" },
    { href: "/generate", label: "台本を生成", icon: "✦" },
    { href: "/scripts", label: "お手本", icon: "❐" },
    { href: "/patterns", label: "型", icon: "◈" },
    { href: "/history", label: "履歴", icon: "◷" },
  ],
};

// 撮影セクションは管理者専用（proxy と API 側でも弾いている）。
// 木材・背景素材のマスタも撮影でしか使わないのでここに含める。
const SHOOT_GROUP: NavGroup = {
  heading: "撮影",
  links: [
    { href: "/shoot/planner", label: "撮影プラン", icon: "✧" },
    { href: "/shoot/caption", label: "写真から投稿文", icon: "📷" },
    { href: "/shoot/drafts", label: "下書き", icon: "❏" },
    { href: "/settings/materials", label: "木材マスタ", icon: "❖" },
    { href: "/settings/backgrounds", label: "背景素材マスタ", icon: "▧" },
  ],
};

const ADMIN_GROUP: NavGroup = {
  heading: "管理",
  links: [
    { href: "/settings", label: "ナレーター・商品", icon: "⚙" },
    { href: "/narrator", label: "ナレーター画面", icon: "🎙" },
    { href: "/editor", label: "動画編集画面", icon: "🎞" },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // /settings は配下の /settings/materials 等と取り違えない
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400">
            {group.heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-neutral-900 font-medium text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <span className="w-4 shrink-0 text-center text-base leading-none">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const [open, setOpen] = useState(false);

  // 画面遷移したらドロワーを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ログイン画面、およびナレーター・動画編集の専用画面ではナビを出さない
  // （その役割の人には自分のページしか見せない）
  const hideNav =
    pathname === "/login" ||
    ((pathname.startsWith("/narrator") || pathname.startsWith("/editor")) &&
      role !== "admin");

  async function logout() {
    try {
      await api.del("/api/login");
    } catch {
      /* noop */
    }
    router.replace("/login");
  }

  if (hideNav) {
    return (
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-24 pt-4">
        {children}
      </main>
    );
  }

  const groups: NavGroup[] =
    role === "admin"
      ? [VIDEO_GROUP, SHOOT_GROUP, ADMIN_GROUP]
      : [VIDEO_GROUP, ADMIN_GROUP];

  const brand = (
    <Link href="/" className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold tracking-tight">🎬 cloud9</span>
      <span className="text-[10px] text-neutral-400">コンテンツ</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      {/* デスクトップ：固定サイドバー */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col border-r border-neutral-200 bg-white">
        <div className="px-5 py-4">{brand}</div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <NavList groups={groups} />
        </div>
        <div className="border-t border-neutral-200 px-4 py-3">
          {role === "guest" ? (
            <Link href="/login" className="text-xs text-blue-600 hover:text-blue-800">
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* モバイル：上部バー＋ドロワー */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            className="-ml-1 rounded-lg px-2 py-1 text-lg leading-none hover:bg-neutral-100"
          >
            ☰
          </button>
          {brand}
          {role === "guest" ? (
            <Link href="/login" className="text-xs text-blue-600">
              ログイン
            </Link>
          ) : (
            <button onClick={logout} className="text-xs text-neutral-500">
              ログアウト
            </button>
          )}
        </header>

        {open && (
          <div className="fixed inset-0 z-30 md:hidden">
            <button
              aria-label="メニューを閉じる"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-xl">
              <div className="flex items-center justify-between px-5 py-4">
                {brand}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="メニューを閉じる"
                  className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-neutral-100"
                >
                  ×
                </button>
              </div>
              <div className="px-2 pb-6">
                <NavList groups={groups} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-24 pt-4 md:px-8 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
