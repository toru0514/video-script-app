/**
 * 1ヶ月目投稿計画（2026-07-28〜08-23・12本）と固定投稿3本。
 * 出典: reports/1ヶ月目投稿計画_2026-07-24.md, reports/固定投稿・ハイライト設計_2026-07-24.md
 *
 * プランナーでこの枠を選ぶと、テーマ・主目的・フォーマット・フック案が生成プロンプトに入る。
 */

import type { PostFormat, PostGoal, PostTheme } from "./types.ts";

export interface PlannedPost {
  /** 下書きに記録する識別子（例: post-02） */
  ref: string;
  /** 一覧表示用のラベル */
  label: string;
  /** 投稿予定日（YYYY-MM-DD）。固定投稿は null */
  date: string | null;
  theme: PostTheme;
  goal: PostGoal;
  format: PostFormat;
  /** 計画書にあるフック案。生成時の下敷きにする */
  hookIdea: string;
  /** 投稿単位で見るKPI */
  kpi: string;
  /** 生成プロンプトに足す補足（構成・ターゲットなど） */
  note?: string;
}

export const PINNED_POSTS: PlannedPost[] = [
  {
    ref: "pinned-01",
    label: "固定① ブランド紹介＋商品一覧",
    date: null,
    theme: "product",
    goal: "profile",
    format: "carousel",
    hookIdea: "希少木材から生まれる、木のアクセサリー",
    kpi: "プロフィールアクセス",
    note: "8枚。商品ラインと価格（指輪¥4,000〜／クリスタルウッドリング¥8,000／イヤーカフ¥2,500〜／バングル¥11,000／ピアス¥2,500〜／ネクタイピン¥3,500〜）を一覧で示し、最後に Creema への導線。プロフィール到達者が「何を・いくらで・どこで買えるか」を1投稿で理解できることが目的。",
  },
  {
    ref: "pinned-02",
    label: "固定② クリスタルウッドリング紹介",
    date: null,
    theme: "product",
    goal: "profile",
    format: "carousel",
    hookIdea: "木目のなかに、小さな輝きを",
    kpi: "プロフィールアクセス",
    note: "6枚。カリン版・エボニー版の木目、着用、付属品（ケース・ポーチ・クロス）、¥8,000（税込）、サイズ3〜25号。クリスタルは「クリスタルガラス（宝石ではございません）」と明記する。代表作で「欲しい」を作る。",
  },
  {
    ref: "pinned-03",
    label: "固定③ サイズの選び方ガイド",
    date: null,
    theme: "product",
    goal: "save",
    format: "carousel",
    hookIdea: "木の指輪 サイズの選び方【保存版】",
    kpi: "保存率",
    note: "7枚。糸と定規で測る手順→号数換算→関節・むくみの注意→相談導線。自宅測定は目安であり、正確なサイズはリングゲージやジュエリーショップでの測定をすすめる一文を必ず入れる。",
  },
];

