import type { Script, Pattern, Product, GenerateResult } from "./types";

// 商品情報をプロンプト用のテキストにする
function productBlock(product?: Product | null): string {
  if (!product) return "";
  const desc = product.description ? `\n商品の説明・特徴：${product.description}` : "";
  return `\n\n【対象商品】\nこの動画で必ず取り上げる商品：「${product.name}」${desc}\n台本・タイトル・ストーリーは、必ずこの商品「${product.name}」についてのものにしてください。他の商品を勝手に登場させないでください。`;
}

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
  product?: Product | null,
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

  const productLine = product
    ? `商品「${product.name}」を題材にした、`
    : "この傾向・ジャンルに合う、";

  return `以下は私のナレーター「${name}」の過去動画の傾向です。
${productLine}新しい動画テーマ（切り口）の候補を5つ提案してください。
各候補は短いフレーズで、1行ずつ。番号や記号、説明は不要です。
${productBlock(product)}

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
  product?: Product | null;
  targetChars?: number; // お手本台本の平均文字数（長さの目安）
}): string {
  const { name, theme, pattern, scripts, product, targetChars } = args;

  // テーマ指定（商品選択時はテーマ任意）
  const themeLine = theme
    ? `新テーマ「${theme}」`
    : product
      ? `商品「${product.name}」`
      : "新テーマ";

  // 台本の長さ制約。お手本の平均文字数があればそれを基準にする。
  const lengthRule = targetChars
    ? `【最重要・長さ】台本はお手本と同じく短くしてください。目安は全体で約${targetChars}文字、長くても${Math.round(
        targetChars * 1.3,
      )}文字以内。TikTok向けにテンポよく短く読み切れる長さにし、冗長な説明や同じ意味の繰り返しは避け、要点だけを残してください。`
    : `【最重要・長さ】台本はお手本と同じく短く、TikTok向けに数行（テンポよく読み切れる長さ）にしてください。冗長な説明や繰り返しは避けてください。`;

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
${productBlock(product)}

踏襲するのは「型」だけです。つまり——言い回しの傾向・口調・構成の運び・テンポ・温度感。
【最重要・流用禁止】過去動画の具体的な文章やフレーズ、決まり文句（同じ書き出し・同じ言い回し・同じ締め）を、そのまま、または少し変えただけで使い回さないでください。過去に出てきた表現は避け、${themeLine}に合わせて言葉はすべてゼロから新しく書き起こしてください。同じ意味でも必ず別の表現にします。
ナレーター「${name}」らしさ（口調・トーン）は保ちつつ、内容と言葉は${themeLine}に即した新鮮なものにしてください。
日本語のニュアンス・テンポを重視してください。
${lengthRule}
必ず下記のフォーマット（見出しは固定）で出力してください。

# タイトル
（タイトル案を3つ、番号付きで1行ずつ。各行はタイトルそのものだけを書き、「案1」などの語は書かない）

# 台本
（ナレーションが読み上げる本文。上記の長さ制約を必ず守る）

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
