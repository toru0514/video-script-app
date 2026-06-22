import { createClient } from "@supabase/supabase-js";

// サーバーサイド専用の Supabase クライアント。
// すべての DB アクセスは Route Handler 経由で行うため、Service Role Key を使用する。
// （このファイルはクライアントバンドルに含めないこと）

// handmade-shipping-manager と同じ Supabase プロジェクトを使用。
// URL は NEXT_PUBLIC_SUPABASE_URL（無ければ SUPABASE_URL）を参照。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 共有プロジェクト（handmade-shipping-manager 等）と衝突しないよう vsg_ で名前空間化
export const T = {
  narrators: "vsg_narrators",
  scripts: "vsg_scripts",
  patterns: "vsg_patterns",
  generations: "vsg_generations",
} as const;

if (!url || !serviceRoleKey) {
  // ビルド時ではなく実行時に分かりやすく落とす
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。",
  );
}

export function getSupabase() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase の環境変数が未設定です。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
