// ゲスト（未ログイン）に見せるダミーのサンプルデータ。
// 実データ（Supabase）は一切返さず、ここに埋め込んだ架空の例だけを表示する。
import type {
  Narrator,
  Product,
  Script,
  Pattern,
  Generation,
  Video,
  VideoDetail,
} from "./types";

const T0 = "2026-01-10T00:00:00.000Z";
const T1 = "2026-01-12T00:00:00.000Z";
const T2 = "2026-01-15T00:00:00.000Z";

export const SAMPLE_NARRATORS: Narrator[] = [
  {
    id: "sample-narrator-1",
    name: "サンプル太郎",
    description: "落ち着いた語り口（サンプル）",
    password: null,
    sort_order: 1,
    is_active: true,
    created_at: T0,
  },
  {
    id: "sample-narrator-2",
    name: "サンプル花子",
    description: "明るくテンポの良い語り口（サンプル）",
    password: null,
    sort_order: 2,
    is_active: true,
    created_at: T0,
  },
];

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "sample-product-1",
    name: "木製リング（サンプル商品）",
    description: "天然木を削り出した指輪。軽くて肌なじみが良い。",
    sort_order: 1,
    is_active: true,
    created_at: T0,
  },
  {
    id: "sample-product-2",
    name: "木製スマホスタンド（サンプル商品）",
    description: "デスクに置ける無垢材のスタンド。",
    sort_order: 2,
    is_active: true,
    created_at: T0,
  },
];

const SAMPLE_SCRIPT_TEXT =
  "時を重ねた木々が、あなたの指先に。自然の恵みが、静かな輝きを放ちます。\n" +
  "金属とは違う、肌に寄り添うやさしさ。つけていることを忘れるほどの軽やかさ。\n" +
  "ひとつひとつ手作業で仕上げた、世界にひとつだけの木の指輪です。";

const SAMPLE_STORY_TEXT =
  "1. 木材のアップから始まり、削り出しの工程をテンポよく見せる\n" +
  "2. 完成したリングを手に取るカット\n" +
  "3. 着用シーン（自然光）でやさしい印象に\n" +
  "4. ブランドロゴで締め";

export const SAMPLE_VIDEOS: Video[] = [
  {
    id: "sample-video-1",
    generation_id: "sample-gen-1",
    script_id: null,
    narrator_id: "sample-narrator-1",
    product_id: "sample-product-1",
    title: "指先に宿る、木のやすらぎ",
    narration_status: "not_requested",
    video_status: "not_requested",
    publish_status: "unpublished",
    note: null,
    created_at: T2,
    updated_at: T2,
  },
  {
    id: "sample-video-2",
    generation_id: "sample-gen-2",
    script_id: null,
    narrator_id: "sample-narrator-2",
    product_id: "sample-product-2",
    title: "机の上の、小さな木の相棒",
    narration_status: "done",
    video_status: "rendering",
    publish_status: "unpublished",
    note: "BGMは明るめで",
    created_at: T1,
    updated_at: T1,
  },
  {
    id: "sample-video-3",
    generation_id: "sample-gen-1",
    script_id: null,
    narrator_id: "sample-narrator-1",
    product_id: "sample-product-1",
    title: "贈り物に選ばれる、木の指輪",
    narration_status: "done",
    video_status: "done",
    publish_status: "published",
    note: null,
    created_at: T0,
    updated_at: T0,
  },
];

const SAMPLE_GEN_CONTENT: Record<
  string,
  { output_titles: string; output_script: string; output_story: string }
> = {
  "sample-gen-1": {
    output_titles:
      "指先に宿る、木のやすらぎ\n木の指輪（肌に溶け込む安らぎ）\n贈り物に選ばれる、木の指輪",
    output_script: SAMPLE_SCRIPT_TEXT,
    output_story: SAMPLE_STORY_TEXT,
  },
  "sample-gen-2": {
    output_titles: "机の上の、小さな木の相棒\n無垢材スマホスタンドの魅力",
    output_script:
      "毎日触れるものだから、心地よさにこだわりたい。\n無垢材から削り出したスマホスタンドは、置くだけでデスクの空気が変わります。\n角度はちょうど見やすく、使うほどに手になじみます。",
    output_story:
      "1. 木目のアップ\n2. スタンドにスマホを置くカット\n3. デスク全体の引き\n4. ロゴで締め",
  },
};

export function sampleVideoDetail(id: string | null): VideoDetail | null {
  const v = SAMPLE_VIDEOS.find((x) => x.id === id) ?? SAMPLE_VIDEOS[0];
  if (!v) return null;
  const content = v.generation_id ? SAMPLE_GEN_CONTENT[v.generation_id] : null;
  return { ...v, generation: content ?? null };
}

export const SAMPLE_SCRIPTS: Script[] = [
  {
    id: "sample-script-1",
    narrator_id: "sample-narrator-1",
    title: "木の指輪・お手本台本（サンプル）",
    script: SAMPLE_SCRIPT_TEXT,
    story: SAMPLE_STORY_TEXT,
    theme: "ギフト需要",
    note: "過去に反応が良かった構成",
    created_at: T0,
  },
  {
    id: "sample-script-2",
    narrator_id: "sample-narrator-2",
    title: "スマホスタンド・お手本台本（サンプル）",
    script:
      "毎日触れるものだから、心地よさにこだわりたい。無垢材のスタンドが、デスク時間を少し豊かにします。",
    story: "1. 木目アップ → 2. 設置 → 3. 使用シーン → 4. ロゴ",
    theme: "日常使い",
    note: null,
    created_at: T0,
  },
];

export const SAMPLE_PATTERNS: Pattern[] = [
  {
    id: "sample-pattern-1",
    narrator_id: "sample-narrator-1",
    title_pattern: "〈感情ワード〉＋〈商品の特徴〉でひきつける短いタイトル",
    script_pattern:
      "情景描写 → 素材のこだわり → 手作業の価値 → やわらかい締め、の順で語る",
    story_pattern: "素材アップ → 工程 → 着用/使用 → ロゴ",
    source_count: 5,
    created_at: T0,
  },
];

export const SAMPLE_GENERATIONS: Generation[] = [
  {
    id: "sample-gen-1",
    narrator_id: "sample-narrator-1",
    product_id: "sample-product-1",
    input_theme: "ギフト需要",
    output_titles: SAMPLE_GEN_CONTENT["sample-gen-1"].output_titles,
    output_script: SAMPLE_SCRIPT_TEXT,
    output_story: SAMPLE_STORY_TEXT,
    is_favorite: true,
    created_at: T2,
  },
  {
    id: "sample-gen-2",
    narrator_id: "sample-narrator-2",
    product_id: "sample-product-2",
    input_theme: "日常使い",
    output_titles: SAMPLE_GEN_CONTENT["sample-gen-2"].output_titles,
    output_script: SAMPLE_GEN_CONTENT["sample-gen-2"].output_script,
    output_story: SAMPLE_GEN_CONTENT["sample-gen-2"].output_story,
    is_favorite: false,
    created_at: T1,
  },
];
