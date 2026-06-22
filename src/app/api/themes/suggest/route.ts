import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { generateText, GeminiError } from "@/lib/gemini";
import { buildSuggestPrompt, parseThemeSuggestions } from "@/lib/prompts";
import type { Narrator, Script, Pattern } from "@/lib/types";

// POST /api/themes/suggest  { narrator_id }
// 型があれば型から、なければ過去データからテーマ候補を複数返す。
export async function POST(req: Request) {
  try {
    const { narrator_id } = await req.json();
    if (!narrator_id) return fail("narrator_id は必須です");

    const sb = getSupabase();

    const { data: narrator, error: nErr } = await sb
      .from(T.narrators)
      .select("*")
      .eq("id", narrator_id)
      .single<Narrator>();
    if (nErr || !narrator) return fail("ナレーターが見つかりません", 404);

    const { data: pattern } = await sb
      .from(T.patterns)
      .select("*")
      .eq("narrator_id", narrator_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pattern>();

    const { data: scripts } = await sb
      .from(T.scripts)
      .select("*")
      .eq("narrator_id", narrator_id)
      .order("created_at", { ascending: true })
      .returns<Script[]>();

    if (!pattern && (!scripts || scripts.length === 0))
      return fail("お手本データも型もありません。先に登録してください。");

    const prompt = buildSuggestPrompt(narrator.name, pattern, scripts ?? []);
    const text = await generateText(prompt, { temperature: 1.0 });
    const themes = parseThemeSuggestions(text);

    return ok({ themes });
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message, 500);
  }
}
