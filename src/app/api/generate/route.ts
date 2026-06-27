import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { generateText, GeminiError } from "@/lib/gemini";
import { buildGeneratePrompt, parseGeneration } from "@/lib/prompts";
import type { Narrator, Script, Pattern, Product } from "@/lib/types";

// POST /api/generate  { narrator_id, theme?, product_id? }
// 型があれば型を、なければ過去データ全件を使って生成する。商品指定時はその商品に限定。
export async function POST(req: Request) {
  try {
    const { narrator_id, theme, product_id } = await req.json();
    if (!narrator_id) return fail("narrator_id は必須です");
    if (!theme?.trim() && !product_id)
      return fail("テーマか商品のどちらかを指定してください");

    const sb = getSupabase();

    const { data: narrator, error: nErr } = await sb
      .from(T.narrators)
      .select("*")
      .eq("id", narrator_id)
      .single<Narrator>();
    if (nErr || !narrator) return fail("ナレーターが見つかりません", 404);

    let product: Product | null = null;
    if (product_id) {
      const { data } = await sb
        .from(T.products)
        .select("*")
        .eq("id", product_id)
        .maybeSingle<Product>();
      product = data ?? null;
    }

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

    // お手本台本の平均文字数を長さの目安にする（LLMには送らずDBで計算）
    let targetChars: number | undefined;
    {
      const lenSource =
        scripts.length > 0
          ? scripts.map((s) => s.script ?? "")
          : (
              await sb
                .from(T.scripts)
                .select("script")
                .eq("narrator_id", narrator_id)
                .returns<{ script: string }[]>()
            ).data?.map((r) => r.script ?? "") ?? [];
      const lengths = lenSource
        .map((t) => t.length)
        .filter((n) => n > 0);
      if (lengths.length > 0) {
        targetChars = Math.round(
          lengths.reduce((a, b) => a + b, 0) / lengths.length,
        );
      }
    }

    const prompt = buildGeneratePrompt({
      name: narrator.name,
      theme: (theme ?? "").trim(),
      pattern,
      scripts,
      product,
      targetChars,
    });

    const text = await generateText(prompt, { temperature: 0.95 });
    const result = parseGeneration(text);

    // 履歴に保存
    const { data: gen } = await sb
      .from(T.generations)
      .insert({
        narrator_id,
        product_id: product?.id ?? null,
        input_theme: (theme ?? "").trim() || null,
        output_titles: result.titles.join("\n"),
        output_script: result.script,
        output_story: result.story,
      })
      .select()
      .single();

    // 生成をきっかけに動画(TODO)を自動作成。タイトルは第1候補をデフォルト採用。
    // 失敗しても生成結果は返す（video_id: null）。診断のためエラーはログに残す。
    let videoId: string | null = null;
    if (gen?.id) {
      const firstTitle =
        result.titles[0]?.trim() || (theme ?? "").trim() || "無題の動画";
      try {
        const { data: video, error: videoErr } = await sb
          .from(T.videos)
          .insert({
            generation_id: gen.id,
            narrator_id,
            product_id: product?.id ?? null,
            title: firstTitle,
          })
          .select("id")
          .single();
        if (videoErr)
          console.error("[generate] vsg_videos insert failed:", videoErr);
        videoId = video?.id ?? null;
      } catch (e) {
        console.error("[generate] vsg_videos insert threw:", e);
      }
    }

    return ok({
      ...result,
      raw: text,
      generation_id: gen?.id ?? null,
      video_id: videoId,
      used_pattern: !!pattern,
    });
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message, 500);
  }
}
