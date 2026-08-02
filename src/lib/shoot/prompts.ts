// ============================================================
// 撮影プラン・投稿文のプロンプト組み立て
// ------------------------------------------------------------
// lumiere から移植。ブランドルールは lumiere 独自の rulesBlock() ではなく
// 動画セクションと共通の buildBrandBlock() を使う（二重管理を作らない）。
// 金属・価格の商品固有ルールも brand.ts の METAL_TYPES / priceLine に一本化した。
// ============================================================

import {
  buildBrandBlock,
  categoryLabel,
  findPurpose,
  METAL_TYPES,
  type MetalType,
} from "../brand.ts";
import type { Product } from "../types.ts";
import { plannedPostBlock, type PlannedPost } from "./postPlan.ts";
import type { Background, Material, PostDesign, PostFormat } from "./types.ts";

// ------------------------------------------------------------
// テーマ別の書き方ガイド（撮影セクション固有）
// ------------------------------------------------------------
interface ThemeGuide {
  /** 誰に向けた投稿か */
  audience: string;
  /** 1行目フックの作り方 */
  hook: string;
  /** 本文の展開 */
  structure: string;
}

const THEME_GUIDES: Record<PostDesign["theme"], ThemeGuide> = {
  process: {
    audience: "ものづくりの過程に惹かれる層（非フォロワーを含む）",
    hook: "作業の一瞬を言い切る。問いかけよりも事実の提示（例:「1本の木が、指輪になるまで」）",
    structure:
      "工程の順序（荒材→成形→研磨→仕上げ）に沿って、手の動きと木の変化を具体で書く。宣伝はしない",
  },
  wood_guide: {
    audience: "木のアクセサリーに興味がある層・木材選びで迷っている層",
    hook: "木材の意外な事実や別用途から入る（例:「仏壇にも、指輪にも。『カリン』という木を知っていますか」）",
    structure:
      "木の由来・産地→色味と木目の特徴→経年変化→アクセサリーにしたときの表情。保存したくなる情報密度にする",
  },
  metal_allergy: {
    audience: "金属アレルギーでアクセサリーを諦めている方",
    hook: "悩み起点で始める（例:「金属アレルギーで、指輪を諦めていませんか」）",
    structure:
      "悩みへの共感→木の指輪という選択肢→軽さ・温かさなど着け心地→商品によって金属使用の有無が異なる旨→ピアスは樹脂フックに変更できるので安心して使えること",
  },
  kikonshiki: {
    audience:
      "結婚3〜5年目の夫婦、および贈り物を探している方（40〜60代男性フォロワーを含む）",
    hook: "問いかけで始める（例:「結婚5年目の記念日に名前があるのを、ご存知ですか」）",
    structure:
      "木婚式とは→なぜ木なのか（夫婦で年輪を重ねる）→木の指輪という選び方→ペアの提案。第三者に転送したくなる情報にする",
  },
  product: {
    audience: "購入を検討している層",
    hook: "何の商品かと、その商品ならではの良さが一目で分かる一文（例:「カリンの指輪は、使うほどに赤みが深まります」）。購入導線は書かない",
    structure:
      "商品の見どころ→価格→サイズ→付属品→Creema への誘導。不安を消す情報を優先する",
  },
  care: {
    audience: "購入検討中・購入後の方",
    hook: "疑問形で不安を先回りする（例:「木のアクセサリーは、濡れても大丈夫?」）",
    structure:
      "生活防水の範囲→濡れたときの手入れ→蜜蝋ワックス→経年変化をポジティブに。保存版として使える手順にする",
  },
};

/** 主目的ごとの書き分け。狙う行動が違えば、本文に入れてよい情報も変わる。 */
const GOAL_RULES: Record<PostDesign["goal"], string> = {
  save: "あとで見返す価値のある情報（手順・比較・目安）を主役にする。価格や購入導線は本文に書かず、CTAだけにとどめる。",
  share:
    "第三者に転送しやすい内容にする。商品の売り込みより、知って得する情報・共感できる文脈を優先する。価格には触れない。",
  profile:
    "購入前に確認したい事実（価格・サイズ・付属品）を本文に入れる。ただし先に「欲しい」と思わせてから書く。魅力の描写なしに仕様だけ並べると、読み手はスペック表として読み飛ばす。事実は本文の後半に必要なものだけを1〜2文でまとめる。",
  reach:
    "新しい人に届けることだけを狙う。価格・購入導線・宣伝的な説明は一切入れない。冒頭の1行と映像の力に全振りする。",
};

// ------------------------------------------------------------
// 入力ブロック
// ------------------------------------------------------------

