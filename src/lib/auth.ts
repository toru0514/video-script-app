import { cookies } from "next/headers";
import { getSupabase, T } from "./supabase";
import { AUTH_COOKIE } from "./authConstants";

export type AuthNarrator = { id: string; name: string };
export type Auth =
  | { role: "admin"; narrator: null }
  | { role: "editor"; narrator: null }
  | { role: "narrator"; narrator: AuthNarrator }
  | { role: null; narrator: null };

// Cookie からログイン中の役割を解決する。
// 管理者は env(ADMIN_PASSWORD)、動画編集者は env(EDITOR_PASSWORD)、
// ナレーターは vsg_narrators.password で照合（本人を特定）。
export async function getAuth(): Promise<Auth> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return { role: null, narrator: null };

  const admin = process.env.ADMIN_PASSWORD;
  if (admin && token === admin) return { role: "admin", narrator: null };

  const editor = process.env.EDITOR_PASSWORD;
  if (editor && token === editor) return { role: "editor", narrator: null };

  const sb = getSupabase();
  const { data } = await sb
    .from(T.narrators)
    .select("id, name")
    .eq("password", token)
    .eq("is_active", true)
    .maybeSingle<AuthNarrator>();
  if (data) return { role: "narrator", narrator: data };

  return { role: null, narrator: null };
}