export const MONTH1_POSTS: PlannedPost[] = [
  {
    ref: "post-01",
    label: "#1 木材図鑑① カリン",
    date: "2026-07-28",
    theme: "wood_guide",
    goal: "save",
    format: "carousel",
    hookIdea: "仏壇にも、指輪にも。「カリン」という木を知っていますか",
    kpi: "保存率、プロフィールアクセス",
    note: "6枚（木の紹介→木目アップ→製品化の流れ→着用→お手入れ→締め）。ターゲットは木のアクセサリーに興味がある女性。",
  },
  {
    ref: "post-02",
    label: "#2 金属アレルギー①",
    date: "2026-07-31",
    theme: "metal_allergy",
    goal: "profile",
    format: "carousel",
    hookIdea: "金属アレルギーで、指輪を諦めていませんか",
    kpi: "プロフィールアクセス、保存率",
    note: "悩み→木の指輪という選択肢→着け心地→指輪・バングル・イヤーカフは金属不使用、ピアスは金属アレルギー対応パーツ使用で樹脂フックやイヤリングへの変更可→Creema誘導。",
  },
  {
    ref: "post-03",
    label: "#3 製作工程① 研磨",
    date: "2026-08-02",
    theme: "process",
    goal: "reach",
    format: "reel",
    hookIdea: "無音＋研磨で木目が現れる瞬間（BGMなし・作業音のみ）",
    kpi: "非フォロワーリーチ%、平均視聴時間",
    note: "荒材→成形→研磨→完成品を光にかざす（20秒）。テキストオーバーレイ「1本の木が、指輪になるまで」。",
  },
  {
    ref: "post-04",
    label: "#4 商品紹介 カリンの指輪",
    date: "2026-08-04",
    theme: "product",
    goal: "profile",
    format: "carousel",
    hookIdea: "カリンの指輪。価格とサイズはここで分かります",
    kpi: "プロフィールアクセス率",
    note: "商品写真→価格 ¥4,000（税込）→サイズ3〜25号→金属不使用→付属品（指輪用ケース・ポーチ・クロス）→お支払い後4日以内に発送→Creemaへ。カリンの指輪のみ送料が別途かかるため、送料には触れない。",
  },
  {
    ref: "post-05",
    label: "#5 木材図鑑② ピンクアイボリー",
    date: "2026-08-07",
    theme: "wood_guide",
    goal: "save",
    format: "carousel",
    hookIdea: "「木材の女王」。天然でこの色です",
    kpi: "保存率（図鑑①と比較して型を評価）",
    note: "無着色でこの色であることの意外性を軸にする。",
  },
  {
    ref: "post-06",
    label: "#6 製作工程② クリスタル埋め込み",
    date: "2026-08-09",
    theme: "process",
    goal: "reach",
    format: "reel",
    hookIdea: "ドリルで穴を開けクリスタルを落とし込む瞬間",
    kpi: "平均視聴時間（#3と比較）",
  },
  {
    ref: "post-07",
    label: "#7 木婚式① 啓蒙",
    date: "2026-08-11",
    theme: "kikonshiki",
    goal: "share",
    format: "carousel",
    hookIdea: "結婚5年目の記念日に名前があるのを、ご存知ですか",
    kpi: "シェア率",
    note: "ターゲットは結婚3〜5年目の夫婦（妻側）。木婚式とは→なぜ木なのか→木の指輪という選択→ペアの提案→Creema誘導。",
  },
  {
    ref: "post-08",
    label: "#8 着用写真 イヤーカフ",
    date: "2026-08-14",
    theme: "product",
    goal: "profile",
    format: "feed",
    hookIdea: "耳元に、木の温もりを",
    kpi: "プロフィールアクセス率",
    note: "屋内光・屋外光の2枚で木目の見え方の違いを見せる。",
  },
  {
    ref: "post-09",
    label: "#9 リール 金属アレルギー（悩み解決型）",
    date: "2026-08-16",
    theme: "metal_allergy",
    goal: "profile",
    format: "reel",
    hookIdea: "金属の指輪で、かゆくなったことはありませんか",
    kpi: "プロフィールアクセス、保存率",
    note: "悩み提示→木の指輪を着ける手元→軽さ・温かさ→指輪は金属不使用、ピアスは樹脂フックやイヤリングにも変更できる旨→プロフィールへ。",
  },
  {
    ref: "post-10",
    label: "#10 木婚式② 贈り方",
    date: "2026-08-18",
    theme: "kikonshiki",
    goal: "share",
    format: "carousel",
    hookIdea: "木婚式に贈るもの、5つの選択肢",
    kpi: "シェア率＋保存率（啓蒙型#7との比較）",
    note: "比較形式。5つのうち1つが木のアクセサリー。",
  },
  {
    ref: "post-11",
    label: "#11 お手入れガイド",
    date: "2026-08-21",
    theme: "care",
    goal: "save",
    format: "carousel",
    hookIdea: "木のアクセサリーは、濡れても大丈夫?",
    kpi: "保存率",
    note: "生活防水→濡れたら乾拭き＋陰干し→蜜蝋ワックス→経年変化をポジティブに。",
  },
  {
    ref: "post-12",
    label: "#12 リール 木婚式（ギフト型）",
    date: "2026-08-23",
    theme: "kikonshiki",
    goal: "share",
    format: "reel",
    hookIdea: "結婚5年目の記念日、何を贈りますか",
    kpi: "シェア率、非フォロワーリーチ",
    note: "問いかけ→木婚式の説明1カット→ペアリング→指輪用ケース・ポーチ・クロス付き→身近な方への共有を促す。ギフトラッピングは現在不可のため、ラッピングのカットは入れず「ケース付き」で贈り物としての体裁を伝える。",
  },
];

export const PLANNED_POSTS: PlannedPost[] = [...PINNED_POSTS, ...MONTH1_POSTS];

export function findPlannedPost(ref: string | null | undefined): PlannedPost | null {
  if (!ref) return null;
  return PLANNED_POSTS.find((p) => p.ref === ref) ?? null;
}

/** 計画枠の情報を生成プロンプトに差し込む形にする。 */
export function plannedPostBlock(post: PlannedPost): string {
  return `# 投稿計画の枠（この投稿はこの枠として制作する）
- 枠: ${post.label}${post.date ? `（投稿予定日 ${post.date}）` : ""}
- 計画書にあるフック案: ${post.hookIdea}
  ※このフック案をそのまま使うか、同じ狙いでより良い一文に磨いて使う
- 投稿単位で見るKPI: ${post.kpi}${post.note ? `\n- 構成メモ: ${post.note}` : ""}`;
}
