import type { Script, Pattern, GenerateResult } from "./types";

// ============================================================
// ステップ1：型抽出プロンプト
// ============================================================
export function buildExtractPrompt(name: string, scripts: Script[]): string {
  const data = scripts
    .map(
      (s, i) =>
        `--- 動画${i + 1} ---\n【タイトル】${s.title}\n【台本】\n${s.script}\n【ストーリー（映像構成）】\n${s.story}`,
    )
    .join("\n\n");

  return `以下は私のナレーター「${name}」のTikTok動画データです（全件）。
過去動画全体に共通する「流れ・雰囲気」を抽出してください。
次の3観点で構造化してください。各観点は見出しを付けて、具体的かつ簡潔にまとめてください。

1. タイトルの付け方（言い回し・長さ・フックの傾向）
2. 台本の流れとトーン（展開パターン、口調、言葉づかい）
3. ストーリー（映像構成）の作り方（シーンの並べ方・見せ方の傾向）

必ず次のフォーマットで出力してください（各セクションの見出しは固定）。

# タイトルの型
（ここに記述）

# 台本の流れ・トーンの型
（ここに記述）

# ストーリー（映像構成）の型
（ここに記述）

【ナレーター「${name}」の過去データ】
${data}`;
}

export type ExtractedPattern = {
  title_pattern: string;
  script_pattern: string;
  story_pattern: string;
};

// 型抽出の応答を3セクションに分解
export function parseExtractedPattern(text: string): ExtractedPattern {
  const title = sliceSection(text, "タイトルの型");
  const script = sliceSection(text, "台本の流れ・トーンの型", "台本");
  const story = sliceSection(text, "ストーリー（映像構成）の型", "ストーリー");
  return {
    title_pattern: title || text,
    script_pattern: script || "",
    story_pattern: story || "",
  };
}

// ============================================================
// ステップ1.5：テーマ提案プロンプト
// ============================================================
export function buildSuggestPrompt(
  name: string,
  pattern: Pattern | null,
  scripts: Script[],
): string {
  let context: string;
  if (pattern) {
    context = `【ナレーター「${name}」の型】
${pattern.title_pattern ?? ""}
${pattern.script_pattern ?? ""}
${pattern.story_pattern ?? ""}`;
  } else {
    context = `【ナレーター「${name}」の過去データ】
${scripts
  .map((s, i) => `${i + 1}. ${s.title}${s.theme ? `（テーマ: ${s.theme}）` : ""}`)
  .join("\n")}`;
  }

  return `以下は私のナレーター「${name}」の過去動画の傾向です。
この傾向・ジャンルに合う、新しい動画テーマの候補を5つ提案してください。
各候補は短いフレーズで、1行ずつ。番号や記号、説明は不要です。

${context}`;
}

export function parseThemeSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s\-*・0-9.、)）]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 8);
}

// ============================================================
// ステップ2：生成プロンプト
// ============================================================
export function buildGeneratePrompt(args: {
  name: string;
  theme: string;
  pattern?: Pattern | null;
  scripts?: Script[];
}): string {
  const { name, theme, pattern, scripts } = args;

  let reference: string;
  if (pattern) {
    reference = `以下はナレーター「${name}」の過去動画から抽出した型です。

【タイトルの型】
${pattern.title_pattern ?? ""}

【台本の流れ・トーンの型】
${pattern.script_pattern ?? ""}

【ストーリー（映像構成）の型】
${pattern.story_pattern ?? ""}`;
  } else {
    const data = (scripts ?? [])
      .map(
        (s, i) =>
          `--- 動画${i + 1} ---\n【タイトル】${s.title}\n【台本】\n${s.script}\n【ストーリー】\n${s.story}`,
      )
      .join("\n\n");
    reference = `以下はナレーター「${name}」の過去動画データ（全件）です。これらに共通する流れ・雰囲気を踏襲してください。

${data}`;
  }

  return `あなたはTikTok動画の構成作家です。
${reference}

この型・雰囲気を厳密に踏襲し、ナレーター「${name}」の雰囲気を保ったまま、
新テーマ「${theme}」について次を出力してください。
日本語のニュアンス・テンポを重視してください。
必ず下記のフォーマット（見出しは固定）で出力してください。

# タイトル
（タイトル案を3つ、番号付きで1行ずつ。各行はタイトルそのものだけを書き、「案1」などの語は書かない）

# 台本
（ナレーションが読み上げる本文）

# ストーリー
（Flow等のAI動画生成に渡す、映像の流れ・シーン構成の説明。シーンごとに分かる粒度で）`;
}

// 生成結果を3ブロックに分解
export function parseGeneration(text: string): GenerateResult {
  const titleBlock = sliceSection(text, "タイトル");
  const script = sliceSection(text, "台本");
  const story = sliceSection(text, "ストーリー");

  const titles = titleBlock
    .split("\n")
    .map((l) =>
      l
        .replace(/^[\s\-*・0-9.、)）]+/, "") // 行頭の番号・記号
        .replace(/^[（(]\s*案\s*\d*\s*[)）]\s*/, "") // 「（案1）」等のプレースホルダ
        .trim(),
    )
    .filter((l) => l.length > 0);

  return {
    titles: titles.length ? titles : titleBlock ? [titleBlock] : [],
    script,
    story,
  };
}

// ============================================================
// 共通：「# 見出し」セクションの本文を取り出す
// ============================================================
function sliceSection(text: string, ...headingKeywords: string[]): string {
  const lines = text.split("\n");
  // 見出し行（# や ## で始まり、キーワードを含む）を探す
  const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
  const matchHeading = (line: string) =>
    isHeading(line) && headingKeywords.some((k) => line.includes(k));

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (matchHeading(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";

  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (isHeading(lines[i])) break; // 次の見出しで終了
    collected.push(lines[i]);
  }
  return collected.join("\n").trim();
}