function productBlock(product: Product): string {
  // 金属の言い方は brand.ts の METAL_TYPES が唯一の定義。ここで分岐を持たない。
  const metal = METAL_TYPES[(product.metal_type ?? "unknown") as MetalType];
  return [
    `- 名前: ${product.name}`,
    product.category ? `- カテゴリ: ${categoryLabel(product.category)}` : null,
    product.material ? `- 木材: ${product.material}` : null,
    product.size_range ? `- サイズ: ${product.size_range}` : null,
    `- 金属: ${metal.rule}`,
    product.description ? `- 特徴: ${product.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function backgroundBlock(backgrounds: Background[]): string {
  if (backgrounds.length === 0) return "（指定なし。商品単体での撮影を想定）";
  return backgrounds
    .map((bg, i) =>
      [
        `${i + 1}.`,
        `- 名前: ${bg.name}`,
        bg.tag ? `- タグ: ${bg.tag}` : null,
        bg.mood ? `- 雰囲気: ${bg.mood}` : null,
        bg.description ? `- メモ: ${bg.description}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function materialBlock(material: Material | null): string {
  if (!material) return "（指定なし）";
  return [
    `- 木材: ${material.name}`,
    material.description ? `- 特徴: ${material.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** テーマ・目的・CTA候補を提示するブロック。CTAは brand.ts の PURPOSES から取る。 */
function designBlock(design: PostDesign): string {
  const guide = THEME_GUIDES[design.theme];
  const ctas = findPurpose(design.goal)?.ctas ?? [];
  return `# この投稿の設計
- テーマ: ${design.theme}
- 読み手: ${guide.audience}
- フックの作り方: ${guide.hook}
- 本文の展開: ${guide.structure}
- 主目的: ${design.goal}（この行動を取ってもらうことだけを狙う。欲張らない）
- 主目的に応じた書き分け: ${GOAL_RULES[design.goal]}

# CTA（次のリストから最も自然な1つを選び、一字一句そのまま使う）
${ctas.map((c) => `- ${c}`).join("\n")}
CTAは自作しない。選んだ文を cta フィールドに出力し、投稿文（caption）の最終行にも同じ文を置く。`;
}

/** 投稿文の共通要件。 */
const CAPTION_SPEC = `- caption の構成（この順序を守る）:
  1行目: hook と同じ一文（35字以内・途中で改行しない）
  空行
  本文2〜4文（1〜2文ごとに空行）。まず魅力、そのあとに事実
  空行
  最終行: 選んだCTAを一字一句そのまま
- 全体で200〜300字程度
- hook フィールドには1行目と同じ文を入れる

## 本文の書き方（ここが投稿の質を決める）
- **一般語だけで済ませない。** 「肌に優しい」「木の温もり」「上品な」「軽やかな着け心地」
  「使うほどに愛着が湧く」は、どの商品にも当てはまるので何も伝えていないのと同じ。
  必ず、その商品・その木材だけの具体に置き換える。
  例）「木の温もり」→「削り出したあと何度も磨くので、手に取ると角がなく、体温がすぐ移ります」
- **次の3つのうち最低2つを必ず入れる**（どれも事実の範囲で書ける）:
  1. 作り手の手の動き・工程（削る／磨く／埋め込む／仕上げる、そのときに何が起きるか）
  2. その木材だけの見え方（色・木目・光の当たり方・経年でどう変わるか）
  3. 着けている場面（どんな装いに合うか、どんな人の手元か、どう見えるか）
- **事実（価格・サイズ・付属品）は羅列しない。** 本文の後半に、必要なものだけを1〜2文でまとめる。
  仕様の箇条書きのような文にしない
- 主語は作り手（わたしたち）。「〜と思います」「〜と嬉しいです」のような謙虚な言い切りを混ぜる

- **1行目に購入導線を書かない**。「プロフィールのリンク」「Creema」「価格と在庫はここで分かります」
  「サイズと在庫を確認できます」のような案内は最終行のCTAの役割で、1行目に置くと同じことを2回言うことになる。
  1行目は「何の商品か」と「その商品ならではの良さ」だけを書く`;

const FORMAT_SPEC: Record<PostFormat, string> = {
  feed: `# フォーマット: フィード（単写真）
1枚で完結させる。carousel と reel は null にする。`,
  carousel: `# フォーマット: カルーセル
carousel に6〜8枚分を出力する。各要素は { "visual": 撮るもの, "text": 画像に載せる文字 }。
- 1枚目は表紙。スワイプしたくなる問い or 断言を20字以内で
- 中盤は1枚1メッセージ。text は最大25字。長い説明を画像に載せない
- 最終スライドは必ず「該当商品＋価格（分かる場合）＋プロフィールのリンクから Creema へ」の構成にする
reel は null。`,
  reel: `# フォーマット: リール
reel に台本を出力する。
- hook: 0〜3秒で何を映し、どんなテキストを出すか（音を使わない前提でも成立させる）
- cuts: カットの流れを3〜5個の配列で。各要素は「何を撮るか＋秒数の目安」
- overlay: 画面に出すテキスト（1〜2本）
- audio: 音の指定（作業音のみ／BGM控えめ 等）と全体尺
撮影プラン（composition 等）はリールの主要カットの撮り方として書く。carousel は null。`,
};

const HASHTAG_SPEC = `- 合計3〜5個。関連度の高いものだけに絞る（数を増やさない運用方針）
- 構成: ブランドタグ「cloud9woodwork」1個 ＋ カテゴリ（木のアクセサリー／木の指輪 など）＋ ハンドメイド系
- 地域名（都道府県・市区町村など）は使わない
- 販路名はタグにしない。購入先はプロフィールのリンクで伝える
- 各要素は先頭の#を付けず、タグ文字列のみ`;

const JSON_SPEC = `# 出力フォーマット（厳守）
必ず次のJSON構造のみで出力すること。前置き・説明・Markdownのコードフェンスは一切付けない。
{
  "composition": "string",
  "lighting": "string",
  "props_arrangement": "string",
  "mood": "string",
  "tips": "string",
  "hook": "string",
  "caption": "string",
  "cta": "string",
  "hashtags": ["string", ...],
  "carousel": [{ "visual": "string", "text": "string" }] または null,
  "reel": { "hook": "string", "cuts": ["string"], "overlay": "string", "audio": "string" } または null
}`;

// ------------------------------------------------------------
// プロンプト
// ------------------------------------------------------------

export function buildPrompt(
  product: Product,
  material: Material | null,
  backgrounds: Background[],
  design: PostDesign,
  planned?: PlannedPost | null,
  note?: string,
): string {
  // 商品マスタは1商品単位なので、複数商品をまたぐ投稿や特定の切り口は
  // このメモで指示する。ブランドルールより優先はしない。
  const noteBlock = note?.trim()
    ? `\n# この投稿で伝えたいこと（優先して反映する。ただしブランドルールには必ず従う）\n${note.trim()}\n`
    : "";

  return `あなたは木のアクセサリーブランドのSNS撮影ディレクター兼コピーライターです。
以下の設計に沿って、Instagram投稿用の撮影プランと投稿文・ハッシュタグを作成してください。

${buildBrandBlock({ product, purpose: design.goal })}

${designBlock(design)}
${noteBlock}${planned ? `\n${plannedPostBlock(planned)}\n` : ""}
${FORMAT_SPEC[design.format]}

# 商品
${productBlock(product)}

# 木材
${materialBlock(material)}

# 背景素材
${backgroundBlock(backgrounds)}

# 撮影プランの要件
**簡潔に**。原則1〜2文。冗長な説明・前置き・修飾語は不要。
- 複数ポイントがある場合のみ箇条書きにする。各行を「・」で始め、改行（\\n）で区切る。各項目あたり最大3点、1点は短く（1行）
- composition: 構図（配置・アングル・余白）
- lighting: ライティング（光源の位置・数・ディフューズ）。商品が主役のカットでは「周囲を暗く落として商品を灯す」方向を基本にする
- props_arrangement: 小物・背景素材の配置
- mood: 仕上がりの雰囲気（短く）
- tips: 撮影のコツ（反射・奥行き・ピントなど）

# 投稿文（caption）の要件
${CAPTION_SPEC}
- 木材が指定されていれば、その特徴（色味・木目・質感）を自然に織り込む

# ハッシュタグ（hashtags）の要件
${HASHTAG_SPEC}

${JSON_SPEC}`;
}

export function buildCaptionPrompt(design: PostDesign, note?: string): string {
  const noteBlock = note?.trim()
    ? `\n# 補足（ユーザーからのメモ・優先して反映）\n${note.trim()}\n`
    : "";
  return `あなたは木のアクセサリーブランド「木材工房cloud9」の作り手に近い立場のSNS担当です。
添付された写真（1枚以上・同じ投稿に使う想定）を見て、Instagram投稿用の投稿文とハッシュタグを作成してください。

${buildBrandBlock({ product: null, purpose: design.goal })}
${noteBlock}
${designBlock(design)}

# 進め方
- まず写真から読み取れる要素（被写体・素材感・色味・光や陰影・小物や背景）を観察する
- その観察に基づいて書く。写真に写っていない事実（樹種・価格・在庫・金属の使用有無など）は断定しない。補足メモがあればその内容を優先する

# 投稿文（caption）の要件
${CAPTION_SPEC}
- 1行目には「木の指輪」「木のアクセサリー」など検索されそうな言葉を自然に含める

# ハッシュタグ（hashtags）の要件
${HASHTAG_SPEC}

# 出力フォーマット（厳守）
必ず次のJSON構造のみで出力すること。前置き・説明・Markdownのコードフェンスは一切付けない。
photo_summary は写真から読み取った要素の要約（日本語で1〜2文）。
{
  "photo_summary": "string",
  "hook": "string",
  "caption": "string",
  "cta": "string",
  "hashtags": ["string", ...]
}`;
}
