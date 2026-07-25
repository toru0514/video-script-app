// 金属分類は brand.ts が唯一の定義。ここでは型として借りるだけ
// （brand.ts → types.ts は型のみの参照なので実行時の循環は起きない）。
import type { MetalType } from "./brand.ts";

export type Narrator = {
  id: string;
  name: string;
  description: string | null;
  password: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Script = {
  id: string;
  narrator_id: string;
  title: string;
  script: string;
  story: string;
  theme: string | null;
  note: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  /** 商品カテゴリ（ring / crystal_ring / earcuff / earring / bangle / tiepin / cufflinks / necklace） */
  category: string | null;
  /** 主な木材（例: カリン）。特定されている場合のみ */
  material: string | null;
  /** サイズ表記（例: 3〜25号） */
  size_range: string | null;
  /** 最低価格（税込・円）。null なら投稿文に金額を書かせない */
  price_from: number | null;
  /** 金属使用の分類。unknown なら商品固有の断定をさせない */
  metal_type: MetalType | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Pattern = {
  id: string;
  narrator_id: string;
  title_pattern: string | null;
  script_pattern: string | null;
  story_pattern: string | null;
  source_count: number;
  created_at: string;
};

export type Generation = {
  id: string;
  narrator_id: string | null;
  product_id: string | null;
  input_theme: string | null;
  /** 投稿の目的（save / share / profile / reach） */
  input_purpose: string | null;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
  output_post_x: string | null;
  output_post_tiktok: string | null;
  output_post_instagram: string | null;
  is_favorite: boolean;
  created_at: string;
};

// SNS投稿用の文章（各プラットフォーム向け）
export type SnsPosts = {
  x: string;
  tiktok: string;
  instagram: string;
};

export type GenerateResult = {
  titles: string[];
  script: string;
  story: string;
  sns: SnsPosts;
};

export type NarrationStatus = "not_requested" | "recording" | "done";
export type VideoStatus = "not_requested" | "rendering" | "done";
export type PublishStatus = "unpublished" | "published";

export type Video = {
  id: string;
  generation_id: string | null;
  script_id: string | null;
  narrator_id: string | null;
  product_id: string | null;
  title: string;
  narration_status: NarrationStatus;
  video_status: VideoStatus;
  publish_status: PublishStatus;
  note: string | null;
  storage_url: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoDetail = Video & {
  generation: {
    output_titles: string | null;
    output_script: string | null;
    output_story: string | null;
    output_post_x: string | null;
    output_post_tiktok: string | null;
    output_post_instagram: string | null;
  } | null;
};

// ナレーター向けページで表示する 1 件分（未収録動画＋台本/ストーリー）
export type NarratorTask = {
  id: string;
  title: string;
  narration_status: NarrationStatus;
  created_at: string;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
};

export type NarratorTasksResponse = {
  role?: "admin" | "narrator";
  narrator: { id: string; name: string } | null;
  tasks: NarratorTask[];
};

// 動画編集者向けページで表示する 1 件分（動画生成が「依頼中」＋台本/ストーリー）
export type EditorTask = {
  id: string;
  title: string;
  video_status: VideoStatus;
  created_at: string;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
  storage_url: string | null;
};

export type EditorTasksResponse = {
  tasks: EditorTask[];
};
