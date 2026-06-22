import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { generateText, GeminiError } from "@/lib/gemini";
import { buildGeneratePrompt, parseGeneration } from "@/lib/prompts";
import type { Narrator, Script, Pattern } from "@/lib/types";

// POST /api/generate  { narrator_id, theme }
// 型があれば型を、なければ過去データ全件を使って生成する。
export async function POST(req: Request) {
  try {
    const { narrator_id, theme } = await req.json();
    if (!narrator_id) return fail("narrator_id は必須です");
    if (!theme?.trim()) return fail("theme は必須です");

    const sb = getSupabase();

    const { data: narrator, error: nErr } = await sb
      .from(T.narrators)
      .select("*")
      .eq("id", narrator_id)
      .single<Narrator>();
    if (nErr || !narrator) return fail("ナレーターが見つかりません", 404);

    // 型を優先。なければ過去データ全件を直渡し（Phase 3 相当）
    const { data: pattern } = await sb
      .from(T.patterns)
      .select("*")
      .eq("narrator_id", narrator_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pattern>();

    let scripts: Script[] = [];
    if (!pattern) {
      const { data } = await sb
        .from(T.scripts)
        .select("*")
        .eq("narrator_id", narrator_id)
        .order("created_at", { ascending: true })
        .returns<Script[]>();
      scripts = data ?? [];
      if (scripts.length === 0)
        return fail(
          "このナレーターのお手本データも型もありません。先にお手本を登録してください。",
        );
    }

    const prompt = buildGeneratePrompt({
      name: narrator.name,
      theme: theme.trim(),
      pattern,
      scripts,
    });

    const text = await generateText(prompt, { temperature: 0.95 });
    const result = parseGeneration(text);

    // 履歴に保存
    const { data: gen } = await sb
      .from(T.generations)
      .insert({
        narrator_id,
        input_theme: theme.trim(),
        output_titles: result.titles.join("\n"),
        output_script: result.script,
        output_story: result.story,
      })
      .select()
      .single();

    return ok({
      ...result,
      raw: text,
      generation_id: gen?.id ?? null,
      used_pattern: !!pattern,
    });
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message, 500);
  }
}
