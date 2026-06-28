"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

export type Role = "admin" | "narrator" | "guest" | null;

const RoleContext = createContext<Role>(null);

export function useRole(): Role {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  useEffect(() => {
    api
      .get<{ role: Role }>("/api/me")
      .then((r) => setRole(r.role))
      .catch(() => setRole(null));
  }, []);
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

// 未ログイン（ゲスト）時にサンプル表示中であることを知らせる帯
export function GuestBanner() {
  const role = useRole();
  const pathname = usePathname();
  if (role !== "guest") return null;
  if (pathname === "/login" || pathname.startsWith("/narrator")) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2 text-center">
      サンプル表示中です（保存・AI生成はできません）。
      <Link href="/login" className="underline font-medium ml-1">
        ログイン
      </Link>
      すると実データを編集できます。
    </div>
  );
}
