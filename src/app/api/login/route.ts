import { ok, fail } from "@/lib/http";
import { getSupabase, T } from "@/lib/supabase";
import { AUTH_COOKIE } from "@/lib/authConstants";

const MAX_AGE = 60 * 60 * 24 * 30; // 30日

// POST /api/login  { password }
// 管理者(env) / 動画編集者(env) / ナレーター(vsg_narrators.password) を判定し Cookie を発行。
export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (typeof password !== "string" || !password) {
      return fail("パスワードを入力してください");
    }

    let role: "admin" | "editor" | "narrator" | null = null;

    const admin = process.env.ADMIN_PASSWORD;
    const editor = process.env.EDITOR_PASSWORD;
    if (admin && password === admin) {
      role = "admin";
    } else if (editor && password === editor) {
      role = "editor";
    } else {
      const sb = getSupabase();
      const { data } = await sb
        .from(T.narrators)
        .select("id")
        .eq("password", password)
        .eq("is_active", true)
        .maybeSingle();
      if (data) role = "narrator";
    }

    if (!role) return fail("パスワードが違います", 401);

    const res = ok({ role });
    res.cookies.set(AUTH_COOKIE, password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return res;
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/login  → ログアウト（Cookie削除）
export async function DELETE() {
  const res = ok({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
