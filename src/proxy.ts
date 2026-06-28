import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/authConstants";

// 認証 Proxy（Next 16 で middleware から改称）。
// 役割の精密な判定（どのナレーターか）は route handler 側で DB 照合する。
// proxy はパスのゲートのみ:
//   - admin パスワード(env)一致 → 全許可
//   - それ以外の Cookie あり    → ナレーター扱い（/narrator 系のみ許可）
//   - Cookie なし               → 未認証

type Gate = "admin" | "narrator" | null;

function gateFromRequest(req: NextRequest): Gate {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const admin = process.env.ADMIN_PASSWORD;
  if (admin && token === admin) return "admin";
  return "narrator";
}

function jsonError(message: string, status: number) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 認証不要：ログイン画面とログインAPI
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const gate = gateFromRequest(req);
  const isApi = pathname.startsWith("/api/");
  const narratorAllowed =
    pathname === "/narrator" || pathname.startsWith("/api/narrator/");

  // 管理者：すべて許可
  if (gate === "admin") return NextResponse.next();

  // ナレーター：自分のページとそのAPIのみ
  if (gate === "narrator") {
    if (narratorAllowed) return NextResponse.next();
    if (isApi) return jsonError("権限がありません", 403);
    return NextResponse.redirect(new URL("/narrator", req.url));
  }

  // 未認証
  if (isApi) return jsonError("認証が必要です", 401);
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 静的アセット等を除く全リクエストに適用
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
