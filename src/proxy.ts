import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/authConstants";

// 認証 Proxy（Next 16 で middleware から改称）。
// 役割の精密な判定（どのナレーターか）は route handler 側で DB 照合する。
// proxy はパスのゲートのみ:
//   - admin     : 全許可（実データ）
//   - narrator  : /narrator 系のみ許可（実データ・本人）
//   - guest(未) : ページ閲覧と GET API は許可（GETはサンプルを返す）。
//                 書き込み(POST/PATCH/DELETE)と AI生成は 403 でブロック。

type Gate = "admin" | "narrator" | "guest";

// AI生成系（ゲスト禁止）
const AI_PATHS = ["/api/generate", "/api/patterns/extract", "/api/themes/suggest"];

function gateFromRequest(req: NextRequest): Gate {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return "guest";
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

  // 認証不要：ログイン画面 / ログインAPI / 役割確認API
  if (pathname === "/login" || pathname === "/api/login" || pathname === "/api/me") {
    return NextResponse.next();
  }

  const gate = gateFromRequest(req);
  const isApi = pathname.startsWith("/api/");
  const isWrite = req.method !== "GET" && req.method !== "HEAD";
  const isAi = AI_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
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

  // ゲスト（未ログイン）
  // ナレーター個別ページは本人特定が必要なのでログインへ
  if (pathname === "/narrator" || pathname.startsWith("/api/narrator/")) {
    if (isApi) return jsonError("認証が必要です", 401);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }
  // AI生成は不可
  if (isAi) return jsonError("サンプルではAI生成は使えません", 403);
  // 書き込みは不可（保存させない）
  if (isWrite) return jsonError("サンプルでは保存・変更できません", 403);
  // それ以外（ページ閲覧・GET API）は許可。GET API は handler がサンプルを返す。
  return NextResponse.next();
}

export const config = {
  // 静的アセット等を除く全リクエストに適用
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
