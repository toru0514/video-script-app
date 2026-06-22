import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { generateText, GeminiError } from "@/lib/gemini";
import { buildExtractPrompt, parseExtractedPattern } from "@/lib/prompts";
import type { Narrator, Script } from "@/lib/types";

// POST /api/patterns/extract  { narrator_id }
// そのナレーターの scripts 全件から型を抽出し patterns に保存する。
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

    const { data: scripts, error: sErr } = await sb
      .from(T.scripts)
      .select("*")
      .eq("narrator_id", narrator_id)
      .order("created_at", { ascending: true })
      .returns<Script[]>();
    if (sErr) return fail(sErr.message, 500);
    if (!scripts || scripts.length === 0)
      return fail("このナレーターのお手本データがありません。先に登録してください。");

    const prompt = buildExtractPrompt(narrator.name, scripts);
    const text = await generateText(prompt, { temperature: 0.4 });
    const parsed = parseExtractedPattern(text);

    const { data: saved, error: pErr } = await sb
      .from(T.patterns)
      .insert({
        narrator_id,
        title_pattern: parsed.title_pattern,
        script_pattern: parsed.script_pattern,
        story_pattern: parsed.story_pattern,
        source_count: scripts.length,
      })
      .select()
      .single();
    if (pErr) return fail(pErr.message, 500);

    return ok(saved, 201);
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message, 500);
  }
}
